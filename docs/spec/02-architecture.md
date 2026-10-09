# 02 · 架構

## 技術棧

React 19 + TypeScript (strict) + Vite + Tailwind CSS v3 + Firebase（Auth 匿名登入、Firestore）。
測試：Vitest（引擎）、Playwright（E2E，接 Firebase Emulator）。部署：GitHub Actions → GitHub Pages，路由用 hash（`#/room/ABCD`）。

## 分層

```
src/
  engine/        純函式規則引擎，不 import React/Firebase
    cards.ts       牌組定義（規則 §1）
    rng.ts         可序列化的 seeded RNG
    scoring.ts     卡牌分、顏色加分、本局計分
    game.ts        createGame / applyAction
    types.ts
  firebase/      Firebase 初始化、room repository（transaction）
  features/
    home/ lobby/ game/   各畫面
  App.tsx
```

規則只存在 `engine/`。UI 判斷「這顆按鈕能不能按」也呼叫引擎（`getLegalActions`），不在元件裡重寫規則。

## 引擎介面

```ts
createGame(players: PlayerSeat[], seed: number): GameState
applyAction(state: GameState, playerId: string, action: Action): { ok: true; state: GameState } | { ok: false; error: ActionError }
getLegalActions(state: GameState, playerId: string): LegalActions
```

- 純函式，不改傳入的 state，回傳新物件。
- 所有隨機（洗牌、偷牌）都走 state 內的 RNG 狀態，同一個 seed + 同一串動作 = 同一個結果。
- `Action`：
  - `DRAW_DECK` → 進入 `chooseDrawn`，被抽的 2 張存在 `pendingDraw`
  - `KEEP_DRAWN { keepCardId, discardPile: 0 | 1 }`
  - `TAKE_DISCARD { pile: 0 | 1 }`
  - `PLAY_DUO { cardIds: [string, string], crab?: { pile: 0 | 1 }, steal?: { targetId: string } }`：crab 對指定非空棄牌堆後進入 `crabPick`，該堆存在 `crabPile`
  - `PICK_CRAB { cardId }`：`crabPick` 階段從 `crabPile` 挑 1 張，回到 `actions`
  - `DECLARE { kind: 'stop' | 'lastChance' }`
  - `END_TURN`
  - `NEXT_ROUND`（房主在計分畫面按，開下一局）
- 回合內 phase：`draw` → (`chooseDrawn`) → `actions` ⇄ (`crabPick`) → 回合結束；局的狀態：`playing` | `roundEnd` | `gameOver`。
- `removePlayer(state, playerId): ActionResult`：踢出玩家（規則 §8）。誰能踢（房主、對方離線）由 room repository 判斷，引擎不管。被移出的牌放在 `state.removed`，被踢者的紀錄放在 `state.kicked`。
- `state.events`：每個成功的動作附加一筆公開事件 `GameEvent`（`drawDeck`、`keepDrawn`、`takeDiscard`、`playDuo`、`pickCrab`、`declare`），`seq` 在同一場遊戲內遞增，只保留最近 `MAX_EVENTS = 20` 筆。給所有玩家播動畫用。
- `chooseAiAction(state, playerId): Action | null`（`engine/ai.ts`）：只讀該座位看得到的資訊，同一個 state 回傳同一個動作；不該它行動時回傳 `null`。

## Firestore 資料模型

單一文件 `rooms/{code}`：

```ts
{
  code: string
  hostId: string
  status: 'lobby' | 'playing' | 'finished'
  players: { uid: string; name: string }[]   // 陣列順序 = 座位
  game: GameState | null
  version: number                            // 每次寫入 +1
  updatedAt: Timestamp
}
```

- 每個動作：`runTransaction` 讀房間 → `applyAction` → 寫回並 `version + 1`。同時送出的兩個動作由 transaction 保證只有一個成立。
- 全部狀態放在同一份文件，保持 transaction 簡單；58 張牌的狀態遠小於 1MB 上限。
- 在線狀態放在子集合 `rooms/{code}/presence/{uid}`：`{ lastSeen: Timestamp }`，每位玩家 15 秒寫一次；超過 45 秒沒更新視為離線。和房間文件分開，心跳不會跟動作的 transaction 衝突。
- 踢人：`kickPlayer(code, hostUid, targetUid)` 在 transaction 內確認呼叫者是房主、對方離線，再呼叫 `removePlayer` 並把對方從 `players` 移除。
- 再玩一場：`restartGame(code, hostUid)`，房主在 `status: 'finished'` 時呼叫，用目前的 `players` 重新 `createGame`，`status = 'playing'`。

