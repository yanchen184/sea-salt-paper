import type { Action, Card, GameState, LegalActions, PileIndex } from '../../engine'
import { ActionButton } from './ActionButton'
import {
  declareHint,
  drawDeckHint,
  endTurnHint,
  myCardPoints,
  playDuoHint,
  takeDiscardHint,
  type Hint,
} from './actionHints'
import { CardView } from './CardView'
import { Fan } from './Fan'
import { SeatField, SeatTitle, type SeatInfo } from './PlayersPanel'

const PILE_NAMES = ['左堆', '右堆'] as const
const PILES: PileIndex[] = [0, 1]

interface MyPanelProps {
  game: GameState
  uid: string
  info: SeatInfo
  legal: LegalActions
  selected: string[]
  busy: boolean
  onToggle: (id: string, max: number) => void
  onAction: (action: Action) => void
}

export function MyPanel({ game, uid, info, legal, selected, busy, onToggle: toggle, onAction }: MyPanelProps) {
  const me = game.players.find((p) => p.id === uid)
  if (!me) return null

  const choosing = legal.isMyTurn && game.phase === 'chooseDrawn'
  const handSelectable = legal.isMyTurn && game.phase === 'actions'

  return (
    <section aria-label="你的區域" className="shrink-0 space-y-1 rounded-2xl bg-surface p-2 shadow-sm sm:p-3">
      <div data-testid="player" data-current={info.isCurrent} className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1 space-y-0.5">
          <SeatTitle player={me} info={info} />
          <p className="text-xs text-ink-muted">
            手牌 <span data-testid="hand-count">{me.hand.length}</span> 張 · 目前卡牌分{' '}
            <span data-testid="my-points" className="font-bold text-heading">{myCardPoints(game, uid)}</span>
            <span data-testid="hand-ids" className="sr-only">
              {me.hand.map((c) => c.id).join(',')}
            </span>
          </p>
        </div>
        <SeatField player={me} className="w-full sm:w-auto sm:max-w-[50%]" />
      </div>
      <Fan testId="my-hand" zone="hand" basis="basis-16 short:basis-12" className="min-h-[6.5rem] justify-center pt-2 short:min-h-[5rem]">
        {me.hand.length === 0
          ? [<span key="empty" className="self-center whitespace-nowrap text-sm text-ink-muted">手上沒有牌</span>]
          : me.hand.map((c) => (
              <CardView
                key={c.id}
                card={c}
                testId="hand-card"
                selected={selected.includes(c.id)}
                disabled={!handSelectable || busy}
                onClick={() => toggle(c.id, 2)}
              />
            ))}
      </Fan>

      {choosing ? (
        <DrawnChoice game={game} legal={legal} keepId={selected[0] ?? null} busy={busy} onPick={(id) => toggle(id, 1)} onAction={onAction} />
      ) : game.phase === 'crabPick' ? (
        <CrabPick game={game} legal={legal} busy={busy} onAction={onAction} />
      ) : (
        <ActionBar game={game} uid={uid} legal={legal} selected={selected} busy={busy} onAction={onAction} />
      )}
    </section>
  )
}
interface DrawnChoiceProps {
  game: GameState
  legal: LegalActions
  keepId: string | null
  busy: boolean
  onPick: (id: string) => void
  onAction: (action: Action) => void
}

function DrawnChoice({ game, legal, keepId, busy, onPick, onAction }: DrawnChoiceProps) {
  const allowed = legal.keepDrawn?.piles ?? []
  function hint(pile: PileIndex): Hint {
    if (!keepId) return { enabled: false, reason: '先點選要留下的那張牌' }
    if (!allowed.includes(pile)) return { enabled: false, reason: '有空的棄牌堆時，必須放到空的那一堆' }
    return { enabled: true, reason: null }
  }
  return (
    <div data-testid="drawn-choice" data-anim-zone="drawn" className="space-y-1 rounded-xl bg-notice p-2">
      <p className="text-xs font-medium text-notice-ink sm:text-sm">從牌庫抽到這兩張：點選要留下的牌，另一張放到棄牌堆</p>
      <div className="flex flex-wrap items-end gap-2 pt-1">
        {game.pendingDraw.map((c) => (
          <CardView key={c.id} card={c} testId="drawn-card" selected={keepId === c.id} disabled={busy} onClick={() => onPick(c.id)} />
        ))}
        {PILES.map((pile) => (
          <ActionButton
            key={pile}
            testId={`discard-to-${pile}`}
            hint={hint(pile)}
            busy={busy}
            onClick={() => keepId && onAction({ type: 'KEEP_DRAWN', keepCardId: keepId, discardPile: pile })}
          >
            另一張放到{PILE_NAMES[pile]}
          </ActionButton>
        ))}
      </div>
    </div>
  )
}

