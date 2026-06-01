# CardNest Design Package v1.0

**產品定位：** 安心型生活工具  
**用途：** 提供產品經理、工程師、UI/UX 設計師作為開發與驗收依據  
**定稿狀態：** v1.0 定稿版

> CardNest 是安心型生活工具，不是銀行 App、不是財務儀表板、不是可愛記帳 App。

---

# 00_README

## 文件包內容

```text
CardNest/
├── 00_Product/
│   └── CardNest_Product_Definition_v1.0.md
│
├── 01_Design/
│   ├── CardNest_Art_Direction_v1.0.md
│   ├── CardNest_AI_Visual_Prompts_v1.0.md
│   └── CardNest_Design_Assets_Index_v1.0.md
│
├── 02_Engineering/
│   └── CardNest_UI_Implementation_Spec_v1.0.md
│
└── 03_References/
    └── mockups/
```

## 核心設計一句話

CardNest 是一個溫柔整理信用卡帳務的小窩，讓使用者不是被帳單嚇到，而是安心知道下一步。

## 版本說明

| 版本 | 日期 | 狀態 |
|---|---|---|
| v1.0 | 2025-06 | 安心型生活工具定稿版 |

---

# 00_Product/CardNest_Product_Definition_v1.0.md

# CardNest 產品定義文件 v1.0

## 一、產品名稱

**CardNest**  
中文副標：**信用卡帳務小窩**

## 二、產品定位

CardNest 是一個個人信用卡帳務管理 PWA，協助使用者管理：

- 訂閱服務
- 分期付款
- 臨時刷卡
- 各信用卡預算
- 即將扣款與付款狀態

CardNest 不是銀行 App，也不是複雜記帳軟體，而是每天打開後能快速安心掌握信用卡狀況的生活工具。

## 三、目標用戶

- 持有 2 張以上信用卡的上班族
- 有 Netflix、Spotify、iCloud、YouTube Premium 等訂閱服務的人
- 有分期付款需求的人，例如手機、家電、課程
- 想掌握每月信用卡支出，但不想使用複雜記帳軟體的人

## 四、核心價值主張

> 不用打開每個銀行 App，一眼看懂這個月刷了多少、還剩多少、有什麼需要注意。

## 五、產品人格

CardNest 像一個溫柔的小管家：

- 會提醒，但不責備
- 會整理，但不壓迫
- 會翻譯數字，讓使用者知道下一步

## 六、MVP 功能範圍

### 必做

1. Google 登入
2. Dashboard 總覽
3. 計畫管理：訂閱與分期
4. 刷卡記錄
5. 快速記帳
6. 信用卡設定
7. Google Sheets 資料連結
8. 基本狀態提示：即將到期、逾期、超出預算

### 第一版可延後

1. 深色模式
2. 行銷 Landing Page
3. 進階統計分析
4. 多幣別
5. 自動讀取銀行資料
6. AI 分析消費建議

## 七、頁面架構

```text
登入頁
總覽
計畫
刷卡
設定
```

## 八、Dashboard 首頁任務

使用者打開首頁後，3 秒內要知道：

1. 這個月是否安全
2. 有沒有需要處理的付款
3. 還有多少可用額度
4. 哪張卡或哪類支出需要留意

## 九、MVP 驗收標準

### Dashboard

- 使用者是否能 3 秒內看懂本月狀態
- 是否知道有沒有即將扣款或逾期
- 是否清楚看到還有多少可以使用
- 是否避免讓首頁像財務報表

### Plans

- 訂閱與分期是否能一眼分辨
- 分期是否清楚看到已付幾期、剩幾期
- 打勾付款是否有完成感

### Transactions

- 是否能 3 秒內記一筆
- 金額是否是第一個輸入欄位
- 日期與信用卡是否有預設值

### Settings

- 信用卡設定是否清楚
- Google Sheets 連結是否明顯
- 登出是否有二次確認

## 十、不做什麼

CardNest 第一版不做：

- 銀行資料自動串接
- 投資理財分析
- 複雜預算模型
- 專業會計報表
- 過度遊戲化
- 嚴厲警告式財務控管

---

# 01_Design/CardNest_Art_Direction_v1.0.md

# CardNest 美術設計規格書 v1.0

## 一、產品美術定調

CardNest 是安心型生活工具。  
整體感覺要溫暖、清楚、柔和、有信任感。

它不是：

- 銀行 App
- 財務儀表板
- 股市 App
- 可愛記帳 App
- 工程後台

它是：

> 每天早上打開會安心看一下的信用卡帳務小窩。

## 二、設計核心原則

### 1. 安心優先

首頁不是展示資料，而是幫使用者判斷狀態。

### 2. 每個數字都要有人話

不要只顯示百分比或金額，要搭配結論。

例如：

```text
還有 NT$7,620 可以使用
目前還在安全範圍內
```

