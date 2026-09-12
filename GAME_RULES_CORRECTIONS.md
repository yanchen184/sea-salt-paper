# 🎮 Sea Salt & Paper 遊戲規則修正

## ❌ 需要修正的理解

### 1. 棄牌堆結構
**錯誤理解**: 每個玩家有自己的棄牌堆  
**正確理解**: ✅ 遊戲中有 **2 個共用的棄牌堆**，所有玩家共用

目前代碼已經正確：
```javascript
discardPile1: [card],  // 共用棄牌堆 1
discardPile2: [card],  // 共用棄牌堆 2
```

### 2. 抽牌機制
**錯誤理解**: 從牌庫頂部按順序抽牌  
**正確理解**: ❌ 從牌庫**隨機抽2張牌**

目前代碼（錯誤）：
```javascript
const card1 = newState.deck.pop();  // 按順序從頂部抽
const card2 = newState.deck.pop();
```

應該改為（正確）：
```javascript
// 隨機抽取2張牌
const randomIndex1 = Math.floor(Math.random() * newState.deck.length);
const card1 = newState.deck.splice(randomIndex1, 1)[0];

const randomIndex2 = Math.floor(Math.random() * newState.deck.length);
const card2 = newState.deck.splice(randomIndex2, 1)[0];
```

### 3. 起始手牌
從截圖看，遊戲開始時玩家應該已經有手牌。

**需要確認**: 遊戲開始時每位玩家抽幾張牌？
- 可能是 2 張？
- 可能是 0 張，然後第一個玩家先抽？

---

## 📋 遊戲流程（從截圖推斷）

### 遊戲開始
1. 洗牌
2. 放 1 張牌到棄牌堆 1
3. 放 1 張牌到棄牌堆 2
4. 每位玩家抽起始手牌（數量待確認）

### 玩家回合
1. **抽牌階段（強制）**
   - 選項 A: 從牌庫**隨機**抽 2 張，選 1 張保留，1 張棄到棄牌堆
   - 選項 B: 從任一棄牌堆拿最上面的 1 張牌

2. **出牌階段（可選）**
   - 可以打出配對牌
   - 觸發效果

3. **宣告階段（可選）**
   - 如果分數 ≥ 7，可以宣告結束

---

## 🔧 需要修正的代碼

### gameRules.js - drawFromDeck 函數

```javascript
/**
 * Draw 2 RANDOM cards from deck, player chooses 1 to keep and 1 to discard
 * 從牌庫隨機抽2張牌,玩家選1張留手,1張棄置
 */
export function drawFromDeck(gameState, discardPileIndex, keepCardIndex) {
  const newState = { ...gameState };

  // Check if deck has enough cards
  if (newState.deck.length < 2) {
    throw new Error('牌庫牌數不足,無法抽2張牌');
  }

  // 🔴 重要修正：隨機抽取 2 張牌（不是按順序）
  // Draw first random card
  const randomIndex1 = Math.floor(Math.random() * newState.deck.length);
  const card1 = newState.deck.splice(randomIndex1, 1)[0];

  // Draw second random card (from remaining deck)
  const randomIndex2 = Math.floor(Math.random() * newState.deck.length);
  const card2 = newState.deck.splice(randomIndex2, 1)[0];

  const drawnCards = [card1, card2];
  const keptCard = drawnCards[keepCardIndex];
  const discardedCard = drawnCards[1 - keepCardIndex];

  // Add kept card to current player's hand
  const currentPlayer = newState.players[newState.currentPlayerIndex];
  currentPlayer.hand = [...currentPlayer.hand, keptCard];

  // Add discarded card to selected discard pile
  if (newState.discardPile1.length === 0) {
    newState.discardPile1.push(discardedCard);
  } else if (newState.discardPile2.length === 0) {
    newState.discardPile2.push(discardedCard);
  } else {
    // Both piles have cards, player can choose
    if (discardPileIndex === 0) {
      newState.discardPile1.push(discardedCard);
    } else {
      newState.discardPile2.push(discardedCard);
    }
  }

  // Mark that player has drawn this turn
  newState.hasDrawnThisTurn = true;

  return {
    updatedGameState: newState,
    drawnCards,
    keptCard,
    discardedCard,
  };
}
```

---

## ✅ 修正後的遊戲機制

### 抽牌
- ✅ 從牌庫**隨機**抽 2 張牌
- ✅ 玩家選擇保留 1 張
- ✅ 另 1 張放入選定的棄牌堆

### 棄牌堆
- ✅ 2 個共用棄牌堆
- ✅ 可以從任一棄牌堆拿最上面的牌
- ✅ 棄牌時可選擇放到哪個棄牌堆（如果兩個都不是空的）

---

## 🎯 待確認的問題

1. **起始手牌數量**: 每位玩家遊戲開始時有幾張手牌？
2. **deckTopIndex**: 既然是隨機抽牌，還需要 deckTopIndex 嗎？
   - 可能不需要，因為每次都是隨機抽取
   - 只需要記錄牌庫剩餘張數

---

**修正時間**: 2025-01-15  
**狀態**: ⏳ 等待確認後修正代碼
