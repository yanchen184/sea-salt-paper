import { readFileSync } from 'node:fs'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously, updateCurrentUser, type User } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { AUTH_EMULATOR_URL, EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR } from '../../src/firebase/emulator'
import { createRoomRepository, type RoomRepository } from '../../src/firebase/rooms'

export interface TestClient {
  uid: string
  user: User
  db: Firestore
  rooms: RoomRepository
}

const apps: FirebaseApp[] = []
let appCount = 0

async function connect(signIn: (app: FirebaseApp) => Promise<User>): Promise<TestClient> {
  const app = initializeApp({ projectId: EMULATOR_PROJECT_ID, apiKey: 'demo-api-key' }, `client-${++appCount}`)
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, FIRESTORE_EMULATOR.host, FIRESTORE_EMULATOR.port)
  const user = await signIn(app)
  return { uid: user.uid, user, db, rooms: createRoomRepository(db) }
}

/** 新的匿名使用者 */
export function newClient(): Promise<TestClient> {
  return connect(async (app) => (await signInAnonymously(getAuth(app))).user)
}

/** 同一個使用者的另一個 client（例如同一人開了第二個分頁） */
export function sameUserClient(other: TestClient): Promise<TestClient> {
  return connect(async (app) => {
    await updateCurrentUser(getAuth(app), other.user)
    const user = getAuth(app).currentUser
    if (!user) throw new Error('updateCurrentUser 沒有設定使用者')
    return user
  })
}

export async function closeClients(): Promise<void> {
  await Promise.all(apps.splice(0).map((app) => deleteApp(app)))
}

export function rulesEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: {
      host: FIRESTORE_EMULATOR.host,
      port: FIRESTORE_EMULATOR.port,
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  })
}
