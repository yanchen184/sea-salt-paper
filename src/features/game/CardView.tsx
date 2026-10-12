import type { CSSProperties } from 'react'
import { CARD_NAMES, COLOR_NAMES, describeCard, type Card } from '../../engine'
import { COLOR_CLASSES, CREATURE_URLS } from './cardStyle'

interface CardViewProps {
  card: Card
  size?: CardSize
  selected?: boolean
  onClick?: () => void
  disabled?: boolean
  testId?: string
}

export type CardSize = 'md' | 'sm' | 'xs'

const SIZES = {
  md: 'h-24 w-16 text-xs short:h-[4.5rem] short:w-12 short:text-[10px]',
  sm: 'h-14 w-10 text-[10px]',
  xs: 'h-10 w-7 text-[8px]',
}

const ART_SIZES = {
  md: 'h-9 w-9 short:h-7 short:w-7',
  sm: 'h-6 w-6',
  xs: 'h-4 w-4',
}

export function CardView({ card, size = 'md', selected = false, onClick, disabled = false, testId }: CardViewProps) {
  const className = `card-face flex shrink-0 flex-col items-center justify-between rounded-lg p-1 font-semibold ${SIZES[size]} ${COLOR_CLASSES[card.color]} ${
    selected ? '-translate-y-2 ring-4 ring-amber-400' : ''
  }`
  const content = (
    <>
      <span>{COLOR_NAMES[card.color]}</span>
      <span
        aria-hidden
        data-testid="card-art"
        data-kind={card.kind}
        className={`creature ${ART_SIZES[size]}`}
        style={{ '--creature': `url("${CREATURE_URLS[card.kind]}")` } as CSSProperties}
      />
      <span>{CARD_NAMES[card.kind]}</span>
    </>
  )
  if (!onClick)
    return (
      <div data-testid={testId} data-card-id={card.id} title={describeCard(card)} className={className}>
        {content}
      </div>
    )
  return (
    <button
      type="button"
      data-testid={testId}
      data-card-id={card.id}
      aria-pressed={selected}
      aria-label={describeCard(card)}
      disabled={disabled}
      onClick={onClick}
      className={`${className} transition-transform disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {content}
    </button>
  )
}

export function CardBack({ size = 'md', label, testId = 'card-back' }: { size?: CardSize; label?: string; testId?: string }) {
  return (
    <div data-testid={testId} className={`card-back flex shrink-0 items-center justify-center rounded-lg font-bold text-white ${SIZES[size]}`}>
      {label && <span className="rounded bg-black/45 px-1.5 py-0.5">{label}</span>}
    </div>
  )
}

export function EmptySlot({ size = 'md', label }: { size?: CardSize; label: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-line text-ink-muted ${SIZES[size]}`}>{label}</div>
  )
}
