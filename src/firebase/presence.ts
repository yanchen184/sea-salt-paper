import { collection, doc, onSnapshot, serverTimestamp, setDoc, type Firestore, type Timestamp } from 'firebase/firestore'
import { HEARTBEAT_MS } from '../lib/presence'

/** uid → 最後心跳時間（毫秒） */
export type PresenceMap = Record<string, number>

export function startHeartbeat(db: Firestore, code: string, uid: string, onError: (error: Error) => void): () => void {
  const ref = doc(db, 'rooms', code, 'presence', uid)
  const beat = () => {
    setDoc(ref, { lastSeen: serverTimestamp() }).catch(onError)
  }
  beat()
  const timer = setInterval(beat, HEARTBEAT_MS)
  return () => clearInterval(timer)
}

export function subscribePresence(
  db: Firestore,
  code: string,
  onPresence: (presence: PresenceMap) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, 'rooms', code, 'presence'),
    (snap) => {
      const presence: PresenceMap = {}
      for (const d of snap.docs) {
        const lastSeen = d.get('lastSeen', { serverTimestamps: 'estimate' }) as Timestamp | null
        if (lastSeen) presence[d.id] = lastSeen.toMillis()
      }
      onPresence(presence)
    },
    onError,
  )
}
