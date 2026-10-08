import { buildDeck, describeCard } from './cards'
import { randomInt, shuffle } from './rng'
import { cardPoints, scoreRound } from './scoring'
import type {
  Action,
  ActionError,
  ActionResult,
  Card,
  CardKind,
  ErrorCode,
  GameState,
  LegalActions,
  PileIndex,
  PlayerSeat,
  PlayerState,
} from './types'

export const DECLARE_MIN_POINTS = 7
export const TARGET_SCORES: Readonly<Record<number, number>> = { 2: 40, 3: 35, 4: 30 }

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNKNOWN_PLAYER: '你不在這場遊戲中',
  UNKNOWN_ACTION: '未知的動作',
  GAME_NOT_PLAYING: '這一局已經結束',
  NOT_YOUR_TURN: '還沒輪到你',
  WRONG_PHASE: '現在不能做這個動作',
  DECK_EMPTY: '牌庫已經沒有牌',
  INVALID_PILE: '棄牌堆只能選左或右',
  PILE_EMPTY: '這個棄牌堆是空的',
  MUST_USE_EMPTY_PILE: '有空的棄牌堆時，必須放到空的那一堆',
  CARD_NOT_FOUND: '找不到這張牌',
  INVALID_DUO: '這兩張牌不能組成 Duo',
  CRAB_TARGET_REQUIRED: '請選擇要從哪個棄牌堆拿哪一張牌',
  INVALID_CRAB_TARGET: '這張牌不在指定的棄牌堆裡',
  STEAL_TARGET_REQUIRED: '請選擇要偷牌的對手',
  INVALID_STEAL_TARGET: '不能偷這位玩家的牌',
  ALREADY_DECLARED: '這一局已經有人宣告',
  NOT_ENOUGH_POINTS: `卡牌分至少 ${DECLARE_MIN_POINTS} 分才能宣告`,
  NOT_ROUND_END: '這一局還沒結束',
}

const PILE_NAMES = ['左', '右'] as const

type DuoEffect = 'crab' | 'boat' | 'fish' | 'steal'

function fail(code: ErrorCode): ActionError {
  return { code, message: ERROR_MESSAGES[code] }
}

function isPile(value: unknown): value is PileIndex {
  return value === 0 || value === 1
}

function duoEffect(a: CardKind, b: CardKind): DuoEffect | null {
  if (a === b && (a === 'crab' || a === 'boat' || a === 'fish')) return a
  if ((a === 'shark' && b === 'swimmer') || (a === 'swimmer' && b === 'shark')) return 'steal'
  return null
}

function allCards(player: PlayerState): Card[] {
  return [...player.hand, ...player.field]
}

function currentPlayer(s: GameState): PlayerState {
  const player = s.players[s.current]
  if (!player) throw new Error(`current ${s.current} 超出玩家範圍`)
  return player
}

function addLog(s: GameState, text: string): void {
  s.log.push({ round: s.round, text })
}

function nonEmptyPiles(s: GameState): PileIndex[] {
  return ([0, 1] as const).filter((i) => s.discards[i].cards.length > 0)
}

function emptyPiles(s: GameState): PileIndex[] {
  return ([0, 1] as const).filter((i) => s.discards[i].cards.length === 0)
}

function stealTargets(s: GameState, thiefIndex: number): string[] {
  const protectedId = s.declaration?.kind === 'lastChance' ? s.declaration.playerId : null
  return s.players
    .filter((p, i) => i !== thiefIndex && p.hand.length > 0 && p.id !== protectedId)
    .map((p) => p.id)
}

function startRound(s: GameState, starter: number): void {
  const [deck, rngState] = shuffle(buildDeck(), s.rngState)
  const [left, right, ...rest] = deck
  if (!left || !right) throw new Error('牌組不足 2 張')
  s.rngState = rngState
  s.deck = rest
  s.discards = [{ cards: [left] }, { cards: [right] }]
  s.players = s.players.map((p) => ({ ...p, hand: [], field: [] }))
  s.round += 1
  s.roundStarter = starter
  s.current = starter
  s.phase = 'draw'
  s.status = 'playing'
  s.pendingDraw = []
  s.extraTurn = false
  s.declaration = null
  s.roundResult = null
  addLog(s, `第 ${s.round} 局開始，由 ${currentPlayer(s).name} 先手`)
}

