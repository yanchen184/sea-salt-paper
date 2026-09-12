import React, { useState, useEffect } from 'react';
import './HomePage.css';
import GameHistory from './GameHistory.jsx';
import Leaderboard from './Leaderboard.jsx';

// Home page - main entry point for the game
export default function HomePage({ onNavigate }) {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showGameHistory, setShowGameHistory] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [playerId, setPlayerId] = useState(null);

  // Generate random player name and ID on component mount
  useEffect(() => {
    const randomName = generateRandomPlayerName();
    const id = generatePlayerId();
    setPlayerName(randomName);
    setPlayerId(id);
    console.log('[HomePage] Generated random player name:', randomName);
    console.log('[HomePage] Generated player ID:', id);
  }, []);

  // Validate player name
  const validatePlayerName = (name) => {
    return name.trim().length >= 2 && name.trim().length <= 20;
  };

  // Validate room code format
  const validateRoomCode = (code) => {
    return /^[A-Z0-9]{6}$/.test(code.toUpperCase());
  };

  // Handle create new room
  const handleCreateRoom = async () => {
    setError('');
    
    if (!validatePlayerName(playerName)) {
      setError('Player name must be 2-20 characters');
      return;
    }

    setIsLoading(true);
    try {
      onNavigate('create-room', {
        playerName: playerName.trim(),
        playerId: generatePlayerId(),
      });
    } catch (err) {
      setError('Failed to create room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle join existing room
  const handleJoinRoom = async () => {
    setError('');
    
    if (!validatePlayerName(playerName)) {
      setError('Player name must be 2-20 characters');
      return;
    }

    if (!validateRoomCode(roomCode)) {
      setError('Room code must be 6 characters (letters and numbers)');
      return;
    }

    setIsLoading(true);
    try {
      onNavigate('join-room', {
        playerName: playerName.trim(),
        roomCode: roomCode.toUpperCase(),
        playerId: generatePlayerId(),
      });
    } catch (err) {
      setError('Failed to join room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle enter key press
  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter' && !isLoading) {
      action();
    }
  };

  // Generate new random name
  const handleGenerateNewName = () => {
    const newName = generateRandomPlayerName();
    setPlayerName(newName);
    console.log('[HomePage] Generated new random player name:', newName);
  };

  return (
    <div className="home-page">
      <div className="home-container">
        {/* Header */}
        <div className="home-header">
          <h1 className="home-title">🎮 Sea Salt & Paper</h1>
          <p className="home-subtitle">多人即時卡牌遊戲</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="home-error">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Main content */}
        <div className="home-content">
          {/* Player name input */}
          <div className="form-section">
            <div className="form-label-with-button">
              <label className="form-label">你的名字</label>
              <button
                className="refresh-btn"
                onClick={handleGenerateNewName}
                title="Generate random name"
                disabled={isLoading}
              >
                🔄
              </button>
            </div>
            <input
              type="text"
              className="form-input"
              placeholder="輸入 2-20 個字符"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, handleCreateRoom)}
              maxLength="20"
              disabled={isLoading}
            />
          </div>

          {/* Divider */}
          <div className="form-divider">
            <span>或</span>
          </div>

          {/* Room code input for joining */}
          <div className="form-section">
            <label className="form-label">房間碼 (選填)</label>
            <input
              type="text"
              className="form-input"
              placeholder="輸入 6 個字符的房間碼"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => handleKeyPress(e, handleJoinRoom)}
              maxLength="6"
              disabled={isLoading}
            />
          </div>

          {/* Buttons */}
          <div className="button-group">
            <button
              className="home-button home-button-create"
              onClick={handleCreateRoom}
              disabled={isLoading || !playerName.trim()}
            >
              {isLoading ? '建立中...' : '🏠 建立新房間'}
            </button>

            {roomCode.length === 6 && (
              <button
                className="home-button home-button-join"
                onClick={handleJoinRoom}
                disabled={isLoading || !playerName.trim()}
              >
                {isLoading ? '加入中...' : '✅ 加入房間'}
              </button>
            )}
          </div>
        </div>

        {/* Info section */}
        <div className="home-info">
          <div className="info-item">
            <span className="info-icon">👥</span>
            <span>2-4 人多人對戰</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🔄</span>
            <span>實時同步遊戲狀態</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🎴</span>
            <span>完整遊戲規則</span>
          </div>
        </div>

        {/* Features section */}
        <div className="home-features">
          <h3>遊戲特點</h3>
          <ul>
            <li>⚡ 收集卡組 + 效果連動 + 搶先喊停</li>
            <li>🎯 策略性的競賽遊戲機制</li>
            <li>🌊 精美海洋主題美術風格</li>
            <li>💪 支持多設備實時對戰</li>
          </ul>
        </div>

        {/* Action buttons */}
        <div className="home-actions">
          <button
            className="action-btn history-btn"
            onClick={() => setShowGameHistory(true)}
          >
            📜 遊戲記錄
          </button>
          <button
            className="action-btn leaderboard-btn"
            onClick={() => setShowLeaderboard(true)}
          >
            🏆 排行榜
          </button>
        </div>
      </div>

      {/* Modals */}
      {showGameHistory && (
        <GameHistory
          playerId={playerId}
          onClose={() => setShowGameHistory(false)}
        />
      )}

      {showLeaderboard && (
        <Leaderboard
          playerId={playerId}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
    </div>
  );
}

// Generate random player name
function generateRandomPlayerName() {
  const adjectives = [
    'Swift', 'Brave', 'Clever', 'Bold', 'Keen', 'Sharp', 'Quick', 'Wise',
    'Happy', 'Mighty', 'Noble', 'True', 'Wild', 'Free', 'Calm', 'Pure',
    'Silver', 'Golden', 'Crystal', 'Mystic', 'Echo', 'Storm', 'Moon', 'Star',
  ];

  const nouns = [
    'Tiger', 'Eagle', 'Wolf', 'Phoenix', 'Dragon', 'Shadow', 'Knight',
    'Sage', 'Wanderer', 'Explorer', 'Seeker', 'Rider', 'Warrior',
    'Sailor', 'Hunter', 'Tracker', 'Ranger', 'Scout', 'Archer',
    'Mage', 'Wizard', 'Scholar', 'Mystic', 'Oracle', 'Seer',
  ];

  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${randomAdjective}${randomNoun}`;
}

// Generate unique player ID
function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
