import React, { useState, useEffect } from 'react';
import './Leaderboard.css';
import { getLeaderboard } from '../services/gameHistoryService.js';

export default function Leaderboard({ playerId, onClose }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [highlightPlayerId, setHighlightPlayerId] = useState(playerId);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const leaderboard = await getLeaderboard(50);
      setLeaders(leaderboard);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      setError('無法載入排行榜');
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 0:
        return '🥇';
      case 1:
        return '🥈';
      case 2:
        return '🥉';
      default:
        return `${rank + 1}.`;
    }
  };

  const getRankClass = (rank) => {
    if (rank === 0) return 'gold';
    if (rank === 1) return 'silver';
    if (rank === 2) return 'bronze';
    return '';
  };

  return (
    <div className="leaderboard-overlay">
      <div className="leaderboard-modal">
        <div className="leaderboard-header">
          <h2>🏆 排行榜</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="leaderboard-info">
          <p>最少需要 3 場遊戲才能進入排行榜</p>
        </div>

        <div className="leaderboard-content">
          {loading ? (
            <div className="loading">載入中...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : leaders.length === 0 ? (
            <div className="empty">
              <p>尚無排行榜數據</p>
              <p className="hint">開始遊戲來建立排行榜吧！</p>
            </div>
          ) : (
            <div className="leaders-list">
              <div className="leaders-header">
                <span className="col-rank">排名</span>
                <span className="col-name">玩家</span>
                <span className="col-games">場次</span>
                <span className="col-winrate">勝率</span>
                <span className="col-wins">勝場</span>
                <span className="col-avg">平均分</span>
              </div>

              {leaders.map((leader, index) => (
                <div
                  key={leader.id}
                  className={`leader-entry ${getRankClass(index)} ${
                    leader.id === highlightPlayerId ? 'current-player' : ''
                  }`}
                >
                  <span className="col-rank rank-badge">
                    {getRankIcon(index)}
                  </span>
                  <span className="col-name player-name">
                    {leader.name}
                    {leader.id === highlightPlayerId && (
                      <span className="you-badge">你</span>
                    )}
                  </span>
                  <span className="col-games">{leader.gamesPlayed}</span>
                  <span className="col-winrate highlight">
                    {leader.winRate}%
                  </span>
                  <span className="col-wins">{leader.wins}</span>
                  <span className="col-avg">{leader.averageScore}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && !error && leaders.length > 0 && playerId && (
          <div className="player-position">
            {(() => {
              const playerIndex = leaders.findIndex(l => l.id === playerId);
              if (playerIndex === -1) {
                return (
                  <div className="not-ranked">
                    <p>你還未進入排行榜</p>
                    <p className="hint">再玩幾場遊戲來獲得排名吧！</p>
                  </div>
                );
              } else {
                return (
                  <div className="ranked">
                    你目前排名第 <strong>{playerIndex + 1}</strong> 名
                  </div>
                );
              }
            })()}
          </div>
        )}

        <div className="leaderboard-footer">
          <button className="refresh-btn" onClick={loadLeaderboard}>
            🔄 重新整理
          </button>
        </div>
      </div>
    </div>
  );
}
