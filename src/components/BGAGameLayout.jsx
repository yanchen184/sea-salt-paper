// BGA-Style Game Layout - Inspired by BoardGameArena's Sea Salt & Paper
// BGA 風格遊戲布局 - 參考 BoardGameArena 的《海鹽摺紙》
import React from 'react';
import './BGAGameLayout.css';

export default function BGAGameLayout({
  gameState,
  players,
  myPlayerId,
  onDrawFromDeck,
  onTakeFromDiscard,
  onPlayCard,
  onEndTurn,
  isMyTurn,
}) {
  const myPlayer = players.find(p => p.id === myPlayerId);
  const opponents = players.filter(p => p.id !== myPlayerId);
  
  // Get top cards from discard piles
  const topDiscard1 = gameState.discardPile1?.[gameState.discardPile1.length - 1];
  const topDiscard2 = gameState.discardPile2?.[gameState.discardPile2.length - 1];

  // Calculate current action hint
  const getActionHint = () => {
    if (!isMyTurn) {
      const currentPlayer = players[gameState.currentPlayerIndex];
      return `等待 ${currentPlayer?.name} 進行動作`;
    }
    
    if (!gameState.hasDrawnThisTurn) {
      return '你必須先抽牌：從牌庫抽2張或從棄牌堆拿1張';
    }
    
    return '你可以：出牌、組合牌、宣告結束';
  };

  return (
    <div className="bga-game-layout">
      {/* Top Action Hint Bar */}
      <div className={`action-hint-bar ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>
        <span className="hint-icon">💡</span>
        <span className="hint-text">{getActionHint()}</span>
      </div>

      {/* Main Game Container */}
      <div className="bga-game-container">
        {/* Left Section - Deck & Discard Piles & Tutorial */}
        <div className="left-section">
          {/* Deck and Discard Piles */}
          <div className="deck-discard-area">
            {/* Deck */}
            <div 
              className={`deck-pile ${isMyTurn && !gameState.hasDrawnThisTurn ? 'clickable' : ''}`}
              onClick={isMyTurn && !gameState.hasDrawnThisTurn ? onDrawFromDeck : null}
            >
              <div className="deck-card-back">
                <div className="deck-pattern"></div>
                <div className="deck-count">{gameState.deck?.length || 0}</div>
              </div>
              <div className="pile-label">牌庫</div>
            </div>

            {/* Discard Pile 1 */}
            <div 
              className={`discard-pile ${isMyTurn && !gameState.hasDrawnThisTurn && topDiscard1 ? 'clickable' : ''}`}
              onClick={isMyTurn && !gameState.hasDrawnThisTurn && topDiscard1 ? () => onTakeFromDiscard(0) : null}
            >
              {topDiscard1 ? (
                <div className={`mini-game-card color-${topDiscard1.color}`}>
                  <div className="card-header">
                    <span className="card-icons">{getCardIcons(topDiscard1)}</span>
                  </div>
                  <div className="card-image">
                    <span className="card-emoji">{getCardEmoji(topDiscard1)}</span>
                  </div>
                  <div className="card-name">{topDiscard1.name}</div>
                </div>
              ) : (
                <div className="empty-pile">空</div>
              )}
              <div className="pile-label">棄牌堆 1</div>
              {gameState.discardPile1?.length > 1 && (
                <div className="pile-count">{gameState.discardPile1.length}</div>
              )}
            </div>

            {/* Discard Pile 2 */}
            <div 
              className={`discard-pile ${isMyTurn && !gameState.hasDrawnThisTurn && topDiscard2 ? 'clickable' : ''}`}
              onClick={isMyTurn && !gameState.hasDrawnThisTurn && topDiscard2 ? () => onTakeFromDiscard(1) : null}
            >
              {topDiscard2 ? (
                <div className={`mini-game-card color-${topDiscard2.color}`}>
                  <div className="card-header">
                    <span className="card-icons">{getCardIcons(topDiscard2)}</span>
                  </div>
                  <div className="card-image">
                    <span className="card-emoji">{getCardEmoji(topDiscard2)}</span>
                  </div>
                  <div className="card-name">{topDiscard2.name}</div>
                </div>
              ) : (
                <div className="empty-pile">空</div>
              )}
              <div className="pile-label">棄牌堆 2</div>
              {gameState.discardPile2?.length > 1 && (
                <div className="pile-count">{gameState.discardPile2.length}</div>
              )}
            </div>
          </div>

          {/* Tutorial/Info Box */}
          <div className="tutorial-box">
            <div className="tutorial-header">
              <span className="tutorial-icon">🎓</span>
              <h4>遊戲說明</h4>
            </div>
            <div className="tutorial-content">
              <div className="tutorial-section">
                <h5>輪到你時，你可以執行以下動作：</h5>
                <ol>
                  <li>
                    <strong>抽牌（強制）</strong>
                    <p>你可以從一個棄牌堆中抽取1張牌</p>
                    <p className="or-text">或者</p>
                    <p>你可從牌庫中抽取2張牌，並棄置其中一張。</p>
                  </li>
                  <li>
                    <strong>打出組合牌（可選）</strong>
                    <p>你可以打出組合牌並觸發其效果。</p>
                  </li>
                  <li>
                    <strong>宣告結束（可選）</strong>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Center Section - Playing Area */}
        <div className="center-section">
          {/* My Played Cards Area */}
          <div className="played-area my-area">
            <div className="area-header">
              <span className="player-name">{myPlayer?.name || '你'}</span>
              <span className="score-badge">
                <span className="score-icon">⭐</span>
                <span className="score-text">分數: {myPlayer?.score || 0}</span>
              </span>
            </div>
            <div className="played-cards-grid">
              {myPlayer?.playedCards && myPlayer.playedCards.length > 0 ? (
                myPlayer.playedCards.map((card, idx) => (
                  <div key={`my-played-${idx}`} className={`played-game-card color-${card.color}`}>
                    <div className="card-header">
                      <span className="card-icons">{getCardIcons(card)}</span>
                    </div>
                    <div className="card-image">
                      <span className="card-emoji">{getCardEmoji(card)}</span>
                    </div>
                    <div className="card-footer">
                      <span className="card-name">{card.name}</span>
                      <span className="card-value">{card.value}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-area">
                  <p>尚未出牌</p>
                  <p className="hint">打出的牌會顯示在這裡</p>
                </div>
              )}
            </div>
          </div>

          {/* Opponents Played Cards Areas */}
          {opponents.map((opponent, oppIdx) => {
            const isCurrentTurn = players[gameState.currentPlayerIndex]?.id === opponent.id;
            return (
              <div key={opponent.id} className={`played-area opponent-area ${isCurrentTurn ? 'active-turn' : ''}`}>
                <div className="area-header">
                  <span className="player-name">
                    {opponent.name}
                    {isCurrentTurn && <span className="turn-indicator">▶</span>}
                  </span>
                  <span className="score-badge">
                    <span className="score-icon">⭐</span>
                    <span className="score-text">分數: {opponent.score || 0}</span>
                  </span>
                </div>
                <div className="played-cards-grid">
                  {opponent.playedCards && opponent.playedCards.length > 0 ? (
                    opponent.playedCards.map((card, idx) => (
                      <div key={`opp-${oppIdx}-played-${idx}`} className={`played-game-card color-${card.color}`}>
                        <div className="card-header">
                          <span className="card-icons">{getCardIcons(card)}</span>
                        </div>
                        <div className="card-image">
                          <span className="card-emoji">{getCardEmoji(card)}</span>
                        </div>
                        <div className="card-footer">
                          <span className="card-name">{card.name}</span>
                          <span className="card-value">{card.value}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-area small">
                      <p>尚未出牌</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Section - Opponents Info */}
        <div className="right-section">
          {opponents.map((opponent) => {
            const isCurrentTurn = players[gameState.currentPlayerIndex]?.id === opponent.id;
            return (
              <div key={opponent.id} className={`opponent-info-card ${isCurrentTurn ? 'active' : ''}`}>
                <div className="opponent-avatar">
                  <span className="avatar-icon">👤</span>
                  {isCurrentTurn && <div className="turn-pulse"></div>}
                </div>
                <div className="opponent-details">
                  <div className="opponent-name">{opponent.name}</div>
                  <div className="opponent-stats">
                    <div className="stat-item">
                      <span className="stat-icon">🃏</span>
                      <span className="stat-value">{opponent.hand?.length || 0}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-icon">⭐</span>
                      <span className="stat-value">{opponent.score || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Helper functions for card display
function getCardEmoji(card) {
  const emojiMap = {
    fish: '🐟',
    crab: '🦀',
    sailboat: '⛵',
    shark: '🦈',
    swimmer: '🏊',
    shell: '🐚',
    starfish: '⭐',
    octopus: '🐙',
    ray: '🐠',
    lighthouse: '🗼',
    school: '🐟🐟',
    colony: '🐧',
    captain: '👨‍✈️',
    mermaid: '🧜',
  };
  return emojiMap[card.id] || '🎴';
}

function getCardIcons(card) {
  // Return icons based on card type
  if (card.type === 'pairEffect') return '🎯';
  if (card.type === 'collection') return '📦';
  if (card.type === 'multiplier') return '✨';
  if (card.type === 'mermaid') return '🧜';
  return '';
}