### AI 座位

- AI 是 `players` 裡 uid 以 `ai-` 開頭的座位（`ai-1`～`ai-3`，`firebase/aiSeats.ts`），沒有登入帳號，也沒有在線狀態。
- `createSoloGame(host, aiCount)` 在同一個 transaction 寫入已開局的房間（`status: 'playing'`、`version: 0`）；大廳中房主用 `addAi`／`removeAi` 增減。
- 輪到 AI 時，房主的瀏覽器（`RoomPage`）等 1 秒後呼叫 `playAiTurn(code, hostUid, version)`：transaction 內 version 不同或不是 AI 的回合就不寫入，否則 `chooseAiAction` → `applyAction` → 寫回。房主換人後由新房主的瀏覽器接手。
- 有 AI 座位的房間，房主離線超過 45 秒時，從房主座位往後第一位在線真人的瀏覽器呼叫 `claimHost(code, uid)`，成為房主並接手代打（`aiSeats.hostToClaim`）。
- 最後一位真人離開時刪除房間文件。

### 已知限制

手牌與牌庫順序都在房間文件裡，任何房間成員用開發者工具都讀得到。畫面上只顯示該看的資訊。要真正隱藏需要伺服器端執行動作（Cloud Functions），這個專案先不做。

同理，安全規則只限制房間層級的欄位（version、房主、踢人、玩家名單），`game` 的內容由客戶端的引擎產生，房間成員可以繞過畫面直接改寫。

## 安全規則

- 必須登入（匿名也算）。
- 讀：房間成員。大廳階段允許任何登入者讀，用來加入。
- 寫：房間成員；加入時只能把自己加進 `players`。`players` 只能整個座位移除（自己離開、房主踢人、房主移除 AI）或在尾端加入，不能重排或改寫別人的座位。
- AI uid 只能是 `ai-1`～`ai-3`。只有房主能在大廳加入或移除 AI 座位：加入只能接在尾端，移除只能拿掉一個 AI，其餘座位的順序與內容不變。AI uid 不能自己加入；房間其餘成員全是 AI 時，成員可以刪除房間。
- 建房可以是單人大廳，或單人遊戲：自己坐第 1 位、其餘 1–3 位都是 AI、`status: 'playing'`、`game` 不為空。
- 有 AI 座位的房間，房主的在線狀態超過 45 秒沒更新時，從房主座位往後第一位在線真人可以只改 `hostId`（改成自己）與 `version`；判斷用伺服器時間（`request.time`），`claimHost` 只送出修改，被規則拒絕時回 `CANNOT_CLAIM_HOST`；`RoomPage` 在本機判斷應該接手的期間每 5 秒重試。

## 動作動畫

`features/game/anim/`：

- `queue.ts`：收到新快照時，把 `seq` 大於已播的事件排進佇列，最後接一筆新狀態。播動畫時畫面停在動作前的 state，全部播完才換成新 state。重整或重連時以快照最新的 `seq` 為起點，不重播。每個動作只產生 1 個事件，一份快照帶 2 個以上新事件代表斷線補收，不播動畫，直接排一筆新狀態。
- `plan.ts`：`planAnimation(event, before, viewerId)` 把事件轉成幾段：飛行（起點、終點、正面或牌背）、攤牌（螃蟹效果把該棄牌堆的牌正面攤開）或橫幅。牌區以 `data-anim-zone` 標記：`deck`、`pile-0`、`pile-1`、`seat-<uid>`、`field-<uid>`、`hand`、`drawn`（自己抽牌庫後的二選一區）。
- `AnimationLayer.tsx`：以 portal 疊在畫面上，用 Web Animations API 依序播放。
- 設定（`lib/motion.ts`）：存在 localStorage `sea-salt-paper:animations`，沒設定時依 `prefers-reduced-motion`。關閉時直接顯示新狀態。

## 公開流程圖

`npm run build` 最後執行 `scripts/flow-board/export.ts`，把 Flow Board 的看板資料嵌進 `board.html`，輸出 `dist/flow/index.html`，部署後在 `/sea-salt-paper/flow/`。頁面唯讀、不連任何 API，標示建置時的 commit（`VITE_COMMIT_SHA` → `GITHUB_SHA` → `git rev-parse HEAD`）。
