import { describe, expect, it } from 'vitest'
import { cardPoints, colorBonus, scoreRound } from './scoring'
import { cards } from './test-helpers'

const range = (kind: string, n: number) => Array.from({ length: n }, (_, i) => `${kind}-${i + 1}`)

describe('G7 卡牌分 §5', () => {
  it.each([
    ['shell', 1, 0],
    ['shell', 2, 2],
    ['shell', 3, 4],
    ['shell', 4, 6],
    ['shell', 5, 8],
    ['shell', 6, 10],
    ['octopus', 1, 0],
    ['octopus', 2, 3],
    ['octopus', 3, 6],
    ['octopus', 4, 9],
    ['octopus', 5, 12],
    ['penguin', 1, 1],
    ['penguin', 2, 3],
    ['penguin', 3, 5],
    ['sailor', 1, 0],
    ['sailor', 2, 5],
  ] as const)('[G7-1] collector：%s × %i = %i 分', (kind, n, expected) => {
    const result = cardPoints(cards(...range(kind, n)))
    expect(result.collector).toBe(expected)
    expect(result.total).toBe(expected)
  })

  it('[G7-1] lighthouse：3 boat + lighthouse', () => {
    // duo: floor(3/2) = 1；lighthouse: 3 × 1 = 3；合計 4
    const r = cardPoints(cards('boat-1', 'boat-2', 'boat-3', 'lighthouse-1'))
    expect(r).toMatchObject({ duo: 1, multiplier: 3, total: 4 })
  })

  it('[G7-1] shoal：3 shell + shoal + 2 fish', () => {
    // shell 3 張 = 4；fish duo = 1；shoal: 2 × 1 = 2；合計 7
    const r = cardPoints(cards('shell-1', 'shell-2', 'shell-3', 'shoal-1', 'fish-1', 'fish-2'))
    expect(r).toMatchObject({ duo: 1, collector: 4, multiplier: 2, total: 7 })
  })

  it('[G7-1] penguinColony：2 penguin + colony', () => {
    // penguin 2 張 = 3；colony: 2 × 2 = 4；合計 7
    const r = cardPoints(cards('penguin-1', 'penguin-2', 'penguinColony-1'))
    expect(r).toMatchObject({ collector: 3, multiplier: 4, total: 7 })
  })

  it('[G7-1] captain：1 sailor + captain 與 2 sailor + captain', () => {
    // sailor 1 張 = 0；captain: 1 × 3 = 3；合計 3
    expect(cardPoints(cards('sailor-1', 'captain-1')).total).toBe(3)
    // sailor 2 張 = 5；captain: 2 × 3 = 6；合計 11
    expect(cardPoints(cards('sailor-1', 'sailor-2', 'captain-1')).total).toBe(11)
  })

  it('[G7-1] multiplier 沒有對應牌時 0 分', () => {
    expect(cardPoints(cards('lighthouse-1', 'shoal-1', 'penguinColony-1', 'captain-1')).total).toBe(0)
  })

  it('[G7-1] 手上未打出的 duo 成對計分，落單 0 分', () => {
    // crab floor(3/2) = 1；boat floor(2/2) = 1；fish floor(1/2) = 0；合計 2
    const r = cardPoints(cards('crab-1', 'crab-2', 'crab-3', 'boat-1', 'boat-2', 'fish-1'))
    expect(r).toMatchObject({ duo: 2, total: 2 })
  })

  it('[G7-1] shark 與 swimmer 交叉成對', () => {
    // min(shark 2, swimmer 1) = 1
    expect(cardPoints(cards('shark-1', 'shark-2', 'swimmer-1')).duo).toBe(1)
    // min(shark 2, swimmer 0) = 0
    expect(cardPoints(cards('shark-1', 'shark-2')).duo).toBe(0)
    // min(shark 2, swimmer 3) = 2
    expect(cardPoints(cards('shark-1', 'shark-2', 'swimmer-1', 'swimmer-2', 'swimmer-3')).duo).toBe(2)
  })

  it('[G7-1] 1 張 mermaid 取最多的顏色', () => {
    // darkBlue: crab-1, crab-2, boat-1 = 3；yellow: crab-5 = 1；mermaid = 3
    // duo: crab floor(3/2) = 1；合計 4
    const r = cardPoints(cards('mermaid-1', 'crab-1', 'crab-2', 'boat-1', 'crab-5'))
    expect(r).toMatchObject({ mermaid: 3, duo: 1, total: 4 })
  })

  it('[G7-1] 2 張 mermaid 取最多與次多的不同顏色', () => {
    // darkBlue 3（shell-1, fish-1, swimmer-1）、yellow 1（octopus-2）；mermaid = 3 + 1 = 4
    const r = cardPoints(cards('mermaid-1', 'mermaid-2', 'shell-1', 'fish-1', 'swimmer-1', 'octopus-2'))
    expect(r.mermaid).toBe(4)
  })

  it('[G7-1] 3 張 mermaid：同色數相同時各算一色', () => {
    // darkBlue 2（shell-1, fish-1）、lightBlue 2（shell-2, octopus-1）、black 1（shark-3）；mermaid = 2 + 2 + 1 = 5
    const r = cardPoints(
      cards('mermaid-1', 'mermaid-2', 'mermaid-3', 'shell-1', 'fish-1', 'shell-2', 'octopus-1', 'shark-3'),
    )
    expect(r.mermaid).toBe(5)
  })

  it('[G7-1] 同一色不可被兩張 mermaid 重複計算', () => {
    // 只有 darkBlue 3（shell-1, fish-1, swimmer-1）；2 張 mermaid = 3 + 0 = 3
    const r = cardPoints(cards('mermaid-1', 'mermaid-2', 'shell-1', 'fish-1', 'swimmer-1'))
    expect(r.mermaid).toBe(3)
  })

  it('[G7-1] 4 張 mermaid 計分時不計 white', () => {
    // 非 white 只有 purple 1（octopus-5）；mermaid = 1 + 0 + 0 + 0 = 1
    const r = cardPoints(cards('mermaid-1', 'mermaid-2', 'mermaid-3', 'mermaid-4', 'octopus-5'))
    expect(r.mermaid).toBe(1)
  })
})

