export const HEARTBEAT_MS = 15_000
export const OFFLINE_AFTER_MS = 45_000

/** 規則：超過 45 秒沒更新，或從未寫過心跳，視為離線 */
export function isOffline(lastSeenMs: number | null | undefined, nowMs: number): boolean {
  if (lastSeenMs === null || lastSeenMs === undefined) return true
  return nowMs - lastSeenMs > OFFLINE_AFTER_MS
}
