import { useState } from 'react'
import { getLegalActions, type Action, type Card, type GameState, type LegalActions, type PileIndex } from '../../engine'
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

const PILE_NAMES = ['左堆', '右堆'] as const
const PILES: PileIndex[] = [0, 1]

interface MyPanelProps {
  game: GameState
  uid: string
  version: number
  busy: boolean
  onAction: (action: Action) => void
}

export function MyPanel({ game, uid, version, busy, onAction }: MyPanelProps) {
  const [selection, setSelection] = useState<{ version: number; ids: string[] }>({ version, ids: [] })
  const selected = selection.version === version ? selection.ids : []
  const legal = getLegalActions(game, uid)
  const me = game.players.find((p) => p.id === uid)
  if (!me) return null

  const choosing = legal.isMyTurn && game.phase === 'chooseDrawn'
  const handSelectable = legal.isMyTurn && game.phase === 'actions'

  function toggle(id: string, max: number) {
    const ids = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id].slice(-max)
    setSelection({ version, ids })
  }

  return (
    <section aria-label="你的區域" className="space-y-4 rounded-2xl bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="font-bold text-heading">
          你的手牌 <span data-testid="hand-count">{me.hand.length}</span> 張
        </h3>
        <span className="text-sm text-ink-muted">
          目前卡牌分 <span data-testid="my-points" className="font-bold text-heading">{myCardPoints(game, uid)}</span>
        </span>
        <span data-testid="hand-ids" className="sr-only">
          {me.hand.map((c) => c.id).join(',')}
        </span>
      </div>
      <div data-testid="my-hand" data-anim-zone="hand" className="flex min-h-[6.5rem] flex-wrap gap-2 pt-2">
        {me.hand.length === 0 && <span className="self-center text-sm text-ink-muted">手上沒有牌</span>}
        {me.hand.map((c) => (
          <CardView
            key={c.id}
            card={c}
            testId="hand-card"
            selected={selected.includes(c.id)}
            disabled={!handSelectable || busy}
            onClick={() => toggle(c.id, 2)}
          />
        ))}
      </div>

      {choosing && <DrawnChoice game={game} legal={legal} keepId={selected[0] ?? null} busy={busy} onPick={(id) => toggle(id, 1)} onAction={onAction} />}
      {game.phase === 'crabPick' && <CrabPick game={game} legal={legal} busy={busy} onAction={onAction} />}

      <ActionBar game={game} uid={uid} legal={legal} selected={selected} busy={busy} onAction={onAction} />
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
    <div data-testid="drawn-choice" data-anim-zone="drawn" className="space-y-2 rounded-xl bg-notice p-3">
      <p className="text-sm font-medium text-notice-ink">從牌庫抽到這兩張：點選要留下的牌，另一張放到棄牌堆</p>
      <div className="flex gap-2 pt-2">
        {game.pendingDraw.map((c) => (
          <CardView key={c.id} card={c} testId="drawn-card" selected={keepId === c.id} disabled={busy} onClick={() => onPick(c.id)} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
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
    return <p className="rounded-xl bg-notice p-3 text-sm text-notice-ink">{`${name} 正在從${PILE_NAMES[pile]}挑一張牌`}</p>
  return (
    <div data-testid="crab-pick" className="space-y-2 rounded-xl bg-notice p-3">
      <p className="text-sm font-medium text-notice-ink">{`螃蟹效果：從${PILE_NAMES[pile]}挑一張入手（其他人看不到）`}</p>
      <div className="flex flex-wrap gap-2">
        {game.discards[pile].cards.map((c) => (
          <CardView key={c.id} card={c} testId="crab-card" disabled={busy} onClick={() => onAction({ type: 'PICK_CRAB', cardId: c.id })} />
        ))}
      </div>
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
    <div className="space-y-2 border-t border-line pt-3">
      {quiet && (
        <p data-testid="wait-hint" className="text-sm text-ink-muted">
          {drawDeckHint(game, legal).reason}
        </p>
      )}
      <div className="flex flex-wrap items-start gap-3">
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
