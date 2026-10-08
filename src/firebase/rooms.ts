import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'
import { applyAction, createGame, removePlayer, type Action, type GameState } from '../engine'
import { isOffline } from '../lib/presence'
import { generateRoomCode, randomSeed } from '../lib/roomCode'
import { RoomError, type Room, type RoomPlayer } from './types'

const MAX_PLAYERS = 4
const MIN_PLAYERS = 2
const CREATE_ATTEMPTS = 10

export interface RoomRepository {
  createRoom(host: RoomPlayer): Promise<string>
  joinRoom(code: string, player: RoomPlayer): Promise<void>
  leaveRoom(code: string, uid: string): Promise<void>
  startGame(code: string, uid: string): Promise<void>
  sendAction(code: string, uid: string, action: Action, expectedVersion: number): Promise<void>
  kickPlayer(code: string, hostUid: string, targetUid: string): Promise<void>
  restartGame(code: string, hostUid: string): Promise<void>
  subscribeRoom(code: string, onRoom: (room: Room | null) => void, onError: (error: Error) => void): () => void
}

function newGame(players: RoomPlayer[]): GameState {
  return createGame(
    players.map((p) => ({ id: p.uid, name: p.name })),
    randomSeed(),
  )
}

function isPermissionDenied(error: unknown): boolean {
  return error instanceof FirebaseError && error.code === 'permission-denied'
}

function withoutPlayer(room: Room, uid: string): Pick<Room, 'players' | 'playerUids'> {
  const players = room.players.filter((p) => p.uid !== uid)
  return { players, playerUids: players.map((p) => p.uid) }
}

