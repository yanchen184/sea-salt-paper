import { cardPoints, DECLARE_MIN_POINTS, type GameState, type LegalActions, type PileIndex } from '../../engine'

export interface Hint {
  enabled: boolean
  reason: string | null
}

const OK: Hint = { enabled: true, reason: null }

function no(reason: string): Hint {
  return { enabled: false, reason }
}

const PHASE_REASONS = {
  draw: '要先抽牌庫或拿一張棄牌堆頂牌',
  chooseDrawn: '要先決定留下哪一張',
  crabPick: '要先從棄牌堆挑一張',
  actions: '這回合已經取過牌了',
} as const

function currentName(state: GameState): string {
  return state.players[state.current]?.name ?? ''
}

/** 不是自己可以行動的時機時回傳原因 */
function waitReason(state: GameState, legal: LegalActions): string | null {
  if (state.status !== 'playing') return '本局已經結束'
  if (!legal.isMyTurn) return `還沒輪到你，現在是 ${currentName(state)} 的回合`
  return null
}

export function myCardPoints(state: GameState, uid: string): number {
  const me = state.players.find((p) => p.id === uid)
  return me ? cardPoints([...me.hand, ...me.field]).total : 0
}

export function turnText(state: GameState, uid: string): string {
  if (state.status === 'gameOver') return '遊戲結束'
  if (state.status === 'roundEnd') return `第 ${state.round} 局結束`
  if (state.players[state.current]?.id !== uid) return `輪到 ${currentName(state)}`
  switch (state.phase) {
    case 'draw':
      return '輪到你：抽牌庫，或拿一張棄牌堆頂牌'
    case 'chooseDrawn':
      return '輪到你：選一張留下，另一張放到棄牌堆'
    case 'crabPick':
      return '輪到你：從棄牌堆挑一張入手'
    case 'actions':
      return '輪到你：可以打出 duo、宣告，或結束回合'
  }
}

export function drawDeckHint(state: GameState, legal: LegalActions): Hint {
  if (legal.drawDeck) return OK
  const wait = waitReason(state, legal)
  if (wait) return no(wait)
  if (state.phase !== 'draw') return no(PHASE_REASONS.actions)
  return no('牌庫沒有牌了')
}

export function takeDiscardHint(state: GameState, legal: LegalActions, pile: PileIndex): Hint {
  if (legal.takeDiscard.includes(pile)) return OK
  const wait = waitReason(state, legal)
  if (wait) return no(wait)
  if (state.phase !== 'draw') return no(PHASE_REASONS.actions)
  return no('這個棄牌堆是空的')
}

export function playDuoHint(state: GameState, legal: LegalActions, selected: readonly string[]): Hint {
  const wait = waitReason(state, legal)
  if (wait) return no(wait)
  if (state.phase !== 'actions') return no(PHASE_REASONS[state.phase])
  if (selected.length !== 2) return no('先點選兩張可以配對的手牌')
  const [a, b] = selected
  const legalPair = legal.duos.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
  return legalPair ? OK : no('這兩張不能配成一對')
}

export function declareHint(state: GameState, uid: string, legal: LegalActions): Hint {
  if (legal.declare) return OK
  const wait = waitReason(state, legal)
  if (wait) return no(wait)
  if (state.phase !== 'actions') return no(PHASE_REASONS[state.phase])
  if (state.declaration) return no('本局已經有人宣告了')
  return no(`卡牌分需達 ${DECLARE_MIN_POINTS} 分才能宣告（目前 ${myCardPoints(state, uid)} 分）`)
}

export function endTurnHint(state: GameState, legal: LegalActions): Hint {
  if (legal.endTurn) return OK
  const wait = waitReason(state, legal)
  if (wait) return no(wait)
  return no(PHASE_REASONS[state.phase])
}
