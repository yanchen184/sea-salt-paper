import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import ts from 'typescript'

const run = promisify(execFile)
const CONDITION_ID = /[A-Z]+\d+[a-z]?-\d+/g

export type ConditionStatus = 'passed' | 'missing' | 'failed' | 'unknown'

export interface NodeStatus {
  icon: string
  missing: string[]
  failed: string[]
}

export interface CommitRef {
  sha: string
  author: string
  agent: string
  date: string
  subject: string
}

/** 讀 flow:status 產生的表：| 節點 | 狀態 | 已覆蓋 | 缺測試 | 失敗 | */
export function parseFlowStatus(markdown: string): Map<string, NodeStatus> {
  const result = new Map<string, NodeStatus>()
  for (const line of markdown.split(/\r?\n/)) {
    const cells = line.split('|').map((c) => c.trim())
    const id = cells[1]?.match(/^([A-Z]+\d+[a-z]?)\s/)?.[1]
    if (!id || cells.length < 7) continue
    result.set(id, {
      icon: cells[2] ?? '',
      missing: cells[4]?.match(CONDITION_ID) ?? [],
      failed: cells[5]?.match(CONDITION_ID) ?? [],
    })
  }
  return result
}

export function conditionStatus(status: NodeStatus | undefined, conditionId: string): ConditionStatus {
  if (!status) return 'unknown'
  if (status.failed.includes(conditionId)) return 'failed'
  if (status.missing.includes(conditionId)) return 'missing'
  return 'passed'
}

async function git(repo: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd: repo, maxBuffer: 64 * 1024 * 1024 })
  return stdout
}

const FIELD = '\x1f'
const RECORD = '\x1e'

/** 每個節點有哪些 commit 帶 `Flow-Node: <節點>` trailer，新的在前 */
export async function readNodeCommits(repo: string): Promise<Map<string, CommitRef[]>> {
  const format = ['%H', '%an', '%aI', '%s', '%(trailers:key=Flow-Node,valueonly,separator=%x2C)', '%(trailers:key=Flow-Agent,valueonly,separator=%x2C)']
  const out = await git(repo, ['log', '--all', `--format=${format.join('%x1f')}%x1e`])
  const byNode = new Map<string, CommitRef[]>()
  for (const record of out.split(RECORD)) {
    const [sha, author, date, subject, nodes, agent] = record.trim().split(FIELD)
    if (!sha || !nodes) continue
    const ref: CommitRef = { sha, author: author ?? '', agent: agent?.trim() || (author ?? ''), date: date ?? '', subject: subject ?? '' }
    for (const node of nodes.split(',').map((n) => n.trim()).filter(Boolean)) {
      byNode.set(node, [...(byNode.get(node) ?? []), ref])
    }
  }
  return byNode
}

const TEST_FILES = [':(glob)**/*.test.ts', ':(glob)**/*.test.tsx', ':(glob)**/*.spec.ts', ':(glob)**/*.spec.tsx']
const TEST_FUNCTIONS = new Set(['it', 'test'])
const TEST_MODIFIERS = new Set(['skip', 'only', 'todo', 'concurrent', 'sequential', 'fails'])
const TEST_FACTORIES = new Set(['each', 'for', 'skipIf', 'runIf'])
const EMPTY_BLOB = /^0+$/
const titleIdsByBlob = new Map<string, string[]>()

