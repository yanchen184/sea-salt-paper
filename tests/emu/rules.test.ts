import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import type { Room } from '../../src/firebase/types'
import { rulesEnv } from './client'

let env: RulesTestEnvironment

const lobbyRoom: Room = {
  code: 'ABCD',
  hostId: 'alice',
  status: 'lobby',
  players: [{ uid: 'alice', name: 'Alice' }],
  playerUids: ['alice'],
  kickedUids: [],
  game: null,
  version: 0,
  updatedAt: null,
}

const playingRoom: Room = {
  ...lobbyRoom,
  code: 'PLAY',
  status: 'playing',
  players: [
    { uid: 'alice', name: 'Alice' },
    { uid: 'bob', name: 'Bob' },
  ],
  playerUids: ['alice', 'bob'],
  version: 3,
}

function joinOf(room: Room, uid: string): Partial<Room> {
  const players = [...room.players, { uid, name: uid }]
  return { players, playerUids: players.map((p) => p.uid), version: room.version + 1 }
}

beforeAll(async () => {
  env = await rulesEnv()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'rooms', 'ABCD'), lobbyRoom)
    await setDoc(doc(ctx.firestore(), 'rooms', 'PLAY'), playingRoom)
    await setDoc(doc(ctx.firestore(), 'rooms', 'PLAY', 'presence', 'bob'), { lastSeen: Timestamp.fromMillis(0) })
  })
})

afterAll(() => env.cleanup())

describe('非成員', () => {
  const mallory = () => env.authenticatedContext('mallory').firestore()

  it('[S2-1] 非成員無法改寫進行中的房間', async () => {
    await assertFails(updateDoc(doc(mallory(), 'rooms', 'PLAY'), { version: 4 }))
    await assertFails(updateDoc(doc(mallory(), 'rooms', 'PLAY'), joinOf(playingRoom, 'mallory')))
  })

  it('[S2-1] 非成員在大廳只能把自己加進玩家列表', async () => {
    await assertFails(updateDoc(doc(mallory(), 'rooms', 'ABCD'), { hostId: 'mallory' }))
    await assertFails(updateDoc(doc(mallory(), 'rooms', 'ABCD'), joinOf(lobbyRoom, 'eve')))
    await assertFails(updateDoc(doc(mallory(), 'rooms', 'ABCD'), { ...joinOf(lobbyRoom, 'mallory'), hostId: 'mallory' }))
    await assertSucceeds(updateDoc(doc(mallory(), 'rooms', 'ABCD'), joinOf(lobbyRoom, 'mallory')))
  })

  it('[S2-1] 非成員無法刪除房間、無法讀寫 presence、無法讀進行中的房間', async () => {
    await assertFails(deleteDoc(doc(mallory(), 'rooms', 'ABCD')))
    await assertFails(getDoc(doc(mallory(), 'rooms', 'PLAY')))
    await assertFails(getDoc(doc(mallory(), 'rooms', 'PLAY', 'presence', 'bob')))
    await assertFails(setDoc(doc(mallory(), 'rooms', 'PLAY', 'presence', 'mallory'), { lastSeen: 1 }))
  })

  it('[S2-1] 不能以別人的身分建立房間，成員也不能寫別人的 presence', async () => {
    await assertFails(setDoc(doc(mallory(), 'rooms', 'NEWR'), { ...lobbyRoom, code: 'NEWR' }))
    const bob = env.authenticatedContext('bob').firestore()
    await assertFails(setDoc(doc(bob, 'rooms', 'PLAY', 'presence', 'alice'), { lastSeen: 1 }))
    await assertSucceeds(setDoc(doc(bob, 'rooms', 'PLAY', 'presence', 'bob'), { lastSeen: serverTimestamp() }))
  })

  it('[S2-1] 被踢出的玩家不能再寫入房間，也不能重新加入', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'rooms', 'ABCD'), { ...lobbyRoom, kickedUids: ['mallory'] }))
    await assertFails(updateDoc(doc(mallory(), 'rooms', 'ABCD'), joinOf(lobbyRoom, 'mallory')))
  })
})

