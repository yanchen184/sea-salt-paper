export const NICKNAME_MAX = 12
const STORAGE_KEY = 'sea-salt-paper:nickname'

export function normalizeNickname(input: string): string {
  return input.trim()
}

export function isValidNickname(name: string): boolean {
  const length = [...name].length
  return length >= 1 && length <= NICKNAME_MAX
}

export function loadNickname(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveNickname(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    // 無法寫入 localStorage 時本次仍可使用暱稱，只是重整後要重填
  }
}
