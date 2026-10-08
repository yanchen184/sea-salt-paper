/// <reference lib="dom" />
import type { Browser, Locator, Page } from '@playwright/test'
import { CARD_NAMES } from '../../src/engine/cards'
import type { CardKind } from '../../src/engine/types'
import { placeGame } from './admin'
import { expect, test, createRoom, joinRoom, openHome } from './helpers'

const KINDS = Object.keys(CARD_NAMES) as CardKind[]

async function startGame(browser: Browser): Promise<{ code: string; host: Page }> {
  const host = await openHome(browser)
  const code = await createRoom(host, '房主')
  const guest = await openHome(browser)
  await joinRoom(guest, '客人', code)
  await expect(guest.getByTestId('lobby-code')).toHaveText(code)
  await host.getByTestId('start-game').click()
  await expect(host.getByTestId('game-status')).toHaveText('遊戲進行中')
  await placeGame(code, {
    phase: 'actions',
    current: 0,
    hands: [KINDS.map((k) => `${k}-1`), ['penguin-2']],
  })
  await expect(host.getByTestId('hand-card')).toHaveCount(KINDS.length)
  return { code, host }
}

function style(locator: Locator, property: string): Promise<string> {
  return locator.evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property)
}

async function look(page: Page) {
  return {
    table: await style(page.locator('body'), 'background-image'),
    back: await style(page.getByTestId('card-back').first(), 'background-image'),
    panel: await style(page.getByRole('region', { name: '你的區域' }), 'background-color'),
    cardColor: await style(page.getByTestId('hand-card').first(), 'background-color'),
  }
}

test('[S5-1] 預設主題「紙藝海岸」：背景是該主題桌布，卡背是該主題卡背', async ({ browser }) => {
  const { host } = await startGame(browser)
  await expect(host.locator('html')).toHaveAttribute('data-theme', 'paper')
  await expect(host.getByRole('radio', { name: '紙藝海岸' })).toBeChecked()
  const paper = await look(host)
  expect(paper.table).toContain('url(')
  expect(paper.back).toContain('url(')
  expect(paper.table).not.toBe(paper.back)
})

test('[S5-2] 用滑鼠或鍵盤切換到「深海夜航」後桌布、卡背、面板配色都換掉，重新整理後仍保留', async ({ browser }) => {
  const { host } = await startGame(browser)
  const paper = await look(host)

  await host.getByRole('radio', { name: '紙藝海岸' }).focus()
  await host.keyboard.press('ArrowRight')
  await expect(host.getByRole('radio', { name: '深海夜航' })).toBeChecked()
  await expect(host.locator('html')).toHaveAttribute('data-theme', 'night')
  const night = await look(host)
  expect(night.table).toContain('url(')
  expect(night.back).toContain('url(')
  expect(night.table).not.toBe(paper.table)
  expect(night.back).not.toBe(paper.back)
  expect(night.panel).not.toBe(paper.panel)

  await host.reload()
  await expect(host.getByTestId('hand-card')).toHaveCount(KINDS.length)
  await expect(host.locator('html')).toHaveAttribute('data-theme', 'night')
  await expect(host.getByRole('radio', { name: '深海夜航' })).toBeChecked()
  expect((await look(host)).table).toBe(night.table)
})

test('[S5-3] 每張卡牌顯示該生物的線稿，兩個主題的卡牌顏色相同', async ({ browser }) => {
  const { host } = await startGame(browser)
  const masks = new Set<string>()
  for (const kind of KINDS) {
    const art = host.locator(`[data-testid="hand-card"][data-card-id="${kind}-1"] [data-testid="card-art"]`)
    await expect(art).toHaveAttribute('data-kind', kind)
    const box = await art.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(20)
    const mask = await art.evaluate((el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage)
    expect(mask).toContain('url(')
    masks.add(mask)
  }
  expect(masks.size).toBe(KINDS.length)

  const paper = await look(host)
  await host.getByTestId('theme-night').click()
  await expect(host.locator('html')).toHaveAttribute('data-theme', 'night')
  expect((await look(host)).cardColor).toBe(paper.cardColor)
})
