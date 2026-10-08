import { useState } from 'react'
import { useAuthUser, useHashRoute } from './app/hooks'
import { HomePage } from './features/home/HomePage'
import { RoomPage } from './features/room/RoomPage'
import { isValidNickname, loadNickname } from './lib/nickname'

export default function App() {
  const auth = useAuthUser()
  const route = useHashRoute()
  const [nickname, setNickname] = useState(loadNickname)

  if (auth.status === 'loading') {
    return <p className="flex min-h-screen items-center justify-center text-sky-700">登入中…</p>
  }
  if (auth.status === 'error') {
    return (
      <p role="alert" className="flex min-h-screen items-center justify-center px-4 text-center text-rose-700">
        無法登入：{auth.message}
      </p>
    )
  }

  const uid = auth.user.uid
  if (route.name === 'room' && isValidNickname(nickname)) {
    return <RoomPage key={route.code} code={route.code} uid={uid} nickname={nickname} />
  }
  return <HomePage uid={uid} initialCode={route.name === 'room' ? route.code : ''} onEnter={setNickname} />
}
