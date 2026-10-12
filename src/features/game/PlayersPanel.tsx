import { useState } from 'react'
import type { GameState, PlayerState } from '../../engine'
import { isAiUid } from '../../firebase/aiSeats'
import type { Room } from '../../firebase/types'
import { useAnimations } from '../../lib/motion'
import { CardBack, CardView } from './CardView'
import { Fan } from './Fan'

interface PlayersPanelProps {
  room: Room
  game: GameState
  uid: string
  isOffline: (uid: string) => boolean
  busy: boolean
  onKick: (targetUid: string) => void
}

/** 依出牌順序列出自己之後的每一位對手 */
export function opponentsOf(game: GameState, uid: string): { player: PlayerState; seat: number }[] {
  const seats = game.players.map((player, seat) => ({ player, seat }))
  const me = seats.findIndex((s) => s.player.id === uid)
  if (me < 0) return seats
  return [...seats.slice(me + 1), ...seats.slice(0, me)]
}

export function PlayersPanel({ room, game, uid, isOffline, busy, onKick }: PlayersPanelProps) {
  const canKick = room.hostId === uid && room.status === 'playing'
  const opponents = opponentsOf(game, uid)
  return (
    <ul data-testid="opponents" className="grid shrink-0 gap-2" style={{ gridTemplateColumns: `repeat(${opponents.length}, minmax(0, 1fr))` }}>
      {opponents.map(({ player: p, seat }) => (
        <OpponentSeat
          key={p.id}
          player={p}
          info={seatInfo(room, game, p, seat, uid, isOffline)}
          picking={game.status === 'playing' && game.phase === 'chooseDrawn' && seat === game.current}
          kickable={canKick && isOffline(p.id)}
          busy={busy}
          onKick={() => onKick(p.id)}
        />
      ))}
    </ul>
  )
}

export interface SeatInfo {
  seat: number
  isHost: boolean
  isMe: boolean
  isCurrent: boolean
  isDeclarer: 'stop' | 'lastChance' | null
  offline: boolean
}

export function seatInfo(room: Room, game: GameState, player: PlayerState, seat: number, uid: string, isOffline: (uid: string) => boolean): SeatInfo {
  return {
    seat,
    isHost: player.id === room.hostId,
    isMe: player.id === uid,
    isCurrent: game.status === 'playing' && seat === game.current,
    isDeclarer: game.declaration?.playerId === player.id ? game.declaration.kind : null,
    offline: isOffline(player.id),
  }
}

interface OpponentSeatProps {
  player: PlayerState
  info: SeatInfo
  picking: boolean
  kickable: boolean
  busy: boolean
  onKick: () => void
}

function OpponentSeat({ player, info, picking, kickable, busy, onKick }: OpponentSeatProps) {
  const [confirming, setConfirming] = useState(false)
  return (
    <li
      data-testid="player"
      data-current={info.isCurrent}
      className={`relative min-w-0 space-y-1 rounded-xl bg-surface/90 p-2 shadow-sm ${info.isCurrent ? 'ring-2 ring-amber-400' : 'ring-1 ring-line'}`}
    >
      <SeatTitle player={player} info={info} />
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <div className="flex items-center gap-1.5 text-xs text-ink-muted">
          <div data-testid="hand-backs" data-anim-zone={`seat-${player.id}`} className="flex h-10 min-w-7">
            {player.hand.map((c, i) => (
              <div key={c.id} className={i === 0 ? '' : '-ml-6'}>
                <CardBack size="xs" />
              </div>
            ))}
          </div>
          <span>
            <span data-testid="player-hand-count">{player.hand.length}</span> 張
          </span>
        </div>
        <SeatField player={player} className="w-full sm:w-auto sm:flex-1" />
      </div>
      {picking && <Picking />}
      {kickable && (
        <button
          type="button"
          data-testid="kick-player"
          disabled={busy}
          onClick={() => (confirming ? onKick() : setConfirming(true))}
          className="rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-100 disabled:opacity-60"
        >
          {confirming ? `確定把 ${player.name} 移出？` : '移出這位離線玩家'}
        </button>
      )}
    </li>
  )
}

/** 對手從牌庫抽到兩張、還沒選定時，兩張蓋牌浮在他的座位下方 */
function Picking() {
  const animate = useAnimations()
  return (
    <div
      data-testid="picking"
      className="absolute left-1/2 top-full z-[1] mt-1 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-notice/95 px-2 py-1 text-xs font-semibold text-notice-ink shadow-md ring-1 ring-line"
    >
      {[0, 1].map((i) => (
        <div key={i} className={animate ? 'picking-wobble' : ''}>
          <CardBack size="xs" testId="picking-card" />
        </div>
      ))}
      <span className="whitespace-nowrap">挑選中…</span>
    </div>
  )
}

export function SeatField({ player, className = '' }: { player: PlayerState; className?: string }) {
  return (
    <Fan testId="player-field" zone={`field-${player.id}`} basis="basis-10" className={`h-14 items-center ${className}`}>
      {player.field.length === 0 ? [<span key="empty" className="whitespace-nowrap text-xs text-ink-muted">場上沒有牌</span>] : player.field.map((c) => <CardView key={c.id} card={c} size="sm" />)}
    </Fan>
  )
}

export function SeatTitle({ player, info }: { player: PlayerState; info: SeatInfo }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold text-heading">{info.seat + 1}</span>
      <span data-testid="player-name" className="min-w-0 truncate text-sm font-medium text-ink">
        {player.name}
      </span>
      {info.isHost && <Badge className="bg-amber-100 text-amber-800">房主</Badge>}
      {info.isMe && <Badge className="bg-sky-100 text-sky-800">你</Badge>}
      {isAiUid(player.id) && (
        <Badge className="bg-violet-100 text-violet-800" testId="ai-badge">
          AI
        </Badge>
      )}
      {info.isCurrent && <Badge className="bg-amber-400 text-amber-950">行動中</Badge>}
      {info.isDeclarer === 'lastChance' && (
        <Badge className="bg-rose-100 text-rose-800" testId="last-chance-badge">
          LAST CHANCE · 手牌受保護
        </Badge>
      )}
      {info.offline && (
        <Badge className="bg-slate-200 text-slate-600" testId="offline-badge">
          離線
        </Badge>
      )}
      <span className="ml-auto whitespace-nowrap text-xs text-ink-muted">
        總分 <span data-testid="player-score" className="font-bold text-heading">{player.score}</span>
      </span>
    </div>
  )
}

function Badge({ children, className, testId }: { children: string; className: string; testId?: string }) {
  return (
    <span data-testid={testId} className={`whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-medium ${className}`}>
      {children}
    </span>
  )
}
