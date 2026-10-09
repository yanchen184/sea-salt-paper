import type { Room, RoomPlayer } from './types'

export const AI_UID_PREFIX = 'ai-'
export const AI_NAMES = ['AI 小蟹', 'AI 小魚', 'AI 小鯊'] as const

const AI_UID_PATTERN = /^ai-[1-3]$/

export function isAiUid(uid: string): boolean {
  return AI_UID_PATTERN.test(uid)
}

export function humanPlayers(players: readonly RoomPlayer[]): RoomPlayer[] {
  return players.filter((p) => !isAiUid(p.uid))
}

/** 名字與 uid 都沒被占用的第一個 AI；三個都在座時回傳 null */
export function nextAiPlayer(players: readonly RoomPlayer[]): RoomPlayer | null {
  const index = AI_NAMES.findIndex((_, i) => !players.some((p) => p.uid === `${AI_UID_PREFIX}${i + 1}`))
  const name = AI_NAMES[index]
  return name ? { uid: `${AI_UID_PREFIX}${index + 1}`, name } : null
}

/** 有 AI 座位的房間房主離線時，從房主座位往後數第一位在線真人回傳 true */
export function hostToClaim(room: Room, uid: string, offline: (uid: string) => boolean): boolean {
  if (!room.playerUids.some(isAiUid)) return false
  if (uid === room.hostId || isAiUid(uid) || !offline(room.hostId)) return false
  const hostIndex = room.players.findIndex((p) => p.uid === room.hostId)
  const ordered = [...room.players.slice(hostIndex + 1), ...room.players.slice(0, Math.max(hostIndex, 0))]
  const claimer = ordered.find((p) => !isAiUid(p.uid) && p.uid !== room.hostId && !offline(p.uid))
  return claimer?.uid === uid
}

/** 這個瀏覽器（uid）該替哪個 AI 座位出手；只有房主在對局中輪到 AI 時回傳該 AI 的 uid */
export function aiTurnToPlay(room: Room | null, uid: string | null): string | null {
  if (!room || !uid || room.hostId !== uid) return null
  const game = room.game
  if (room.status !== 'playing' || !game || game.status !== 'playing') return null
  const current = game.players[game.current]?.id
  return current && isAiUid(current) ? current : null
}
