import type { Card, GameEvent, GameState } from '../../../engine'

/** 對應畫面上 data-anim-zone 的值 */
export type Zone = 'deck' | 'hand' | 'drawn' | `pile-${0 | 1}` | `seat-${string}` | `field-${string}`

export interface Flight {
  from: Zone
  to: Zone
  /** 落地時的牌面，null = 牌背 */
  card: Card | null
  /** 起飛時是牌背，途中翻成 card 的正面 */
  flip: boolean
}

/** 在牌區上攤開正面的牌 */
export interface Spread {
  zone: Zone
  cards: Card[]
}

export interface Stage {
  flights: Flight[]
  spread: Spread | null
  banner: string | null
}

const DECLARE_NAMES = { stop: 'STOP', lastChance: 'LAST CHANCE' } as const

function stage(parts: Partial<Stage>): Stage {
  return { flights: [], spread: null, banner: null, ...parts }
}

/** 觀看者自己的牌飛到自己的手牌區，其他人的牌飛到座位 */
function holder(playerId: string, viewerId: string): Zone {
  return playerId === viewerId ? 'hand' : `seat-${playerId}`
}

function fly(from: Zone, to: Zone, card: Card | null, flip = false): Flight {
  return { from, to, card, flip }
}

export function planAnimation(event: GameEvent, before: GameState, viewerId: string): Stage[] {
  const name = (id: string) => before.players.find((p) => p.id === id)?.name ?? ''
  const actor = holder(event.playerId, viewerId)
  const mine = event.playerId === viewerId

  switch (event.type) {
    case 'playDuo': {
      // 對手的手牌是牌背，自己的手牌本來就是正面
      const duo = stage({ flights: event.cards.map((c) => fly(actor, `field-${event.playerId}`, c, !mine)) })
      return [duo, ...duoEffect(event, before, actor, viewerId, name)]
    }
    case 'drawDeck':
      return [stage({ flights: event.cards.map((c) => (mine ? fly('deck', actor, c, true) : fly('deck', actor, null))) })]
    case 'keepDrawn':
      // 抽牌者自己的 2 張牌顯示在抽牌選擇區（drawn）
      return [stage({ flights: [mine ? fly('drawn', `pile-${event.pile}`, event.discarded) : fly(actor, `pile-${event.pile}`, event.discarded, true)] })]
    case 'takeDiscard':
      return [stage({ flights: [fly(`pile-${event.pile}`, actor, event.card)] })]
    case 'pickCrab':
      return [stage({ flights: [fly(`pile-${event.pile}`, actor, null)] })]
    case 'declare':
      return [stage({ banner: `${name(event.playerId)} 宣告 ${DECLARE_NAMES[event.kind]}` })]
  }
}

function duoEffect(
  event: Extract<GameEvent, { type: 'playDuo' }>,
  before: GameState,
  actor: Zone,
  viewerId: string,
  name: (id: string) => string,
): Stage[] {
  switch (event.effect) {
    case 'fish':
      return event.fishDrew ? [stage({ flights: [fly('deck', actor, null)] })] : []
    case 'steal':
      return event.stealFrom ? [stage({ flights: [fly(holder(event.stealFrom, viewerId), actor, null)] })] : []
    case 'crab':
      return event.crabPile === null
        ? []
        : [stage({ spread: { zone: `pile-${event.crabPile}`, cards: before.discards[event.crabPile].cards } })]
    case 'boat':
      return [stage({ banner: `${name(event.playerId)} 獲得額外回合` })]
  }
}
