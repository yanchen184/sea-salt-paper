import type { GameEvent, GameState } from '../../../engine'

type Item = { kind: 'event'; event: GameEvent } | { kind: 'show'; game: GameState }

export interface AnimState {
  /** 最近一次收到的 game，用來判斷是否有新快照 */
  received: GameState
  /** 畫面上顯示的 game；播動畫時停在動作前 */
  shown: GameState
  playing: GameEvent | null
  pending: Item[]
  lastSeq: number
}

export type AnimAction = { type: 'receive'; game: GameState; enabled: boolean } | { type: 'done'; seq: number }

function eventsOf(game: GameState): GameEvent[] {
  // 部署前建立的遊戲沒有 events 欄位
  return game.events ?? []
}

function latestSeq(game: GameState): number {
  const events = eventsOf(game)
  return events[events.length - 1]?.seq ?? 0
}

export function initAnim(game: GameState): AnimState {
  return { received: game, shown: game, playing: null, pending: [], lastSeq: latestSeq(game) }
}

function advance(state: AnimState): AnimState {
  let { shown } = state
  const pending = [...state.pending]
  for (let item = pending.shift(); item; item = pending.shift()) {
    if (item.kind === 'event') return { ...state, shown, playing: item.event, pending }
    shown = item.game
  }
  return { ...state, shown, playing: null, pending }
}

function receive(state: AnimState, game: GameState, enabled: boolean): AnimState {
  const seq = latestSeq(game)
  if (!enabled || seq < state.lastSeq) return initAnim(game)

  const newEvents = eventsOf(game).filter((e) => e.seq > state.lastSeq)
  // 每個動作只產生 1 個事件；一次收到多個代表斷線補收，沒有中間狀態可當起點，直接顯示
  const fresh = newEvents.length > 1 ? [] : newEvents
  const last = state.pending[state.pending.length - 1]
  const queued = last?.kind === 'show' && fresh.length === 0 ? state.pending.slice(0, -1) : state.pending
  const pending: Item[] = [...queued, ...fresh.map((event) => ({ kind: 'event' as const, event })), { kind: 'show', game }]
  const next = { ...state, received: game, pending, lastSeq: seq }
  return state.playing ? next : advance(next)
}

export function animReducer(state: AnimState, action: AnimAction): AnimState {
  if (action.type === 'done') return state.playing?.seq === action.seq ? advance({ ...state, playing: null }) : state
  return receive(state, action.game, action.enabled)
}
