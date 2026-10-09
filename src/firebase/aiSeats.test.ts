import { describe, expect, it } from 'vitest'
import { createGame } from '../engine'
import { aiTurnToPlay, hostToClaim, isAiUid, nextAiPlayer } from './aiSeats'
import type { Room } from './types'

function room(current: number, overrides: Partial<Room> = {}): Room {
  const game = createGame(
    [
      { id: 'host', name: 'Host' },
      { id: 'ai-1', name: 'AI 小蟹' },
      { id: 'guest', name: 'Guest' },
    ],
    1,
  )
  return {
    code: 'ABCD',
    hostId: 'host',
    status: 'playing',
    players: game.players.map((p) => ({ uid: p.id, name: p.name })),
    playerUids: game.players.map((p) => p.id),
    kickedUids: [],
    game: { ...game, current },
    version: 1,
    updatedAt: null,
    ...overrides,
  }
}

describe('S6 AI 代打：誰負責出手', () => {
  it('[S6-1] 輪到 AI 時只有房主的瀏覽器負責出手', () => {
    expect(aiTurnToPlay(room(1), 'host')).toBe('ai-1')
    expect(aiTurnToPlay(room(1), 'guest')).toBeNull()
    expect(aiTurnToPlay(room(0), 'host')).toBeNull()
    expect(aiTurnToPlay(room(2), 'host')).toBeNull()
  })

  it('[S6-3] 房主換人後由新房主接手', () => {
    const moved = room(1, { hostId: 'guest' })
    expect(aiTurnToPlay(moved, 'guest')).toBe('ai-1')
    expect(aiTurnToPlay(moved, 'host')).toBeNull()
  })

  it('[S6-3] 房主離線時，座位順序下一位在線真人負責接手房主', () => {
    const r = room(1)
    const offline = (set: string[]) => (uid: string) => set.includes(uid)
    expect(hostToClaim(r, 'guest', offline(['host']))).toBe(true)
    expect(hostToClaim(r, 'guest', offline([]))).toBe(false)
    expect(hostToClaim(r, 'host', offline(['host']))).toBe(false)
    expect(hostToClaim(r, 'ai-1', offline(['host']))).toBe(false)
    expect(hostToClaim(r, 'guest', offline(['host', 'guest']))).toBe(false)
    expect(hostToClaim(r, 'stranger', offline(['host']))).toBe(false)

    const four = room(1, {
      players: ['host', 'ai-1', 'g1', 'g2'].map((uid) => ({ uid, name: uid })),
      playerUids: ['host', 'ai-1', 'g1', 'g2'],
    })
    expect(hostToClaim(four, 'g1', offline(['host']))).toBe(true)
    expect(hostToClaim(four, 'g2', offline(['host']))).toBe(false)
    expect(hostToClaim(four, 'g2', offline(['host', 'g1']))).toBe(true)

    const humans = room(1, {
      players: ['host', 'g1'].map((uid) => ({ uid, name: uid })),
      playerUids: ['host', 'g1'],
    })
    expect(hostToClaim(humans, 'g1', offline(['host']))).toBe(false)
  })

  it('[S6-4] 局間計分與遊戲結束時 AI 不動作', () => {
    const base = room(1)
    if (!base.game) throw new Error('沒有對局')
    expect(aiTurnToPlay({ ...base, game: { ...base.game, status: 'roundEnd' } }, 'host')).toBeNull()
    expect(aiTurnToPlay({ ...base, status: 'finished', game: { ...base.game, status: 'gameOver' } }, 'host')).toBeNull()
    expect(aiTurnToPlay({ ...base, status: 'lobby', game: null }, 'host')).toBeNull()
  })

  it('[A6-2] AI 依序使用沒被占用的名字，最多 3 個', () => {
    const first = nextAiPlayer([{ uid: 'host', name: 'Host' }])
    expect(first).toEqual({ uid: 'ai-1', name: 'AI 小蟹' })
    const gap = nextAiPlayer([{ uid: 'ai-1', name: 'AI 小蟹' }, { uid: 'ai-3', name: 'AI 小鯊' }])
    expect(gap).toEqual({ uid: 'ai-2', name: 'AI 小魚' })
    expect(nextAiPlayer(['ai-1', 'ai-2', 'ai-3'].map((uid) => ({ uid, name: uid })))).toBeNull()
    expect(isAiUid('ai-2')).toBe(true)
    expect(isAiUid('xai-2')).toBe(false)
    expect(isAiUid('ai-evil')).toBe(false)
    expect(isAiUid('ai-4')).toBe(false)
  })
})
