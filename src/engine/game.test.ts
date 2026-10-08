import { describe, expect, it } from 'vitest'
import { applyAction, createGame, getLegalActions } from './game'
import type { Action, GameState } from './types'
import { SEATS, act, ids, rejectCode, setup } from './test-helpers'

/** shell 1–4 = 6、crab duo = 1 → 卡牌分 7 */
const SEVEN_A = ['shell-1', 'shell-2', 'shell-3', 'shell-4', 'crab-1', 'crab-2']
/** octopus 1–3 = 6、penguin-1 = 1 → 卡牌分 7 */
const SEVEN_B = ['octopus-1', 'octopus-2', 'octopus-3', 'penguin-1']
const BIG_PILE = ['fish-3', 'fish-4', 'fish-5', 'fish-6', 'fish-7', 'shark-4', 'shark-5', 'swimmer-4']

function playerOf(state: GameState, id: string) {
  const p = state.players.find((x) => x.id === id)
  if (!p) throw new Error(id)
  return p
}

/** 拿左棄牌堆頂後結束回合 */
function pass(state: GameState, playerId: string): GameState {
  return act(act(state, playerId, { type: 'TAKE_DISCARD', pile: 0 }), playerId, { type: 'END_TURN' })
}

function newLogs(before: GameState, after: GameState): string[] {
  return after.log.slice(before.log.length).map((l) => l.text)
}

