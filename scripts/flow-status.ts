import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FLOW_FILE = join(ROOT, 'docs/spec/01-flow.md')
const OUTPUT_FILE = join(ROOT, 'docs/flow-status.md')
const RESULT_FILE = join(ROOT, 'node_modules/.tmp/vitest-results.json')

interface FlowNode {
  id: string
  title: string
  conditions: string[]
}

type ConditionResult = 'passed' | 'failed'

interface VitestReport {
  testResults: { assertionResults: { title: string; status: string }[] }[]
}

function parseFlow(markdown: string): FlowNode[] {
  const nodes: FlowNode[] = []
  for (const line of markdown.split(/\r?\n/)) {
    const cells = line.split('|').map((c) => c.trim())
    const header = cells[1]?.match(/^([AGS]\d+[a-z]?)\s+(.+)$/)
    if (!header?.[1] || !header[2] || cells[2] === undefined) continue
    const id = header[1]
    const pattern = new RegExp(`(?<![\\w-])${id}-\\d+`, 'g')
    nodes.push({ id, title: header[2], conditions: [...new Set(cells[2].match(pattern) ?? [])] })
  }
  return nodes
}

function runVitest(): VitestReport {
  mkdirSync(dirname(RESULT_FILE), { recursive: true })
  const vitest = join(ROOT, 'node_modules/vitest/vitest.mjs')
  const run = spawnSync(process.execPath, [vitest, 'run', '--reporter=json', `--outputFile=${RESULT_FILE}`], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  try {
    return JSON.parse(readFileSync(RESULT_FILE, 'utf8')) as VitestReport
  } catch {
    throw new Error(`Vitest 沒有產生結果（exit ${run.status}）`)
  }
}

function collectResults(report: VitestReport): Map<string, ConditionResult> {
  const results = new Map<string, ConditionResult>()
  for (const file of report.testResults) {
    for (const test of file.assertionResults) {
      if (test.status !== 'passed' && test.status !== 'failed') continue
      const prefix = test.title.match(/^(\[[^\]]+\])+/)?.[0] ?? ''
      for (const [, id] of prefix.matchAll(/\[([^\]]+)\]/g)) {
        if (!id || results.get(id) === 'failed') continue
        results.set(id, test.status)
      }
    }
  }
  return results
}

function nodeStatus(node: FlowNode, results: Map<string, ConditionResult>) {
  const covered = node.conditions.filter((c) => results.has(c))
  const missing = node.conditions.filter((c) => !results.has(c))
  const failed = node.conditions.filter((c) => results.get(c) === 'failed')
  let icon = '⬜'
  if (failed.length > 0) icon = '❌'
  else if (covered.length === node.conditions.length && covered.length > 0) icon = '✅'
  else if (covered.length > 0) icon = '🟡'
  return { icon, covered, missing, failed }
}

function main(): number {
  const nodes = parseFlow(readFileSync(FLOW_FILE, 'utf8'))
  const known = new Set(nodes.flatMap((n) => n.conditions))
  const results = collectResults(runVitest())

  const unknown = [...results.keys()].filter((id) => !known.has(id))
  if (unknown.length > 0) {
    console.error(`測試中出現 spec 沒有的編號：${unknown.join(', ')}`)
    return 1
  }

  const rows = nodes.map((node) => {
    const s = nodeStatus(node, results)
    return `| ${node.id} ${node.title} | ${s.icon} | ${s.covered.length}/${node.conditions.length} | ${s.missing.join(' ') || '—'} | ${s.failed.join(' ') || '—'} |`
  })
  const output = [
    '# Flow 狀態',
    '',
    '由 `npm run flow:status` 產生，不要手改。判定方式見 [01-flow.md](spec/01-flow.md#驗收怎麼算)。',
    '',
    '| 節點 | 狀態 | 已覆蓋 | 缺測試 | 失敗 |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n')
  writeFileSync(OUTPUT_FILE, output)
  console.log(output)

  const anyFailed = [...results.values()].includes('failed')
  return anyFailed ? 1 : 0
}

process.exit(main())
