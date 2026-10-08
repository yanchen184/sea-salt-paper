# WO3 對局畫面

規格來源：`docs/spec/01-flow.md` 的 S3、A5-3，規則 `docs/spec/00-rules.md`。

## 範圍

取代 `GamePlaceholder`，房間 `status` 為 `playing` / `finished` 時顯示對局畫面。

| 區塊 | 內容 |
|---|---|
| 狀態列 | 第幾局、目標分、輪到誰、LAST CHANCE 宣告與受保護標示 |
| 對手 | 名稱、總分、手牌張數（不顯示牌面）、場上牌、離線標示；房主對離線者有「移出」按鈕 |
| 桌面 | 牌庫張數、左右棄牌堆頂牌與張數 |
| 自己 | 場上牌、手牌、目前卡牌分、依 phase 顯示的動作 |
| 紀錄 | 本局的 `log` |
| 本局結束 | 所有人攤牌（手牌 + 場上）、卡牌分 / 顏色加分 / 本局得分、作廢原因；「下一局」按鈕 |
| 整場結束 | 勝者與原因、總分排名、被移出者分數；房主「再玩一場」，其他人看到等待提示 |

## 動作

所有動作經 `rooms.sendAction(code, uid, action, room.version)`；可否點擊一律依 `getLegalActions`，停用時以 `title` 與可見文字說明原因（S3-3）。原因文字由 `src/features/game/actionHints.ts` 產生並有單元測試。

| phase | 操作 |
|---|---|
| draw | 抽牌庫、拿左堆、拿右堆 |
| chooseDrawn | 點選要留下的牌，再選另一張放到哪個棄牌堆 |
| actions | 點選兩張手牌 → 打出；螃蟹對選棄牌堆、鯊魚 + 游泳者選對手；宣告 STOP / LAST CHANCE；結束回合 |
| crabPick | 只有當前玩家看得到該棄牌堆全部牌，點一張入手 |

## 測試

- 單元：`actionHints.test.ts`（S3-3）。
- E2E（emulator）：S3-1、S3-2、S3-3、S3-4、S3-5、A5-3；A5-1 改成抽牌後再重整，確認手牌不變。
