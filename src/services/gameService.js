// Game service - handles Firebase/Backend interactions
import {
  getRoomRef,
  getPlayersRef,
  getGameStateRef,
  setRoomData,
  updateRoomData,
  addPlayerToRoom,
  updateGameState,
  listenToRoom,
  listenToPlayers,
  listenToGameState,
} from '../config/firebaseDb';

// Create a new room
export async function createRoom(playerName, playerId) {
  console.log('[gameService] ========== createRoom called ==========');
  console.log('  playerName:', playerName);
  console.log('  playerId:', playerId);

  try {
    const roomCode = generateRoomCode();
    console.log('[gameService] Generated room code:', roomCode);

    // Create room document in Firebase
    const roomData = {
      roomCode,
      createdBy: playerId,
      createdAt: new Date().toISOString(),
      status: 'waiting',
      gameState: {
        status: 'waiting',
        started: false,
      },
    };

    console.log('[gameService] Attempting to set room data to Firebase...');
    console.log('[gameService] Room data:', roomData);

    await setRoomData(roomCode, roomData);
    console.log('[gameService] ✓ Room document created');

    // Add creator as player in subcollection
    console.log('[gameService] Adding creator as player to subcollection...');
    const playerData = {
      id: playerId,
      name: playerName,
      joinedAt: new Date().toISOString(),
      status: 'ready',
    };

    await addPlayerToRoom(roomCode, playerId, playerData);
    console.log('[gameService] ✓ Creator added to players subcollection');
    
    console.log('[gameService] ✓ Room created successfully in Firebase');
    console.log('[gameService] Room code:', roomCode);

    return {
      roomCode,
      createdBy: playerId,
      players: [{ id: playerId, name: playerName }],
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[gameService] ✗ Error creating room:', error);
    console.error('[gameService] Error message:', error.message);
    console.error('[gameService] Error code:', error.code);
    throw error;
  }
}

// Join an existing room
export async function joinRoom(roomCode, playerName, playerId) {
  console.log('[gameService] ========== joinRoom called ==========');
  console.log('  roomCode:', roomCode);
  console.log('  playerName:', playerName);
  console.log('  playerId:', playerId);

  try {
    console.log('[gameService] Attempting to join room in Firebase...');

    // Add player to room in Firebase
    const playerData = {
      id: playerId,
      name: playerName,
      joinedAt: new Date().toISOString(),
      status: 'ready',
    };

    console.log('[gameService] Player data:', playerData);
    await addPlayerToRoom(roomCode, playerId, playerData);
    
    console.log('[gameService] ✓ Joined room successfully in Firebase');

    return {
      roomCode,
      players: [{ id: playerId, name: playerName }],
      joinedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[gameService] ✗ Error joining room:', error);
    console.error('[gameService] Error message:', error.message);
    console.error('[gameService] Error code:', error.code);
    throw error;
  }
}

// Start a new game
export async function startGame(roomCode, gameData) {
  console.log('[gameService] ========== startGame called ==========');
  console.log('  roomCode:', roomCode);
  console.log('  gameData:', gameData);

  try {
    console.log('[gameService] Updating game state in Firebase...');

    // Update game state in Firebase
    const gameState = {
      status: 'playing',
      started: true,
      startedAt: new Date().toISOString(),
      currentRound: 1,
      ...gameData,
    };

    await updateGameState(roomCode, gameState);
    
    console.log('[gameService] ✓ Game started successfully');

    return {
      success: true,
      roomCode,
      startedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[gameService] ✗ Error starting game:', error);
    console.error('[gameService] Error message:', error.message);
    throw error;
  }
}

// Play a card
export async function playCard(roomCode, playerId, card) {
  console.log('[gameService] playCard called:', { roomCode, playerId, card });

  try {
    const timestamp = new Date().toISOString();
    const moveData = {
      type: 'playCard',
      playerId,
      card,
      timestamp,
    };

    const gameStateUpdate = {
      lastMove: moveData,
      [`moves/${timestamp}`]: moveData,
    };

    await updateGameState(roomCode, gameStateUpdate);
    console.log('[gameService] ✓ Card played successfully');

    return {
      success: true,
      card,
      playerId,
    };
  } catch (error) {
    console.error('[gameService] ✗ Error playing card:', error);
    throw error;
  }
}

// Draw a card
export async function drawCard(roomCode, playerId) {
  console.log('[gameService] drawCard called:', { roomCode, playerId });

  try {
    const timestamp = new Date().toISOString();
    const moveData = {
      type: 'drawCard',
      playerId,
      timestamp,
    };

    const gameStateUpdate = {
      lastMove: moveData,
      [`moves/${timestamp}`]: moveData,
    };

    await updateGameState(roomCode, gameStateUpdate);

    const drawnCard = { value: '5', suit: 'red' };
    console.log('[gameService] ✓ Card drawn successfully:', drawnCard);

    return {
      success: true,
      card: drawnCard,
      playerId,
    };
  } catch (error) {
    console.error('[gameService] ✗ Error drawing card:', error);
    throw error;
  }
}

// End turn
export async function endTurn(roomCode, playerId) {
  console.log('[gameService] endTurn called:', { roomCode, playerId });

  try {
    const timestamp = new Date().toISOString();
    const moveData = {
      type: 'endTurn',
      playerId,
      timestamp,
    };

    const gameStateUpdate = {
      lastMove: moveData,
      [`moves/${timestamp}`]: moveData,
    };

    await updateGameState(roomCode, gameStateUpdate);
    console.log('[gameService] ✓ Turn ended successfully');

    return {
      success: true,
      nextPlayerTurn: true,
    };
  } catch (error) {
    console.error('[gameService] ✗ Error ending turn:', error);
    throw error;
  }
}

// End game
export async function endGame(roomCode, finalData) {
  console.log('[gameService] endGame called:', { roomCode, finalData });

  try {
    const gameStateUpdate = {
      status: 'finished',
      started: false,
      endedAt: new Date().toISOString(),
      finalData,
    };

    await updateGameState(roomCode, gameStateUpdate);
    console.log('[gameService] ✓ Game ended successfully');

    return {
      success: true,
      roomCode,
      endedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[gameService] ✗ Error ending game:', error);
    throw error;
  }
}

// Subscribe to room updates
export function subscribeToRoom(roomCode, callback) {
  console.log('[gameService] ========== subscribeToRoom ==========');
  console.log('  roomCode:', roomCode);
  console.log('[gameService] Setting up real-time listener...');
  
  try {
    const unsubscribe = listenToRoom(roomCode, (data) => {
      console.log('[gameService] 📨 Room data received:', data);
      callback(data);
    });
    
    console.log('[gameService] ✓ Listener set up successfully');
    return unsubscribe;
  } catch (error) {
    console.error('[gameService] ✗ Error setting up room listener:', error);
    throw error;
  }
}

// Subscribe to players updates
export function subscribeToPlayers(roomCode, callback) {
  console.log('[gameService] ========== subscribeToPlayers ==========');
  console.log('  roomCode:', roomCode);
  console.log('[gameService] Setting up real-time listener...');
  
  try {
    const unsubscribe = listenToPlayers(roomCode, (data) => {
      console.log('[gameService] 👥 Players data received:', data);
      callback(data);
    });
    
    console.log('[gameService] ✓ Listener set up successfully');
    return unsubscribe;
  } catch (error) {
    console.error('[gameService] ✗ Error setting up players listener:', error);
    throw error;
  }
}

// Subscribe to game state updates
export function subscribeToGameState(roomCode, callback) {
  console.log('[gameService] ========== subscribeToGameState ==========');
  console.log('  roomCode:', roomCode);
  console.log('[gameService] Setting up real-time listener...');
  
  try {
    const unsubscribe = listenToGameState(roomCode, (data) => {
      console.log('[gameService] 🎮 Game state data received:', data);
      callback(data);
    });
    
    console.log('[gameService] ✓ Listener set up successfully');
    return unsubscribe;
  } catch (error) {
    console.error('[gameService] ✗ Error setting up game state listener:', error);
    throw error;
  }
}

// Sync complete game state to Firebase
// 同步完整的遊戲狀態到 Firebase
export async function syncCompleteGameState(roomCode, gameState) {
  console.log('[gameService] ========== syncCompleteGameState ==========');
  console.log('  roomCode:', roomCode);
  console.log('  gameState keys:', Object.keys(gameState));
  
  try {
    console.log('[gameService] Syncing complete game state to Firebase...');

    // Create a clean copy to sync (remove nested arrays for Firebase compatibility)
    const cleanState = {
      ...gameState,
      lastSyncedAt: new Date().toISOString(),
    };

    // Clean up nested arrays in players (Firebase doesn't support nested arrays)
    if (cleanState.players) {
      cleanState.players = cleanState.players.map(player => ({
        ...player,
        // Convert playedPairs from array of arrays to serialized format
        playedPairs: player.playedPairs ?
          player.playedPairs.map((pair, idx) => ({
            [`pair_${idx}_card1`]: pair[0],
            [`pair_${idx}_card2`]: pair[1]
          })) : []
      }));
    }

    await updateGameState(roomCode, cleanState);
    console.log('[gameService] ✓ Game state synced successfully');

    return { success: true };
  } catch (error) {
    console.error('[gameService] ✗ Error syncing game state:', error);
    console.error('[gameService] Error message:', error.message);
    throw error;
  }
}

// Helper function to generate 6-character room code
function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let roomCode = '';
  for (let i = 0; i < 6; i++) {
    roomCode += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  console.log('[gameService] Generated room code:', roomCode);
  return roomCode;
}
