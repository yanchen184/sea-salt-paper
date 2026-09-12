import React, { useState, useEffect } from 'react';
import './GameHistory.css';
import { getRecentGames, getPlayerHistory, getPlayerStats } from '../services/gameHistoryService.js';

export default function GameHistory({ playerId, onClose }) {
  const [view, setView] = useState('recent'); // 'recent' or 'personal'
  const [games, setGames] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadHistory();
  }, [view, playerId]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      if (view === 'recent') {
        const recentGames = await getRecentGames(20);
        setGames(recentGames);
      } else if (view === 'personal' && playerId) {
        const [playerGames, playerStats] = await Promise.all([
          getPlayerHistory(playerId, 20),
          getPlayerStats(playerId),
        ]);
        setGames(playerGames);
        setStats(playerStats);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
      setError('無法載入遊戲記錄');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '未知';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  return (
    <div className="game-history-overlay">
      <div className="game-history-modal">
        <div className="game-history-header">
          <h2>遊戲記錄</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="view-selector">
          <button
            className={`view-btn ${view === 'recent' ? 'active' : ''}`}
            onClick={() => setView('recent')}
          >
            最近遊戲
          </button>
          {playerId && (
            <button
              className={`view-btn ${view === 'personal' ? 'active' : ''}`}
              onClick={() => setView('personal')}
            >
              我的記錄
            </button>
          )}
        </div>

        {view === 'personal' && stats && (
          <div className="player-stats">
            <h3>個人統計</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">總場次</span>
                <span className="stat-value">{stats.totalGames}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">勝率</span>
                <span className="stat-value highlight">{stats.winRate}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">勝場</span>
                <span className="stat-value win">{stats.wins}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">敗場</span>
                <span className="stat-value loss">{stats.losses}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">平均分數</span>
                <span className="stat-value">{stats.averageScore}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">最高分數</span>
                <span className="stat-value highlight">{stats.highestScore}</span>
              </div>
            </div>
          </div>
        )}

        <div className="games-list">
          {loading ? (
            <div className="loading">載入中...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : games.length === 0 ? (
            <div className="empty">尚無遊戲記錄</div>
          ) : (
            games.map((game, index) => (
              <div key={game.id} className="game-entry">
                <div className="game-header">
                  <span className="game-index">#{index + 1}</span>
                  <span className="game-date">{formatDate(game.completedAt)}</span>
                  <span className={`game-mode ${game.winCondition}`}>
                    {game.winCondition === 'mermaids' ? '🧜‍♀️ 美人魚勝利' : '📊 分數勝利'}
                  </span>
                </div>

                <div className="game-info">
                  <div className="winner-info">
                    <span className="winner-label">👑 勝者:</span>
                    <span className="winner-name">{game.winner.name}</span>
                    <span className="winner-score">({game.winner.score}分)</span>
                  </div>

                  <div className="game-meta">
                    <span>{game.playerCount} 人遊戲</span>
                    {game.gameDuration && (
                      <span>• {formatDuration(game.gameDuration)}</span>
                    )}
                    {game.totalRounds && (
                      <span>• {game.totalRounds} 回合</span>
                    )}
                  </div>
                </div>

                <div className="players-list">
                  {game.players.map((player, pIndex) => (
                    <div
                      key={pIndex}
                      className={`player-entry ${player.isWinner ? 'winner' : ''} ${
                        player.id === playerId ? 'current-player' : ''
                      }`}
                    >
                      <span className="player-rank">
                        {player.isWinner ? '👑' : `${pIndex + 1}.`}
                      </span>
                      <span className="player-name">
                        {player.name}
                        {player.id === playerId && ' (你)'}
                      </span>
                      <span className="player-score">{player.finalScore}分</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
