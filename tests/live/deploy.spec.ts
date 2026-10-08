import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { expect, test, createRoom, joinRoom, openHome } from '../e2e/helpers'

const PAIR_KINDS = ['crab', 'boat', 'fish']

function expectedSha(): string {
  return process.env.EXPECTED_SHA ?? execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim()
}

async function clickIfEnabled(page: Page, testId: string): Promise<boolean> {
  const button = page.getByTestId(testId).first()
  if ((await button.count()) === 0 || !(await button.isEnabled())) return false
  await button.click({ timeout: 5_000 })
  return true
}

async function playPair(page: Page): Promise<boolean> {
  const cards = await page.getByTestId('hand-card').all()
  const ids = await Promise.all(cards.map(async (c) => (await c.getAttribute('data-card-id')) ?? ''))
  for (const kind of PAIR_KINDS) {
    const pair = ids.filter((id) => id.startsWith(`${kind}-`)).slice(0, 2)
    if (pair.length < 2) continue
    for (const id of pair) await page.locator(`[data-testid="hand-card"][data-card-id="${id}"]`).click()
    if (await clickIfEnabled(page, 'duo-crab-0')) return true
    if (await clickIfEnabled(page, 'duo-crab-1')) return true
    if (await clickIfEnabled(page, 'play-duo')) return true
    for (const id of pair) await page.locator(`[data-testid="hand-card"][data-card-id="${id}"]`).click()
  }
  return false
}

/** 輪到這個頁面時做一個動作；沒有可做的動作回傳 false */
async function step(page: Page): Promise<boolean> {
  if ((await page.getByTestId('drawn-choice').count()) > 0) {
    await page.getByTestId('drawn-card').first().click()
    return (await clickIfEnabled(page, 'discard-to-0')) || (await clickIfEnabled(page, 'discard-to-1'))
  }
  if ((await page.getByTestId('crab-pick').count()) > 0) {
    await page.getByTestId('crab-card').first().click()
    return true
  }
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

test('[S4-2] 兩個不同瀏覽器在線上網址完成一整局', async ({ browser }) => {
  const host = await openHome(browser)
  const code = await createRoom(host, '線上房主')
  const guest = await openHome(browser)
  await joinRoom(guest, '線上客人', code)
  await expect(guest.getByTestId('lobby-code')).toHaveText(code)
  await host.getByTestId('start-game').click()
  for (const page of [host, guest]) await expect(page.getByTestId('game-status')).toHaveText('遊戲進行中')

  const deadline = Date.now() + 14 * 60_000
  while ((await host.getByTestId('game-over').count()) === 0) {
    expect(Date.now(), '對局在時限內沒有結束').toBeLessThan(deadline)
    let acted = await clickIfEnabled(host, 'next-round')
    for (const page of [host, guest]) {
      if (acted) break
      if (/^輪到你/.test((await page.getByTestId('turn-text').textContent()) ?? '')) acted = await step(page)
    }
    await host.waitForTimeout(acted ? 400 : 800)
  }

  for (const page of [host, guest]) {
    await expect(page.getByTestId('game-status')).toHaveText('遊戲已結束')
    await expect(page.getByTestId('winner')).toHaveText(/獲勝/)
  }
})
