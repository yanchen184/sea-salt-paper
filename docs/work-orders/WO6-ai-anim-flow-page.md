# WO6：AI 陪玩、動作動畫、公開流程圖

驗收條件以 `docs/spec/01-flow.md` 的 G11、A6、S6、S7、S8 為準，本檔只列範圍與實作位置。

## 範圍

- **G11 AI 決策**：`src/engine/ai.ts` 的 `chooseAiAction`，純函式，只讀該座位看得到的資訊。
- **A6 AI 玩家／S6 AI 代打**：
  - 首頁「單人遊戲」選 1–3 個 AI 直接開局（`createSoloGame`）；大廳房主可加入、移除 AI（`addAi`／`removeAi`）。
  - AI 座位 uid 為 `ai-1`～`ai-3`（`src/firebase/aiSeats.ts`），標示「AI」，不顯示離線、不能被踢。
  - 房主的瀏覽器在輪到 AI 時等 1 秒呼叫 `playAiTurn`，帶上讀到的 version；version 已變就不寫入。
  - 最後一位真人離開時刪除房間。
  - `firestore.rules`：只有房主能在大廳增減 `ai-` 座位；`ai-` uid 不能自己加入；其餘成員全是 AI 時成員可刪房。
- **S8 動作動畫**：
  - 引擎每個成功動作附加公開事件到 `state.events`（保留 20 筆，`seq` 遞增）。
  - `src/features/game/anim/`：`queue.ts` 排程（播放時停在動作前的畫面，重整不重播），`plan.ts` 事件轉飛行路徑，`AnimationLayer.tsx` 以 Web Animations API 播放。
  - 牌區以 `data-anim-zone` 標記；設定開關 `src/app/MotionToggle.tsx`。
- **S7 公開流程圖**：
  - `scripts/flow-board/export.ts` 在 `npm run build` 最後輸出 `dist/flow/index.html`，資料嵌在 `<script id="board-data" type="application/json">`。
  - `board.html` 有嵌入資料時為唯讀：隱藏領取、在線、commit 清單，不連 API，顯示建置 commit。

  - 房主離線超過 45 秒時，下一位在線真人以 `claimHost` 成為房主並接手代打。

範圍外：AI 難度選擇；Cloud Functions 執行 AI（AI 在房主瀏覽器計算，房間裡沒有任何在線真人時 AI 不會行動）。

## 測試

| 節點 | 測試檔 |
|---|---|
| G11 | `src/engine/ai.test.ts` |
| A6、S6 | `src/firebase/aiSeats.test.ts`、`tests/emu/rooms.test.ts`、`tests/emu/rules.test.ts`、`tests/e2e/ai.spec.ts` |
| S8 | `src/engine/events.test.ts`、`src/features/game/anim/anim.test.ts`、`tests/e2e/anim.spec.ts` |
| S7 | `tests/e2e/flow-page.spec.ts` |

`npm run test:board` 的 FB-2 加入 S6–S8 為橫切節點；FB-5 建多個暫存 git repo，逾時設 60 秒。

## 驗證指令

```
npm run typecheck
npm test
npm run test:board
npm run test:emu
npm run build
npm run flow:status
```
