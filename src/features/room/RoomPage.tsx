import { useEffect, useState } from 'react'
import { describeError, navigate, useNow } from '../../app/hooks'
import { ErrorBanner } from '../../app/ErrorBanner'
import { aiTurnToPlay, hostToClaim, isAiUid } from '../../firebase/aiSeats'
import { db, rooms } from '../../firebase/app'
import { startHeartbeat, subscribePresence, type PresenceMap } from '../../firebase/presence'
import { RoomError, type Room } from '../../firebase/types'
import { HEARTBEAT_MS, isOffline } from '../../lib/presence'
import { GameView } from '../game/GameView'
import { LobbyView } from '../lobby/LobbyView'

interface RoomPageProps {
  code: string
  uid: string
  nickname: string
}

const AI_TURN_DELAY_MS = 1000
const CLAIM_RETRY_MS = 5000

type JoinState = { status: 'joining' } | { status: 'joined' } | { status: 'failed'; message: string }

export function RoomPage({ code, uid, nickname }: RoomPageProps) {
  const [join, setJoin] = useState<JoinState>({ status: 'joining' })
  const [room, setRoom] = useState<Room | null | undefined>(undefined)
  const [presence, setPresence] = useState<PresenceMap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const now = useNow(HEARTBEAT_MS / 3)

  const joined = join.status === 'joined'
  const kicked = room?.kickedUids.includes(uid) ?? false

  useEffect(() => {
    let cancelled = false
    setJoin({ status: 'joining' })
    rooms
      .joinRoom(code, { uid, name: nickname })
      .then(() => !cancelled && setJoin({ status: 'joined' }))
      .catch((e: unknown) => !cancelled && setJoin({ status: 'failed', message: describeError(e) }))
    return () => {
      cancelled = true
    }
  }, [code, uid, nickname])

  useEffect(() => {
    if (!joined) return
    return rooms.subscribeRoom(code, setRoom, (e) => setError(describeError(e)))
  }, [joined, code])

  useEffect(() => {
    if (!joined || kicked) return
    const stopHeartbeat = startHeartbeat(db, code, uid, (e) => setError(describeError(e)))
    const stopPresence = subscribePresence(db, code, setPresence, (e) => setError(describeError(e)))
    return () => {
      stopHeartbeat()
      stopPresence()
    }
  }, [joined, kicked, code, uid])

  const offline = (playerUid: string) =>
    presence !== null && playerUid !== uid && !isAiUid(playerUid) && isOffline(presence[playerUid], now)

  // 本機時鐘與伺服器可能有差，被規則拒絕時持續重試，直到成功或條件消失
  const shouldClaimHost = !!room && !kicked && hostToClaim(room, uid, offline)
  useEffect(() => {
    if (!shouldClaimHost) return
    const claim = () =>
      rooms.claimHost(code, uid).catch((e: unknown) => {
        if (!(e instanceof RoomError && e.code === 'CANNOT_CLAIM_HOST')) setError(describeError(e))
      })
    void claim()
    const timer = setInterval(claim, CLAIM_RETRY_MS)
    return () => clearInterval(timer)
  }, [shouldClaimHost, code, uid])

  const aiSeat = aiTurnToPlay(room ?? null, uid)
  const roomVersion = room?.version
  useEffect(() => {
    if (!aiSeat || roomVersion === undefined) return
    const timer = setTimeout(() => {
      rooms.playAiTurn(code, uid, roomVersion).catch((e: unknown) => setError(describeError(e)))
    }, AI_TURN_DELAY_MS)
    return () => clearTimeout(timer)
  }, [aiSeat, roomVersion, code, uid])

  async function run(task: () => Promise<void>) {
    setError(null)
    try {
      await task()
    } catch (e) {
      setError(describeError(e))
    }
  }

  async function leave() {
    await run(async () => {
      await rooms.leaveRoom(code, uid)
      navigate({ name: 'home' })
    })
  }

  let body
  if (join.status === 'failed') body = <Notice text={join.message} />
  else if (!joined || room === undefined) body = <p className="text-center text-ink-muted">連線中…</p>
  else if (room === null) body = <Notice text="這個房間已不存在" />
  else if (kicked) body = <Notice text="你已被房主移出這個房間" testId="kicked-notice" />
  else if (room.status === 'lobby')
    body = (
      <LobbyView
        room={room}
        uid={uid}
        isOffline={offline}
        onStart={() => run(() => rooms.startGame(code, uid))}
        onAddAi={() => run(() => rooms.addAi(code, uid))}
        onRemoveAi={(aiUid) => run(() => rooms.removeAi(code, uid, aiUid))}
        onLeave={leave}
      />
    )
  else if (room.game) body = <GameView room={room} game={room.game} uid={uid} isOffline={offline} run={run} onLeave={leave} />
  else body = <Notice text="找不到對局資料" />

  return (
    <main className={`mx-auto flex min-h-screen flex-col gap-4 px-4 pb-8 pt-14 ${room?.status === 'lobby' || !room ? 'max-w-2xl' : 'max-w-4xl'}`}>
      {body}
      <ErrorBanner message={kicked ? null : error} onDismiss={() => setError(null)} />
    </main>
  )
}

function Notice({ text, testId }: { text: string; testId?: string }) {
  return (
    <section data-testid={testId ?? 'room-notice'} className="space-y-4 rounded-2xl bg-surface p-6 text-center shadow-sm">
      <p className="text-lg text-ink">{text}</p>
      <button type="button" onClick={() => navigate({ name: 'home' })} className="rounded-lg bg-accent px-5 py-2 font-semibold text-on-accent hover:brightness-110">
        回首頁
      </button>
    </section>
  )
}
