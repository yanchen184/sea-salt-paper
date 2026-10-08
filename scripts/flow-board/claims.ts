import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface Claim {
  who: string
  at: string
}

export type ClaimResult = { ok: true; claim: Claim } | { ok: false; holder: Claim }
export type ReleaseResult = { ok: true } | { ok: false; holder: Claim | null }

export class ClaimStore {
  private claims: Readonly<Record<string, Claim>>

  constructor(
    private readonly file: string,
    private readonly now: () => Date = () => new Date(),
    private readonly assertWritable: () => void = () => {},
  ) {
    this.claims = load(file)
  }

  list(): Readonly<Record<string, Claim>> {
    return this.claims
  }

  claim(node: string, who: string): ClaimResult {
    const held = this.held(node)
    if (held && held.who !== who) return { ok: false, holder: held }
    const claim = held ?? { who, at: this.now().toISOString() }
    this.save({ ...this.claims, [node]: claim })
    return { ok: true, claim }
  }

  release(node: string, who: string, force = false): ReleaseResult {
    const held = this.held(node)
    if (!held || (held.who !== who && !force)) return { ok: false, holder: held ?? null }
    this.save(Object.fromEntries(Object.entries(this.claims).filter(([id]) => id !== node)))
    return { ok: true }
  }

  private held(node: string): Claim | undefined {
    return Object.hasOwn(this.claims, node) ? this.claims[node] : undefined
  }

  private save(next: Record<string, Claim>): void {
    this.assertWritable()
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`)
    renameSync(tmp, this.file)
    this.claims = next
  }
}

export interface ClaimsLock {
  /** 鎖檔內容已不是自己的 token 時丟出錯誤 */
  assertHeld: () => void
  release: () => void
}

/** 持有者 pid 存在且鎖檔在這段時間內更新過，才算鎖仍有效 */
const STALE_MS = 30_000

/** 一個目錄只允許一個 server 持有領取紀錄；鎖檔內容為 `<pid> <token>`，持有期間每 `heartbeatMs` 更新鎖檔時間 */
export function lockClaimsDir(dir: string, heartbeatMs = 5_000): ClaimsLock {
  const file = join(dir, 'server.lock')
  const mine = `${process.pid} ${randomUUID()}`
  mkdirSync(dir, { recursive: true })
  for (let attempt = 0; attempt < 5; attempt++) {
    if (createExclusive(file, mine)) {
      const heartbeat = setInterval(() => {
        if (readText(file) === mine) touch(file)
      }, heartbeatMs)
      heartbeat.unref()
      return {
        assertHeld: () => {
          if (readText(file) !== mine) throw new Error(`已失去 ${file}，請重開 Flow Board server`)
        },
        release: () => {
          clearInterval(heartbeat)
          if (readText(file) === mine) rmSync(file, { force: true })
        },
      }
    }
    const seen = readText(file)
    if (seen === null) continue
    if (holderAlive(file, seen)) throw new Error(`已有 Flow Board server（pid ${pidOf(seen)}）使用 ${dir}`)
    removeStaleLock(file, seen)
  }
  throw new Error(`無法取得 ${file}`)
}

/**
 * 只有建立 `<file>.takeover-<內容雜湊>` 成功的程序能刪掉這份內容的失效鎖，刪除前再確認鎖檔內容未變；
 * 接手標記的持有者已結束時，用同樣方式清除標記
 */
export function removeStaleLock(file: string, seen: string): void {
  const marker = `${file}.takeover-${createHash('sha256').update(seen).digest('hex').slice(0, 16)}`
  const mine = `${process.pid} ${randomUUID()}`
  if (!createExclusive(marker, mine)) {
    const other = readText(marker)
    if (other === null) return
    if (holderAlive(marker, other)) throw new Error(`Flow Board server（pid ${pidOf(other)}）正在接手 ${file}，請稍後再試`)
    removeStaleLock(marker, other)
    return
  }
  try {
    if (readText(file) === seen) rmSync(file, { force: true })
  } finally {
    if (readText(marker) === mine) rmSync(marker, { force: true })
  }
}

function pidOf(content: string): number {
  return Number(content.split(' ')[0])
}

function holderAlive(file: string, content: string): boolean {
  if (!isAlive(pidOf(content))) return false
  try {
    return Date.now() - statSync(file).mtimeMs < STALE_MS
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw e
  }
}

function touch(file: string): void {
  const now = new Date()
  try {
    utimesSync(file, now, now)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
}

function createExclusive(file: string, content: string): boolean {
  try {
    writeFileSync(file, content, { flag: 'wx' })
    return true
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw e
  }
}

function readText(file: string): string | null {
  try {
    return readFileSync(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

function isAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function load(file: string): Record<string, Claim> {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw e
  }
  const data: unknown = JSON.parse(text)
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error(`${file} 格式錯誤：應為物件`)
  return Object.fromEntries(
    Object.entries(data).filter(
      (entry): entry is [string, Claim] =>
        typeof entry[1] === 'object' && entry[1] !== null && typeof entry[1].who === 'string' && typeof entry[1].at === 'string',
    ),
  )
}
