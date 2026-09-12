import React from 'react';
import './GameInstructions.css';

/**
 * GameInstructions Component
 * Displays current game phase and available actions based on Sea Salt & Paper rules
 * 
 * Game Flow:
 * 1. Draw Phase: Draw cards (from deck or discard pile)
 * 2. Play Phase: Optional - play pair combinations for effects
 * 3. Decision Phase: Decide whether to end the round (if 7+ points)
 * 
 * @param {string} gamePhase - Current phase of the game
 * @param {boolean} isCurrentPlayer - Whether this is the current active player
 * @param {string} currentPlayerName - Name of the current active player
 * @param {number} turnNumber - Current turn number
 */
export default function GameInstructions({ 
  gamePhase, 
  isCurrentPlayer, 
  currentPlayerName,
  turnNumber 
}) {
  const getInstructionText = () => {
    if (gamePhase === 'drawing') {
      if (isCurrentPlayer) {
        return (
          <div className="instruction-content current-turn">
            <h3>🎯 你的回合 - 步驟 1: 抽牌</h3>
            <p className="main-instruction">請選擇以下其中一項動作：</p>
            <ol className="action-list">
              <li>📥 <strong>從牌堆抽牌</strong> - 抽2張牌，選1張加入手牌，另1張放入棄牌堆</li>
              <li>♻️ <strong>從棄牌堆拿牌</strong> - 選擇任一棄牌堆的最上面一張牌</li>
            </ol>
          </div>
        );
      } else {
        return (
          <div className="instruction-content waiting">
            <h3>⏳ 等待中</h3>
            <p className="main-instruction">
              當前回合：<strong>{currentPlayerName}</strong>
            </p>
            <p className="reminder">正在進行步驟 1: 抽牌</p>
          </div>
        );
      }
    }

    if (gamePhase === 'playing') {
      if (isCurrentPlayer) {
        return (
          <div className="instruction-content current-turn">
            <h3>🎯 你的回合 - 步驟 2 & 3</h3>
            <ol className="action-list" style={{ paddingLeft: '20px' }}>
              <li><strong>步驟 2：</strong> 可選擇是否打出組合卡片（配對效果）</li>
              <li><strong>步驟 3：</strong> 手牌達 7 分以上可選擇結束該輪</li>
            </ol>
            <p className="reminder">✅ 完成後，點擊「結束回合」按鈕</p>
          </div>
        );
      } else {
        return (
          <div className="instruction-content waiting">
            <h3>⏳ 等待中</h3>
            <p className="main-instruction">
              當前回合：<strong>{currentPlayerName}</strong>
            </p>
            <p className="reminder">正在決定是否打出組合或結束該輪</p>
          </div>
        );
      }
    }

    return null;
  };

  return (
    <div className="game-instructions">
      {getInstructionText()}
    </div>
  );
}
