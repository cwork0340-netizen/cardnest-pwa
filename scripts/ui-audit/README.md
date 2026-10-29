# 按鈕稽核（改版前後各跑一次）

兩支腳本用真的瀏覽器操作 App，補單元測試看不到的問題：

| 腳本 | 做什麼 | 抓得到什麼 |
|---|---|---|
| `covered-audit.cjs` | 每個畫面的每個按鈕都捲到畫面中央，看點得到嗎 | 被浮動按鈕、導覽列蓋住而點不到的按鈕 |
| `click-audit.cjs` | 每個按鈕各開一個全新資料的頁面點一下，記錄換頁、開彈窗、資料變動、提示、錯誤 | 點了沒反應（`NO_EFFECT`）、點了出錯（`ERROR`） |

```bash
npm run build && npx vite preview --port 5198 &
node scripts/ui-audit/covered-audit.cjs http://localhost:5198/        # 約 1 分鐘，應該顯示「被蓋住：0」
node scripts/ui-audit/click-audit.cjs http://localhost:5198/ out.json  # 很久（幾百個按鈕），可用第三個參數只跑某幾個場景
```

環境變數：`PLAYWRIGHT_CORE`（playwright-core 的路徑）、`CHROMIUM`（瀏覽器執行檔）。
資料用 `seed.cjs`（5 張卡、訂閱、分期、儲蓄、一張有部分繳款的國泰帳單），日期固定在 2026-10-29。

結果怎麼看：`NO_EFFECT` 不一定是壞的（例如目前已選中的分頁、外部連結、檔案選擇器），要逐項判斷。
彈窗開著時，彈窗外的按鈕點不到是正常的（`FAIL`）。
