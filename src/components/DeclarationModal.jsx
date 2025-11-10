import React from 'react';

/**
 * DeclarationModal Component
 * Modal dialog for declaring end of round
 * Offers two options: "到此為止" (Stop Now) or "最後機會" (Last Chance)
 * 
 * @param {boolean} canDeclare - Whether player meets requirements to declare
 * @param {Function} onImmediate - Handler for "Stop Now" declaration
 * @param {Function} onLastChance - Handler for "Last Chance" declaration
 * @param {Function} onCancel - Handler for canceling the modal
 * @param {string} playerName - Name of the declaring player
 * @param {number} playerScore - Current score of the declaring player
 */
export default function DeclarationModal({ 
  canDeclare, 
  onImmediate, 
  onLastChance, 
  onCancel,
  playerName,
  playerScore 
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="declaration-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>宣告結束回合</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-content">
          <div className="player-info-modal">
            <p><strong>玩家:</strong> {playerName}</p>
            <p><strong>當前分數:</strong> {playerScore}</p>
          </div>

          {!canDeclare ? (
            <div className="warning-message">
              <p>⚠️ 你的手牌分數不足 7 分，無法宣告!</p>
            </div>
          ) : (
            <>
              <div className="declaration-explanation">
                <p>選擇宣告類型:</p>
                <ul>
                  <li><strong>到此為止:</strong> 立即結束，只有你計分</li>
                  <li><strong>最後機會:</strong> 其他玩家還有一回合機會</li>
                </ul>
              </div>

              <div className="modal-actions">
                <button 
                  className="declare-btn immediate"
                  onClick={onImmediate}
                >
                  🛑 到此為止
                </button>
                <button 
                  className="declare-btn last-chance"
                  onClick={onLastChance}
                >
                  ⏰ 最後機會
                </button>
              </div>
            </>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}
