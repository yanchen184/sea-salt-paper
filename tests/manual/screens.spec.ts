import { expect, test, type Browser, type Page } from '@playwright/test'
import { markOffline, placeGame, readRoom } from '../e2e/admin'
import { createRoom, joinRoom, openHome } from '../e2e/helpers'

const OUT = 'docs/manual/img'

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
}

async function table(browser: Browser, guestNames: string[]) {
  const host = await openHome(browser)
  const code = await createRoom(host, '小海')
  const guests: Page[] = []
  for (const name of guestNames) {
    const page = await openHome(browser)
    await joinRoom(page, name, code)
    await expect(page.getByTestId('lobby-code')).toHaveText(code)
    guests.push(page)
  }
  return { code, host, guests }
}

async function start(host: Page, guests: Page[]): Promise<void> {
  await host.getByTestId('start-game').click()
  for (const page of [host, ...guests]) await expect(page.getByTestId('game-status')).toHaveText('遊戲進行中')
}

function hand(page: Page, id: string) {
  return page.locator(`[data-testid="hand-card"][data-card-id="${id}"]`)
}

test('01 首頁與大廳', async ({ browser }) => {
  const home = await openHome(browser)
  await shot(home, '01-home')

  await home.getByTestId('nickname').fill('阿鹽')
  await home.getByTestId('room-code').fill('ZZZZ')
  await home.getByTestId('join-room').click()
  await expect(home.getByRole('alert')).toBeVisible()
  await shot(home, '02-join-error')

  const host = await openHome(browser)
  const code = await createRoom(host, '小海')
  await expect(host.getByTestId('start-hint')).toBeVisible()
  await shot(host, '03-lobby-alone')

  await joinRoom(home, '阿鹽', code)
  await expect(home.getByTestId('lobby-code')).toHaveText(code)
  const third = await openHome(browser)
  await joinRoom(third, '紙鶴', code)
  await expect(host.getByTestId('player-name')).toHaveCount(3)
  await shot(host, '04-lobby-host')
  await shot(home, '05-lobby-guest')
})

test('02 輪到你：抽牌或拿棄牌', async ({ browser }) => {
  const { code, host, guests } = await table(browser, ['阿鹽', '紙鶴'])
  await start(host, guests)
  const [guest] = guests as [Page]
  await placeGame(code, {
    phase: 'draw',
    current: 0,
    hands: [['fish-1', 'shell-1', 'octopus-1'], ['crab-3', 'boat-2'], ['penguin-1']],
    fields: [[], ['boat-3', 'boat-4'], []],
    discards: [['crab-1'], ['shark-2']],
    deck: ['mermaid-1', 'fish-2', 'crab-2', 'boat-1', 'shell-2', 'shell-3', 'swimmer-1', 'shark-1'],
  })
  await expect(host.getByTestId('action-draw')).toBeEnabled()
  await shot(host, '06-my-turn')
  await shot(guest, '07-waiting')

  await host.getByTestId('action-draw').click()
  await expect(host.getByTestId('drawn-choice')).toBeVisible()
  await shot(host, '08-drawn-choice')
  await host.locator('[data-testid="drawn-card"][data-card-id="fish-2"]').click()
  await shot(host, '09-drawn-selected')
  await host.getByTestId('discard-to-0').click()
  await expect(host.getByTestId('drawn-choice')).toHaveCount(0)

  await hand(host, 'fish-1').click()
  await hand(host, 'fish-2').click()
  await expect(host.getByTestId('play-duo')).toBeEnabled()
  await shot(host, '10-select-pair')
  await host.getByTestId('play-duo').click()
  await expect(host.getByTestId('hand-count')).toHaveText('3')
  await shot(host, '11-after-duo')
})

