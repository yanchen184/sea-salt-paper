# 00 · 遊戲規則（Source of Truth）

本檔是規則的唯一依據。程式碼、測試、UI 文案與本檔衝突時，以本檔為準；要改規則先改本檔。

依據：
- 規則流程：[RulesPal 規則摘要](https://www.rulespal.com/sea-salt-n-paper/rulebook)、[Zatu How to Play](https://zatu.com/how-to-play-sea-salt-and-paper/)
- 逐張顏色：三份獨立實作一致（LilPiep/SeaSaltPaper、th0bo/sea-salt-paper、DragonKyro/card-collecting），各色總數與 BGA 公布的分布吻合（BGA 粉紅寫 3，但其清單合計 59 張，判定為筆誤）

## 1. 牌組（58 張）

| 種類 kind | 類別 | 張數 | 逐張顏色 |
|---|---|---|---|
| crab 螃蟹 | duo | 9 | darkBlue×2, lightBlue×2, yellow×2, black, lightGreen, lightGray |
| boat 帆船 | duo | 8 | darkBlue×2, lightBlue×2, black×2, yellow×2 |
| fish 魚 | duo | 7 | darkBlue×2, black×2, lightBlue, yellow, lightGreen |
| swimmer 游泳者 | duo | 5 | darkBlue, lightBlue, black, yellow, lightOrange |
| shark 鯊魚 | duo | 5 | darkBlue, lightBlue, black, lightGreen, purple |
| shell 貝殼 | collector | 6 | darkBlue, lightBlue, black, yellow, lightGreen, lightGray |
| octopus 章魚 | collector | 5 | lightBlue, yellow, lightGreen, lightGray, purple |
| penguin 企鵝 | collector | 3 | purple, lightOrange, pink |
| sailor 水手 | collector | 2 | pink, orange |
| lighthouse 燈塔 | multiplier | 1 | purple |
| shoal 魚群 | multiplier | 1 | lightGray |
| penguinColony 企鵝群 | multiplier | 1 | lightGreen |
| captain 船長 | multiplier | 1 | lightOrange |
| mermaid 美人魚 | mermaid | 4 | white×4 |

各色總數（測試要驗）：darkBlue 9、lightBlue 9、black 8、yellow 8、lightGreen 6、white 4、purple 4、lightGray 4、lightOrange 3、pink 2、orange 1。

## 2. 準備

1. 洗牌成牌庫（面朝下）。
2. 翻牌庫頂 2 張，各自成為左、右棄牌堆（面朝上）。
3. 所有玩家起始手牌 0 張。
4. 第一局起始玩家隨機；之後每局由「上一局宣告者的下一位」開始。上一局因牌庫耗盡而無人宣告時，由「上一局起始玩家的下一位」開始。
5. 目標分數：2 人 40、3 人 35、4 人 30。

## 3. 回合

每回合依序：

### 3.1 取得一張牌（必做，二選一）

- **抽牌庫**：從牌庫頂拿 2 張，選 1 張留在手上，另 1 張面朝上放到任一棄牌堆頂。若有棄牌堆為空，必須放到空的那堆。牌庫只剩 1 張時，拿那 1 張直接留在手上。牌庫為 0 張時不能選這項。
- **拿棄牌堆**：拿任一非空棄牌堆的頂牌。不可翻看棄牌堆。
- **無牌可取**：牌庫與兩個棄牌堆都是空的時（只可能發生在 LAST CHANCE 期間），跳過取牌，直接進入 3.2。

### 3.2 打出 Duo（可選，可多次）

把一對牌面朝上放到自己面前（「場上」），觸發效果。每對無論在手上或場上，計分時都算 1 分。

| 組合 | 效果 |
|---|---|
| crab + crab | 選一個非空棄牌堆，看全部內容，拿任意 1 張入手（其他人看不到拿了什麼）。棄牌堆順序不變。先打出這對、選定棄牌堆，才看得到該堆內容。 |
| boat + boat | 本回合結束後，自己立刻再進行一個完整回合。 |
| fish + fish | 牌庫頂 1 張入手（牌庫空則無效果）。 |
| shark + swimmer | 從一位對手手中隨機偷 1 張。 |

決議：
- 效果無法執行時（例如兩個棄牌堆都空的 crab、牌庫空的 fish、所有對手手牌為 0 或受保護的 shark+swimmer）仍可打出該對，只拿分、不觸發效果。
- 同一回合打出多對 boat，只會多 1 個回合（不疊加）。

### 3.3 結束這一局（可選）

條件：自己的「卡牌分」（第 5 節，手上 + 場上）≥ 7。可宣告：

- **STOP**：這一局立刻結束，進入計分。
- **LAST CHANCE**：其他玩家依序各再進行 1 個回合（帆船的額外回合照常生效），之後計分。宣告者的手牌受保護，不能被 shark+swimmer 偷。

宣告後宣告者的回合直接結束（即使本回合打了 boat，也不再執行額外回合）。不宣告則回合結束。

### 3.4 回合結束檢查

依序：
1. 任何玩家手上 + 場上共有 4 張 mermaid → 該玩家立刻贏得整場遊戲（這項檢查在每次有牌進入玩家手中後立即做，不必等回合結束）。
2. 牌庫為 0 張且本局無人宣告 → 本局作廢，所有人本局 0 分，開下一局。
3. 輪到下一位。

## 4. 本局計分

### STOP
每位玩家得自己的卡牌分。

### LAST CHANCE
比較宣告者與所有對手的卡牌分：
- 宣告者 ≥ 每位對手（平手算宣告者贏）：宣告者得「卡牌分 + 顏色加分」，其他人只得「顏色加分」。
- 有任一對手 > 宣告者：宣告者只得「顏色加分」，其他人得各自的卡牌分。

## 5. 卡牌分（手上 + 場上所有牌）

1. **Duo**：場上每對 1 分；手上的 duo 也成對計分（crab 兩兩成對、boat 兩兩、fish 兩兩、shark 與 swimmer 一對一），每對 1 分，落單的 0 分。
2. **Collector**（依張數查表）：
   - shell 1–6 張：0 / 2 / 4 / 6 / 8 / 10
   - octopus 1–5 張：0 / 3 / 6 / 9 / 12
   - penguin 1–3 張：1 / 3 / 5
   - sailor 1–2 張：0 / 5
3. **Multiplier**（本身不算該種類的牌）：
   - lighthouse：每張 boat +1
   - shoal：每張 fish +1
   - penguinColony：每張 penguin +2
   - captain：每張 sailor +3
4. **Mermaid**：第 1 張美人魚得「數量最多的那種顏色」的張數，第 2 張得「次多的另一種顏色」，依此類推；每種顏色只能被一張美人魚計算。計算美人魚分時不含 white（美人魚自己）。

## 6. 顏色加分

自己手上 + 場上最多的同色張數（包含 white）。只在 LAST CHANCE 時使用。

## 7. 整場結束

- 本局計分後，有人總分 ≥ 目標分數 → 遊戲結束，總分最高者勝；平手時由「最後一局中較晚進行回合」的玩家獲勝（以最後一局起始玩家為 0 起算的座位順序，數字較大者勝）。
- 4 張美人魚立即獲勝（3.4）。
- 否則所有牌回收洗勻，開下一局（第 2 節）。

## 8. 踢出玩家（線上版）

對局中不設超時。房主可以把離線的玩家踢出，對局改為少 1 人繼續：

- 目標分改用新人數（§2）。
- 被踢者的手牌、場上牌、抽到還沒放回的牌移出遊戲，本場不再使用（下一局洗牌也不放回）。
- 被踢者的總分保留在紀錄裡，不參與排名。
- 輪到被踢者時，改由座位上的下一位開始新回合；被踢者這回合打出的帆船額外回合作廢。
- 被踢者是 LAST CHANCE 宣告者時，宣告取消，這局照常進行。被踢者是 STOP 宣告者時不會發生（STOP 立刻計分）。
- 只剩 1 人時遊戲結束，該玩家獲勝。
