import { expect, test, type Browser, type Page } from '@playwright/test'
import { markOffline, placeGame, readRoom } from './admin'
import { createRoom, joinRoom, openHome, playerNames } from './helpers'

interface Table {
  code: string
  host: Page
  guests: Page[]
}

async function startGame(browser: Browser, guestNames: string[]): Promise<Table> {
  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  const guests: Page[] = []
  for (const name of guestNames) {
    const page = await openHome(browser)
    await joinRoom(page, name, code)
    await expect(page.getByTestId('lobby-code')).toHaveText(code)
    guests.push(page)
  }
  await host.getByTestId('start-game').click()
  for (const page of [host, ...guests]) await expect(page.getByTestId('game-status')).toHaveText('遊戲進行中')
  return { code, host, guests }
}

function seat(page: Page, name: string) {
  return page.getByTestId('player').filter({ has: page.getByTestId('player-name').getByText(name, { exact: true }) })
}

function handIds(page: Page) {
  return page.getByTestId('hand-card')
}

test('[S3-1] 看得到自己的手牌、場上牌、兩棄牌堆頂、牌庫數、各玩家手牌張數與場上牌', async ({ browser }) => {
  const { code, host, guests } = await startGame(browser, ['客人'])
  const [guest] = guests as [Page]
  await placeGame(code, { phase: 'draw', current: 0, discards: [['shell-1'], ['crab-1']], fields: [[], ['boat-1', 'boat-2']] })

  await expect(host.getByTestId('deck-count')).toHaveText('54')
  await expect(host.getByTestId('discard-top-0')).toHaveAttribute('data-card-id', 'shell-1')
  await expect(host.getByTestId('discard-top-1')).toHaveAttribute('data-card-id', 'crab-1')
  await expect(seat(host, '客人').getByTestId('player-field').locator('[data-card-id]')).toHaveCount(2)
  await expect(seat(host, '客人').getByTestId('player-hand-count')).toHaveText('0')

  await host.getByTestId('action-take-0').click()
  await expect(host.getByTestId('hand-count')).toHaveText('1')
  await expect(handIds(host)).toHaveAttribute('data-card-id', 'shell-1')
  await expect(seat(guest, '房主').getByTestId('player-hand-count')).toHaveText('1')
  await expect(guest.getByTestId('discard-count-0')).toHaveText('0')
  await expect(guest.getByTestId('deck-count')).toHaveText('54')
})

test('[S3-2] 他人手牌只顯示張數，看不到牌面', async ({ browser }) => {
  const { code, host, guests } = await startGame(browser, ['客人'])
  const [guest] = guests as [Page]
  await placeGame(code, { phase: 'actions', current: 0, hands: [['mermaid-1', 'octopus-1'], ['fish-1']] })

  await expect(seat(guest, '房主').getByTestId('player-hand-count')).toHaveText('2')
  await expect(guest.getByTestId('hand-ids')).toHaveText('fish-1')
  await expect(guest.locator('[data-card-id="mermaid-1"], [data-card-id="octopus-1"]')).toHaveCount(0)
  await expect(host.locator('[data-card-id="fish-1"]')).toHaveCount(0)
})

test('[S3-3] 只有現在能做的動作可點，其餘停用並說明原因', async ({ browser }) => {
  const { code, host, guests } = await startGame(browser, ['客人'])
  const [guest] = guests as [Page]
  await placeGame(code, { phase: 'draw', current: 0, hands: [['crab-2']], discards: [['crab-1'], []] })

  await expect(guest.getByTestId('action-draw')).toBeDisabled()
  await expect(guest.getByTestId('action-draw')).toHaveAttribute('title', '還沒輪到你，現在是 房主 的回合')
  await expect(guest.getByTestId('wait-hint')).toHaveText('還沒輪到你，現在是 房主 的回合')

  await expect(host.getByTestId('action-draw')).toBeEnabled()
  await expect(host.getByTestId('action-take-1')).toBeDisabled()
  await expect(host.getByTestId('action-take-1-reason')).toHaveText('這個棄牌堆是空的')
  await expect(host.getByTestId('end-turn-reason')).toHaveText('要先抽牌庫或拿一張棄牌堆頂牌')

  await host.getByTestId('action-take-0').click()
  await expect(host.getByTestId('action-draw-reason')).toHaveText('這回合已經取過牌了')
  await expect(host.getByTestId('declare-stop-reason')).toHaveText(/卡牌分需達 7 分才能宣告/)

  await host.locator('[data-testid="hand-card"][data-card-id="crab-1"]').click()
  await expect(host.getByTestId('play-duo-reason')).toHaveText('先點選兩張可以配對的手牌')
  await host.locator('[data-testid="hand-card"][data-card-id="crab-2"]').click()
  await host.getByTestId('play-duo').click()
  await expect(seat(guest, '房主').getByTestId('player-field').locator('[data-card-id]')).toHaveCount(2)

  await host.getByTestId('end-turn').click()
  await expect(guest.getByTestId('turn-text')).toHaveText(/^輪到你/)
  await expect(guest.getByTestId('action-draw')).toBeEnabled()
  await expect(host.getByTestId('action-draw')).toBeDisabled()
})

