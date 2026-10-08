import { expect, type Browser, type Page } from '@playwright/test'

export async function openHome(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('./')
  await expect(page.getByTestId('nickname')).toBeVisible()
  return page
}

export async function createRoom(page: Page, name: string): Promise<string> {
  await page.getByTestId('nickname').fill(name)
  await page.getByTestId('create-room').click()
  const code = page.getByTestId('lobby-code')
  await expect(code).toHaveText(/^[A-Z2-9]{4}$/)
  return (await code.textContent()) ?? ''
}

export async function joinRoom(page: Page, name: string, code: string): Promise<void> {
  await page.getByTestId('nickname').fill(name)
  await page.getByTestId('room-code').fill(code)
  await page.getByTestId('join-room').click()
}

export function playerNames(page: Page) {
  return page.getByTestId('player-name')
}
