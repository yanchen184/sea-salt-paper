import React from 'react';

/**
 * GameBoardHeader Component
 * Displays game room info and controls at the top of the game board
 * 
 * @param {string} roomCode - Current game room code
 * @param {string} currentPlayerName - Name of the current active player
 * @param {number} roundNumber - Current round number
 * @param {Function} onBack - Callback when back button is clicked
 */
export default function GameBoardHeader({ roomCode, currentPlayerName, roundNumber, onBack }) {
  return (
    <div className="game-board-header">
      <button className="back-btn" onClick={onBack}>← 返回</button>
      <div className="game-info">
        <h2>房間代碼: {roomCode}</h2>
        <p>當前玩家: <span className="highlight">{currentPlayerName}</span></p>
        <p>回合: {roundNumber}</p>
      </div>
    </div>
  );
}
