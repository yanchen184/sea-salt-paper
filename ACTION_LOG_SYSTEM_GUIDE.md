# 🎮 遊戲動作記錄系統 & 玩家狀態面板

## 📋 新增功能

### 1. **GameActionLog** - 動作記錄日誌
即時顯示所有玩家的動作記錄

**位置**: 畫面右上角，可摺疊
**功能**:
- 記錄所有玩家的動作（抽牌、出牌、結束回合等）
- 自動滾動到最新動作
- 可清除記錄
- 顏色編碼不同類型的動作

### 2. **AllPlayersDisplay** - 所有玩家狀態面板
顯示所有玩家的詳細狀態

**位置**: 遊戲主畫面
**功能**:
- 顯示所有玩家的手牌數量
- 顯示每位玩家已出的牌（公開資訊）
- 顯示每位玩家的配對牌
- 標示當前回合玩家
- 標示自己的玩家卡片

---

## 📦 新增的檔案

### 1. GameActionLog 組件
```
src/components/GameActionLog.jsx     - 動作日誌組件
src/components/GameActionLog.css     - 樣式
```

### 2. AllPlayersDisplay 組件
```
src/components/AllPlayersDisplay.jsx  - 玩家狀態顯示組件
src/components/AllPlayersDisplay.css  - 樣式
```

---

## 🎯 使用方式

### 整合到 GameBoard

```javascript
// 1. Import 組件
import GameActionLog, { logGameAction } from './GameActionLog.jsx';
import AllPlayersDisplay from './AllPlayersDisplay.jsx';

// 2. 在 return 中加入組件
return (
  <div className="game-board">
    {/* ... 其他組件 ... */}
    
    {/* 動作記錄日誌 */}
    <GameActionLog 
      gameState={gameState} 
      players={gameState.players} 
    />
    
    {/* 所有玩家狀態 */}
    <AllPlayersDisplay
      players={gameState.players}
      currentPlayerIndex={gameState.currentPlayerIndex}
      myPlayerId={playerId}
    />
  </div>
);
```

### 記錄玩家動作

在每個操作的地方調用 `logGameAction`:

```javascript
// 抽牌時
logGameAction('draw', currentPlayer.name, `抽了2張牌，保留了${result.keptCard.name}`);

// 從棄牌堆拿牌時
logGameAction('take_discard', currentPlayer.name, `從棄牌堆拿了${result.takenCard.name}`);

// 打出配對時
logGameAction('play_pair', currentPlayer.name, `打出配對: ${card1.name} + ${card2.name}`);

// 結束回合時
logGameAction('end_turn', currentPlayer.name, '結束回合');

// 叫停時
logGameAction('declare', currentPlayer.name, `宣告${type === 'immediate' ? '到此為止' : '最後機會'}!`);
```

---

## 🎨 畫面布局

### 新的遊戲畫面結構

```
┌─────────────────────────────────────────────────────┐
│  Game Header (房間代碼、當前玩家、回合數)           │
├─────────────────────────────────────────────────────┤
│                                      ┌──────────────┐│
│                                      │ 動作記錄日誌  ││
│  [所有玩家狀態面板]                  │ (右上角)     ││
│  ┌──────────────┐  ┌──────────────┐ │              ││
│  │ Player 1 (你)│  │  Player 2    │ │              ││
│  │ 手牌: 5      │  │  手牌: 6     │ │              ││
│  │ 分數: 3      │  │  分數: 2     │ └──────────────┘│
│  │              │  │              │                  │
│  │ 已出的牌:    │  │  已出的牌:   │                  │
│  │ [魚][螃蟹]   │  │  [帆船]      │                  │
│  └──────────────┘  └──────────────┘                  │
├─────────────────────────────────────────────────────┤
│                   [棄牌堆] [抽牌]                    │
├─────────────────────────────────────────────────────┤
│                   [你的手牌]                         │
└─────────────────────────────────────────────────────┘
```

---

## 📊 功能詳細說明

### GameActionLog - 動作記錄

#### 記錄的動作類型

