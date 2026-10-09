import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'
import { applyAction, chooseAiAction, createGame, removePlayer, type Action, type GameState } from '../engine'
import { isOffline } from '../lib/presence'
import { generateRoomCode, randomSeed } from '../lib/roomCode'
import { humanPlayers, isAiUid, nextAiPlayer } from './aiSeats'
import { RoomError, type Room, type RoomPlayer } from './types'

export const MAX_PLAYERS = 4
export const MIN_PLAYERS = 2
const CREATE_ATTEMPTS = 10

export interface RoomRepository {
  createRoom(host: RoomPlayer): Promise<string>
  /** 建立房間並直接和 aiCount 個 AI 開局 */
  createSoloGame(host: RoomPlayer, aiCount: number): Promise<string>
  addAi(code: string, hostUid: string): Promise<void>
  removeAi(code: string, hostUid: string, aiUid: string): Promise<void>
  joinRoom(code: string, player: RoomPlayer): Promise<void>
  leaveRoom(code: string, uid: string): Promise<void>
  startGame(code: string, uid: string): Promise<void>
  sendAction(code: string, uid: string, action: Action, expectedVersion: number): Promise<void>
  /** 房主替目前輪到的 AI 出手；version 已變或不是 AI 的回合時不寫入 */
  playAiTurn(code: string, hostUid: string, expectedVersion: number): Promise<void>
  kickPlayer(code: string, hostUid: string, targetUid: string): Promise<void>
  /** 有 AI 的房間房主離線超過 45 秒時，從房主座位往後第一位在線真人成為房主 */
  claimHost(code: string, uid: string): Promise<void>
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

function seats(players: RoomPlayer[]): Pick<Room, 'players' | 'playerUids'> {
  return { players, playerUids: players.map((p) => p.uid) }
}

function withoutPlayer(room: Room, uid: string): Pick<Room, 'players' | 'playerUids'> {
  return seats(room.players.filter((p) => p.uid !== uid))
}

/** 從離開者的座位往後找第一個真人當新房主 */
function nextHost(room: Room, leaverSeat: number, rest: RoomPlayer[]): string {
  const ordered = [...room.players.slice(leaverSeat + 1), ...room.players.slice(0, leaverSeat)]
  return ordered.find((p) => !isAiUid(p.uid) && rest.includes(p))?.uid ?? room.hostId
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
  async function claimCode(code: string, initial: Omit<Room, 'code' | 'updatedAt'>): Promise<boolean> {
    try {
      return await runTransaction(db, async (tx) => {
        const existing = (await tx.get(roomRef(code))).data()
        if (existing && existing.status !== 'finished') return false
        tx.set(roomRef(code), { ...initial, code, updatedAt: serverTimestamp() })
        return true
      })
    } catch (error) {
      // 安全規則不讓非成員讀進行中的房間，讀取被拒代表房號被占用
      if (isPermissionDenied(error)) return false
      throw error
    }
  }

  async function createWith(initial: Omit<Room, 'code' | 'updatedAt'>): Promise<string> {
    for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
      const code = generateRoomCode()
      const created = await claimCode(code, initial)
      if (created) return code
    }
    throw RoomError.of('NO_FREE_CODE')
  }

  async function createRoom(host: RoomPlayer): Promise<string> {
    return createWith({ hostId: host.uid, status: 'lobby', ...seats([host]), kickedUids: [], game: null, version: 0 })
  }

  async function createSoloGame(host: RoomPlayer, aiCount: number): Promise<string> {
    if (!Number.isInteger(aiCount) || aiCount < MIN_PLAYERS - 1 || aiCount > MAX_PLAYERS - 1) throw RoomError.of('BAD_PLAYER_COUNT')
    let players = [host]
    for (let i = 0; i < aiCount; i++) {
      const ai = nextAiPlayer(players)
      if (!ai) throw RoomError.of('ROOM_FULL')
      players = [...players, ai]
    }
    return createWith({ hostId: host.uid, status: 'playing', ...seats(players), kickedUids: [], game: newGame(players), version: 0 })
  }

