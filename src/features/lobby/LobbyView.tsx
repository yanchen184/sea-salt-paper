import { MIN_PLAYERS } from '../../firebase/rooms'
import type { Room } from '../../firebase/types'
import { PlayerList } from './PlayerList'

interface LobbyViewProps {
  room: Room
  uid: string
  isOffline: (uid: string) => boolean
  onStart: () => void
  onLeave: () => void
}

export function LobbyView({ room, uid, isOffline, onStart, onLeave }: LobbyViewProps) {
  const isHost = room.hostId === uid
  const enough = room.players.length >= MIN_PLAYERS

  return (
    <section className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">房號</p>
          <p data-testid="lobby-code" className="font-mono text-4xl font-bold tracking-widest text-sky-900">
            {room.code}
          </p>
        </div>
        <p className="text-sm text-slate-500">{room.players.length} / 4 人</p>
      </header>

      <PlayerList room={room} uid={uid} isOffline={isOffline} />

      <footer className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
        {isHost ? (
          <button
            type="button"
            data-testid="start-game"
            onClick={onStart}
            disabled={!enough}
            className="rounded-lg bg-sky-600 px-6 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            開始遊戲
          </button>
        ) : (
          <p data-testid="waiting-host" className="text-sm text-slate-500">
            等待房主開始遊戲
          </p>
        )}
        {isHost && !enough && (
          <p data-testid="start-hint" className="text-sm text-slate-500">
            至少需要 {MIN_PLAYERS} 位玩家才能開始
          </p>
        )}
        <button type="button" data-testid="leave-room" onClick={onLeave} className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50 sm:mr-auto">
          離開房間
        </button>
      </footer>
    </section>
  )
}
