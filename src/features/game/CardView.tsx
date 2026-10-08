import type { CSSProperties } from 'react'
import { CARD_NAMES, COLOR_NAMES, describeCard, type Card } from '../../engine'
import { COLOR_CLASSES, CREATURE_URLS } from './cardStyle'

interface CardViewProps {
  card: Card
  size?: 'md' | 'sm'
  selected?: boolean
  onClick?: () => void
  disabled?: boolean
  testId?: string
}

const SIZES = {
  md: 'h-24 w-16 text-xs',
  sm: 'h-14 w-10 text-[10px]',
}

const ART_SIZES = {
  md: 'h-9 w-9',
  sm: 'h-6 w-6',
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

export function CardBack({ size = 'md', label }: { size?: 'md' | 'sm'; label?: string }) {
  return (
    <div data-testid="card-back" className={`card-back flex shrink-0 items-center justify-center rounded-lg font-bold text-white ${SIZES[size]}`}>
      {label && <span className="rounded bg-black/45 px-1.5 py-0.5">{label}</span>}
    </div>
  )
}

export function EmptySlot({ size = 'md', label }: { size?: 'md' | 'sm'; label: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-line text-ink-muted ${SIZES[size]}`}>{label}</div>
  )
}