describe('G7 顏色加分 §6', () => {
  it('[G7-5] 顏色加分包含 white', () => {
    // white 3、darkBlue 2 → 3
    expect(colorBonus(cards('mermaid-1', 'mermaid-2', 'mermaid-3', 'shell-1', 'fish-1'))).toBe(3)
  })

  it('[G7-5] 取最多的同色張數', () => {
    // darkBlue 3（crab-1, crab-2, boat-1）、lightBlue 1（crab-3）→ 3
    expect(colorBonus(cards('crab-1', 'crab-2', 'boat-1', 'crab-3'))).toBe(3)
    expect(colorBonus([])).toBe(0)
  })
})

describe('G7 本局計分 §4', () => {
  // a：shell 1–4 = 6、crab-1 + crab-2 duo 1 → 卡牌分 7；顏色 darkBlue 3（shell-1, crab-1, crab-2）→ 3
  const a = { id: 'a', hand: cards('shell-1', 'shell-2', 'shell-3', 'shell-4', 'crab-1'), field: cards('crab-2') }
  // b：octopus 1–3 = 6、penguin-1 = 1 → 卡牌分 7；顏色各 1 → 1
  const b = { id: 'b', hand: cards('octopus-1', 'octopus-2', 'octopus-3', 'penguin-1'), field: [] }
  // c：boat duo = 1 → 卡牌分 1；顏色 darkBlue 2 → 2
  const c = { id: 'c', hand: cards('boat-1', 'boat-2'), field: [] }

  it('[G7-2] STOP 每人得卡牌分', () => {
    const { scores } = scoreRound([a, b, c], { kind: 'stop', playerId: 'a' })
    expect(scores.map((s) => s.gained)).toEqual([7, 7, 1])
  })

  it('[G7-3] LAST CHANCE 宣告者平手也算贏：宣告者卡牌分 + 顏色，其他人只得顏色', () => {
    // a 7 ≥ b 7、a 7 ≥ c 1 → 贏；a = 7 + 3 = 10；b = 1；c = 2
    const r = scoreRound([a, b, c], { kind: 'lastChance', playerId: 'a' })
    expect(r.declarerWon).toBe(true)
    expect(r.scores.map((s) => s.gained)).toEqual([10, 1, 2])
  })

  it('[G7-4] LAST CHANCE 宣告者輸：宣告者只得顏色，其他人得卡牌分', () => {
    // c 1 < a 7 → 輸；a = 7；b = 7；c = 2
    const r = scoreRound([a, b, c], { kind: 'lastChance', playerId: 'c' })
    expect(r.declarerWon).toBe(false)
    expect(r.scores.map((s) => s.gained)).toEqual([7, 7, 2])
  })
})
