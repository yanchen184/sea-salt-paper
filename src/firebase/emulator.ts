import firebaseJson from '../../firebase.json' with { type: 'json' }

export const EMULATOR_PROJECT_ID = 'demo-sea-salt'
export const AUTH_EMULATOR_URL = `http://${firebaseJson.emulators.auth.host}:${firebaseJson.emulators.auth.port}`
export const FIRESTORE_EMULATOR = firebaseJson.emulators.firestore