export function createGame(players: PlayerSeat[], seed: number): GameState {
  const targetScore = TARGET_SCORES[players.length]
  if (targetScore === undefined) throw new Error('玩家人數須為 2–4 人')
  if (new Set(players.map((p) => p.id)).size !== players.length) throw new Error('玩家 id 重複')

  const [starter, rngState] = randomInt(seed >>> 0, players.length)
  const s: GameState = {
    players: players.map((p) => ({ id: p.id, name: p.name, hand: [], field: [], score: 0 })),
    deck: [],
    discards: [{ cards: [] }, { cards: [] }],
    rngState,
    round: 0,
    targetScore,
    roundStarter: starter,
    current: starter,
    phase: 'draw',
    status: 'playing',
    pendingDraw: [],
    extraTurn: false,
    declaration: null,
    roundResult: null,
    winnerId: null,
    winReason: null,
    log: [],
  }
  startRound(s, starter)
  return s
}

/** 規則 §7：最高分勝；平手時以本局起始玩家為 0 起算，座位順序較後者勝 */
function pickWinner(s: GameState): PlayerState {
  const n = s.players.length
  const order = (i: number) => (i - s.roundStarter + n) % n
  let best = 0
  s.players.forEach((p, i) => {
    const b = s.players[best] as PlayerState
    if (p.score > b.score || (p.score === b.score && order(i) > order(best))) best = i
  })
  return s.players[best] as PlayerState
}

function finishRound(s: GameState): void {
  if (!s.declaration) throw new Error('沒有宣告不能計分')
  const { declarerWon, scores } = scoreRound(s.players, s.declaration)
  s.players = s.players.map((p, i) => ({ ...p, score: p.score + (scores[i]?.gained ?? 0) }))
  s.roundResult = { reason: s.declaration.kind, declarerId: s.declaration.playerId, declarerWon, scores }
  s.status = 'roundEnd'
  addLog(s, `第 ${s.round} 局結束：${scores.map((sc, i) => `${s.players[i]?.name} +${sc.gained}`).join('、')}`)

  if (s.players.some((p) => p.score >= s.targetScore)) {
    const winner = pickWinner(s)
    s.status = 'gameOver'
    s.winnerId = winner.id
    s.winReason = 'score'
    addLog(s, `${winner.name} 以 ${winner.score} 分獲勝`)
  }
}

function voidRound(s: GameState): void {
  s.roundResult = {
    reason: 'void',
    declarerId: null,
    declarerWon: null,
    scores: s.players.map((p) => ({ playerId: p.id, cardPoints: 0, colorBonus: 0, gained: 0 })),
  }
  s.status = 'roundEnd'
  addLog(s, `牌庫耗盡且無人宣告，第 ${s.round} 局作廢`)
}

function checkMermaids(s: GameState): void {
  if (s.status !== 'playing') return
  const winner = s.players.find((p) => allCards(p).filter((c) => c.kind === 'mermaid').length >= 4)
  if (!winner) return
  s.status = 'gameOver'
  s.winnerId = winner.id
  s.winReason = 'mermaids'
  addLog(s, `${winner.name} 集滿 4 張美人魚，立即獲勝`)
}

function advanceTurn(s: GameState): void {
  if (s.extraTurn) {
    s.extraTurn = false
    s.phase = 'draw'
    addLog(s, `${currentPlayer(s).name} 進行額外回合`)
    return
  }
  const next = (s.current + 1) % s.players.length
  if (s.declaration?.kind === 'lastChance' && s.players[next]?.id === s.declaration.playerId) {
    finishRound(s)
    return
  }
  s.current = next
  s.phase = 'draw'
}

function drawDeck(s: GameState): ActionError | null {
  if (s.phase !== 'draw') return fail('WRONG_PHASE')
  if (s.deck.length === 0) return fail('DECK_EMPTY')
  const player = currentPlayer(s)
  if (s.deck.length === 1) {
    player.hand.push(...s.deck.splice(0, 1))
    s.phase = 'actions'
    addLog(s, `${player.name} 從牌庫抽了最後 1 張`)
    return null
  }
  s.pendingDraw = s.deck.splice(0, 2)
  s.phase = 'chooseDrawn'
  addLog(s, `${player.name} 從牌庫抽了 2 張`)
  return null
}

