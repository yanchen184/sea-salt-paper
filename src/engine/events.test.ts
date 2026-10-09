import { describe, expect, it } from 'vitest'
import { MAX_EVENTS } from './game'
import { act, card, setup } from './test-helpers'
import type { GameEvent, GameState } from './types'

function lastEvent(state: GameState): GameEvent | undefined {
  return state.events[state.events.length - 1]
}

describe('S8 公開事件', () => {
  it('[S8-2] 抽牌庫產生 drawDeck（2 張），留牌產生 keepDrawn（放到哪一堆、哪張牌）', () => {
    let s = setup({ phase: 'draw', deck: ['fish-1', 'fish-2', 'shell-1'] })
    s = act(s, 'a', { type: 'DRAW_DECK' })
    expect(lastEvent(s)).toEqual({ seq: 1, type: 'drawDeck', playerId: 'a', cards: [card('fish-1'), card('fish-2')] })
    s = act(s, 'a', { type: 'KEEP_DRAWN', keepCardId: 'fish-1', discardPile: 1 })
    expect(lastEvent(s)).toEqual({ seq: 2, type: 'keepDrawn', playerId: 'a', discarded: card('fish-2'), pile: 1 })
  })

  it('[S8-2] 牌庫只剩 1 張時 drawDeck 只有 1 張', () => {
    const s = act(setup({ phase: 'draw', deck: ['fish-1'] }), 'a', { type: 'DRAW_DECK' })
    expect(lastEvent(s)).toMatchObject({ type: 'drawDeck', cards: [card('fish-1')] })
  })

  it('[S8-3] 拿棄牌堆產生 takeDiscard（哪一堆、頂牌）', () => {
    const s = act(setup({ phase: 'draw', discards: [['shell-1'], ['crab-1']] }), 'a', { type: 'TAKE_DISCARD', pile: 1 })
    expect(lastEvent(s)).toEqual({ seq: 1, type: 'takeDiscard', playerId: 'a', card: card('crab-1'), pile: 1 })
  })

  it('[S8-4] 打 Duo 產生 playDuo，帶效果結果：魚對有沒有抽到、偷了誰、螃蟹挑哪一堆', () => {
    const fish = act(setup({ hands: [['fish-1', 'fish-2']], deck: ['shell-1'] }), 'a', { type: 'PLAY_DUO', cardIds: ['fish-1', 'fish-2'] })
    expect(lastEvent(fish)).toEqual({
      seq: 1,
      type: 'playDuo',
      playerId: 'a',
      cards: [card('fish-1'), card('fish-2')],
      effect: 'fish',
      crabPile: null,
      stealFrom: null,
      fishDrew: true,
    })

    const steal = act(setup({ hands: [['shark-1', 'swimmer-1'], ['shell-1']] }), 'a', {
      type: 'PLAY_DUO',
      cardIds: ['shark-1', 'swimmer-1'],
      steal: { targetId: 'b' },
    })
    expect(lastEvent(steal)).toMatchObject({ effect: 'steal', stealFrom: 'b', fishDrew: false })

    const boat = act(setup({ hands: [['boat-1', 'boat-2']] }), 'a', { type: 'PLAY_DUO', cardIds: ['boat-1', 'boat-2'] })
    expect(lastEvent(boat)).toMatchObject({ effect: 'boat', crabPile: null, stealFrom: null })
  })

  it('[S8-4] 螃蟹挑牌的事件不含挑到的牌', () => {
    let s = setup({ hands: [['crab-1', 'crab-2']], discards: [['shell-1', 'mermaid-1'], []] })
    s = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'], crab: { pile: 0 } })
    expect(lastEvent(s)).toMatchObject({ type: 'playDuo', effect: 'crab', crabPile: 0 })
    s = act(s, 'a', { type: 'PICK_CRAB', cardId: 'mermaid-1' })
    expect(lastEvent(s)).toEqual({ seq: 2, type: 'pickCrab', playerId: 'a', pile: 0 })
    expect(JSON.stringify(lastEvent(s))).not.toContain('mermaid')
  })

  it('[S8-5] 宣告產生 declare（宣告者與種類）', () => {
    const shells = ['shell-1', 'shell-2', 'shell-3', 'shell-4', 'shell-5']
    const s = act(setup({ hands: [shells, ['fish-1']] }), 'a', { type: 'DECLARE', kind: 'lastChance' })
    expect(lastEvent(s)).toEqual({ seq: 1, type: 'declare', playerId: 'a', kind: 'lastChance' })
  })

  it('[S8-6] seq 逐一遞增，只保留最近 MAX_EVENTS 個', () => {
    let s = setup({ players: 2, phase: 'draw' })
    for (let i = 0; i < MAX_EVENTS + 5; i++) {
      const id = s.players[s.current]?.id ?? ''
      s = act(s, id, { type: 'DRAW_DECK' })
      const keep = s.pendingDraw[0]?.id ?? ''
      s = act(s, id, { type: 'KEEP_DRAWN', keepCardId: keep, discardPile: s.discards[1].cards.length === 0 ? 1 : 0 })
      s = act(s, id, { type: 'END_TURN' })
    }
    expect(s.events).toHaveLength(MAX_EVENTS)
    const seqs = s.events.map((e) => e.seq)
    expect(seqs).toEqual(Array.from({ length: MAX_EVENTS }, (_, i) => (MAX_EVENTS + 5) * 2 - MAX_EVENTS + 1 + i))
  })

  it('[S8-6] 結束回合不產生事件', () => {
    const s = setup({ hands: [['fish-1']] })
    expect(act(s, 'a', { type: 'END_TURN' }).events).toEqual([])
  })
})
