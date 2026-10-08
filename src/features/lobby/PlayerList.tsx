import type { Room } from '../../firebase/types'

interface PlayerListProps {
  room: Room
  uid: string
  isOffline: (uid: string) => boolean
}

export function PlayerList({ room, uid, isOffline }: PlayerListProps) {
  return (
    <ul data-testid="player-list" className="divide-y divide-line">
      {room.players.map((p, seat) => (
        <li key={p.uid} data-testid="player" className="flex items-center gap-3 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-heading">{seat + 1}</span>
          <span data-testid="player-name" className="flex-1 font-medium text-ink">{p.name}</span>
          {p.uid === room.hostId && <Badge className="bg-amber-100 text-amber-800">房主</Badge>}
          {p.uid === uid && <Badge className="bg-sky-100 text-sky-800">你</Badge>}
          {isOffline(p.uid) && (
            <Badge className="bg-slate-200 text-slate-600" testId="offline-badge">
              離線
            </Badge>
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
