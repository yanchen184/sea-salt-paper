import type { Locator, Page } from '@playwright/test'
import { buildDeck } from '../../src/engine'
import { placeGame, readRoom } from './admin'
import { expect, test, createRoom, joinRoom, openHome } from './helpers'

const DESKTOP = { width: 1280, height: 720 }
const SHORT_DESKTOP = { width: 1280, height: 600 }
const PHONE = { width: 390, height: 844 }

function seat(page: Page, name: string) {
  return page.getByTestId('player').filter({ has: page.getByTestId('player-name').getByText(name, { exact: true }) })
}

async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(() => (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight)
}

async function expectInViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()
  expect(box, '元素要有位置').not.toBeNull()
  if (!box || !viewport) return
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5)
}

async function expectFits(page: Page, mustSee: Locator[]) {
  await expect.poll(() => pageOverflow(page)).toBeLessThanOrEqual(0)
  for (const locator of mustSee) await expectInViewport(page, locator)
}

/** 對手區、牌桌、自己的區域由上而下排列，彼此不重疊 */
async function expectStacked(page: Page) {
  const [top, middle, bottom] = await Promise.all([
    page.getByTestId('opponents').boundingBox(),
    page.getByRole('region', { name: '桌面' }).boundingBox(),
    page.getByRole('region', { name: '你的區域' }).boundingBox(),
  ])
  expect(top && middle && bottom, '三個區域都要有位置').toBeTruthy()
  if (!top || !middle || !bottom) return
  expect(top.y + top.height, '牌桌不可蓋到對手區').toBeLessThanOrEqual(middle.y + 0.5)
  expect(middle.y + middle.height, '牌桌不可蓋到自己的區域').toBeLessThanOrEqual(bottom.y + 0.5)
}

/** 房主 + 3 個 AI，房主先手 */
async function startFourWithAi(page: Page) {
  const code = await createRoom(page, '房主')
  for (let count = 2; count <= 4; count++) {
    await page.getByTestId('add-ai').click()
    await expect(page.getByTestId('player')).toHaveCount(count)
  }
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('game-status')).toHaveText('遊戲進行中')
  return code
}

/** 自己 12 張手牌 6 張場上牌，對手各 8 張手牌 4 張場上牌，用完 58 張 */
function crowdedTable() {
  const ids = buildDeck().map((c) => c.id)
  const take = (n: number) => ids.splice(0, n)
  const hands = [take(12)]
  const fields = [take(6)]
  for (let i = 0; i < 3; i++) {
    hands.push(take(8))
    fields.push(take(4))
  }
  const discards: [string[], string[]] = [take(1), take(1)]
  return { hands, fields, discards, deck: take(2) }
}

for (const [label, viewport] of [['桌機', DESKTOP], ['矮桌機', SHORT_DESKTOP], ['手機', PHONE]] as const) {
  test(`[S10-1] ${label} ${viewport.width}×${viewport.height}：4 人局滿手牌時取牌、行動、抽到兩張三個階段頁面都不捲動`, async ({ browser }) => {
    const page = await openHome(browser)
    await page.setViewportSize(viewport)
    const code = await startFourWithAi(page)
    const table = crowdedTable()
    const lastHandCard = page.getByTestId('hand-card').last()
    const opponents = page.getByTestId('opponents').getByTestId('player')

    await placeGame(code, { ...table, phase: 'actions', current: 0 })
    await expect(page.getByTestId('hand-card')).toHaveCount(12)
    await expectFits(page, [lastHandCard, page.getByTestId('end-turn'), page.getByTestId('pile-1'), opponents.first(), opponents.last()])
    await expectStacked(page)
    const fieldCards = page.getByTestId('player-field').locator(':scope > *')
    await expect(fieldCards).toHaveCount(6 + 3 * 4)
    for (const card of await fieldCards.all()) await expectInViewport(page, card)

    await placeGame(code, { ...table, phase: 'draw', current: 0 })
    await expect(page.getByTestId('pile-deck')).toBeEnabled()
    await expectFits(page, [lastHandCard, page.getByTestId('action-draw'), page.getByTestId('pile-deck')])
    await expectStacked(page)

    await page.getByTestId('pile-deck').click()
    await expect(page.getByTestId('drawn-choice')).toBeVisible()
    await expectFits(page, [lastHandCard, page.getByTestId('drawn-card').last(), page.getByTestId('discard-to-1')])
    await expectStacked(page)
  })
}

test('[S10-2] 自己在最下方、牌桌在中間、對手在上方並依自己之後的順序由左到右', async ({ browser }) => {
  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  await host.getByTestId('add-ai').click()
  const guest = await openHome(browser)
  await joinRoom(guest, '客人', code)
  await expect(host.getByTestId('player')).toHaveCount(3)
  await host.getByTestId('start-game').click()
  for (const page of [host, guest]) await expect(page.getByTestId('game-status')).toHaveText('遊戲進行中')
  await placeGame(code, { phase: 'draw', current: 0 })

  const aiName = (await readRoom(code)).players[1]?.name ?? ''
  for (const [page, me, order] of [
    [host, '房主', [aiName, '客人']],
    [guest, '客人', ['房主', aiName]],
  ] as const) {
    const opponents = page.getByTestId('opponents').getByTestId('player-name')
    await expect(opponents).toHaveText([...order])
    const [first, second] = await Promise.all([opponents.nth(0).boundingBox(), opponents.nth(1).boundingBox()])
    expect(first && second && first.x < second.x).toBe(true)

    const mine = page.getByRole('region', { name: '你的區域' })
    await expect(mine.getByTestId('player-name')).toHaveText(me)
    await expect(mine.getByTestId('my-hand')).toBeVisible()
    await expect(mine.getByTestId('player-field')).toBeVisible()
    await expect(mine.getByTestId('action-draw')).toBeVisible()

    const top = await page.getByTestId('opponents').boundingBox()
    const middle = await page.getByRole('region', { name: '桌面' }).boundingBox()
    const bottom = await mine.boundingBox()
    expect(top && middle && bottom).toBeTruthy()
    if (!top || !middle || !bottom) return
    expect(top.y + top.height).toBeLessThanOrEqual(middle.y + 0.5)
    expect(middle.y + middle.height).toBeLessThanOrEqual(bottom.y + 0.5)
  }
})

