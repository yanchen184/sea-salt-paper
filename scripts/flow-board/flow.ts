export interface Condition {
  id: string
  text: string
}

export interface FlowNode {
  id: string
  title: string
  section: string
  conditions: Condition[]
}

export interface FlowLayout {
  /** 由左至右的欄，每欄是節點 ID */
  columns: string[][]
  /** 節點表有、流程圖沒有的節點 */
  extras: string[]
}

type Edge = readonly [string, string]

const NODE_ID = '[A-Z]+\\d+[a-z]?'

export function parseNodes(markdown: string): FlowNode[] {
  const nodes: FlowNode[] = []
  let section = ''
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+?)\s*$/)
    if (heading?.[1]) {
      section = heading[1].replace(/（.*?）/g, '').trim()
      continue
    }
    const cells = line.split('|').map((c) => c.trim())
    const header = cells[1]?.match(new RegExp(`^(${NODE_ID})\\s+(.+)$`))
    if (!header?.[1] || !header[2] || cells[2] === undefined) continue
    nodes.push({ id: header[1], title: header[2], section, conditions: parseConditions(header[1], cells[2]) })
  }
  return nodes
}

function parseConditions(nodeId: string, cell: string): Condition[] {
  const pattern = new RegExp(`(?<![\\w-])${nodeId}-\\d+`, 'g')
  const marks = [...cell.matchAll(pattern)].filter((m, i, all) => all.findIndex((o) => o[0] === m[0]) === i)
  return marks.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length
    const end = marks[i + 1]?.index ?? cell.length
    return { id: m[0], text: cell.slice(start, end).trim().replace(/[；;]$/, '').trim() }
  })
}

export function parseEdges(markdown: string): Edge[] {
  const block = markdown.match(/```mermaid\r?\n([\s\S]*?)```/)?.[1] ?? ''
  const edges: Edge[] = []
  for (const raw of block.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line.includes('-->') || /^(flowchart|graph|subgraph|end)\b/.test(line)) continue
    const ids = line
      .replace(/\|[^|]*\|/g, '')
      .replace(/\[\[.*?\]\]|\[.*?\]|\{.*?\}|\(\(.*?\)\)|\(.*?\)/g, '')
      .split('-->')
      .map((s) => s.trim())
    for (let i = 0; i + 1 < ids.length; i++) {
      const from = ids[i]
      const to = ids[i + 1]
      if (from && to) edges.push([from, to])
    }
  }
  return edges
}

export function layout(nodes: FlowNode[], edges: Edge[]): FlowLayout {
  const order = appearanceOrder(edges)
  const forward = withoutBackEdges(order, edges)
  const depth = longestPath(order, forward)
  pullLateBranches(order, forward, depth)

  const inGraph = nodes.filter((n) => depth.has(n.id))
  const byDepth = new Map<number, string[]>()
  for (const node of inGraph) {
    const d = depth.get(node.id) ?? 0
    byDepth.set(d, [...(byDepth.get(d) ?? []), node.id])
  }
  const columns = [...byDepth.entries()].sort(([a], [b]) => a - b).map(([, ids]) => ids)
  const extras = nodes.filter((n) => !depth.has(n.id)).map((n) => n.id)
  return { columns, extras }
}

function appearanceOrder(edges: Edge[]): string[] {
  return [...new Set(edges.flat())]
}

/** 以出現順序做 DFS，拿掉指回祖先的邊，剩下的是 DAG */
function withoutBackEdges(order: string[], edges: Edge[]): Edge[] {
  const out = new Map<string, string[]>()
  for (const [from, to] of edges) out.set(from, [...(out.get(from) ?? []), to])
  const state = new Map<string, 'open' | 'done'>()
  const back = new Set<string>()
  const visit = (id: string): void => {
    state.set(id, 'open')
    for (const next of out.get(id) ?? []) {
      const s = state.get(next)
      if (s === 'open') back.add(`${id}>${next}`)
      else if (s === undefined) visit(next)
    }
    state.set(id, 'done')
  }
  for (const id of order) if (!state.has(id)) visit(id)
  return edges.filter(([from, to]) => !back.has(`${from}>${to}`))
}

function topoOrder(order: string[], edges: Edge[]): string[] {
  const indegree = new Map(order.map((id) => [id, 0]))
  for (const [, to] of edges) indegree.set(to, (indegree.get(to) ?? 0) + 1)
  const queue = order.filter((id) => indegree.get(id) === 0)
  const sorted: string[] = []
  while (queue.length > 0) {
    const id = queue.shift() as string
    sorted.push(id)
    for (const [from, to] of edges) {
      if (from !== id) continue
      const left = (indegree.get(to) ?? 0) - 1
      indegree.set(to, left)
      if (left === 0) queue.push(to)
    }
  }
  return sorted
}

function longestPath(order: string[], edges: Edge[]): Map<string, number> {
  const depth = new Map<string, number>()
  for (const id of topoOrder(order, edges)) {
    const preds = edges.filter(([, to]) => to === id).map(([from]) => depth.get(from) ?? 0)
    depth.set(id, preds.length === 0 ? 0 : Math.max(...preds) + 1)
  }
  return depth
}

/** 第一個起點以外的旁支起點（例如「任何時刻」事件），整段往右貼到下游前一欄 */
function pullLateBranches(order: string[], edges: Edge[], depth: Map<string, number>): void {
  const preds = (id: string) => edges.filter(([, to]) => to === id).map(([from]) => from)
  const succs = (id: string) => edges.filter(([from]) => from === id).map(([, to]) => to)
  const late = new Set<string>()
  for (const id of topoOrder(order, edges)) {
    const p = preds(id)
    const isLateSource = p.length === 0 && id !== order[0]
    if (isLateSource || (p.length > 0 && p.every((x) => late.has(x)))) late.add(id)
  }
  for (const id of topoOrder(order, edges).reverse()) {
    if (!late.has(id)) continue
    const next = succs(id).map((s) => depth.get(s) ?? 0)
    if (next.length > 0) depth.set(id, Math.min(...next) - 1)
  }
}
