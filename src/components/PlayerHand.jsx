import React from 'react';
import Card from './Card.jsx';

/**
 * PlayerHand Component
 * Displays the current player's hand of cards
 * Allows selection of cards and shows valid pairs
 * 
 * @param {Array} hand - Array of card objects in player's hand
 * @param {Array} selectedIndices - Indices of currently selected cards
 * @param {Function} onCardClick - Handler for card click events
 * @param {boolean} isCurrentPlayer - Whether this is the current active player
 * @param {Object} playerScore - Object containing score breakdown
 * @param {Array} validPairs - Array of valid card pair combinations
 */
export default function PlayerHand({ 
  hand, 
  selectedIndices, 
  onCardClick, 
  isCurrentPlayer,
  playerScore,
  validPairs 
}) {
  return (
    <div className="player-hand-section">
      <div className="hand-header">
        <h3>你的手牌</h3>
        <div className="score-display">
          <span className="score-label">總分:</span>
          <span className="score-value">{playerScore?.total || 0}</span>
        </div>
      </div>
      
      <div className="hand-cards">
        {hand && hand.length > 0 ? (
          hand.map((card, index) => (
            <div
              key={index}
              className={`hand-card-wrapper ${selectedIndices.includes(index) ? 'selected' : ''} ${
                isCurrentPlayer ? 'clickable' : ''
              }`}
              onClick={() => isCurrentPlayer && onCardClick(index)}
            >
              <Card card={card} />
              {selectedIndices.includes(index) && (
                <div className="selected-indicator">✓</div>
              )}
            </div>
          ))
        ) : (
          <p className="no-cards">沒有手牌</p>
        )}
      </div>

      {validPairs && validPairs.length > 0 && (
        <div className="valid-pairs-info">
          <span>可配對: {validPairs.length} 組</span>
        </div>
      )}
    </div>
  );
}