export function createRoomRepository(db: Firestore): RoomRepository {
  const roomRef = (code: string) => doc(db, 'rooms', code) as DocumentReference<Room>
  const presenceRef = (code: string, uid: string) => doc(db, 'rooms', code, 'presence', uid)

  async function readRoom(tx: Transaction, code: string): Promise<Room> {
    const snap = await tx.get(roomRef(code))
    const room = snap.data()
    if (!room) throw RoomError.of('ROOM_NOT_FOUND')
    return room
  }

  function requireHost(room: Room, uid: string): void {
    if (room.hostId !== uid) throw RoomError.of('NOT_HOST')
  }

  /** 房號空著或已結束時寫入新房間；被進行中的房間占用時回傳 false */
  async function claimCode(code: string, host: RoomPlayer): Promise<boolean> {
    try {
      return await runTransaction(db, async (tx) => {
        const existing = (await tx.get(roomRef(code))).data()
        if (existing && existing.status !== 'finished') return false
        const room: Room = {
          code,
          hostId: host.uid,
          status: 'lobby',
          players: [host],
          playerUids: [host.uid],
          kickedUids: [],
          game: null,
          version: 0,
          updatedAt: null,
        }
        tx.set(roomRef(code), { ...room, updatedAt: serverTimestamp() })
        return true
      })
    } catch (error) {
      // 安全規則不讓非成員讀進行中的房間，讀取被拒代表房號被占用
      if (isPermissionDenied(error)) return false
      throw error
    }
  }

  async function createRoom(host: RoomPlayer): Promise<string> {
    for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
      const code = generateRoomCode()
      const created = await claimCode(code, host)
      if (created) return code
    }
    throw RoomError.of('NO_FREE_CODE')
  }

  async function joinRoom(code: string, player: RoomPlayer): Promise<void> {
    try {
      await runTransaction(db, async (tx) => {
        const room = await readRoom(tx, code)
        if (room.kickedUids.includes(player.uid)) throw RoomError.of('KICKED')
        if (room.playerUids.includes(player.uid)) return
        if (room.status !== 'lobby') throw RoomError.of('ROOM_STARTED')
        if (room.players.length >= MAX_PLAYERS) throw RoomError.of('ROOM_FULL')
        const players = [...room.players, player]
        tx.update(roomRef(code), {
          players,
          playerUids: players.map((p) => p.uid),
          version: room.version + 1,
          updatedAt: serverTimestamp(),
        })
      })
    } catch (error) {
      // 安全規則只讓非成員讀大廳或已結束的房間，讀取被拒代表遊戲已開始
      if (isPermissionDenied(error)) throw RoomError.of('ROOM_STARTED')
      throw error
    }
  }

  async function leaveRoom(code: string, uid: string): Promise<void> {
    await runTransaction(db, async (tx) => {
      const room = await readRoom(tx, code)
      const seat = room.playerUids.indexOf(uid)
      if (seat < 0) return
      if (room.status === 'playing') throw RoomError.of('GAME_IN_PROGRESS')
      if (room.players.length === 1) {
        tx.delete(roomRef(code))
        return
      }
      const rest = withoutPlayer(room, uid)
      const hostId = room.hostId === uid ? (rest.players[seat % rest.players.length]?.uid ?? room.hostId) : room.hostId
      tx.update(roomRef(code), { ...rest, hostId, version: room.version + 1, updatedAt: serverTimestamp() })
    })
  }

  async function startGame(code: string, uid: string): Promise<void> {
    await runTransaction(db, async (tx) => {
      const room = await readRoom(tx, code)
      requireHost(room, uid)
      if (room.status !== 'lobby') throw RoomError.of('NOT_LOBBY')
      if (room.players.length < MIN_PLAYERS || room.players.length > MAX_PLAYERS) throw RoomError.of('BAD_PLAYER_COUNT')
      tx.update(roomRef(code), {
        status: 'playing',
        game: newGame(room.players),
        version: room.version + 1,
        updatedAt: serverTimestamp(),
      })
    })
  }

  async function sendAction(code: string, uid: string, action: Action, expectedVersion: number): Promise<void> {
    await runTransaction(db, async (tx) => {
      const room = await readRoom(tx, code)
      if (!room.playerUids.includes(uid)) throw RoomError.of('NOT_MEMBER')
      if (room.status !== 'playing' || !room.game) throw RoomError.of('NOT_PLAYING')
      if (room.version !== expectedVersion) throw RoomError.of('STALE_VERSION')
      const result = applyAction(room.game, uid, action)
      if (!result.ok) throw RoomError.fromEngine(result.error)
      tx.update(roomRef(code), {
        game: result.state,
        status: result.state.status === 'gameOver' ? 'finished' : 'playing',
        version: room.version + 1,
        updatedAt: serverTimestamp(),
      })
    })
  }

  async function kickPlayer(code: string, hostUid: string, targetUid: string): Promise<void> {
    await runTransaction(db, async (tx) => {
      const room = await readRoom(tx, code)
      requireHost(room, hostUid)
      if (targetUid === hostUid) throw RoomError.of('KICK_SELF')
      if (!room.playerUids.includes(targetUid)) throw RoomError.of('NOT_MEMBER')
      const presence = await tx.get(presenceRef(code, targetUid))
      const lastSeen = presence.get('lastSeen') as Timestamp | undefined
      if (!isOffline(lastSeen?.toMillis(), Timestamp.now().toMillis())) throw RoomError.of('TARGET_ONLINE')

      let game = room.game
      let status = room.status
      if (room.status === 'playing' && room.game) {
        const result = removePlayer(room.game, targetUid)
        if (!result.ok) throw RoomError.fromEngine(result.error)
        game = result.state
        if (game.status === 'gameOver') status = 'finished'
      }
      tx.update(roomRef(code), {
        ...withoutPlayer(room, targetUid),
        kickedUids: [...room.kickedUids, targetUid],
        game,
        status,
        version: room.version + 1,
        updatedAt: serverTimestamp(),
      })
    })
  }

  async function restartGame(code: string, hostUid: string): Promise<void> {
    await runTransaction(db, async (tx) => {
      const room = await readRoom(tx, code)
      requireHost(room, hostUid)
      if (room.status !== 'finished') throw RoomError.of('NOT_FINISHED')
      if (room.players.length < MIN_PLAYERS) throw RoomError.of('BAD_PLAYER_COUNT')
      tx.update(roomRef(code), {
        status: 'playing',
        game: newGame(room.players),
        version: room.version + 1,
        updatedAt: serverTimestamp(),
      })
    })
  }

  function subscribeRoom(code: string, onRoom: (room: Room | null) => void, onError: (error: Error) => void) {
    return onSnapshot(roomRef(code), (snap) => onRoom(snap.data() ?? null), onError)
  }

  return { createRoom, joinRoom, leaveRoom, startGame, sendAction, kickPlayer, restartGame, subscribeRoom }
}
