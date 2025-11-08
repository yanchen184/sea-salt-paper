import React from 'react';
import './Card.css';

export default function Card({ card, onClick, selected = false, faceDown = false, isPlayable = false, size = 'medium', style = {} }) {
  if (!card && !faceDown) return null;

  const cardStyle = { ...style, cursor: isPlayable ? 'pointer' : 'default', opacity: selected ? 0.8 : 1, transform: selected ? 'scale(1.05)' : 'scale(1)' };
  const handleClick = () => { if (isPlayable && onClick) onClick(card); };
  const colorClass = card?.color ? `card-color-${card.color}` : '';
  const rarityClass = card?.rarity ? `card-rarity-${card.rarity}` : '';

  return (
    <div className={`card card-front card-${size} ${colorClass} ${rarityClass} ${selected ? 'card-selected' : ''} ${isPlayable ? 'card-playable' : ''}`} style={cardStyle} onClick={handleClick}>
      <div className="card-header">
        <div className="card-name">{card?.name}</div>
        <div className="card-points">{card?.points}</div>
      </div>
      <div className="card-icon">{getCardIcon(card?.type)}</div>
      <div className="card-footer"><div className="card-type">{getCardTypeName(card?.type)}</div></div>
      {selected && <div className="card-selection-badge">✓</div>}
      {isPlayable && <div className="card-playable-badge">↑</div>}
    </div>
  );
}

function getCardIcon(type) {
  const icons = { fish: '🐠', crab: '🦀', seahorse: '🐴', ship: '⛵', sailor: '👨‍⚓️', shell: '🐚', starfish: '⭐', bottle: '🍾', mermaid: '🧜‍♀️', anchor: '⚓', treasure: '💎', octopus: '🐙' };
  return icons[type] || '🎴';
}

function getCardTypeName(type) {
  const typeNames = { fish: 'Marine', crab: 'Marine', seahorse: 'Marine', ship: 'Human', sailor: 'Human', shell: 'Collection', starfish: 'Collection', bottle: 'Collection', mermaid: 'Special', anchor: 'Treasure', treasure: 'Treasure', octopus: 'Treasure' };
  return typeNames[type] || 'Card';
}
