import React, { useState } from 'react';
import './DeckViewer.css';

/**
 * DeckViewer Component
 * Display the game deck order, discard piles, and next cards to be drawn
 * 顯示牌堆順序、棄牌堆和即將抽到的牌
 */
export default function DeckViewer({ gameState, onClose }) {
  const [showDeck, setShowDeck] = useState(true);
  const [showDiscard, setShowDiscard] = useState(true);

  if (!gameState) {
    return null;
  }

  const { deck, discardPile1, discardPile2 } = gameState;

  // Get next cards to be drawn (from end of deck array)
  const nextCards = deck.slice(-10).reverse(); // Show last 10 cards (next to be drawn)

  return (
    <div className="deck-viewer-overlay" onClick={onClose}>
      <div className="deck-viewer-container" onClick={(e) => e.stopPropagation()}>
        <div className="deck-viewer-header">
          <h2>牌堆查看器 (Deck Viewer)</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="deck-viewer-content">
          {/* Deck Section */}
          <div className="deck-section">
            <div className="section-header" onClick={() => setShowDeck(!showDeck)}>
              <h3>牌庫 (Draw Deck) - 剩餘 {deck.length} 張</h3>
              <span className="toggle-icon">{showDeck ? '▼' : '▶'}</span>
            </div>
            
            {showDeck && (
              <div className="cards-grid">
                <div className="next-cards-section">
                  <h4>接下來會抽到的牌 (Next {nextCards.length} Cards)</h4>
                  <div className="next-cards-list">
                    {nextCards.map((card, index) => (
                      <div key={`next-${index}`} className="card-item next-card">
                        <span className="card-order">#{index + 1}</span>
                        <div 
                          className={`card-display ${card.color}`}
                          title={card.description}
                        >
                          <div className="card-name">{card.name}</div>
                          <div className="card-info">
                            <span className="card-value">💎 {card.value}</span>
                            <span className="card-type">{getCardTypeLabel(card.type)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="all-deck-section">
                  <h4>完整牌庫順序 (Full Deck Order)</h4>
                  <p className="deck-note">從上到下 = 從底到頂 (Top card is at the end)</p>
                  <div className="deck-cards-list">
                    {deck.slice().reverse().map((card, index) => (
                      <div 
                        key={`deck-${index}`} 
                        className={`card-item-small ${index < 10 ? 'highlight-next' : ''}`}
                      >
                        <span className="card-position">#{deck.length - index}</span>
                        <span className="card-name">{card.name}</span>
                        <span className={`card-color-badge ${card.color}`}>{card.color}</span>
                        <span className="card-value-small">💎{card.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Discard Piles Section */}
          <div className="discard-section">
            <div className="section-header" onClick={() => setShowDiscard(!showDiscard)}>
              <h3>棄牌堆 (Discard Piles)</h3>
              <span className="toggle-icon">{showDiscard ? '▼' : '▶'}</span>
            </div>
            
            {showDiscard && (
              <div className="discard-piles-container">
                {/* Left Discard Pile */}
                <div className="discard-pile-section">
                  <h4>左棄牌堆 (Left Pile) - {discardPile1.length} 張</h4>
                  <div className="discard-pile-cards">
                    {discardPile1.length === 0 ? (
                      <div className="empty-pile">空的 (Empty)</div>
                    ) : (
                      discardPile1.slice().reverse().map((card, index) => (
                        <div 
                          key={`discard1-${index}`}
                          className={`card-item-small ${index === 0 ? 'top-card' : ''}`}
                        >
                          {index === 0 && <span className="top-badge">TOP</span>}
                          <span className="card-name">{card.name}</span>
                          <span className={`card-color-badge ${card.color}`}>{card.color}</span>
                          <span className="card-value-small">💎{card.value}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Discard Pile */}
                <div className="discard-pile-section">
                  <h4>右棄牌堆 (Right Pile) - {discardPile2.length} 張</h4>
                  <div className="discard-pile-cards">
                    {discardPile2.length === 0 ? (
                      <div className="empty-pile">空的 (Empty)</div>
                    ) : (
                      discardPile2.slice().reverse().map((card, index) => (
                        <div 
                          key={`discard2-${index}`}
                          className={`card-item-small ${index === 0 ? 'top-card' : ''}`}
                        >
                          {index === 0 && <span className="top-badge">TOP</span>}
                          <span className="card-name">{card.name}</span>
                          <span className={`card-color-badge ${card.color}`}>{card.color}</span>
                          <span className="card-value-small">💎{card.value}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Game Info Section */}
          <div className="game-info-section">
            <h3>遊戲資訊 (Game Info)</h3>
            <div className="game-info-grid">
              <div className="info-item">
                <span className="info-label">牌庫剩餘:</span>
                <span className="info-value">{deck.length} 張</span>
              </div>
              <div className="info-item">
                <span className="info-label">左棄牌堆:</span>
                <span className="info-value">{discardPile1.length} 張</span>
              </div>
              <div className="info-item">
                <span className="info-label">右棄牌堆:</span>
                <span className="info-value">{discardPile2.length} 張</span>
              </div>
              <div className="info-item">
                <span className="info-label">總牌數:</span>
                <span className="info-value">
                  {deck.length + discardPile1.length + discardPile2.length} 張
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="deck-viewer-footer">
          <button className="close-footer-button" onClick={onClose}>
            關閉 (Close)
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Get card type label in Chinese
 * @param {string} type - Card type
 * @returns {string} Type label
 */
function getCardTypeLabel(type) {
  const labels = {
    pairEffect: '配對效果',
    collection: '集合牌',
    mermaid: '美人魚',
    multiplier: '倍增牌',
  };
  return labels[type] || type;
}
