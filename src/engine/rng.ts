/** mulberry32；回傳 [0,1) 的亂數與下一個狀態 */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

/** 回傳 [0, n) 的整數與下一個狀態 */
export function randomInt(state: number, n: number): [number, number] {
  const [r, next] = nextRandom(state)
  return [Math.floor(r * n), next]
}

export function shuffle<T>(items: readonly T[], state: number): [T[], number] {
  const result = [...items]
  let s = state
  for (let i = result.length - 1; i > 0; i--) {
    const [j, next] = randomInt(s, i + 1)
    s = next
    const tmp = result[i] as T
    result[i] = result[j] as T
    result[j] = tmp
  }
  return [result, s]
}
