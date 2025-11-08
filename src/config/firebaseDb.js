// Firebase Firestore initialization and database references
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { FIREBASE_CONFIG } from './firebase';

console.log('[firebase.init] Initializing Firebase with Firestore...');

// Initialize Firebase
const firebaseApp = initializeApp(FIREBASE_CONFIG);
console.log('[firebase.init] Firebase app initialized:', firebaseApp.name);

// Get Firestore instance
const db = getFirestore(firebaseApp);
console.log('[firebase.init] Firestore database initialized');

// Helper function to get room document reference
export function getRoomRef(roomCode) {
  console.log('[firebase.db] Getting room reference for:', roomCode);
  return doc(db, 'rooms', roomCode);
}

// Helper function to get players collection reference
export function getPlayersRef(roomCode) {
  console.log('[firebase.db] Getting players collection for room:', roomCode);
  return collection(db, 'rooms', roomCode, 'players');
}

// Helper function to get game state document reference
export function getGameStateRef(roomCode) {
  console.log('[firebase.db] Getting game state reference for room:', roomCode);
  return doc(db, 'rooms', roomCode, 'gameState', 'current');
}

// Listen to room changes
export function listenToRoom(roomCode, callback) {
  console.log('[firebase.listener] Setting up listener for room:', roomCode);
  const roomRef = getRoomRef(roomCode);

  const unsubscribe = onSnapshot(
    roomRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        console.log('[firebase.listener] Room data updated:', roomCode, data);
        callback(data);
      } else {
        console.log('[firebase.listener] Room does not exist yet:', roomCode);
        callback(null);
      }
    },
    (error) => {
      console.error('[firebase.listener] Error listening to room:', error);
    }
  );

  return unsubscribe;
}

// Listen to players in room
export function listenToPlayers(roomCode, callback) {
  console.log('[firebase.listener] Setting up listener for players in room:', roomCode);
  const playersRef = getPlayersRef(roomCode);

  const unsubscribe = onSnapshot(
    playersRef,
    (snapshot) => {
      const players = [];
      snapshot.forEach((doc) => {
        players.push({ id: doc.id, ...doc.data() });
      });
      console.log('[firebase.listener] Players updated for room:', roomCode, players);
      callback(players);
    },
    (error) => {
      console.error('[firebase.listener] Error listening to players:', error);
    }
  );

  return unsubscribe;
}

// Listen to game state
export function listenToGameState(roomCode, callback) {
  console.log('[firebase.listener] Setting up listener for game state in room:', roomCode);
  const gameStateRef = getGameStateRef(roomCode);

  const unsubscribe = onSnapshot(
    gameStateRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        console.log('[firebase.listener] Game state updated for room:', roomCode, data);
        callback(data);
      } else {
        console.log('[firebase.listener] Game state does not exist yet:', roomCode);
        callback(null);
      }
    },
    (error) => {
      console.error('[firebase.listener] Error listening to game state:', error);
    }
  );

  return unsubscribe;
}

// Set room data
export async function setRoomData(roomCode, data) {
  console.log('[firebase.write] Setting room data for:', roomCode);
  console.log('[firebase.write] Data:', data);

  try {
    const roomRef = getRoomRef(roomCode);
    await setDoc(roomRef, data);
    console.log('[firebase.write] ✓ Room data set successfully');
  } catch (error) {
    console.error('[firebase.write] ✗ Error setting room data:', error);
    throw error;
  }
}

// Update room data
export async function updateRoomData(roomCode, data) {
  console.log('[firebase.write] Updating room data for:', roomCode);
  console.log('[firebase.write] Data:', data);

  try {
    const roomRef = getRoomRef(roomCode);
    await updateDoc(roomRef, data);
    console.log('[firebase.write] ✓ Room data updated successfully');
  } catch (error) {
    console.error('[firebase.write] ✗ Error updating room data:', error);
    throw error;
  }
}

// Add player to room
export async function addPlayerToRoom(roomCode, playerId, playerData) {
  console.log('[firebase.write] Adding player to room:', roomCode);
  console.log('[firebase.write] Player ID:', playerId);
  console.log('[firebase.write] Player data:', playerData);

  try {
    const playerRef = doc(db, 'rooms', roomCode, 'players', playerId);
    await setDoc(playerRef, playerData);
    console.log('[firebase.write] ✓ Player added successfully');
  } catch (error) {
    console.error('[firebase.write] ✗ Error adding player:', error);
    throw error;
  }
}

// Update game state
export async function updateGameState(roomCode, gameState) {
  console.log('[firebase.write] Updating game state for room:', roomCode);
  console.log('[firebase.write] Game state:', gameState);

  try {
    const gameStateRef = getGameStateRef(roomCode);
    await setDoc(gameStateRef, gameState, { merge: true });
    console.log('[firebase.write] ✓ Game state updated successfully');
  } catch (error) {
    console.error('[firebase.write] ✗ Error updating game state:', error);
    throw error;
  }
}

export { db };
