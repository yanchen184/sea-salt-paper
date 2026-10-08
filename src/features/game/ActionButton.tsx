import type { ReactNode } from 'react'
import type { Hint } from './actionHints'

interface ActionButtonProps {
  hint: Hint
  busy: boolean
  onClick: () => void
  testId: string
  tone?: 'primary' | 'secondary' | 'danger'
  /** 只保留 title，不顯示可見的原因文字 */
  hideReason?: boolean
  children: ReactNode
}

const TONES = {
  primary: 'bg-sky-600 text-white hover:bg-sky-700',
  secondary: 'bg-white text-sky-800 ring-1 ring-inset ring-sky-300 hover:bg-sky-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
}

export function ActionButton({ hint, busy, onClick, testId, tone = 'primary', hideReason = false, children }: ActionButtonProps) {
  const reasonId = `${testId}-reason`
  const caption = hideReason ? null : hint.reason
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        data-testid={testId}
        disabled={!hint.enabled || busy}
        title={hint.reason ?? undefined}
        aria-describedby={caption ? reasonId : undefined}
        onClick={onClick}
        className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:ring-0 ${TONES[tone]}`}
      >
        {children}
      </button>
      {caption && (
        <span id={reasonId} data-testid={reasonId} className="max-w-[12rem] text-[11px] leading-tight text-slate-500">
          {caption}
        </span>
      )}
    </div>
  )
}