function keepDrawn(s: GameState, keepCardId: string, pile: unknown): ActionError | null {
  if (s.phase !== 'chooseDrawn') return fail('WRONG_PHASE')
  if (!isPile(pile)) return fail('INVALID_PILE')
  const keep = s.pendingDraw.find((c) => c.id === keepCardId)
  const other = s.pendingDraw.find((c) => c.id !== keepCardId)
  if (!keep || !other) return fail('CARD_NOT_FOUND')
  const empties = emptyPiles(s)
  if (empties.length > 0 && !empties.includes(pile)) return fail('MUST_USE_EMPTY_PILE')

  const player = currentPlayer(s)
  player.hand.push(keep)
  s.discards[pile].cards.push(other)
  s.pendingDraw = []
  s.phase = 'actions'
  addLog(s, `${player.name} 留下 1 張，把${describeCard(other)}放到${PILE_NAMES[pile]}棄牌堆`)
  return null
}

function takeDiscard(s: GameState, pile: unknown): ActionError | null {
  if (s.phase !== 'draw') return fail('WRONG_PHASE')
  if (!isPile(pile)) return fail('INVALID_PILE')
  const card = s.discards[pile].cards.pop()
  if (!card) return fail('PILE_EMPTY')
  const player = currentPlayer(s)
  player.hand.push(card)
  s.phase = 'actions'
  addLog(s, `${player.name} 拿走${PILE_NAMES[pile]}棄牌堆的${describeCard(card)}`)
  return null
}

function playDuo(s: GameState, action: Extract<Action, { type: 'PLAY_DUO' }>): ActionError | null {
  if (s.phase !== 'actions') return fail('WRONG_PHASE')
  const player = currentPlayer(s)
  const ids = Array.isArray(action.cardIds) ? action.cardIds : []
  const [idA, idB] = ids
  if (ids.length !== 2 || idA === idB) return fail('INVALID_DUO')
  const a = player.hand.find((c) => c.id === idA)
  const b = player.hand.find((c) => c.id === idB)
  if (!a || !b) return fail('CARD_NOT_FOUND')
  const effect = duoEffect(a.kind, b.kind)
  if (!effect) return fail('INVALID_DUO')

  let crabIndex = -1
  if (effect === 'crab') {
    const available = nonEmptyPiles(s)
    if (action.crab) {
      if (!isPile(action.crab.pile)) return fail('INVALID_CRAB_TARGET')
      crabIndex = s.discards[action.crab.pile].cards.findIndex((c) => c.id === action.crab?.cardId)
      if (crabIndex < 0) return fail('INVALID_CRAB_TARGET')
    } else if (available.length > 0) {
      return fail('CRAB_TARGET_REQUIRED')
    }
  }

  let target: PlayerState | undefined
  if (effect === 'steal') {
    const targets = stealTargets(s, s.current)
    if (action.steal) {
      if (!targets.includes(action.steal.targetId)) return fail('INVALID_STEAL_TARGET')
      target = s.players.find((p) => p.id === action.steal?.targetId)
    } else if (targets.length > 0) {
      return fail('STEAL_TARGET_REQUIRED')
    }
  }

  player.hand = player.hand.filter((c) => c !== a && c !== b)
  player.field.push(a, b)

  switch (effect) {
    case 'crab': {
      if (action.crab && crabIndex >= 0) {
        player.hand.push(...s.discards[action.crab.pile].cards.splice(crabIndex, 1))
        addLog(s, `${player.name} 打出螃蟹對，從${PILE_NAMES[action.crab.pile]}棄牌堆挑了 1 張`)
      } else {
        addLog(s, `${player.name} 打出螃蟹對，棄牌堆都是空的，沒有效果`)
      }
      break
    }
    case 'boat':
      s.extraTurn = true
      addLog(s, `${player.name} 打出帆船對，本回合結束後再進行一回合`)
      break
    case 'fish':
      if (s.deck.length > 0) {
        player.hand.push(...s.deck.splice(0, 1))
        addLog(s, `${player.name} 打出魚對，從牌庫抽了 1 張`)
      } else {
        addLog(s, `${player.name} 打出魚對，牌庫已空，沒有效果`)
      }
      break
    case 'steal':
      if (target) {
        const [i, rngState] = randomInt(s.rngState, target.hand.length)
        s.rngState = rngState
        player.hand.push(...target.hand.splice(i, 1))
        addLog(s, `${player.name} 打出鯊魚與游泳者，從 ${target.name} 手中偷了 1 張`)
      } else {
        addLog(s, `${player.name} 打出鯊魚與游泳者，沒有可偷的對手`)
      }
      break
  }
  return null
}

