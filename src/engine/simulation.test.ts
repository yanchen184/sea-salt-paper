import { describe, expect, it } from 'vitest'
import { applyAction, createGame, getLegalActions, removePlayer } from './game'
import { randomInt } from './rng'
import { SEATS } from './test-helpers'
import type { Action, GameState } from './types'

function allCardIds(s: GameState): string[] {
  return [
    ...s.deck,
    ...s.pendingDraw,
    ...s.discards.flatMap((d) => d.cards),
    ...s.players.flatMap((p) => [...p.hand, ...p.field]),
    ...s.removed,
  ].map((c) => c.id)
}

/** 從合法動作中隨機選一個；有可宣告時 30% 機率宣告 */
function chooseAction(s: GameState, rng: number): [Action, string, number] {
  const actor = s.status === 'roundEnd' ? (s.players[0]?.id ?? '') : (s.players[s.current]?.id ?? '')
  const legal = getLegalActions(s, actor)
  const options: Action[] = []
  if (legal.nextRound) options.push({ type: 'NEXT_ROUND' })
  if (legal.drawDeck) options.push({ type: 'DRAW_DECK' })
  for (const pile of legal.takeDiscard) options.push({ type: 'TAKE_DISCARD', pile })
  if (legal.keepDrawn) {
    for (const keepCardId of legal.keepDrawn.cardIds)
      for (const discardPile of legal.keepDrawn.piles) options.push({ type: 'KEEP_DRAWN', keepCardId, discardPile })
  }
  const player = s.players[s.current]
  for (const cardIds of legal.duos) {
    const kinds = cardIds.map((id) => player?.hand.find((c) => c.id === id)?.kind)
    const action: Extract<Action, { type: 'PLAY_DUO' }> = { type: 'PLAY_DUO', cardIds }
    const pile = legal.crabPiles[0]
    if (kinds[0] === 'crab' && pile !== undefined) action.crab = { pile }
    if (kinds.includes('shark') && legal.stealTargets[0]) action.steal = { targetId: legal.stealTargets[0] }
    options.push(action)
  }
  for (const cardId of legal.crabPick ?? []) options.push({ type: 'PICK_CRAB', cardId })
  let r = rng
  if (legal.declare) {
    const [roll, next] = randomInt(r, 10)
    r = next
    if (roll < 3) {
      const [kind, next2] = randomInt(r, 2)
      return [{ type: 'DECLARE', kind: kind === 0 ? 'stop' : 'lastChance' }, actor, next2]
    }
  }
  if (legal.endTurn) options.push({ type: 'END_TURN' })
  const [i, next] = randomInt(r, options.length)
  const action = options[i]
  if (!action) throw new Error(`沒有合法動作：${JSON.stringify({ status: s.status, phase: s.phase, legal })}`)
  return [action, actor, next]
}

function expectConserved(s: GameState): void {
  const ids = allCardIds(s)
  expect(ids.length).toBe(58)
  expect(new Set(ids).size).toBe(58)
}

describe('整場模擬', () => {
  it.each([2, 3, 4])('%i 人隨機合法動作 100 場都能打完，牌數守恆', (count) => {
    for (let seed = 1; seed <= 100; seed++) {
      let s = createGame(SEATS.slice(0, count), seed)
      let rng = seed * 7919
      let steps = 0
      while (s.status !== 'gameOver') {
        const [action, actor, next] = chooseAction(s, rng)
        rng = next
        const result = applyAction(s, actor, action)
        if (!result.ok) throw new Error(`seed ${seed} 步驟 ${steps}：${action.type} 被拒 ${result.error.code}`)
        s = result.state
        expectConserved(s)
        if (++steps > 20000) throw new Error(`seed ${seed} 沒有結束`)
      }
      expect(s.winnerId).not.toBeNull()
      expect(JSON.parse(JSON.stringify(s))).toEqual(s)
    }
  }, 120_000)

  it.each([3, 4])('%i 人隨機踢人 100 場都能打完，牌數守恆', (count) => {
    for (let seed = 1; seed <= 100; seed++) {
      let s = createGame(SEATS.slice(0, count), seed)
      let rng = seed * 104729
      let steps = 0
      while (s.status !== 'gameOver') {
        const [roll, afterRoll] = randomInt(rng, 60)
        rng = afterRoll
        if (roll === 0) {
          const [seat, afterSeat] = randomInt(rng, s.players.length)
          rng = afterSeat
          const result = removePlayer(s, s.players[seat]?.id ?? '')
          if (!result.ok) throw new Error(`seed ${seed} 踢人被拒 ${result.error.code}`)
          s = result.state
        } else {
          const [action, actor, next] = chooseAction(s, rng)
          rng = next
          const result = applyAction(s, actor, action)
          if (!result.ok) throw new Error(`seed ${seed} 步驟 ${steps}：${action.type} 被拒 ${result.error.code}`)
          s = result.state
        }
        expectConserved(s)
        expect(s.players.length + s.kicked.length).toBe(count)
        if (++steps > 20000) throw new Error(`seed ${seed} 沒有結束`)
      }
      expect(s.players.some((p) => p.id === s.winnerId)).toBe(true)
      expect(JSON.parse(JSON.stringify(s))).toEqual(s)
    }
  }, 120_000)
})
