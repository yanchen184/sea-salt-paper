import { buildDeck } from './cards'
import { applyAction, createGame } from './game'
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
