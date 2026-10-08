import type { GameState } from '../../engine'
import { CardBack, CardView, EmptySlot } from './CardView'

const PILE_LABELS = ['左棄牌堆', '右棄牌堆'] as const

export function TablePanel({ game }: { game: GameState }) {
  return (
    <section aria-label="桌面" className="flex items-end justify-center gap-6 rounded-2xl bg-sky-900/90 p-4 text-sky-50">
      <figure className="flex flex-col items-center gap-1">
        {game.deck.length > 0 ? <CardBack label="牌庫" /> : <EmptySlot label="空" />}
        <figcaption className="text-xs">
          牌庫 <span data-testid="deck-count">{game.deck.length}</span> 張
        </figcaption>
      </figure>
      {game.discards.map((pile, i) => {
        const top = pile.cards[pile.cards.length - 1]
        return (
          <figure key={PILE_LABELS[i]} data-testid={`discard-${i}`} className="flex flex-col items-center gap-1">
            {top ? <CardView card={top} testId={`discard-top-${i}`} /> : <EmptySlot label="空" />}
            <figcaption className="text-xs">
              {PILE_LABELS[i]} <span data-testid={`discard-count-${i}`}>{pile.cards.length}</span> 張
            </figcaption>
          </figure>
        )
      })}
    </section>
  )
}
