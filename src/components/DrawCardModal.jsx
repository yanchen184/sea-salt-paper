import React from 'react';
import Card from './Card.jsx';
import './DrawCardModal.css';

/**
 * DrawCardModal Component
 * Modal for selecting which card to keep when drawing from deck
 * 
 * @param {Array} drawnCards - Two cards drawn from deck
 * @param {Function} onSelectCard - Handler when a card is selected (index: 0 or 1)
 * @param {Function} onSelectDiscardPile - Handler to select which discard pile (0 or 1)
 */
export default function DrawCardModal({ drawnCards, onSelectCard, onCancel }) {
  const [selectedCardIndex, setSelectedCardIndex] = React.useState(null);
  const [selectedDiscardPile, setSelectedDiscardPile] = React.useState(0);

  const handleConfirm = () => {
    if (selectedCardIndex === null) {
      alert('請選擇一張牌！');
      return;
    }
    onSelectCard(selectedCardIndex, selectedDiscardPile);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="draw-card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📥 選擇要保留的牌</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        <div className="modal-content">
          <p className="instruction">你抽到了以下2張牌，請選擇1張加入手牌：</p>
          
          <div className="drawn-cards">
            {drawnCards.map((card, index) => (
              <div
                key={index}
                className={`drawn-card-wrapper ${selectedCardIndex === index ? 'selected' : ''}`}
                onClick={() => setSelectedCardIndex(index)}
              >
                <Card card={card} size="large" />
                {selectedCardIndex === index && (
                  <div className="selected-indicator">✓ 選擇此牌</div>
                )}
              </div>
            ))}
          </div>

          <div className="discard-pile-selection">
            <p className="instruction">另一張牌將放入哪個棄牌堆？</p>
            <div className="pile-buttons">
              <button
                className={`pile-btn ${selectedDiscardPile === 0 ? 'selected' : ''}`}
                onClick={() => setSelectedDiscardPile(0)}
              >
                棄牌堆 1
              </button>
              <button
                className={`pile-btn ${selectedDiscardPile === 1 ? 'selected' : ''}`}
                onClick={() => setSelectedDiscardPile(1)}
              >
                棄牌堆 2
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onCancel}>取消</button>
          <button 
            className="confirm-btn" 
            onClick={handleConfirm}
            disabled={selectedCardIndex === null}
          >
            確認選擇
          </button>
        </div>
      </div>
    </div>
  );
}
