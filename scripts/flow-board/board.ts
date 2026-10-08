import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Claim } from './claims'
import { layout, parseEdges, parseNodes } from './flow'
import {
  type CommitRef,
  type ConditionStatus,
  conditionStatus,
  gitFingerprint,
  parseFlowStatus,
  readFirstTestCommits,
  readNodeCommits,
} from './sources'

export const FLOW_FILE = 'docs/spec/01-flow.md'
export const STATUS_FILE = 'docs/flow-status.md'

export interface BoardCondition {
  id: string
  text: string
  status: ConditionStatus
  firstCommit: CommitRef | null
}

export interface BoardNode {
  id: string
  title: string
  section: string
  status: string
  conditions: BoardCondition[]
  commits: CommitRef[]
}

export interface Board {
  columns: string[][]
  extras: string[]
  nodes: Record<string, BoardNode>
  claims: Readonly<Record<string, Claim>>
  statusUpdatedAt: string | null
}

/** 規格、狀態檔、git 這三樣的指紋；有變才重算 */
export async function sourceFingerprint(repo: string): Promise<string> {
  const mtime = (file: string) =>
    stat(join(repo, file)).then(
      (s) => String(s.mtimeMs),
      () => 'missing',
    )
  return [await mtime(FLOW_FILE), await mtime(STATUS_FILE), await gitFingerprint(repo)].join('\n')
}

export async function buildBoard(repo: string, claims: Readonly<Record<string, Claim>>): Promise<Board> {
  const flow = await readFile(join(repo, FLOW_FILE), 'utf8')
  const statusText = await readFile(join(repo, STATUS_FILE), 'utf8').catch(() => null)
  const statusAt = statusText === null ? null : (await stat(join(repo, STATUS_FILE))).mtime.toISOString()
  const statuses = parseFlowStatus(statusText ?? '')
  const [nodeCommits, firstCommits] = await Promise.all([readNodeCommits(repo), readFirstTestCommits(repo)])

  const parsed = parseNodes(flow)
  const { columns, extras } = layout(parsed, parseEdges(flow))
  const nodes = Object.fromEntries(
    parsed.map((n): [string, BoardNode] => {
      const status = statuses.get(n.id)
      return [
        n.id,
        {
          id: n.id,
          title: n.title,
          section: n.section,
          status: status?.icon ?? '',
          conditions: n.conditions.map((c) => ({
            ...c,
            status: conditionStatus(status, c.id),
            firstCommit: firstCommits.get(c.id) ?? null,
          })),
          commits: nodeCommits.get(n.id) ?? [],
        },
      ]
    }),
  )
  return { columns, extras, nodes, claims, statusUpdatedAt: statusAt }
}
