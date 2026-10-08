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
