// Game Debug Panel - Display all game state information for debugging
import React, { useState } from 'react';
import './GameDebugPanel.css';

export default function GameDebugPanel({ gameState, players, roomCode }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, deck, players, discard

  console.log('[GameDebugPanel] Rendering with state:', {
    gameState,
    players,
    roomCode,
  });

  if (!gameState) {
    return (
      <div className="debug-panel">
        <div className="debug-header">
          <h3>🔍 遊戲狀態調試面板</h3>
        </div>
        <div className="debug-content">
          <p>⏳ 等待遊戲狀態載入...</p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalCards = gameState.deck?.length || 0;
  const cardsDrawn = gameState.deckTopIndex || 0;
  const cardsRemaining = totalCards - cardsDrawn;
  
  // Count cards in discard piles
  const discardCounts = {};
  if (gameState.discardPiles) {
    Object.entries(gameState.discardPiles).forEach(([playerId, pile]) => {
      discardCounts[playerId] = pile?.length || 0;
    });
  }

  // Render Overview Tab
  const renderOverview = () => (
    <div className="debug-tab-content">
      <div className="debug-section">
        <h4>📊 基本資訊</h4>
        <div className="debug-info-grid">
          <div className="debug-info-item">
            <span className="info-label">房間代碼:</span>
            <span className="info-value">{roomCode}</span>
          </div>
          <div className="debug-info-item">
            <span className="info-label">遊戲狀態:</span>
            <span className="info-value status">{gameState.status || 'N/A'}</span>
          </div>
          <div className="debug-info-item">
            <span className="info-label">當前玩家:</span>
            <span className="info-value">
              {players?.[gameState.currentPlayerIndex]?.name || 'N/A'}
            </span>
          </div>
          <div className="debug-info-item">
            <span className="info-label">回合階段:</span>
            <span className="info-value">{gameState.turnPhase || 'N/A'}</span>
          </div>
          <div className="debug-info-item">
            <span className="info-label">回合數:</span>
            <span className="info-value">{gameState.roundNumber || 1}</span>
          </div>
        </div>
      </div>

      <div className="debug-section">
        <h4>🎴 牌庫狀態</h4>
        <div className="debug-info-grid">
          <div className="debug-info-item">
            <span className="info-label">總卡牌數:</span>
            <span className="info-value">{totalCards}</span>
          </div>
          <div className="debug-info-item">
            <span className="info-label">已抽牌數:</span>
            <span className="info-value">{cardsDrawn}</span>
          </div>
          <div className="debug-info-item">
            <span className="info-label">剩餘牌數:</span>
            <span className="info-value cards-remaining">{cardsRemaining}</span>
          </div>
          <div className="debug-info-item">
            <span className="info-label">下一張索引:</span>
            <span className="info-value">{gameState.deckTopIndex}</span>
          </div>
        </div>
      </div>

      <div className="debug-section">
        <h4>👥 玩家統計</h4>
        <div className="players-stats">
          {players?.map((player) => (
            <div key={player.id} className="player-stat-card">
              <div className="player-stat-header">
                <span className="player-name">{player.name}</span>
                {gameState.currentPlayerIndex === players.indexOf(player) && (
                  <span className="current-turn-badge">▶ 當前回合</span>
                )}
              </div>
              <div className="player-stat-body">
                <div className="stat-item">
                  <span>手牌數:</span>
                  <span className="stat-value">{player.hand?.length || 0}</span>
                </div>
                <div className="stat-item">
                  <span>已出牌:</span>
                  <span className="stat-value">{player.playedCards?.length || 0}</span>
                </div>
                <div className="stat-item">
                  <span>棄牌堆:</span>
                  <span className="stat-value">{discardCounts[player.id] || 0}</span>
                </div>
                <div className="stat-item">
                  <span>分數:</span>
                  <span className="stat-value score">{player.score || 0}</span>
                </div>
                <div className="stat-item">
                  <span>狀態:</span>
                  <span className={`stat-value status-${player.status}`}>
                    {player.status || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Render Deck Tab
  const renderDeck = () => (
    <div className="debug-tab-content">
      <div className="debug-section">
        <h4>🎴 完整牌庫順序 (共 {totalCards} 張)</h4>
        <div className="deck-info">
          <p>✅ 已抽: {cardsDrawn} 張 | ⏳ 剩餘: {cardsRemaining} 張</p>
          <p className="next-card-indicator">
            下一張要抽的牌: <strong>deck[{gameState.deckTopIndex}]</strong>
          </p>
        </div>
        
        <div className="deck-list">
          {gameState.deck?.map((card, index) => {
            const isDrawn = index < cardsDrawn;
            const isNext = index === gameState.deckTopIndex;
            
            return (
              <div
                key={`${card.uniqueId}-${index}`}
                className={`deck-card-item ${isDrawn ? 'drawn' : ''} ${isNext ? 'next' : ''}`}
              >
                <span className="card-index">[{index}]</span>
                <span className="card-name">{card.name}</span>
                <span className={`card-color color-${card.color}`}>
                  {card.color}
                </span>
                <span className="card-type">{card.type}</span>
                <span className="card-value">值:{card.value}</span>
                {isNext && <span className="next-badge">← 下一張</span>}
                {isDrawn && <span className="drawn-badge">✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Render Players Tab
  const renderPlayers = () => (
    <div className="debug-tab-content">
      {players?.map((player) => (
        <div key={player.id} className="debug-section player-detail">
          <h4>
            👤 {player.name}
            {gameState.currentPlayerIndex === players.indexOf(player) && ' (當前回合)'}
          </h4>
          
          <div className="player-detail-grid">
            <div className="detail-section">
              <h5>🃏 手牌 ({player.hand?.length || 0})</h5>
              <div className="card-list">
                {player.hand && player.hand.length > 0 ? (
                  player.hand.map((card, idx) => (
                    <div key={`hand-${card.uniqueId}-${idx}`} className="card-item">
                      <span className="card-name">{card.name}</span>
                      <span className={`card-color color-${card.color}`}>
                        {card.color}
                      </span>
                      <span className="card-value">({card.value}分)</span>
                    </div>
                  ))
                ) : (
                  <p className="empty-state">沒有手牌</p>
                )}
              </div>
            </div>

            <div className="detail-section">
              <h5>📤 已出牌 ({player.playedCards?.length || 0})</h5>
              <div className="card-list">
                {player.playedCards && player.playedCards.length > 0 ? (
                  player.playedCards.map((card, idx) => (
                    <div key={`played-${card.uniqueId}-${idx}`} className="card-item">
                      <span className="card-name">{card.name}</span>
                      <span className={`card-color color-${card.color}`}>
                        {card.color}
                      </span>
                      <span className="card-value">({card.value}分)</span>
                    </div>
                  ))
                ) : (
                  <p className="empty-state">尚未出牌</p>
                )}
              </div>
            </div>
          </div>

          <div className="player-stats-row">
            <div className="stat-box">
              <span className="stat-label">分數</span>
              <span className="stat-number">{player.score || 0}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">狀態</span>
              <span className="stat-number">{player.status || 'N/A'}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">叫停</span>
              <span className="stat-number">
                {player.hasCalledStop ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Render Discard Piles Tab
  const renderDiscardPiles = () => (
    <div className="debug-tab-content">
      <div className="debug-section">
        <h4>🗑️ 所有棄牌堆</h4>
        
        {gameState.discardPiles && Object.keys(gameState.discardPiles).length > 0 ? (
          Object.entries(gameState.discardPiles).map(([playerId, pile]) => {
            const player = players?.find(p => p.id === playerId);
            return (
              <div key={playerId} className="discard-pile-section">
                <h5>
                  {player?.name || playerId} 的棄牌堆 ({pile?.length || 0} 張)
                </h5>
                <div className="card-list">
                  {pile && pile.length > 0 ? (
                    pile.map((card, idx) => (
                      <div key={`discard-${card.uniqueId}-${idx}`} className="card-item">
                        <span className="card-index">[{idx}]</span>
                        <span className="card-name">{card.name}</span>
                        <span className={`card-color color-${card.color}`}>
                          {card.color}
                        </span>
                        <span className="card-value">({card.value}分)</span>
                      </div>
                    ))
                  ) : (
                    <p className="empty-state">棄牌堆為空</p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="empty-state">所有棄牌堆都是空的</p>
        )}
      </div>
    </div>
  );

  return (
    <div className={`debug-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="debug-header">
        <h3>🔍 遊戲狀態調試面板</h3>
        <button 
          className="collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? '展開 ▼' : '收起 ▲'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className="debug-tabs">
            <button
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📊 總覽
            </button>
            <button
              className={`tab-btn ${activeTab === 'deck' ? 'active' : ''}`}
              onClick={() => setActiveTab('deck')}
            >
              🎴 牌庫 ({cardsRemaining})
            </button>
            <button
              className={`tab-btn ${activeTab === 'players' ? 'active' : ''}`}
              onClick={() => setActiveTab('players')}
            >
              👥 玩家
            </button>
            <button
              className={`tab-btn ${activeTab === 'discard' ? 'active' : ''}`}
              onClick={() => setActiveTab('discard')}
            >
              🗑️ 棄牌堆
            </button>
          </div>

          <div className="debug-content">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'deck' && renderDeck()}
            {activeTab === 'players' && renderPlayers()}
            {activeTab === 'discard' && renderDiscardPiles()}
          </div>
        </>
      )}
    </div>
  );
}
