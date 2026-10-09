import type { Page } from '@playwright/test'
import { markOffline, placeGame, readRoom } from './admin'
import { expect, test, createRoom, joinRoom, openHome, playerNames } from './helpers'

function roomCode(page: Page): string {
  const code = new URL(page.url()).hash.match(/^#\/room\/(\w+)$/)?.[1]
  if (!code) throw new Error(`網址沒有房號：${page.url()}`)
  return code
}

async function playSolo(page: Page, aiCount: number): Promise<string> {
  await page.getByTestId('nickname').fill('單人')
  await page.getByTestId(`solo-${aiCount}`).click()
  await expect(page.getByTestId('game-status')).toHaveText('遊戲進行中')
  return roomCode(page)
}

function seat(page: Page, name: string) {
  return page.getByTestId('player').filter({ has: page.getByTestId('player-name').getByText(name, { exact: true }) })
}

test('[A6-1] 首頁選 AI 人數直接進入對局，不經過大廳', async ({ browser }) => {
  const page = await openHome(browser)
  await playSolo(page, 2)
  await expect(page.getByTestId('lobby-code')).toHaveCount(0)
  await expect(playerNames(page)).toHaveText(['單人', 'AI 小蟹', 'AI 小魚'])
  await expect(page.getByTestId('ai-badge')).toHaveCount(2)
})

test('[A6-3] AI 座位標示 AI，不顯示離線，也沒有踢人按鈕', async ({ browser }) => {
  const page = await openHome(browser)
  await playSolo(page, 1)
  const ai = seat(page, 'AI 小蟹')
  await expect(ai.getByTestId('ai-badge')).toBeVisible()
  await expect(ai.getByTestId('offline-badge')).toHaveCount(0)
  await expect(ai.getByTestId('kick-player')).toHaveCount(0)
})

test('[S6-1] 輪到 AI 時房主的瀏覽器自動替它出手，回到真人的回合', async ({ browser }) => {
  const page = await openHome(browser)
  const code = await playSolo(page, 1)
  await placeGame(code, { phase: 'draw', current: 1, hands: [[], ['boat-1', 'boat-2']], discards: [['shell-1'], ['crab-1']] })
  const before = (await readRoom(code)).version

  await expect.poll(async () => (await readRoom(code)).game?.current, { timeout: 20_000 }).toBe(0)
  const after = await readRoom(code)
  expect(after.version).toBeGreaterThan(before)
  expect(after.game?.log.some((entry) => entry.text.includes('AI 小蟹'))).toBe(true)
  await expect(page.getByTestId('action-draw')).toBeEnabled()
})

test('[S6-3] 房主關掉頁面並離線超過 45 秒後，下一位真人成為房主並接手替 AI 出手', async ({ browser }) => {
  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  await host.getByTestId('add-ai').click()
  const guest = await openHome(browser)
  await joinRoom(guest, '客人', code)
  await expect(playerNames(host)).toHaveText(['房主', 'AI 小蟹', '客人'])
  await host.getByTestId('start-game').click()
  await expect(guest.getByTestId('game-status')).toHaveText('遊戲進行中')
  const [hostUid, , guestUid] = (await readRoom(code)).playerUids

  await host.close()
  await markOffline(code, hostUid ?? '')
  await expect.poll(async () => (await readRoom(code)).hostId, { timeout: 20_000 }).toBe(guestUid)

  await placeGame(code, { phase: 'draw', current: 1, hands: [[], ['boat-1', 'boat-2'], []], discards: [['shell-1'], ['crab-1']] })
  await expect.poll(async () => (await readRoom(code)).game?.current, { timeout: 20_000 }).toBe(2)
})

test('[A6-2] 大廳中房主可加入、移除 AI，和 AI 一起開局', async ({ browser }) => {
  const host = await openHome(browser)
  await createRoom(host, '房主')
  await expect(host.getByTestId('start-game')).toBeDisabled()

  await host.getByTestId('add-ai').click()
  await host.getByTestId('add-ai').click()
  await expect(playerNames(host)).toHaveText(['房主', 'AI 小蟹', 'AI 小魚'])
  await host.getByTestId('remove-ai').first().click()
  await expect(playerNames(host)).toHaveText(['房主', 'AI 小魚'])
  await host.getByTestId('add-ai').click()
  await host.getByTestId('add-ai').click()
  await expect(host.getByTestId('player')).toHaveCount(4)
  await expect(host.getByTestId('add-ai')).toHaveCount(0)

  await host.getByTestId('start-game').click()
  await expect(host.getByTestId('game-status')).toHaveText('遊戲進行中')
  await expect(host.getByTestId('ai-badge')).toHaveCount(3)
})
