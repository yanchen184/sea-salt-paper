export type CardKind =
  | 'crab'
  | 'boat'
  | 'fish'
  | 'swimmer'
  | 'shark'
  | 'shell'
  | 'octopus'
  | 'penguin'
  | 'sailor'
  | 'lighthouse'
  | 'shoal'
  | 'penguinColony'
  | 'captain'
  | 'mermaid'

export type CardColor =
  | 'darkBlue'
  | 'lightBlue'
  | 'black'
  | 'yellow'
  | 'lightGreen'
  | 'white'
  | 'purple'
  | 'lightGray'
  | 'lightOrange'
  | 'pink'
  | 'orange'

export interface Card {
  id: string
  kind: CardKind
  color: CardColor
}

export type PileIndex = 0 | 1

export interface PlayerSeat {
  id: string
  name: string
}

export interface PlayerState {
  id: string
  name: string
  hand: Card[]
  /** 已打出的 duo，每兩張一對、依序排列 */
  field: Card[]
  score: number
}

export interface DiscardPile {
  /** 最後一張是頂牌 */
  cards: Card[]
}

export type Phase = 'draw' | 'chooseDrawn' | 'actions' | 'crabPick'
export type GameStatus = 'playing' | 'roundEnd' | 'gameOver'
export type DeclareKind = 'stop' | 'lastChance'

export interface Declaration {
  kind: DeclareKind
  playerId: string
}

export interface PlayerRoundScore {
  playerId: string
  cardPoints: number
  colorBonus: number
  gained: number
}

export interface RoundResult {
  reason: DeclareKind | 'void'
  declarerId: string | null
  /** 只有 LAST CHANCE 有值 */
  declarerWon: boolean | null
  scores: PlayerRoundScore[]
}

export interface KickedPlayer {
  id: string
  name: string
  score: number
}

export interface LogEntry {
  round: number
  text: string
}

export interface GameState {
  players: PlayerState[]
  /** index 0 是牌庫頂 */
  deck: Card[]
  discards: [DiscardPile, DiscardPile]
  rngState: number
  round: number
  targetScore: number
  roundStarter: number
  current: number
  phase: Phase
  status: GameStatus
  pendingDraw: Card[]
  /** crabPick 階段正在挑牌的棄牌堆 */
  crabPile: PileIndex | null
  extraTurn: boolean
  declaration: Declaration | null
  roundResult: RoundResult | null
  winnerId: string | null
  winReason: 'score' | 'mermaids' | 'lastPlayer' | null
  /** 被踢出玩家的牌，本場不再使用 */
  removed: Card[]
  kicked: KickedPlayer[]
  log: LogEntry[]
}

export type Action =
  | { type: 'DRAW_DECK' }
  | { type: 'KEEP_DRAWN'; keepCardId: string; discardPile: PileIndex }
  | { type: 'TAKE_DISCARD'; pile: PileIndex }
  | {
      type: 'PLAY_DUO'
      cardIds: [string, string]
      crab?: { pile: PileIndex }
      steal?: { targetId: string }
    }
  | { type: 'PICK_CRAB'; cardId: string }
  | { type: 'DECLARE'; kind: DeclareKind }
  | { type: 'END_TURN' }
  | { type: 'NEXT_ROUND' }

export type ErrorCode =
  | 'UNKNOWN_PLAYER'
  | 'UNKNOWN_ACTION'
  | 'GAME_NOT_PLAYING'
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'DECK_EMPTY'
  | 'INVALID_PILE'
  | 'PILE_EMPTY'
  | 'MUST_USE_EMPTY_PILE'
  | 'CARD_NOT_FOUND'
  | 'INVALID_DUO'
  | 'CRAB_TARGET_REQUIRED'
  | 'INVALID_CRAB_TARGET'
  | 'MUST_PICK_CRAB'
  | 'STEAL_TARGET_REQUIRED'
  | 'INVALID_STEAL_TARGET'
  | 'ALREADY_DECLARED'
  | 'NOT_ENOUGH_POINTS'
  | 'NOT_ROUND_END'

export interface ActionError {
  code: ErrorCode
  message: string
}

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: ActionError }

export interface LegalActions {
  isMyTurn: boolean
  drawDeck: boolean
  keepDrawn: { cardIds: string[]; piles: PileIndex[] } | null
  takeDiscard: PileIndex[]
  /** 手牌中所有可打出的組合 */
  duos: [string, string][]
  crabPiles: PileIndex[]
  /** crabPick 階段可挑的牌 */
  crabPick: string[] | null
  stealTargets: string[]
  declare: boolean
  endTurn: boolean
  nextRound: boolean
}
