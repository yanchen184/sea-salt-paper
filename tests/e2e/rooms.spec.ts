import { expect, test } from '@playwright/test'
import { placeGame } from './admin'
import { createRoom, joinRoom, openHome, playerNames } from './helpers'

test('[A1-1] 首次進站自動匿名登入，暱稱 1–12 字才能建立或加入', async ({ browser }) => {
  const page = await openHome(browser)
  const create = page.getByTestId('create-room')
  await expect(create).toBeDisabled()
  await page.getByTestId('nickname').fill('   ')
  await expect(create).toBeDisabled()
  await page.getByTestId('nickname').fill('一二三四五六七八九十壹貳參')
  await expect(create).toBeDisabled()
  await page.getByTestId('nickname').fill('  小明  ')
  await expect(create).toBeEnabled()
})

test('[A1-2] 暱稱存在本機，重整後免重填', async ({ browser }) => {
  const page = await openHome(browser)
  await page.getByTestId('nickname').fill('小明')
  await page.reload()
  await expect(page.getByTestId('nickname')).toHaveValue('小明')
  await expect(page.getByTestId('create-room')).toBeEnabled()
})

test('[A2-1] 建立房間取得 4 碼房號，建立者成為房主並進入大廳', async ({ browser }) => {
  const page = await openHome(browser)
  const code = await createRoom(page, '阿明')
  await expect(page).toHaveURL(new RegExp(`#/room/${code}$`))
  await expect(playerNames(page)).toHaveText(['阿明'])
  await expect(page.getByTestId('player').first()).toContainText('房主')
  await expect(page.getByTestId('player').first()).toContainText('你')
})

test('[A3-1] 輸入有效房號進入大廳', async ({ browser }) => {
  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  const guest = await openHome(browser)
  await joinRoom(guest, '客人', code.toLowerCase())
  await expect(guest.getByTestId('lobby-code')).toHaveText(code)
  await expect(playerNames(guest)).toHaveText(['房主', '客人'])
  await expect(guest.getByTestId('player').nth(1)).toContainText('你')
})

test('[A3-2] 房間不存在、已滿 4 人、已開始各自顯示對應錯誤訊息', async ({ browser }) => {
  const outsider = await openHome(browser)
  await joinRoom(outsider, '路人', 'ZZZZ')
  await expect(outsider.getByRole('alert')).toHaveText(/找不到這個房間/)

  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  for (const name of ['二號', '三號', '四號']) {
    const p = await openHome(browser)
    await joinRoom(p, name, code)
    await expect(p.getByTestId('lobby-code')).toHaveText(code)
  }
  await joinRoom(outsider, '路人', code)
  await expect(outsider.getByRole('alert')).toHaveText(/房間已滿 4 人/)

  const host2 = await openHome(browser)
  const code2 = await createRoom(host2, '房主二')
  const guest2 = await openHome(browser)
  await joinRoom(guest2, '客人', code2)
  await host2.getByTestId('start-game').click()
  await expect(host2.getByTestId('game-status')).toHaveText('遊戲進行中')
  await joinRoom(outsider, '路人', code2)
  await expect(outsider.getByRole('alert')).toHaveText(/這個房間的遊戲已經開始/)
})

test('[A4-1] 第二個瀏覽器加入，第一個不重整就看到', async ({ browser }) => {
  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  const guest = await openHome(browser)
  await joinRoom(guest, '客人', code)
  await expect(playerNames(host)).toHaveText(['房主', '客人'])
})

test('[A4-2] 只有房主看得到開始按鈕，人數 2–4 才可按', async ({ browser }) => {
  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  await expect(host.getByTestId('start-game')).toBeDisabled()
  await expect(host.getByTestId('start-hint')).toBeVisible()

  const guest = await openHome(browser)
  await joinRoom(guest, '客人', code)
  await expect(host.getByTestId('start-game')).toBeEnabled()
  await expect(host.getByTestId('start-hint')).toBeHidden()
  await expect(guest.getByTestId('start-game')).toHaveCount(0)
  await expect(guest.getByTestId('waiting-host')).toBeVisible()
})

test('[A4-3] 離開後列表移除，房主離開則房主轉移；關閉分頁不算離開', async ({ browser }) => {
  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  const guest = await openHome(browser)
  await joinRoom(guest, '客人', code)
  const third = await openHome(browser)
  await joinRoom(third, '三號', code)
  await expect(playerNames(host)).toHaveText(['房主', '客人', '三號'])

  await third.getByTestId('leave-room').click()
  await expect(third.getByTestId('nickname')).toBeVisible()
  await expect(playerNames(host)).toHaveText(['房主', '客人'])

  const context = guest.context()
  await guest.close()
  const back = await context.newPage()
  await back.goto(`./#/room/${code}`)
  await expect(playerNames(back)).toHaveText(['房主', '客人'])
  await expect(playerNames(host)).toHaveText(['房主', '客人'])

  await host.getByTestId('leave-room').click()
  await expect(playerNames(back)).toHaveText(['客人'])
  await expect(back.getByTestId('player').first()).toContainText('房主')
  await expect(back.getByTestId('start-game')).toBeVisible()
})

test('[A5-1] 遊戲中重整頁面，回到同一房間同一座位，手牌不變', async ({ browser }) => {
  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  const guest = await openHome(browser)
  await joinRoom(guest, '客人', code)
  await host.getByTestId('start-game').click()
  await expect(guest.getByTestId('game-status')).toHaveText('遊戲進行中')

  await placeGame(code, { phase: 'draw', current: 1, hands: [[], ['octopus-1']], discards: [['shell-1'], []] })
  await guest.getByTestId('action-take-0').click()
  await expect(guest.getByTestId('hand-ids')).toHaveText('octopus-1,shell-1')

  await guest.reload()
  await expect(guest.getByTestId('game-status')).toHaveText('遊戲進行中')
  await expect(guest).toHaveURL(new RegExp(`#/room/${code}$`))
  await expect(guest.getByTestId('hand-count')).toHaveText('2')
  await expect(guest.getByTestId('hand-ids')).toHaveText('octopus-1,shell-1')
  await expect(playerNames(guest)).toHaveText(['房主', '客人'])
  await expect(guest.getByTestId('player').nth(1)).toContainText('你')
})
