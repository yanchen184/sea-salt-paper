# WO2 · Firebase、房間流程與動作同步（節點 A1–A5、S1、S2）

先讀：`docs/spec/01-flow.md`（A、S 節點驗收條件）、`docs/spec/02-architecture.md`（Firestore 模型、安全規則、分層）。引擎 `src/engine/` 已完成（WO1、WO1b，含 `PICK_CRAB` 與 `removePlayer`），本工單不改規則；發現引擎問題列在回報裡。

## 範圍

1. **Firebase 初始化** `src/firebase/`
   - 設定從 `import.meta.env.VITE_FIREBASE_*` 讀（本機 `.env.local` 已有，不進版控）；缺值時啟動即丟出明確錯誤。
   - `VITE_USE_EMULATOR=true` 時連 Auth / Firestore emulator（`firebase.json` 定義的 port）。
   - 匿名登入（`signInAnonymously`），用 `onAuthStateChanged` 取得 uid。

2. **Room repository** `src/firebase/rooms.ts`，介面不依賴 React：
   - `createRoom(host)`：產生 4 碼房號（大寫英數，去掉易混淆的 `0 O 1 I`），在 transaction 內確認該房號不存在或已 `finished` 才寫入（A2-2）。
   - `joinRoom(code, player)`：房間不存在 / 已滿 4 人 / 已開始，各自回傳不同的錯誤碼與中文訊息（A3-2）。已在房內的 uid 再次加入視為成功（A5-1）。
   - `leaveRoom(code, uid)`：從 `players` 移除；離開的是房主時 `hostId` 轉給 `players` 中的下一位；最後一人離開時刪除房間。
   - `startGame(code, uid)`：只有房主、人數 2–4；`game = createGame(players, seed)`，seed 用 `crypto.getRandomValues`，`status = 'playing'`。
   - `sendAction(code, uid, action)`：`runTransaction` 讀房間 → `applyAction` → 寫回 `game`、`version + 1`、`updatedAt`；`game.status === 'gameOver'` 時 `status = 'finished'`。引擎回 `{ ok: false }` 時不寫入，把 error 回給呼叫端（S1-1、S1-2）。
   - `subscribeRoom(code, cb)`：`onSnapshot`。
   - 在線狀態（A5-2）：`startHeartbeat(code, uid)` 每 15 秒寫 `rooms/{code}/presence/{uid}` 的 `lastSeen`（`serverTimestamp()`），回傳停止函式；`subscribePresence(code, cb)` 回傳各 uid 的 `lastSeen`；判斷離線的純函式 `isOffline(lastSeen, now)`（超過 45 秒或沒有紀錄）放在不依賴 Firebase 的檔案，單元測試覆蓋。
   - `kickPlayer(code, hostUid, targetUid)`（A5-2、A5-3）：transaction 內讀房間與對方的 presence；呼叫者必須是房主、對方必須離線、不能踢自己；`status === 'playing'` 時呼叫引擎 `removePlayer`，並把對方從 `players` 移除；`lobby` 時只從 `players` 移除。房間文件加 `kickedUids: string[]`，讓被踢者的畫面知道自己被踢。
   - `restartGame(code, hostUid)`（S3-5 的資料層）：只有房主、`status === 'finished'`；用目前 `players` 重新 `createGame`（新 seed），`status = 'playing'`，`version + 1`。

3. **安全規則** `firestore.rules` + `firebase.json`（emulator：auth、firestore；`firestore.rules` 路徑）。照 02-architecture.md「安全規則」。另外：
   - 建立時 `hostId` 必須是自己、`players` 只有自己。
   - 非成員只能做「把自己加進 `players`」這一種更新，且房間 `status == 'lobby'`、加入後不超過 4 人。
   - `presence/{uid}`：房間成員可讀；只有本人能寫自己那筆。
   - 被踢者（在 `kickedUids` 內）不能再寫房間，也不能重新加入。

4. **畫面**（hash 路由，不加 router 套件；`#/` 首頁、`#/room/ABCD` 房間）
   - A1 首頁：暱稱輸入（1–12 字，前後空白去掉），存 `localStorage`；建立房間、輸入房號加入。
   - A4 大廳：玩家列表（標示房主與自己）、房號、離開按鈕；開始按鈕只對房主顯示，人數不足時停用並說明原因。
   - 開始後房間頁顯示「遊戲進行中」占位即可，對局畫面是 WO3（踢人按鈕、再玩一場按鈕也在 WO3）。
   - 進入房間頁就啟動心跳，離開頁面停止。
   - 錯誤訊息顯示在畫面上（不用 `alert`）。

5. **測試**
   - A5-2：`isOffline` 單元測試；`kickPlayer` 整合測試涵蓋「非房主被拒」「對方在線被拒」「離線被踢成功、players 少 1、game 經過 removePlayer」。
   - S1、S2：Vitest 整合測試，跑在 emulator 上（`@firebase/rules-unit-testing` 測規則；repository 直接打 emulator）。S1-2 用兩個 client 對同一個 version 同時 `sendAction`，斷言只有一個成功、另一個收到錯誤。
   - A1–A5：Playwright E2E（Chromium），`vite` dev server 帶 `VITE_USE_EMULATOR=true`。A4-1 用兩個 browser context 驗即時同步。A5-1 在 `status: 'playing'` 時重整頁面，斷言回到同一房間、手牌數不變（手牌可透過測試專用的 `data-testid` 讀）。
   - 引擎單元測試維持 `npm test`，不依賴 emulator。
   - 新 scripts：`test:emu`（`firebase emulators:exec --only auth,firestore` 包住 emulator 整合測試與 Playwright）。
   - `npm run flow:status` 改為同時收集 Vitest 單元、emulator 整合、Playwright 三份 JSON 結果；Playwright 測試名稱同樣以 `[編號]` 開頭。

## 不在範圍

對局畫面（S3）、踢人與再玩一場的按鈕、部署（S4）、卡面插圖。

emulator 測試用 `demo-` 開頭的 project id（例如 `demo-sea-salt`），不連真實 Firebase 專案。

## 驗證指令（完成前自己跑過，全部要過）

```
npm install
npm run typecheck
npm test
npm run test:emu
npm run build
npm run flow:status
```

完成後 A1–A4、S1、S2 為 ✅，A5 至少 A5-1、A5-2 有測試通過（A5-3 的畫面部分在 WO3），G 節點維持 ✅，S3、S4 為 ⬜。

## 回報

新增的檔案、`docs/flow-status.md` 內容、spec 中你認為有歧義或缺漏的地方。
