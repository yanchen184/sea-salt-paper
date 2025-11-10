import React from 'react';

/**
 * GameActions Component
 * Displays action buttons for the current player
 * Includes play pair, end turn, and declaration actions
 * 
 * @param {Function} onPlayPair - Handler for playing a pair of cards
 * @param {Function} onEndTurn - Handler for ending the current turn
 * @param {boolean} canPlayPair - Whether a valid pair is selected
 * @param {boolean} canDeclare - Whether player can declare end of round
 * @param {boolean} loading - Whether an action is in progress
 */
export default function GameActions({ 
  onPlayPair, 
  onEndTurn, 
  canPlayPair, 
  canDeclare,
  loading 
}) {
  return (
    <div className="game-actions">
      <button
        className="action-btn play-pair-btn"
        onClick={onPlayPair}
        disabled={!canPlayPair || loading}
      >
        🎴 打出配對
      </button>
      
      <button
        className="action-btn end-turn-btn"
        onClick={onEndTurn}
        disabled={loading}
      >
        ⏭ 結束回合
      </button>
    </div>
  );
}
