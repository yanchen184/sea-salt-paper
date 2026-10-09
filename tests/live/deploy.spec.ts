import { execSync } from 'node:child_process'
import { errors, type Page } from '@playwright/test'
import { expect, test, createRoom, joinRoom, openHome } from '../e2e/helpers'

const PAIR_KINDS = ['crab', 'boat', 'fish']

function expectedSha(): string {
  return process.env.EXPECTED_SHA ?? execSync('git ls-remote origin refs/heads/main', { encoding: 'utf8' }).split(/\s/)[0]
}

/** 線上測試驗的是對局流程，關掉動畫縮短整局時間 */
async function disableAnimations(page: Page): Promise<void> {
  await page.getByTestId('anim-toggle').locator('input').uncheck()
}

async function clickIfEnabled(page: Page, testId: string): Promise<boolean> {
  const button = page.getByTestId(testId).first()
  if ((await button.count()) === 0 || !(await button.isEnabled())) return false
  await button.click()
  return true
}

async function setSelected(page: Page, id: string, selected: boolean): Promise<void> {
  const card = page.locator(`[data-testid="hand-card"][data-card-id="${id}"]`)
  if ((await card.getAttribute('aria-pressed')) !== String(selected)) await card.click()
}

async function handIds(page: Page): Promise<string[]> {
  const cards = await page.getByTestId('hand-card').all()
  return Promise.all(cards.map(async (c) => (await c.getAttribute('data-card-id')) ?? ''))
}

/** 棄牌堆頂能和手牌湊成一對時拿那張 */
async function takePairingDiscard(page: Page): Promise<boolean> {
  const ids = await handIds(page)
  for (const pile of [0, 1]) {
    const top = page.getByTestId(`discard-top-${pile}`)
    if ((await top.count()) === 0) continue
    const kind = ((await top.getAttribute('data-card-id')) ?? '').split('-')[0]
    if (PAIR_KINDS.includes(kind) && ids.some((id) => id.startsWith(`${kind}-`)) && (await clickIfEnabled(page, `action-take-${pile}`))) return true
  }
  return false
}

async function playPair(page: Page): Promise<boolean> {
  const ids = await handIds(page)
  for (const kind of PAIR_KINDS) {
    const pair = ids.filter((id) => id.startsWith(`${kind}-`)).slice(0, 2)
    if (pair.length < 2) continue
    for (const id of pair) await setSelected(page, id, true)
    if (await clickIfEnabled(page, 'duo-crab-0')) return true
    if (await clickIfEnabled(page, 'duo-crab-1')) return true
    if (await clickIfEnabled(page, 'play-duo')) return true
    for (const id of pair) await setSelected(page, id, false)
  }
  return false
}

/** 動作逾時回傳 false，由主迴圈重新讀取畫面 */
async function attempt(action: () => Promise<boolean>): Promise<boolean> {
  try {
    return await action()
  } catch (e) {
    if (e instanceof errors.TimeoutError) return false
    throw e
  }
}

/** 輪到這個頁面時做一個動作；沒有可做的動作回傳 false */
async function act(page: Page): Promise<boolean> {
  if ((await page.getByTestId('drawn-choice').count()) > 0) {
    await page.getByTestId('drawn-card').first().click()
    return (await clickIfEnabled(page, 'discard-to-0')) || (await clickIfEnabled(page, 'discard-to-1'))
  }
  if ((await page.getByTestId('crab-pick').count()) > 0) {
    await page.getByTestId('crab-card').first().click()
    return true
  }
  if (await takePairingDiscard(page)) return true
  if (await clickIfEnabled(page, 'action-draw')) return true
  if ((await clickIfEnabled(page, 'action-take-0')) || (await clickIfEnabled(page, 'action-take-1'))) return true
  if (await clickIfEnabled(page, 'declare-stop')) return true
  if (await playPair(page)) return true
  return clickIfEnabled(page, 'end-turn')
}

test('[S4-1] 線上版本就是 main 的最新 commit', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('meta[name="commit"]')).toHaveAttribute('content', expectedSha())
})

test('[S4-2] 兩個獨立瀏覽器 context 在線上網址完成一整局', async ({ browser }) => {
  const host = await openHome(browser)
  await disableAnimations(host)
  const code = await createRoom(host, '線上房主')
  const guest = await openHome(browser)
  await disableAnimations(guest)
  await joinRoom(guest, '線上客人', code)
  await expect(guest.getByTestId('lobby-code')).toHaveText(code)
  await host.getByTestId('start-game').click()
  for (const page of [host, guest]) await expect(page.getByTestId('game-status')).toHaveText('遊戲進行中')

  const deadline = Date.now() + 24 * 60_000
  while ((await host.getByTestId('game-over').count()) === 0) {
    expect(Date.now(), '對局在時限內沒有結束').toBeLessThan(deadline)
    let acted = await attempt(() => clickIfEnabled(host, 'next-round'))
    for (const page of [host, guest]) {
      if (acted) break
      if (/^輪到你/.test((await page.getByTestId('turn-text').textContent()) ?? '')) acted = await attempt(() => act(page))
    }
    await host.waitForTimeout(acted ? 150 : 400)
  }

  for (const page of [host, guest]) {
    await expect(page.getByTestId('game-status')).toHaveText('遊戲已結束')
    await expect(page.getByTestId('winner')).toHaveText(/獲勝/)
  }
})

test('[S4-3] 一個瀏覽器在線上網址開單人遊戲配 1 個 AI，打完一整場', async ({ browser }) => {
  const page = await openHome(browser)
  await disableAnimations(page)
  await page.getByTestId('nickname').fill('線上單人')
  await page.getByTestId('solo-1').click()
  await expect(page.getByTestId('game-status')).toHaveText('遊戲進行中')

  const deadline = Date.now() + 24 * 60_000
  while ((await page.getByTestId('game-over').count()) === 0) {
    expect(Date.now(), '對局在時限內沒有結束').toBeLessThan(deadline)
    let acted = await attempt(() => clickIfEnabled(page, 'next-round'))
    if (!acted && /^輪到你/.test((await page.getByTestId('turn-text').textContent()) ?? '')) acted = await attempt(() => act(page))
    await page.waitForTimeout(acted ? 150 : 400)
  }

  await expect(page.getByTestId('game-status')).toHaveText('遊戲已結束')
  await expect(page.getByTestId('winner')).toHaveText(/獲勝/)
})
