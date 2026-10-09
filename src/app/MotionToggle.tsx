import { setAnimations, useAnimations } from '../lib/motion'

export function MotionToggle() {
  const enabled = useAnimations()
  return (
    <label
      data-testid="anim-toggle"
      className="flex cursor-pointer items-center gap-1 rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold text-ink-muted shadow-md ring-1 ring-line has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
    >
      <input type="checkbox" checked={enabled} onChange={(e) => setAnimations(e.target.checked)} className="accent-current" />
      動畫
    </label>
  )
}
