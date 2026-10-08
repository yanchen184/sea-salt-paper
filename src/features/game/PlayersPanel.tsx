import { useState } from 'react'
import type { GameState, PlayerState } from '../../engine'
import type { Room } from '../../firebase/types'
import { CardBack, CardView } from './CardView'

interface PlayersPanelProps {
  room: Room
  game: GameState
  uid: string
  isOffline: (uid: string) => boolean
  busy: boolean
  onKick: (targetUid: string) => void
}

export function PlayersPanel({ room, game, uid, isOffline, busy, onKick }: PlayersPanelProps) {
  const canKick = room.hostId === uid && room.status === 'playing'
  return (
    <ul data-testid="player-list" className="grid gap-3 sm:grid-cols-2">
      {game.players.map((p, seat) => (
        <SeatRow
          key={p.id}
          player={p}
          seat={seat}
          isHost={p.id === room.hostId}
          isMe={p.id === uid}
          isCurrent={game.status === 'playing' && seat === game.current}
          isDeclarer={game.declaration?.playerId === p.id ? game.declaration.kind : null}
          offline={isOffline(p.id)}
          kickable={canKick && p.id !== uid && isOffline(p.id)}
          busy={busy}
          onKick={() => onKick(p.id)}
        />
      ))}
    </ul>
  )
}

interface SeatRowProps {
  player: PlayerState
  seat: number
  isHost: boolean
  isMe: boolean
  isCurrent: boolean
  isDeclarer: 'stop' | 'lastChance' | null
  offline: boolean
  kickable: boolean
  busy: boolean
  onKick: () => void
}

function SeatRow({ player, seat, isHost, isMe, isCurrent, isDeclarer, offline, kickable, busy, onKick }: SeatRowProps) {
  const [confirming, setConfirming] = useState(false)
  return (
    <li
      data-testid="player"
      data-current={isCurrent}
      className={`space-y-2 rounded-xl bg-white p-3 shadow-sm ${isCurrent ? 'ring-2 ring-amber-400' : 'ring-1 ring-slate-200'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800">{seat + 1}</span>
        <span data-testid="player-name" className="font-medium text-slate-800">
          {player.name}
        </span>
        {isHost && <Badge className="bg-amber-100 text-amber-800">房主</Badge>}
        {isMe && <Badge className="bg-sky-100 text-sky-800">你</Badge>}
        {isCurrent && <Badge className="bg-amber-400 text-amber-950">行動中</Badge>}
        {isDeclarer === 'lastChance' && (
          <Badge className="bg-rose-100 text-rose-800" testId="last-chance-badge">
            LAST CHANCE · 手牌受保護
          </Badge>
        )}
        {offline && (
          <Badge className="bg-slate-200 text-slate-600" testId="offline-badge">
            離線
          </Badge>
        )}
        <span className="ml-auto text-sm text-slate-600">
          總分 <span data-testid="player-score" className="font-bold text-slate-900">{player.score}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <CardBack size="sm" label={String(player.hand.length)} />
        <span>
          手牌 <span data-testid="player-hand-count">{player.hand.length}</span> 張
        </span>
      </div>
      <div data-testid="player-field" className="flex min-h-[3.5rem] flex-wrap gap-1">
        {player.field.length === 0 ? (
          <span className="self-center text-xs text-slate-400">場上沒有牌</span>
        ) : (
          player.field.map((c) => <CardView key={c.id} card={c} size="sm" />)
        )}
      </div>
      {kickable && (
        <button
          type="button"
          data-testid="kick-player"
          disabled={busy}
          onClick={() => (confirming ? onKick() : setConfirming(true))}
          className="rounded-lg bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-100 disabled:opacity-60"
        >
          {confirming ? `確定把 ${player.name} 移出？` : '移出這位離線玩家'}
        </button>
      )}
    </li>
  )
}

function Badge({ children, className, testId }: { children: string; className: string; testId?: string }) {
  return (
    <span data-testid={testId} className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}
