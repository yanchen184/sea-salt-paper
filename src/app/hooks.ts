import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { watchUser } from '../firebase/app'
import { RoomError } from '../firebase/types'
import { isRoomCode, normalizeRoomCode } from '../lib/roomCode'

export type Route = { name: 'home' } | { name: 'room'; code: string }

function parseHash(hash: string): Route {
  const match = hash.match(/^#\/room\/([^/]+)$/)
  const code = match?.[1] ? normalizeRoomCode(decodeURIComponent(match[1])) : ''
  return isRoomCode(code) ? { name: 'room', code } : { name: 'home' }
}

export function navigate(route: Route): void {
  window.location.hash = route.name === 'room' ? `#/room/${route.code}` : '#/'
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export type AuthState = { status: 'loading' } | { status: 'ready'; user: User } | { status: 'error'; message: string }

export function useAuthUser(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  useEffect(
    () =>
      watchUser(
        (user) => setState({ status: 'ready', user }),
        (error) => setState({ status: 'error', message: describeError(error) }),
      ),
    [],
  )
  return state
}

/** 每隔 intervalMs 回傳目前時間，用來重新判斷離線 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

export function describeError(error: unknown): string {
  if (error instanceof RoomError) return error.message
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') return '沒有權限進行這個操作'
    if (error.code === 'unavailable') return '連線中斷，請檢查網路後再試'
  }
  return '發生錯誤，請再試一次'
}
