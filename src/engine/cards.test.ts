import { describe, expect, it } from 'vitest'
import { buildDeck } from './cards'

function tally(keys: string[]): Record<string, number> {
  return keys.reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {})
}

describe('G0 牌組', () => {
  it('[G0-1] 共 58 張，各種類張數符合規則 §1', () => {
    const deck = buildDeck()
    expect(deck).toHaveLength(58)
    expect(tally(deck.map((c) => c.kind))).toEqual({
      crab: 9,
      boat: 8,
      fish: 7,
      swimmer: 5,
      shark: 5,
      shell: 6,
      octopus: 5,
      penguin: 3,
      sailor: 2,
      lighthouse: 1,
      shoal: 1,
      penguinColony: 1,
      captain: 1,
      mermaid: 4,
    })
  })

  it('[G0-2] 各色總數符合規則 §1', () => {
    expect(tally(buildDeck().map((c) => c.color))).toEqual({
      darkBlue: 9,
      lightBlue: 9,
      black: 8,
      yellow: 8,
      lightGreen: 6,
      white: 4,
      purple: 4,
      lightGray: 4,
      lightOrange: 3,
      pink: 2,
      orange: 1,
    })
  })

  it('[G0-2] 逐張顏色抽查：crab、penguin、sailor', () => {
    const deck = buildDeck()
    const colorsOf = (kind: string) => deck.filter((c) => c.kind === kind).map((c) => c.color)
    expect(colorsOf('crab')).toEqual([
      'darkBlue', 'darkBlue', 'lightBlue', 'lightBlue', 'yellow', 'yellow', 'black', 'lightGreen', 'lightGray',
    ])
    expect(colorsOf('penguin')).toEqual(['purple', 'lightOrange', 'pink'])
    expect(colorsOf('sailor')).toEqual(['pink', 'orange'])
  })

  it('[G0-3] 每張 id 唯一', () => {
    expect(new Set(buildDeck().map((c) => c.id)).size).toBe(58)
  })
})
