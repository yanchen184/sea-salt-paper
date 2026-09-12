import React, { useState, useEffect } from 'react';
import '../styles/RoomLobby.css';
import {
  subscribeToPlayers,
  subscribeToGameState,
  createRoom,
  joinRoom,
} from '../services/gameService';
import RoomSettings from './RoomSettings.jsx';
import { createAIPlayer, AI_DIFFICULTY } from '../services/aiService.js';

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
  const [generatedRoomCode, setGeneratedRoomCode] = useState(roomCode || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [roomSettings, setRoomSettings] = useState({
    targetScore: 'auto',
    customTargetScore: 40,
    startingHandSize: 0,
    enableAI: false,
    aiDifficulty: AI_DIFFICULTY.MEDIUM,
    aiPlayerCount: 1,
    enableMermaidWin: true,
    enableColorBonus: true,
    maxPlayers: 4,
    allowSpectators: false,
  });

  // Generate room code and create room if creating
  useEffect(() => {
    if (isCreator && !generatedRoomCode) {
      // Create room in Firebase first, it will generate the code
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
      // For joining, room code is already set in initial state
      // Just join the room in Firebase
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
      // If game has started, call onGameStart with skipInit flag for non-host players
      if (gameState?.started) {
        console.log('[RoomLobby] Game started! Transitioning to game board...');
        // Pass skipInit: true for non-host players (they should NOT re-initialize)
        onGameStart(generatedRoomCode, { players, skipInit: true });
      }
    });

    return () => {
      console.log('[RoomLobby] Unsubscribing from game state');
      unsubscribe();
    };
  }, [generatedRoomCode, players, onGameStart]);

  // Handle adding AI players
  const handleAddAI = () => {
    if (players.length >= roomSettings.maxPlayers) {
      alert(`房間已滿 (最多 ${roomSettings.maxPlayers} 人)`);
      return;
    }

    const aiNames = ['小智', '小明', '小紅', '小藍', '小綠', '小黃'];
    const aiCount = players.filter(p => p.isAI).length;
    const aiName = aiNames[aiCount % aiNames.length];

    const aiPlayer = createAIPlayer(aiName, roomSettings.aiDifficulty);
    setPlayers(prev => [...prev, aiPlayer]);
    console.log('[RoomLobby] Added AI player:', aiPlayer);
  };

  // Handle removing player (for AI players)
  const handleRemovePlayer = (playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player?.isAI) {
      alert('只能移除 AI 玩家');
      return;
    }

    setPlayers(prev => prev.filter(p => p.id !== playerId));
    console.log('[RoomLobby] Removed player:', playerId);
  };

  // Handle applying room settings
  const handleApplySettings = (newSettings) => {
    setRoomSettings(newSettings);
    setShowSettings(false);
    console.log('[RoomLobby] Applied settings:', newSettings);

    // Auto-add AI players if enabled
    if (newSettings.enableAI && newSettings.aiPlayerCount > 0) {
      const currentAICount = players.filter(p => p.isAI).length;
      const neededAI = newSettings.aiPlayerCount - currentAICount;

      if (neededAI > 0) {
        const aiNames = ['小智', '小明', '小紅', '小藍', '小綠', '小黃'];
        const newAIPlayers = [];

        for (let i = 0; i < neededAI; i++) {
          if (players.length + newAIPlayers.length >= newSettings.maxPlayers) break;

          const aiName = aiNames[(currentAICount + i) % aiNames.length];
          const aiPlayer = createAIPlayer(aiName, newSettings.aiDifficulty);
          newAIPlayers.push(aiPlayer);
        }

        if (newAIPlayers.length > 0) {
          setPlayers(prev => [...prev, ...newAIPlayers]);
          console.log('[RoomLobby] Auto-added AI players:', newAIPlayers);
        }
      }
    }
  };

  // Handle game start
  const handleStartGame = async () => {
    if (players.length < 2) {
      alert('至少需要 2 名玩家才能開始遊戲');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[RoomLobby] Starting game with players:', players);
      console.log('[RoomLobby] Room settings:', roomSettings);
      await onGameStart(generatedRoomCode, { players, settings: roomSettings });
    } catch (error) {
      console.error('[RoomLobby] Error starting game:', error);
      setError('Failed to start game');
      alert('開始遊戲失敗');
    } finally {
      setIsLoading(false);
    }
  };

  console.log('[RoomLobby] Rendering with:', {
    generatedRoomCode,
    players,
    isCreator,
    playerName,
    playerId,
    error,
  });

  // Add visual debugging
  if (!playerName || !playerId) {
    return (
      <div style={{ color: 'white', fontSize: '32px', padding: '50px' }}>
        ERROR: Missing playerName or playerId!
        <br />
        playerName: {playerName}
        <br />
        playerId: {playerId}
      </div>
    );
  }

  return (
    <div className="room-lobby" style={{ minHeight: '100vh', color: 'white' }}>
      <div className="lobby-header">
        <h1>{isCreator ? '創建房間' : '加入房間'}</h1>
        <button className="back-btn" onClick={onBack}>
          ← 返回
        </button>
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️ {error}</span>
        </div>
      )}

      <div className="room-code-section">
        <h2>房間碼</h2>
        <div className="room-code-display">{generatedRoomCode || '載入中...'}</div>
        <button
          className="copy-btn"
          onClick={() => navigator.clipboard.writeText(generatedRoomCode)}
          disabled={!generatedRoomCode}
        >
          📋 複製房間碼
        </button>
      </div>

      <div className="players-section">
        <div className="section-header">
          <h2>玩家 ({players.length}/{roomSettings.maxPlayers})</h2>
          {isCreator && (
            <div className="section-actions">
              <button
                className="add-ai-btn"
                onClick={handleAddAI}
                disabled={players.length >= roomSettings.maxPlayers}
                title="添加 AI 玩家"
              >
                🤖 添加 AI
              </button>
              <button
                className="settings-btn"
                onClick={() => setShowSettings(true)}
                title="房間設置"
              >
                ⚙️ 設置
              </button>
            </div>
          )}
        </div>

        <div className="players-list">
          {players.map((player) => (
            <div key={player.id} className={`player-item ${player.isAI ? 'ai-player' : ''}`}>
              <span className="player-name">
                {player.name}
                {player.isAI && <span className="ai-badge">AI</span>}
                {player.id === playerId && <span className="you-badge">你</span>}
              </span>
              <div className="player-actions">
                <span className={`player-status ${player.status || 'ready'}`}>
                  {player.status || 'ready'}
                </span>
                {isCreator && player.isAI && (
                  <button
                    className="remove-btn"
                    onClick={() => handleRemovePlayer(player.id)}
                    title="移除玩家"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {roomSettings.targetScore !== 'auto' && (
          <div className="room-info">
            <p>🎯 目標分數: {roomSettings.targetScore === 'custom' ? roomSettings.customTargetScore : roomSettings.targetScore} 分</p>
          </div>
        )}
      </div>

      {isCreator && (
        <button
          className="start-btn"
          onClick={handleStartGame}
          disabled={isLoading || players.length < 2}
        >
          {isLoading ? '開始中...' : '🎮 開始遊戲'}
        </button>
      )}

      {!isCreator && (
        <div className="waiting-message">
          等待房主開始遊戲...
        </div>
      )}

      {/* Room Settings Modal */}
      {showSettings && (
        <RoomSettings
          currentSettings={roomSettings}
          onApplySettings={handleApplySettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
