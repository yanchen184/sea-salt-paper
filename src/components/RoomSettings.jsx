import React, { useState } from 'react';
import './RoomSettings.css';
import { createAIPlayer, AI_DIFFICULTY } from '../services/aiService.js';

// Room Settings Component - Configure game room settings
export default function RoomSettings({ currentSettings, onApplySettings, onClose }) {
  const [settings, setSettings] = useState({
    targetScore: currentSettings?.targetScore || 'auto', // 'auto', 30, 35, 40, or custom
    customTargetScore: currentSettings?.customTargetScore || 40,
    startingHandSize: currentSettings?.startingHandSize || 0,
    enableAI: currentSettings?.enableAI || false,
    aiDifficulty: currentSettings?.aiDifficulty || AI_DIFFICULTY.MEDIUM,
    aiPlayerCount: currentSettings?.aiPlayerCount || 1,
    enableMermaidWin: currentSettings?.enableMermaidWin !== false, // Default true
    enableColorBonus: currentSettings?.enableColorBonus !== false, // Default true
    maxPlayers: currentSettings?.maxPlayers || 4,
    allowSpectators: currentSettings?.allowSpectators || false,
  });

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onApplySettings(settings);
  };

  return (
    <div className="room-settings-overlay">
      <div className="room-settings-modal">
        <div className="room-settings-header">
          <h2>⚙️ 房間設置</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="room-settings-content">
          {/* Target Score Settings */}
          <div className="setting-section">
            <h3>🎯 目標分數</h3>
            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="radio"
                  name="targetScore"
                  value="auto"
                  checked={settings.targetScore === 'auto'}
                  onChange={(e) => handleChange('targetScore', e.target.value)}
                />
                <span>自動 (2人=40分, 3人=35分, 4人=30分)</span>
              </label>

              <label className="setting-label">
                <input
                  type="radio"
                  name="targetScore"
                  value="30"
                  checked={settings.targetScore === '30'}
                  onChange={(e) => handleChange('targetScore', e.target.value)}
                />
                <span>30 分</span>
              </label>

              <label className="setting-label">
                <input
                  type="radio"
                  name="targetScore"
                  value="35"
                  checked={settings.targetScore === '35'}
                  onChange={(e) => handleChange('targetScore', e.target.value)}
                />
                <span>35 分</span>
              </label>

              <label className="setting-label">
                <input
                  type="radio"
                  name="targetScore"
                  value="40"
                  checked={settings.targetScore === '40'}
                  onChange={(e) => handleChange('targetScore', e.target.value)}
                />
                <span>40 分</span>
              </label>

              <label className="setting-label">
                <input
                  type="radio"
                  name="targetScore"
                  value="custom"
                  checked={settings.targetScore === 'custom'}
                  onChange={(e) => handleChange('targetScore', e.target.value)}
                />
                <span>自定義:</span>
                <input
                  type="number"
                  className="custom-input"
                  min="20"
                  max="100"
                  value={settings.customTargetScore}
                  onChange={(e) => handleChange('customTargetScore', parseInt(e.target.value))}
                  disabled={settings.targetScore !== 'custom'}
                />
                <span>分</span>
              </label>
            </div>
          </div>

          {/* Starting Hand Size */}
          <div className="setting-section">
            <h3>🃏 起始手牌數量</h3>
            <div className="setting-group">
              <label className="setting-label-inline">
                <input
                  type="number"
                  className="number-input"
                  min="0"
                  max="7"
                  value={settings.startingHandSize}
                  onChange={(e) => handleChange('startingHandSize', parseInt(e.target.value))}
                />
                <span>張 (標準規則: 0 張)</span>
              </label>
            </div>
          </div>

          {/* AI Settings */}
          <div className="setting-section">
            <h3>🤖 AI 對手設置</h3>
            <div className="setting-group">
              <label className="setting-label-checkbox">
                <input
                  type="checkbox"
                  checked={settings.enableAI}
                  onChange={(e) => handleChange('enableAI', e.target.checked)}
                />
                <span>啟用 AI 對手</span>
              </label>

              {settings.enableAI && (
                <>
                  <div className="subsetting">
                    <label className="setting-label-inline">
                      <span>AI 數量:</span>
                      <select
                        className="select-input"
                        value={settings.aiPlayerCount}
                        onChange={(e) => handleChange('aiPlayerCount', parseInt(e.target.value))}
                      >
                        <option value="1">1 個 AI</option>
                        <option value="2">2 個 AI</option>
                        <option value="3">3 個 AI</option>
                      </select>
                    </label>
                  </div>

                  <div className="subsetting">
                    <label className="setting-label-inline">
                      <span>AI 難度:</span>
                      <select
                        className="select-input"
                        value={settings.aiDifficulty}
                        onChange={(e) => handleChange('aiDifficulty', e.target.value)}
                      >
                        <option value={AI_DIFFICULTY.EASY}>簡單 (隨機決策)</option>
                        <option value={AI_DIFFICULTY.MEDIUM}>中等 (基礎策略)</option>
                        <option value={AI_DIFFICULTY.HARD}>困難 (進階策略)</option>
                      </select>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Game Rules Settings */}
          <div className="setting-section">
            <h3>📜 遊戲規則</h3>
            <div className="setting-group">
              <label className="setting-label-checkbox">
                <input
                  type="checkbox"
                  checked={settings.enableMermaidWin}
                  onChange={(e) => handleChange('enableMermaidWin', e.target.checked)}
                />
                <span>啟用美人魚特殊勝利 (收集4張美人魚立即獲勝)</span>
              </label>

              <label className="setting-label-checkbox">
                <input
                  type="checkbox"
                  checked={settings.enableColorBonus}
                  onChange={(e) => handleChange('enableColorBonus', e.target.checked)}
                />
                <span>啟用顏色獎勵分數</span>
              </label>
            </div>
          </div>

          {/* Room Settings */}
          <div className="setting-section">
            <h3>👥 房間設置</h3>
            <div className="setting-group">
              <label className="setting-label-inline">
                <span>最大玩家數:</span>
                <select
                  className="select-input"
                  value={settings.maxPlayers}
                  onChange={(e) => handleChange('maxPlayers', parseInt(e.target.value))}
                >
                  <option value="2">2 人</option>
                  <option value="3">3 人</option>
                  <option value="4">4 人</option>
                </select>
              </label>

              <label className="setting-label-checkbox">
                <input
                  type="checkbox"
                  checked={settings.allowSpectators}
                  onChange={(e) => handleChange('allowSpectators', e.target.checked)}
                />
                <span>允許旁觀者加入</span>
              </label>
            </div>
          </div>
        </div>

        <div className="room-settings-footer">
          <button className="settings-btn cancel-btn" onClick={onClose}>
            取消
          </button>
          <button className="settings-btn apply-btn" onClick={handleApply}>
            ✓ 應用設置
          </button>
        </div>
      </div>
    </div>
  );
}
