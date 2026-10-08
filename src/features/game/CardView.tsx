import { CARD_NAMES, COLOR_NAMES, describeCard, type Card } from '../../engine'
import { CARD_ICONS, COLOR_CLASSES } from './cardStyle'

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

export function CardView({ card, size = 'md', selected = false, onClick, disabled = false, testId }: CardViewProps) {
  const className = `flex shrink-0 flex-col items-center justify-between rounded-lg p-1 font-semibold shadow-sm ${SIZES[size]} ${COLOR_CLASSES[card.color]} ${
    selected ? '-translate-y-2 ring-4 ring-amber-400' : ''
  }`
  const content = (
    <>
      <span>{COLOR_NAMES[card.color]}</span>
      <span aria-hidden className={size === 'md' ? 'text-2xl' : 'text-base'}>
        {CARD_ICONS[card.kind]}
      </span>
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
    <div className={`flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 font-bold text-white shadow-sm ${SIZES[size]}`}>
      {label}
    </div>
  )
}

export function EmptySlot({ size = 'md', label }: { size?: 'md' | 'sm'; label: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-sky-300 text-sky-400 ${SIZES[size]}`}>{label}</div>
  )
}