describe('G1 開局', () => {
  it('[G1-1] 牌庫 56 張、兩棄牌堆各 1 張、所有人手牌 0', () => {
    const s = createGame(SEATS.slice(0, 3), 42)
    expect(s.deck).toHaveLength(56)
    expect(s.discards.map((d) => d.cards.length)).toEqual([1, 1])
    expect(s.players.every((p) => p.hand.length === 0 && p.field.length === 0)).toBe(true)
    const all = [...s.deck, ...s.discards.flatMap((d) => d.cards)]
    expect(new Set(all.map((c) => c.id)).size).toBe(58)
    expect(s.status).toBe('playing')
    expect(s.phase).toBe('draw')
  })

  it('[G1-2] 第一局起始玩家由 seed 決定且可重現', () => {
    const one = createGame(SEATS, 123)
    const two = createGame(SEATS, 123)
    expect(two).toEqual(one)
    const starters = new Set(Array.from({ length: 40 }, (_, seed) => createGame(SEATS, seed).roundStarter))
    expect(starters).toEqual(new Set([0, 1, 2, 3]))
  })

  it('[G1-2] state 可 JSON 序列化且不含 undefined', () => {
    const s = createGame(SEATS, 7)
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  it('[G1-3] 下一局起始玩家 = 上局宣告者下一位', () => {
    let s = setup({ players: 3, current: 1, hands: [[], SEVEN_A, []] })
    s = act(s, 'b', { type: 'DECLARE', kind: 'stop' })
    s = act(s, 'a', { type: 'NEXT_ROUND' })
    expect(s.roundStarter).toBe(2)
    expect(s.current).toBe(2)

    let w = setup({ players: 3, current: 2, hands: [[], [], SEVEN_A] })
    w = act(w, 'c', { type: 'DECLARE', kind: 'stop' })
    w = act(w, 'a', { type: 'NEXT_ROUND' })
    expect(w.roundStarter).toBe(0)
  })

  it('[G1-3] 上局無人宣告 → 上局起始玩家下一位', () => {
    let s = setup({ players: 3, current: 1, deck: [] })
    s = act(s, 'b', { type: 'END_TURN' })
    expect(s.roundResult?.reason).toBe('void')
    s = act(s, 'a', { type: 'NEXT_ROUND' })
    expect(s.roundStarter).toBe(2)
  })
})

describe('G2 回合開始', () => {
  it('[G2-1] 只有當前玩家能送出動作', () => {
    const s = setup({ phase: 'draw', current: 0, discards: [['shell-5'], ['shell-6']] })
    expect(rejectCode(s, 'b', { type: 'DRAW_DECK' })).toBe('NOT_YOUR_TURN')
    expect(rejectCode(s, 'b', { type: 'TAKE_DISCARD', pile: 0 })).toBe('NOT_YOUR_TURN')
    expect(rejectCode(s, 'zzz', { type: 'DRAW_DECK' })).toBe('UNKNOWN_PLAYER')
    expect(getLegalActions(s, 'b').isMyTurn).toBe(false)
    expect(getLegalActions(s, 'a').isMyTurn).toBe(true)
  })

  it('[G2-2] 未取牌前不能打 Duo、宣告或結束回合', () => {
    const s = setup({ phase: 'draw', hands: [SEVEN_A, []], discards: [['shell-5'], ['shell-6']] })
    expect(rejectCode(s, 'a', { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'] })).toBe('WRONG_PHASE')
    expect(rejectCode(s, 'a', { type: 'DECLARE', kind: 'stop' })).toBe('WRONG_PHASE')
    expect(rejectCode(s, 'a', { type: 'END_TURN' })).toBe('WRONG_PHASE')
    const legal = getLegalActions(s, 'a')
    expect(legal).toMatchObject({ declare: false, endTurn: false, duos: [] })
  })

  it('[G2-3] 牌庫與兩棄牌堆皆空時跳過取牌', () => {
    // 牌庫空、只剩右堆 1 張；b 拿走後，額外回合無牌可取
    let s = setup({ hands: [SEVEN_A, ['boat-1', 'boat-2']], deck: [], discards: [[], ['shell-5']] })
    s = act(s, 'a', { type: 'DECLARE', kind: 'lastChance' })
    expect(s.current).toBe(1)
    expect(s.phase).toBe('draw')
    s = act(s, 'b', { type: 'TAKE_DISCARD', pile: 1 })
    s = act(s, 'b', { type: 'PLAY_DUO', cardIds: ['boat-1', 'boat-2'] })
    s = act(s, 'b', { type: 'END_TURN' })
    // 帆船額外回合：牌庫與棄牌堆都空 → 直接進入 actions
    expect(s.current).toBe(1)
    expect(s.phase).toBe('actions')
    expect(getLegalActions(s, 'b')).toMatchObject({ drawDeck: false, takeDiscard: [], endTurn: true })
    s = act(s, 'b', { type: 'END_TURN' })
    expect(s.roundResult?.reason).toBe('lastChance')
  })

  it('[G2-2] 傳入的 state 不被修改', () => {
    const s = setup({ phase: 'draw', discards: [['shell-5'], ['shell-6']] })
    const snapshot = structuredClone(s)
    act(s, 'a', { type: 'DRAW_DECK' })
    expect(s).toEqual(snapshot)
  })
})

describe('G3a 抽牌庫', () => {
  it('[G3a-1] 拿牌庫頂 2 張，留 1 張入手、1 張放到指定棄牌堆頂', () => {
    let s = setup({ phase: 'draw', deck: ['octopus-1', 'boat-1', 'fish-1'], discards: [['shell-1'], ['shell-2']] })
    s = act(s, 'a', { type: 'DRAW_DECK' })
    expect(s.phase).toBe('chooseDrawn')
    expect(ids(s.pendingDraw)).toEqual(['octopus-1', 'boat-1'])
    expect(ids(s.deck)).toEqual(['fish-1'])
    expect(getLegalActions(s, 'a').keepDrawn).toEqual({ cardIds: ['octopus-1', 'boat-1'], piles: [0, 1] })

    const before = s
    s = act(s, 'a', { type: 'KEEP_DRAWN', keepCardId: 'octopus-1', discardPile: 1 })
    expect(ids(playerOf(s, 'a').hand)).toEqual(['octopus-1'])
    expect(ids(s.discards[1].cards)).toEqual(['shell-2', 'boat-1'])
    expect(s.pendingDraw).toEqual([])
    expect(s.phase).toBe('actions')
    // 放進棄牌堆的牌公開；留下的那張不出現
    expect(newLogs(before, s)).toEqual(['Amy 留下 1 張，把深藍帆船放到右棄牌堆'])
  })

  it('[G3a-1] 留下的牌必須是抽到的其中一張', () => {
    const s = act(setup({ phase: 'draw', deck: ['octopus-1', 'boat-1'], discards: [['shell-1'], ['shell-2']] }), 'a', {
      type: 'DRAW_DECK',
    })
    expect(rejectCode(s, 'a', { type: 'KEEP_DRAWN', keepCardId: 'shell-1', discardPile: 0 })).toBe('CARD_NOT_FOUND')
  })

  it('[G3a-2] 有空棄牌堆時只能放空的那堆', () => {
    const s = act(setup({ phase: 'draw', deck: ['octopus-1', 'boat-1'], discards: [['shell-1'], []] }), 'a', {
      type: 'DRAW_DECK',
    })
    expect(getLegalActions(s, 'a').keepDrawn?.piles).toEqual([1])
    expect(rejectCode(s, 'a', { type: 'KEEP_DRAWN', keepCardId: 'boat-1', discardPile: 0 })).toBe('MUST_USE_EMPTY_PILE')
    const ok = act(s, 'a', { type: 'KEEP_DRAWN', keepCardId: 'boat-1', discardPile: 1 })
    expect(ids(ok.discards[1].cards)).toEqual(['octopus-1'])
  })

  it('[G3a-3] 牌庫剩 1 張時直接入手', () => {
    const s = act(setup({ phase: 'draw', deck: ['octopus-1'], discards: [['shell-1'], []] }), 'a', { type: 'DRAW_DECK' })
    expect(ids(playerOf(s, 'a').hand)).toEqual(['octopus-1'])
    expect(s.deck).toEqual([])
    expect(s.phase).toBe('actions')
    expect(s.discards[1].cards).toEqual([])
  })

  it('[G3a-4] 牌庫 0 張時不可選', () => {
    const s = setup({ phase: 'draw', deck: [], discards: [['shell-1'], []] })
    expect(rejectCode(s, 'a', { type: 'DRAW_DECK' })).toBe('DECK_EMPTY')
    expect(getLegalActions(s, 'a').drawDeck).toBe(false)
  })
})

describe('G3b 拿棄牌堆', () => {
  it('[G3b-1] 拿指定棄牌堆頂牌入手', () => {
    let s = setup({ phase: 'draw', discards: [['shell-1', 'shell-2'], ['octopus-1']] })
    s = act(s, 'a', { type: 'TAKE_DISCARD', pile: 0 })
    expect(ids(playerOf(s, 'a').hand)).toEqual(['shell-2'])
    expect(ids(s.discards[0].cards)).toEqual(['shell-1'])
    expect(s.phase).toBe('actions')
  })

  it('[G3b-2] 空棄牌堆不可選', () => {
    const s = setup({ phase: 'draw', discards: [['shell-1'], []] })
    expect(rejectCode(s, 'a', { type: 'TAKE_DISCARD', pile: 1 })).toBe('PILE_EMPTY')
    expect(getLegalActions(s, 'a').takeDiscard).toEqual([0])
  })
})

describe('G4 Duo 共通', () => {
  it('[G4-1] 只接受 crab/crab、boat/boat、fish/fish、shark/swimmer', () => {
    const hand = ['crab-1', 'crab-2', 'boat-1', 'boat-2', 'fish-1', 'fish-2', 'shark-1', 'swimmer-1', 'shark-2', 'swimmer-2', 'shell-1', 'shell-2', 'mermaid-1', 'mermaid-2']
    const s = setup({ hands: [hand, ['octopus-1']], discards: [['penguin-1'], []] })
    for (const pair of [
      ['crab-1', 'boat-1'],
      ['shark-1', 'shark-2'],
      ['swimmer-1', 'swimmer-2'],
      ['shell-1', 'shell-2'],
      ['mermaid-1', 'mermaid-2'],
      ['crab-1', 'crab-1'],
    ] as [string, string][]) {
      expect(rejectCode(s, 'a', { type: 'PLAY_DUO', cardIds: pair })).toBe('INVALID_DUO')
    }
    expect(rejectCode(s, 'a', { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-3'] })).toBe('CARD_NOT_FOUND')
    act(s, 'a', { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'], crab: { pile: 0 } })
    act(s, 'a', { type: 'PLAY_DUO', cardIds: ['boat-1', 'boat-2'] })
    act(s, 'a', { type: 'PLAY_DUO', cardIds: ['fish-1', 'fish-2'] })
    act(s, 'a', { type: 'PLAY_DUO', cardIds: ['swimmer-1', 'shark-1'], steal: { targetId: 'b' } })
    const duos = getLegalActions(s, 'a').duos
    expect(duos).toContainEqual(['shark-1', 'swimmer-2'])
    expect(duos).not.toContainEqual(['shark-1', 'shark-2'])
  })

  it('[G4-2] 打出的牌從手牌移到自己場上', () => {
    let s = setup({ hands: [['boat-1', 'shell-1', 'boat-2'], []] })
    s = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['boat-1', 'boat-2'] })
    expect(ids(playerOf(s, 'a').hand)).toEqual(['shell-1'])
    expect(ids(playerOf(s, 'a').field)).toEqual(['boat-1', 'boat-2'])
  })

  it('[G4-3] 一回合可打多對', () => {
    let s = setup({ hands: [['boat-1', 'boat-2', 'fish-1', 'fish-2'], []], deck: ['shell-1', 'shell-2'] })
    s = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['boat-1', 'boat-2'] })
    s = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['fish-1', 'fish-2'] })
    expect(playerOf(s, 'a').field).toHaveLength(4)
    expect(ids(playerOf(s, 'a').hand)).toEqual(['shell-1'])
  })

  it('[G4-4] 效果無法執行時仍可打出', () => {
    const s = setup({
      hands: [['crab-1', 'crab-2', 'fish-1', 'fish-2', 'shark-1', 'swimmer-1'], []],
      deck: [],
      discards: [[], []],
    })
    let t = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'] })
    t = act(t, 'a', { type: 'PLAY_DUO', cardIds: ['fish-1', 'fish-2'] })
    t = act(t, 'a', { type: 'PLAY_DUO', cardIds: ['shark-1', 'swimmer-1'] })
    expect(playerOf(t, 'a').field).toHaveLength(6)
    expect(playerOf(t, 'a').hand).toEqual([])
  })
})

describe('G4a crab', () => {
  it('[G4a-1] 指定非空棄牌堆挑任意 1 張入手，其餘順序不變', () => {
    const s = setup({ hands: [['crab-1', 'crab-2'], []], discards: [['shell-1', 'octopus-1', 'boat-1'], ['fish-1']] })
    expect(rejectCode(s, 'a', { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'] })).toBe('CRAB_TARGET_REQUIRED')
    let t = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'], crab: { pile: 0 } })
    expect(rejectCode(t, 'a', { type: 'PICK_CRAB', cardId: 'fish-1' })).toBe('CARD_NOT_FOUND')
    t = act(t, 'a', { type: 'PICK_CRAB', cardId: 'octopus-1' })
    expect(ids(playerOf(t, 'a').hand)).toEqual(['octopus-1'])
    expect(ids(t.discards[0].cards)).toEqual(['shell-1', 'boat-1'])
    expect(ids(t.discards[1].cards)).toEqual(['fish-1'])
    expect(t.phase).toBe('actions')
    expect(t.crabPile).toBeNull()
  })

  it('[G4a-2] 被挑的牌不出現在動作紀錄', () => {
    const s = setup({ hands: [['crab-1', 'crab-2'], []], discards: [['shell-1', 'octopus-1', 'boat-1'], ['fish-1']] })
    const t = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'], crab: { pile: 0 } })
    const u = act(t, 'a', { type: 'PICK_CRAB', cardId: 'octopus-1' })
    expect(newLogs(s, u)).toEqual(['Amy 打出螃蟹對，正在從左棄牌堆挑牌', 'Amy 從左棄牌堆挑了 1 張'])
    expect(newLogs(s, u).join()).not.toMatch(/章魚/)
  })

  it('[G4a-3] 打出時只指定棄牌堆，之後才挑牌', () => {
    const s = setup({ hands: [['crab-1', 'crab-2'], []], discards: [['shell-1', 'octopus-1'], []] })
    expect(getLegalActions(s, 'a').crabPick).toBeNull()
    expect(rejectCode(s, 'a', { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'], crab: { pile: 1 } })).toBe(
      'INVALID_CRAB_TARGET',
    )
    const t = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'], crab: { pile: 0 } })
    expect(t.phase).toBe('crabPick')
    expect(t.crabPile).toBe(0)
    expect(ids(playerOf(t, 'a').field)).toEqual(['crab-1', 'crab-2'])
    expect(getLegalActions(t, 'a').crabPick).toEqual(['shell-1', 'octopus-1'])
    expect(getLegalActions(t, 'b').crabPick).toBeNull()
  })

  it('[G4a-3] 挑牌階段只接受 PICK_CRAB', () => {
    const s = setup({ hands: [['crab-1', 'crab-2', 'boat-1', 'boat-2'], []], discards: [['shell-1'], []] })
    const t = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'], crab: { pile: 0 } })
    expect(rejectCode(t, 'a', { type: 'END_TURN' })).toBe('MUST_PICK_CRAB')
    expect(rejectCode(t, 'a', { type: 'PLAY_DUO', cardIds: ['boat-1', 'boat-2'] })).toBe('MUST_PICK_CRAB')
    expect(rejectCode(t, 'a', { type: 'DECLARE', kind: 'stop' })).toBe('MUST_PICK_CRAB')
    expect(rejectCode(t, 'a', { type: 'NEXT_ROUND' })).toBe('MUST_PICK_CRAB')
    expect(rejectCode(t, 'b', { type: 'PICK_CRAB', cardId: 'shell-1' })).toBe('NOT_YOUR_TURN')
    expect(rejectCode(s, 'a', { type: 'PICK_CRAB', cardId: 'shell-1' })).toBe('WRONG_PHASE')
    const legal = getLegalActions(t, 'a')
    expect(legal.endTurn || legal.declare || legal.duos.length > 0).toBe(false)
  })

  it('[G4a-3] 挑到第 4 張美人魚立即獲勝', () => {
    const s = setup({ hands: [['crab-1', 'crab-2', 'mermaid-1', 'mermaid-2', 'mermaid-3'], []], discards: [['mermaid-4'], []] })
    const t = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['crab-1', 'crab-2'], crab: { pile: 0 } })
    expect(t.status).toBe('playing')
    expect(act(t, 'a', { type: 'PICK_CRAB', cardId: 'mermaid-4' }).winReason).toBe('mermaids')
  })
})

describe('G4b boat', () => {
  it('[G4b-1] 本回合結束後同一玩家再一回合', () => {
    let s = setup({ hands: [['boat-1', 'boat-2'], []] })
    s = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['boat-1', 'boat-2'] })
    s = act(s, 'a', { type: 'END_TURN' })
    expect(s.current).toBe(0)
    expect(s.phase).toBe('draw')
    expect(s.extraTurn).toBe(false)
  })

  it('[G4b-2] 一回合打多對 boat 只多 1 回合', () => {
    let s = setup({ hands: [['boat-1', 'boat-2', 'boat-3', 'boat-4'], []], discards: [BIG_PILE, []] })
    s = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['boat-1', 'boat-2'] })
    s = act(s, 'a', { type: 'PLAY_DUO', cardIds: ['boat-3', 'boat-4'] })
    s = act(s, 'a', { type: 'END_TURN' })
    expect(s.current).toBe(0)
    s = pass(s, 'a')
    expect(s.current).toBe(1)
  })

  it('[G4b-3] 宣告 STOP/LAST CHANCE 時額外回合作廢', () => {
    const base = setup({ hands: [[...SEVEN_A, 'boat-1', 'boat-2'], ['fish-1']] })
    const withBoat = act(base, 'a', { type: 'PLAY_DUO', cardIds: ['boat-1', 'boat-2'] })
    const lc = act(withBoat, 'a', { type: 'DECLARE', kind: 'lastChance' })
    expect(lc.current).toBe(1)
    expect(lc.extraTurn).toBe(false)
    const stop = act(withBoat, 'a', { type: 'DECLARE', kind: 'stop' })
    expect(stop.status).toBe('roundEnd')
    expect(stop.extraTurn).toBe(false)
  })
})

describe('G4c fish', () => {
  it('[G4c-1] 牌庫頂 1 張入手', () => {
    const s = act(setup({ hands: [['fish-1', 'fish-2'], []], deck: ['octopus-1', 'shell-1'] }), 'a', {
      type: 'PLAY_DUO',
      cardIds: ['fish-1', 'fish-2'],
    })
    expect(ids(playerOf(s, 'a').hand)).toEqual(['octopus-1'])
    expect(ids(s.deck)).toEqual(['shell-1'])
  })

  it('[G4c-2] 牌庫空時無效果', () => {
    const s = act(setup({ hands: [['fish-1', 'fish-2'], []], deck: [] }), 'a', {
      type: 'PLAY_DUO',
      cardIds: ['fish-1', 'fish-2'],
    })
    expect(playerOf(s, 'a').hand).toEqual([])
    expect(playerOf(s, 'a').field).toHaveLength(2)
  })
})

describe('G4d shark+swimmer', () => {
  const steal: Action = { type: 'PLAY_DUO', cardIds: ['shark-1', 'swimmer-1'], steal: { targetId: 'b' } }

  it('[G4d-1] 指定手牌非空的對手隨機偷 1 張，同 state 可重現', () => {
    const s = setup({ players: 3, hands: [['shark-1', 'swimmer-1'], ['shell-1', 'shell-2', 'octopus-1'], []] })
    const one = act(s, 'a', steal)
    const two = act(s, 'a', steal)
    expect(two).toEqual(one)
    const stolen = playerOf(one, 'a').hand
    expect(stolen).toHaveLength(1)
    expect(['shell-1', 'shell-2', 'octopus-1']).toContain(stolen[0]?.id)
    expect(playerOf(one, 'b').hand).toHaveLength(2)
    expect(one.rngState).not.toBe(s.rngState)
    expect(newLogs(s, one)).toEqual(['Amy 打出鯊魚與游泳者，從 Ben 手中偷了 1 張'])

    expect(getLegalActions(s, 'a').stealTargets).toEqual(['b'])
    expect(rejectCode(s, 'a', { type: 'PLAY_DUO', cardIds: ['shark-1', 'swimmer-1'] })).toBe('STEAL_TARGET_REQUIRED')
    expect(
      rejectCode(s, 'a', { type: 'PLAY_DUO', cardIds: ['shark-1', 'swimmer-1'], steal: { targetId: 'c' } }),
    ).toBe('INVALID_STEAL_TARGET')
    expect(
      rejectCode(s, 'a', { type: 'PLAY_DUO', cardIds: ['shark-1', 'swimmer-1'], steal: { targetId: 'a' } }),
    ).toBe('INVALID_STEAL_TARGET')
  })

  it('[G4d-2] LAST CHANCE 宣告者不可被指定', () => {
    let s = setup({ hands: [SEVEN_A, ['shark-1', 'swimmer-1']], discards: [['shell-5'], []] })
    s = act(s, 'a', { type: 'DECLARE', kind: 'lastChance' })
    s = act(s, 'b', { type: 'TAKE_DISCARD', pile: 0 })
    expect(getLegalActions(s, 'b').stealTargets).toEqual([])
    expect(
      rejectCode(s, 'b', { type: 'PLAY_DUO', cardIds: ['shark-1', 'swimmer-1'], steal: { targetId: 'a' } }),
    ).toBe('INVALID_STEAL_TARGET')
    const t = act(s, 'b', { type: 'PLAY_DUO', cardIds: ['shark-1', 'swimmer-1'] })
    expect(playerOf(t, 'a').hand).toHaveLength(SEVEN_A.length)
  })
})

describe('G5 宣告', () => {
  it('[G5-1] 卡牌分 < 7 不可宣告', () => {
    // shell 1–4 = 6
    const s = setup({ hands: [['shell-1', 'shell-2', 'shell-3', 'shell-4'], []] })
    expect(rejectCode(s, 'a', { type: 'DECLARE', kind: 'stop' })).toBe('NOT_ENOUGH_POINTS')
    expect(rejectCode(s, 'a', { type: 'DECLARE', kind: 'lastChance' })).toBe('NOT_ENOUGH_POINTS')
    expect(getLegalActions(s, 'a').declare).toBe(false)
  })

  it('[G5-1] 卡牌分含場上的 duo', () => {
    // 手上 shell 1–4 = 6、場上 crab duo = 1 → 7
    const s = setup({ hands: [['shell-1', 'shell-2', 'shell-3', 'shell-4'], []], fields: [['crab-1', 'crab-2'], []] })
    expect(getLegalActions(s, 'a').declare).toBe(true)
  })

  it('[G5-2] STOP 直接進計分', () => {
    const s = act(setup({ hands: [SEVEN_A, SEVEN_B] }), 'a', { type: 'DECLARE', kind: 'stop' })
    expect(s.status).toBe('roundEnd')
    expect(s.roundResult).toMatchObject({ reason: 'stop', declarerId: 'a' })
    expect(s.players.map((p) => p.score)).toEqual([7, 7])
  })

  it('[G5-3] LAST CHANCE 後其他玩家各一回合，再進計分', () => {
    let s = setup({ players: 3, hands: [SEVEN_A, [], []], discards: [BIG_PILE, []] })
    s = act(s, 'a', { type: 'DECLARE', kind: 'lastChance' })
    expect(s.status).toBe('playing')
    expect(s.current).toBe(1)
    expect(rejectCode(s, 'b', { type: 'DECLARE', kind: 'stop' })).toBe('WRONG_PHASE')
    s = pass(s, 'b')
    expect(s.current).toBe(2)
    s = pass(s, 'c')
    expect(s.status).toBe('roundEnd')
    expect(s.roundResult).toMatchObject({ reason: 'lastChance', declarerId: 'a', declarerWon: true })
  })

  it('[G5-3] LAST CHANCE 期間不能再宣告', () => {
    let s = setup({ hands: [SEVEN_A, SEVEN_B], discards: [BIG_PILE, []] })
    s = act(s, 'a', { type: 'DECLARE', kind: 'lastChance' })
    s = act(s, 'b', { type: 'TAKE_DISCARD', pile: 0 })
    expect(rejectCode(s, 'b', { type: 'DECLARE', kind: 'stop' })).toBe('ALREADY_DECLARED')
    expect(getLegalActions(s, 'b').declare).toBe(false)
  })
})

describe('G6 回合結束', () => {
  it('[G6-1] 牌庫空且無人宣告 → 本局作廢 0 分', () => {
    const s = act(setup({ hands: [SEVEN_A, SEVEN_B], scores: [3, 4], deck: [] }), 'a', { type: 'END_TURN' })
    expect(s.status).toBe('roundEnd')
    expect(s.roundResult?.reason).toBe('void')
    expect(s.roundResult?.scores.map((x) => x.gained)).toEqual([0, 0])
    expect(s.players.map((p) => p.score)).toEqual([3, 4])
  })

  it('[G6-1] 牌庫空但已有 LAST CHANCE 時不作廢', () => {
    let s = setup({ hands: [SEVEN_A, []], deck: [], discards: [BIG_PILE, []] })
    s = act(s, 'a', { type: 'DECLARE', kind: 'lastChance' })
    s = pass(s, 'b')
    expect(s.roundResult?.reason).toBe('lastChance')
  })

  it('[G6-2] LAST CHANCE 中帆船額外回合照常', () => {
    let s = setup({ hands: [SEVEN_A, ['boat-1', 'boat-2']], discards: [BIG_PILE, []] })
    s = act(s, 'a', { type: 'DECLARE', kind: 'lastChance' })
    s = act(s, 'b', { type: 'TAKE_DISCARD', pile: 0 })
    s = act(s, 'b', { type: 'PLAY_DUO', cardIds: ['boat-1', 'boat-2'] })
    s = act(s, 'b', { type: 'END_TURN' })
    expect(s.status).toBe('playing')
    expect(s.current).toBe(1)
    s = pass(s, 'b')
    expect(s.status).toBe('roundEnd')
  })

  it('[G6-3] 輪替順序正確', () => {
    let s = setup({ players: 3, current: 1, phase: 'draw', discards: [BIG_PILE, []] })
    const order: number[] = []
    for (let i = 0; i < 4; i++) {
      order.push(s.current)
      s = pass(s, SEATS[s.current]?.id ?? '')
    }
    expect(order).toEqual([1, 2, 0, 1])
  })
})

describe('G8 局間', () => {
  it('[G8-1] 總分累加', () => {
    let s = setup({ hands: [SEVEN_A, SEVEN_B], scores: [5, 3] })
    s = act(s, 'a', { type: 'DECLARE', kind: 'stop' })
    // a 5 + 7 = 12；b 3 + 7 = 10
    expect(s.players.map((p) => p.score)).toEqual([12, 10])
    s = act(s, 'b', { type: 'NEXT_ROUND' })
    expect(s.players.map((p) => p.score)).toEqual([12, 10])
  })

  it('[G8-2] 未達標時開新局，所有牌回收重洗', () => {
    let s = setup({ hands: [SEVEN_A, SEVEN_B], fields: [['boat-1', 'boat-2'], []] })
    expect(rejectCode(s, 'a', { type: 'NEXT_ROUND' })).toBe('NOT_ROUND_END')
    s = act(s, 'a', { type: 'DECLARE', kind: 'stop' })
    const before = s
    s = act(s, 'a', { type: 'NEXT_ROUND' })
    expect(s.round).toBe(before.round + 1)
    expect(s.status).toBe('playing')
    expect(s.phase).toBe('draw')
    expect(s.declaration).toBeNull()
    expect(s.roundResult).toBeNull()
    expect(s.deck).toHaveLength(56)
    expect(s.players.every((p) => p.hand.length === 0 && p.field.length === 0)).toBe(true)
    const all = [...s.deck, ...s.discards.flatMap((d) => d.cards)]
    expect(new Set(all.map((c) => c.id)).size).toBe(58)
  })
})

describe('G9 遊戲結束', () => {
  it('[G9-1] 目標分 2/3/4 人 = 40/35/30', () => {
    expect(createGame(SEATS.slice(0, 2), 1).targetScore).toBe(40)
    expect(createGame(SEATS.slice(0, 3), 1).targetScore).toBe(35)
    expect(createGame(SEATS.slice(0, 4), 1).targetScore).toBe(30)
    expect(() => createGame(SEATS.slice(0, 1), 1)).toThrow()
  })

  it('[G9-1] 達目標分結束，最高分勝', () => {
    // a 34 + 7 = 41 ≥ 40；b 30 + 7 = 37
    const s = act(setup({ hands: [SEVEN_A, SEVEN_B], scores: [34, 30] }), 'a', { type: 'DECLARE', kind: 'stop' })
    expect(s.status).toBe('gameOver')
    expect(s.winnerId).toBe('a')
    expect(s.winReason).toBe('score')
    expect(rejectCode(s, 'a', { type: 'NEXT_ROUND' })).toBe('NOT_ROUND_END')
    expect(getLegalActions(s, 'a').nextRound).toBe(false)
  })

  it('[G9-1] 達標者不一定最高分', () => {
    // a 33 + 7 = 40；b 36 + 7 = 43 → b 勝
    const s = act(setup({ hands: [SEVEN_A, SEVEN_B], scores: [33, 36] }), 'a', { type: 'DECLARE', kind: 'stop' })
    expect(s.winnerId).toBe('b')
  })

  it('[G9-2] 平手時本局座位順序較後者勝', () => {
    // 起始玩家 a：a 33 + 7 = 40、b 33 + 7 = 40；b 順序 1 > a 順序 0 → b 勝
    const s = act(setup({ hands: [SEVEN_A, SEVEN_B], scores: [33, 33] }), 'a', { type: 'DECLARE', kind: 'stop' })
    expect(s.winnerId).toBe('b')
    // 起始玩家 b：a 順序 1 > b 順序 0 → a 勝
    const t = act(setup({ hands: [SEVEN_B, SEVEN_A], scores: [33, 33], current: 1 }), 'b', {
      type: 'DECLARE',
      kind: 'stop',
    })
    expect(t.winnerId).toBe('a')
  })

  it('[G9-3] 持有 4 張美人魚立即獲勝', () => {
    const s = setup({
      phase: 'draw',
      hands: [['mermaid-1', 'mermaid-2', 'mermaid-3'], []],
      discards: [['mermaid-4'], []],
    })
    const t = act(s, 'a', { type: 'TAKE_DISCARD', pile: 0 })
    expect(t.status).toBe('gameOver')
    expect(t.winnerId).toBe('a')
    expect(t.winReason).toBe('mermaids')
    expect(rejectCode(t, 'a', { type: 'END_TURN' })).toBe('GAME_NOT_PLAYING')
  })

  it('[G9-3] 偷到第 4 張美人魚也立即獲勝', () => {
    const s = setup({ hands: [['mermaid-1', 'mermaid-2', 'mermaid-3', 'shark-1', 'swimmer-1'], ['mermaid-4']] })
    const r = applyAction(s, 'a', { type: 'PLAY_DUO', cardIds: ['shark-1', 'swimmer-1'], steal: { targetId: 'b' } })
    expect(r.ok && r.state.winReason).toBe('mermaids')
  })
})