test('[S3-4] 本局計分時所有人攤牌', async ({ browser }) => {
  const { code, host, guests } = await startGame(browser, ['客人'])
  const [guest] = guests as [Page]
  const shells = ['shell-1', 'shell-2', 'shell-3', 'shell-4', 'shell-5']
  await placeGame(code, { phase: 'actions', current: 0, hands: [shells, ['crab-1', 'fish-1']] })

  await host.getByTestId('declare-stop').click()
  for (const page of [host, guest]) {
    await expect(page.getByTestId('round-reason')).toHaveText(/房主 宣告 STOP/)
    await expect(page.getByTestId('reveal')).toHaveCount(2)
  }
  const hostReveal = guest.getByTestId('reveal').filter({ hasText: '房主' })
  await expect(hostReveal.locator('[data-card-id]')).toHaveCount(5)
  await expect(hostReveal.getByTestId('reveal-gained')).toHaveText('8')
  await expect(host.getByTestId('reveal').filter({ hasText: '客人' }).locator('[data-card-id="crab-1"]')).toHaveCount(1)

  await expect(guest.getByTestId('next-round')).toHaveCount(0)
  await expect(guest.getByTestId('waiting-next-round')).toHaveText('等待房主 房主 開始下一局')
  await host.getByTestId('next-round').click()
  for (const page of [host, guest]) {
    await expect(page.getByTestId('round-result')).toHaveCount(0)
    await expect(page.getByText('第 2 局', { exact: false }).first()).toBeVisible()
  }
})

test('[S3-5] 遊戲結束後由房主按「再玩一場」，其他人等待', async ({ browser }) => {
  const { code, host, guests } = await startGame(browser, ['客人'])
  const [guest] = guests as [Page]
  await placeGame(code, {
    phase: 'actions',
    current: 0,
    scores: [39, 10],
    hands: [['shell-1', 'shell-2', 'shell-3', 'shell-4', 'shell-5'], ['crab-1']],
  })

  await host.getByTestId('declare-stop').click()
  for (const page of [host, guest]) {
    await expect(page.getByTestId('game-status')).toHaveText('遊戲已結束')
    await expect(page.getByTestId('winner')).toHaveText('房主 獲勝')
  }
  await expect(guest.getByTestId('play-again')).toHaveCount(0)
  await expect(guest.getByTestId('waiting-replay')).toHaveText('等待房主 房主 開始下一場')

  await host.getByTestId('play-again').click()
  for (const page of [host, guest]) {
    await expect(page.getByTestId('game-status')).toHaveText('遊戲進行中')
    await expect(page.getByTestId('player-score')).toHaveText(['0', '0'])
  }
})

test('[A5-3] 房主踢出離線玩家後，其他人變成少 1 人的對局，被踢者看到已被踢出', async ({ browser }) => {
  const { code, host, guests } = await startGame(browser, ['二號', '三號'])
  const [second, third] = guests as [Page, Page]
  const thirdUid = (await readRoom(code)).players.find((p) => p.name === '三號')?.uid ?? ''

  await third.context().setOffline(true)
  await markOffline(code, thirdUid)
  const thirdSeat = seat(host, '三號')
  await expect(thirdSeat.getByTestId('offline-badge')).toBeVisible()
  await expect(seat(second, '三號').getByTestId('kick-player')).toHaveCount(0)

  await thirdSeat.getByTestId('kick-player').click()
  await thirdSeat.getByTestId('kick-player').click()
  for (const page of [host, second]) await expect(playerNames(page)).toHaveText(['房主', '二號'])
  await expect(second.getByTestId('game-log')).toContainText('三號 被房主移出遊戲')

  await third.context().setOffline(false)
  await expect(third.getByTestId('kicked-notice')).toBeVisible()
  await third.waitForTimeout(2000)
  await expect(third.getByRole('alert')).toHaveCount(0)
})

test('[A5-3] 2 人局踢出離線玩家後剩房主獲勝，人數不足時「再玩一場」停用並說明', async ({ browser }) => {
  const { code, host, guests } = await startGame(browser, ['客人'])
  const [guest] = guests as [Page]
  const guestUid = (await readRoom(code)).players.find((p) => p.name === '客人')?.uid ?? ''

  await guest.context().setOffline(true)
  await markOffline(code, guestUid)
  const guestSeat = seat(host, '客人')
  await guestSeat.getByTestId('kick-player').click()
  await guestSeat.getByTestId('kick-player').click()

  await expect(host.getByTestId('winner')).toHaveText('房主 獲勝')
  await expect(host.getByTestId('play-again')).toBeDisabled()
  await expect(host.getByTestId('play-again-reason')).toHaveText('剩不到 2 位玩家，請離開房間重新建立')
})
