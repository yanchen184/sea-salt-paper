import type { Board } from './board'

const USAGE = `用法：
  npm run flow -- claim <節點> --as <名字>
  npm run flow -- release <節點> --as <名字> [--force]
  npm run flow -- list
server 位址取 FLOW_BOARD_URL，預設 http://127.0.0.1:4317`

async function main(argv: string[]): Promise<number> {
  const base = (process.env.FLOW_BOARD_URL ?? 'http://127.0.0.1:4317').replace(/\/$/, '')
  const [command, node] = argv
  const asIndex = argv.indexOf('--as')
  const who = asIndex >= 0 ? argv[asIndex + 1] : undefined

  if (command === 'list') {
    const board = (await (await fetch(`${base}/api/board`)).json()) as Board
    const rows = Object.entries(board.claims).map(([id, c]) => `${id}\t${c.who}\t${c.at}`)
    console.log(rows.length > 0 ? rows.join('\n') : '目前沒有人領取節點')
    return 0
  }
  if ((command !== 'claim' && command !== 'release') || !node || !who) {
    console.error(USAGE)
    return 2
  }
  const res = await fetch(`${base}/api/${command}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ node, who, force: argv.includes('--force') }),
  })
  const data = (await res.json()) as { error?: string }
  if (!res.ok) {
    console.error(data.error ?? `HTTP ${res.status}`)
    return 1
  }
  console.log(command === 'claim' ? `${who} 已領取 ${node}` : `${who} 已放手 ${node}`)
  return 0
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(`連不上 Flow Board：${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  },
)
