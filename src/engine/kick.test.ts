import { describe, expect, it } from 'vitest'
import { getLegalActions, removePlayer } from './game'
import type { GameState } from './types'
import { act, ids, setup } from './test-helpers'

/** shell 1–4 = 6、crab duo = 1 → 卡牌分 7 */
const SEVEN_A = ['shell-1', 'shell-2', 'shell-3', 'shell-4', 'crab-1', 'crab-2']
/** octopus 1–3 = 6、penguin-1 = 1 → 卡牌分 7 */
const SEVEN_B = ['octopus-1', 'octopus-2', 'octopus-3', 'penguin-1']

function kick(state: GameState, playerId: string): GameState {
  const result = removePlayer(state, playerId)
  if (!result.ok) throw new Error(`removePlayer 失敗：${result.error.code}`)
  return result.state
}

function allCardIds(s: GameState): string[] {
  return [
    ...s.deck,
    ...s.pendingDraw,
    ...s.discards.flatMap((d) => d.cards),
    ...s.players.flatMap((p) => [...p.hand, ...p.field]),
    ...s.removed,
  ].map((c) => c.id)
}

describe('G10 踢出玩家', () => {
  it('[G10-1] 玩家數 −1，目標分改用新人數', () => {
    const s4 = kick(setup({ players: 4 }), 'd')
    expect(s4.players.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(s4.targetScore).toBe(35)
    const s3 = kick(s4, 'c')
    expect(s3.players).toHaveLength(2)
    expect(s3.targetScore).toBe(40)
  })

  it('[G10-1] 被踢者的總分保留在紀錄，不參與排名', () => {
    const s = kick(setup({ players: 3, scores: [10, 20, 30] }), 'c')
    expect(s.kicked).toEqual([{ id: 'c', name: 'Cat', score: 30 }])
    expect(s.log.at(-1)?.text).toBe('Cat 被房主移出遊戲')
  })

  it('[G10-2] 被踢者的手牌與場上牌移出遊戲，58 張守恆', () => {
    const s = setup({ players: 3, hands: [[], ['shell-1', 'octopus-1'], []], fields: [[], ['boat-1', 'boat-2'], []] })
    const t = kick(s, 'b')
    expect(ids(t.removed)).toEqual(['shell-1', 'octopus-1', 'boat-1', 'boat-2'])
    const all = allCardIds(t)
    expect(all).toHaveLength(58)
    expect(new Set(all).size).toBe(58)
  })

  it('[G10-2] 之後各局洗牌不再放回移出的牌', () => {
    const s = setup({ players: 3, hands: [SEVEN_A, ['shell-5', 'octopus-4'], []] })
    const t = kick(s, 'b')
    const ended = act(t, 'a', { type: 'DECLARE', kind: 'stop' })
    const next = act(ended, 'a', { type: 'NEXT_ROUND' })
    const inPlay = [...next.deck, ...next.discards.flatMap((d) => d.cards)].map((c) => c.id)
    expect(inPlay).toHaveLength(56)
    expect(inPlay).not.toContain('shell-5')
    expect(inPlay).not.toContain('octopus-4')
    expect(allCardIds(next)).toHaveLength(58)
  })

  it('[G10-2] 輪到被踢者且抽了 2 張還沒放回，那 2 張也移出', () => {
    const s = act(setup({ players: 3, phase: 'draw', current: 1 }), 'b', { type: 'DRAW_DECK' })
    const pending = ids(s.pendingDraw)
    const t = kick(s, 'b')
    expect(t.pendingDraw).toEqual([])
    expect(ids(t.removed)).toEqual(pending)
    expect(allCardIds(t)).toHaveLength(58)
  })

  it('[G10-3] 輪到被踢者時由座位上的下一位開始新回合，帆船額外回合作廢', () => {
    const s = act(setup({ players: 3, hands: [[], ['boat-1', 'boat-2'], []], current: 1 }), 'b', {
      type: 'PLAY_DUO',
      cardIds: ['boat-1', 'boat-2'],
    })
    expect(s.extraTurn).toBe(true)
    const t = kick(s, 'b')
    expect(t.players[t.current]?.id).toBe('c')
    expect(t.phase).toBe('draw')
    expect(t.extraTurn).toBe(false)
    expect(getLegalActions(t, 'c').isMyTurn).toBe(true)
  })

  it('[G10-3] 被踢者坐最後一個位子時，輪回第一位', () => {
    const t = kick(setup({ players: 3, current: 2 }), 'c')
    expect(t.players[t.current]?.id).toBe('a')
    expect(t.phase).toBe('draw')
  })

  it('[G10-3] 挑螃蟹時被踢，下一位正常開始', () => {
    const s = act(setup({ players: 3, hands: [['crab-1', 'crab-2'], [], []], discards: [['shell-1'], []] }), 'a', {
      type: 'PLAY_DUO',
      cardIds: ['crab-1', 'crab-2'],
      crab: { pile: 0 },
    })
    const t = kick(s, 'a')
    expect(t.crabPile).toBeNull()
    expect(t.players[t.current]?.id).toBe('b')
    expect(t.phase).toBe('draw')
    expect(ids(t.discards[0].cards)).toEqual(['shell-1'])
  })

  it('[G10-3] 沒輪到被踢者時，目前玩家不變', () => {
    const t = kick(setup({ players: 4, current: 2, phase: 'chooseDrawn' }), 'a')
    expect(t.players[t.current]?.id).toBe('c')
    expect(t.phase).toBe('chooseDrawn')
  })

  it('[G10-4] 被踢者是 LAST CHANCE 宣告者時宣告取消，這局照常進行', () => {
    const s = act(setup({ players: 3, hands: [SEVEN_A, [], []] }), 'a', { type: 'DECLARE', kind: 'lastChance' })
    expect(s.declaration?.playerId).toBe('a')
    const t = kick(s, 'a')
    expect(t.declaration).toBeNull()
    expect(t.status).toBe('playing')
    expect(t.players[t.current]?.id).toBe('b')
    expect(getLegalActions(t, 'b').declare).toBe(false)
  })

  it('[G10-4] LAST CHANCE 期間踢的是其他人，剩下的人輪完後計分', () => {
    let s = act(setup({ players: 3, hands: [SEVEN_A, SEVEN_B, []], discards: [['fish-1'], []] }), 'a', { type: 'DECLARE', kind: 'lastChance' })
    expect(s.players[s.current]?.id).toBe('b')
    s = kick(s, 'c')
    expect(s.declaration?.playerId).toBe('a')
    s = act(act(s, 'b', { type: 'TAKE_DISCARD', pile: 0 }), 'b', { type: 'END_TURN' })
    expect(s.status).toBe('roundEnd')
    expect(s.roundResult?.scores.map((sc) => sc.playerId)).toEqual(['a', 'b'])
  })

  it('[G10-4] 被踢者的下一位就是宣告者時，直接計分', () => {
    let s = act(setup({ players: 3, hands: [SEVEN_A, [], []], discards: [['fish-1'], []] }), 'a', { type: 'DECLARE', kind: 'lastChance' })
    s = act(act(s, 'b', { type: 'TAKE_DISCARD', pile: 0 }), 'b', { type: 'END_TURN' })
    expect(s.players[s.current]?.id).toBe('c')
    const t = kick(s, 'c')
    expect(t.status).toBe('roundEnd')
    expect(t.roundResult?.reason).toBe('lastChance')
  })

  it('[G10-1] 局結束後被踢，計分表移除他那列，可照常開下一局', () => {
    const ended = act(setup({ players: 3, hands: [SEVEN_A, [], []] }), 'a', { type: 'DECLARE', kind: 'stop' })
    const t = kick(ended, 'c')
    expect(t.status).toBe('roundEnd')
    expect(t.roundResult?.scores.map((sc) => sc.playerId)).toEqual(['a', 'b'])
    const next = act(t, 'b', { type: 'NEXT_ROUND' })
    expect(next.status).toBe('playing')
    expect(next.players[next.current]?.id).toBe('b')
  })

  it('[G10-5] 只剩 1 人時遊戲結束，該玩家獲勝', () => {
    const t = kick(setup({ players: 2, scores: [5, 30] }), 'b')
    expect(t.status).toBe('gameOver')
    expect(t.winnerId).toBe('a')
    expect(t.winReason).toBe('lastPlayer')
  })

  it('[G10-5] 遊戲結束後或不存在的玩家不能踢', () => {
    const over = kick(setup({ players: 2 }), 'b')
    const r1 = removePlayer(over, 'a')
    expect(!r1.ok && r1.error.code).toBe('GAME_NOT_PLAYING')
    const r2 = removePlayer(setup({ players: 2 }), 'z')
    expect(!r2.ok && r2.error.code).toBe('UNKNOWN_PLAYER')
  })

  it('[G10-5] 結果可 JSON 序列化', () => {
    const t = kick(setup({ players: 3 }), 'b')
    expect(JSON.parse(JSON.stringify(t))).toEqual(t)
  })
})
