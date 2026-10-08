# WO1b · 引擎補強：crab 兩步、踢出玩家（節點 G4a、G10）

先讀：`docs/spec/00-rules.md`（§3.2 crab、§8 踢出玩家）、`docs/spec/01-flow.md`（G4a、G10 驗收條件）、`docs/spec/02-architecture.md`（引擎介面）。spec 與本工單衝突時以 spec 為準；spec 有矛盾或漏洞時不要自己發明規則，在回報裡列出來。

## 範圍

只改 `src/engine/`（含測試）。不碰 UI、Firebase。

1. **crab 兩步**（G4a-3）
   - `PLAY_DUO` 的 `crab` 改為 `{ pile }`，不再帶 `cardId`。
   - 指定的棄牌堆非空：牌移到場上，`phase = 'crabPick'`，`crabPile = pile`，log 只寫「打出螃蟹對，正在從左/右棄牌堆挑牌」之類，不寫內容。
   - 新動作 `PICK_CRAB { cardId }`：只在 `crabPick` 接受；從 `crabPile` 拿出該張入手，其餘順序不變，回到 `actions`，清掉 `crabPile`。log 照 G4a-2 不寫挑了哪張。
   - `crabPick` 階段其他動作一律被拒（新錯誤碼，例如 `MUST_PICK_CRAB`）。
   - 兩堆都空時照舊：可打出、無效果，不進 `crabPick`。
   - 挑到的牌入手後照常檢查 4 張美人魚。
   - `getLegalActions` 增加 `crabPick: string[] | null`（`crabPick` 階段可挑的 cardId）；`crabPiles` 維持。
   - 型別：`Phase` 加 `'crabPick'`，`GameState` 加 `crabPile: PileIndex | null`（JSON 可表示，不用 `undefined`）。

2. **踢出玩家** `removePlayer(state, playerId): ActionResult`（G10，規則 §8），從 `src/engine/index.ts` 匯出。
   - 不存在的 playerId 回 `UNKNOWN_PLAYER`；`gameOver` 時回 `GAME_NOT_PLAYING`。
   - 被踢者從 `players` 移除；`GameState` 新增 `removed: Card[]`（被移出遊戲的牌）與 `kicked: { id, name, score }[]`。
   - 被踢者的手牌、場上牌、`pendingDraw`（若輪到他且在 `chooseDrawn`）、`crabPick` 中的狀態都清掉，牌進 `removed`。
   - 之後每局回收洗牌不包含 `removed` 的牌（G10-2）；開局張數依剩下的牌決定（牌庫 = 總數 − 2 − removed）。
   - `targetScore` 改用新人數（2 人 40、3 人 35）。
   - `current`、`roundStarter` 依座位重新對齊；輪到被踢者時，由座位上的下一位從 `draw` 開始新回合，`extraTurn = false`（G10-3）。
   - 被踢者是 LAST CHANCE 宣告者 → `declaration = null`（G10-4）。LAST CHANCE 期間被踢的是其他人時，剩下的人照原順序輪完。
   - `roundEnd` 時被踢：`roundResult` 中他的那列移除，其餘不變，房主照常 `NEXT_ROUND`。
   - 剩 1 人 → `status = 'gameOver'`，`winnerId` 為該玩家，`winReason` 新增 `'lastPlayer'`（G10-5）。
   - log 寫「X 被房主移出遊戲」。

3. **測試**
   - 單元測試名稱以 `[G4a-3]`、`[G10-1]`…`[G10-5]` 開頭；舊的 crab 測試改成兩步呼叫，維持 `[G4a-1]`、`[G4a-2]` 通過。
   - `simulation.test.ts` 的隨機對局要涵蓋 `PICK_CRAB`，並加一組「隨機時點踢人」的模擬，斷言手牌 + 場上 + 牌庫 + 棄牌堆 + pendingDraw + removed = 58。

## 驗證指令（完成前自己跑過，全部要過）

```
npm run typecheck
npm test
npm run build
npm run flow:status
```

完成後 `docs/flow-status.md` 中 G0–G10 全部 ✅。

## 回報

改了哪些檔案、新增的錯誤碼、spec 中你認為有歧義或缺漏的地方。
