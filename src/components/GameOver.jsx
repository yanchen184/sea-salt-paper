import React from 'react';
import '../styles/GameOver.css';

export default function GameOver({
  roomCode,
  players,
  scores,
  winnerName,
  winnerId,
  onPlayAgain,
  onMainMenu,
}) {
  // Sort players by score
  const sortedPlayers = players
    ?.map((player, index) => ({
      ...player,
      score: scores?.[index] || 0,
    }))
    ?.sort((a, b) => b.score - a.score) || [];

  return (
    <div className="game-over">
      <div className="game-over-content">
        <h1>Game Over!</h1>

        <div className="winner-section">
          <h2>Winner</h2>
          <div className="winner-display">
            <div className="winner-name">{winnerName}</div>
            <div className="winner-badge">🏆</div>
          </div>
        </div>

        <div className="scores-section">
          <h2>Final Scores</h2>
          <div className="scores-list">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.id}
                className={`score-item ${index === 0 ? 'winner' : ''}`}
              >
                <span className="rank">#{index + 1}</span>
                <span className="player-name">{player.name}</span>
                <span className="score">{player.score} points</span>
              </div>
            ))}
          </div>
        </div>

        <div className="game-info">
          <p>Room Code: {roomCode}</p>
        </div>

        <div className="actions">
          <button className="action-btn play-again" onClick={onPlayAgain}>
            Play Again
          </button>
          <button className="action-btn main-menu" onClick={onMainMenu}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