  /** 誰能接手由安全規則用伺服器時間判斷，被拒時回 CANNOT_CLAIM_HOST */
  async function claimHost(code: string, uid: string): Promise<void> {
    try {
      await runTransaction(db, async (tx) => {
        const room = await readRoom(tx, code)
        if (!room.playerUids.includes(uid) || isAiUid(uid)) throw RoomError.of('NOT_MEMBER')
        if (room.hostId === uid) return
        tx.update(roomRef(code), { hostId: uid, version: room.version + 1, updatedAt: serverTimestamp() })
      })
    } catch (error) {
      if (isPermissionDenied(error)) throw RoomError.of('CANNOT_CLAIM_HOST')
      throw error
    }
  }

  async function addAi(code: string, hostUid: string): Promise<void> {
    await runTransaction(db, async (tx) => {
      const room = await readRoom(tx, code)
      requireHost(room, hostUid)
      if (room.status !== 'lobby') throw RoomError.of('NOT_LOBBY')
      const ai = room.players.length < MAX_PLAYERS ? nextAiPlayer(room.players) : null
      if (!ai) throw RoomError.of('ROOM_FULL')
      tx.update(roomRef(code), { ...seats([...room.players, ai]), version: room.version + 1, updatedAt: serverTimestamp() })
    })
  }

  async function removeAi(code: string, hostUid: string, aiUid: string): Promise<void> {
    await runTransaction(db, async (tx) => {
      const room = await readRoom(tx, code)
      requireHost(room, hostUid)
      if (room.status !== 'lobby') throw RoomError.of('NOT_LOBBY')
      if (!isAiUid(aiUid) || !room.playerUids.includes(aiUid)) throw RoomError.of('NOT_MEMBER')
      tx.update(roomRef(code), { ...withoutPlayer(room, aiUid), version: room.version + 1, updatedAt: serverTimestamp() })
    })
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
      if (humanPlayers(room.players).length === 1) {
        tx.delete(roomRef(code))
        return
      }
      if (room.status === 'playing') throw RoomError.of('GAME_IN_PROGRESS')
      const rest = withoutPlayer(room, uid)
      const hostId = room.hostId === uid ? nextHost(room, seat, rest.players) : room.hostId
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
    try {
      await commitAction(code, uid, action, expectedVersion)
    } catch (error) {
      if (!isPermissionDenied(error)) throw error
      const current = (await getDoc(roomRef(code))).data()
      if (current && current.version !== expectedVersion) throw RoomError.of('STALE_VERSION')
      throw error
    }
  }

  async function playAiTurn(code: string, hostUid: string, expectedVersion: number): Promise<void> {
    await runTransaction(db, async (tx) => {
      const room = await readRoom(tx, code)
      requireHost(room, hostUid)
      const game = room.game
      if (room.version !== expectedVersion || room.status !== 'playing' || !game) return
      const aiUid = game.players[game.current]?.id
      if (!aiUid || !isAiUid(aiUid)) return
      const action = chooseAiAction(game, aiUid)
      if (!action) return
      const result = applyAction(game, aiUid, action)
      if (!result.ok) throw RoomError.fromEngine(result.error)
      tx.update(roomRef(code), {
        game: result.state,
        status: result.state.status === 'gameOver' ? 'finished' : 'playing',
        version: room.version + 1,
        updatedAt: serverTimestamp(),
      })
    })
  }

  /** 規則要求 version 只能 +1：併發時晚到的寫入會被規則擋下（permission-denied），由 sendAction 轉成 STALE_VERSION */
  async function commitAction(code: string, uid: string, action: Action, expectedVersion: number): Promise<void> {
    await runTransaction(db, async (tx) => {
      const room = await readRoom(tx, code)
      if (!room.playerUids.includes(uid)) throw RoomError.of('NOT_MEMBER')
      if (room.status !== 'playing' || !room.game) throw RoomError.of('NOT_PLAYING')
      if (room.version !== expectedVersion) throw RoomError.of('STALE_VERSION')
      if (action.type === 'NEXT_ROUND') requireHost(room, uid)
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
      if (isAiUid(targetUid)) throw RoomError.of('KICK_AI')
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

  return {
    createRoom,
    createSoloGame,
    addAi,
    removeAi,
    joinRoom,
    leaveRoom,
    startGame,
    sendAction,
    playAiTurn,
    kickPlayer,
    claimHost,
    restartGame,
    subscribeRoom,
  }
}
