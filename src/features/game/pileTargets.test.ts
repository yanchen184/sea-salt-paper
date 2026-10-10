import { describe, expect, it } from 'vitest'
import { getLegalActions, type GameState } from '../../engine'
import { act, setup } from '../../engine/test-helpers'
import { pileTargets } from './pileTargets'

function targetsFor(state: GameState, uid: string, selected: string[] = []) {
  return pileTargets(state, getLegalActions(state, uid), selected)
}

function drawn(discards: [string[], string[]]): GameState {
  return act(setup({ phase: 'draw', deck: ['fish-1', 'shell-6', 'boat-1'], discards }), 'a', { type: 'DRAW_DECK' })
}

describe('牌堆點擊的動作', () => {
  it('[S9-1] 取牌階段點牌庫即抽牌庫；牌庫沒牌時不可點', () => {
    expect(targetsFor(setup({ phase: 'draw' }), 'a').deck?.action).toEqual({ type: 'DRAW_DECK' })
    expect(targetsFor(setup({ phase: 'draw', deck: [] }), 'a').deck).toBeNull()
  })

  it('[S9-2] 取牌階段點有牌的棄牌堆即拿頂牌；空的棄牌堆不可點', () => {
    const { piles } = targetsFor(setup({ phase: 'draw', discards: [['shell-1'], []] }), 'a')
    expect(piles[0]?.action).toEqual({ type: 'TAKE_DISCARD', pile: 0 })
    expect(piles[1]).toBeNull()
  })

  it('[S9-3] 抽到兩張後，選定留下的牌再點棄牌堆，另一張放到那堆', () => {
    const state = drawn([['shell-1'], ['crab-1']])
    const keep = state.pendingDraw[0]?.id ?? ''
    expect(targetsFor(state, 'a').piles).toEqual([null, null])
    const { deck, piles } = targetsFor(state, 'a', [keep])
    expect(deck).toBeNull()
    expect(piles[0]?.action).toEqual({ type: 'KEEP_DRAWN', keepCardId: keep, discardPile: 0 })
    expect(piles[1]?.action).toEqual({ type: 'KEEP_DRAWN', keepCardId: keep, discardPile: 1 })
  })

  it('[S9-3] 有空的棄牌堆時只能放到空的那一堆', () => {
    const state = drawn([['shell-1'], []])
    const { piles } = targetsFor(state, 'a', [state.pendingDraw[0]?.id ?? ''])
    expect(piles[0]).toBeNull()
    expect(piles[1]?.action.type).toBe('KEEP_DRAWN')
  })

  it('[S9-4] 選定兩張螃蟹後點有牌的棄牌堆，打出螃蟹並從那堆挑', () => {
    const state = setup({ phase: 'actions', hands: [['crab-1', 'crab-2', 'boat-1']], discards: [['shell-1'], []] })
    const { deck, piles } = targetsFor(state, 'a', ['crab-1', 'crab-2'])
    expect(deck).toBeNull()
    expect(piles[0]?.action).toEqual({ type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'], crab: { pile: 0 } })
    expect(piles[1]).toBeNull()
  })

  it('[S9-4] 選的不是兩張螃蟹時，點棄牌堆沒有動作', () => {
    const state = setup({ phase: 'actions', hands: [['crab-1', 'boat-1', 'boat-2']], discards: [['shell-1'], ['fish-1']] })
    expect(targetsFor(state, 'a', ['boat-1', 'boat-2']).piles).toEqual([null, null])
    expect(targetsFor(state, 'a', ['crab-1']).piles).toEqual([null, null])
  })

  it('[S9-5] 不是自己的回合時三個牌堆都不可點', () => {
    const state = setup({ phase: 'draw', discards: [['shell-1'], ['crab-1']] })
    expect(targetsFor(state, 'b')).toEqual({ deck: null, piles: [null, null] })
  })

  it('[S9-5] 可點的牌堆附上點下去會做什麼的說明', () => {
    const { deck, piles } = targetsFor(setup({ phase: 'draw', discards: [['shell-1'], []] }), 'a')
    expect(deck?.label).toBe('抽牌庫')
    expect(piles[0]?.label).toBe('拿左堆頂牌')
  })
})
