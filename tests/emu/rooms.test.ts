import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { applyAction, chooseAiAction } from '../../src/engine'
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

describe('局間', () => {
  it('[S3-4] 只有房主能開始下一局', async () => {
    const [host, b] = await Promise.all([newClient(), newClient()])
    const code = await playing(host, b)
    await env.withSecurityRulesDisabled(async (ctx) => {
      const room = (await getDoc(doc(ctx.firestore(), 'rooms', code))).data() as Room
      if (!room.game) throw new Error('沒有對局')
      await updateDoc(doc(ctx.firestore(), 'rooms', code), {
        game: { ...room.game, status: 'roundEnd', roundResult: { reason: 'void', declarerId: null, declarerWon: null, scores: [], nextStarter: 0 } },
      })
    })
    const version = (await readRoom(host, code)).version
    expect(await errorCode(b.rooms.sendAction(code, b.uid, { type: 'NEXT_ROUND' }, version))).toBe('NOT_HOST')
    await host.rooms.sendAction(code, host.uid, { type: 'NEXT_ROUND' }, version)
    expect((await readRoom(host, code)).game?.status).toBe('playing')
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

describe('AI 座位', () => {
  it('[A6-1] 單人遊戲：建立房間後直接和 AI 開局，不經過大廳', async () => {
    const host = await newClient()
    const code = await host.rooms.createSoloGame({ uid: host.uid, name: 'Host' }, 3)
    const room = await readRoom(host, code)
    expect(room.status).toBe('playing')
    expect(room.version).toBe(0)
    expect(room.players.map((p) => p.name)).toEqual(['Host', 'AI 小蟹', 'AI 小魚', 'AI 小鯊'])
    expect(room.game?.players.map((p) => p.id)).toEqual(room.playerUids)
    expect(await errorCode(host.rooms.createSoloGame({ uid: host.uid, name: 'Host' }, 0))).toBe('BAD_PLAYER_COUNT')
    expect(await errorCode(host.rooms.createSoloGame({ uid: host.uid, name: 'Host' }, 4))).toBe('BAD_PLAYER_COUNT')
  })

  it('[A6-2] 大廳中只有房主能加入、移除 AI，合計最多 4 人，可以和 AI 開局', async () => {
    const [host, b] = await Promise.all([newClient(), newClient()])
    const code = await lobby(host, b)
    expect(await errorCode(b.rooms.addAi(code, b.uid))).toBe('NOT_HOST')
    await host.rooms.addAi(code, host.uid)
    await host.rooms.addAi(code, host.uid)
    expect(await errorCode(host.rooms.addAi(code, host.uid))).toBe('ROOM_FULL')
    expect((await readRoom(host, code)).playerUids).toEqual([host.uid, b.uid, 'ai-1', 'ai-2'])

    expect(await errorCode(b.rooms.removeAi(code, b.uid, 'ai-1'))).toBe('NOT_HOST')
    await host.rooms.removeAi(code, host.uid, 'ai-1')
    expect(await errorCode(host.rooms.removeAi(code, host.uid, b.uid))).toBe('NOT_MEMBER')
    await host.rooms.startGame(code, host.uid)
    const room = await readRoom(host, code)
    expect(room.game?.players.map((p) => p.id)).toEqual([host.uid, b.uid, 'ai-2'])
    expect(await errorCode(host.rooms.addAi(code, host.uid))).toBe('NOT_LOBBY')
  })

  it('[A6-3] AI 座位不能被踢', async () => {
    const host = await newClient()
    const code = await host.rooms.createSoloGame({ uid: host.uid, name: 'Host' }, 1)
    expect(await errorCode(host.rooms.kickPlayer(code, host.uid, 'ai-1'))).toBe('KICK_AI')
  })

  it('[A6-4] 最後一位真人離開時房間關閉；還有其他真人時照舊不能中途離開', async () => {
    const host = await newClient()
    const solo = await host.rooms.createSoloGame({ uid: host.uid, name: 'Host' }, 2)
    await host.rooms.leaveRoom(solo, host.uid)
    expect((await getDoc(doc(host.db, 'rooms', solo))).exists()).toBe(false)

    const b = await newClient()
    const mixed = await lobby(host, b)
    await host.rooms.addAi(mixed, host.uid)
    await host.rooms.startGame(mixed, host.uid)
    expect(await errorCode(host.rooms.leaveRoom(mixed, host.uid))).toBe('GAME_IN_PROGRESS')
  })

  it('[A6-4] 大廳房主離開時，房主交給下一位真人而不是 AI', async () => {
    const [host, b] = await Promise.all([newClient(), newClient()])
    const code = await host.rooms.createRoom({ uid: host.uid, name: 'Host' })
    await host.rooms.addAi(code, host.uid)
    await b.rooms.joinRoom(code, { uid: b.uid, name: 'B' })
    await host.rooms.leaveRoom(code, host.uid)
    const room = await readRoom(b, code)
    expect(room.hostId).toBe(b.uid)
    expect(room.playerUids).toEqual(['ai-1', b.uid])
  })

  it('[S6-1] 房主替 AI 出手走同一個 transaction，非房主被拒；單人對 AI 能打完整場', async () => {
    const [host, other] = await Promise.all([newClient(), newClient()])
    const mixed = await lobby(host, other)
    await host.rooms.addAi(mixed, host.uid)
    await host.rooms.startGame(mixed, host.uid)
    expect(await errorCode(other.rooms.playAiTurn(mixed, other.uid, (await readRoom(other, mixed)).version))).toBe('NOT_HOST')

    const code = await host.rooms.createSoloGame({ uid: host.uid, name: 'Host' }, 1)

    for (let step = 0; step < 2000; step++) {
      const room = await readRoom(host, code)
      const game = room.game
      if (!game || room.status === 'finished') break
      if (game.status === 'roundEnd') {
        await host.rooms.sendAction(code, host.uid, { type: 'NEXT_ROUND' }, room.version)
        continue
      }
      if (game.players[game.current]?.id === 'ai-1') {
        await host.rooms.playAiTurn(code, host.uid, room.version)
      } else {
        const action = chooseAiAction(game, host.uid)
        if (!action) throw new Error('真人沒有可做的動作')
        await host.rooms.sendAction(code, host.uid, action, room.version)
      }
      expect((await readRoom(host, code)).version).toBe(room.version + 1)
    }
    const final = await readRoom(host, code)
    expect(final.status).toBe('finished')
    expect(final.game?.winnerId).not.toBeNull()
  }, 120_000)

  it('[S6-3] 房主離線超過 45 秒時，下一位在線真人接手房主並替 AI 出手；房主在線、非第一順位、沒有 AI 時被拒', async () => {
    const [host, b, c] = await Promise.all([newClient(), newClient(), newClient()])
    const code = await lobby(host, b, c)
    await host.rooms.addAi(code, host.uid)
    await host.rooms.startGame(code, host.uid)
    for (const client of [host, b, c])
      await setDoc(doc(client.db, 'rooms', code, 'presence', client.uid), { lastSeen: serverTimestamp() })
    expect(await errorCode(b.rooms.claimHost(code, b.uid))).toBe('CANNOT_CLAIM_HOST')

    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'rooms', code, 'presence', host.uid), { lastSeen: Timestamp.fromMillis(0) }),
    )
    expect(await errorCode(c.rooms.claimHost(code, c.uid))).toBe('CANNOT_CLAIM_HOST')

    const humansOnly = await playing(host, b)
    await setDoc(doc(b.db, 'rooms', humansOnly, 'presence', b.uid), { lastSeen: serverTimestamp() })
    expect(await errorCode(b.rooms.claimHost(humansOnly, b.uid))).toBe('CANNOT_CLAIM_HOST')

    const before = await readRoom(b, code)
    await b.rooms.claimHost(code, b.uid)
    const after = await readRoom(b, code)
    expect(after.hostId).toBe(b.uid)
    expect(after.version).toBe(before.version + 1)
    expect(after.game).toEqual(before.game)

    let room = after
    while (room.game?.players[room.game.current]?.id !== 'ai-1') {
      const current = currentClient(room, [host, b, c])
      const action = room.game ? chooseAiAction(room.game, current.uid) : null
      if (!action) throw new Error('沒有可做的動作')
      await current.rooms.sendAction(code, current.uid, action, room.version)
      room = await readRoom(b, code)
    }
    expect(await errorCode(host.rooms.playAiTurn(code, host.uid, room.version))).toBe('NOT_HOST')
    await b.rooms.playAiTurn(code, b.uid, room.version)
    expect((await readRoom(b, code)).version).toBe(room.version + 1)
  })

  it('[S6-2] version 已變或不是 AI 的回合時不寫入', async () => {
    const host = await newClient()
    const code = await host.rooms.createSoloGame({ uid: host.uid, name: 'Host' }, 1)
    let room = await readRoom(host, code)
    while (room.game?.players[room.game.current]?.id !== host.uid) {
      await host.rooms.playAiTurn(code, host.uid, room.version)
      room = await readRoom(host, code)
    }
    await host.rooms.playAiTurn(code, host.uid, room.version)
    expect(await readRoom(host, code)).toEqual(room)
    await host.rooms.playAiTurn(code, host.uid, room.version - 1)
    expect(await readRoom(host, code)).toEqual(room)
  })
})
