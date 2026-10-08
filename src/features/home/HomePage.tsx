import { useState, type FormEvent } from 'react'
import { describeError, navigate } from '../../app/hooks'
import { ErrorBanner } from '../../app/ErrorBanner'
import { rooms } from '../../firebase/app'
import { isValidNickname, loadNickname, NICKNAME_MAX, normalizeNickname, saveNickname } from '../../lib/nickname'
import { isRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from '../../lib/roomCode'

interface HomePageProps {
  uid: string
  initialCode?: string
  /** 建立或加入成功、即將進入房間時呼叫 */
  onEnter: (name: string) => void
}

export function HomePage({ uid, initialCode = '', onEnter }: HomePageProps) {
  const [nickname, setNickname] = useState(loadNickname)
  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = normalizeNickname(nickname)
  const nameOk = isValidNickname(name)
  const roomCode = normalizeRoomCode(code)

  function changeNickname(value: string) {
    setNickname(value)
    const normalized = normalizeNickname(value)
    if (isValidNickname(normalized)) saveNickname(normalized)
  }

  async function run(task: () => Promise<string>) {
    setBusy(true)
    setError(null)
    try {
      const roomCode = await task()
      onEnter(name)
      navigate({ name: 'room', code: roomCode })
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  function create() {
    void run(() => rooms.createRoom({ uid, name }))
  }

  function join(event: FormEvent) {
    event.preventDefault()
    if (!isRoomCode(roomCode)) {
      setError(`房號是 ${ROOM_CODE_LENGTH} 碼英數字`)
      return
    }
    void run(async () => {
      await rooms.joinRoom(roomCode, { uid, name })
      return roomCode
    })
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-4xl font-bold text-sky-900">海鹽與紙</h1>
        <p className="mt-2 text-sm text-sky-700">Sea Salt &amp; Paper · 線上 2–4 人</p>
      </header>

      <section className="space-y-2 rounded-2xl bg-white p-5 shadow-sm">
        <label htmlFor="nickname" className="block text-sm font-medium text-slate-700">
          暱稱（1–{NICKNAME_MAX} 字）
        </label>
        <input
          id="nickname"
          data-testid="nickname"
          value={nickname}
          onChange={(e) => changeNickname(e.target.value)}
          maxLength={NICKNAME_MAX * 2}
          autoComplete="nickname"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          placeholder="輸入你的暱稱"
        />
        {!nameOk && nickname.length > 0 && <p className="text-xs text-rose-600">暱稱需為 1–{NICKNAME_MAX} 字</p>}
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <button
          type="button"
          data-testid="create-room"
          onClick={create}
          disabled={!nameOk || busy}
          className="w-full rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          建立房間
        </button>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />或<span className="h-px flex-1 bg-slate-200" />
        </div>
        <form onSubmit={join} className="flex gap-2">
          <input
            data-testid="room-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={ROOM_CODE_LENGTH}
            aria-label="房號"
            placeholder="房號"
            className="w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg uppercase tracking-widest focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
          <button
            type="submit"
            data-testid="join-room"
            disabled={!nameOk || busy || code.trim().length === 0}
            className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            加入
          </button>
        </form>
      </section>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
    </main>
  )
}
