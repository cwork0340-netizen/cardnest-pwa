# CardNest 財務模型設計書：統一義務模型 × 信封理財法 × 資產負債清晰

> 狀態：草案，待審。本文件只談設計，不含實作。

## 1. 背景與目標

目前 app 有三個彼此獨立、但本質相近的概念：**分期**、**訂閱**、**必繳清單**。
使用者觀察到它們其實都是「每月要不要付的一筆錢」，差別只在「有沒有終點」與「金額固不固定」。

本設計要回答兩個目標問題：

1. **信封理財法**：能否把每月預算切成分類「信封」，事前分配、花完就停？
2. **資產負債清晰**：能否一眼看出「我每月要付多少（現金流）」與「我總共還欠多少（負債）」？

結論先講：**方向可行**，但要補兩塊拼圖——①分類信封預算、②未償負債總覽——並把三個概念統一成單一資料模型。

---

## 2. 現況盤點

目前 localStorage（`cardnest_v1`）儲存：

```text
cards[]        { id, name, color, billingDay, dueDay, budget }
plans[]        訂閱: { id, type:'subscription', name, card, currency, amount, period:'月',
                       nextDate, daysLeft, status, active, [amountOriginal, usdRate, feeRate] }
               分期: { id, type:'installment', name, card, amount, period:'期',
                       paidCount, totalCount, nextDate, daysLeft, status, paid }
transactions[] { id, name, card, category, amount, date }
checklist[]    { id, name, amount, day, done }
checklistMonth 'YYYY-M'（月初重置用）
fxSettings     { usdRate, feeRate }
```

現有彙總邏輯（`computeDashboard`）：

- 本月已記錄刷卡 = Σ transactions.amount
- 總額度 = Σ cards.budget（**以「卡片」為單位，不是分類**）
- 分類統計 = 由 transactions 事後分群（**只有實際，沒有預算**）
- 本月固定扣款 = 分期(未付)＋訂閱 ＋ 必繳(未繳)
- 本月預估帳單 = 已記錄刷卡 ＋ 本月固定扣款

**缺口**：
- 沒有「分類層級的事前預算」→ 還不是信封法。
- 沒有「未償負債總額」彙總 → 資產負債不清晰（分期的剩餘總額只散在各卡片）。

---

## 3. 核心概念：統一「週期性義務（Obligation）」

把分期 / 訂閱 / 必繳合併成單一型別，用兩個維度區分：

| 維度 | 分期 | 訂閱 | 必繳 |
|---|---|---|---|
| 有沒有終點（`totalPeriods`） | 有（N 期） | 無（null） | 無（null） |
| 金額 | 固定 | 多半固定 | 可能浮動 |
| 財務性質 | **負債** | 經常性支出 | 經常性支出 |

操作邏輯統一為：**每月「打勾＝這個月付了」**。

- 分期：打勾 → 累計期數 +1、本月已繳；月初重置「本月已繳」，但累計期數保留。
- 訂閱／必繳：打勾 → 本月已繳；月初重置。

這正好把目前兩套 handler（分期 `handleMarkPaid` 的 `paidCount±1`、必繳 `toggle done` ＋ 月初重置）收斂成同一套。

---

## 4. 資料模型

### 4.1 Obligation（取代 plans + checklist）

```text
obligation {
  id              string
  kind            'installment' | 'subscription' | 'necessary'
  name            string
  category        string        // 信封分類：居住/餐飲/訂閱/交通/娛樂/其他…
  necessity       'necessary' | 'flexible'   // 必要 vs 想要（多數義務 = necessary）
  card            string | null // 綁定卡片；必繳可為 null（現金/轉帳）
  currency        'TWD' | 'USD'
  amount          number        // 每期/每月「台幣」金額（USD 已折算）
  amountOriginal? number        // currency==='USD' 時的原幣金額
  usdRate?        number
  feeRate?        number

  // 終點與進度
  totalPeriods    number | null // null = 無限（訂閱/必繳）
  paidPeriods     number        // 累計已繳期數（分期核心；訂閱可選作付款月數）

  // 本月狀態（每月重置）
  paidThisMonth   boolean
  dueDay?         number        // 每月幾號（必繳/訂閱）
  nextDate?       string        // 顯示用「下次扣款 6/15」

  lastResetMonth  string        // 'YYYY-M'
}
```

