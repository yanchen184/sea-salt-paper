import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sea-salt-paper:animations'

function initial(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'on' || stored === 'off') return stored === 'on'
  } catch {
    // localStorage 不可用時使用系統偏好
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

let enabled: boolean | null = null
const listeners = new Set<() => void>()

function get(): boolean {
  enabled ??= initial()
  return enabled
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setAnimations(next: boolean): void {
  enabled = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // 無法寫入時本次仍生效，重整後回到預設
  }
  listeners.forEach((l) => l())
}

export function useAnimations(): boolean {
  return useSyncExternalStore(subscribe, get)
}
