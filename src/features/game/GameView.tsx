import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getLegalActions, type Action, type GameState } from '../../engine'
import { rooms } from '../../firebase/app'
import type { Room } from '../../firebase/types'
import { turnText } from './actionHints'
import { AnimationLayer } from './anim/AnimationLayer'
import { useAnimatedGame } from './anim/useAnimatedGame'
import { MyPanel } from './MyPanel'
import { pileTargets } from './pileTargets'
import { PlayersPanel, seatInfo } from './PlayersPanel'
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

export function GameView({ room, game: latest, uid, isOffline, run, onLeave }: GameViewProps) {
  const [sending, setSending] = useState(false)
  const [selection, setSelection] = useState<{ version: number; ids: string[] }>({ version: room.version, ids: [] })
  const { shown: game, playing, done } = useAnimatedGame(latest)
  const busy = sending || playing !== null
  const selected = selection.version === room.version ? selection.ids : []
  const legal = getLegalActions(game, uid)

  function toggle(id: string, max: number) {
    const ids = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id].slice(-max)
    setSelection({ version: room.version, ids })
  }

  async function perform(task: () => Promise<void>) {
    setSending(true)
    try {
      await run(task)
    } finally {
      setSending(false)
    }
  }

  const send = (action: Action) => perform(() => rooms.sendAction(room.code, uid, action, room.version))
  const hostName = room.players.find((p) => p.uid === room.hostId)?.name ?? ''
  const declarer = game.declaration && game.players.find((p) => p.id === game.declaration?.playerId)

  const me = game.players.findIndex((p) => p.id === uid)
  const myPlayer = game.players[me]
  const showResult = game.status !== 'playing'

  return (
    <section data-testid="game-view" className="flex h-full min-h-0 flex-col gap-2">
      <div className="contents" inert={showResult}>
        <header className="relative flex shrink-0 flex-col rounded-2xl bg-surface px-3 py-2 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:pr-56">
          <div className="flex flex-wrap items-baseline gap-x-3 pr-56 sm:pr-0">
            <h2 data-testid="game-status" className="text-base font-bold text-heading sm:text-lg">
              {room.status === 'finished' ? '遊戲已結束' : '遊戲進行中'}
            </h2>
            <span className="text-xs text-ink-muted">{`房號 ${room.code} · 第 ${game.round} 局 · 目標 ${game.targetScore} 分`}</span>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p data-testid="turn-text" className="min-w-0 flex-1 text-sm font-medium text-heading">
              {turnText(game, uid)}
            </p>
            <GameLog game={game} />
          </div>
          {declarer && game.status === 'playing' && game.declaration?.kind === 'lastChance' && (
            <p data-testid="last-chance-banner" className="mt-1 w-full rounded-lg bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800">
              {`${declarer.name} 宣告了 LAST CHANCE：其他人各再進行 1 回合後計分，${declarer.name} 的手牌不能被偷`}
            </p>
          )}
        </header>

        <PlayersPanel room={room} game={game} uid={uid} isOffline={isOffline} busy={busy} onKick={(target) => perform(() => rooms.kickPlayer(room.code, uid, target))} />
        <div className="flex min-h-0 flex-1 justify-center [align-items:safe_center]">
          {game.status === 'playing' && <TablePanel game={game} targets={pileTargets(game, legal, selected)} busy={busy} onAction={send} />}
        </div>
        {game.status === 'playing' && myPlayer && (
          <MyPanel
            game={game}
            uid={uid}
            info={seatInfo(room, game, myPlayer, me, uid, isOffline)}
            legal={legal}
            selected={selected}
            busy={busy}
            onToggle={toggle}
            onAction={send}
          />
        )}
      </div>

      {showResult && (
        <ResultOverlay label={game.status === 'gameOver' ? '遊戲結束' : `第 ${game.round} 局計分`}>
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
          <ResultPanel game={game} uid={uid} isHost={room.hostId === uid} hostName={hostName} busy={busy} onNextRound={() => send({ type: 'NEXT_ROUND' })} />
        </ResultOverlay>
      )}
      {playing && <AnimationLayer key={playing.seq} event={playing} before={game} viewerId={uid} onDone={done} />}
    </section>
  )
}

function ResultOverlay({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      data-testid="result-overlay"
      className="fixed inset-0 z-[5] overflow-y-auto bg-black/40 px-3 pb-3 pt-14 outline-none"
    >
      <div className="mx-auto max-w-2xl space-y-3">{children}</div>
    </div>
  )
}

function GameLog({ game }: { game: GameState }) {
  const entries = game.log.map((e, index) => ({ ...e, index })).filter((e) => e.round === game.round).slice(-LOG_LIMIT)
  return (
    <details aria-label="本局紀錄" className="group shrink-0">
      <summary className="cursor-pointer list-none rounded-lg px-2 py-0.5 text-xs font-semibold text-heading ring-1 ring-inset ring-accent/60 hover:bg-accent/10">
        紀錄
      </summary>
      <ol
        data-testid="game-log"
        className="absolute inset-x-2 top-full z-[3] mt-1 max-h-[50dvh] space-y-1 overflow-y-auto rounded-xl bg-surface p-3 text-sm text-ink-muted shadow-lg ring-1 ring-line"
      >
        {entries.map((e) => (
          <li key={e.index}>{e.text}</li>
        ))}
      </ol>
    </details>
  )
}