function CrabPick({ game, legal, busy, onAction }: { game: GameState; legal: LegalActions; busy: boolean; onAction: (action: Action) => void }) {
  const pile = game.crabPile
  if (pile === null) return null
  const name = game.players[game.current]?.name ?? ''
  if (!legal.crabPick)
    return <p className="rounded-xl bg-notice p-2 text-sm text-notice-ink">{`${name} 正在從${PILE_NAMES[pile]}挑一張牌`}</p>
  return (
    <div data-testid="crab-pick" className="space-y-1 rounded-xl bg-notice p-2">
      <p className="text-xs font-medium text-notice-ink sm:text-sm">{`螃蟹效果：從${PILE_NAMES[pile]}挑一張入手（其他人看不到）`}</p>
      <Fan basis="basis-16 short:basis-12" className="pt-1">
        {game.discards[pile].cards.map((c) => (
          <CardView key={c.id} card={c} testId="crab-card" disabled={busy} onClick={() => onAction({ type: 'PICK_CRAB', cardId: c.id })} />
        ))}
      </Fan>
    </div>
  )
}

interface ActionBarProps {
  game: GameState
  uid: string
  legal: LegalActions
  selected: string[]
  busy: boolean
  onAction: (action: Action) => void
}

function ActionBar({ game, uid, legal, selected, busy, onAction }: ActionBarProps) {
  if (game.status !== 'playing') return null
  const quiet = !legal.isMyTurn
  return (
    <div className="space-y-1 border-t border-line pt-2">
      {quiet && (
        <p data-testid="wait-hint" className="text-sm text-ink-muted">
          {drawDeckHint(game, legal).reason}
        </p>
      )}
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <ActionButton testId="action-draw" hideReason={quiet} hint={drawDeckHint(game, legal)} busy={busy} onClick={() => onAction({ type: 'DRAW_DECK' })}>
          抽牌庫
        </ActionButton>
        {PILES.map((pile) => (
          <ActionButton
            key={pile}
            testId={`action-take-${pile}`}
            tone="secondary"
            hideReason={quiet} hint={takeDiscardHint(game, legal, pile)}
            busy={busy}
            onClick={() => onAction({ type: 'TAKE_DISCARD', pile })}
          >
            拿{PILE_NAMES[pile]}頂牌
          </ActionButton>
        ))}
        <DuoButtons game={game} legal={legal} selected={selected} busy={busy} hideReason={quiet} onAction={onAction} />
        <ActionButton testId="declare-stop" tone="danger" hideReason={quiet} hint={declareHint(game, uid, legal)} busy={busy} onClick={() => onAction({ type: 'DECLARE', kind: 'stop' })}>
          宣告 STOP
        </ActionButton>
        <ActionButton
          testId="declare-last-chance"
          tone="danger"
          hideReason={quiet} hint={declareHint(game, uid, legal)}
          busy={busy}
          onClick={() => onAction({ type: 'DECLARE', kind: 'lastChance' })}
        >
          宣告 LAST CHANCE
        </ActionButton>
        <ActionButton testId="end-turn" tone="secondary" hideReason={quiet} hint={endTurnHint(game, legal)} busy={busy} onClick={() => onAction({ type: 'END_TURN' })}>
          結束回合
        </ActionButton>
      </div>
    </div>
  )
}

function pairKind(cards: Card[]): 'crab' | 'steal' | 'other' {
  const kinds = new Set(cards.map((c) => c.kind))
  if (kinds.size === 1 && kinds.has('crab')) return 'crab'
  if (kinds.has('shark') && kinds.has('swimmer')) return 'steal'
  return 'other'
}

interface DuoButtonsProps {
  game: GameState
  legal: LegalActions
  selected: string[]
  busy: boolean
  hideReason: boolean
  onAction: (action: Action) => void
}

function DuoButtons({ game, legal, selected, busy, hideReason, onAction }: DuoButtonsProps) {
  const hint = playDuoHint(game, legal, selected)
  const [a, b] = selected
  if (!hint.enabled || !a || !b)
    return (
      <ActionButton testId="play-duo" hideReason={hideReason} hint={hint} busy={busy} onClick={() => undefined}>
        打出選取的一對
      </ActionButton>
    )

  const cardIds: [string, string] = [a, b]
  const hand = game.players[game.current]?.hand ?? []
  const kind = pairKind(hand.filter((c) => c.id === a || c.id === b))
  const ok: Hint = { enabled: true, reason: null }

  if (kind === 'crab' && legal.crabPiles.length > 0)
    return legal.crabPiles.map((pile) => (
      <ActionButton key={pile} testId={`duo-crab-${pile}`} hint={ok} busy={busy} onClick={() => onAction({ type: 'PLAY_DUO', cardIds, crab: { pile } })}>
        打出螃蟹，從{PILE_NAMES[pile]}挑
      </ActionButton>
    ))
  if (kind === 'steal' && legal.stealTargets.length > 0)
    return legal.stealTargets.map((targetId) => (
      <ActionButton
        key={targetId}
        testId="duo-steal"
        hint={ok}
        busy={busy}
        onClick={() => onAction({ type: 'PLAY_DUO', cardIds, steal: { targetId } })}
      >
        打出鯊魚與游泳者，偷 {game.players.find((p) => p.id === targetId)?.name}
      </ActionButton>
    ))
  return (
    <ActionButton testId="play-duo" hint={ok} busy={busy} onClick={() => onAction({ type: 'PLAY_DUO', cardIds })}>
      打出選取的一對
    </ActionButton>
  )
}
