import type { Timestamp } from 'firebase/firestore'
import type { ActionError, ErrorCode, GameState } from '../engine'

export type RoomStatus = 'lobby' | 'playing' | 'finished'

export interface RoomPlayer {
  uid: string
  name: string
}

export interface Room {
  code: string
  hostId: string
  status: RoomStatus
  /** 陣列順序 = 座位 */
  players: RoomPlayer[]
  /** 與 players 同步的 uid 清單，供安全規則判斷成員 */
  playerUids: string[]
  kickedUids: string[]
  game: GameState | null
  version: number
  updatedAt: Timestamp | null
}

export type RoomErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_STARTED'
  | 'KICKED'
  | 'NOT_MEMBER'
  | 'NOT_HOST'
  | 'BAD_PLAYER_COUNT'
  | 'NOT_LOBBY'
  | 'NOT_PLAYING'
  | 'NOT_FINISHED'
  | 'GAME_IN_PROGRESS'
  | 'KICK_SELF'
  | 'TARGET_ONLINE'
  | 'STALE_VERSION'
  | 'NO_FREE_CODE'

const MESSAGES: Record<RoomErrorCode, string> = {
  ROOM_NOT_FOUND: '找不到這個房間',
  ROOM_FULL: '房間已滿 4 人',
  ROOM_STARTED: '這個房間的遊戲已經開始',
  KICKED: '你已被房主移出這個房間',
  NOT_MEMBER: '你不在這個房間裡',
  NOT_HOST: '只有房主可以這樣做',
  BAD_PLAYER_COUNT: '需要 2–4 位玩家才能開始',
  NOT_LOBBY: '遊戲已經開始',
  NOT_PLAYING: '遊戲不在進行中',
  NOT_FINISHED: '遊戲還沒結束',
  GAME_IN_PROGRESS: '遊戲進行中不能離開房間',
  KICK_SELF: '不能把自己移出房間',
  TARGET_ONLINE: '對方還在線上，不能移出',
  STALE_VERSION: '畫面不是最新狀態，已重新整理，請再操作一次',
  NO_FREE_CODE: '暫時無法產生房號，請再試一次',
}

export class RoomError extends Error {
  readonly code: RoomErrorCode | ErrorCode

  private constructor(code: RoomErrorCode | ErrorCode, message: string) {
    super(message)
    this.name = 'RoomError'
    this.code = code
  }

  static of(code: RoomErrorCode): RoomError {
    return new RoomError(code, MESSAGES[code])
  }

  static fromEngine(error: ActionError): RoomError {
    return new RoomError(error.code, error.message)
  }
}
