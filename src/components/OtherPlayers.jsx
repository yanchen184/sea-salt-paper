import React from 'react';

/**
 * OtherPlayers Component
 * Displays information about other players in the game
 * Shows their hand size, score, and current turn indicator
 * 
 * @param {Array} players - Array of all player objects
 * @param {number} currentPlayerIndex - Index of the current active player
 * @param {string} playerId - ID of the local player (to exclude from display)
 */
export default function OtherPlayers({ players, currentPlayerIndex, playerId }) {
  const otherPlayers = players.filter(p => p.id !== playerId);

  if (otherPlayers.length === 0) {
    return null;
  }

  return (
    <div className="other-players-section">
      <h3>其他玩家</h3>
      <div className="other-players-list">
        {otherPlayers.map((player, index) => {
          const actualIndex = players.findIndex(p => p.id === player.id);
          const isCurrentTurn = actualIndex === currentPlayerIndex;
          
          return (
            <div 
              key={player.id || index} 
              className={`other-player ${isCurrentTurn ? 'current-turn' : ''}`}
            >
              <div className="player-name">
                {player.name}
                {isCurrentTurn && <span className="turn-indicator">👉</span>}
              </div>
              <div className="player-stats">
                <span className="hand-count">🃏 {player.hand?.length || 0}</span>
                <span className="player-score">⭐ {player.score || 0}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
