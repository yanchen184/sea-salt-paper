import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FLOW_FILE, STATUS_FILE } from './board'
import { layout, parseEdges, parseNodes } from './flow'
import { type ConditionStatus, conditionStatus, parseFlowStatus } from './sources'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLACEHOLDER = '<script id="board-data" type="application/json"></script>'

export interface PublicNode {
  id: string
  title: string
  section: string
  status: string
  conditions: { id: string; text: string; status: ConditionStatus }[]
}

/** 線上唯讀版的看板：不含領取紀錄與 commit 清單 */
export interface PublicBoard {
  columns: string[][]
  extras: string[]
  nodes: Record<string, PublicNode>
  commit: string
}

export async function buildPublicBoard(repo: string, commit: string): Promise<PublicBoard> {
  const flow = await readFile(join(repo, FLOW_FILE), 'utf8')
  const statuses = parseFlowStatus(await readFile(join(repo, STATUS_FILE), 'utf8').catch(() => ''))
  const parsed = parseNodes(flow)
  const { columns, extras } = layout(parsed, parseEdges(flow))
  const nodes = Object.fromEntries(
    parsed.map((n): [string, PublicNode] => {
      const status = statuses.get(n.id)
      return [
        n.id,
        {
          id: n.id,
          title: n.title,
          section: n.section,
          status: status?.icon ?? '',
          conditions: n.conditions.map((c) => ({ ...c, status: conditionStatus(status, c.id) })),
        },
      ]
    }),
  )
  return { columns, extras, nodes, commit }
}

/** 把看板資料嵌進 board.html，頁面看到資料就切成唯讀模式 */
export function renderStaticPage(template: string, board: PublicBoard): string {
  if (template.split(PLACEHOLDER).length !== 2) throw new Error('board.html 要有一個 board-data 佔位')
  const json = JSON.stringify(board).replace(/</g, '\\u003c')
  return template.replace(PLACEHOLDER, () => `<script id="board-data" type="application/json">${json}</script>`)
}

/** 建置時的 commit：CI 給的 VITE_COMMIT_SHA／GITHUB_SHA，否則本機 HEAD */
export function resolveCommit(env: NodeJS.ProcessEnv, repo: string): string {
  const fromEnv = env.VITE_COMMIT_SHA || env.GITHUB_SHA
  if (fromEnv && fromEnv !== 'dev') return fromEnv
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim()
}

/** 寫出 <outDir>/flow/index.html，回傳檔案路徑 */
export async function exportBoard(repo: string, outDir: string, commit: string): Promise<string> {
  const template = await readFile(join(HERE, 'board.html'), 'utf8')
  const page = renderStaticPage(template, await buildPublicBoard(repo, commit))
  const file = join(outDir, 'flow', 'index.html')
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, page)
  return file
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = process.cwd()
  const file = await exportBoard(repo, join(repo, 'dist'), resolveCommit(process.env, repo))
  console.log(`流程圖：${file}`)
}