### 3. 功能標題生活化

| 避免使用 | 建議使用 |
|---|---|
| 7 天內即將到期 | 今天需要注意 |
| 本月預算使用狀態 | 本月可用額度 |
| 各卡本月消費 | 各卡狀態 |
| 本月消費分類 | 本月花在哪 |
| 近 7 個月趨勢 | 最近 7 個月 |
| 刷卡記錄 | 刷卡 |

## 三、色彩系統

```css
:root {
  --color-bg: #F8F5EF;
  --color-surface: #FFFFFF;
  --color-surface-warm: #FFFCF7;

  --color-primary: #5E7CE2;
  --color-primary-hover: #4D6FD8;
  --color-primary-soft: #EEF2FF;

  --color-text-main: #2F2A25;
  --color-text-secondary: #7C746B;
  --color-text-muted: #AAA198;

  --color-border: rgba(47, 42, 37, 0.08);
  --color-border-strong: rgba(47, 42, 37, 0.14);

  --color-success: #6FA37C;
  --color-success-soft: #EAF5EE;

  --color-warning: #D49A45;
  --color-warning-soft: #FFF4DE;

  --color-danger: #D96B5F;
  --color-danger-soft: #FCEBE8;

  --color-subscription: #5E7CE2;
  --color-installment: #D49A45;
  --color-transaction: #6FA37C;

  --shadow-card: 0 8px 28px rgba(72, 56, 38, 0.06);
  --shadow-floating: 0 12px 32px rgba(72, 56, 38, 0.12);
}
```

## 四、字體

建議：

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans TC", "PingFang TC", sans-serif;
```

字級：

| 用途 | 字級 | Weight |
|---|---:|---:|
| 本月總金額 | 40px | 700 |
| 頁面標題 | 24–28px | 700 |
| Section 標題 | 18px | 700 |
| 卡片標題 | 16px | 600 |
| 一般文字 | 15–16px | 400 |
| 輔助文字 | 13–14px | 400 |
| Badge | 12px | 600 |

## 五、Layout

```css
:root {
  --page-padding-x: 20px;
  --section-gap: 24px;
  --card-gap: 12px;
  --card-padding: 16px;
  --hero-padding: 20px;

  --radius-card: 24px;
  --radius-hero: 28px;
  --radius-button: 16px;
  --radius-pill: 999px;
  --radius-sheet: 28px;
}
```

## 六、Dashboard 設計

### 資訊順序

```text
1. Header
2. Hero：本月安心狀態
3. 今天需要注意
4. 本月可用額度
5. 各卡狀態
6. 本月花在哪
7. 最近 7 個月
```

### Header

```text
早安，Chia
六月帳務 · 剛剛同步
```

### Hero 正常狀態

```text
六月目前很穩
目前都在安全範圍內

NT$42,380