test('[S10-3] 對手手牌以牌背疊放，張數等於手牌張數', async ({ browser }) => {
  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  const guest = await openHome(browser)
  await joinRoom(guest, '客人', code)
  await expect(guest.getByTestId('lobby-code')).toHaveText(code)
  await host.getByTestId('start-game').click()
  await expect(host.getByTestId('game-status')).toHaveText('遊戲進行中')

  await placeGame(code, { phase: 'draw', current: 0, hands: [['fish-1', 'fish-2', 'shell-1'], ['crab-1', 'crab-2', 'crab-3', 'boat-1', 'boat-2', 'boat-3', 'shark-1']] })
  const other = seat(host, '客人')
  await expect(other.getByTestId('player-hand-count')).toHaveText('7')
  await expect(other.getByTestId('hand-backs').getByTestId('card-back')).toHaveCount(7)
  const mine = seat(guest, '房主')
  await expect(mine.getByTestId('hand-backs').getByTestId('card-back')).toHaveCount(3)
})

test('[S10-4] 對手抽兩張後到選定前，他的座位持續顯示兩張蓋牌與「挑選中」，選定後消失', async ({ browser }) => {
  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  const guest = await openHome(browser)
  await joinRoom(guest, '客人', code)
  await expect(guest.getByTestId('lobby-code')).toHaveText(code)
  await host.getByTestId('start-game').click()
  await expect(guest.getByTestId('game-status')).toHaveText('遊戲進行中')
  await placeGame(code, { phase: 'draw', current: 0, deck: ['fish-1', 'shell-6', 'boat-3'], discards: [['shell-1'], ['crab-1']] })
  await expect(guest.getByTestId('deck-count')).toHaveText('3')

  const picking = seat(guest, '房主').getByTestId('picking')
  await expect(picking).toHaveCount(0)
  await host.getByTestId('pile-deck').click()
  await expect(picking).toBeVisible()
  await expect(picking).toContainText('挑選中')
  await expect(picking.getByTestId('picking-card')).toHaveCount(2)
  await guest.waitForTimeout(3000)
  await expect(picking).toBeVisible()
  await expect(host.getByTestId('picking')).toHaveCount(0)

  await host.locator('[data-testid="drawn-card"][data-card-id="fish-1"]').click()
  await host.getByTestId('discard-to-0').click()
  await expect(picking).toHaveCount(0)
  await expect(seat(guest, '房主').getByTestId('player-hand-count')).toHaveText('1')
})

test('[S10-5] 本局計分以浮層顯示，內容在浮層內捲動，頁面不捲動', async ({ browser }) => {
  const page = await openHome(browser)
  await page.setViewportSize(PHONE)
  const code = await startFourWithAi(page)
  const table = crowdedTable()
  const shells = ['shell-1', 'shell-2', 'shell-3', 'shell-4', 'shell-5']
  const without = (ids: string[]) => ids.filter((id) => !shells.includes(id))
  const hands = table.hands.map((h, i) => (i === 0 ? shells : without(h)))
  await placeGame(code, { ...table, hands, fields: table.fields.map(without), phase: 'actions', current: 0 })

  await page.getByTestId('declare-stop').click()
  const overlay = page.getByTestId('result-overlay')
  await expect(overlay.getByTestId('round-result')).toBeVisible()
  await expect(page.getByRole('dialog', { name: '第 1 局計分' })).toBeFocused()
  expect(await page.getByTestId('opponents').evaluate((el) => el.closest('[inert]') !== null), '浮層開啟時背景不可操作').toBe(true)
  await expect(overlay.getByTestId('reveal')).toHaveCount(4)
  expect(await overlay.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto')
  await expectFits(page, [overlay])

  const next = overlay.getByTestId('next-round')
  await next.scrollIntoViewIfNeeded()
  await expectInViewport(page, next)
  expect(await pageOverflow(page)).toBeLessThanOrEqual(0)
  await next.click()
  await expect(overlay).toHaveCount(0)
  expect(await page.getByTestId('opponents').evaluate((el) => el.closest('[inert]') !== null)).toBe(false)
})

test('[S10-5] 遊戲結束以浮層顯示，頁面不捲動', async ({ browser }) => {
  const host = await openHome(browser)
  await host.setViewportSize(PHONE)
  const code = await createRoom(host, '房主')
  await host.getByTestId('add-ai').click()
  await host.getByTestId('start-game').click()
  await expect(host.getByTestId('game-status')).toHaveText('遊戲進行中')
  await placeGame(code, { phase: 'actions', current: 0, scores: [39, 10], hands: [['shell-1', 'shell-2', 'shell-3', 'shell-4', 'shell-5'], ['crab-1']] })

  await host.getByTestId('declare-stop').click()
  const overlay = host.getByTestId('result-overlay')
  await expect(overlay.getByTestId('winner')).toHaveText('房主 獲勝')
  await expect(host.getByRole('dialog', { name: '遊戲結束' })).toBeFocused()
  await expectFits(host, [overlay])
  await overlay.getByTestId('play-again').scrollIntoViewIfNeeded()
  await expectInViewport(host, overlay.getByTestId('play-again'))
})
