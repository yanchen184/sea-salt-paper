import { describe, expect, it } from 'vitest'
import { chooseAiAction } from './ai'
import { applyAction, createGame } from './game'
import { act, cards, randomLegalAction, SEATS, setup } from './test-helpers'
import type { Action, GameState } from './types'

const SEEDS = 200
const STEP_LIMIT = 20000

function nextRoundIfNeeded(s: GameState): GameState {
  return s.status === 'roundEnd' ? act(s, s.players[0]?.id ?? '', { type: 'NEXT_ROUND' }) : s
}

describe('G11 AI 決策', () => {
  it('[G11-1] 4 個 AI 在 200 個 seed 各打完一整場，每一步都合法', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      let s = createGame(SEATS, seed)
      let steps = 0
      while (s.status !== 'gameOver') {
        s = nextRoundIfNeeded(s)
        if (s.status !== 'playing') continue
        const actor = s.players[s.current]?.id ?? ''
        const action = chooseAiAction(s, actor)
        if (!action) throw new Error(`seed ${seed} 第 ${steps} 步沒有動作（phase ${s.phase}）`)
        const result = applyAction(s, actor, action)
        if (!result.ok) throw new Error(`seed ${seed} 第 ${steps} 步 ${action.type} 被拒 ${result.error.code}`)
        s = result.state
        if (++steps > STEP_LIMIT) throw new Error(`seed ${seed} 沒有結束`)
      }
      expect(s.winnerId).not.toBeNull()
    }
  }, 120_000)

  it('[G11-1] 不是自己的回合、局間與遊戲結束時不動作', () => {
    const s = setup({ current: 0, phase: 'draw' })
    expect(chooseAiAction(s, 'b')).toBeNull()
    expect(chooseAiAction({ ...s, status: 'roundEnd' }, 'a')).toBeNull()
    expect(chooseAiAction({ ...s, status: 'gameOver' }, 'a')).toBeNull()
  })

  it('[G11-2] 同一個 state 回傳同一個動作', () => {
    let s = createGame(SEATS.slice(0, 3), 42)
    for (let step = 0; step < 300 && s.status !== 'gameOver'; step++) {
      s = nextRoundIfNeeded(s)
      const actor = s.players[s.current]?.id ?? ''
      const action = chooseAiAction(s, actor)
      expect(chooseAiAction(structuredClone(s), actor)).toEqual(action)
      if (!action) break
      s = act(s, actor, action)
    }
  })

  it('[G11-3] 改動對手手牌與牌庫順序，回傳的動作不變', () => {
    let s = createGame(SEATS.slice(0, 3), 7)
    let checked = 0
    for (let step = 0; step < 600 && s.status !== 'gameOver'; step++) {
      s = nextRoundIfNeeded(s)
      const actor = s.players[s.current]?.id ?? ''
      const action = chooseAiAction(s, actor)
      if (!action) break
      const hidden = [...s.deck, ...s.players.filter((p) => p.id !== actor).flatMap((p) => p.hand)].reverse()
      let cursor = 0
      const take = (n: number) => hidden.slice(cursor, (cursor += n))
      const shuffled: GameState = {
        ...s,
        players: s.players.map((p) => (p.id === actor ? p : { ...p, hand: take(p.hand.length) })),
        deck: take(s.deck.length),
      }
      expect(chooseAiAction(shuffled, actor)).toEqual(action)
      checked++
      s = act(s, actor, action)
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('[G11-4] 棄牌堆頂能湊對子、是美人魚或已收集的種類就拿，否則抽牌庫', () => {
    const pair = setup({ phase: 'draw', hands: [['crab-1']], discards: [['shell-1'], ['crab-2']] })
    expect(chooseAiAction(pair, 'a')).toEqual({ type: 'TAKE_DISCARD', pile: 1 })
    const mermaid = setup({ phase: 'draw', hands: [['boat-1']], discards: [['mermaid-1'], ['penguin-1']] })
    expect(chooseAiAction(mermaid, 'a')).toEqual({ type: 'TAKE_DISCARD', pile: 0 })
    const collected = setup({ phase: 'draw', hands: [['octopus-1']], discards: [['boat-1'], ['octopus-2']] })
    expect(chooseAiAction(collected, 'a')).toEqual({ type: 'TAKE_DISCARD', pile: 1 })
    const nothing = setup({ phase: 'draw', hands: [['octopus-1']], discards: [['boat-1'], ['crab-1']] })
    expect(chooseAiAction(nothing, 'a')).toEqual({ type: 'DRAW_DECK' })
  })

  it('[G11-4] 抽牌庫時留價值高的那張，另一張放到合法的棄牌堆', () => {
    const s: GameState = {
      ...setup({ phase: 'chooseDrawn', hands: [['crab-1']], discards: [['shell-1'], []] }),
      pendingDraw: cards('boat-1', 'crab-2'),
    }
    expect(chooseAiAction(s, 'a')).toEqual({ type: 'KEEP_DRAWN', keepCardId: 'crab-2', discardPile: 1 })
  })

  it('[G11-5] 能打的 Duo 都會打，打完才宣告或結束回合', () => {
    let s = setup({ hands: [['boat-1', 'boat-2', 'fish-1', 'fish-2', 'shell-1']], deck: ['penguin-1', 'penguin-2'] })
    const played: Action['type'][] = []
    while (s.current === 0 && s.status === 'playing') {
      const action = chooseAiAction(s, 'a') as Action
      played.push(action.type)
      s = act(s, 'a', action)
      if (action.type === 'END_TURN') break
    }
    expect(played).toEqual(['PLAY_DUO', 'PLAY_DUO', 'END_TURN'])
  })

  it('[G11-5] shark+swimmer 偷手牌最多的對手；crab 選張數多的棄牌堆，翻開後挑價值最高的牌', () => {
    const steal = setup({ players: 3, hands: [['shark-1', 'swimmer-1'], ['boat-1'], ['boat-2', 'fish-1']] })
    expect(chooseAiAction(steal, 'a')).toEqual({ type: 'PLAY_DUO', cardIds: ['shark-1', 'swimmer-1'], steal: { targetId: 'c' } })

    const crab = setup({ hands: [['crab-1', 'crab-2', 'octopus-1']], discards: [['boat-1'], ['penguin-1', 'octopus-2', 'shell-1']] })
    const play = chooseAiAction(crab, 'a')
    expect(play).toEqual({ type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'], crab: { pile: 1 } })
    const picking = act(crab, 'a', play as Action)
    expect(chooseAiAction(picking, 'a')).toEqual({ type: 'PICK_CRAB', cardId: 'octopus-2' })
  })

  it('[G11-5][G11-3] crab 選堆時看不到頂牌以下的牌：較小的堆藏著美人魚，選擇也不變', () => {
    const hands = [['crab-1', 'crab-2']]
    const plain = setup({ hands, discards: [['shell-1', 'boat-1'], ['penguin-1', 'octopus-2', 'fish-1']] })
    const hidden = setup({ hands, discards: [['mermaid-1', 'boat-1'], ['penguin-1', 'octopus-2', 'fish-1']] })
    const expected = { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'], crab: { pile: 1 } }
    expect(chooseAiAction(plain, 'a')).toEqual(expected)
    expect(chooseAiAction(hidden, 'a')).toEqual(expected)
  })

  it('[G11-6] 卡牌分 ≥ 7 時宣告 STOP，不到 7 分結束回合', () => {
    const rich = setup({ hands: [['octopus-1', 'octopus-2', 'octopus-3', 'octopus-4']] })
    expect(chooseAiAction(rich, 'a')).toEqual({ type: 'DECLARE', kind: 'stop' })
    const poor = setup({ hands: [['octopus-1', 'octopus-2']] })
    expect(chooseAiAction(poor, 'a')).toEqual({ type: 'END_TURN' })
  })

  it('[G11-7] 對 200 個 seed，AI 對上隨機合法動作的對手勝率 ≥ 70%', () => {
    let wins = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      const aiId = seed % 2 === 0 ? 'a' : 'b'
      let s = createGame(SEATS.slice(0, 2), seed)
      let rng = seed * 7919
      let steps = 0
      while (s.status !== 'gameOver') {
        s = nextRoundIfNeeded(s)
        if (s.status !== 'playing') continue
        const actor = s.players[s.current]?.id ?? ''
        let action: Action | null
        if (actor === aiId) {
          action = chooseAiAction(s, actor)
        } else {
          const [random, , next] = randomLegalAction(s, rng)
          rng = next
          action = random
        }
        s = act(s, actor, action as Action)
        if (++steps > STEP_LIMIT) throw new Error(`seed ${seed} 沒有結束`)
      }
      if (s.winnerId === aiId) wins++
    }
    expect(wins / SEEDS).toBeGreaterThanOrEqual(0.7)
  }, 120_000)
})