| 動作類型 | 圖示 | 說明 |
|---------|------|------|
| draw | 🎴 | 從牌庫抽牌 |
| take_discard | ♻️ | 從棄牌堆拿牌 |
| play_pair | 🎯 | 打出配對 |
| end_turn | ⏭️ | 結束回合 |
| declare | 📢 | 宣告結束 |
| steal | 🦈 | 偷牌 |
| game_start | 🎮 | 遊戲開始 |
| system | 💬 | 系統訊息 |

#### 動作記錄格式

```
🎴 Player 1: 抽了2張牌，保留了魚          10:30:45
🎯 Player 1: 打出配對: 魚 + 魚              10:31:12
⏭️ Player 1: 結束回合                      10:31:20
🎴 Player 2: 從棄牌堆拿了螃蟹               10:31:25
```

#### 顏色編碼

- **系統訊息**: 綠色背景
- **重要動作** (叫停): 金色背景
- **警告動作** (偷牌): 紅色背景
- **一般動作**: 灰色背景

---

### AllPlayersDisplay - 玩家狀態

#### 顯示資訊

每位玩家的卡片顯示:

1. **玩家名稱** + 標籤
   - `(你)` - 自己的玩家
   - `▶ 當前回合` - 當前回合玩家

2. **分數徽章**
   - 當前分數 / 目標分數

3. **統計資訊**
   - 🃏 手牌數量
   - 📤 已出牌數量
   - 🎯 配對數量

4. **已出的牌** (公開資訊)
   - 顯示每張牌的名稱和分數
   - 按顏色分類顯示

5. **已出的配對** (公開資訊)
   - 顯示配對的兩張牌
   - 用 `+` 連接

#### 特殊樣式

- **當前回合玩家**: 金色邊框 + 脈動動畫
- **自己的玩家**: 綠色邊框
- **滑鼠懸停**: 向上浮動效果

---

## 🔄 動作記錄整合示例

### 完整的抽牌流程

```javascript
const handleConfirmDrawSelection = (keepCardIndex, discardPileIndex) => {
  try {
    setLoading(true);
    const result = drawFromDeck(gameState, discardPileIndex, keepCardIndex);
    
    // 記錄動作
    logGameAction(
      'draw', 
      currentPlayer.name, 
      `抽了2張牌，保留了${result.keptCard.name}，棄掉了${result.discardedCard.name}`
    );
    
    setGameState(result.updatedGameState);
    setMessage(`抽牌成功！拿到${result.keptCard.name}`);
  } catch (error) {
    logGameAction('system', null, `❌ 抽牌失敗: ${error.message}`);
  } finally {
    setLoading(false);
  }
};
```

### 結束回合流程

```javascript
const handleEndTurn = () => {
  const oldPlayer = currentPlayer.name;
  
  import('../data/gameRules.js').then(({ nextTurn }) => {
    const newGameState = nextTurn(gameState);
    const newPlayer = newGameState.players[newGameState.currentPlayerIndex].name;
    
    // 記錄回合切換
    logGameAction('end_turn', oldPlayer, '結束回合');
    logGameAction('system', null, `輪到 ${newPlayer} 的回合`);
    
    setGameState(newGameState);
  });
};
```

---

## 🎯 優點

### 1. **即時可見性**
- 所有玩家都能看到其他人的動作
- 透明的遊戲進程

### 2. **公平性**
- 所有已出的牌都是公開的
- 無法作弊或隱藏已出的牌

### 3. **易於追蹤**
- 動作日誌保留完整的遊戲歷史
- 可以回顧之前發生的事情

### 4. **清晰的狀態**
- 一目了然看到所有玩家的狀態
- 知道誰手牌多、誰已經出了什麼牌

---

## 📝 下一步整合

要將這些組件整合到遊戲中，需要:

1. ✅ Import 兩個新組件
2. ✅ 在 GameBoard return 中加入組件
3. ⏳ 在所有關鍵操作中調用 `logGameAction`
4. ⏳ 測試動作記錄是否正常顯示
5. ⏳ 調整 CSS 確保不擋住遊戲內容

---

**建立時間**: 2025-01-15
**狀態**: ✅ 組件已建立，等待整合
