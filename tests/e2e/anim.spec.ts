/// <reference lib="dom" />
import type { Browser, Page } from '@playwright/test'
import { placeGame, readRoom } from './admin'
import { expect, test, createRoom, joinRoom, openHome } from './helpers'

interface Seen {
  kind: string
  from?: string
  to?: string
  face?: string
  flip?: string
  /** 翻牌元素第一幀與最後一幀朝上的面，例如 back>up */
  turn?: string
  card?: string | null
  zone?: string
  /** 攤開的張數 */
  count?: string
  text?: string
  /** 動畫出現當下畫面上右棄牌堆的張數 */
  pile1Count?: string
}

declare global {
  interface Window {
    __anim: Seen[]
  }
}

/** 記錄每個出現過的動畫元素 */
function recordAnimations(): void {
  window.__anim = []
  // rotateY(180deg) 的計算值是 matrix3d(-1, ...)，此時朝上的是牌背
  const faceOf = (transform: string) => (transform.startsWith('matrix3d(-1') ? 'back' : 'up')
  const turnOf = (el: HTMLElement) => {
    const inner = el.querySelector<HTMLElement>('[data-testid="anim-flip"]')
    const effect = inner?.getAnimations()[0]?.effect
    if (!inner || !(effect instanceof KeyframeEffect)) return undefined
    const end = effect.getKeyframes().at(-1)?.transform === 'rotateY(0deg)' ? 'up' : 'back'
    return `${faceOf(getComputedStyle(inner).transform)}>${end}`
  }
  const kinds = ['anim-flight', 'anim-banner', 'anim-spread']
  new MutationObserver((mutations) => {
    for (const m of mutations)
      for (const node of Array.from(m.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue
        const found = [node, ...Array.from(node.querySelectorAll<HTMLElement>('[data-testid]'))].filter((el) => kinds.includes(el.dataset.testid ?? ''))
        for (const el of found)
          window.__anim.push({
            kind: el.dataset.testid ?? '',
            from: el.dataset.from,
            to: el.dataset.to,
            face: el.dataset.face,
            flip: el.dataset.flip,
            turn: turnOf(el),
            card: el.dataset.cardId ?? null,
            zone: el.dataset.zone,
            count: el.dataset.count,
            text: el.textContent ?? '',
            pile1Count: document.querySelector('[data-testid="discard-count-1"]')?.textContent ?? '',
          })
      }
  }).observe(document, { childList: true, subtree: true })
}

async function openRecorded(browser: Browser): Promise<Page> {
  const page = await openHome(browser)
  await page.addInitScript(recordAnimations)
  await page.reload()
  return page
}

function seen(page: Page): Promise<Seen[]> {
  return page.evaluate(() => window.__anim)
}

async function startGame(browser: Browser) {
  const host = await openRecorded(browser)
  const code = await createRoom(host, '房主')
  const guest = await openRecorded(browser)
  await joinRoom(guest, '客人', code)
  await expect(guest.getByTestId('lobby-code')).toHaveText(code)
  await host.getByTestId('start-game').click()
  for (const page of [host, guest]) await expect(page.getByTestId('game-status')).toHaveText('遊戲進行中')
  const room = await readRoom(code)
  const [hostUid, guestUid] = room.players.map((p) => p.uid) as [string, string]
  return { code, host, guest, hostUid, guestUid }
}

const DECK = ['fish-1', 'fish-2', 'fish-3', 'shell-6']

/** 佈置牌面（牌庫固定為 DECK），等雙方畫面更新後清空紀錄 */
async function place(code: string, pages: Page[], opts: Omit<Parameters<typeof placeGame>[1], 'deck'>) {
  await placeGame(code, { ...opts, deck: DECK })
  for (const page of pages) {
    await expect(page.getByTestId('deck-count')).toHaveText(String(DECK.length))
    await page.evaluate(() => (window.__anim = []))
  }
}

function hand(page: Page, id: string) {
  return page.locator(`[data-testid="hand-card"][data-card-id="${id}"]`)
}

test('[S8-1][S8-3][S8-6] 對手拿右棄牌堆：雙方都看到頂牌飛到拿牌者，播放時畫面還是動作前', async ({ browser }) => {
  const { code, host, guest, guestUid } = await startGame(browser)
  await place(code, [host, guest], { phase: 'draw', current: 1, discards: [['shell-1'], ['crab-1']] })

  await guest.getByTestId('action-take-1').click()
  await expect(host.getByTestId('discard-count-1')).toHaveText('0')
  expect(await seen(host)).toEqual([
    expect.objectContaining({ kind: 'anim-flight', from: 'pile-1', to: `seat-${guestUid}`, face: 'up', card: 'crab-1', pile1Count: '1' }),
  ])
  await expect(guest.getByTestId('hand-count')).toHaveText('1')
  expect(await seen(guest)).toEqual([expect.objectContaining({ from: 'pile-1', to: 'hand', card: 'crab-1' })])
})

test('[S8-2] 對手抽牌庫：2 張牌背飛到他的座位，留牌後另一張翻成正面飛到所選棄牌堆；抽牌者自己看到牌背翻成正面', async ({ browser }) => {
  const { code, host, guest, guestUid } = await startGame(browser)
  await place(code, [host, guest], { phase: 'draw', current: 1, discards: [['shell-1'], ['crab-1']] })

  await guest.getByTestId('action-draw').click()
  await expect(host.getByTestId('deck-count')).toHaveText('2')
  await expect.poll(() => seen(host)).toEqual([
    expect.objectContaining({ from: 'deck', to: `seat-${guestUid}`, face: 'back', card: null }),
    expect.objectContaining({ from: 'deck', to: `seat-${guestUid}`, face: 'back', card: null }),
  ])
  await expect.poll(() => seen(guest)).toEqual([
    expect.objectContaining({ from: 'deck', to: 'hand', face: 'up', flip: 'true', turn: 'back>up', card: 'fish-1' }),
    expect.objectContaining({ from: 'deck', to: 'hand', face: 'up', flip: 'true', turn: 'back>up', card: 'fish-2' }),
  ])

  await guest.locator('[data-testid="drawn-card"][data-card-id="fish-1"]').click()
  await guest.getByTestId('discard-to-1').click()
  await expect(host.getByTestId('discard-top-1')).toHaveAttribute('data-card-id', 'fish-2')
  expect((await seen(host)).slice(2)).toEqual([expect.objectContaining({ from: `seat-${guestUid}`, to: 'pile-1', face: 'up', flip: 'true', turn: 'back>up', card: 'fish-2' })])
  await expect(guest.getByTestId('discard-top-1')).toHaveAttribute('data-card-id', 'fish-2')
  expect((await seen(guest)).slice(2)).toEqual([expect.objectContaining({ from: 'drawn', to: 'pile-1', face: 'up', flip: 'false', card: 'fish-2' })])
})

test('[S8-4] 對手打鯊魚+游泳者：2 張翻成正面落到他的場上，再 1 張牌背從被偷者飛到偷牌者', async ({ browser }) => {
  const { code, host, guest, guestUid } = await startGame(browser)
  await place(code, [host, guest], { phase: 'actions', current: 1, hands: [['fish-1'], ['shark-1', 'swimmer-1']], discards: [['shell-1'], ['crab-1']] })

  await hand(guest, 'shark-1').click()
  await hand(guest, 'swimmer-1').click()
  await guest.getByTestId('duo-steal').click()
  await expect(host.getByTestId('hand-count')).toHaveText('0')
  expect(await seen(host)).toEqual([
    expect.objectContaining({ from: `seat-${guestUid}`, to: `field-${guestUid}`, face: 'up', flip: 'true', turn: 'back>up', card: 'shark-1' }),
    expect.objectContaining({ from: `seat-${guestUid}`, to: `field-${guestUid}`, face: 'up', flip: 'true', turn: 'back>up', card: 'swimmer-1' }),
    expect.objectContaining({ from: 'hand', to: `seat-${guestUid}`, face: 'back', card: null }),
  ])
})

test('[S8-4] 對手打螃蟹：該棄牌堆的牌正面攤開，挑到的牌以牌背飛出，看不出是哪張', async ({ browser }) => {
  const { code, host, guest, guestUid } = await startGame(browser)
  await place(code, [host, guest], {
    phase: 'actions',
    current: 1,
    hands: [[], ['crab-1', 'crab-2']],
    discards: [['shell-1', 'mermaid-1'], ['fish-4']],
  })

  await hand(guest, 'crab-1').click()
  await hand(guest, 'crab-2').click()
  await guest.getByTestId('duo-crab-0').click()
  await expect(host.locator('[data-testid="anim-spread"] [data-testid="anim-spread-card"]')).toHaveCount(2)
  await guest.locator('[data-testid="crab-card"][data-card-id="mermaid-1"]').click()
  await expect(host.getByTestId('discard-count-0')).toHaveText('1')
  const host1 = await seen(host)
  expect(host1.slice(2)).toEqual([
    expect.objectContaining({ kind: 'anim-spread', zone: 'pile-0', count: '2' }),
    expect.objectContaining({ kind: 'anim-flight', from: 'pile-0', to: `seat-${guestUid}`, face: 'back', card: null }),
  ])
  expect(host1.filter((s) => s.kind === 'anim-flight').some((s) => s.card === 'mermaid-1')).toBe(false)
})

test('[S8-5] 對手宣告 STOP：所有人畫面跳出宣告者與種類', async ({ browser }) => {
  const { code, host, guest } = await startGame(browser)
  const shells = ['shell-1', 'shell-2', 'shell-3', 'shell-4', 'shell-5']
  await place(code, [host, guest], { phase: 'actions', current: 1, hands: [['fish-1'], shells], discards: [['crab-1'], ['crab-2']] })

  await guest.getByTestId('declare-stop').click()
  for (const page of [host, guest]) {
    await expect(page.getByTestId('round-result')).toBeVisible()
    expect(await seen(page)).toEqual([expect.objectContaining({ kind: 'anim-banner', text: '客人 宣告 STOP' })])
  }
})

test('[S8-7] 重新整理後不重播已發生的動作', async ({ browser }) => {
  const { code, host, guest } = await startGame(browser)
  await place(code, [host, guest], { phase: 'draw', current: 1, discards: [['shell-1'], ['crab-1']] })
  await guest.getByTestId('action-take-1').click()
  await expect(host.getByTestId('discard-count-1')).toHaveText('0')

  await host.reload()
  await expect(host.getByTestId('discard-count-1')).toHaveText('0')
  await host.waitForTimeout(1500)
  expect(await seen(host)).toEqual([])
})

test('[S8-8] 關閉動畫後直接顯示新狀態，重新整理後仍是關閉', async ({ browser }) => {
  const { code, host, guest } = await startGame(browser)
  await host.getByTestId('anim-toggle').click()
  await expect(host.getByTestId('anim-toggle').getByRole('checkbox')).not.toBeChecked()
  await place(code, [host, guest], { phase: 'draw', current: 1, discards: [['shell-1'], ['crab-1']] })

  await guest.getByTestId('action-take-1').click()
  await expect(host.getByTestId('discard-count-1')).toHaveText('0')
  expect(await seen(host)).toEqual([])
  expect((await seen(guest)).length).toBe(1)

  await host.reload()
  await expect(host.getByTestId('anim-toggle').getByRole('checkbox')).not.toBeChecked()
})

test('[S8-1] AI 的動作也會播動畫', async ({ browser }) => {
  const page = await openRecorded(browser)
  await page.getByTestId('nickname').fill('單人')
  await page.getByTestId('solo-1').click()
  await expect(page.getByTestId('game-status')).toHaveText('遊戲進行中')
  const code = new URL(page.url()).hash.split('/')[2] ?? ''
  await placeGame(code, { phase: 'draw', current: 1, hands: [[], ['boat-1', 'boat-2']], discards: [['shell-1'], ['crab-1']] })

  await expect.poll(async () => (await seen(page)).some((s) => s.to === 'seat-ai-1'), { timeout: 20_000 }).toBe(true)
})
