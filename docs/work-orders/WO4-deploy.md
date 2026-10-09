# WO4：部署（S4）

## 範圍

- `.github/workflows/deploy.yml`：push 到 main 時跑單元測試、建置、部署 GitHub Pages。
- 建置時把 commit SHA 寫進 `<meta name="commit">`，用來確認線上版本就是 main 的 HEAD。
- 線上驗收測試 `tests/live/`，以 `playwright.live.config.ts` 對 `LIVE_URL` 執行。
- `flow:status` 在設定 `LIVE_URL` 時一併跑線上驗收測試。

## 測試

| 編號 | 測試 |
|---|---|
| S4-1 | 線上頁面的 `<meta name="commit">` 等於 `EXPECTED_SHA`（預設 `git ls-remote origin refs/heads/main`） |
| S4-2 | 兩個獨立瀏覽器 context 在線上網址建房、加入、開始，自動對打到出現遊戲結束畫面 |

## 需要尊上操作或同意的事

- GitHub repo secrets：`VITE_FIREBASE_API_KEY`、`VITE_FIREBASE_AUTH_DOMAIN`、`VITE_FIREBASE_PROJECT_ID`、`VITE_FIREBASE_APP_ID`。
- repo 的 Pages 來源設為 GitHub Actions。
- `firebase deploy --only firestore:rules` 部署到正式 Firebase 專案；正式專案需啟用匿名登入。
- 合併 v2 到 main 並 push。
