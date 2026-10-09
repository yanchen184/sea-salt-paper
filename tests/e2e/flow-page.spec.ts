import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'
import { buildPublicBoard, exportBoard, resolveCommit } from '../../scripts/flow-board/export'

const REPO = join(import.meta.dirname, '../..')
const COMMIT = '0123456789abcdef0123456789abcdef01234567'

async function exported() {
  const out = mkdtempSync(join(tmpdir(), 'flow-page-'))
  const file = await exportBoard(REPO, out, COMMIT)
  return { out, url: pathToFileURL(file).href }
}

test('[S7-1] 匯出頁顯示與本機 Flow Board 相同的節點分欄、驗收條件與測試狀態', async ({ page }) => {
  const board = await buildPublicBoard(REPO, COMMIT)
  await page.goto((await exported()).url)

  const columns = page.locator('#flow .col')
  await expect(columns).toHaveCount(board.columns.length)
  for (const [i, ids] of board.columns.entries()) {
    expect(await columns.nth(i).locator('[data-node]').evaluateAll((els) => els.map((e) => e.getAttribute('data-node')))).toEqual(ids)
  }
  expect(await page.locator('#extras [data-node]').evaluateAll((els) => els.map((e) => e.getAttribute('data-node')))).toEqual(board.extras)

  const s8 = page.locator('[data-node="S8"]')
  await expect(s8).toHaveAttribute('data-status', board.nodes.S8?.status === '✅' ? 'pass' : 'miss')
  await expect(s8.locator('.cond')).toHaveCount(board.nodes.S8?.conditions.length ?? 0)
  await s8.click()
  await expect(s8.locator('.detail')).toContainText(board.nodes.S8?.conditions[0]?.text ?? '')
})

test('[S7-2] 線上版唯讀：沒有領取按鈕、領取紀錄、commit 清單，也不連即時同步', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto((await exported()).url)
  await expect(page.locator('[data-node]').first()).toBeVisible()

  await expect(page.locator('.claim')).toHaveCount(0)
  await expect(page.locator('.commits')).toHaveCount(0)
  await expect(page.getByRole('button')).toHaveCount(0)
  await expect(page.locator('#me')).toBeHidden()
  await expect(page.locator('#live')).toBeHidden()
  await expect(page.getByText('有人在做')).toBeHidden()
  expect(requests.filter((u) => !u.startsWith('file:'))).toEqual([])
})

test('[S7-3] 頁面標示建置時的 commit；CI 用 VITE_COMMIT_SHA／GITHUB_SHA，本機用 HEAD', async ({ page }) => {
  await page.goto((await exported()).url)
  await expect(page.getByTestId('build-commit')).toHaveText(COMMIT.slice(0, 7))

  expect(resolveCommit({ VITE_COMMIT_SHA: 'aaa', GITHUB_SHA: 'bbb' }, REPO)).toBe('aaa')
  expect(resolveCommit({ GITHUB_SHA: 'bbb' }, REPO)).toBe('bbb')
  expect(resolveCommit({ VITE_COMMIT_SHA: 'dev' }, REPO)).toMatch(/^[0-9a-f]{40}$/)
})

test('[S7-4] 匯出只新增 flow/index.html，遊戲本身的檔案不變', async () => {
  const out = mkdtempSync(join(tmpdir(), 'flow-dist-'))
  mkdirSync(join(out, 'assets'))
  const game = { 'index.html': '<div id="root"></div>', 'assets/app.js': 'location.hash' }
  for (const [path, text] of Object.entries(game)) writeFileSync(join(out, path), text)

  await exportBoard(REPO, out, COMMIT)
  const files = readdirSync(out, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => relative(out, join(d.parentPath, d.name)).replaceAll('\\', '/'))
    .sort()
  expect(files).toEqual(['assets/app.js', 'flow/index.html', 'index.html'])
  for (const [path, text] of Object.entries(game)) expect(readFileSync(join(out, path), 'utf8')).toBe(text)
})
