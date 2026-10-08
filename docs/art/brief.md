# 美術需求單：兩套主題的 SVG 圖

所有圖都是手寫 SVG，存成純文字檔，不得有點陣圖、不得引用外部資源、不得有 `<script>`。

## 1. 生物線稿（兩個主題共用）

路徑：`src/assets/art/creatures/<kind>.svg`，共 14 張：

| kind | 名稱 | kind | 名稱 |
|------|------|------|------|
| crab | 螃蟹 | octopus | 章魚 |
| boat | 船 | penguin | 企鵝 |
| fish | 魚 | sailor | 水手 |
| swimmer | 游泳者 | lighthouse | 燈塔 |
| shark | 鯊魚 | shoal | 魚群 |
| shell | 貝殼 | penguinColony | 企鵝群 |
| captain | 船長 | mermaid | 美人魚 |

- 風格：摺紙（origami）幾何造型，由直線摺面構成，像紙摺出來的動物。14 張要一眼看出是同一套。
- `viewBox="0 0 64 64"`，主體置中，四邊留 4 單位邊界。
- 只能用 `currentColor` 上色：外框用 `stroke="currentColor"`，`stroke-width` 介於 2 到 2.5，`stroke-linejoin="round"`。摺面用 `fill="currentColor"`，`fill-opacity` 介於 0.15 到 0.35，用來表現明暗。不得寫死任何色碼。
- 縮到 40×40 px 仍要認得出是什麼生物。

## 2. 主題「紙藝海岸」（paper）

路徑：`src/assets/art/paper/`

- `table.svg`：桌布，可無縫平鋪，`viewBox="0 0 400 400"`。風格是淺沙色牛皮紙底，帶細紙纖維紋理和淡淡的摺痕，邊角點綴摺紙貝殼與海浪。色系為米白、沙色、淡海藍，對比要低，不可搶卡牌的焦點。
- `card-back.svg`：卡背，`viewBox="0 0 64 96"`，圓角 6。海藍色紙底，中央是摺紙帆船徽記，四周有細框線，配白色和淺沙色。

## 3. 主題「深海夜航」（night）

路徑：`src/assets/art/night/`

- `table.svg`：桌布，可無縫平鋪，`viewBox="0 0 400 400"`。風格是深海軍藍底，帶細金線的航海圖元素：經緯格線、羅盤玫瑰、等深線、零星的星點。整體要暗，金線的透明度要低。
- `card-back.svg`：卡背，`viewBox="0 0 64 96"`，圓角 6。深藍底配燙金羅盤玫瑰，外圍是雙線金框，顏色用 `#0b1d3a` 和 `#d4af37` 這一系。

## 驗收

- 每個檔案都是合法 SVG，能用瀏覽器直接打開，檔案小於 8 KB。
- 生物線稿全檔搜尋不到 `#` 色碼和 `rgb(`。
