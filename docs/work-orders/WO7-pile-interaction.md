# WO7：牌堆互動

驗收條件以 `docs/spec/01-flow.md` 的 S9 為準，本檔只列範圍與實作位置。

## 範圍

- `src/features/game/pileTargets.ts` 的 `pileTargets`：純函式，依牌局、合法動作與目前選取的手牌，算出牌庫與兩個棄牌堆各自點下去要送的動作與說明；沒有可送的動作時為 `null`。
- 選取的手牌由 `GameView` 持有，傳給 `MyPanel` 與 `TablePanel`。
- `TablePanel`：三個牌堆是 `<button>`（`pile-deck`、`pile-0`、`pile-1`），有動作時亮起並以 `aria-label`／`title` 說明，沒有動作時 `disabled`。
- 原有的動作按鈕保留，送出同一個動作。

範圍外：拖曳操作。

## 測試

| 節點 | 測試檔 |
|---|---|
| S9 | `src/features/game/pileTargets.test.ts`、`tests/e2e/piles.spec.ts` |

`scripts/flow-board/flow-board.test.ts` 的 FB-2 加入 S9 為流程圖外的節點。

## 驗證指令

```
npm run typecheck
npm test
npm run test:board
npm run test:emu
npm run flow:status
```
