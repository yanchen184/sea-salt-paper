import { execFile, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { request } from 'node:http'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import type { Board } from './board'
import { ClaimStore, lockClaimsDir, removeStaleLock } from './claims'
import { layout, parseEdges, parseNodes } from './flow'
import { startBoardServer } from './server'
import { conditionStatus, gitFingerprint, parseFlowStatus, readFirstTestCommits, readNodeCommits } from './sources'

const FLOW_MD = readFileSync(join(import.meta.dirname, '../../docs/spec/01-flow.md'), 'utf8')
const temps: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'flow-board-'))
  temps.push(dir)
  return dir
}

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=tester', '-c', 'user.email=t@example.com', ...args], { cwd: repo, encoding: 'utf8' })
}

function gitAt(repo: string, date: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=tester', '-c', 'user.email=t@example.com', ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  })
}

function gitRepo(): string {
  const repo = tempDir()
  git(repo, 'init', '-q', '-b', 'main')
  return repo
}

function postWithHeaders(url: string, path: string, headers: Record<string, string>, body: unknown): Promise<number | undefined> {
  return new Promise((done, fail) => {
    const req = request(`${url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers } }, (res) => {
      res.resume()
      done(res.statusCode)
    })
    req.on('error', fail)
    req.end(JSON.stringify(body))
  })
}

function statusWithHost(url: string, host: string): Promise<number | undefined> {
  return new Promise((done, fail) => {
    const req = request(`${url}/api/board`, { headers: { host } }, (res) => {
      res.resume()
      done(res.statusCode)
    })
    req.on('error', fail)
    req.end()
  })
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('Flow Board', () => {
  it('[FB-1] 從 01-flow.md 讀出節點、條件與流程圖的邊', () => {
    const nodes = parseNodes(FLOW_MD)
    const g3a = nodes.find((n) => n.id === 'G3a')
    expect(nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['A1', 'A5', 'G0', 'G10', 'S1', 'S5']))
    expect(g3a?.title).toBe('抽牌庫')
    expect(g3a?.section).toBe('G · 遊戲引擎')
    expect(g3a?.conditions.map((c) => c.id)).toEqual(['G3a-1', 'G3a-2', 'G3a-3', 'G3a-4'])
    expect(g3a?.conditions[3]?.text).toBe('牌庫 0 張時不可選')

    const edges = parseEdges(FLOW_MD)
    expect(edges).toContainEqual(['A4', 'G1'])
    expect(edges).toContainEqual(['K', 'G10'])
    expect(edges).toContainEqual(['G10', 'G2'])
  })

  it('[FB-2] 主流程由左至右排欄，旁支貼在下游前一欄，流程圖外的節點另列', () => {
    const { columns, extras } = layout(parseNodes(FLOW_MD), parseEdges(FLOW_MD))
    const col = (id: string) => columns.findIndex((c) => c.includes(id))
    const chain = ['A1', 'A4', 'G1', 'G2', 'G3a', 'G4', 'G5', 'G7', 'G8', 'G9']
    for (let i = 1; i < chain.length; i++) expect(col(chain[i] as string)).toBeGreaterThan(col(chain[i - 1] as string))
    expect(col('A2')).toBe(col('A3'))
    expect(col('G10')).toBe(col('G2') - 1)
    expect(columns.every((c) => c.length > 0)).toBe(true)
    expect(extras).toEqual(['A5', 'G0', 'S1', 'S2', 'S3', 'S4', 'S5'])
  })

  it('[FB-3] 讀 flow-status.md，條件狀態分成通過、缺測試、失敗', () => {
    const statuses = parseFlowStatus(
      ['| 節點 | 狀態 | 已覆蓋 | 缺測試 | 失敗 |', '|---|---|---|---|---|', '| G1 開局 | ✅ | 3/3 | — | — |', '| G4 Duo 共通 | ❌ | 3/4 | G4-4 | G4-2 |'].join('\n'),
    )
    expect(statuses.get('G1')).toEqual({ icon: '✅', missing: [], failed: [] })
    expect(conditionStatus(statuses.get('G4'), 'G4-1')).toBe('passed')
    expect(conditionStatus(statuses.get('G4'), 'G4-2')).toBe('failed')
    expect(conditionStatus(statuses.get('G4'), 'G4-4')).toBe('missing')
    expect(conditionStatus(statuses.get('G9'), 'G9-1')).toBe('unknown')
  })

  it('[FB-4] 一個節點同時只能一人領取，只有領取者能放手，紀錄寫在檔案，失效的 server 鎖可接手（含 pid 被重用），失去鎖就不能寫', async () => {
    const file = join(tempDir(), '.flow-board/claims.json')
    let now = new Date('2026-10-08T00:00:00Z')
    const store = new ClaimStore(file, () => now)
    expect(store.claim('G4b', 'agent-1')).toEqual({ ok: true, claim: { who: 'agent-1', at: '2026-10-08T00:00:00.000Z' } })
    now = new Date('2026-10-08T01:00:00Z')
    expect(store.claim('G4b', 'agent-1')).toEqual({ ok: true, claim: { who: 'agent-1', at: '2026-10-08T00:00:00.000Z' } })
    expect(store.claim('G4b', 'agent-2')).toMatchObject({ ok: false, holder: { who: 'agent-1' } })
    expect(store.release('G4b', 'agent-2')).toMatchObject({ ok: false, holder: { who: 'agent-1' } })
    expect(new ClaimStore(file).list()).toEqual({ G4b: { who: 'agent-1', at: '2026-10-08T00:00:00.000Z' } })
    expect(store.release('G4b', 'agent-2', true)).toEqual({ ok: true })
    expect(store.release('G4b', 'agent-1')).toEqual({ ok: false, holder: null })
    expect(new ClaimStore(file).list()).toEqual({})

    const dir = join(tempDir(), '.flow-board')
    mkdirSync(dir)
    writeFileSync(join(dir, 'server.lock'), '999999999 dead')
    const lock = lockClaimsDir(dir)
    expect(() => lockClaimsDir(dir)).toThrow('已有 Flow Board server')
    const guarded = new ClaimStore(join(dir, 'claims.json'), undefined, lock.assertHeld)
    expect(guarded.claim('G1', 'agent-1').ok).toBe(true)
    writeFileSync(join(dir, 'server.lock'), `${process.pid} other`)
    expect(() => guarded.claim('G2', 'agent-1')).toThrow('已失去')
    lock.release()
    expect(readFileSync(join(dir, 'server.lock'), 'utf8')).toBe(`${process.pid} other`)

    const dead = '999999999 gone'
    const marker = `server.lock.takeover-${createHash('sha256').update(dead).digest('hex').slice(0, 16)}`
    const crashed = join(tempDir(), '.flow-board')
    mkdirSync(crashed)
    writeFileSync(join(crashed, 'server.lock'), dead)
    writeFileSync(join(crashed, marker), `${process.pid} busy`)
    expect(() => lockClaimsDir(crashed)).toThrow('正在接手')
    writeFileSync(join(crashed, marker), '999999999 crashed')
    lockClaimsDir(crashed).release()
    expect(readdirSync(crashed)).toEqual([])
    writeFileSync(join(crashed, 'server.lock'), `${process.pid} live`)
    removeStaleLock(join(crashed, 'server.lock'), dead)
    expect(readdirSync(crashed)).toEqual(['server.lock'])
    rmSync(join(crashed, 'server.lock'))

    const reused = join(tempDir(), '.flow-board')
    mkdirSync(reused)
    const reusedLock = join(reused, 'server.lock')
    writeFileSync(reusedLock, `${process.pid} reused`)
    expect(() => lockClaimsDir(reused)).toThrow('已有 Flow Board server')
    const longAgo = new Date(Date.now() - 60_000)
    utimesSync(reusedLock, longAgo, longAgo)
    const beating = lockClaimsDir(reused, 20)
    utimesSync(reusedLock, longAgo, longAgo)
    await new Promise((done) => setTimeout(done, 200))
    expect(Date.now() - statSync(reusedLock).mtimeMs).toBeLessThan(5_000)
    beating.release()

    const raced = join(tempDir(), '.flow-board')
    mkdirSync(raced)
    writeFileSync(join(raced, 'server.lock'), dead)
    const child = join(raced, '..', 'lock-child.mjs')
    writeFileSync(child, `import { lockClaimsDir } from ${JSON.stringify(new URL('./claims.ts', import.meta.url).href)}
try { const lock = lockClaimsDir(process.argv[2]); console.log('got'); setTimeout(lock.release, 4000) } catch (e) { console.log(e.message) }
`)
    const run = promisify(execFile)
    const outputs = await Promise.all([1, 2, 3, 4].map(() => run(process.execPath, ['--import', 'tsx', child, raced]).then((r) => r.stdout.trim())))
    expect(outputs.filter((o) => o === 'got')).toHaveLength(1)
  }, 30_000)

  it('[FB-5] 從 git 讀出 Flow-Node trailer 的 commit 與每條測試第一次加入的 commit（含根 commit 與 merge commit）', async () => {
    const repo = gitRepo()
    writeFileSync(join(repo, 'notes.md'), "測試會叫 it('[G4b-1] 額外回合')\n")
    writeFileSync(join(repo, 'game.ts'), "export const label = '[G4b-1]'\n")
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'docs: 不是測試')
    writeFileSync(join(repo, 'a.test.ts'), "it('[G4b-1] 額外回合', () => {})\n")
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'test: G4b-1', '-m', 'Flow-Node: G4b, G4c\nFlow-Agent: agent-2')
    writeFileSync(join(repo, 'a.test.ts'), "it('[G4b-1] 額外回合', () => {})\nit('[G4b-2] 只多 1 回合', () => {})\n")
    git(repo, 'commit', '-q', '-am', 'test: G4b-2')
    const [second, first] = git(repo, 'log', '--format=%H').trim().split('\n')
    git(repo, 'checkout', '-q', '-b', 'side')
    writeFileSync(join(repo, 'b.spec.ts'), "test.skip('[G4c-1][G4c-2] 牌庫頂入手', () => {})\n// it('[G4b-3] 尚未實作')\nconst s = \"it('[G4b-3]')\"\n")
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'test: G4c on a branch')
    const side = git(repo, 'rev-parse', 'HEAD').trim()
    writeFileSync(join(repo, 'b.spec.ts'), "test.skip('[G4c-1][G4c-2] 牌庫頂入手', () => {})\nit(\n  '[G4b-3] 換手',\n  () => {},\n)\ntest.concurrent.skip('[G4b-4] 連鎖', () => {})\ntest.each([1])('[G4b-5] 參數 %i', () => {})\nfoo.it('[G4b-6] 不是測試')\ntest.describe('[G4b-7] 套件', () => {})\ntest.beforeEach('[G4b-8]', () => {})\ntest.skipIf(false)('[G4b-9] 條件', () => {})\n")
    git(repo, 'commit', '-q', '-am', 'test: G4b-3 multi-line')
    const multiLine = git(repo, 'rev-parse', 'HEAD').trim()

    const before = await gitFingerprint(repo)
    git(repo, 'checkout', '-q', '--detach')
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'detached')
    expect(await gitFingerprint(repo)).not.toBe(before)

    const commits = await readNodeCommits(repo)
    expect(commits.get('G4b')).toEqual([expect.objectContaining({ sha: first, agent: 'agent-2', subject: 'test: G4b-1' })])
    expect(commits.get('G4c')?.[0]?.sha).toBe(first)
    const tests = await readFirstTestCommits(repo)
    expect(tests.get('G4b-1')?.sha).toBe(first)
    expect(tests.get('G4b-2')?.sha).toBe(second)
    expect(tests.get('G4c-1')?.sha).toBe(side)
    expect(tests.get('G4c-2')?.sha).toBe(side)
    expect(tests.get('G4b-3')?.sha).toBe(multiLine)
    expect(tests.get('G4b-4')?.sha).toBe(multiLine)
    expect(tests.get('G4b-5')?.sha).toBe(multiLine)
    expect(tests.has('G4b-6')).toBe(false)
    expect(tests.has('G4b-7')).toBe(false)
    expect(tests.has('G4b-8')).toBe(false)
    expect(tests.get('G4b-9')?.sha).toBe(multiLine)

    const rooted = gitRepo()
    git(rooted, 'config', 'log.showRoot', 'false')
    writeFileSync(join(rooted, 'r.test.ts'), "it('[R1-1] 第一個 commit 就有測試', () => {})\n")
    git(rooted, 'add', '.')
    git(rooted, 'commit', '-q', '-m', 'test: root')
    expect((await readFirstTestCommits(rooted)).get('R1-1')?.sha).toBe(git(rooted, 'rev-parse', 'HEAD').trim())

    const merged = gitRepo()
    const mergeFile = join(merged, 'm.test.ts')
    writeFileSync(mergeFile, "it('[M1-1] base', () => {})\n")
    git(merged, 'add', '.')
    git(merged, 'commit', '-q', '-m', 'base')
    git(merged, 'checkout', '-q', '-b', 'side')
    writeFileSync(mergeFile, "it('[M1-2] side', () => {})\n")
    git(merged, 'commit', '-q', '-am', 'side')
    const sideSha = git(merged, 'rev-parse', 'HEAD').trim()
    git(merged, 'checkout', '-q', 'main')
    writeFileSync(join(merged, 'other.ts'), 'export {}\n')
    git(merged, 'add', '.')
    git(merged, 'commit', '-q', '-m', 'main')
    git(merged, 'merge', '-q', '--no-ff', '--no-commit', '-s', 'ours', 'side')
    writeFileSync(mergeFile, "it('[M1-2] side', () => {})\nit('[M1-3] 解衝突時才加入', () => {})\n")
    git(merged, 'commit', '-q', '-am', 'merge')
    const mergeTests = await readFirstTestCommits(merged)
    expect(mergeTests.get('M1-2')?.sha).toBe(sideSha)
    expect(mergeTests.get('M1-3')?.sha).toBe(git(merged, 'rev-parse', 'HEAD').trim())

    const skewed = gitRepo()
    const skewedFile = join(skewed, 'k.test.ts')
    writeFileSync(skewedFile, "it('[K1-1] base', () => {})\n")
    git(skewed, 'add', '.')
    gitAt(skewed, '2020-01-01T00:00:00Z', 'commit', '-q', '-m', 'base')
    git(skewed, 'checkout', '-q', '-b', 'side')
    writeFileSync(skewedFile, "it('[K1-2] 時間比 merge 晚的 side commit', () => {})\n")
    gitAt(skewed, '2030-01-01T00:00:00Z', 'commit', '-q', '-am', 'side')
    const skewedSide = git(skewed, 'rev-parse', 'HEAD').trim()
    git(skewed, 'checkout', '-q', 'main')
    writeFileSync(join(skewed, 'other.ts'), 'export {}\n')
    git(skewed, 'add', '.')
    gitAt(skewed, '2020-01-02T00:00:00Z', 'commit', '-q', '-m', 'main')
    git(skewed, 'merge', '-q', '--no-ff', '--no-commit', '-s', 'ours', 'side')
    writeFileSync(skewedFile, "it('[K1-2] 時間比 merge 晚的 side commit', () => {})\n")
    gitAt(skewed, '2020-01-03T00:00:00Z', 'commit', '-q', '-am', 'merge')
    expect((await readFirstTestCommits(skewed)).get('K1-2')?.sha).toBe(skewedSide)

    const pruned = gitRepo()
    const prunedFile = join(pruned, 'p.test.ts')
    writeFileSync(prunedFile, "it('[P1-1] base', () => {})\n")
    git(pruned, 'add', '.')
    git(pruned, 'commit', '-q', '-m', 'base')
    git(pruned, 'checkout', '-q', '-b', 'side')
    writeFileSync(join(pruned, 'side.ts'), 'export {}\n')
    git(pruned, 'add', '.')
    git(pruned, 'commit', '-q', '-m', 'side')
    git(pruned, 'checkout', '-q', 'main')
    writeFileSync(prunedFile, "it('[P1-1] base', () => {})\nit('[P1-2] 被 merge 拿掉後又加回', () => {})\n")
    git(pruned, 'commit', '-q', '-am', 'main')
    const firstAdded = git(pruned, 'rev-parse', 'HEAD').trim()
    git(pruned, 'merge', '-q', '--no-ff', '--no-commit', '-s', 'ours', 'side')
    writeFileSync(prunedFile, "it('[P1-1] base', () => {})\n")
    git(pruned, 'commit', '-q', '-am', 'merge')
    writeFileSync(prunedFile, "it('[P1-1] base', () => {})\nit('[P1-2] 被 merge 拿掉後又加回', () => {})\n")
    git(pruned, 'commit', '-q', '-am', 're-add')
    expect((await readFirstTestCommits(pruned)).get('P1-2')?.sha).toBe(firstAdded)
  })

  it('[FB-6] HTTP 領取成功 200、重複領取 409，SSE 即時推送新的領取，拒絕跨來源寫入，已刪節點可放手，同一 repo 只能開一個 server', async () => {
    const repo = gitRepo()
    mkdirSync(join(repo, 'docs/spec'), { recursive: true })
    copyFileSync(join(import.meta.dirname, '../../docs/spec/01-flow.md'), join(repo, 'docs/spec/01-flow.md'))
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'spec')
    mkdirSync(join(repo, '.flow-board'))
    writeFileSync(join(repo, '.flow-board/claims.json'), JSON.stringify({ Z9: { who: 'agent-9', at: '2026-10-01T00:00:00.000Z' } }))
    const server = await startBoardServer({ repo, port: 0, host: '127.0.0.1', pollMs: 60_000 })
    await expect(startBoardServer({ repo, port: 0, host: '127.0.0.1', pollMs: 60_000 })).rejects.toThrow('已有 Flow Board server')
    const abort = new AbortController()
    try {
      const events = await fetch(`${server.url}/api/events`, { signal: abort.signal })
      const reader = (events.body as ReadableStream<Uint8Array>).getReader()
      const decoder = new TextDecoder()
      const nextBoard = async (): Promise<Board> => {
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) throw new Error('SSE 已關閉')
          buffer += decoder.decode(value, { stream: true })
          const match = buffer.match(/event: board\ndata: (.*)\n\n/)
          if (match?.[1]) return JSON.parse(match[1]) as Board
        }
      }
      expect(Object.keys((await nextBoard()).claims)).toEqual(['Z9'])
      const board = (await (await fetch(`${server.url}/api/board`)).json()) as Board
      expect(board.columns[0]).toEqual(['A1'])
      expect(board.nodes.G4b?.conditions.map((c) => c.id)).toEqual(['G4b-1', 'G4b-2', 'G4b-3'])

      const post = (path: string, body: unknown) =>
        fetch(`${server.url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      expect((await post('/api/claim', { node: 'G4b', who: 'agent-1' })).status).toBe(200)
      expect((await nextBoard()).claims.G4b?.who).toBe('agent-1')
      expect((await post('/api/claim', { node: 'G4b', who: 'agent-2' })).status).toBe(409)
      expect((await post('/api/claim', { node: 'NOPE', who: 'agent-2' })).status).toBe(400)
      expect((await post('/api/claim', { node: 'G4c', who: '<b>' })).status).toBe(400)
      const plain = await fetch(`${server.url}/api/claim`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ node: 'G4c', who: 'x' }) })
      expect(plain.status).toBe(415)
      const jsonp = await fetch(`${server.url}/api/claim`, { method: 'POST', headers: { 'content-type': 'application/jsonp' }, body: JSON.stringify({ node: 'G4c', who: 'x' }) })
      expect(jsonp.status).toBe(415)
      const charset = await fetch(`${server.url}/api/claim`, { method: 'POST', headers: { 'content-type': 'Application/JSON; charset=utf-8' }, body: JSON.stringify({ node: 'NOPE', who: 'x' }) })
      expect(charset.status).toBe(400)
      const crossSite = await fetch(`${server.url}/api/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://evil.example' },
        body: JSON.stringify({ node: 'G4c', who: 'x' }),
      })
      expect(crossSite.status).toBe(403)
      expect(await statusWithHost(server.url, 'evil.example:4317')).toBe(403)
      const port = new URL(server.url).port
      const fromOrigin = (origin: string) =>
        postWithHeaders(server.url, '/api/claim', { host: `LOCALHOST:${port}`, origin }, { node: 'NOPE', who: 'x' })
      expect(await fromOrigin(`http://localhost:${port}`)).toBe(400)
      expect(await fromOrigin(`HTTP://LocalHost:${port}`)).toBe(400)
      expect(await fromOrigin(`https://localhost:${port}`)).toBe(403)
      expect(await fromOrigin(`http://user@localhost:${port}`)).toBe(403)
      expect(await fromOrigin('null')).toBe(403)
      for (const node of ['toString', '__proto__', 'constructor']) {
        expect((await post('/api/claim', { node, who: 'agent-2' })).status).toBe(400)
        expect((await post('/api/release', { node, who: 'agent-2', force: true })).status).toBe(404)
      }
      expect((await post('/api/release', { node: 'G4b', who: 'agent-2' })).status).toBe(403)
      expect((await post('/api/release', { node: 'G4b', who: 'agent-1' })).status).toBe(200)
      expect(Object.keys((await nextBoard()).claims)).toEqual(['Z9'])
      expect((await post('/api/release', { node: 'Z9', who: 'boss', force: true })).status).toBe(200)
      expect((await nextBoard()).claims).toEqual({})
      expect((await fetch(server.url)).headers.get('content-type')).toContain('text/html')
    } finally {
      abort.abort()
      await server.close()
    }
    const again = await startBoardServer({ repo, port: 0, host: '127.0.0.1', pollMs: 60_000 })
    await again.close()
  })
})
