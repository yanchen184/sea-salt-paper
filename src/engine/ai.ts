import { getLegalActions } from './game'
import { cardPoints } from './scoring'
import type { Action, Card, GameState, PileIndex, PlayerState } from './types'

const DUO_KINDS = new Set(['crab', 'boat', 'fish', 'shark', 'swimmer'])
const DUO_PARTNER: Readonly<Record<string, string>> = { crab: 'crab', boat: 'boat', fish: 'fish', shark: 'swimmer', swimmer: 'shark' }
const PARTIAL_VALUE = 0.5
const COLOR_TIE_BREAK = 0.05

/** 這張牌加入 mine 後增加的卡牌分，加上尚未成形的潛力 */
function cardValue(card: Card, mine: readonly Card[]): number {
  const gain = cardPoints([...mine, card]).total - cardPoints(mine).total
  const partnerKind = DUO_PARTNER[card.kind]
  const waitingPartner = partnerKind !== undefined && !mine.some((c) => c.kind === partnerKind)
  const potential = gain === 0 && (waitingPartner || !DUO_KINDS.has(card.kind)) ? PARTIAL_VALUE : 0
  const sameColor = mine.filter((c) => c.color === card.color).length
  return gain + potential + sameColor * COLOR_TIE_BREAK
}

/** 規格 G11-4：湊成對子、美人魚，或已收集的種類 */
function worthTaking(card: Card, mine: readonly Card[]): boolean {
  if (card.kind === 'mermaid') return true
  if (mine.some((c) => c.kind === card.kind)) return true
  return cardPoints([...mine, card]).total > cardPoints(mine).total
}

function best<T>(items: readonly T[], score: (item: T) => number): T | undefined {
  let chosen: T | undefined
  let top = -Infinity
  for (const item of items) {
    const s = score(item)
    if (s > top) {
      top = s
      chosen = item
    }
  }
  return chosen
}

function myCards(player: PlayerState): Card[] {
  return [...player.hand, ...player.field]
}

function chooseDraw(state: GameState, mine: readonly Card[], piles: PileIndex[], canDraw: boolean): Action | null {
  const tops = piles.flatMap((pile) => {
    const top = state.discards[pile].cards.at(-1)
    return top ? [{ pile, top }] : []
  })
  const wanted = best(
    tops.filter((t) => worthTaking(t.top, mine)),
    (t) => cardValue(t.top, mine),
  )
  if (wanted) return { type: 'TAKE_DISCARD', pile: wanted.pile }
  if (canDraw) return { type: 'DRAW_DECK' }
  const fallback = best(tops, (t) => cardValue(t.top, mine))
  return fallback ? { type: 'TAKE_DISCARD', pile: fallback.pile } : null
}

function chooseActions(state: GameState, me: PlayerState): Action {
  const legal = getLegalActions(state, me.id)
  const duo = legal.duos[0]
  if (duo) {
    const kinds = duo.map((id) => me.hand.find((c) => c.id === id)?.kind)
    const action: Extract<Action, { type: 'PLAY_DUO' }> = { type: 'PLAY_DUO', cardIds: duo }
    if (kinds[0] === 'crab') {
      const pile = best(legal.crabPiles, (p) => state.discards[p].cards.length)
      if (pile !== undefined) action.crab = { pile }
    }
    if (kinds.includes('shark')) {
      const targetId = best(legal.stealTargets, (id) => state.players.find((p) => p.id === id)?.hand.length ?? 0)
      if (targetId !== undefined) action.steal = { targetId }
    }
    return action
  }
  if (legal.declare) return { type: 'DECLARE', kind: 'stop' }
  return { type: 'END_TURN' }
}

/**
 * 輪到 playerId 時要送出的動作；不是它的回合、或局間／遊戲結束時回傳 null。
 * 只讀這個座位看得到的資訊：自己的手牌與抽到的牌、所有人的場上牌、棄牌堆頂，
 * 以及自己打螃蟹時正在翻的那一堆。
 */
export function chooseAiAction(state: GameState, playerId: string): Action | null {
  const legal = getLegalActions(state, playerId)
  if (!legal.isMyTurn) return null
  const me = state.players[state.current]
  if (!me) return null
  const mine = myCards(me)

  switch (state.phase) {
    case 'draw':
      return chooseDraw(state, mine, legal.takeDiscard, legal.drawDeck)
    case 'chooseDrawn': {
      const options = legal.keepDrawn
      const keep = best(state.pendingDraw, (c) => cardValue(c, mine))
      const pile = options?.piles[0]
      if (!keep || pile === undefined) return null
      return { type: 'KEEP_DRAWN', keepCardId: keep.id, discardPile: pile }
    }
    case 'crabPick': {
      const pile = state.crabPile === null ? [] : state.discards[state.crabPile].cards
      const pick = best(pile, (c) => cardValue(c, mine))
      return pick ? { type: 'PICK_CRAB', cardId: pick.id } : null
    }
    case 'actions':
      return chooseActions(state, me)
  }
}
