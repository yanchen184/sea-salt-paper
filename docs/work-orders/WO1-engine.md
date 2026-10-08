# WO1 · 專案骨架 + flow:status + 規則引擎（節點 G0–G9）

先讀：`docs/spec/00-rules.md`（規則唯一依據）、`docs/spec/01-flow.md`（節點與驗收條件）、`docs/spec/02-architecture.md`（分層與引擎介面）。三份 spec 與本工單衝突時以 spec 為準；spec 本身有矛盾或漏洞時，不要自己發明規則，在回報裡列出來。

## 範圍

1. **專案骨架**（repo 根目錄，目前只有 `docs/`）
   - Vite + React 19 + TypeScript（`strict: true`）+ Tailwind CSS v3 + Vitest。
   - npm scripts：`dev`、`build`（`tsc -b && vite build`）、`typecheck`、`test`（`vitest run`）、`flow:status`。
   - `vite.config.ts` 設 `base: '/sea-salt-paper/'`。
   - `src/App.tsx` 只放一個占位畫面（標題「海鹽與紙」），UI 不在本工單範圍。
   - 不要加入 Firebase、Playwright、router，那是後續工單。
   - `.gitignore` 要涵蓋 `node_modules`、`dist`、`*.local`、`coverage`、`test-results`。

2. **`npm run flow:status`**（`scripts/flow-status.ts` 或 `.mjs`，用 `tsx`/node 執行皆可）
   - 從 `docs/spec/01-flow.md` 的節點表解析出所有節點與驗收條件編號（如 `G3a-2`、`A1-1`）。
   - 執行 Vitest（JSON reporter），從測試名稱開頭的 `[編號]` 對應到驗收條件；一個測試可以帶多個編號，例如 `[G7-3][G7-5] ...`。
   - 依 01-flow.md「驗收怎麼算」的 ✅🟡❌⬜ 規則產出 `docs/flow-status.md`：每節點一列，列出狀態、已覆蓋/總條件數、缺測試的條件編號、失敗的條件編號。
   - 測試裡出現 spec 中不存在的編號時，腳本以非 0 結束並印出該編號。
   - 本工單之後，G0–G9 全部節點應為 ✅，A/S 節點為 ⬜。

3. **規則引擎** `src/engine/`，介面照 02-architecture.md：
   - `cards.ts`：58 張牌，`Card = { id, kind, color }`，資料照 00-rules.md §1。
   - `rng.ts`：可序列化進 state 的 seeded PRNG（例如 mulberry32），提供洗牌與隨機整數。
   - `scoring.ts`：`cardPoints(cards)`（§5，回傳各項明細與總分）、`colorBonus(cards)`（§6）、本局計分（§4）。
   - `game.ts`：`createGame(players, seed)`、`applyAction(state, playerId, action)`、`getLegalActions(state, playerId)`。
   - 純函式，不修改輸入；非法動作回傳 `{ ok: false, error }`，`error` 帶 `code`（字串常數）與中文 `message`。
   - state 需能直接存進 Firestore：只用 JSON 可表示的值，不用 `undefined`、class、Map、Set。
   - 動作紀錄 `log`：每個動作一筆對所有玩家公開的描述。log 不可透露其他玩家看不到的牌：抽牌庫時留下的那張、crab 挑走的那張、shark+swimmer 偷到的那張（只寫偷了誰）。放進棄牌堆的牌是公開的，可以寫（見 G4a-2）。

## 測試要求

- 每條 G0–G9 驗收條件至少一個測試，測試名稱以 `[編號]` 開頭。
- 計分測試要用「手算過的具體數字」斷言，例如：手上 3 shell + 1 shoal + 2 fish 的卡牌分應為多少，並在測試裡用註解列出手算過程（只寫算式）。至少涵蓋：每種 collector 的每個張數、四種 multiplier、手上未打出的 duo 成對計分、shark/swimmer 交叉成對、1–4 張 mermaid（含同色數相同時不可重複計同一色）、顏色加分包含 white。
- 測試要能用固定 seed 重現；需要特定牌序時，可直接建構 state，不必依賴洗牌結果。
- 不要為了讓測試通過而改 spec 的規則。

## 驗證指令（完成前自己跑過，全部要過）

```
npm install
npm run typecheck
npm test
npm run build
npm run flow:status
```

## 回報

列出：新增的檔案、各節點狀態（貼 `docs/flow-status.md` 內容）、spec 中你認為有歧義或缺漏的地方。