describe('成員', () => {
  const alice = () => env.authenticatedContext('alice').firestore()
  const bob = () => env.authenticatedContext('bob').firestore()
  const room = (db: ReturnType<typeof alice>) => doc(db, 'rooms', 'PLAY')
  const next = { version: playingRoom.version + 1, updatedAt: serverTimestamp() }
  const kickBob = { ...next, players: [playingRoom.players[0]], playerUids: ['alice'], kickedUids: ['bob'] }

  it('[S2-3] version 只能 +1', async () => {
    await assertFails(updateDoc(room(bob()), { version: playingRoom.version }))
    await assertFails(updateDoc(room(bob()), { version: playingRoom.version + 5 }))
    await assertFails(updateDoc(room(bob()), { ...next, code: 'XXXX' }))
    await assertSucceeds(updateDoc(room(bob()), { ...next, game: null }))
  })

  it('[S2-3] 非房主不能改房主、踢人或移除別人', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'rooms', 'PLAY', 'presence', 'alice'), { lastSeen: Timestamp.now() }))
    await assertFails(updateDoc(room(bob()), { ...next, hostId: 'bob' }))
    await assertFails(updateDoc(room(bob()), { ...next, kickedUids: ['alice'], playerUids: ['bob'], players: [playingRoom.players[1]] }))
    await assertFails(updateDoc(room(bob()), { ...next, playerUids: ['bob'], players: [playingRoom.players[1]] }))
    await assertSucceeds(updateDoc(room(bob()), { ...next, playerUids: ['alice'], players: [playingRoom.players[0]] }))
  })

  it('[S2-3] 房主踢人時，目標的 presence 須已超過 45 秒（伺服器時間）', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'rooms', 'PLAY', 'presence', 'bob'), { lastSeen: Timestamp.fromMillis(Date.now() - 10_000) }),
    )
    await assertFails(updateDoc(room(alice()), kickBob))
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'rooms', 'PLAY', 'presence', 'bob'), { lastSeen: Timestamp.fromMillis(Date.now() - 60_000) }),
    )
    await assertFails(updateDoc(room(alice()), { ...kickBob, kickedUids: ['alice'] }))
    await assertSucceeds(updateDoc(room(alice()), kickBob))
  })

  it('[S2-3] presence 只能寫入伺服器時間', async () => {
    const mine = doc(bob(), 'rooms', 'PLAY', 'presence', 'bob')
    await assertFails(setDoc(mine, { lastSeen: Timestamp.fromMillis(Date.now() + 3_600_000) }))
    await assertFails(setDoc(mine, { lastSeen: serverTimestamp(), extra: 1 }))
    await assertSucceeds(setDoc(mine, { lastSeen: serverTimestamp() }))
  })
})

describe('未登入', () => {
  it('[S2-2] 未登入無法讀寫房間與 presence', async () => {
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(anon, 'rooms', 'ABCD')))
    await assertFails(setDoc(doc(anon, 'rooms', 'NEWR'), { ...lobbyRoom, code: 'NEWR' }))
    await assertFails(updateDoc(doc(anon, 'rooms', 'ABCD'), { version: 1 }))
    await assertFails(getDoc(doc(anon, 'rooms', 'PLAY', 'presence', 'bob')))
    await assertFails(setDoc(doc(anon, 'rooms', 'PLAY', 'presence', 'bob'), { lastSeen: 1 }))
  })
})