比上月多 NT$3,240
還有 NT$7,620 可以使用
```

Hero CSS：

```css
.hero-card {
  background:
    radial-gradient(circle at 85% 20%, rgba(94,124,226,.14), transparent 32%),
    linear-gradient(180deg, #FFFFFF 0%, #F1F4FF 100%);
  border-radius: 28px;
  padding: 20px;
  box-shadow: var(--shadow-card);
}
```

### 今天需要注意

```text
Netflix
明天會扣款 · 永豐卡
NT$390
1 天

Spotify
3 天後扣款 · 玉山卡
NT$180
3 天
```

### 本月可用額度

```text
還有 NT$7,620 可以使用
目前還在安全範圍內

已使用 84%
NT$42,380 / NT$50,000
```

### 各卡狀態

每張卡一定要有一句狀態：

```text
還有 NT$1,760 可用
比上月少 NT$860
接近預算上限
已超出 NT$800
```

## 七、插圖方向

### Hero 小熊

- 白色小熊
- 安靜表情
- 手拿小帳本或杯子
- 柔和 editorial illustration
- 不要太幼稚
- 不要兒童 App 吉祥物感
- 插圖不可搶過金額

### 空狀態插圖

- 小月曆
- 信用卡
- 收據
- 小帳本
- 米白背景
- 柔和水彩或 editorial illustration
- 不要 3D

## 八、文案語氣

### 建議

```text
目前都在安全範圍內
照平常節奏就好
還有 NT$7,620 可以使用
接下來幾天可以稍微留意
已幫你記好了
這期已標記付款
新的計畫已加入
```

### 避免

```text
超標！
逾期！
警告！
付款失敗！
操作成功！
預算不足！
```

---

# 02_Engineering/CardNest_UI_Implementation_Spec_v1.0.md

# CardNest UI Engineering Spec v1.0

## 一、Design Tokens

```css
:root {
  --color-bg: #F8F5EF;
  --color-surface: #FFFFFF;
  --color-surface-warm: #FFFCF7;
  --color-primary: #5E7CE2;
  --color-primary-hover: #4D6FD8;
  --color-primary-soft: #EEF2FF;
  --color-text-main: #2F2A25;
  --color-text-secondary: #7C746B;
  --color-text-muted: #AAA198;
  --color-border: rgba(47, 42, 37, 0.08);
  --color-border-strong: rgba(47, 42, 37, 0.14);
  --color-success: #6FA37C;
  --color-success-soft: #EAF5EE;
  --color-warning: #D49A45;
  --color-warning-soft: #FFF4DE;
  --color-danger: #D96B5F;
  --color-danger-soft: #FCEBE8;
  --color-subscription: #5E7CE2;
  --color-installment: #D49A45;
  --color-transaction: #6FA37C;
  --shadow-card: 0 8px 28px rgba(72, 56, 38, 0.06);
  --shadow-floating: 0 12px 32px rgba(72, 56, 38, 0.12);

  --page-padding-x: 20px;
  --section-gap: 24px;
  --card-gap: 12px;
  --card-padding: 16px;
  --hero-padding: 20px;
  --radius-card: 24px;
  --radius-hero: 28px;
  --radius-button: 16px;
  --radius-pill: 999px;
  --radius-sheet: 28px;
}
```

## 二、Global

```css
body {
  background: var(--color-bg);
  color: var(--color-text-main);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans TC", "PingFang TC", sans-serif;
}
```

Main mobile container:

```css
.app-page {
  max-width: 430px;
  margin: 0 auto;
  padding: 16px 20px 96px;
}
```

## 三、Component List

請優先建立：

```text
AppShell
BottomNav
PageHeader
HeroStatusCard
SectionHeader
NoticeList
NoticeItem
BudgetCard
ProgressBar
CreditCardSummaryCard
CategoryBreakdownCard
TrendChartCard
PlanCard
TransactionItem
BottomSheet
QuickTransactionForm
StatusBadge
Toast
EmptyState
SkeletonCard
```

## 四、Card

```css
.card {
  background: var(--color-surface);
  border-radius: var(--radius-card);
  padding: var(--card-padding);
  box-shadow: var(--shadow-card);
  border: 1px solid rgba(47, 42, 37, 0.04);
}
```

## 五、Button

```css
.button-primary {
  height: 52px;
  border-radius: var(--radius-button);
  background: var(--color-primary);
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 600;
}

.button-secondary {
  height: 48px;
  border-radius: var(--radius-button);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 15px;
  font-weight: 600;
}

.button-danger-outline {
  height: 48px;
  border-radius: var(--radius-button);
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
  background: transparent;
}
```

## 六、Badge

```css
.badge {
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.badge-success {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.badge-warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.badge-danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.badge-neutral {
  background: #F2EFE9;
  color: var(--color-text-secondary);
}
```

## 七、Progress Bar

```css
.progress-track {
  height: 8px;
  background: #E8EDF8;
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 240ms ease;
}
```

狀態色：

```text
safe: #5E7CE2 或 #6FA37C
warning: #D49A45
danger: #D96B5F
```

## 八、Bottom Navigation

Items:

```text
總覽
計畫
刷卡
設定
```

```css
.bottom-nav {
  height: 76px;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(47, 42, 37, 0.08);
}

.bottom-nav-item-active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  border-radius: 999px;
}
```

## 九、Dashboard

資訊順序必須為：

```text
1. Header
2. HeroStatusCard
3. 今天需要注意
4. 本月可用額度
5. 各卡狀態
6. 本月花在哪
7. 最近 7 個月
```

### HeroStatusCard

```css
.hero-card {
  background:
    radial-gradient(circle at 85% 20%, rgba(94,124,226,.14), transparent 32%),
    linear-gradient(180deg, #FFFFFF 0%, #F1F4FF 100%);
  border-radius: 28px;
  padding: 20px;
  box-shadow: var(--shadow-card);
}
```

文案：

```text
六月目前很穩
目前都在安全範圍內
NT$42,380
比上月多 NT$3,240
還有 NT$7,620 可以使用
```

## 十、Plans

### Tab

```text
全部 / 訂閱 / 分期
```

```css
.segmented-tabs {
  background: #F2EFE9;
  border-radius: 999px;
  padding: 4px;
}

.segmented-tab-active {
  background: #FFFFFF;
  color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(72, 56, 38, 0.06);
}
```

### PlanCard

訂閱：

```text
Netflix
永豐卡
NT$390 / 月
下次扣款 6/8，明天
```

分期：

```text
iPhone 15 分期
中信 LINE Pay 卡
NT$2,450 / 期
已付 8 / 24 期
還剩 16 期
```

付款完成 Toast：

```text
這期已標記付款
```

## 十一、Transactions

FAB：

```text
＋ 記一筆
```

```css
.fab {
  position: fixed;
  right: 20px;
  bottom: 88px;
  height: 52px;
  padding: 0 18px;
  border-radius: 999px;
  background: var(--color-primary);
  color: #FFFFFF;
  box-shadow: var(--shadow-floating);
}
```

Bottom Sheet 欄位順序：

```text
1. 金額
2. 分類
3. 信用卡
4. 日期
5. 備註
```

成功 Toast：

```text
已幫你記好了
```

## 十二、Settings

信用卡卡片顯示：

```text
卡名
帳單日
繳款期限
預算上限
```

登出：

- danger outline
- 二次確認

確認文案：

```text
確定要登出嗎？
你的資料仍會保留在 Google Sheets。
```

## 十三、Toast 文案

| 情境 | Toast |
|---|---|
| 新增刷卡 | 已幫你記好了 |
| 新增計畫 | 新的計畫已加入 |
| 付款完成 | 這期已標記付款 |
| 刪除完成 | 已從清單移除 |
| 同步失敗 | 同步沒有成功，稍後再試一次 |

## 十四、互動

- Bottom Sheet 從底部滑入
- Toast 顯示於 Bottom Nav 上方
- Skeleton Loading 不要空白畫面
- 狀態變更要有柔和 transition
- 打勾付款要有完成動畫

---

# 01_Design/CardNest_AI_Visual_Prompts_v1.0.md

# CardNest AI Visual Prompts v1.0

## 一、Hero 小熊插圖

```text
A warm editorial illustration for a mobile finance lifestyle app, featuring a small calm white bear holding a tiny notebook or warm cup, sitting beside soft green leaves and subtle cream-colored shapes. The mood is reassuring, quiet, gentle, and trustworthy. Use warm cream background, soft blue accents, muted amber highlights, delicate shadows, minimal details, premium lifestyle illustration style, not childish, not cartoon mascot, not 3D, not overly cute, not corporate banking. Leave enough negative space for financial numbers on the left side. Mobile app hero card composition.
```

## 二、登入頁插圖

```text
A warm editorial illustration for a personal credit card expense tracking app login screen, showing a soft cream-colored desk with a credit card, monthly calendar, small checklist, coffee cup, and a few simple receipts neatly arranged. Calm and trustworthy mood, warm beige background, soft natural lighting, gentle shadows, subtle hand-drawn texture, modern minimal lifestyle illustration, not childish, not corporate banking, not 3D, not overly colorful. Color palette: cream white, warm beige, soft blue, muted amber. Vertical mobile app composition, plenty of negative space at the top for logo and app name, clean and premium but approachable.
```

## 三、空狀態插圖

```text
A gentle empty state illustration for a mobile finance tracking app, featuring a small calendar, a credit card, a pencil, and a checklist with one soft checkmark. Warm cream background, cozy minimal desk scene, soft watercolor texture mixed with clean editorial illustration style, calm and reassuring, muted blue and amber accents, no people, no text, no logos, not childish, not cartoonish, not 3D, suitable for a premium yet friendly productivity app.
```

## 四、App Icon Prompt

```text
A minimal app icon for a warm personal credit card management app named CardNest. Show a simple rounded white bear face or small bear holding a credit card, inside a soft rounded square. Warm cream background, soft blue accent, gentle shadow, clean premium lifestyle app style. Calm, trustworthy, friendly, not childish, not banking, not 3D, not overly detailed. Suitable for iOS app icon.
```

## 五、避免事項

```text
Do not use black and gold luxury banking style.
Do not use 3D coins or crypto elements.
Do not use stock market charts.
Do not make the bear too childish.
Do not use harsh red warning colors.
Do not make the design look like a free template.
Do not overcrowd the composition.
```

---

# 01_Design/CardNest_Design_Assets_Index_v1.0.md

# CardNest Design Assets Index v1.0

## 一、Figma

```text
Figma link: TBD
Owner: TBD
Last updated: TBD
```

## 二、Mockups

```text
03_References/mockups/
```

建議保存：

- Dashboard mockup
- Multi-screen visual mockup
- Login page mockup
- Plans page mockup
- Transactions page mockup
- Settings page mockup

## 三、Logo / App Icon

```text
Logo SVG: TBD
App Icon 1024x1024: TBD
App Icon iOS sizes: TBD
PWA icons: TBD
```

## 四、Illustrations

```text
Hero bear illustration: TBD
Login illustration: TBD
Empty state illustration - Plans: TBD
Empty state illustration - Transactions: TBD
```

## 五、Fonts

```text
Primary: system-ui / SF Pro / Noto Sans TC / PingFang TC
Optional: LINE Seed Sans TC
```

## 六、Version Log

| Version | Date | Notes |
|---|---|---|
| v1.0 | 2025-06 | 安心型生活工具定稿版 |

