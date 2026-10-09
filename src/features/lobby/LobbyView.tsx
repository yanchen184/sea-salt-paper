import { MAX_PLAYERS, MIN_PLAYERS } from '../../firebase/rooms'
import type { Room } from '../../firebase/types'
import { PlayerList } from './PlayerList'

interface LobbyViewProps {
  room: Room
  uid: string
  isOffline: (uid: string) => boolean
  onStart: () => void
  onAddAi: () => void
  onRemoveAi: (aiUid: string) => void
  onLeave: () => void
}

export function LobbyView({ room, uid, isOffline, onStart, onAddAi, onRemoveAi, onLeave }: LobbyViewProps) {
  const isHost = room.hostId === uid
  const enough = room.players.length >= MIN_PLAYERS
  const full = room.players.length >= MAX_PLAYERS

  return (
    <section className="space-y-5 rounded-2xl bg-surface p-6 shadow-sm">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">房號</p>
          <p data-testid="lobby-code" className="font-mono text-4xl font-bold tracking-widest text-heading">
            {room.code}
          </p>
        </div>
        <p className="text-sm text-ink-muted">{room.players.length} / {MAX_PLAYERS} 人</p>
      </header>

      <PlayerList room={room} uid={uid} isOffline={isOffline} onRemoveAi={isHost ? onRemoveAi : undefined} />
      {isHost && !full && (
        <button
          type="button"
          data-testid="add-ai"
          onClick={onAddAi}
          className="w-full rounded-lg border border-dashed border-line px-4 py-2 text-sm font-medium text-ink hover:bg-accent/10"
        >
          ＋ 加入 AI 玩家
        </button>
      )}

      <footer className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
        {isHost ? (
          <button
            type="button"
            data-testid="start-game"
            onClick={onStart}
            disabled={!enough}
            className="rounded-lg bg-accent px-6 py-3 font-semibold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-muted"
          >
            開始遊戲
          </button>
        ) : (
          <p data-testid="waiting-host" className="text-sm text-ink-muted">
            等待房主開始遊戲
          </p>
        )}
        {isHost && !enough && (
          <p data-testid="start-hint" className="text-sm text-ink-muted">
            至少需要 {MIN_PLAYERS} 位玩家才能開始
          </p>
        )}
        <button type="button" data-testid="leave-room" onClick={onLeave} className="rounded-lg border border-line px-5 py-3 font-medium text-ink hover:bg-accent/10 sm:mr-auto">
          離開房間
        </button>
      </footer>
    </section>
  )
}
