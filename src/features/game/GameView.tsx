import { useState } from 'react'
import type { Action, GameState } from '../../engine'
import { rooms } from '../../firebase/app'
import type { Room } from '../../firebase/types'
import { turnText } from './actionHints'
import { MyPanel } from './MyPanel'
import { PlayersPanel } from './PlayersPanel'
import { GameOverPanel, ResultPanel } from './ResultPanel'
import { TablePanel } from './TablePanel'

const LOG_LIMIT = 12

interface GameViewProps {
  room: Room
  game: GameState
  uid: string
  isOffline: (uid: string) => boolean
  run: (task: () => Promise<void>) => Promise<void>
  onLeave: () => void
}

export function GameView({ room, game, uid, isOffline, run, onLeave }: GameViewProps) {
  const [busy, setBusy] = useState(false)

  async function perform(task: () => Promise<void>) {
    setBusy(true)
    try {
      await run(task)
    } finally {
      setBusy(false)
    }
  }

  const send = (action: Action) => perform(() => rooms.sendAction(room.code, uid, action, room.version))
  const hostName = room.players.find((p) => p.uid === room.hostId)?.name ?? ''
  const declarer = game.declaration && game.players.find((p) => p.id === game.declaration?.playerId)

  return (
    <section data-testid="game-view" className="space-y-4">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-2xl bg-surface p-4 shadow-sm">
        <h2 data-testid="game-status" className="text-xl font-bold text-heading">
          {room.status === 'finished' ? '遊戲已結束' : '遊戲進行中'}
        </h2>
        <span className="text-sm text-ink-muted">{`房號 ${room.code} · 第 ${game.round} 局 · 目標 ${game.targetScore} 分`}</span>
        <p data-testid="turn-text" className="w-full font-medium text-heading">
          {turnText(game, uid)}
        </p>
        {declarer && game.status === 'playing' && game.declaration?.kind === 'lastChance' && (
          <p data-testid="last-chance-banner" className="w-full rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
            {`${declarer.name} 宣告了 LAST CHANCE：其他人各再進行 1 回合後計分，${declarer.name} 的手牌不能被偷`}
          </p>
        )}
      </header>

      {game.status === 'gameOver' && (
        <GameOverPanel
          game={game}
          isHost={room.hostId === uid}
          hostName={hostName}
          busy={busy}
          onRestart={() => perform(() => rooms.restartGame(room.code, uid))}
          onLeave={onLeave}
        />
      )}
      {game.status !== 'playing' && <ResultPanel game={game} uid={uid} isHost={room.hostId === uid} hostName={hostName} busy={busy} onNextRound={() => send({ type: 'NEXT_ROUND' })} />}

      <PlayersPanel room={room} game={game} uid={uid} isOffline={isOffline} busy={busy} onKick={(target) => perform(() => rooms.kickPlayer(room.code, uid, target))} />
      {game.status === 'playing' && (
        <>
          <TablePanel game={game} />
          <MyPanel game={game} uid={uid} version={room.version} busy={busy} onAction={send} />
        </>
      )}
      <GameLog game={game} />
    </section>
  )
}

function GameLog({ game }: { game: GameState }) {
  const entries = game.log.map((e, index) => ({ ...e, index })).filter((e) => e.round === game.round).slice(-LOG_LIMIT)
  return (
    <section aria-label="本局紀錄" className="rounded-2xl bg-surface p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-ink">本局紀錄</h3>
      <ol data-testid="game-log" className="space-y-1 text-sm text-ink-muted">
        {entries.map((e) => (
          <li key={e.index}>{e.text}</li>
        ))}
      </ol>
    </section>
  )
}
