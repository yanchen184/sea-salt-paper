# WO8：桌遊版面

驗收條件以 `docs/spec/01-flow.md` 的 S10 為準，本檔只列範圍與實作位置。

## 範圍

- `RoomPage`：對局中 `<main>` 高度等於視窗（`100dvh`）且 `overflow-hidden`；錯誤訊息改為浮在畫面底部。
- `GameView`：由上而下為狀態列（含收合的本局紀錄）、對手區、牌桌、自己的區域；本局計分與遊戲結束放進浮層 `result-overlay`（`role="dialog"`，開啟時背景加 `inert`），浮層內可捲動。
- `PlayersPanel`：只列對手，順序從自己的下一位開始；手牌以牌背疊放，對手在「從牌庫抽到兩張」階段顯示 `picking`（兩張蓋牌與「挑選中」），關閉動畫時不擺動。
- `MyPanel`：自己的座位列（`data-testid="player"`，含分數與場上牌）在最上方，接著手牌（重疊排列以容納 10 張以上）與動作列；從牌庫抽到兩張或螃蟹挑牌時，動作列換成選牌區。
- 既有的 `data-testid`、`aria-label` 與動畫用的 `data-anim-zone` 全部保留。

範圍外：橫向／直向切換提示、拖曳出牌。

## 測試

| 節點 | 測試檔 |
|---|---|
| S10 | `tests/e2e/layout.spec.ts` |

座位順序改變後，`tests/e2e/ai.spec.ts`、`tests/e2e/game.spec.ts` 中對局畫面的 `playerNames` 斷言改為「對手依序、自己在最後」。

`scripts/flow-board/flow-board.test.ts` 的 FB-2 加入 S10 為流程圖外的節點。

## 驗證指令

```
npm run typecheck
npm test
npm run test:board
npm run test:emu
npm run flow:status
```
