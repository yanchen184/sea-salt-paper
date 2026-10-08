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

### 已知限制

手牌與牌庫順序都在房間文件裡，任何房間成員用開發者工具都讀得到。畫面上只顯示該看的資訊。要真正隱藏需要伺服器端執行動作（Cloud Functions），這個專案先不做。

## 安全規則

- 必須登入（匿名也算）。
- 讀：房間成員。大廳階段允許任何登入者讀，用來加入。
- 寫：房間成員；加入時只能把自己加進 `players`。
