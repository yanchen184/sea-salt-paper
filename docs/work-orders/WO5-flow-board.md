# WO5：Flow Board（開發看板 server）

## 範圍

- 本機 HTTP server：`npm run flow:board`，預設 `http://127.0.0.1:4317`，`--host 0.0.0.0` 開放同網段連線。
- 框框來源：`docs/spec/01-flow.md` 的節點表與 mermaid 流程圖。流程圖裡的節點依流程由左至右分欄，不在流程圖裡的節點排在「橫切節點」列。
- 每個節點框顯示（展開後列出全部 commit）：
  - 測試狀態，讀 `docs/flow-status.md`；
  - 誰正在做，以及從什麼時候開始；
  - 帶 `Flow-Node` trailer 的 commit：hash、作者、`Flow-Agent`。
- 每條驗收條件框直接顯示：測試狀態、第一次加入該 `[ID]` 測試的 commit 短 hash（含 repo 的根 commit，以及在 merge commit 解衝突時才加入的測試；沒有時顯示「尚無測試 commit」）。測試以 TypeScript 語法樹辨認 `it(...)`／`test(...)` 及其修飾鏈的標題：修飾詞限 `skip`、`only`、`todo`、`concurrent`、`sequential`、`fails`，產生測試函式的呼叫限 `each`、`for`、`skipIf`、`runIf`；跨行寫法算，`describe`、hook、註解與一般字串不算。
- 領取：同一個節點同時只能有一個人領。只有領取者能放手，`force` 可以強制放手。規格刪掉的節點，它的領取仍可放手。領取狀態存在 `.flow-board/claims.json`，不進 git。同一個 repo 只能開一個 server：`.flow-board/server.lock` 記錄 pid 與隨機 token，持有中的 server 每 5 秒更新鎖檔時間；pid 已不存在、或鎖檔超過 30 秒沒更新（pid 被別的程序重用）的鎖會被接手：先建立以鎖內容雜湊命名的 `server.lock.takeover-*` 標記，建立成功的程序才能刪除那份鎖，刪除前再確認內容未變；每次寫入領取紀錄前確認鎖仍是自己的。這個鎖用來擋「同一個 repo 誤開第二個 server」；範圍外：持有中的 server 程序停頓超過 30 秒（例如被除錯器暫停）後恢復，它在「確認鎖」與「刪鎖或寫入領取紀錄」之間仍可能覆蓋新持有者的鎖或資料，WO5 不處理這種情況。
- 看板透過 SSE 即時更新：有人領取或放手、git refs 或 HEAD 變動、規格或狀態檔變動時，畫面會刷新。
- CLI：`npm run flow -- claim <節點> --as <名字>`、`release`、`list`。
- 無登入機制。開放 `0.0.0.0` 時，同網段任何人都能領取或放手。
- 寫入端點的 Content-Type 媒體類型（`;` 之前、不分大小寫）必須正好是 `application/json`，`charset` 等參數不影響判斷；帶 `Origin` 時必須是 `http:`、不含帳密，且主機名稱（不分大小寫）與連接埠（省略時視為 80）都與 `Host` 相同；`Host` 只接受 `localhost` 或 IP。用來擋其他網站對本機 server 的跨來源寫入。
- 測試：`npm run test:board`（獨立的 vitest 設定，`[FB-*]` 不進 `flow:status`）。

## Commit 慣例

```
feat: 帆船額外回合

Flow-Node: G4b
Flow-Agent: agent-2
```

`Flow-Node` 可寫多個，以逗號分隔。

## 測試

| 編號 | 測試 |
|---|---|
| FB-1 | 解析 `01-flow.md`：節點 ID、名稱、章節、每條驗收條件的編號與文字 |
| FB-2 | 分欄：主流程由左至右（A1 → A4 → G1 → G2 → G3a → G4 → G5 → G7 → G8 → G9），回頭的邊不影響欄位；只從旁支進入的節點（G10）排在它的下游左邊一欄；不在流程圖的節點列為橫切節點 |
| FB-3 | 解析 `flow-status.md`，得到每條條件的狀態：通過、缺測試、失敗 |
| FB-4 | 領取互斥：別人已領時拒絕並回報領取者；同一人重領保留原時間；非領取者不能放手，`force` 可以；重開 server 後狀態仍在；pid 已結束或鎖檔超過 30 秒沒更新的鎖可接手，持有中會更新鎖檔時間，接手標記的持有者已結束也能清除，4 個程序同時接手只有 1 個成功，鎖被換掉後不能再寫入 |
| FB-5 | 從 git 讀出 `Flow-Node`、`Flow-Agent` trailer，以及每個 `[ID]` 測試第一次出現的 commit（跨行呼叫與修飾鏈算，非測試檔、註解、`foo.it(...)`、`test.describe`、`test.beforeEach` 不算）；detached HEAD 上的新 commit 會改變指紋 |
| FB-6 | HTTP：`/api/board` 回傳看板；領取成功回 200，衝突回 409；SSE 連線在領取後收到新看板；非 JSON（含 `application/jsonp`）回 415，`application/json; charset=utf-8` 照常處理，跨來源 Origin 與非本機 Host 回 403，大小寫不同的同源 Origin 照常處理；`toString`、`__proto__`、`constructor` 這類名稱不算節點（領取回 400、放手回 404）；規格已沒有的節點仍可 force 放手；同一 repo 開第二個 server 會被拒絕，關掉後可再開 |
