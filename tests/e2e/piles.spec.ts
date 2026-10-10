import type { Browser, Page } from '@playwright/test'
import { placeGame } from './admin'
import { expect, test, createRoom, joinRoom, openHome } from './helpers'

const DECK = ['fish-1', 'shell-6', 'boat-3']
const PILE_IDS = ['pile-deck', 'pile-0', 'pile-1']

async function startGame(browser: Browser) {
  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  const guest = await openHome(browser)
  await joinRoom(guest, '客人', code)
  await expect(guest.getByTestId('lobby-code')).toHaveText(code)
  await host.getByTestId('start-game').click()
  for (const page of [host, guest]) await expect(page.getByTestId('game-status')).toHaveText('遊戲進行中')
  return { code, host, guest }
}

/** 佈置牌面（房主先手、牌庫固定為 DECK），等雙方畫面更新 */
async function place(code: string, pages: Page[], opts: Omit<Parameters<typeof placeGame>[1], 'deck' | 'current'>) {
  await placeGame(code, { ...opts, deck: DECK, current: 0 })
  for (const page of pages) await expect(page.getByTestId('deck-count')).toHaveText(String(DECK.length))
}

function hand(page: Page, id: string) {
  return page.locator(`[data-testid="hand-card"][data-card-id="${id}"]`)
}

test('[S9-1][S9-5] 取牌階段點牌庫即抽牌庫；不是自己的回合三個牌堆都不可點', async ({ browser }) => {
  const { code, host, guest } = await startGame(browser)
  await place(code, [host, guest], { phase: 'draw', discards: [['shell-1'], ['crab-1']] })

  for (const id of PILE_IDS) await expect(guest.getByTestId(id)).toBeDisabled()
  await expect(guest.getByTestId('pile-deck')).toHaveAttribute('aria-label', '牌庫')
  await expect(guest.getByTestId('pile-0')).toHaveAttribute('aria-label', '左棄牌堆')
  await expect(guest.getByTestId('pile-1')).toHaveAttribute('aria-label', '右棄牌堆')
  await expect(guest.getByTestId('pile-1')).not.toHaveAttribute('title')
  const deck = host.getByTestId('pile-deck')
  await expect(deck).toBeEnabled()
  await expect(deck).toHaveAttribute('aria-label', '抽牌庫')
  await expect(deck).toHaveAttribute('title', '抽牌庫')

  await deck.click()
  await expect(host.getByTestId('drawn-choice')).toBeVisible()
  await expect(host.getByTestId('deck-count')).toHaveText('1')
  await expect(deck).toBeDisabled()
})

test('[S9-2] 取牌階段點有牌的棄牌堆即拿那堆的頂牌', async ({ browser }) => {
  const { code, host, guest } = await startGame(browser)
  await place(code, [host, guest], { phase: 'draw', discards: [['shell-1'], ['crab-1']] })

  await expect(host.getByTestId('pile-1')).toHaveAttribute('aria-label', '拿右堆頂牌')
  await host.getByTestId('pile-1').click()
  await expect(hand(host, 'crab-1')).toBeVisible()
  await expect(host.getByTestId('discard-count-1')).toHaveText('0')
})

test('[S9-3] 抽到兩張後，選定留下的牌再點棄牌堆，另一張放到那堆；還沒選牌時棄牌堆不可點', async ({ browser }) => {
  const { code, host, guest } = await startGame(browser)
  await place(code, [host, guest], { phase: 'draw', discards: [['shell-1'], ['crab-1']] })

  await host.getByTestId('pile-deck').click()
  await expect(host.getByTestId('drawn-choice')).toBeVisible()
  for (const id of PILE_IDS) await expect(host.getByTestId(id)).toBeDisabled()

  await host.locator('[data-testid="drawn-card"][data-card-id="fish-1"]').click()
  const left = host.getByTestId('pile-0')
  await expect(left).toBeEnabled()
  await expect(left).toHaveAttribute('aria-label', '另一張放到左堆')
  await left.click()
  await expect(hand(host, 'fish-1')).toBeVisible()
  await expect(host.getByTestId('discard-count-0')).toHaveText('2')
  await expect(host.getByTestId('discard-top-0')).toHaveAttribute('data-card-id', 'shell-6')
})

test('[S9-4][S9-5] 選定兩張螃蟹後點有牌的棄牌堆，打出螃蟹並從那堆挑；沒選螃蟹時棄牌堆不可點', async ({ browser }) => {
  const { code, host, guest } = await startGame(browser)
  await place(code, [host, guest], { phase: 'actions', hands: [['crab-1', 'crab-2', 'boat-1']], discards: [['shell-1', 'fish-2'], []] })

  for (const id of PILE_IDS) await expect(host.getByTestId(id)).toBeDisabled()
  await hand(host, 'crab-1').click()
  await hand(host, 'crab-2').click()
  const left = host.getByTestId('pile-0')
  await expect(left).toBeEnabled()
  await expect(left).toHaveAttribute('aria-label', '打出螃蟹，從左堆挑')
  await expect(host.getByTestId('pile-1')).toBeDisabled()

  await left.click()
  await expect(host.getByTestId('crab-pick')).toBeVisible()
  await expect(host.getByTestId('crab-card')).toHaveCount(2)
})
