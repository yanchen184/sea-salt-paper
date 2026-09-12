# 海鹽摺紙 - Firebase 後端設計文檔

> **目標讀者**: 後端工程師、Firebase 開發者、系統架構師
> **最後更新**: 2025-11-13
> **版本**: 1.2.0

---

## 📋 目錄

1. [架構概述](#架構概述)
2. [Firestore 資料結構](#firestore-資料結構)
3. [安全規則](#安全規則)
4. [雲函數](#雲函數)
5. [即時同步策略](#即時同步策略)
6. [性能優化](#性能優化)
7. [監控與日誌](#監控與日誌)
8. [備份與恢復](#備份與恢復)

---

## 🏗️ 架構概述

### 整體架構

```
┌─────────────────────────────────────────────────────────┐
│                    客戶端（React）                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │ Player1 │  │ Player2 │  │ Player3 │  │ Player4 │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │
└───────┼───────────┼───────────┼───────────┼──────────┘
        │           │           │           │
        └───────────┴───────────┴───────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│              Firebase Cloud（後端服務）                   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │          Firestore Database（NoSQL）              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │  │
│  │  │  rooms   │  │  games   │  │ history  │       │  │
│  │  │ 房間集合  │  │ 遊戲集合  │  │ 歷史集合  │       │  │
│  │  └──────────┘  └──────────┘  └──────────┘       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │          Cloud Functions（雲函數）                 │  │
│  │  • onRoomDelete - 清理遊戲資料                    │  │
│  │  • onGameEnd - 記錄遊戲歷史                       │  │
│  │  • cleanupOldRooms - 定期清理過期房間             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │          Security Rules（安全規則）                │  │
│  │  • 讀寫權限控制                                    │  │
│  │  • 資料驗證                                        │  │
│  │  • 防止作弊                                        │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 資料流向

#### 1. 創建房間流程

```
Player → createRoom() → Firestore (/rooms/{roomCode})
                            ↓
                    訂閱觸發通知所有玩家
```

#### 2. 遊戲狀態更新流程

```
Player → 執行操作 → gameRules.js 計算新狀態
                        ↓
                syncCompleteGameState()
                        ↓
            Firestore (/games/{roomCode})
                        ↓
        onSnapshot 觸發所有玩家訂閱
                        ↓
            各玩家更新本地 state
                        ↓
                React 重新渲染
```

### 技術選型理由

| 技術 | 用途 | 理由 |
|-----|------|------|
| Firestore | 主資料庫 | 即時同步、離線支援、自動擴展 |
| Cloud Functions | 後端邏輯 | 自動觸發、無需伺服器管理 |
| Security Rules | 安全控制 | 聲明式規則、無需後端代碼 |
| Realtime Updates | 即時同步 | onSnapshot 自動推送更新 |

---

## 🗄️ Firestore 資料結構

### 集合架構

```
firestore/
├── rooms/                           # 房間集合
│   └── {roomCode}/                  # 文檔 ID = 房間代碼
│       ├── code: string
│       ├── hostId: string
│       ├── status: string
│       ├── players: Array
│       ├── settings: Object
│       ├── createdAt: timestamp
│       └── lastActivityAt: timestamp
│
├── games/                           # 遊戲集合
│   └── {roomCode}/                  # 文檔 ID = 房間代碼
│       ├── deck: Array<Card>
│       ├── discardPile1: Array<Card>
│       ├── discardPile2: Array<Card>
│       ├── players: Array<Player>
│       ├── currentPlayerIndex: number
│       ├── roundNumber: number
│       ├── gamePhase: string
│       ├── hasDrawnThisTurn: boolean
│       ├── actionLog: Array<ActionLog>
│       └── lastUpdated: timestamp
│
├── history/                         # 遊戲歷史
│   └── {gameId}/                    # 文檔 ID = 自動生成
│       ├── roomCode: string
│       ├── players: Array
│       ├── winner: Object
│       ├── finalScores: Array
│       ├── duration: number
│       ├── totalRounds: number
│       ├── completedAt: timestamp
│       └── gameType: string
│
└── leaderboard/                     # 排行榜
    └── global/                      # 全局排行榜
        └── players: Array<{
            name: string,
            wins: number,
            gamesPlayed: number,
            totalScore: number,
            avgScore: number
        }>
```

### 詳細資料結構

#### 1. rooms/{roomCode}

```typescript
interface Room {
  code: string;              // 房間代碼（6位大寫字母+數字）
  hostId: string;            // 房主玩家 ID
  status: RoomStatus;        // 'waiting' | 'playing' | 'finished'
  players: Player[];         // 玩家列表
  settings: RoomSettings;    // 房間設置
  createdAt: string;         // ISO 時間戳
  lastActivityAt: string;    // 最後活動時間（用於清理）
}

type RoomStatus = 'waiting' | 'playing' | 'finished';

interface Player {
  id: string;                // 玩家 ID（UUID）
  name: string;              // 玩家名稱
  isHost: boolean;           // 是否為房主
  isReady: boolean;          // 是否準備
  isAI?: boolean;            // 是否為 AI
  aiDifficulty?: string;     // AI 難度（'easy' | 'medium' | 'hard'）
  joinedAt: string;          // 加入時間
}

interface RoomSettings {
  targetScore: number | 'auto';     // 目標分數
  startingHandSize: number;         // 起始手牌數（0-7）
  enableMermaidWin: boolean;        // 美人魚特殊勝利
  enableColorBonus: boolean;        // 顏色獎勵
  maxPlayers: number;               // 最大玩家數（2-4）
  aiPlayers: number;                // AI 玩家數量
  aiDifficulty: string;             // AI 難度
}
```

**索引配置**:
```javascript
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "rooms",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "lastActivityAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

#### 2. games/{roomCode}

```typescript
interface GameState {
  // 牌堆
  deck: Card[];                     // 剩餘牌堆
  discardPile1: Card[];             // 左棄牌堆
  discardPile2: Card[];             // 右棄牌堆

  // 玩家
  players: GamePlayer[];            // 遊戲中的玩家
  currentPlayerIndex: number;       // 當前玩家索引

  // 遊戲進度
  roundNumber: number;              // 回合數（從 1 開始）
  turnNumber: number;               // 輪次數
  gamePhase: GamePhase;             // 遊戲階段

  // 回合狀態
  hasDrawnThisTurn: boolean;        // 本回合是否已抽牌
  hasPlayedPairThisTurn: boolean;   // 本回合是否已打出配對

  // 宣告相關
  declaringPlayer: number | null;   // 宣告玩家索引
  declarationType: string | null;   // 'immediate' | 'lastChance'

  // 特殊狀態
  drawingState: DrawingState | null; // 抽牌中狀態
  actionLog: ActionLog[];           // 動作記錄（最多 50 條）

  // 元資料
  startedAt: string;                // 遊戲開始時間
  lastUpdated: string;              // 最後更新時間
}

type GamePhase =
  | 'playing'        // 遊戲進行中
  | 'declaring'      // 有玩家宣告
  | 'lastChance'     // 最後機會階段
  | 'roundEnd'       // 回合結束
  | 'gameOver';      // 遊戲結束

interface GamePlayer {
  id: string;
  name: string;
  hand: Card[];                     // 手牌
  playedPairs: [Card, Card][];      // 已打出的配對
  score: number;                    // 累計分數
  roundScore: number;               // 本回合分數
  isActive: boolean;
  isProtected: boolean;             // 最後機會保護
}

interface Card {
  id: string;                       // 卡牌類型 ID
  uniqueId: string;                 // 唯一 ID（用於去重）
  name: string;                     // 卡牌名稱
  type: CardType;                   // 卡牌類型
  value: number;                    // 分數
  color: string;                    // 顏色
  pairEffect?: string;              // 配對效果
  multiplierFor?: string;           // 倍增目標
  multiplierValue?: number;         // 倍增數值
  description?: string;             // 描述
}

type CardType = 'pairEffect' | 'collection' | 'mermaid' | 'multiplier';

interface DrawingState {
  playerId: string;                 // 正在抽牌的玩家 ID
  playerName: string;               // 玩家名稱
  isDrawing: boolean;               // 是否正在抽牌
}

interface ActionLog {
  id: number;                       // 唯一 ID（timestamp）
  player: string;                   // 玩家名稱
  action: string;                   // 動作描述
  icon: string;                     // 圖示
  timestamp: string;                // 時間戳（HH:mm:ss）
}
```

**資料大小估算**:
- 每張卡片：約 200 bytes
- 72 張卡牌：約 14.4 KB
- 完整遊戲狀態：約 30-50 KB
- 動作記錄（50條）：約 5 KB

**總計**: 每個遊戲文檔 < 100 KB

#### 3. history/{gameId}

```typescript
interface GameHistory {
  gameId: string;                   // 遊戲 ID
  roomCode: string;                 // 房間代碼
  players: HistoryPlayer[];         // 玩家列表
  winner: {
    playerId: string;
    playerName: string;
    finalScore: number;
  };
  finalScores: Array<{
    playerId: string;
    playerName: string;
    score: number;
    rank: number;
  }>;
  duration: number;                 // 遊戲時長（秒）
  totalRounds: number;              // 總回合數
  completedAt: string;              // 完成時間
  gameType: string;                 // 'standard' | 'custom'
  settings: RoomSettings;           // 遊戲設置
}

interface HistoryPlayer {
  id: string;
  name: string;
  isAI: boolean;
  finalScore: number;
  highestRoundScore: number;
  pairsPlayed: number;
}
```

---

## 🔒 安全規則

### firestore.rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ============================================
    // 輔助函數
    // ============================================

    // 檢查是否為房間成員
    function isRoomMember(roomCode) {
      let room = get(/databases/$(database)/documents/rooms/$(roomCode));
      return request.auth != null &&
             request.auth.uid in room.data.players.map(p => p.id);
    }

    // 檢查是否為房主
    function isRoomHost(roomCode) {
      let room = get(/databases/$(database)/documents/rooms/$(roomCode));
      return request.auth != null &&
             request.auth.uid == room.data.hostId;
    }

    // 驗證玩家名稱
    function isValidPlayerName(name) {
      return name is string &&
             name.size() >= 1 &&
             name.size() <= 20;
    }

    // ============================================
    // rooms 集合
    // ============================================

    match /rooms/{roomCode} {
      // 讀取：任何人都可以讀取房間資訊
      allow read: if true;

      // 創建：需要驗證房間代碼格式和玩家資訊
      allow create: if request.auth != null &&
                       roomCode.matches('^[A-Z0-9]{6}$') &&
                       request.resource.data.keys().hasAll([
                         'code', 'hostId', 'status', 'players', 'createdAt'
                       ]) &&
                       request.resource.data.hostId == request.auth.uid &&
                       request.resource.data.players.size() >= 1 &&
                       request.resource.data.players.size() <= 4 &&
                       isValidPlayerName(request.resource.data.players[0].name);

      // 更新：只有房間成員可以更新
      allow update: if isRoomMember(roomCode) &&
                       // 不能修改房間代碼和創建時間
                       request.resource.data.code == resource.data.code &&
                       request.resource.data.createdAt == resource.data.createdAt;

      // 刪除：只有房主可以刪除
      allow delete: if isRoomHost(roomCode);
    }

    // ============================================
    // games 集合
    // ============================================

    match /games/{roomCode} {
      // 讀取：只有房間成員可以讀取遊戲狀態
      allow read: if isRoomMember(roomCode);

      // 寫入：只有房間成員可以寫入
      // 注意：實際的遊戲邏輯驗證在客戶端進行
      // 這裡只做基本的權限檢查
      allow write: if isRoomMember(roomCode) &&
                      // 驗證必要欄位
                      request.resource.data.keys().hasAll([
                        'deck', 'players', 'currentPlayerIndex', 'roundNumber'
                      ]) &&
                      // 玩家數量不變
                      request.resource.data.players.size() == resource.data.players.size();
    }

    // ============================================
    // history 集合
    // ============================================

    match /history/{gameId} {
      // 讀取：任何人都可以讀取歷史記錄
      allow read: if true;

      // 創建：只能在雲函數中創建
      allow create: if false;

      // 更新、刪除：禁止
      allow update, delete: if false;
    }

    // ============================================
    // leaderboard 集合
    // ============================================

    match /leaderboard/{doc} {
      // 讀取：任何人都可以讀取
      allow read: if true;

      // 寫入：只能在雲函數中寫入
      allow write: if false;
    }
  }
}
```

### 安全規則測試

```javascript
// firestore.rules.test.js

const firebase = require('@firebase/rules-unit-testing');
const fs = require('fs');

describe('Firestore 安全規則測試', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await firebase.initializeTestEnvironment({
      projectId: 'demo-sea-salt-paper',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test('未認證用戶可以讀取房間', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await firebase.assertSucceeds(
      unauthedDb.collection('rooms').doc('TEST01').get()
    );
  });

  test('未認證用戶不能創建房間', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await firebase.assertFails(
      unauthedDb.collection('rooms').doc('TEST01').set({
        code: 'TEST01',
        hostId: 'user1',
        status: 'waiting',
      })
    );
  });

  test('房間成員可以讀取遊戲狀態', async () => {
    // 設置測試數據
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('rooms').doc('TEST01').set({
        code: 'TEST01',
        hostId: 'user1',
        players: [{ id: 'user1', name: 'Player1' }],
      });
    });

    const authedDb = testEnv.authenticatedContext('user1').firestore();
    await firebase.assertSucceeds(
      authedDb.collection('games').doc('TEST01').get()
    );
  });
});
```

---

## ⚡ 雲函數

### functions/index.js

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ============================================
// 1. 房間刪除時清理遊戲資料
// ============================================

exports.onRoomDelete = functions.firestore
  .document('rooms/{roomCode}')
  .onDelete(async (snapshot, context) => {
    const roomCode = context.params.roomCode;

    console.log(`清理房間 ${roomCode} 的遊戲資料`);

    try {
      // 刪除對應的遊戲文檔
      await db.collection('games').doc(roomCode).delete();

      console.log(`✓ 已清理房間 ${roomCode} 的遊戲資料`);
    } catch (error) {
      console.error(`✗ 清理失敗:`, error);
    }
  });

// ============================================
// 2. 遊戲結束時記錄歷史
// ============================================

exports.onGameEnd = functions.firestore
  .document('games/{roomCode}')
  .onUpdate(async (change, context) => {
    const roomCode = context.params.roomCode;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // 檢查遊戲是否剛結束
    if (beforeData.gamePhase !== 'gameOver' &&
        afterData.gamePhase === 'gameOver') {

      console.log(`遊戲 ${roomCode} 已結束，記錄歷史`);

      try {
        // 計算遊戲時長
        const startTime = new Date(afterData.startedAt);
        const endTime = new Date();
        const duration = Math.floor((endTime - startTime) / 1000);

        // 找到獲勝者
        const winner = afterData.players.reduce((prev, current) =>
          current.score > prev.score ? current : prev
        );

        // 準備歷史記錄
        const historyData = {
          gameId: `${roomCode}_${Date.now()}`,
          roomCode: roomCode,
          players: afterData.players.map(p => ({
            id: p.id,
            name: p.name,
            isAI: p.isAI || false,
            finalScore: p.score,
            pairsPlayed: p.playedPairs?.length || 0,
          })),
          winner: {
            playerId: winner.id,
            playerName: winner.name,
            finalScore: winner.score,
          },
          finalScores: afterData.players
            .sort((a, b) => b.score - a.score)
            .map((p, index) => ({
              playerId: p.id,
              playerName: p.name,
              score: p.score,
              rank: index + 1,
            })),
          duration: duration,
          totalRounds: afterData.roundNumber,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          gameType: 'standard',
        };

        // 儲存歷史記錄
        await db.collection('history').add(historyData);

        // 更新排行榜
        await updateLeaderboard(afterData.players);

        console.log(`✓ 已記錄遊戲 ${roomCode} 的歷史`);
      } catch (error) {
        console.error(`✗ 記錄歷史失敗:`, error);
      }
    }
  });

// 更新排行榜
async function updateLeaderboard(players) {
  const leaderboardRef = db.collection('leaderboard').doc('global');

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(leaderboardRef);

    let leaderboard = doc.exists ? doc.data().players || [] : [];

    // 更新每個玩家的統計
    players.forEach(player => {
      if (player.isAI) return; // 跳過 AI

      const existingPlayer = leaderboard.find(p => p.id === player.id);

      if (existingPlayer) {
        existingPlayer.gamesPlayed++;
        existingPlayer.totalScore += player.score;
        existingPlayer.avgScore = existingPlayer.totalScore / existingPlayer.gamesPlayed;

        // 檢查是否獲勝（最高分）
        const maxScore = Math.max(...players.map(p => p.score));
        if (player.score === maxScore) {
          existingPlayer.wins++;
        }
      } else {
        leaderboard.push({
          id: player.id,
          name: player.name,
          wins: player.score === Math.max(...players.map(p => p.score)) ? 1 : 0,
          gamesPlayed: 1,
          totalScore: player.score,
          avgScore: player.score,
        });
      }
    });

    // 排序（按勝場數和平均分數）
    leaderboard.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.avgScore - a.avgScore;
    });

    // 只保留前 100 名
    leaderboard = leaderboard.slice(0, 100);

    transaction.set(leaderboardRef, { players: leaderboard });
  });
}

// ============================================
// 3. 定期清理過期房間（每小時執行）
// ============================================

exports.cleanupOldRooms = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    console.log('開始清理過期房間');

    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

    try {
      // 查詢 1 小時前的房間
      const snapshot = await db.collection('rooms')
        .where('lastActivityAt', '<', oneHourAgo)
        .where('status', '!=', 'playing')
        .get();

      if (snapshot.empty) {
        console.log('沒有需要清理的房間');
        return null;
      }

      console.log(`找到 ${snapshot.size} 個過期房間`);

      // 批次刪除
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.log(`✓ 已清理 ${snapshot.size} 個過期房間`);
      return null;
    } catch (error) {
      console.error('✗ 清理失敗:', error);
      return null;
    }
  });

// ============================================
// 4. 生成遊戲統計報告（每天執行）
// ============================================

exports.generateDailyStats = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    console.log('生成每日統計報告');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      // 統計今日遊戲
      const snapshot = await db.collection('history')
        .where('completedAt', '>=', admin.firestore.Timestamp.fromDate(today))
        .where('completedAt', '<', admin.firestore.Timestamp.fromDate(tomorrow))
        .get();

      const stats = {
        date: today.toISOString().split('T')[0],
        totalGames: snapshot.size,
        totalPlayers: 0,
        avgDuration: 0,
        avgRounds: 0,
        topWinners: [],
      };

      const playerWins = {};
      let totalDuration = 0;
      let totalRounds = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        totalDuration += data.duration;
        totalRounds += data.totalRounds;
        stats.totalPlayers += data.players.length;

        const winnerId = data.winner.playerId;
        playerWins[winnerId] = (playerWins[winnerId] || 0) + 1;
      });

      stats.avgDuration = Math.round(totalDuration / snapshot.size);
      stats.avgRounds = Math.round(totalRounds / snapshot.size);

      // 前 10 名獲勝者
      stats.topWinners = Object.entries(playerWins)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([playerId, wins]) => ({ playerId, wins }));

      // 儲存統計
      await db.collection('stats').doc(stats.date).set(stats);

      console.log('✓ 已生成統計報告:', stats);
      return null;
    } catch (error) {
      console.error('✗ 生成統計失敗:', error);
      return null;
    }
  });
```

### 部署雲函數

```bash
# 安裝依賴
cd functions
npm install

# 部署所有函數
firebase deploy --only functions

# 部署特定函數
firebase deploy --only functions:onGameEnd

# 查看函數日誌
firebase functions:log

# 查看特定函數日誌
firebase functions:log --only onGameEnd
```

---

## 🔄 即時同步策略

### 訂閱管理

```javascript
// services/gameService.js

// 單一訂閱實例（避免重複訂閱）
let currentSubscription = null;

export function subscribeToGameState(roomCode, callback) {
  // 清理舊訂閱
  if (currentSubscription) {
    currentSubscription();
    currentSubscription = null;
  }

  const gameRef = doc(db, 'games', roomCode);

  // 創建新訂閱
  const unsubscribe = onSnapshot(
    gameRef,
    {
      // 包含元資料變更
      includeMetadataChanges: false,
    },
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();

        // 只在資料真正變更時觸發
        if (!snapshot.metadata.hasPendingWrites) {
          console.log('[Firebase] 收到伺服器更新');
          callback(data);
        } else {
          console.log('[Firebase] 本地寫入，跳過回調');
        }
      } else {
        console.warn('[Firebase] 遊戲文檔不存在');
        callback(null);
      }
    },
    (error) => {
      console.error('[Firebase] 訂閱錯誤:', error);
      callback(null);
    }
  );

  currentSubscription = unsubscribe;
  return unsubscribe;
}
```

### 樂觀更新策略

```javascript
// 立即更新本地 UI
setGameState(newGameState);

// 異步同步到 Firebase
syncCompleteGameState(roomCode, newGameState)
  .catch(error => {
    // 失敗時回滾
    console.error('同步失敗，回滾狀態', error);
    setGameState(previousGameState);
    setMessage('操作失敗，請重試');
  });
```

### 衝突解決

使用**最後寫入獲勝（Last Write Wins）**策略：

```javascript
// 每次更新都包含時間戳
const newGameState = {
  ...gameState,
  lastUpdated: new Date().toISOString(),
};

await syncCompleteGameState(roomCode, newGameState);
```

### 離線支援

```javascript
// 啟用離線持久化
import { enableIndexedDbPersistence } from 'firebase/firestore';

enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('多個分頁同時開啟，離線模式未啟用');
    } else if (err.code === 'unimplemented') {
      console.warn('瀏覽器不支援離線模式');
    }
  });
```

---

## ⚡ 性能優化

### 1. 減少讀取次數

#### 使用 onSnapshot 而非輪詢

```javascript
// ❌ 不好：每秒輪詢
setInterval(async () => {
  const snapshot = await getDoc(gameRef);
  updateUI(snapshot.data());
}, 1000);

// ✅ 好：使用即時監聽
onSnapshot(gameRef, (snapshot) => {
  updateUI(snapshot.data());
});
```

#### 批次讀取

```javascript
// ❌ 不好：多次讀取
const player1 = await getDoc(doc(db, 'players', 'id1'));
const player2 = await getDoc(doc(db, 'players', 'id2'));

// ✅ 好：批次讀取
const [player1, player2] = await Promise.all([
  getDoc(doc(db, 'players', 'id1')),
  getDoc(doc(db, 'players', 'id2')),
]);
```

### 2. 減少寫入次數

#### 批次更新

```javascript
// ❌ 不好：多次更新
await updateDoc(gameRef, { field1: value1 });
await updateDoc(gameRef, { field2: value2 });
await updateDoc(gameRef, { field3: value3 });

// ✅ 好：一次更新
await updateDoc(gameRef, {
  field1: value1,
  field2: value2,
  field3: value3,
});
```

#### 防抖動

```javascript
import { debounce } from 'lodash';

// 限制更新頻率（每 300ms 最多一次）
const debouncedSync = debounce(async (roomCode, gameState) => {
  await syncCompleteGameState(roomCode, gameState);
}, 300);
```

### 3. 資料壓縮

#### 移除不必要的欄位

```javascript
// 儲存前清理資料
function cleanGameState(gameState) {
  return {
    ...gameState,
    // 移除臨時狀態
    drawingState: null,
    // 限制動作記錄數量
    actionLog: gameState.actionLog.slice(0, 50),
  };
}
```

### 4. 索引優化

```javascript
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "history",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "completedAt", "order": "DESCENDING" },
        { "fieldPath": "winner.playerId", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 5. 快取策略

```javascript
// 使用 React Query 快取
import { useQuery } from 'react-query';

function useGameHistory(playerId) {
  return useQuery(
    ['gameHistory', playerId],
    async () => {
      const snapshot = await getDocs(
        query(
          collection(db, 'history'),
          where('players', 'array-contains', { id: playerId }),
          orderBy('completedAt', 'desc'),
          limit(10)
        )
      );
      return snapshot.docs.map(doc => doc.data());
    },
    {
      staleTime: 5 * 60 * 1000, // 5 分鐘內不重新獲取
      cacheTime: 10 * 60 * 1000, // 快取保留 10 分鐘
    }
  );
}
```

---

## 📊 監控與日誌

### Firebase 控制台監控

1. **即時資料庫監控**
   - 讀取/寫入次數
   - 活躍連接數
   - 資料傳輸量

2. **雲函數監控**
   - 執行次數
   - 錯誤率
   - 執行時間

3. **效能監控**
   - 頁面載入時間
   - 網路請求延遲
   - 應用崩潰率

### 自定義日誌

```javascript
// utils/logger.js

export const Logger = {
  info: (category, message, data) => {
    console.log(`[${category}] ${message}`, data);

    // 生產環境記錄到 Firebase Analytics
    if (import.meta.env.PROD) {
      logEvent(analytics, category, {
        message,
        ...data,
      });
    }
  },

  error: (category, message, error) => {
    console.error(`[${category}] ${message}`, error);

    // 生產環境記錄到 Firebase Crashlytics
    if (import.meta.env.PROD) {
      logEvent(analytics, 'error', {
        category,
        message,
        error: error.message,
        stack: error.stack,
      });
    }
  },
};

// 使用
Logger.info('GameBoard', '抽牌成功', { cardName: 'Fish' });
Logger.error('GameBoard', '同步失敗', error);
```

### 關鍵指標

| 指標 | 目標值 | 告警閾值 |
|-----|--------|---------|
| 讀取次數/天 | < 100,000 | 150,000 |
| 寫入次數/天 | < 50,000 | 75,000 |
| 雲函數錯誤率 | < 1% | 5% |
| 平均回應時間 | < 200ms | 500ms |
| 活躍用戶數 | - | - |

---

## 💾 備份與恢復

### 自動備份

```bash
# 安裝 gcloud CLI
# https://cloud.google.com/sdk/docs/install

# 認證
gcloud auth login

# 設定專案
gcloud config set project YOUR_PROJECT_ID

# 排程每日備份（凌晨 2 點）
gcloud scheduler jobs create app-engine backup-firestore \
  --schedule="0 2 * * *" \
  --uri="https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/backupFirestore" \
  --http-method=POST
```

### 手動備份

```bash
# 匯出整個資料庫
gcloud firestore export gs://YOUR_BUCKET_NAME/backup-$(date +%Y%m%d)

# 匯出特定集合
gcloud firestore export gs://YOUR_BUCKET_NAME/backup-$(date +%Y%m%d) \
  --collection-ids=rooms,games
```

### 恢復資料

```bash
# 從備份恢復
gcloud firestore import gs://YOUR_BUCKET_NAME/backup-20250113
```

### 雲函數備份

```javascript
// functions/backup.js

const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');

const storage = new Storage();
const db = admin.firestore();

exports.backupFirestore = functions.https.onRequest(async (req, res) => {
  const bucket = storage.bucket('YOUR_BUCKET_NAME');
  const timestamp = new Date().toISOString().split('T')[0];

  try {
    // 匯出所有集合
    const collections = ['rooms', 'games', 'history', 'leaderboard'];

    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).get();
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 儲存到 GCS
      const file = bucket.file(`backup-${timestamp}/${collectionName}.json`);
      await file.save(JSON.stringify(data, null, 2), {
        contentType: 'application/json',
      });

      console.log(`✓ 已備份 ${collectionName}: ${data.length} 筆`);
    }

    res.status(200).send('備份完成');
  } catch (error) {
    console.error('備份失敗:', error);
    res.status(500).send('備份失敗');
  }
});
```

---

## 🔧 開發與測試

### 本地模擬器

```bash
# 啟動 Firestore 模擬器
firebase emulators:start --only firestore

# 啟動所有模擬器（Firestore + Functions + Auth）
firebase emulators:start

# 查看模擬器 UI
# http://localhost:4000
```

### 連接到模擬器

```javascript
// config/firebase.js

import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const db = getFirestore(app);

// 開發環境連接模擬器
if (import.meta.env.DEV) {
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.log('🔧 連接到 Firestore 模擬器');
}
```

### 測試資料生成

```javascript
// scripts/seedData.js

import { db } from '../src/config/firebase';
import { doc, setDoc } from 'firebase/firestore';

async function seedTestData() {
  // 創建測試房間
  await setDoc(doc(db, 'rooms', 'TEST01'), {
    code: 'TEST01',
    hostId: 'player1',
    status: 'waiting',
    players: [
      { id: 'player1', name: 'Alice', isHost: true, isReady: false },
      { id: 'player2', name: 'Bob', isHost: false, isReady: true },
    ],
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  });

  console.log('✓ 測試資料已生成');
}

seedTestData();
```

---

## 📚 參考資源

- [Firebase 官方文檔](https://firebase.google.com/docs)
- [Firestore 最佳實踐](https://firebase.google.com/docs/firestore/best-practices)
- [安全規則指南](https://firebase.google.com/docs/firestore/security/get-started)
- [雲函數文檔](https://firebase.google.com/docs/functions)
- [效能監控](https://firebase.google.com/docs/perf-mon)

---

**最後更新**: 2025-11-13
**維護者**: 後端開發團隊
