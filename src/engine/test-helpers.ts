import { buildDeck } from './cards'
import { applyAction, createGame, getLegalActions } from './game'
import { randomInt } from './rng'
import type { Action, Card, ErrorCode, GameState, Phase, PlayerSeat } from './types'

const ALL_CARDS = buildDeck()

export function card(id: string): Card {
  const found = ALL_CARDS.find((c) => c.id === id)
  if (!found) throw new Error(`沒有 ${id} 這張牌`)
  return found
}

export function cards(...ids: string[]): Card[] {
  return ids.map(card)
}

export const SEATS: PlayerSeat[] = [
  { id: 'a', name: 'Amy' },
  { id: 'b', name: 'Ben' },
  { id: 'c', name: 'Cat' },
  { id: 'd', name: 'Dan' },
]

export interface SetupOptions {
  players?: number
  hands?: string[][]
  fields?: string[][]
  scores?: number[]
  /** 省略時 = 其餘未使用的牌 */
  deck?: string[]
  discards?: [string[], string[]]
  current?: number
  phase?: Phase
}

/** 直接建構指定牌面的 state，不依賴洗牌結果 */
export function setup(opts: SetupOptions = {}): GameState {
  const count = opts.players ?? 2
  const base = createGame(SEATS.slice(0, count), 1)
  const hands = opts.hands ?? []
  const fields = opts.fields ?? []
  const discards = opts.discards ?? [[], []]
  const used = new Set([...hands.flat(), ...fields.flat(), ...discards.flat(), ...(opts.deck ?? [])])
  const deck = opts.deck ?? ALL_CARDS.filter((c) => !used.has(c.id)).map((c) => c.id)
  const current = opts.current ?? 0
  return {
    ...base,
    players: base.players.map((p, i) => ({
      ...p,
      hand: cards(...(hands[i] ?? [])),
      field: cards(...(fields[i] ?? [])),
      score: opts.scores?.[i] ?? 0,
    })),
    deck: cards(...deck),
    discards: [{ cards: cards(...discards[0]) }, { cards: cards(...discards[1]) }],
    roundStarter: current,
    current,
    phase: opts.phase ?? 'actions',
    log: [],
    events: [],
  }
}

export function act(state: GameState, playerId: string, action: Action): GameState {
  const result = applyAction(state, playerId, action)
  if (!result.ok) throw new Error(`${action.type} 失敗：${result.error.code}`)
  return result.state
}

export function rejectCode(state: GameState, playerId: string, action: Action): ErrorCode | null {
  const result = applyAction(state, playerId, action)
  return result.ok ? null : result.error.code
}

export function ids(list: readonly Card[]): string[] {
  return list.map((c) => c.id)
}

/** 從合法動作中隨機選一個；有可宣告時 30% 機率宣告 */
export function randomLegalAction(s: GameState, rng: number): [Action, string, number] {
  const actor = s.status === 'roundEnd' ? (s.players[0]?.id ?? '') : (s.players[s.current]?.id ?? '')
  const legal = getLegalActions(s, actor)
  const options: Action[] = []
  if (legal.nextRound) options.push({ type: 'NEXT_ROUND' })
  if (legal.drawDeck) options.push({ type: 'DRAW_DECK' })
  for (const pile of legal.takeDiscard) options.push({ type: 'TAKE_DISCARD', pile })
  if (legal.keepDrawn) {
    for (const keepCardId of legal.keepDrawn.cardIds)
      for (const discardPile of legal.keepDrawn.piles) options.push({ type: 'KEEP_DRAWN', keepCardId, discardPile })
  }
  const player = s.players[s.current]
  for (const cardIds of legal.duos) {
    const kinds = cardIds.map((id) => player?.hand.find((c) => c.id === id)?.kind)
    const action: Extract<Action, { type: 'PLAY_DUO' }> = { type: 'PLAY_DUO', cardIds }
    const pile = legal.crabPiles[0]
    if (kinds[0] === 'crab' && pile !== undefined) action.crab = { pile }
    if (kinds.includes('shark') && legal.stealTargets[0]) action.steal = { targetId: legal.stealTargets[0] }
    options.push(action)
  }
  for (const cardId of legal.crabPick ?? []) options.push({ type: 'PICK_CRAB', cardId })
  let r = rng
  if (legal.declare) {
    const [roll, next] = randomInt(r, 10)
    r = next
    if (roll < 3) {
      const [kind, next2] = randomInt(r, 2)
      return [{ type: 'DECLARE', kind: kind === 0 ? 'stop' : 'lastChance' }, actor, next2]
    }
  }
  if (legal.endTurn) options.push({ type: 'END_TURN' })
  const [i, next] = randomInt(r, options.length)
  const action = options[i]
  if (!action) throw new Error(`沒有合法動作：${JSON.stringify({ status: s.status, phase: s.phase, legal })}`)
  return [action, actor, next]
}