function declare(s: GameState, kind: unknown): ActionError | null {
  if (s.phase !== 'actions') return fail('WRONG_PHASE')
  if (kind !== 'stop' && kind !== 'lastChance') return fail('UNKNOWN_ACTION')
  if (s.declaration) return fail('ALREADY_DECLARED')
  const player = currentPlayer(s)
  if (cardPoints(allCards(player)).total < DECLARE_MIN_POINTS) return fail('NOT_ENOUGH_POINTS')

  s.declaration = { kind, playerId: player.id }
  s.extraTurn = false
  if (kind === 'stop') {
    addLog(s, `${player.name} 宣告 STOP`)
    finishRound(s)
  } else {
    addLog(s, `${player.name} 宣告 LAST CHANCE`)
    advanceTurn(s)
  }
  return null
}

function endTurn(s: GameState): ActionError | null {
  if (s.phase !== 'actions') return fail('WRONG_PHASE')
  addLog(s, `${currentPlayer(s).name} 結束回合`)
  if (s.deck.length === 0 && !s.declaration) voidRound(s)
  else advanceTurn(s)
  return null
}

function nextRound(s: GameState): ActionError | null {
  if (s.status !== 'roundEnd' || !s.roundResult) return fail('NOT_ROUND_END')
  const n = s.players.length
  const declarerIndex = s.players.findIndex((p) => p.id === s.roundResult?.declarerId)
  const starter = declarerIndex >= 0 ? (declarerIndex + 1) % n : (s.roundStarter + 1) % n
  startRound(s, starter)
  return null
}

function handle(s: GameState, playerId: string, action: Action): ActionError | null {
  const index = s.players.findIndex((p) => p.id === playerId)
  if (index < 0) return fail('UNKNOWN_PLAYER')
  if (action.type === 'NEXT_ROUND') return nextRound(s)
  if (s.status !== 'playing') return fail('GAME_NOT_PLAYING')
  if (index !== s.current) return fail('NOT_YOUR_TURN')

  switch (action.type) {
    case 'DRAW_DECK':
      return drawDeck(s)
    case 'KEEP_DRAWN':
      return keepDrawn(s, action.keepCardId, action.discardPile)
    case 'TAKE_DISCARD':
      return takeDiscard(s, action.pile)
    case 'PLAY_DUO':
      return playDuo(s, action)
    case 'DECLARE':
      return declare(s, action.kind)
    case 'END_TURN':
      return endTurn(s)
    default:
      return fail('UNKNOWN_ACTION')
  }
}

export function applyAction(state: GameState, playerId: string, action: Action): ActionResult {
  const draft = structuredClone(state)
  const error = handle(draft, playerId, action)
  if (error) return { ok: false, error }
  checkMermaids(draft)
  return { ok: true, state: draft }
}

function listDuos(hand: readonly Card[]): [string, string][] {
  const pairs: [string, string][] = []
  hand.forEach((a, i) => {
    hand.slice(i + 1).forEach((b) => {
      if (duoEffect(a.kind, b.kind)) pairs.push([a.id, b.id])
    })
  })
  return pairs
}

export function getLegalActions(state: GameState, playerId: string): LegalActions {
  const none: LegalActions = {
    isMyTurn: false,
    drawDeck: false,
    keepDrawn: null,
    takeDiscard: [],
    duos: [],
    crabPiles: [],
    stealTargets: [],
    declare: false,
    endTurn: false,
    nextRound: false,
  }
  const index = state.players.findIndex((p) => p.id === playerId)
  if (index < 0) return none
  if (state.status === 'roundEnd') return { ...none, nextRound: true }
  if (state.status !== 'playing' || index !== state.current) return none

  const mine = { ...none, isMyTurn: true }
  switch (state.phase) {
    case 'draw':
      return { ...mine, drawDeck: state.deck.length > 0, takeDiscard: nonEmptyPiles(state) }
    case 'chooseDrawn': {
      const empties = emptyPiles(state)
      return {
        ...mine,
        keepDrawn: { cardIds: state.pendingDraw.map((c) => c.id), piles: empties.length > 0 ? empties : [0, 1] },
      }
    }
    case 'actions': {
      const player = currentPlayer(state)
      return {
        ...mine,
        duos: listDuos(player.hand),
        crabPiles: nonEmptyPiles(state),
        stealTargets: stealTargets(state, index),
        declare: !state.declaration && cardPoints(allCards(player)).total >= DECLARE_MIN_POINTS,
        endTurn: true,
      }
    }
  }
}
