import { isAiUid } from '../../firebase/aiSeats'
import type { Room } from '../../firebase/types'

interface PlayerListProps {
  room: Room
  uid: string
  isOffline: (uid: string) => boolean
  /** 只有房主會拿到 */
  onRemoveAi?: (aiUid: string) => void
}

export function PlayerList({ room, uid, isOffline, onRemoveAi }: PlayerListProps) {
  return (
    <ul data-testid="player-list" className="divide-y divide-line">
      {room.players.map((p, seat) => (
        <li key={p.uid} data-testid="player" className="flex items-center gap-3 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-heading">{seat + 1}</span>
          <span data-testid="player-name" className="flex-1 font-medium text-ink">{p.name}</span>
          {p.uid === room.hostId && <Badge className="bg-amber-100 text-amber-800">房主</Badge>}
          {p.uid === uid && <Badge className="bg-sky-100 text-sky-800">你</Badge>}
          {isAiUid(p.uid) && (
            <Badge className="bg-violet-100 text-violet-800" testId="ai-badge">
              AI
            </Badge>
          )}
          {isOffline(p.uid) && (
            <Badge className="bg-slate-200 text-slate-600" testId="offline-badge">
              離線
            </Badge>
          )}
          {onRemoveAi && isAiUid(p.uid) && (
            <button
              type="button"
              data-testid="remove-ai"
              onClick={() => onRemoveAi(p.uid)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              移除
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function Badge({ children, className, testId }: { children: string; className: string; testId?: string }) {
  return (
    <span data-testid={testId} className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}
