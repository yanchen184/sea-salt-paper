import type { Card, CardColor, CardKind, Declaration, PlayerRoundScore } from './types'

export interface CardPointsBreakdown {
  duo: number
  collector: number
  multiplier: number
  mermaid: number
  total: number
}

const COLLECTOR_TABLE: Partial<Record<CardKind, readonly number[]>> = {
  shell: [0, 0, 2, 4, 6, 8, 10],
  octopus: [0, 0, 3, 6, 9, 12],
  penguin: [0, 1, 3, 5],
  sailor: [0, 0, 5],
}

const MULTIPLIERS: readonly (readonly [CardKind, CardKind, number])[] = [
  ['lighthouse', 'boat', 1],
  ['shoal', 'fish', 1],
  ['penguinColony', 'penguin', 2],
  ['captain', 'sailor', 3],
]

function countKinds(cards: readonly Card[]): Map<CardKind, number> {
  const counts = new Map<CardKind, number>()
  for (const card of cards) counts.set(card.kind, (counts.get(card.kind) ?? 0) + 1)
  return counts
}

function countColors(cards: readonly Card[]): Map<CardColor, number> {
  const counts = new Map<CardColor, number>()
  for (const card of cards) counts.set(card.color, (counts.get(card.color) ?? 0) + 1)
  return counts
}

/** 規則 §5：手上 + 場上所有牌 */
export function cardPoints(cards: readonly Card[]): CardPointsBreakdown {
  const kinds = countKinds(cards)
  const n = (kind: CardKind) => kinds.get(kind) ?? 0

  const duo =
    Math.floor(n('crab') / 2) +
    Math.floor(n('boat') / 2) +
    Math.floor(n('fish') / 2) +
    Math.min(n('shark'), n('swimmer'))

  let collector = 0
  for (const [kind, table] of Object.entries(COLLECTOR_TABLE) as [CardKind, readonly number[]][]) {
    collector += table[Math.min(n(kind), table.length - 1)] ?? 0
  }

  let multiplier = 0
  for (const [card, target, each] of MULTIPLIERS) {
    multiplier += n(card) * n(target) * each
  }

  const colorCounts = countColors(cards.filter((c) => c.kind !== 'mermaid'))
  const ranked = [...colorCounts.values()].sort((a, b) => b - a)
  const mermaid = ranked.slice(0, n('mermaid')).reduce((sum, v) => sum + v, 0)

  return { duo, collector, multiplier, mermaid, total: duo + collector + multiplier + mermaid }
}

/** 規則 §6：最多的同色張數，含 white */
export function colorBonus(cards: readonly Card[]): number {
  return Math.max(0, ...countColors(cards).values())
}

export interface ScoringPlayer {
  id: string
  hand: readonly Card[]
  field: readonly Card[]
}

/** 規則 §4 */
export function scoreRound(
  players: readonly ScoringPlayer[],
  declaration: Declaration,
): { declarerWon: boolean | null; scores: PlayerRoundScore[] } {
  const base = players.map((p) => {
    const all = [...p.hand, ...p.field]
    return { playerId: p.id, cardPoints: cardPoints(all).total, colorBonus: colorBonus(all) }
  })

  if (declaration.kind === 'stop') {
    return { declarerWon: null, scores: base.map((s) => ({ ...s, gained: s.cardPoints })) }
  }

  const declarer = base.find((s) => s.playerId === declaration.playerId)
  if (!declarer) throw new Error(`宣告者 ${declaration.playerId} 不在玩家中`)
  const declarerWon = base.every((s) => s === declarer || declarer.cardPoints >= s.cardPoints)

  const scores = base.map((s) => {
    const isDeclarer = s === declarer
    let gained: number
    if (declarerWon) gained = isDeclarer ? s.cardPoints + s.colorBonus : s.colorBonus
    else gained = isDeclarer ? s.colorBonus : s.cardPoints
    return { ...s, gained }
  })
  return { declarerWon, scores }
}
