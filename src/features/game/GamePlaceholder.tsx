import type { Room } from '../../firebase/types'
import { PlayerList } from '../lobby/PlayerList'

interface GamePlaceholderProps {
  room: Room
  uid: string
  isOffline: (uid: string) => boolean
}

export function GamePlaceholder({ room, uid, isOffline }: GamePlaceholderProps) {
  const me = room.game?.players.find((p) => p.id === uid)
  return (
    <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <h2 data-testid="game-status" className="text-xl font-bold text-sky-900">
        {room.status === 'finished' ? '遊戲已結束' : '遊戲進行中'}
      </h2>
      <p className="text-sm text-slate-600">
        房號 {room.code} · 你的手牌 <span data-testid="hand-count">{me?.hand.length ?? 0}</span> 張 ·{' '}
        <span data-testid="hand-ids" className="sr-only">
          {me?.hand.map((c) => c.id).join(',')}
        </span>
      </p>
      <PlayerList room={room} uid={uid} isOffline={isOffline} />
    </section>
  )
}
