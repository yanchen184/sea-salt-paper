import { getLegalActions, type GameState, type RoundResult } from '../../engine'
import { MIN_PLAYERS } from '../../firebase/rooms'
import { ActionButton } from './ActionButton'
import type { Hint } from './actionHints'
import { CardView } from './CardView'

const WIN_REASONS = {
  score: '達到目標分數',
  mermaids: '集滿 4 張美人魚',
  lastPlayer: '其他玩家都已離開',
} as const

function replayHint(game: GameState): Hint {
  if (game.players.length < MIN_PLAYERS) return { enabled: false, reason: `剩不到 ${MIN_PLAYERS} 位玩家，請離開房間重新建立` }
  return { enabled: true, reason: null }
}

function roundTitle(game: GameState, result: RoundResult): string {
  const declarer = game.players.find((p) => p.id === result.declarerId)?.name ?? '已離開的玩家'
  if (result.reason === 'void') return '牌庫抽完且無人宣告，本局作廢，所有人 0 分'
  if (result.reason === 'stop') return `${declarer} 宣告 STOP，每人得自己的卡牌分`
  return result.declarerWon
    ? `${declarer} 宣告 LAST CHANCE 成功：得卡牌分 + 顏色加分，其他人只得顏色加分`
    : `${declarer} 宣告 LAST CHANCE 失敗：只得顏色加分，其他人得卡牌分`
}

interface ResultPanelProps {
  game: GameState
  uid: string
  isHost: boolean
  hostName: string
  busy: boolean
  onNextRound: () => void
}

/** 本局結束或整場結束時攤開所有人的牌 */
export function ResultPanel({ game, uid, isHost, hostName, busy, onNextRound }: ResultPanelProps) {
  const result = game.roundResult
  const legal = getLegalActions(game, uid)
  return (
    <section data-testid="round-result" className="space-y-3 rounded-2xl bg-notice p-4 shadow-sm ring-1 ring-line">
      <h3 className="text-lg font-bold text-notice-ink">{`第 ${game.round} 局 · 攤牌`}</h3>
      {result && (
        <p data-testid="round-reason" className="text-sm text-notice-ink">
          {roundTitle(game, result)}
        </p>
      )}
      <ul className="space-y-3">
        {game.players.map((p) => {
          const score = result?.scores.find((s) => s.playerId === p.id)
          return (
            <li key={p.id} data-testid="reveal" className="space-y-1 rounded-xl bg-surface p-3">
              <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span data-testid="reveal-name" className="font-semibold text-ink">
                  {p.name}
                </span>
                {score && (
                  <>
                    <span className="text-ink-muted">卡牌分 {score.cardPoints}</span>
                    <span className="text-ink-muted">顏色加分 {score.colorBonus}</span>
                    <span className="font-bold text-heading">
                      本局 +<span data-testid="reveal-gained">{score.gained}</span>
                    </span>
                  </>
                )}
                <span className="ml-auto text-ink-muted">總分 {p.score}</span>
              </div>
              <div className="flex flex-wrap gap-1" data-testid="reveal-hand">
                {[...p.hand, ...p.field].map((c) => (
                  <CardView key={c.id} card={c} size="sm" />
                ))}
              </div>
            </li>
          )
        })}
      </ul>
      {game.status === 'roundEnd' &&
        (isHost ? (
          <ActionButton testId="next-round" hint={{ enabled: legal.nextRound, reason: null }} busy={busy} onClick={onNextRound}>
            開始下一局
          </ActionButton>
        ) : (
          <p data-testid="waiting-next-round" className="text-sm text-notice-ink">{`等待房主 ${hostName} 開始下一局`}</p>
        ))}
    </section>
  )
}

interface GameOverPanelProps {
  game: GameState
  isHost: boolean
  hostName: string
  busy: boolean
  onRestart: () => void
  onLeave: () => void
}

export function GameOverPanel({ game, isHost, hostName, busy, onRestart, onLeave }: GameOverPanelProps) {
  const winner = game.players.find((p) => p.id === game.winnerId)
  const ranking = [...game.players].sort((a, b) => b.score - a.score)
  return (
    <section data-testid="game-over" className="space-y-3 rounded-2xl bg-surface p-5 text-center shadow-sm ring-2 ring-amber-300">
      <p className="text-3xl" aria-hidden>
        🏆
      </p>
      <h3 data-testid="winner" className="text-xl font-bold text-heading">
        {winner ? `${winner.name} 獲勝` : '遊戲結束'}
      </h3>
      {game.winReason && <p className="text-sm text-ink-muted">{WIN_REASONS[game.winReason]}</p>}
      <ol className="mx-auto max-w-xs space-y-1 text-left">
        {ranking.map((p, i) => (
          <li key={p.id} data-testid="final-score" className="flex justify-between rounded-lg bg-accent/10 px-3 py-1 text-sm">
            <span>{`${i + 1}. ${p.name}`}</span>
            <span className="font-bold">{p.score} 分</span>
          </li>
        ))}
        {game.kicked.map((p) => (
          <li key={p.id} className="flex justify-between rounded-lg px-3 py-1 text-sm text-ink-muted">
            <span>{`${p.name}（已移出）`}</span>
            <span>{p.score} 分</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap justify-center gap-3">
        {isHost ? (
          <ActionButton testId="play-again" hint={replayHint(game)} busy={busy} onClick={onRestart}>
            再玩一場
          </ActionButton>
        ) : (
          <p data-testid="waiting-replay" className="self-center text-sm text-ink-muted">{`等待房主 ${hostName} 開始下一場`}</p>
        )}
        <ActionButton testId="leave-room" tone="secondary" hint={{ enabled: true, reason: null }} busy={busy} onClick={onLeave}>
          離開房間
        </ActionButton>
      </div>
    </section>
  )
}
