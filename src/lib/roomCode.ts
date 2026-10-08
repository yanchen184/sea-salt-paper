/** 大寫英數，去掉易混淆的 0 O 1 I */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 4

export function generateRoomCode(randomValues: Uint32Array = crypto.getRandomValues(new Uint32Array(ROOM_CODE_LENGTH))): string {
  return Array.from(randomValues.slice(0, ROOM_CODE_LENGTH), (v) => ROOM_CODE_ALPHABET[v % ROOM_CODE_ALPHABET.length]).join('')
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase()
}

export function isRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && [...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch))
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0
}
