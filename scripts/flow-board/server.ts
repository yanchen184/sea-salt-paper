import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { type AddressInfo, isIP } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Board, buildBoard, sourceFingerprint } from './board'
import { ClaimStore, type ClaimsLock, lockClaimsDir } from './claims'

const HERE = dirname(fileURLToPath(import.meta.url))
const PAGE = readFileSync(join(HERE, 'board.html'))
const MAX_BODY = 4096
const NAME = /^[^\s<>"'`][^<>"'`]{0,39}$/u

export interface BoardServerOptions {
  repo: string
  port: number
  host: string
  pollMs?: number
}

export interface BoardServer {
  url: string
  close: () => Promise<void>
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function startBoardServer(options: BoardServerOptions): Promise<BoardServer> {
  const lock = lockClaimsDir(join(options.repo, '.flow-board'))
  try {
    const server = await listenBoardServer(options, lock)
    return { url: server.url, close: () => server.close().finally(lock.release) }
  } catch (e) {
    lock.release()
    throw e
  }
}

async function listenBoardServer({ repo, port, host, pollMs = 2000 }: BoardServerOptions, lock: ClaimsLock): Promise<BoardServer> {
  const claims = new ClaimStore(join(repo, '.flow-board/claims.json'), undefined, lock.assertHeld)
  const clients = new Set<ServerResponse>()
  let board: Board = await buildBoard(repo, claims.list())
  let fingerprint = await sourceFingerprint(repo)
  let refreshing = false

  const broadcast = (): void => {
    const payload = `event: board\ndata: ${JSON.stringify(board)}\n\n`
    for (const res of clients) res.write(payload)
  }

  const refresh = async (): Promise<void> => {
    const rebuilt = await buildBoard(repo, claims.list())
    board = { ...rebuilt, claims: claims.list() }
    broadcast()
  }

  const refreshClaims = (): void => {
    board = { ...board, claims: claims.list() }
    broadcast()
  }

  const poll = setInterval(() => {
    if (refreshing) return
    refreshing = true
    sourceFingerprint(repo)
      .then(async (next) => {
        if (next === fingerprint) return
        await refresh()
        fingerprint = next
      })
      .catch((e: unknown) => console.error('[flow-board] 重新讀取失敗', e))
      .finally(() => {
        refreshing = false
      })
  }, pollMs)
  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(': ping\n\n')
  }, 25_000)

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    if (!isLocalOrIpHost(req.headers.host)) throw new HttpError(403, 'Host 只接受 localhost 或 IP')
    if (req.method === 'GET' && path === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(PAGE)
      return
    }
    if (req.method === 'GET' && path === '/api/board') return sendJson(res, 200, board)
    if (req.method === 'GET' && path === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
      res.write(`event: board\ndata: ${JSON.stringify(board)}\n\n`)
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }
    if (req.method === 'POST' && (path === '/api/claim' || path === '/api/release')) {
      if (req.headers.origin !== undefined && !isSameOrigin(req.headers.origin, req.headers.host)) throw new HttpError(403, '不接受跨來源請求')
      const mediaType = (req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase()
      if (mediaType !== 'application/json') throw new HttpError(415, 'Content-Type 要是 application/json')
      const body = await readJson(req)
      const node = typeof body.node === 'string' ? body.node : ''
      const who = typeof body.who === 'string' ? body.who.trim() : ''
      if (!NAME.test(who)) throw new HttpError(400, '名字要 1–40 字，不能有引號或角括號')
      if (path === '/api/claim') {
        if (!Object.hasOwn(board.nodes, node)) throw new HttpError(400, `沒有節點 ${node || '（空白）'}`)
        const result = claims.claim(node, who)
        if (!result.ok) return sendJson(res, 409, { error: `${node} 已由 ${result.holder.who} 領取`, holder: result.holder })
        refreshClaims()
        return sendJson(res, 200, { node, claim: result.claim })
      }
      const result = claims.release(node, who, body.force === true)
      if (!result.ok) {
        const reason = result.holder ? `${node} 由 ${result.holder.who} 領取，只有他能放手（或加 force）` : `${node} 沒有人領取`
        return sendJson(res, result.holder ? 403 : 404, { error: reason, holder: result.holder })
      }
      refreshClaims()
      return sendJson(res, 200, { node })
    }
    throw new HttpError(404, '找不到')
  }

  const server: Server = createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message })
      console.error('[flow-board]', e)
      sendJson(res, 500, { error: '伺服器錯誤' })
    })
  })
  await new Promise<void>((done, fail) => {
    server.once('error', fail)
    server.listen(port, host, done)
  })
  const address = server.address() as AddressInfo
  const shownHost = host === '0.0.0.0' ? '127.0.0.1' : host

  return {
    url: `http://${shownHost}:${address.port}`,
    close: () => {
      clearInterval(poll)
      clearInterval(heartbeat)
      for (const res of clients) res.end()
      return new Promise((done) => server.close(() => done()))
    },
  }
}

function isSameOrigin(origin: string, host: string | undefined): boolean {
  let from: URL
  let self: URL
  try {
    from = new URL(origin)
    self = new URL(`http://${host}`)
  } catch {
    return false
  }
  return from.protocol === 'http:' && from.username === '' && from.password === '' && from.host === self.host
}

function isLocalOrIpHost(host: string | undefined): boolean {
  if (!host) return false
  let hostname: string
  try {
    hostname = new URL(`http://${host}`).hostname
  } catch {
    return false
  }
  return hostname === 'localhost' || isIP(hostname.replace(/^\[|\]$/g, '')) !== 0
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  if (res.headersSent) return void res.end()
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(data))
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) throw new HttpError(413, '內容太大')
    chunks.push(chunk as Buffer)
  }
  try {
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) return data as Record<string, unknown>
  } catch {
    // 落到下面的 400
  }
  throw new HttpError(400, '內容要是 JSON 物件')
}

function parseArgs(argv: string[]): BoardServerOptions {
  const value = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const port = Number(value('--port') ?? process.env.FLOW_BOARD_PORT ?? 4317)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`--port 不合法：${value('--port')}`)
  return { repo: resolve(value('--repo') ?? process.cwd()), port, host: value('--host') ?? '127.0.0.1' }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2))
  const server = await startBoardServer(options).catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  console.log(`Flow Board：${server.url}`)
  if (options.host === '0.0.0.0') console.log('已開放同網段連線，無登入機制')
  const stop = () => void server.close().then(() => process.exit(0))
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}
