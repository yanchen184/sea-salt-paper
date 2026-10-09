import { describe, expect, it } from 'vitest'
import { applyAction, createGame, removePlayer } from './game'
import { randomInt } from './rng'
import { randomLegalAction as chooseAction, SEATS } from './test-helpers'
import type { GameState } from './types'

function allCardIds(s: GameState): string[] {
  return [
    ...s.deck,
    ...s.pendingDraw,
    ...s.discards.flatMap((d) => d.cards),
    ...s.players.flatMap((p) => [...p.hand, ...p.field]),
    ...s.removed,
  ].map((c) => c.id)
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
