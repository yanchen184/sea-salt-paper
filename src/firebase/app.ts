import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { AUTH_EMULATOR_URL, EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR } from './emulator'
import { createRoomRepository } from './rooms'

const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'

function readConfig(): FirebaseOptions {
  if (useEmulator) return { projectId: EMULATOR_PROJECT_ID, apiKey: 'demo-api-key' }
  const env = import.meta.env
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  }
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key)
  if (missing.length > 0) throw new Error(`Firebase 設定缺少：${missing.join(', ')}（請設定 VITE_FIREBASE_* 環境變數）`)
  return config
}

const app = initializeApp(readConfig())
const auth = getAuth(app)
export const db = getFirestore(app)

if (useEmulator) {
  connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true })
  connectFirestoreEmulator(db, FIRESTORE_EMULATOR.host, FIRESTORE_EMULATOR.port)
}

export const rooms = createRoomRepository(db)

/** 監聽登入狀態；尚未登入時自動匿名登入 */
export function watchUser(onUser: (user: User) => void, onError: (error: Error) => void): () => void {
  return onAuthStateChanged(
    auth,
    (user) => {
      if (user) onUser(user)
      else signInAnonymously(auth).catch(onError)
    },
    onError,
  )
}