衍生欄位（不存，計算得出）：

- `isActive`（本月是否仍需付）：
  - installment → `paidPeriods < totalPeriods`
  - subscription / necessary → 永遠 true（除非使用者停用，見開放問題）
- `remainingPeriods` = `totalPeriods - paidPeriods`（僅 installment）
- `outstanding`（未償負債）= `remainingPeriods * amount`（僅 installment，其餘為 0）

### 4.2 Envelope（分類信封預算，新增）

```text
envelope {
  id            string
  name          string        // 對應 obligation/transaction 的 category
  necessity     'necessary' | 'flexible'
  monthlyBudget number        // 該信封每月額度
}
```

> 信封 = 分類預算。必要信封（居住/水電/訂閱…）多由義務自動填入；彈性信封（餐飲/娛樂…）由刷卡消耗。

---

## 5. 兩大彙總引擎（關鍵：負債與現金流必須分流）

### 引擎 A：本月現金流（Cash Flow）

> 「這個月總共要付多少？」三種義務都算。

```text
本月已記錄刷卡   = Σ transactions(本月).amount
本月待繳義務     = Σ obligations where (isActive && !paidThisMonth).amount
本月預估帳單     = 本月已記錄刷卡 + 本月待繳義務
```

對應首頁 HeroStatusCard（目前已實作前述邏輯的簡化版，遷移後沿用）。

### 引擎 B：未償負債（Liabilities）

> 「我總共還欠多少？」**只有分期算**。訂閱/必繳沒有「未來總欠款」，不可計入，否則虛增負債。

```text
分期未償總額 = Σ obligations(kind==='installment') 的 outstanding
            = Σ (totalPeriods - paidPeriods) * amount
（未來可擴充）+ 信用卡未繳餘額、其他借款
```

呈現：新增「**負債總覽**」（卡片或頁面），列出每筆分期剩餘期數、剩餘金額、預估清償月份，並加總。

> 設計原則：**現金流看「流量」，負債看「存量」**。同一筆分期，這個月的一期算進現金流，尚未付的所有期算進負債存量，互不混淆。

---

## 6. 信封理財法落地

### 6.1 分類即信封

每個 `category` 對應一個 `envelope`，有月額度。

### 6.2 信封本月已用 = 義務 + 刷卡

```text
envelope.used(本月) = Σ transactions(本月, 該分類).amount
                    + Σ obligations(該分類, isActive).amount   // 必要支出預先佔用信封
envelope.remaining   = monthlyBudget - used
```

> 例：「居住」信封額度 15,000，房租必繳 15,000 → 一開月就佔滿，提醒使用者居住信封已無彈性空間。

### 6.3 必要 vs 想要

- 必要信封 = `necessity==='necessary'` 的分類（居住、水電、訂閱、保險…）。
- 彈性信封 = `flexible`（餐飲、娛樂、購物…）。
- 首頁可拆兩條：**必要支出（多為義務）** vs **彈性支出（可控）**，呼應信封法「先付給必要、剩下才是可花的」。

### 6.4 呈現

- 設定頁：新增「分類信封預算」編輯（分類名、必要/想要、月額度）。
- 分類頁 / 首頁：由現在的「事後佔比」升級成「**已花 X / 額度 Y**」的信封條（沿用 ProgressBar，超支轉紅）。

---

## 7. 資訊架構（IA）與 UI 變更

| 現況 | 提案 |
|---|---|
| Tab「訂閱分期」 | Tab「固定支出」：本月所有義務的待繳清單（可勾），分期額外顯示期數進度條 |
| Tab「必繳」 | 併入「固定支出」（依 necessity / kind 分組），不再獨立 |
| 首頁 | 新增「**負債總覽**」區塊（分期未償總額）＋ 信封式預算條 |
| 設定 | 新增「分類信封預算」 |

> 註：併頁會讓底部導覽從 5 格回到 4 格，版面更穩。是否併頁見開放問題。

---

## 8. 月初重置與期數推進

