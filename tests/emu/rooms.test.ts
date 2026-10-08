import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { applyAction } from '../../src/engine'
import { RoomError, type Room } from '../../src/firebase/types'
import { closeClients, newClient, rulesEnv, sameUserClient, type TestClient } from './client'

const nextCodes = vi.hoisted(() => [] as string[])

vi.mock('../../src/lib/roomCode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/roomCode')>()
  return { ...actual, generateRoomCode: () => nextCodes.shift() ?? actual.generateRoomCode() }
})

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await rulesEnv()
})

beforeEach(async () => {
  nextCodes.length = 0
  await env.clearFirestore()
})

afterEach(closeClients)

afterAll(() => env.cleanup())

async function readRoom(client: TestClient, code: string): Promise<Room> {
  const room = (await getDoc(doc(client.db, 'rooms', code))).data() as Room | undefined
  if (!room) throw new Error(`房間 ${code} 不存在`)
  return room
}

async function errorCode(task: Promise<unknown>): Promise<string> {
  try {
    await task
  } catch (e) {
    if (e instanceof RoomError) return e.code
    throw e
  }
  throw new Error('預期失敗但成功了')
}

/** 建立房間、其餘人加入；回傳房號 */
async function lobby(host: TestClient, ...guests: TestClient[]): Promise<string> {
  const code = await host.rooms.createRoom({ uid: host.uid, name: 'Host' })
  for (const [i, g] of guests.entries()) await g.rooms.joinRoom(code, { uid: g.uid, name: `P${i + 2}` })
  return code
}

async function playing(host: TestClient, ...guests: TestClient[]): Promise<string> {
  const code = await lobby(host, ...guests)
  await host.rooms.startGame(code, host.uid)
  return code
}

function currentClient(room: Room, clients: TestClient[]): TestClient {
  const game = room.game
  if (!game) throw new Error('沒有對局')
  const id = game.players[game.current]?.id
  const client = clients.find((c) => c.uid === id)
  if (!client) throw new Error('找不到當前玩家')
  return client
}

describe('建立與加入', () => {
  it('[A2-2] 房號與進行中的房間重複時改用其他房號，已結束的房號可以重用', async () => {
    const [a, b, c] = await Promise.all([newClient(), newClient(), newClient()])
    nextCodes.push('AAAA')
    const busy = await playing(a, b)
    expect(busy).toBe('AAAA')

    nextCodes.push('AAAA', 'BBBB')
    expect(await c.rooms.createRoom({ uid: c.uid, name: 'C' })).toBe('BBBB')
    expect((await readRoom(a, 'AAAA')).status).toBe('playing')

    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'rooms', 'AAAA'), { status: 'finished' }, { merge: true }))
    nextCodes.push('AAAA')
    expect(await c.rooms.createRoom({ uid: c.uid, name: 'C' })).toBe('AAAA')
    const reused = await readRoom(c, 'AAAA')
    expect(reused).toMatchObject({ hostId: c.uid, status: 'lobby', playerUids: [c.uid], game: null, version: 0 })
  })

  it('[A3-2] 房間不存在、已滿 4 人、已開始各自回傳不同錯誤碼', async () => {
    const clients = await Promise.all(Array.from({ length: 6 }, () => newClient()))
    const [host, p2, p3, p4, late, outsider] = clients as [TestClient, TestClient, TestClient, TestClient, TestClient, TestClient]

    expect(await errorCode(late.rooms.joinRoom('ZZZZ', { uid: late.uid, name: 'L' }))).toBe('ROOM_NOT_FOUND')

    const full = await lobby(host, p2, p3, p4)
    expect(await errorCode(late.rooms.joinRoom(full, { uid: late.uid, name: 'L' }))).toBe('ROOM_FULL')

    await host.rooms.startGame(full, host.uid)
    expect(await errorCode(outsider.rooms.joinRoom(full, { uid: outsider.uid, name: 'O' }))).toBe('ROOM_STARTED')
  })

  it('[A5-1] 已在房內的玩家再次加入視為成功，座位不變', async () => {
    const [a, b] = await Promise.all([newClient(), newClient()])
    const code = await playing(a, b)
    const before = await readRoom(b, code)
    await b.rooms.joinRoom(code, { uid: b.uid, name: 'P2' })
    const after = await readRoom(b, code)
    expect(after.playerUids).toEqual(before.playerUids)
    expect(after.version).toBe(before.version)
  })
})