/** 每個 `[條件 ID]` 測試名稱第一次出現在測試檔的 commit */
export async function readFirstTestCommits(repo: string): Promise<Map<string, CommitRef>> {
  const out = await git(repo, [
    'log', '--all', '--reverse', '--topo-order', '--full-history', '--diff-merges=first-parent', '--root', '--no-renames', '--raw', '--no-abbrev',
    `--format=${RECORD}%H${FIELD}%an${FIELD}%aI${FIELD}%s`,
    '--', ...TEST_FILES,
  ])
  const commits: { ref: CommitRef; blobs: { sha: string; path: string }[] }[] = []
  for (const chunk of out.split(RECORD)) {
    const [header, ...body] = chunk.split('\n')
    const [sha, author, date, subject] = (header ?? '').split(FIELD)
    if (!sha) continue
    const blobs = body.flatMap((line) => {
      const match = line.match(/^:\S+ \S+ \S+ (\S+) \S+\t(.+)$/)
      return match?.[1] && match[2] && !EMPTY_BLOB.test(match[1]) ? [{ sha: match[1], path: match[2] }] : []
    })
    commits.push({ ref: { sha, author: author ?? '', agent: author ?? '', date: date ?? '', subject: subject ?? '' }, blobs })
  }

  const pending = [...new Set(commits.flatMap((c) => c.blobs.map((b) => b.sha)))].filter((sha) => !titleIdsByBlob.has(sha))
  const contents = await readBlobs(repo, pending)
  for (const { blobs } of commits) {
    for (const blob of blobs) {
      const text = contents.get(blob.sha)
      if (text !== undefined) titleIdsByBlob.set(blob.sha, testTitleIds(blob.path, text))
    }
  }

  const first = new Map<string, CommitRef>()
  for (const { ref, blobs } of commits) {
    for (const blob of blobs) {
      for (const id of titleIdsByBlob.get(blob.sha) ?? []) {
        if (!first.has(id)) first.set(id, ref)
      }
    }
  }
  return first
}

/** 測試檔裡 `it(...)`／`test(...)`（含 `.skip` 等）標題開頭的條件 ID */
export function testTitleIds(path: string, source: string): string[] {
  const kind = path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false, kind)
  const ids: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isTestFunction(node.expression)) {
      const title = node.arguments[0]
      if (title && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))) {
        ids.push(...(title.text.match(/^(?:\[[^\]]+\])+/)?.[0].match(CONDITION_ID) ?? []))
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return ids
}

/** `it`／`test`，可接 `skip`、`concurrent` 等修飾詞，或由 `each(cases)`、`skipIf(cond)` 等產生的測試函式 */
function isTestFunction(callee: ts.Expression): boolean {
  if (ts.isIdentifier(callee)) return TEST_FUNCTIONS.has(callee.text)
  if (ts.isPropertyAccessExpression(callee)) return TEST_MODIFIERS.has(callee.name.text) && isTestFunction(callee.expression)
  if (ts.isCallExpression(callee) && ts.isPropertyAccessExpression(callee.expression)) {
    return TEST_FACTORIES.has(callee.expression.name.text) && isTestFunction(callee.expression.expression)
  }
  return false
}

function readBlobs(repo: string, shas: string[]): Promise<Map<string, string>> {
  if (shas.length === 0) return Promise.resolve(new Map())
  return new Promise((done, fail) => {
    const child = spawn('git', ['cat-file', '--batch'], { cwd: repo })
    const chunks: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.on('error', fail)
    child.on('close', (code) => {
      if (code !== 0) return fail(new Error(`git cat-file 結束碼 ${code}`))
      const out = Buffer.concat(chunks)
      const blobs = new Map<string, string>()
      let at = 0
      while (at < out.length) {
        const eol = out.indexOf(0x0a, at)
        const [sha, type, size] = out.subarray(at, eol).toString('utf8').split(' ')
        at = eol + 1
        if (type !== 'blob' || !sha) continue
        const length = Number(size)
        blobs.set(sha, out.subarray(at, at + length).toString('utf8'))
        at += length + 1
      }
      done(blobs)
    })
    child.stdin.end(`${shas.join('\n')}\n`)
  })
}

/** git refs 與 HEAD 的指紋，用來判斷要不要重算看板 */
export async function gitFingerprint(repo: string): Promise<string> {
  const refs = await git(repo, ['for-each-ref', '--format=%(refname) %(objectname)'])
  const head = await git(repo, ['rev-parse', '-q', '--verify', 'HEAD']).catch(() => '')
  return `${refs}HEAD ${head}`
}