describe('AI 座位', () => {
  const ai = { uid: 'ai-1', name: 'AI 小蟹' }
  const alice = () => env.authenticatedContext('alice').firestore()
  const withAi = (room: Room, ...extra: Room['players']) => {
    const players = [...room.players, ...extra]
    return { players, playerUids: players.map((p) => p.uid), version: room.version + 1 }
  }

  it('[S6-5] 房主能在大廳加入、移除 AI 座位，也能同時開局', async () => {
    await assertFails(updateDoc(doc(alice(), 'rooms', 'ABCD'), withAi(lobbyRoom, { uid: 'eve', name: 'Eve' })))
    await assertSucceeds(updateDoc(doc(alice(), 'rooms', 'ABCD'), withAi(lobbyRoom, ai)))
    const withOne = { ...lobbyRoom, ...withAi(lobbyRoom, ai) }
    await assertSucceeds(updateDoc(doc(alice(), 'rooms', 'ABCD'), { players: lobbyRoom.players, playerUids: ['alice'], version: withOne.version + 1 }))
    await assertSucceeds(
      updateDoc(doc(alice(), 'rooms', 'ABCD'), { ...withAi({ ...lobbyRoom, version: withOne.version + 1 }, ai), status: 'playing' }),
    )
  })

  it('[S6-5] 非房主不能加入 AI，對局中也不能加入 AI', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'rooms', 'ABCD'), joinOf(lobbyRoom, 'bob')))
    const lobbyWithBob = { ...lobbyRoom, ...joinOf(lobbyRoom, 'bob') } as Room
    const bob = env.authenticatedContext('bob').firestore()
    await assertFails(updateDoc(doc(bob, 'rooms', 'ABCD'), withAi(lobbyWithBob, ai)))
    await assertFails(updateDoc(doc(alice(), 'rooms', 'PLAY'), withAi(playingRoom, ai)))
  })

  it('[S6-5] 真人不能用 AI 的 uid 加入或建立房間', async () => {
    const fake = env.authenticatedContext('ai-2').firestore()
    await assertFails(updateDoc(doc(fake, 'rooms', 'ABCD'), joinOf(lobbyRoom, 'ai-2')))
    const own = { ...lobbyRoom, code: 'NEWR', hostId: 'ai-2', players: [{ uid: 'ai-2', name: 'x' }], playerUids: ['ai-2'] }
    await assertFails(setDoc(doc(fake, 'rooms', 'NEWR'), own))
  })

  it('[S6-5] AI uid 只能是 ai-1～ai-3，座位名單必須和 uid 名單一致', async () => {
    await assertFails(updateDoc(doc(alice(), 'rooms', 'ABCD'), withAi(lobbyRoom, { uid: 'ai-evil', name: 'x' })))
    await assertFails(updateDoc(doc(alice(), 'rooms', 'ABCD'), withAi(lobbyRoom, { uid: 'ai-4', name: 'x' })))
    await assertFails(updateDoc(doc(alice(), 'rooms', 'ABCD'), { ...withAi(lobbyRoom, ai), players: [...lobbyRoom.players, { uid: 'eve', name: 'Eve' }] }))
    await assertFails(updateDoc(doc(alice(), 'rooms', 'ABCD'), { ...withAi(lobbyRoom, ai), players: lobbyRoom.players }))
    await assertFails(updateDoc(doc(alice(), 'rooms', 'ABCD'), withAi(lobbyRoom, ai, ai)))
  })

  it('[S6-5] 房主增減 AI 時不能重排、改名或替換真人座位', async () => {
    const bobSeat = { uid: 'bob', name: 'Bob' }
    const lobby = { ...lobbyRoom, players: [lobbyRoom.players[0], bobSeat, ai], playerUids: ['alice', 'bob', 'ai-1'] } as Room
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'rooms', 'ABCD'), lobby))
    const write = (players: Room['players']) =>
      updateDoc(doc(alice(), 'rooms', 'ABCD'), { players, playerUids: players.map((p) => p.uid), version: lobby.version + 1 })
    const [aliceSeat] = lobbyRoom.players as [Room['players'][number]]

    await assertFails(write([bobSeat, aliceSeat, ai]))
    await assertFails(write([aliceSeat, { uid: 'bob', name: '改名' }, ai]))
    await assertFails(write([aliceSeat, { uid: 'bob', name: '改名' }]))
    await assertFails(write([aliceSeat, { uid: 'eve', name: 'Eve' }, ai]))
    await assertFails(write([aliceSeat, ai]))
    await assertFails(write([aliceSeat, { uid: 'ai-2', name: 'AI 小魚' }, bobSeat, ai]))
    await assertSucceeds(write([aliceSeat, bobSeat, ai, { uid: 'ai-2', name: 'AI 小魚' }]))
  })

  it('[S6-5] 房主可以移除任一個 AI 座位，其餘座位不變', async () => {
    const ai2 = { uid: 'ai-2', name: 'AI 小魚' }
    const lobby = { ...lobbyRoom, players: [lobbyRoom.players[0], ai, ai2], playerUids: ['alice', 'ai-1', 'ai-2'] } as Room
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'rooms', 'ABCD'), lobby))
    const players = [lobbyRoom.players[0], ai2]
    await assertSucceeds(updateDoc(doc(alice(), 'rooms', 'ABCD'), { players, playerUids: ['alice', 'ai-2'], version: lobby.version + 1 }))
  })

  it('[S6-5] 成員不能改寫別人的座位資料', async () => {
    const bob = env.authenticatedContext('bob').firestore()
    const renamed = [playingRoom.players[0], { uid: 'bob', name: '改名' }]
    await assertFails(updateDoc(doc(bob, 'rooms', 'PLAY'), { players: [{ uid: 'alice', name: '壞人' }, playingRoom.players[1]], version: playingRoom.version + 1 }))
    await assertFails(updateDoc(doc(alice(), 'rooms', 'PLAY'), { players: renamed, version: playingRoom.version + 1 }))
  })

  it('[A6-1] 單人遊戲：可以直接建立自己加 1–3 個 AI、已開局的房間', async () => {
    const solo = (uid: string, ...ais: Room['players']) => {
      const players = [{ uid, name: uid }, ...ais]
      return { ...lobbyRoom, code: 'SOLO', hostId: uid, status: 'playing', players, playerUids: players.map((p) => p.uid), game: {}, version: 0 }
    }
    const ref = (db: ReturnType<typeof alice>) => doc(db, 'rooms', 'SOLO')
    await assertFails(setDoc(ref(alice()), solo('alice')))
    await assertFails(setDoc(ref(alice()), solo('alice', { uid: 'eve', name: 'Eve' })))
    await assertFails(setDoc(ref(alice()), solo('alice', { uid: 'ai-evil', name: 'x' })))
    await assertFails(setDoc(ref(alice()), { ...solo('alice', ai), game: null }))
    await assertFails(setDoc(ref(alice()), { ...solo('alice', ai), version: 1 }))
    await assertFails(setDoc(ref(alice()), { ...solo('alice', ai), hostId: 'ai-1' }))
    await assertFails(setDoc(ref(alice()), { ...solo('alice', ai), players: [ai, { uid: 'alice', name: 'alice' }] }))
    await assertSucceeds(setDoc(ref(alice()), solo('alice', ai, { uid: 'ai-2', name: 'AI 小魚' }, { uid: 'ai-3', name: 'AI 小鯊' })))

    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'rooms', 'SOLO'), { status: 'finished' }))
    const carol = env.authenticatedContext('carol').firestore()
    await assertSucceeds(setDoc(ref(carol), solo('carol', ai)))
  })

  describe('[S6-3] 房主接管', () => {
    const fresh = () => ({ lastSeen: Timestamp.now() })
    const stale = () => ({ lastSeen: Timestamp.fromMillis(Date.now() - 60_000) })
    const seatRoom = (code: string, uids: string[], hostId: string): Room => ({
      ...playingRoom,
      code,
      hostId,
      players: uids.map((uid) => ({ uid, name: uid })),
      playerUids: uids,
    })
    const setPresence = (code: string, seen: Record<string, { lastSeen: Timestamp }>) =>
      env.withSecurityRulesDisabled(async (ctx) => {
        for (const [uid, value] of Object.entries(seen)) await setDoc(doc(ctx.firestore(), 'rooms', code, 'presence', uid), value)
      })
    const claim = (uid: string, code: string, extra: Partial<Room> = {}) =>
      updateDoc(doc(env.authenticatedContext(uid).firestore(), 'rooms', code), {
        hostId: uid,
        version: playingRoom.version + 1,
        updatedAt: serverTimestamp(),
        ...extra,
      })

    beforeEach(async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'rooms', 'TAKE'), seatRoom('TAKE', ['alice', 'ai-1', 'bob', 'carol'], 'alice'))
        await setDoc(doc(ctx.firestore(), 'rooms', 'WRAP'), seatRoom('WRAP', ['bob', 'ai-1', 'alice'], 'alice'))
      })
    })

    it('房主在線時沒有人能接管', async () => {
      await setPresence('TAKE', { alice: fresh(), bob: fresh(), carol: fresh() })
      await assertFails(claim('bob', 'TAKE'))
    })

    it('房主離線後，只有從房主座位往後第一位在線真人能把房主改成自己', async () => {
      await setPresence('TAKE', { alice: stale(), bob: fresh(), carol: fresh() })
      await assertFails(claim('carol', 'TAKE'))
      await assertFails(claim('mallory', 'TAKE'))
      await assertFails(claim('bob', 'TAKE', { hostId: 'ai-1' }))
      await assertFails(claim('bob', 'TAKE', { status: 'finished' }))
      await assertSucceeds(claim('bob', 'TAKE'))
    })

    it('前面的真人離線時輪到下一位；呼叫者自己離線時被拒', async () => {
      await setPresence('TAKE', { alice: stale(), bob: stale(), carol: stale() })
      await assertFails(claim('carol', 'TAKE'))
      await setPresence('TAKE', { carol: fresh() })
      await assertSucceeds(claim('carol', 'TAKE'))
    })

    it('座位順序繞回開頭', async () => {
      await setPresence('WRAP', { alice: stale(), bob: fresh() })
      await assertSucceeds(claim('bob', 'WRAP'))
    })

    it('沒有 AI 的房間不能接管', async () => {
      await setPresence('PLAY', { alice: stale(), bob: fresh() })
      await assertFails(claim('bob', 'PLAY'))
    })
  })

  it('[A6-3] AI 座位不能被踢', async () => {
    const room = { ...playingRoom, code: 'SOLO', players: [playingRoom.players[0], ai], playerUids: ['alice', 'ai-1'] } as Room
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'rooms', 'SOLO'), room))
    const kick = { players: [room.players[0]], playerUids: ['alice'], kickedUids: ['ai-1'], version: room.version + 1 }
    await assertFails(updateDoc(doc(alice(), 'rooms', 'SOLO'), kick))
  })

  it('[A6-4] 只剩 AI 時最後一位真人可以刪除房間；還有其他真人時不行', async () => {
    const room = { ...playingRoom, code: 'SOLO', players: [playingRoom.players[0], ai], playerUids: ['alice', 'ai-1'] } as Room
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'rooms', 'SOLO'), room))
    await assertFails(deleteDoc(doc(alice(), 'rooms', 'PLAY')))
    await assertSucceeds(deleteDoc(doc(alice(), 'rooms', 'SOLO')))
  })
})
