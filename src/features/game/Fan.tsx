import { Children, type ReactNode } from 'react'

interface FanProps {
  /** 每張牌的寬度（Tailwind basis-* class）；空間不夠時牌會往右疊 */
  basis: string
  className?: string
  testId?: string
  zone?: string
  children: ReactNode
}

export function Fan({ basis, className = '', testId, zone, children }: FanProps) {
  return (
    <div data-testid={testId} data-anim-zone={zone} className={`flex min-w-0 ${className}`}>
      {Children.map(children, (child) => (
        <div className={`min-w-0 shrink ${basis} last:shrink-0`}>{child}</div>
      ))}
    </div>
  )
}
