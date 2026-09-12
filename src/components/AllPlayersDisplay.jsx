// All Players Display - Shows all players' status including played cards
// 所有玩家狀態顯示 - 顯示所有玩家的狀態，包括已出的牌
import React from 'react';
import './AllPlayersDisplay.css';

export default function AllPlayersDisplay({ 
  players, 
  currentPlayerIndex, 
  myPlayerId 
}) {
  console.log('[AllPlayersDisplay] Rendering with:', { players, currentPlayerIndex, myPlayerId });

  if (!players || players.length === 0) {
    return null;
  }

  const getPlayerLabel = (player) => {
    if (player.id === myPlayerId) return '(你)';
    return '';
  };

  const isCurrentTurn = (index) => {
    return index === currentPlayerIndex;
  };

  return (
    <div className="all-players-display">
      <h3 className="players-title">🎮 所有玩家狀態</h3>
      
      <div className="players-grid">
        {players.map((player, index) => (
          <div
            key={player.id || index}
            className={`player-card ${isCurrentTurn(index) ? 'current-turn' : ''} ${player.id === myPlayerId ? 'my-player' : ''}`}
          >
            {/* Player Header */}
            <div className="player-header">
              <div className="player-name-section">
                <span className="player-name">{player.name}</span>
                {player.id === myPlayerId && (
                  <span className="player-label-you">你</span>
                )}
                {isCurrentTurn(index) && (
                  <span className="turn-indicator">▶ 當前回合</span>
                )}
              </div>
              <div className="player-score-badge">
                <span className="score-label">分數</span>
                <span className="score-value">{player.score || 0}</span>
              </div>
            </div>

            {/* Player Stats */}
            <div className="player-stats-row">
              <div className="stat-box">
                <span className="stat-icon">🃏</span>
                <div className="stat-info">
                  <span className="stat-label">手牌</span>
                  <span className="stat-value">{player.hand?.length || 0}</span>
                </div>
              </div>

              <div className="stat-box">
                <span className="stat-icon">📤</span>
                <div className="stat-info">
                  <span className="stat-label">已出牌</span>
                  <span className="stat-value">{player.playedCards?.length || 0}</span>
                </div>
              </div>

              <div className="stat-box">
                <span className="stat-icon">🎯</span>
                <div className="stat-info">
                  <span className="stat-label">配對</span>
                  <span className="stat-value">{player.playedPairs?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Played Cards Display */}
            {player.playedCards && player.playedCards.length > 0 && (
              <div className="played-cards-section">
                <div className="section-header">
                  <span className="section-icon">📤</span>
                  <span className="section-title">已出的牌</span>
                </div>
                <div className="played-cards-list">
                  {player.playedCards.map((card, idx) => (
                    <div key={`played-${card.uniqueId}-${idx}`} className="mini-card">
                      <div className={`card-color-bar color-${card.color}`}></div>
                      <div className="card-content">
                        <span className="card-name-mini">{card.name}</span>
                        <span className="card-value-mini">{card.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Played Pairs Display */}
            {player.playedPairs && player.playedPairs.length > 0 && (
              <div className="played-pairs-section">
                <div className="section-header">
                  <span className="section-icon">🎯</span>
                  <span className="section-title">已出的配對</span>
                </div>
                <div className="played-pairs-list">
                  {player.playedPairs.map((pair, idx) => (
                    <div key={`pair-${idx}`} className="pair-display">
                      <div className="mini-card">
                        <div className={`card-color-bar color-${pair[0].color}`}></div>
                        <div className="card-content">
                          <span className="card-name-mini">{pair[0].name}</span>
                          <span className="card-value-mini">{pair[0].value}</span>
                        </div>
                      </div>
                      <span className="pair-connector">+</span>
                      <div className="mini-card">
                        <div className={`card-color-bar color-${pair[1].color}`}></div>
                        <div className="card-content">
                          <span className="card-name-mini">{pair[1].name}</span>
                          <span className="card-value-mini">{pair[1].value}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {(!player.playedCards || player.playedCards.length === 0) &&
             (!player.playedPairs || player.playedPairs.length === 0) && (
              <div className="player-empty-state">
                <p>尚未出牌</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
