import type { ReactNode } from 'react'
import type { Action, GameState } from '../../engine'
import { CardBack, CardView, EmptySlot } from './CardView'
import type { PileTarget, PileTargets } from './pileTargets'

const PILE_LABELS = ['左棄牌堆', '右棄牌堆'] as const

interface TablePanelProps {
  game: GameState
  targets: PileTargets
  busy: boolean
  onAction: (action: Action) => void
}

export function TablePanel({ game, targets, busy, onAction }: TablePanelProps) {
  return (
    <section aria-label="桌面" className="flex items-end justify-center gap-6 rounded-2xl bg-surface/75 p-4 text-ink ring-1 ring-line backdrop-blur-sm">
      <figure data-anim-zone="deck" className="flex flex-col items-center gap-1">
        <PileButton testId="pile-deck" name="牌庫" target={targets.deck} busy={busy} onAction={onAction}>
          {game.deck.length > 0 ? <CardBack label="牌庫" /> : <EmptySlot label="空" />}
        </PileButton>
        <figcaption className="text-xs">
          牌庫 <span data-testid="deck-count">{game.deck.length}</span> 張
        </figcaption>
      </figure>
      {game.discards.map((pile, i) => {
        const top = pile.cards[pile.cards.length - 1]
        return (
          <figure key={PILE_LABELS[i]} data-testid={`discard-${i}`} data-anim-zone={`pile-${i}`} className="flex flex-col items-center gap-1">
            <PileButton testId={`pile-${i}`} name={PILE_LABELS[i] ?? ''} target={targets.piles[i] ?? null} busy={busy} onAction={onAction}>
              {top ? <CardView card={top} testId={`discard-top-${i}`} /> : <EmptySlot label="空" />}
            </PileButton>
            <figcaption className="text-xs">
              {PILE_LABELS[i]} <span data-testid={`discard-count-${i}`}>{pile.cards.length}</span> 張
            </figcaption>
          </figure>
        )
      })}
    </section>
  )
}

interface PileButtonProps {
  testId: string
  name: string
  target: PileTarget | null
  busy: boolean
  onAction: (action: Action) => void
  children: ReactNode
}

function PileButton({ testId, name, target, busy, onAction, children }: PileButtonProps) {
  const active = target !== null && !busy
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={!active}
      aria-label={target?.label ?? name}
      title={target?.label}
      onClick={() => target && onAction(target.action)}
      className={`rounded-xl transition disabled:cursor-default ${
        active ? 'ring-4 ring-accent ring-offset-2 ring-offset-surface hover:-translate-y-1 focus-visible:-translate-y-1' : ''
      }`}
    >
      {children}
    </button>
  )
}