```text
on app load:
  monthKey = `${year}-${month}`
  for each obligation where lastResetMonth !== monthKey:
      obligation.paidThisMonth = false      // 新的一月，全部回到「待繳」
      obligation.lastResetMonth = monthKey
      // paidPeriods 不動（累計）

on 勾選「本月已繳」(toggle):
  paidThisMonth = !paidThisMonth
  if kind==='installment':
      paidPeriods += paidThisMonth ? +1 : -1   // 夾在 0..totalPeriods
```

> 與現行 `checklistMonth` 機制一致，差別是改為「每筆義務各自記 `lastResetMonth`」，較精準。

---

## 9. 遷移策略（向後相容）

載入舊資料時，一次性轉成 `obligations`，不破壞既有 localStorage：

```text
subscription plan → { kind:'subscription', totalPeriods:null, paidPeriods:0,
                      category:'訂閱', necessity:'necessary',
                      paidThisMonth:false, ...金額/卡片/幣別沿用 }
installment plan  → { kind:'installment', totalPeriods:totalCount,
                      paidPeriods:paidCount, paidThisMonth:plan.paid,
                      category:'分期', necessity:'necessary', ... }
checklist item    → { kind:'necessary', totalPeriods:null, dueDay:day,
                      paidThisMonth:done, category:推斷或'其他', necessity:'necessary' }
```

信封預設：依現有分類給一組合理預設額度，使用者可調。保留 `cards[].budget` 作為「卡片額度」輔助視角（與信封並存，非互斥）。

---

## 10. 邊界情況與一致性

- **USD**：`amount` 一律存折算後台幣，原幣放 `amountOriginal`，與現行 AddPlanForm 一致。
- **重複計算**：義務 ≠ 交易。勾選義務「已繳」**不自動產生 transaction**（預設），避免雙重計入現金流；若使用者想記錄實際刷卡日，提供「勾選時順手記一筆」的選項（見開放問題）。
- **無卡義務**：必繳（房租轉帳）可 `card:null`，不影響各卡額度，只進信封與現金流。
- **停用/結束**：訂閱可「停用」(`isActive=false`) 而非刪除，保留歷史。

---

## 11. 分階段實作路線圖

- **Phase 0（已完成）**：分期勾選同步 `paidCount`、期數進度條、必繳清單頁＋月初重置、必繳金額進首頁預估。
- **Phase 1：負債總覽**（最小、成效直接）
  - 新增彙總「分期未償總額」＋首頁/獨立卡列出各分期剩餘。純讀取現有資料，低風險。
- **Phase 2：分類信封預算**
  - 新增 `envelopes`、設定頁編輯、首頁/分類頁改信封條，加「必要 vs 彈性」拆分。
- **Phase 3：統一義務模型重構**
  - 引入 `obligations` 與遷移層，把 plans＋checklist 收斂；UI 併「固定支出」頁。風險最高，放最後。

> 建議順序 1 → 2 → 3：先拿到「資產負債清晰」與「信封法」的可見成效，最後才做底層重構，把風險留到價值已驗證之後。

---

## 12. 測試計畫（重點）

- 負債總額 = Σ 各分期剩餘期數×金額；訂閱/必繳不計入負債。
- 信封 used = 該分類交易＋該分類義務；超支轉紅。
- 月初重置：跨月 `paidThisMonth` 全歸 false，`paidPeriods` 不變。
- 遷移：舊 plans/checklist → obligations 後，現金流與既有顯示數字不變（回歸測試）。

---

## 13. 待你決策的開放問題

1. **併頁**：「訂閱分期」與「必繳」要不要併成單一「固定支出」頁？（併＝導覽更簡潔；不併＝改動小）
2. **勾選義務是否記一筆交易**：勾「本月已繳」要不要順手寫入 transactions（會影響「已記錄刷卡」是否含義務）？預設「不寫入、分開計算」。
3. **信封 vs 卡片額度**：兩種預算視角並存，或以信封為主、卡片額度淡化？
4. **訂閱要不要累計付款月數**（`paidPeriods` 對訂閱是否有意義，例如「已訂閱 14 個月」）？
5. **路線圖順序**：採建議的 1→2→3，或你想先做某一塊？
