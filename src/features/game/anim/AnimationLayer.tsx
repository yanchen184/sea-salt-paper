import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GameEvent, GameState } from '../../../engine'
import { CardBack, CardView } from '../CardView'
import { planAnimation, type Flight, type Spread, type Stage, type Zone } from './plan'

const FLIGHT_MS = 500
const STAGGER_MS = 120
const SPREAD_MS = 1000
const BANNER_MS = 1400
/** 攤牌時相鄰兩張最多露出的比例 */
const SPREAD_OVERLAP = 0.6

function stageDuration(stage: Stage): number {
  if (stage.banner) return BANNER_MS
  if (stage.spread) return SPREAD_MS
  return FLIGHT_MS + STAGGER_MS * Math.max(stage.flights.length - 1, 0)
}

function zoneRect(zone: Zone): DOMRect | null {
  return document.querySelector(`[data-anim-zone="${zone}"]`)?.getBoundingClientRect() ?? null
}

interface AnimationLayerProps {
  event: GameEvent
  /** 動作前的狀態 */
  before: GameState
  viewerId: string
  onDone: (seq: number) => void
}

export function AnimationLayer({ event, before, viewerId, onDone }: AnimationLayerProps) {
  const stages = useMemo(() => planAnimation(event, before, viewerId), [event, before, viewerId])
  const [index, setIndex] = useState(0)
  const stage = stages[index]

  useEffect(() => {
    if (!stage) {
      onDone(event.seq)
      return
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), stageDuration(stage))
    return () => clearTimeout(timer)
  }, [stage, event.seq, onDone])

  if (!stage) return null
  return createPortal(
    <div data-testid="anim-layer" aria-hidden className="pointer-events-none fixed inset-0 z-20">
      {stage.flights.map((flight, i) => (
        <FlightView key={`${index}-${i}`} flight={flight} delay={i * STAGGER_MS} />
      ))}
      {stage.spread && <SpreadView key={index} spread={stage.spread} />}
      {stage.banner && (
        <p
          data-testid="anim-banner"
          className="anim-pop absolute left-1/2 top-1/3 -translate-x-1/2 rounded-2xl bg-rose-600 px-6 py-3 text-2xl font-black text-white shadow-2xl"
        >
          {stage.banner}
        </p>
      )}
    </div>,
    document.body,
  )
}

function FlightView({ flight, delay }: { flight: Flight; delay: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const flip = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const from = zoneRect(flight.from)
    const to = zoneRect(flight.to)
    if (!el || !from || !to) return
    const dx = to.x + to.width / 2 - (from.x + from.width / 2)
    const dy = to.y + to.height / 2 - (from.y + from.height / 2)
    el.style.left = `${from.x + from.width / 2}px`
    el.style.top = `${from.y + from.height / 2}px`
    el.style.visibility = 'visible'
    const animation = el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2}px)) scale(1.15)`, opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.9)`, opacity: 0.6 },
      ],
      { duration: FLIGHT_MS, delay, easing: 'ease-in-out', fill: 'both' },
    )
    const turn = flip.current?.animate(
      [
        { transform: 'rotateY(180deg)' },
        { transform: 'rotateY(180deg)', offset: 0.25 },
        { transform: 'rotateY(0deg)', offset: 0.75 },
        { transform: 'rotateY(0deg)' },
      ],
      { duration: FLIGHT_MS, delay, easing: 'ease-in-out', fill: 'both' },
    )
    return () => {
      animation.cancel()
      turn?.cancel()
    }
  }, [flight, delay])

  return (
    <div
      ref={ref}
      data-testid="anim-flight"
      data-from={flight.from}
      data-to={flight.to}
      data-face={flight.card ? 'up' : 'back'}
      data-flip={flight.flip}
      data-card-id={flight.card?.id}
      className="invisible absolute drop-shadow-xl [perspective:600px]"
    >
      {flight.card && flight.flip ? (
        <div ref={flip} data-testid="anim-flip" className="relative [transform-style:preserve-3d]">
          <div className="[backface-visibility:hidden]">
            <CardView card={flight.card} />
          </div>
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <CardBack />
          </div>
        </div>
      ) : flight.card ? (
        <CardView card={flight.card} />
      ) : (
        <CardBack />
      )}
    </div>
  )
}

/** 以牌區中心為準橫向攤開，總寬不超過視窗 90% */
function SpreadView({ spread }: { spread: Spread }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const rect = zoneRect(spread.zone)
    const first = el?.firstElementChild
    if (!el || !rect || !(first instanceof HTMLElement)) return
    const width = first.offsetWidth
    const gaps = spread.cards.length - 1
    const step = gaps > 0 ? Math.min(width * SPREAD_OVERLAP, (window.innerWidth * 0.9 - width) / gaps) : 0
    Array.from(el.children).forEach((child, i) => {
      if (child instanceof HTMLElement && i > 0) child.style.marginLeft = `${step - width}px`
    })
    el.style.left = `${rect.x + rect.width / 2}px`
    el.style.top = `${rect.y + rect.height / 2}px`
    el.style.visibility = 'visible'
    const animation = el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.2 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.85 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
      ],
      { duration: SPREAD_MS, easing: 'ease-out', fill: 'both' },
    )
    return () => animation.cancel()
  }, [spread])

  return (
    <div
      ref={ref}
      data-testid="anim-spread"
      data-zone={spread.zone}
      data-count={spread.cards.length}
      className="invisible absolute flex drop-shadow-xl"
    >
      {spread.cards.map((card) => (
        <div key={card.id} data-testid="anim-spread-card" data-card-id={card.id} className="shrink-0">
          <CardView card={card} />
        </div>
      ))}
    </div>
  )
}
