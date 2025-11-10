import React from 'react';
import Card from './Card.jsx';

/**
 * CardDisplay Component
 * Displays a single card with optional click handler
 * Used for discard piles and special card displays
 * 
 * @param {Object} card - Card object to display (or null for empty)
 * @param {Function} onClick - Optional click handler
 * @param {string} title - Display title for the card area
 */
export default function CardDisplay({ card, onClick, title }) {
  if (!card) {
    return (
      <div className="card-display empty" title={title}>
        <div className="empty-placeholder">
          <span>空</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`card-display ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      title={title}
    >
      <Card card={card} />
    </div>
  );
}