describe('動作同步', () => {
  it('[S1-1] 動作在 transaction 內套用引擎並寫回，version + 1', async () => {
    const [a, b] = await Promise.all([newClient(), newClient()])
    const code = await playing(a, b)
    const before = await readRoom(a, code)
    const actor = currentClient(before, [a, b])
    if (!before.game) throw new Error('沒有對局')

    await actor.rooms.sendAction(code, actor.uid, { type: 'DRAW_DECK' }, before.version)

    const after = await readRoom(a, code)
    const expected = applyAction(before.game, actor.uid, { type: 'DRAW_DECK' })
    if (!expected.ok) throw new Error(expected.error.message)
    expect(after.game).toEqual(expected.state)
    expect(after.version).toBe(before.version + 1)
  })

  it('[S1-1] 引擎拒絕的動作不寫入，錯誤回給呼叫端', async () => {
    const [a, b] = await Promise.all([newClient(), newClient()])
    const code = await playing(a, b)
    const before = await readRoom(a, code)
    const actor = currentClient(before, [a, b])
    const waiting = actor === a ? b : a

    expect(await errorCode(waiting.rooms.sendAction(code, waiting.uid, { type: 'DRAW_DECK' }, before.version))).toBe('NOT_YOUR_TURN')
    expect(await readRoom(a, code)).toEqual(before)
  })

  it('[S1-2] 兩個 client 以同一個 version 同時送動作，只有一個成功，另一個收到 STALE_VERSION', async () => {
    const [a, b] = await Promise.all([newClient(), newClient()])
    const code = await playing(a, b)
    const before = await readRoom(a, code)
    const actor = currentClient(before, [a, b])
    const twin = await sameUserClient(actor)

    const results = await Promise.allSettled([
      actor.rooms.sendAction(code, actor.uid, { type: 'DRAW_DECK' }, before.version),
      twin.rooms.sendAction(code, twin.uid, { type: 'DRAW_DECK' }, before.version),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.reason).toBeInstanceOf(RoomError)
    expect((rejected[0]?.reason as RoomError).code).toBe('STALE_VERSION')
    expect((await readRoom(a, code)).version).toBe(before.version + 1)
  })
})

describe('踢出離線玩家', () => {
  it('[A5-2] 非房主踢人被拒', async () => {
    const [host, b, c] = await Promise.all([newClient(), newClient(), newClient()])
    const code = await playing(host, b, c)
    expect(await errorCode(b.rooms.kickPlayer(code, b.uid, c.uid))).toBe('NOT_HOST')
  })

  it('[A5-2] 對方在線時踢人被拒', async () => {
    const [host, b, c] = await Promise.all([newClient(), newClient(), newClient()])
    const code = await playing(host, b, c)
    await setDoc(doc(c.db, 'rooms', code, 'presence', c.uid), { lastSeen: serverTimestamp() })
    expect(await errorCode(host.rooms.kickPlayer(code, host.uid, c.uid))).toBe('TARGET_ONLINE')
  })

  it('[A5-2] 離線玩家被踢出：players 少 1、game 經過 removePlayer、被踢者不能再寫入或重新加入', async () => {
    const [host, b, c] = await Promise.all([newClient(), newClient(), newClient()])
    const code = await playing(host, b, c)
    const before = await readRoom(host, code)

    await host.rooms.kickPlayer(code, host.uid, c.uid)

    const after = await readRoom(host, code)
    expect(after.playerUids).toEqual(before.playerUids.filter((u) => u !== c.uid))
    expect(after.kickedUids).toEqual([c.uid])
    expect(after.status).toBe('playing')
    expect(after.game?.players.map((p) => p.id)).toEqual(after.playerUids)
    expect(after.game?.kicked.map((p) => p.id)).toEqual([c.uid])
    expect(after.version).toBe(before.version + 1)

    expect(await errorCode(c.rooms.joinRoom(code, { uid: c.uid, name: 'C' }))).toBe('KICKED')
    await expect(setDoc(doc(c.db, 'rooms', code, 'presence', c.uid), { lastSeen: serverTimestamp() })).rejects.toThrow()
  })

  it('[A5-2] 兩人局踢掉一人，剩下的玩家獲勝、房間結束', async () => {
    const [host, b] = await Promise.all([newClient(), newClient()])
    const code = await playing(host, b)
    await host.rooms.kickPlayer(code, host.uid, b.uid)
    const after = await readRoom(host, code)
    expect(after.status).toBe('finished')
    expect(after.game?.status).toBe('gameOver')
  })
})
