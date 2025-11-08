# 🎮 海鹽紙雕 - Sea Salt & Paper Online

一個用 React + Firebase 構建的多人實時卡牌遊戲。完整實現了原始海鹽紙雕桌遊的核心機制，支持 2-4 人網絡對戰。

## 🌟 遊戲特色

✨ **完整遊戲機制**
- 收集卡組 + 效果連動 + 搶先喊停
- 配對卡牌觸發特殊效果
- 策略性喊停和追擊系統

🔄 **實時同步**
- Firebase Firestore 實時數據同步
- 多人即時對戰體驗
- 玩家狀態實時更新

🌈 **精美設計**
- 響應式 UI 設計
- 流暢的動畫效果
- 支持桌面和手機設備

## 🚀 快速開始

### 前置要求
- Node.js 14+ 
- npm 或 yarn
- Firebase 帳戶

### Step 1: 安裝依賴

```bash
npm install
```

### Step 2: 設置 Firebase

1. 複製 `.env.example` 創建 `.env.local`
2. 填入你的 Firebase 配置

### Step 3: 運行開發服務器

```bash
npm run dev
```

## 📖 遊戲規則

### 配對卡牌效果
- 🐠 **魚** - 從牌堆抽 2 張，選 1 張留手
- 🦀 **螃蟹** - 從棄牌堆最上層拿 1 張進手牌
- 🐴 **海馬** - 跟任意玩家手牌交換 1 張
- ⛵ **船** - 額外再執行一次你的回合
- 👨‍⚓️ **水手** - 看任意玩家手牌

### 遊戲目標
- 2 人: 40 分
- 3-4 人: 35 分

## 🛠️ 技術棧

- React 18
- Firebase Firestore
- Vite
- CSS 3

## 📝 License

MIT