test('03 螃蟹與鯊魚偷牌', async ({ browser }) => {
  const { code, host, guests } = await table(browser, ['阿鹽'])
  await start(host, guests)
  const [guest] = guests as [Page]
  await placeGame(code, {
    phase: 'actions',
    current: 0,
    hands: [['crab-1', 'crab-2', 'shark-1', 'swimmer-1'], ['mermaid-1', 'octopus-1', 'penguin-1']],
    discards: [['boat-1', 'fish-1', 'shell-1'], ['penguin-2']],
  })
  await hand(host, 'crab-1').click()
  await hand(host, 'crab-2').click()
  await shot(host, '12-crab-choose-pile')
  await host.getByTestId('duo-crab-0').click()
  await expect(host.getByTestId('crab-pick')).toBeVisible()
  await shot(host, '13-crab-pick')
  await shot(guest, '14-crab-pick-others')
  await host.locator('[data-testid="crab-card"][data-card-id="shell-1"]').click()
  await expect(host.getByTestId('crab-pick')).toHaveCount(0)

  await hand(host, 'shark-1').click()
  await hand(host, 'swimmer-1').click()
  await shot(host, '15-steal')
})

test('04 宣告、攤牌、局間', async ({ browser }) => {
  const { code, host, guests } = await table(browser, ['阿鹽'])
  await start(host, guests)
  const [guest] = guests as [Page]
  await placeGame(code, {
    phase: 'actions',
    current: 0,
    hands: [['shell-1', 'shell-2', 'shell-3', 'shell-4', 'shell-5'], ['crab-1', 'fish-1', 'mermaid-1']],
    fields: [[], ['boat-1', 'boat-2']],
  })
  await expect(host.getByTestId('declare-stop')).toBeEnabled()
  await shot(host, '16-can-declare')

  await host.getByTestId('declare-last-chance').click()
  await expect(guest.getByTestId('last-chance-banner')).toBeVisible()
  await shot(guest, '17-last-chance')
  await guest.getByTestId('action-draw').click()
  await guest.locator('[data-testid="drawn-card"]').first().click()
  await guest.getByTestId('discard-to-0').click()
  await guest.getByTestId('end-turn').click()

  await expect(host.getByTestId('round-result')).toBeVisible()
  await shot(host, '18-round-result-host')
  await shot(guest, '19-round-result-guest')
  await host.getByTestId('next-round').click()
  await expect(host.getByTestId('round-result')).toHaveCount(0)
})

test('05 遊戲結束與再玩一場', async ({ browser }) => {
  const { code, host, guests } = await table(browser, ['阿鹽'])
  await start(host, guests)
  const [guest] = guests as [Page]
  await placeGame(code, {
    phase: 'actions',
    current: 0,
    scores: [36, 21],
    hands: [['shell-1', 'shell-2', 'shell-3', 'shell-4', 'shell-5'], ['crab-1']],
  })
  await host.getByTestId('declare-stop').click()
  await expect(host.getByTestId('winner')).toBeVisible()
  await shot(host, '20-game-over-host')
  await shot(guest, '21-game-over-guest')
})

test('06 離線與踢出', async ({ browser }) => {
  const { code, host, guests } = await table(browser, ['阿鹽', '紙鶴'])
  await start(host, guests)
  const [, third] = guests as [Page, Page]
  const uid = (await readRoom(code)).players.find((p) => p.name === '紙鶴')?.uid ?? ''
  await third.context().setOffline(true)
  await markOffline(code, uid)
  const seat = host.getByTestId('player').filter({ hasText: '紙鶴' })
  await expect(seat.getByTestId('kick-player')).toBeVisible()
  await shot(host, '22-offline')
  await seat.getByTestId('kick-player').click()
  await shot(host, '23-kick-confirm')
  await seat.getByTestId('kick-player').click()
  await expect(host.getByTestId('player-name')).toHaveCount(2)
  await shot(host, '24-after-kick')
  await third.context().setOffline(false)
  await expect(third.getByTestId('kicked-notice')).toBeVisible()
  await shot(third, '25-kicked')
})

test('07 手機畫面', async ({ browser }) => {
  const { code, host, guests } = await table(browser, ['阿鹽'])
  await start(host, guests)
  await placeGame(code, {
    phase: 'actions',
    current: 0,
    hands: [['fish-1', 'fish-2', 'shell-1', 'octopus-1', 'crab-1'], ['crab-2']],
    discards: [['boat-1'], ['penguin-1']],
  })
  await host.setViewportSize({ width: 390, height: 844 })
  await expect(host.getByTestId('my-hand')).toBeVisible()
  await shot(host, '26-mobile')
})
