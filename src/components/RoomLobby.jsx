import React, { useState, useEffect } from 'react';
import '../styles/RoomLobby.css';
import {
  subscribeToPlayers,
  subscribeToGameState,
  createRoom,
  joinRoom,
} from '../services/gameService';

export default function RoomLobby({
  playerName,
  playerId,
  roomCode,
  isCreator,
  onGameStart,
  onBack,
}) {
  const [players, setPlayers] = useState([
    { id: playerId, name: playerName, status: 'ready' },
  ]);
  const [generatedRoomCode, setGeneratedRoomCode] = useState(roomCode);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Generate room code and create room if creating
  useEffect(() => {
    if (isCreator && !generatedRoomCode) {
      // Generate 6-character random code (letters + numbers)
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let newCode = '';
      for (let i = 0; i < 6; i++) {
        newCode += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      setGeneratedRoomCode(newCode);

      // Create room in Firebase
      createRoom(playerName, playerId)
        .then((result) => {
          console.log('[RoomLobby] Room created successfully:', result);
          setGeneratedRoomCode(result.roomCode);
        })
        .catch((err) => {
          console.error('[RoomLobby] Error creating room:', err);
          setError('Failed to create room');
        });
    } else if (!isCreator && roomCode) {
      // Join room in Firebase
      joinRoom(roomCode, playerName, playerId)
        .then((result) => {
          console.log('[RoomLobby] Joined room successfully:', result);
        })
        .catch((err) => {
          console.error('[RoomLobby] Error joining room:', err);
          setError('Failed to join room');
        });
    }
  }, []);

  // Subscribe to players updates
  useEffect(() => {
    if (!generatedRoomCode) return;

    console.log('[RoomLobby] Subscribing to players in room:', generatedRoomCode);
    const unsubscribe = subscribeToPlayers(generatedRoomCode, (playersData) => {
      console.log('[RoomLobby] Players updated:', playersData);
      if (playersData) {
        const playersList = Object.values(playersData);
        setPlayers(playersList);
      }
    });

    return () => {
      console.log('[RoomLobby] Unsubscribing from players');
      unsubscribe();
    };
  }, [generatedRoomCode]);

  // Subscribe to game state updates
  useEffect(() => {
    if (!generatedRoomCode) return;

    console.log('[RoomLobby] Subscribing to game state in room:', generatedRoomCode);
    const unsubscribe = subscribeToGameState(generatedRoomCode, (gameState) => {
      console.log('[RoomLobby] Game state updated:', gameState);
      // If game has started, call onGameStart
      if (gameState?.started) {
        console.log('[RoomLobby] Game started! Transitioning to game board...');
        onGameStart(generatedRoomCode, { players });
      }
    });

    return () => {
      console.log('[RoomLobby] Unsubscribing from game state');
      unsubscribe();
    };
  }, [generatedRoomCode, players, onGameStart]);

  // Handle game start
  const handleStartGame = async () => {
    if (players.length < 2) {
      alert('Need at least 2 players to start');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[RoomLobby] Starting game with players:', players);
      await onGameStart(generatedRoomCode, { players });
    } catch (error) {
      console.error('[RoomLobby] Error starting game:', error);
      setError('Failed to start game');
      alert('Failed to start game');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="room-lobby">
      <div className="lobby-header">
        <h1>{isCreator ? 'Create Room' : 'Join Room'}</h1>
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️ {error}</span>
        </div>
      )}

      <div className="room-code-section">
        <h2>Room Code</h2>
        <div className="room-code-display">{generatedRoomCode || 'Loading...'}</div>
        <button
          className="copy-btn"
          onClick={() => navigator.clipboard.writeText(generatedRoomCode)}
          disabled={!generatedRoomCode}
        >
          Copy Code
        </button>
      </div>

      <div className="players-section">
        <h2>Players ({players.length})</h2>
        <div className="players-list">
          {players.map((player) => (
            <div key={player.id} className="player-item">
              <span className="player-name">{player.name}</span>
              <span className={`player-status ${player.status}`}>
                {player.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {isCreator && (
        <button
          className="start-btn"
          onClick={handleStartGame}
          disabled={isLoading || players.length < 2}
        >
          {isLoading ? 'Starting...' : 'Start Game'}
        </button>
      )}

      {!isCreator && (
        <div className="waiting-message">
          Waiting for room creator to start the game...
        </div>
      )}
    </div>
  );
}
