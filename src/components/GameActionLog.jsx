// Game Action Log - Records all player actions in the game
// 遊戲動作日誌 - 記錄所有玩家的遊戲動作
import React, { useState, useEffect, useRef } from 'react';
import './GameActionLog.css';

export default function GameActionLog({ gameState, players }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const logEndRef = useRef(null);

  // Get actions from gameState (synced from Firebase)
  const actions = gameState?.actionLog || [];

  // Scroll to bottom when new action added
  useEffect(() => {
    if (!isCollapsed && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [actions.length, isCollapsed]);

  const getActionIcon = (type) => {
    const icons = {
      draw: '🎴',
      discard: '🗑️',
      play_pair: '🎯',
      take_discard: '♻️',
      end_turn: '⏭️',
      declare: '📢',
      game_start: '🎮',
      round_end: '🏁',
      steal: '🦈',
      extra_turn: '⚡',
      system: '💬',
    };
    return icons[type] || '📝';
  };

  const getActionClass = (action) => {
    if (action.isSystem) return 'action-system';
    if (action.type === 'declare') return 'action-important';
    if (action.type === 'steal') return 'action-warning';
    return 'action-normal';
  };

  return (
    <div className={`action-log ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="action-log-header">
        <h3>📜 動作記錄 ({actions.length})</h3>
        <div className="action-log-controls">
          <button
            className="log-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? '展開' : '收起'}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="action-log-content">
          {actions.length === 0 ? (
            <div className="action-empty">
              <p>尚無動作記錄</p>
              <p className="action-hint">玩家的所有動作都會在這裡顯示</p>
            </div>
          ) : (
            <div className="action-list">
              {actions.map((action, index) => (
                <div
                  key={action.id || index}
                  className="action-item action-normal"
                >
                  <span className="action-icon">{action.icon || '📝'}</span>
                  <div className="action-body">
                    {action.player && (
                      <span className="action-player">{action.player}: </span>
                    )}
                    <span className="action-message">{action.action}</span>
                  </div>
                  <span className="action-time">{action.timestamp}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to add action from anywhere
export function logGameAction(type, playerName, message) {
  if (window.addGameAction) {
    window.addGameAction({
      type,
      playerName,
      message,
      timestamp: new Date().toLocaleTimeString(),
      isSystem: false,
    });
  } else {
    console.log('[GameActionLog] Action:', { type, playerName, message });
  }
}
