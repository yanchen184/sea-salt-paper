# 海鹽摺紙 - 前端開發技術文檔

> **目標讀者**: 前端工程師、React 開發者
> **最後更新**: 2025-11-13
> **版本**: 1.2.0

---

## 📋 目錄

1. [技術棧](#技術棧)
2. [專案結構](#專案結構)
3. [核心功能實現](#核心功能實現)
4. [組件文檔](#組件文檔)
5. [狀態管理](#狀態管理)
6. [API 與服務](#api-與服務)
7. [遊戲邏輯](#遊戲邏輯)
8. [性能優化](#性能優化)
9. [測試策略](#測試策略)
10. [部署流程](#部署流程)

---

## 🛠️ 技術棧

### 核心技術

```json
{
  "react": "^18.2.0",
  "vite": "^5.0.0",
  "firebase": "^10.7.0"
}
```

### 開發工具

- **包管理器**: npm
- **建構工具**: Vite
- **程式碼風格**: ESLint + Prettier
- **版本控制**: Git

### 瀏覽器支援

- Chrome ≥ 90
- Firefox ≥ 88
- Safari ≥ 14
- Edge ≥ 90

---

## 📁 專案結構

```
sea-salt-paper/
├── public/                      # 靜態資源
│   └── vite.svg
├── src/
│   ├── components/              # React 組件
│   │   ├── HomePage.jsx         # 首頁
│   │   ├── HomePage.css
│   │   ├── RoomLobby.jsx        # 房間大廳
│   │   ├── RoomLobby.css
│   │   ├── GameBoard.jsx        # 遊戲主畫面（核心組件）
│   │   ├── GameOver.jsx         # 遊戲結束
│   │   ├── DeclarationModal.jsx # 宣告模態框
│   │   ├── AllPlayersDisplay.jsx # 所有玩家顯示
│   │   ├── GameActionLog.jsx    # 動作記錄
│   │   ├── GameActionLog.css
│   │   ├── GameDebugPanel.jsx   # 調試面板
│   │   ├── GameHistory.jsx      # 遊戲歷史
│   │   ├── GameInstructions.jsx # 遊戲說明
│   │   ├── Leaderboard.jsx      # 排行榜
│   │   ├── RoomSettings.jsx     # 房間設置
│   │   └── DeckViewer/          # 牌堆查看器
│   │       ├── index.jsx
│   │       └── DeckViewer.css
│   ├── data/                    # 遊戲資料定義
│   │   ├── cards.js             # 卡牌定義（72張）
│   │   ├── gameRules.js         # 遊戲規則邏輯
│   │   └── testInitialization.js # 測試初始化
│   ├── services/                # 服務層
│   │   ├── gameService.js       # 遊戲狀態管理（Firebase）
│   │   ├── aiService.js         # AI 邏輯
│   │   └── gameHistoryService.js # 遊戲歷史
│   ├── utils/                   # 工具函數
│   │   └── gameLogic.js         # 遊戲邏輯工具
│   ├── styles/                  # 全局樣式
│   │   ├── GameBoard.css        # 遊戲畫面樣式
│   │   └── RoomLobby.css
│   ├── config/                  # 配置文件
│   │   └── firebase.js          # Firebase 配置
│   ├── App.jsx                  # 根組件
│   ├── App.css                  # 全局樣式
│   ├── main.jsx                 # 入口文件
│   └── index.css                # 基礎樣式
├── .gitignore
├── package.json
├── vite.config.js               # Vite 配置
├── README.md                    # 專案說明
├── DESIGN_SPEC.md              # 設計規範
├── FRONTEND_SPEC.md            # 前端規範（本文檔）
└── FIREBASE_SPEC.md            # Firebase 規範
```

---

## 🎮 核心功能實現

### 1. 拖拽抽牌系統

#### 實現原理

使用 HTML5 Drag and Drop API 實現直覺的拖拽操作。

#### 關鍵代碼

```javascript
// GameBoard.jsx

// 1. 開始拖拽
const handleDragStart = (e, cardIndex) => {
  e.dataTransfer.effectAllowed = 'move';
  setDraggedCardIndex(cardIndex);
};

// 2. 拖拽經過目標區域
const handleDragOver = (e, pileIndex) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  setDragOverPile(pileIndex); // 高亮目標棄牌堆
};

// 3. 離開目標區域
const handleDragLeave = () => {
  setDragOverPile(null);
};

// 4. 放下卡片
const handleDrop = (e, pileIndex) => {
  e.preventDefault();
  setDragOverPile(null);

  if (draggedCardIndex !== null) {
    handleConfirmDrawSelection(draggedCardIndex, pileIndex);
  }
};

// 5. 確認抽牌選擇
const handleConfirmDrawSelection = async (draggedIndex, discardPileIndex) => {
  const keepCardIndex = draggedIndex === 0 ? 1 : 0;

  // 調用遊戲規則函數
  const result = drawFromDeck(
    gameState,
    keepCardIndex,
    discardPileIndex,
    drawnCards
  );

  // 同步到 Firebase
  await syncCompleteGameState(roomCode, result.updatedGameState);

  // 更新本地狀態
  setGameState(result.updatedGameState);
  setDrawnCards(null);
};
```

#### 狀態管理

```javascript
const [drawnCards, setDrawnCards] = useState(null); // 抽到的2張牌
const [draggedCardIndex, setDraggedCardIndex] = useState(null); // 0 或 1
const [dragOverPile, setDragOverPile] = useState(null); // 0 或 1
```

#### CSS 樣式

```css
/* 拖拽中的卡片 */
.drawn-card.dragging {
  opacity: 0.5;
  cursor: grabbing;
}

/* 被懸停的棄牌堆 */
.discard-pile.drag-over {
  border-color: var(--accent-blue);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
  transform: scale(1.05);
}
```

### 2. 卡片提示系統

#### 實現原理

使用 `setTimeout` 實現滑鼠懸停延遲顯示。

#### 關鍵代碼

```javascript
// GameBoard.jsx

const [hoveredCard, setHoveredCard] = useState(null);
const [hoverTimer, setHoverTimer] = useState(null);
const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

// 滑鼠進入卡片
const handleCardHover = (card, e) => {
  setMousePosition({ x: e.clientX, y: e.clientY });

  // 清除之前的計時器
  if (hoverTimer) {
    clearTimeout(hoverTimer);
  }

  // 設置新計時器：2秒後顯示提示
  const timer = setTimeout(() => {
    setHoveredCard(card);
  }, 2000);

  setHoverTimer(timer);
};

// 滑鼠移動（更新位置）
const handleCardMouseMove = (e) => {
  if (hoveredCard) {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }
};

// 滑鼠離開卡片
const handleCardLeave = () => {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
  }
  setHoveredCard(null);
};

// 渲染提示框
{hoveredCard && (
  <div
    className="card-tooltip-simple"
    style={{
      left: `${mousePosition.x + 15}px`,
      top: `${mousePosition.y + 15}px`,
    }}
  >
    {hoveredCard.pairEffect && (
      <>
        {hoveredCard.pairEffect === 'blindDraw' && '配對效果: 盲抽牌庫頂1張牌'}
        {hoveredCard.pairEffect === 'pickDiscard' && '配對效果: 從棄牌堆選擇任意1張牌'}
        {/* ... */}
      </>
    )}
    {!hoveredCard.pairEffect && hoveredCard.description}
  </div>
)}
```

### 3. 即時動作記錄

#### 資料結構

```javascript
// gameState.actionLog 格式
actionLog: [
  {
    id: 1699876543210,
    player: "玩家A",
    action: "從牌堆抽牌",
    icon: "🎴",
    timestamp: "14:30:43"
  },
  // ...最多保留50條
]
```

#### 添加記錄

```javascript
// GameBoard.jsx

const addActionLog = async (action) => {
  const timestamp = new Date().toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const newAction = {
    ...action,
    timestamp,
    id: Date.now()
  };

  // 更新 gameState
  const updatedGameState = {
    ...gameState,
    actionLog: [newAction, ...(gameState.actionLog || [])].slice(0, 50)
  };

  // 同步到 Firebase
  await syncCompleteGameState(roomCode, updatedGameState);
  setGameState(updatedGameState);
};

// 使用範例
await addActionLog({
  player: myPlayer.name,
  action: `留下 ${keptCard.name}，棄置 ${discardedCard.name}`,
  icon: '✅'
});
```

#### GameActionLog 組件

```javascript
// GameActionLog.jsx

export default function GameActionLog({ gameState, players }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const logEndRef = useRef(null);

  // 從 gameState 獲取記錄
  const actions = gameState?.actionLog || [];

  // 自動滾動到最新
  useEffect(() => {
    if (!isCollapsed && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [actions.length, isCollapsed]);

  return (
    <div className={`action-log ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="action-log-header">
        <h3>📜 動作記錄 ({actions.length})</h3>
        <button onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="action-log-content">
          {actions.map((action, index) => (
            <div key={action.id || index} className="action-item">
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
  );
}
```

### 4. 配對驗證系統

#### 卡牌定義

```javascript
// data/cards.js

export const CARD_TYPES = {
  PAIR_EFFECT: 'pairEffect',   // 配對效果牌
  COLLECTION: 'collection',     // 集合牌
  MERMAID: 'mermaid',          // 美人魚
  MULTIPLIER: 'multiplier',    // 倍增牌
};

// 配對驗證函數
export function isValidPair(card1, card2) {
  if (!card1 || !card2) return false;

  // 相同卡片 ID
  if (card1.id === card2.id) {
    // 只有配對效果牌可以配對
    return card1.type === CARD_TYPES.PAIR_EFFECT;
  }

  // 特殊配對：鯊魚 + 游泳者
  if ((card1.id === 'shark' && card2.id === 'swimmer') ||
      (card1.id === 'swimmer' && card2.id === 'shark')) {
    return true;
  }

  return false;
}
```

#### 查找有效配對

```javascript
// utils/gameLogic.js

export function findValidPairs(hand) {
  const pairs = [];

  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (isValidPair(hand[i], hand[j])) {
        pairs.push({ index1: i, index2: j });
      }
    }
  }

  return pairs;
}
```

#### 打出配對

```javascript
// GameBoard.jsx

const handlePlayPair = async () => {
  if (selectedCardIndices.length !== 2) {
    setMessage('請選擇 2 張卡牌');
    return;
  }

  const card1 = myHand[selectedCardIndices[0]];
  const card2 = myHand[selectedCardIndices[1]];

  // 驗證配對
  const isValid = validPairs.some(
    pair => (pair.index1 === selectedCardIndices[0] &&
             pair.index2 === selectedCardIndices[1]) ||
            (pair.index1 === selectedCardIndices[1] &&
             pair.index2 === selectedCardIndices[0])
  );

  if (!isValid) {
    setMessage(`這不是有效的配對! (${card1.name} + ${card2.name})`);
    return;
  }

  try {
    setLoading(true);

    // 調用遊戲規則
    const result = playPair(gameState, selectedCardIndices);
    const { updatedGameState, playedPair, effect } = result;

    // 同步到 Firebase
    await syncCompleteGameState(roomCode, updatedGameState);
    setGameState(updatedGameState);

    // 記錄動作
    await addActionLog({
      player: myPlayer.name,
      action: `打出配對 ${playedPair[0].name} + ${playedPair[1].name}`,
      icon: '⚡'
    });

    // 處理配對效果
    switch (effect) {
      case 'blindDraw':
        // 盲抽邏輯
        break;
      case 'pickDiscard':
        // 選牌邏輯
        break;
      case 'extraTurn':
        // 額外回合
        break;
      case 'steal':
        // 偷牌邏輯
        break;
    }
  } catch (error) {
    console.error('[handlePlayPair] 失敗:', error);
    setMessage('打出配對失敗: ' + error.message);
  } finally {
    setLoading(false);
  }
};
```

### 5. 分數計算系統

#### 計分公式

```javascript
// data/cards.js

export function calculateHandScore(hand) {
  if (!hand || hand.length === 0) {
    return {
      total: 0,
      breakdown: {}
    };
  }

  let baseScore = 0;
  let multiplierBonus = 0;
  let mermaidScore = 0;

  const cardCounts = {};    // 每種卡片的數量
  const colorCounts = {};   // 每種顏色的數量
  let mermaidCount = 0;

  // 1. 統計卡片
  hand.forEach(card => {
    cardCounts[card.id] = (cardCounts[card.id] || 0) + 1;

    // 統計顏色（排除倍增牌和美人魚）
    if (card.type !== CARD_TYPES.MULTIPLIER &&
        card.type !== CARD_TYPES.MERMAID) {
      colorCounts[card.color] = (colorCounts[card.color] || 0) + 1;
    }

    // 美人魚計數
    if (card.type === CARD_TYPES.MERMAID) {
      mermaidCount++;
    } else if (card.type !== CARD_TYPES.MULTIPLIER) {
      // 基礎分數
      baseScore += card.value;
    }
  });

  // 2. 計算倍增獎勵
  hand.forEach(card => {
    if (card.type === CARD_TYPES.MULTIPLIER) {
      const targetCount = cardCounts[card.multiplierFor] || 0;
      const multiplierValue = card.multiplierValue || 1;
      multiplierBonus += targetCount * multiplierValue;
    }
  });

  // 3. 計算美人魚分數
  // 每張美人魚 = 第 N 多顏色的張數
  if (mermaidCount > 0) {
    const colorCountsArray = Object.values(colorCounts)
      .sort((a, b) => b - a);
    for (let i = 0; i < mermaidCount; i++) {
      mermaidScore += colorCountsArray[i] || 0;
    }
  }

  // 4. 顏色獎勵（最多顏色的張數）
  const maxColorCount = Math.max(...Object.values(colorCounts), 0);

  // 5. 總分
  const total = baseScore + multiplierBonus + mermaidScore + maxColorCount;

  return {
    total,
    breakdown: {
      baseScore,
      multiplierBonus,
      mermaidScore,
      colorBonus: maxColorCount,
      cardCounts,
      colorCounts,
      mermaidCount,
    },
  };
}
```

#### 分數詳情模態框

```javascript
// GameBoard.jsx

{showScoreDetail && (
  <div className="modal-overlay" onClick={() => setShowScoreDetail(false)}>
    <div className="score-detail-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>💰 分數來源詳情</h2>
        <button onClick={() => setShowScoreDetail(false)}>✕</button>
      </div>

      <div className="score-detail-content">
        {/* 手牌明細 */}
        <div className="score-section">
          <h3>📋 手牌明細 ({myHand.length} 張)</h3>
          <div className="cards-list-detail">
            {myHand.map((card, idx) => (
              <div key={idx} className="card-detail-item">
                <span className={`card-name-badge card-color-${card.color}`}>
                  {card.name}
                </span>
                <span className="card-points">{card.value} 分</span>
              </div>
            ))}
          </div>
        </div>

        {/* 分數計算 */}
        <div className="score-section">
          <h3>🧮 分數計算</h3>
          <div className="score-breakdown">
            <div className="score-row">
              <span>基礎分數:</span>
              <span>{myScore.breakdown?.baseScore || 0} 分</span>
            </div>

            {myScore.breakdown?.multiplierBonus > 0 && (
              <div className="score-row score-highlight">
                <div className="score-row-detail">
                  <span>倍增牌加成:</span>
                  <span className="score-hint">
                    {myHand.filter(c => c.type === 'multiplier').map(m =>
                      `${m.name}: ${myScore.breakdown?.cardCounts[m.multiplierFor] || 0}張`
                    ).join(', ')}
                  </span>
                </div>
                <span>+{myScore.breakdown?.multiplierBonus} 分</span>
              </div>
            )}

            {/* 美人魚、顏色獎勵等... */}
          </div>
        </div>

        {/* 總分 */}
        <div className="score-total-section">
          <div className="score-total-row">
            <span>總分:</span>
            <span className="total-score">{myScore.total} 分</span>
          </div>
          <div className="score-formula">
            = 基礎 {myScore.breakdown?.baseScore || 0}
            {myScore.breakdown?.multiplierBonus > 0 &&
              ` + 倍增 ${myScore.breakdown.multiplierBonus}`}
            {/* ... */}
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

---

## 📦 組件文檔

### App.jsx（根組件）

**職責**: 路由管理、全局狀態

```javascript
import { useState } from 'react';
import HomePage from './components/HomePage';
import RoomLobby from './components/RoomLobby';
import GameBoard from './components/GameBoard';
import GameOver from './components/GameOver';

export default function App() {
  const [view, setView] = useState('home');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState([]);
  const [gameOverData, setGameOverData] = useState(null);

  // 視圖切換邏輯
  const renderView = () => {
    switch (view) {
      case 'home':
        return <HomePage
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />;
      case 'lobby':
        return <RoomLobby
          roomCode={roomCode}
          playerId={playerId}
          playerName={playerName}
          onStartGame={() => setView('game')}
          onBack={() => setView('home')}
        />;
      case 'game':
        return <GameBoard
          roomCode={roomCode}
          playerId={playerId}
          playerName={playerName}
          players={players}
          onGameOver={handleGameOver}
          onBack={() => setView('lobby')}
        />;
      case 'gameOver':
        return <GameOver
          data={gameOverData}
          onPlayAgain={() => setView('lobby')}
          onExit={() => setView('home')}
        />;
      default:
        return <HomePage />;
    }
  };

  return <div className="app">{renderView()}</div>;
}
```

### HomePage.jsx（首頁）

**Props**:
- `onCreateRoom: () => void` - 創建房間回調
- `onJoinRoom: (roomCode: string) => void` - 加入房間回調

**State**:
```javascript
const [playerName, setPlayerName] = useState('');
const [roomCodeInput, setRoomCodeInput] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
```

**關鍵方法**:
```javascript
const handleCreateRoom = async () => {
  if (!playerName.trim()) {
    setError('請輸入玩家名稱');
    return;
  }

  setLoading(true);
  try {
    // 生成房間代碼
    const roomCode = generateRoomCode();

    // 創建 Firebase 房間
    await createRoom(roomCode, playerName);

    // 回調父組件
    onCreateRoom(roomCode, playerId, playerName);
  } catch (error) {
    setError('創建房間失敗: ' + error.message);
  } finally {
    setLoading(false);
  }
};
```

### RoomLobby.jsx（房間大廳）

**Props**:
- `roomCode: string` - 房間代碼
- `playerId: string` - 玩家 ID
- `playerName: string` - 玩家名稱
- `onStartGame: () => void` - 開始遊戲回調
- `onBack: () => void` - 返回首頁回調

**State**:
```javascript
const [roomState, setRoomState] = useState(null);
const [players, setPlayers] = useState([]);
const [isHost, setIsHost] = useState(false);
const [showSettings, setShowSettings] = useState(false);
```

**Firebase 訂閱**:
```javascript
useEffect(() => {
  if (!roomCode) return;

  const unsubscribe = subscribeToRoomState(roomCode, (updatedRoom) => {
    setRoomState(updatedRoom);
    setPlayers(updatedRoom.players || []);
    setIsHost(updatedRoom.hostId === playerId);

    // 遊戲開始，切換到遊戲畫面
    if (updatedRoom.status === 'playing') {
      onStartGame();
    }
  });

  return () => unsubscribe();
}, [roomCode, playerId]);
```

### GameBoard.jsx（遊戲畫面）⭐ 核心組件

**Props**:
- `roomCode: string`
- `playerId: string`
- `playerName: string`
- `players: Array`
- `onGameOver: (data) => void`
- `onBack: () => void`

**State**（完整列表）:
```javascript
const [gameState, setGameState] = useState(null);
const [loading, setLoading] = useState(true);
const [message, setMessage] = useState('');
const [selectedCardIndices, setSelectedCardIndices] = useState([]);
const [drawnCards, setDrawnCards] = useState(null);
const [draggedCardIndex, setDraggedCardIndex] = useState(null);
const [dragOverPile, setDragOverPile] = useState(null);
const [showDeclarationModal, setShowDeclarationModal] = useState(false);
const [showDeckViewer, setShowDeckViewer] = useState(false);
const [showScoreDetail, setShowScoreDetail] = useState(false);
const [hoveredCard, setHoveredCard] = useState(null);
const [hoverTimer, setHoverTimer] = useState(null);
const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
const [handPanelSize, setHandPanelSize] = useState({ width: 1000, height: 200 });
```

**核心方法**（見上文實現細節）:
- `handleInitiateDraw()` - 開始抽牌
- `handleConfirmDrawSelection()` - 確認抽牌選擇
- `handleTakeFromDiscard()` - 從棄牌堆拿牌
- `handlePlayPair()` - 打出配對
- `handleEndTurn()` - 結束回合
- `handleDeclare()` - 宣告結束
- `addActionLog()` - 添加動作記錄

**組件結構**:
```jsx
<div className="game-board">
  {/* 頂部導航 */}
  <div className="game-header">...</div>

  {/* 訊息提示 */}
  {message && <div className="game-message">...</div>}

  <div className="game-layout-wrapper">
    {/* 對手區域 */}
    <div className="opponents-area">...</div>

    {/* 桌面區域 */}
    <div className="table-area">
      {/* 左棄牌堆 */}
      <div className="discard-left">...</div>

      {/* 中央牌堆 */}
      <div className="deck-area">
        {drawnCards ? <DrawCards /> : <DeckButtons />}
      </div>

      {/* 右棄牌堆 */}
      <div className="discard-right">...</div>
    </div>

    {/* 我的手牌區域 */}
    <div className="my-area">
      {/* 已打出配對 */}
      {myPlayer.playedPairs?.length > 0 && <PlayedPairs />}

      {/* 手牌 */}
      <div className="hand-container">...</div>

      {/* 操作按鈕 */}
      <div className="action-buttons">...</div>
    </div>
  </div>

  {/* 模態框 */}
  {showDeclarationModal && <DeclarationModal />}
  {showDeckViewer && <DeckViewer />}
  {showScoreDetail && <ScoreDetailModal />}

  {/* 動作記錄 */}
  <GameActionLog gameState={gameState} />
</div>
```

---

## 🔄 狀態管理

### GameState 資料結構

```typescript
interface GameState {
  // 牌堆
  deck: Card[];                    // 剩餘牌堆
  discardPile1: Card[];            // 左棄牌堆
  discardPile2: Card[];            // 右棄牌堆

  // 玩家
  players: Player[];               // 所有玩家
  currentPlayerIndex: number;      // 當前玩家索引

  // 遊戲狀態
  roundNumber: number;             // 回合數
  turnNumber: number;              // 輪次數
  gamePhase: string;               // 'playing' | 'declaring' | 'roundEnd'
  hasDrawnThisTurn: boolean;       // 本回合是否已抽牌
  hasPlayedPairThisTurn: boolean;  // 本回合是否已打出配對

  // 宣告相關
  declaringPlayer: number | null;  // 宣告玩家索引
  declarationType: string | null;  // 'immediate' | 'lastChance'

  // 抽牌狀態（用於多玩家同步）
  drawingState: {
    playerId: string;
    playerName: string;
    isDrawing: boolean;
  } | null;

  // 動作記錄
  actionLog: ActionLog[];          // 最多50條
}

interface Player {
  id: string;
  name: string;
  hand: Card[];                    // 手牌
  playedPairs: Card[][];           // 已打出的配對
  score: number;                   // 累計分數
  roundScore: number;              // 本回合分數
  isActive: boolean;
  isProtected: boolean;            // 最後機會保護
}

interface Card {
  id: string;                      // 'fish' | 'crab' | ...
  uniqueId: string;                // 'fish_0' | 'fish_1' | ...
  name: string;                    // '魚'
  type: string;                    // 'pairEffect' | 'collection' | ...
  value: number;                   // 分數
  color: string;                   // 'blue' | 'red' | ...
  pairEffect?: string;             // 'blindDraw' | 'pickDiscard' | ...
  multiplierFor?: string;          // 倍增目標
  multiplierValue?: number;        // 倍增數值
  description?: string;            // 描述
}

interface ActionLog {
  id: number;
  player: string;
  action: string;
  icon: string;
  timestamp: string;
}
```

### 狀態更新流程

```
使用者操作
    ↓
組件處理函數（handleXxx）
    ↓
調用遊戲規則函數（gameRules.js）
    ↓
獲得新的 gameState
    ↓
同步到 Firebase（syncCompleteGameState）
    ↓
Firebase 觸發訂閱
    ↓
所有玩家收到更新（subscribeToGameState）
    ↓
更新本地 state（setGameState）
    ↓
React 重新渲染
```

---

## 🔌 API 與服務

### Firebase 服務（gameService.js）

#### 創建房間

```javascript
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function createRoom(roomCode, hostName) {
  const roomRef = doc(db, 'rooms', roomCode);

  const roomData = {
    code: roomCode,
    hostId: generatePlayerId(),
    status: 'waiting',  // 'waiting' | 'playing' | 'finished'
    players: [{
      id: generatePlayerId(),
      name: hostName,
      isHost: true,
      isReady: false,
    }],
    createdAt: new Date().toISOString(),
    settings: {
      targetScore: 'auto',
      startingHandSize: 0,
      enableMermaidWin: true,
      enableColorBonus: true,
      maxPlayers: 4,
    }
  };

  await setDoc(roomRef, roomData);
  return roomData;
}
```

#### 加入房間

```javascript
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

export async function joinRoom(roomCode, playerName) {
  const roomRef = doc(db, 'rooms', roomCode);

  const newPlayer = {
    id: generatePlayerId(),
    name: playerName,
    isHost: false,
    isReady: false,
  };

  await updateDoc(roomRef, {
    players: arrayUnion(newPlayer)
  });

  return newPlayer;
}
```

#### 訂閱房間狀態

```javascript
import { doc, onSnapshot } from 'firebase/firestore';

export function subscribeToRoomState(roomCode, callback) {
  const roomRef = doc(db, 'rooms', roomCode);

  const unsubscribe = onSnapshot(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    } else {
      callback(null);
    }
  });

  return unsubscribe;
}
```

#### 訂閱遊戲狀態

```javascript
export function subscribeToGameState(roomCode, callback) {
  const gameRef = doc(db, 'games', roomCode);

  const unsubscribe = onSnapshot(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    }
  });

  return unsubscribe;
}
```

#### 同步遊戲狀態

```javascript
import { doc, setDoc } from 'firebase/firestore';

export async function syncCompleteGameState(roomCode, gameState) {
  const gameRef = doc(db, 'games', roomCode);

  await setDoc(gameRef, {
    ...gameState,
    lastUpdated: new Date().toISOString()
  });
}
```

---

## ⚡ 性能優化

### 1. React 優化

#### useMemo 緩存計算

```javascript
// 緩存有效配對列表
const validPairs = useMemo(() => {
  return findValidPairs(myHand);
}, [myHand]);

// 緩存分數計算
const myScore = useMemo(() => {
  return calculateHandScore(myHand);
}, [myHand]);
```

#### useCallback 緩存函數

```javascript
const handleCardClick = useCallback((index) => {
  if (!isCurrentPlayer || loading) return;

  setSelectedCardIndices(prev => {
    if (prev.includes(index)) {
      return prev.filter(i => i !== index);
    }

    if (prev.length === 1) {
      const firstCard = myHand[prev[0]];
      const secondCard = myHand[index];

      if (isValidPair(firstCard, secondCard)) {
        return [...prev, index];
      } else {
        setMessage('這兩張牌無法配對');
        return [index];
      }
    }

    return [index];
  });
}, [isCurrentPlayer, loading, myHand]);
```

### 2. Firebase 優化

#### 批次更新

```javascript
// 不好：多次更新
await updateDoc(gameRef, { field1: value1 });
await updateDoc(gameRef, { field2: value2 });
await updateDoc(gameRef, { field3: value3 });

// 好：一次更新
await updateDoc(gameRef, {
  field1: value1,
  field2: value2,
  field3: value3
});
```

#### 限制訂閱範圍

```javascript
// 不好：訂閱整個集合
onSnapshot(collection(db, 'games'), callback);

// 好：只訂閱特定文檔
onSnapshot(doc(db, 'games', roomCode), callback);
```

### 3. CSS 優化

#### 使用 transform 代替 top/left

```css
/* 不好 */
.card:hover {
  top: -10px;
}

/* 好 */
.card:hover {
  transform: translateY(-10px);
}
```

#### 減少重繪

```css
/* 使用 will-change 提示瀏覽器 */
.card {
  will-change: transform, opacity;
}

/* 使用 GPU 加速 */
.card {
  transform: translateZ(0);
}
```

---

## 🧪 測試策略

### 單元測試（Jest）

```javascript
// __tests__/gameLogic.test.js

import { isValidPair, calculateHandScore } from '../data/cards';

describe('isValidPair', () => {
  test('相同魚卡可以配對', () => {
    const fish1 = { id: 'fish', type: 'pairEffect' };
    const fish2 = { id: 'fish', type: 'pairEffect' };
    expect(isValidPair(fish1, fish2)).toBe(true);
  });

  test('鯊魚和游泳者可以配對', () => {
    const shark = { id: 'shark', type: 'pairEffect' };
    const swimmer = { id: 'swimmer', type: 'pairEffect' };
    expect(isValidPair(shark, swimmer)).toBe(true);
  });

  test('不同集合牌不能配對', () => {
    const shell = { id: 'shell', type: 'collection' };
    const starfish = { id: 'starfish', type: 'collection' };
    expect(isValidPair(shell, starfish)).toBe(false);
  });
});

describe('calculateHandScore', () => {
  test('空手牌分數為0', () => {
    const result = calculateHandScore([]);
    expect(result.total).toBe(0);
  });

  test('基礎分數計算正確', () => {
    const hand = [
      { id: 'fish', type: 'pairEffect', value: 1, color: 'blue' },
      { id: 'fish', type: 'pairEffect', value: 1, color: 'blue' }
    ];
    const result = calculateHandScore(hand);
    // 基礎2分 + 顏色獎勵2分
    expect(result.total).toBe(4);
  });
});
```

### 組件測試（React Testing Library）

```javascript
// __tests__/GameBoard.test.jsx

import { render, screen, fireEvent } from '@testing-library/react';
import GameBoard from '../components/GameBoard';

describe('GameBoard', () => {
  test('顯示當前玩家指示', () => {
    render(
      <GameBoard
        roomCode="TEST"
        playerId="player1"
        playerName="測試玩家"
        players={[]}
      />
    );

    expect(screen.getByText('你的回合')).toBeInTheDocument();
  });

  test('點擊抽牌按鈕觸發抽牌', async () => {
    const { getByText } = render(<GameBoard {...props} />);

    const drawBtn = getByText('抽牌');
    fireEvent.click(drawBtn);

    // 應該顯示2張卡片
    await screen.findByText(/拖曳一張牌到棄牌堆/);
  });
});
```

### E2E 測試（Playwright/Cypress）

```javascript
// e2e/game-flow.spec.js

describe('完整遊戲流程', () => {
  it('可以創建房間並開始遊戲', () => {
    cy.visit('/');

    // 輸入玩家名稱
    cy.get('input[placeholder="輸入你的名字"]').type('玩家1');

    // 創建房間
    cy.get('button').contains('創建房間').click();

    // 應該進入房間大廳
    cy.url().should('include', '/lobby');

    // 開始遊戲
    cy.get('button').contains('開始遊戲').click();

    // 應該進入遊戲畫面
    cy.url().should('include', '/game');

    // 應該顯示手牌區域
    cy.get('.my-area').should('be.visible');
  });
});
```

---

## 🚀 部署流程

### 1. 建構生產版本

```bash
# 安裝依賴
npm install

# 建構
npm run build

# 預覽
npm run preview
```

### 2. Firebase Hosting 部署

```bash
# 安裝 Firebase CLI
npm install -g firebase-tools

# 登入
firebase login

# 初始化
firebase init hosting

# 選擇：
# - dist 作為 public 目錄
# - 配置為單頁應用（重寫所有 URL 到 /index.html）
# - 不覆蓋 index.html

# 部署
firebase deploy --only hosting
```

### 3. 環境變數

創建 `.env` 文件：

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

在代碼中使用：

```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

---

## 🐛 常見問題

### 問題 1: 抽牌後狀態不更新

**原因**: Firebase 訂閱可能有延遲

**解決方案**:
```javascript
// 立即更新本地狀態
setGameState(updatedGameState);

// 同時同步到 Firebase
await syncCompleteGameState(roomCode, updatedGameState);
```

### 問題 2: 卡片配對驗證失敗

**檢查清單**:
- [ ] 卡片的 `type` 是否為 `'pairEffect'`
- [ ] `isValidPair` 函數邏輯是否正確
- [ ] 卡片的 `id` 是否匹配

**調試方法**:
```javascript
console.log('[配對驗證] Card1:', {
  id: card1.id,
  type: card1.type
});
console.log('[配對驗證] Card2:', {
  id: card2.id,
  type: card2.type
});
console.log('[配對驗證] 結果:', isValidPair(card1, card2));
```

### 問題 3: 動作記錄不顯示

**檢查**:
- [ ] `gameState.actionLog` 是否存在
- [ ] `addActionLog` 是否正確同步到 Firebase
- [ ] `GameActionLog` 組件是否正確訂閱

---

## 📚 開發資源

- [React 官方文檔](https://react.dev/)
- [Vite 文檔](https://vitejs.dev/)
- [Firebase 文檔](https://firebase.google.com/docs)
- [MDN Web Docs](https://developer.mozilla.org/)

---

**最後更新**: 2025-11-13
**維護者**: 前端開發團隊
