import type { Action, GameState, LegalActions, PileIndex } from '../../engine'

export interface PileTarget {
  action: Action
  label: string
}

export interface PileTargets {
  deck: PileTarget | null
  piles: [PileTarget | null, PileTarget | null]
}

const PILE_NAMES = ['左堆', '右堆'] as const
const NONE: PileTargets = { deck: null, piles: [null, null] }

function byPile(make: (pile: PileIndex) => PileTarget | null): PileTargets['piles'] {
  return [make(0), make(1)]
}

function isCrabPair(state: GameState, selected: readonly string[]): selected is readonly [string, string] {
  if (selected.length !== 2) return false
  const hand = state.players[state.current]?.hand ?? []
  return selected.every((id) => hand.find((c) => c.id === id)?.kind === 'crab')
}

/** 依目前階段、合法動作與選取的手牌，算出點牌庫與各棄牌堆要送的動作 */
export function pileTargets(state: GameState, legal: LegalActions, selected: readonly string[]): PileTargets {
  if (!legal.isMyTurn) return NONE

  if (state.phase === 'draw')
    return {
      deck: legal.drawDeck ? { action: { type: 'DRAW_DECK' }, label: '抽牌庫' } : null,
      piles: byPile((pile) =>
        legal.takeDiscard.includes(pile) ? { action: { type: 'TAKE_DISCARD', pile }, label: `拿${PILE_NAMES[pile]}頂牌` } : null,
      ),
    }

  if (state.phase === 'chooseDrawn') {
    const keep = selected[0]
    const allowed = legal.keepDrawn?.piles ?? []
    if (!keep || !legal.keepDrawn?.cardIds.includes(keep)) return NONE
    return {
      deck: null,
      piles: byPile((pile) =>
        allowed.includes(pile)
          ? { action: { type: 'KEEP_DRAWN', keepCardId: keep, discardPile: pile }, label: `另一張放到${PILE_NAMES[pile]}` }
          : null,
      ),
    }
  }

  if (state.phase === 'actions' && isCrabPair(state, selected)) {
    const [a, b] = selected
    const legalPair = legal.duos.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
    if (!legalPair) return NONE
    return {
      deck: null,
      piles: byPile((pile) =>
        legal.crabPiles.includes(pile)
          ? { action: { type: 'PLAY_DUO', cardIds: [a, b], crab: { pile } }, label: `打出螃蟹，從${PILE_NAMES[pile]}挑` }
          : null,
      ),
    }
  }

  return NONE
}
