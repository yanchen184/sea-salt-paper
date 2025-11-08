# 海鹽紙雕 - Sea Salt & Paper Online

一個用 React + Firebase 構建的多人線上卡牌遊戲

## 🚀 快速開始 (3 步)

### Step 1: Clone 或 Download
```bash
# Clone 方式
git clone https://github.com/yanchen184/sea-salt-paper.git

# 或直接下載 ZIP
# 點擊 GitHub 上的 Code → Download ZIP
```

### Step 2: 安裝依賴
```bash
cd sea-salt-paper
npm install
```

### Step 3: 運行
```bash
npm run dev
```

打開 http://localhost:3000 開始遊戲！

## 📖 詳細文檔

- **QUICKSTART.md** - 5分鐘快速指南
- **FIREBASE_SETUP.md** - Firebase 詳細設置  
- **DELIVERY_CHECKLIST.md** - 完整功能清單
- **PROJECT_COMPLETE.md** - 項目完成總結

## 🎮 遊戲特色

✨ 2-8 人即時多人對戰
🎴 完整海鹽紙雕規則 (58張卡牌)
🔥 Firebase 實時同步
🌈 美觀響應式設計
📱 支持桌面和手機

## 🔧 技術棧

- React 18
- Firebase (Firestore)
- Vite
- CSS3

## 📝 遊戲規則

### 基本流程
1. 創建或加入房間
2. 等待玩家加入 (至少2人)
3. 開始遊戲
4. 輪流抽卡 → 出牌 → 計分
5. 喊停或冒險結束輪次
6. 達到目標分數獲勝 (40/35/30 分)

### 牌牌類型

**成對牌** (各6張)
- 螃蟹 - 查看棄牌堆
- 船 - 額外回合
- 魚 - 從牌庫抽牌
- 泳客+鯊魚 - 偷對手卡

**集合卡** 
- 貝殼 (6張)
- 章魚 (5張)
- 企鵝 (3張)
- 水手 (2張)

**美人魚** (4色各4張)
- 顏色加成計分
- 集齊一色4張立即獲勝

**加倍牌**
- 燈塔、魚群、企鵝棲地、船長

## ⚙️ Firebase 配置

已包含 Firebase config，但需要在 Firebase Console 建立 Firestore Database：

1. 進入 https://console.firebase.google.com/
2. 選擇 "sea-salt-5fb51" 專案
3. Firestore Database → Create database (Production mode)
4. 複製規則 (見 FIREBASE_SETUP.md)

## 📦 項目結構

```
sea-salt-paper/
├── src/
│   ├── components/    # React 組件
│   ├── data/         # 遊戲邏輯和卡牌
│   ├── services/     # Firebase 服務
│   ├── styles/       # CSS 樣式
│   └── App.jsx
├── index.html
├── package.json
└── 文檔檔案
```

## 🎯 版本歷史

**v0.1.0** (2024-11-08) - 初始版本
- 完整遊戲邏輯
- 房間系統
- 實時同步
- 美觀 UI

## 📝 License

MIT

---

**快速鏈接**
- [GitHub 倉庫](https://github.com/yanchen184/sea-salt-paper)
- [Firebase 項目](https://console.firebase.google.com/project/sea-salt-5fb51)
- [遊戲規則原作](https://boardgamegeek.com/boardgame/367220/sea-salt-paper)