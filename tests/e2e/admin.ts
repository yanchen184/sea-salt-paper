import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import type { GameState } from '../../src/engine'
import { setup, type SetupOptions } from '../../src/engine/test-helpers'
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR } from '../../src/firebase/emulator'
import type { Room } from '../../src/firebase/types'

let env: RulesTestEnvironment | undefined

async function testEnv(): Promise<RulesTestEnvironment> {
  env ??= await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: { host: FIRESTORE_EMULATOR.host, port: FIRESTORE_EMULATOR.port },
  })
  return env
}

export async function readRoom(code: string): Promise<Room> {
  let room: Room | undefined
  await (await testEnv()).withSecurityRulesDisabled(async (ctx) => {
    room = (await getDoc(doc(ctx.firestore(), 'rooms', code))).data() as Room | undefined
  })
  if (!room) throw new Error(`房間 ${code} 不存在`)
  return room
}

/** 依 setup() 佈置牌面，座位換成房間裡真正的玩家 */
export async function placeGame(code: string, opts: SetupOptions & { round?: number; targetScore?: number }): Promise<GameState> {
  const room = await readRoom(code)
  const base = setup({ ...opts, players: room.players.length })
  const game: GameState = {
    ...base,
    round: opts.round ?? base.round,
    targetScore: opts.targetScore ?? base.targetScore,
    players: base.players.map((p, i) => ({ ...p, id: room.players[i]?.uid ?? p.id, name: room.players[i]?.name ?? p.name })),
  }
  await (await testEnv()).withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'rooms', code), { game }))
  return game
}

export async function markOffline(code: string, uid: string): Promise<void> {
  const lastSeen = Timestamp.fromMillis(Date.now() - 10 * 60 * 1000)
  await (await testEnv()).withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'rooms', code, 'presence', uid), { lastSeen }))
}

export async function currentPlayerName(code: string): Promise<string> {
  const game = (await readRoom(code)).game
  if (!game) throw new Error('沒有對局')
  return game.players[game.current]?.name ?? ''
}
