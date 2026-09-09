import { useState, useCallback, useEffect, useRef } from 'react'
import BottomNav from './components/BottomNav'
import Toast from './components/Toast'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Settings from './pages/Settings'
import Checklist from './pages/Checklist'
import Onboarding from './pages/Onboarding'
import { maybeNotifyDueBills } from './utils/notify'
import { getAccessToken } from './utils/googleSheetSync'
import { categoryColor } from './utils/categoryColors'
import {
  fetchImportRows, findImportedTransaction, importedConsumedDate, importedPostedDate,
  isUsableImportRow, resolveImportedCardResult, summarizeImportRowsByBank, describeSkippedRow,
  isImportedTransaction, isPendingReconciliation, SKIP_REASON_INVALID_ROW,
} from './utils/importSheetSync'
import { nextOccurrence, daysUntil, formatMD, statusForDaysLeft, dayFromMD } from './utils/recurrence'
import { applyCycleUpdate, ensureBillingCycles, unpaidCycles, totalUnpaid, daysUntilDue, withLiveCycleEstimates } from './utils/billingCycles'
import { buildCardForecast } from './utils/cardForecast'
import { getSalarySchedule, normalizeSalarySettings } from './utils/salarySchedule'
import {
  ensureInstallmentOccurrences, unpaidInstallmentOccurrences, paidCountOf,
  daysUntilDue as daysUntilInstallmentDue,
} from './utils/installmentCycles'
import {
  getCardName,
  isSameMonth,
  isBillableTransaction,
  isCreditCardPayment,
  isInstallmentConversionCredit,
  matchesCard,
  normalizeFinanceData,
  parseISODate,
  installmentAmountNotRecordedInWindow,
  planAmountNotRecorded,
  resolveCardId,
  toISODate,
  transactionCycleDate,
} from './utils/financeData'

/* eslint-disable react-hooks/set-state-in-effect */

const STORAGE_KEY = 'cardnest_v1'

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeFinanceData(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getGreeting(hour) {
  if (hour < 5) return '夜深'
  if (hour < 11) return '早安'
  if (hour < 13) return '午安'
  if (hour < 18) return '午後好'
  return '晚安'
}

// 每月幾號扣款／繳款的錨點：新資料用 billingDay，舊資料從 nextDate 字串推回去
function billingDayOf(plan) {
  return plan.billingDay ?? dayFromMD(plan.nextDate) ?? 1
}

// 把訂閱／分期的下次發生日、剩餘天數、狀態，每次渲染都即時算一次，
// 不再相信新增當下凍結進資料裡的 nextDate / daysLeft / status，
// 這樣日期就不會卡在建立當天，永遠跟著「今天」往後跑。
function enrichPlans(plans) {
  return plans.map(p => {
    if (p.type === 'installment') {
      const unpaid = unpaidInstallmentOccurrences(p)
      const paidCount = paidCountOf(p)
      const next = unpaid[0]
      if (!next) {
        // 已經全部繳完（或還沒補齊資料），維持既有欄位不強行覆寫
        return { ...p, paidCount, unpaidOccurrences: unpaid }
      }
      const daysLeft = daysUntilInstallmentDue(next)
      return {
        ...p,
        paidCount,
        nextDate: `${Number(next.dueDate.slice(5, 7))}/${Number(next.dueDate.slice(8, 10))}`,
        daysLeft,
        status: statusForDaysLeft(daysLeft),
        unpaidOccurrences: unpaid,
      }
    }
    const billingDay = billingDayOf(p)
    const next = nextOccurrence(billingDay)
    const daysLeft = daysUntil(next)
    return { ...p, billingDay, nextDate: formatMD(next), daysLeft, status: statusForDaysLeft(daysLeft) }
  })
}

// 建立本週（週日起算）七天的扣款行事曆，事件以卡片顏色標示
function buildWeekDays(plans, cards) {
  const colorByCard = {}
  const colorByCardId = {}
  cards.forEach(c => { colorByCard[c.name] = c.color })
  cards.forEach(c => { colorByCardId[c.id] = c.color })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay()) // 週日
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    return { date, isToday: date.getTime() === today.getTime(), events: [] }
  })

  plans.forEach(p => {
    const stillActive = p.type === 'subscription'
      ? (p.active ?? true)
      : (paidCountOf(p) < p.totalCount)
    if (!stillActive) return
    const dt = nextOccurrence(billingDayOf(p))
    dt.setHours(0, 0, 0, 0)
    if (dt < weekStart || dt >= weekEnd) return
    const idx = Math.round((dt - weekStart) / 86400000)
    days[idx].events.push({
      id: p.id,
      name: p.name,
      card: getCardName(p, cards),
      amount: p.amount,
      color: colorByCardId[resolveCardId(p, cards)] ?? colorByCard[p.card] ?? '#A98274',
    })
  })

  return days
}

// 刷卡記錄的 date 是 "M/D" 顯示字串（沒有年份），跟現在比對月份即可判斷是不是本期
function isThisMonth(displayDate, from = new Date()) {
  return isSameMonth(displayDate, from)
}

// 把沒有年份的 "M/D" 還原成跟 near 最接近的完整日期，避免跨年誤判（例如 12 月帳單週期跨到 1 月）
function resolveNearDate(displayDate, near) {
  return parseISODate(displayDate, near)
}

// 依「結帳日」算出目前所在帳單週期的邊界：上次結帳日（本期帳單截止點）、上上次結帳日（上期帳單起點）
function billingCycleBounds(billingDay, today) {
  if (!billingDay) return null
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
  const lastBillingDate = d >= billingDay ? new Date(y, m, billingDay) : new Date(y, m - 1, billingDay)
  const prevBillingDate = new Date(lastBillingDate.getFullYear(), lastBillingDate.getMonth() - 1, billingDay)
  return { prevBillingDate, lastBillingDate }
}

function computeDashboard(transactions, cards, fixedMonthlyAmount = 0, plans = []) {
  // 本月：只算正數金額（退款、繳款、分期沖銷都是負數，不是消費）
  const monthTx = transactions.filter(tx => Number(tx.amount) > 0 && isThisMonth(tx.date))
  const totalSpent = monthTx.reduce((s, tx) => s + tx.amount, 0)
  const totalBudget = cards.reduce((s, c) => s + c.budget, 0)
  // 本月支出 = 已記錄刷卡 + 訂閱／分期（首頁＝刷卡狀態，不含必繳清單）
  const monthlyOut = totalSpent + fixedMonthlyAmount
  const remaining = Math.max(0, totalBudget - monthlyOut)
  const pct = totalBudget > 0 ? monthlyOut / totalBudget : 0
  const status = pct < 0.7 ? 'safe' : pct < 0.9 ? 'warning' : 'danger'
  const monthName = MONTH_NAMES[new Date().getMonth()]

  const today = new Date()
  const enrichedCards = cards.map(card => {
    const allCardTx = transactions.filter(tx => matchesCard(tx, card))
    const cardTx = allCardTx.filter(isBillableTransaction)
    const bounds = billingCycleBounds(card.billingDay, today)
    // 同一張卡有好幾個「這個月花多少」，看的東西不一樣，不要混用：
    // used＝上一期帳單（結帳日之前）的消費；currentCycleAmount＝本月已被銀行入帳的；
    // currentCyclePurchaseAmount＝本月刷了多少（不管入帳沒）；
    // currentCyclePendingAmount＝其中還沒入帳的那部分。
    let used, currentCycleAmount, currentCyclePurchaseAmount, currentCyclePendingAmount
    const monthPurchases = cardTx.filter(tx => isThisMonth(tx.date, today))
    const monthPostedAmount = cardTx
      .filter(tx => tx.postedDate && isThisMonth(tx.postedDate, today))
      .reduce((s, tx) => s + tx.amount, 0)
    const monthPurchaseAmount = monthPurchases.reduce((s, tx) => s + tx.amount, 0)
    const monthPendingAmount = monthPurchases
      .filter(tx => !tx.postedDate)
      .reduce((s, tx) => s + tx.amount, 0)
    if (bounds) {
      used = cardTx
        .filter(tx => { const dt = resolveNearDate(transactionCycleDate(tx), today); return dt && dt > bounds.prevBillingDate && dt <= bounds.lastBillingDate })
        .reduce((s, tx) => s + tx.amount, 0)
      currentCycleAmount = monthPostedAmount
      currentCyclePurchaseAmount = monthPurchaseAmount
      currentCyclePendingAmount = monthPendingAmount
    } else {
      // 沒設結帳日：退回用日曆月當作一期
      used = monthPurchaseAmount
      currentCycleAmount = monthPostedAmount
      currentCyclePurchaseAmount = monthPurchaseAmount
      currentCyclePendingAmount = monthPendingAmount
    }
    // 這一期進行中的訂閱／分期，給「本期累積」明細參考用（跟帳單週期歷史記錄是兩件事）
    const subsOnCard = plans
      .filter(p => p.type === 'subscription' && (p.active ?? true) && matchesCard(p, card))
      .reduce((s, p) => s + planAmountNotRecorded({
        plan: p,
        transactions,
        cards,
        windowStart: bounds?.lastBillingDate ?? new Date(today.getFullYear(), today.getMonth(), 1),
        windowEnd: today,
      }), 0)
    const monthEnd = endOfMonth(today)
    const instOnCard = plans
      .filter(p => p.type === 'installment' && matchesCard(p, card) && paidCountOf(p) < p.totalCount)
      .reduce((s, p) => s + installmentAmountNotRecordedInWindow({
        plan: p,
        transactions,
        cards,
        windowStart: bounds?.lastBillingDate ?? new Date(today.getFullYear(), today.getMonth(), 1),
        windowEnd: monthEnd,
      }), 0)
    const spendingWarningTotal = currentCyclePurchaseAmount + subsOnCard + instOnCard
    const cardRemaining = card.budget - spendingWarningTotal
    const cp = card.budget > 0 ? spendingWarningTotal / card.budget : 0
    const cardStatus = cp < 0.7 ? 'safe' : cp < 0.9 ? 'warning' : 'danger'

    // 待繳帳單的金額改成即時重算（已繳／已校準的期別除外，見 withLiveCycleEstimates），
    // 這樣晚到的對帳信件補進來的消費才進得了待繳帳單，不會跟 App 估算合計對不起來。
    const cardWithLiveCycles = withLiveCycleEstimates(card, { transactions, plans })
    const unpaid = unpaidCycles(cardWithLiveCycles)
    const unpaidTotal = totalUnpaid(cardWithLiveCycles)
    const unpaidWithDaysLeft = unpaid.map(c => ({ ...c, daysLeft: daysUntilDue(c) }))
    const postedDateCount = allCardTx.filter(tx => tx.postedDate && tx.postedDate !== tx.date).length
    const paymentCount = allCardTx.filter(isCreditCardPayment).length
    const installmentCreditCount = allCardTx.filter(isInstallmentConversionCredit).length
    const reconciliationHints = [
      postedDateCount > 0 && `${postedDateCount} 筆使用入帳日歸帳`,
      paymentCount > 0 && `${paymentCount} 筆繳款未列入消費`,
      installmentCreditCount > 0 && `${installmentCreditCount} 筆分期沖帳未列入消費`,
    ].filter(Boolean)

    // 固定顯示的下次結帳／繳款日：直接從卡片設定推算，不依賴有沒有未繳帳單，
    // 就算這期金額是 0 也看得到「這張卡每月何時結帳、何時要繳」
    const nextClose = nextOccurrence(Number(card.billingDay) || 1)
    const nextDue = new Date(nextClose)
    nextDue.setDate(nextDue.getDate() + (Number(card.dueDay) || 0))

    return {
      ...card, used, currentCycleAmount, currentCyclePurchaseAmount, currentCyclePendingAmount, spendingWarningTotal,
      subsOnCard, instOnCard,
      unpaidCycles: unpaidWithDaysLeft, unpaidTotal,
      reconciliationHints,
      nextCloseLabel: formatMD(nextClose),
      nextDueLabel: formatMD(nextDue),
      status: cardStatus,
      statusText: cardStatus === 'safe'
        ? `Remaining NT$${cardRemaining.toLocaleString()}`
        : cardStatus === 'warning' ? 'Approaching budget'
        : 'Over budget',
    }
  })

  const catMap = {}
  monthTx.forEach(tx => { catMap[tx.category] = (catMap[tx.category] ?? 0) + tx.amount })
  const categories = Object.entries(catMap)
    .map(([name, amount]) => ({
      name, amount,
      percent: totalSpent > 0 ? Math.round(amount / totalSpent * 100) : 0,
      color: categoryColor(name),
    }))
    .sort((a, b) => b.amount - a.amount)

  // 「最近 7 個月」要從所有交易算，不能從 monthTx——那個已經被篩成只剩本月，
  // 再照月份分組永遠只會分出一組，圖上就只有一根柱子，看不出任何趨勢。
  // 沒有花費的月份也要留成 0，不然 x 軸會把中間跳過去，看起來像連續的其實不是。
  const TREND_MONTHS = 7
  const trendBuckets = Array.from({ length: TREND_MONTHS }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (TREND_MONTHS - 1 - i), 1)
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      // 標籤用這一格自己的年份，不是今年——跨年之後去年的月份會被標成今年
      month: `${date.getMonth() + 1}/${date.getFullYear()}`,
      amount: 0,
    }
  })
  const trendIndex = new Map(trendBuckets.map((bucket, i) => [bucket.key, i]))
  transactions.forEach(tx => {
    if (!(Number(tx.amount) > 0)) return
    const date = parseISODate(tx.date, today)
    if (!date) return
    const i = trendIndex.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    if (i !== undefined) trendBuckets[i].amount += Number(tx.amount)
  })
  const trends = trendBuckets

  const estimatedTotal = totalSpent + fixedMonthlyAmount
  const currentMonth = {
    name: monthName,
    total: totalSpent,
    budget: totalBudget,
    remaining,
    fixedMonthlyAmount,
    estimatedTotal,
    status,
    statusText: status === 'safe' ? `${monthName} on track` : status === 'warning' ? `${monthName} near budget` : `${monthName} over budget`,
  }

  return { currentMonth, enrichedCards, categories, trends }
}

function buildReconciliationSummary({ transactions, cards, cardImport }) {
  const pendingTransactions = transactions.filter(isPendingReconciliation)
  const postedImportedCount = transactions.filter(tx => isImportedTransaction(tx) && tx.postedDate).length
  const adjustmentCount = transactions.filter(tx => isCreditCardPayment(tx) || isInstallmentConversionCredit(tx)).length
  const unmappedCount = Number(cardImport?.lastImportSkippedUnmapped ?? 0)

  const cardAlerts = cards.map((card) => {
    const pendingCount = pendingTransactions.filter(tx => matchesCard(tx, card)).length
    const hintCount = card.reconciliationHints?.length ?? 0
    const calibratedDiffs = (card.unpaidCycles ?? [])
      .filter(cycle => cycle.manuallyCalibrated && cycle.estimatedAmount != null)
      .map(cycle => Number(cycle.amount || 0) - Number(cycle.estimatedAmount || 0))
      .filter(diff => Math.abs(diff) >= 100)

    return {
      id: card.id,
      name: card.name,
      color: card.color,
      pendingCount,
      hintCount,
      diffCount: calibratedDiffs.length,
      largestDiff: calibratedDiffs.reduce((max, diff) => Math.abs(diff) > Math.abs(max) ? diff : max, 0),
    }
  }).filter(item => item.pendingCount > 0 || item.hintCount > 0 || item.diffCount > 0)

  return {
    pendingCount: pendingTransactions.length,
    postedImportedCount,
    adjustmentCount,
    unmappedCount,
    cardAlerts,
    totalIssueCount: pendingTransactions.length + unmappedCount + cardAlerts.reduce((sum, item) => sum + item.diffCount, 0),
  }
}

export default function App() {
  const stored = loadStorage()

  // 必繳清單「月初自動重置」：跨月開啟時把所有項目恢復為未繳
  const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`
  const storedChecklist = stored?.checklist ?? []
  const initialChecklist = stored?.checklistMonth === currentMonthKey
    ? storedChecklist
    : storedChecklist.map(i => ({ ...i, done: false }))

  const [tab, setTab] = useState('dashboard')
  const [toast, setToast] = useState(null) // { message, onUndo? }
  const toastTimer = useRef(null)
  const [cards, setCards] = useState(stored?.cards ?? [])
  const [plans, setPlans] = useState(stored?.plans ?? [])
  const [transactions, setTransactions] = useState(stored?.transactions ?? [])
  const [fxSettings, setFxSettings] = useState(stored?.fxSettings ?? { usdRate: 32.5, feeRate: 1.5 })
  const [checklist, setChecklist] = useState(initialChecklist)
  const [checklistMonth] = useState(currentMonthKey)
  const [income, setIncome] = useState(stored?.income ?? 0)
  const [salarySettings, setSalarySettings] = useState(() => normalizeSalarySettings(stored?.salarySettings))
  const [savings, setSavings] = useState(stored?.savings ?? [])
  const [googleSync, setGoogleSync] = useState(stored?.googleSync ?? null)
  const [cardImport, setCardImport] = useState(
    stored?.cardImport ?? { sheetId: '', bankCardMap: {}, importedKeys: [] }
  )
  const [importingCardNotifications, setImportingCardNotifications] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards, plans, transactions, fxSettings, checklist, checklistMonth, income, salarySettings, savings, googleSync, cardImport }))
  }, [cards, plans, transactions, fxSettings, checklist, checklistMonth, income, salarySettings, savings, googleSync, cardImport])

  // 補齊每張卡的帳單週期：新卡片、或距離上次開啟已經跨過新的結帳日，都會在這裡自動生成
  // 新的一期紀錄並寫回 cards。已經存在的舊週期不會被動到，未繳的會一直留著不會消失。
  useEffect(() => {
    setCards((prev) => {
      let changed = false
      const next = prev.map((card) => {
        const cycles = ensureBillingCycles(card, { transactions, plans })
        const previousCycles = card.billingCycles ?? []
        const hasCycleChanges = cycles.length !== previousCycles.length || cycles.some((cycle, index) => {
          const previous = previousCycles[index]
          return !previous
            || cycle.amount !== previous.amount
            || cycle.estimatedAmount !== previous.estimatedAmount
            || cycle.closeDate !== previous.closeDate
            || cycle.dueDate !== previous.dueDate
        })
        if (hasCycleChanges) {
          changed = true
          return { ...card, billingCycles: cycles }
        }
        return card
      })
      return changed ? next : prev
    })
  }, [cards, transactions, plans])

  // 補齊每張卡的帳單週期：新卡片、或距離上次開啟已經跨過新的結帳日，都會在這裡自動生成
  // 新的一期紀錄並寫回 cards。已經存在的舊週期不會被動到，未繳的會一直留著不會消失。
  useEffect(() => {
    setCards((prev) => {
      let changed = false
      const next = prev.map((card) => {
        if (card.estimatedBillMonth === currentMonthKey) return card
        changed = true
        const cycles = card.billingCycles ?? []
        const lastClosed = [...cycles].sort((a, b) => a.cycleKey.localeCompare(b.cycleKey)).pop()
        return { ...card, estimatedBill: lastClosed?.amount ?? 0, estimatedBillMonth: currentMonthKey }
      })
      return changed ? next : prev
    })
  }, [cards, currentMonthKey])

  // 補齊每張卡的帳單週期：新卡片、或距離上次開啟已經跨過新的結帳日，都會在這裡自動生成
  // 新的一期紀錄並寫回 cards。已經存在的舊週期不會被動到，未繳的會一直留著不會消失。
  useEffect(() => {
    setPlans((prev) => {
      let changed = false
      const next = prev.map((plan) => {
        if (plan.type !== 'installment') return plan
        const occurrences = ensureInstallmentOccurrences(plan)
        if (occurrences.length !== (plan.occurrences?.length ?? 0)) {
          changed = true
          return { ...plan, occurrences }
        }
        return plan
      })
      return changed ? next : prev
    })
  }, [plans])

  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  const showUndoToast = useCallback((message, onUndo) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, onUndo })
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }, [])

  // Plans handlers
  const normalizePlan = useCallback((plan) => {
    const cardId = resolveCardId(plan, cards)
    const card = cards.find(c => c.id === cardId)
    return {
      ...plan,
      ...(cardId && { cardId }),
      card: plan.card ?? card?.name ?? '',
    }
  }, [cards])
  const handleAddPlan = useCallback((plan) => setPlans(p => [normalizePlan(plan), ...p]), [normalizePlan])
  const handleUpdatePlan = useCallback((updated) => setPlans(p => p.map(pl => pl.id === updated.id ? normalizePlan(updated) : pl)), [normalizePlan])
  const handleDeletePlan = useCallback((id) => {
    setPlans(prev => {
      const idx = prev.findIndex(x => x.id === id)
      const item = prev[idx]
      const next = prev.filter(x => x.id !== id)
      showUndoToast(`Deleted ${item.name}`, () => {
        setPlans(p => {
          const r = [...p]
          r.splice(Math.min(idx, r.length), 0, item)
          return r
        })
      })
      return next
    })
  }, [showUndoToast])
  const handleMarkPaid = useCallback((id) => {
    setPlans(p => p.map(x => {
      if (x.id !== id) return x
      // 訂閱沒有期數概念，只切換已付狀態
      if (x.type !== 'installment') return { ...x, paid: !x.paid }

      // 分期：標記「最早未繳的一期」為已繳；若目前沒有未繳的（剛好都繳完了），
      // 代表這次點擊是要取消最近一次標記，改回撤銷「到期日最晚的已繳那期」
      const occurrences = x.occurrences ?? []
      const unpaid = [...occurrences].filter(o => !o.paid).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      const today = new Date()
      const paidAt = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      if (unpaid.length > 0) {
        const targetId = unpaid[0].id
        return { ...x, occurrences: occurrences.map(o => o.id === targetId ? { ...o, paid: true, paidAt } : o) }
      }
      const paidOnes = [...occurrences].filter(o => o.paid).sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
      if (paidOnes.length === 0) return x
      const undoId = paidOnes[0].id
      return { ...x, occurrences: occurrences.map(o => o.id === undoId ? { ...o, paid: false, paidAt: null } : o) }
    }))
  }, [])

  // Transactions handlers
  const normalizeTransaction = useCallback((tx) => {
    const cardId = resolveCardId(tx, cards)
    const card = cards.find(c => c.id === cardId)
    return {
      ...tx,
      ...(cardId && { cardId }),
      card: tx.card ?? card?.name ?? '',
      date: toISODate(tx.date),
    }
  }, [cards])
  const handleAddTransaction = useCallback((tx) => setTransactions(p => [normalizeTransaction(tx), ...p]), [normalizeTransaction])
  // 改了入帳日不需要在這裡通知帳單週期重算：未繳、未校準的期別本來就是每次
  // 重畫都即時重算的（withLiveCycleEstimates），沒有快取需要手動失效。
  const handleUpdateTransaction = useCallback((updated) => {
    const normalized = normalizeTransaction(updated)
    setTransactions((items) => items.map((transaction) => transaction.id === normalized.id ? normalized : transaction))
  }, [normalizeTransaction])
  // 單筆刷卡轉分期：新增分期計畫並移除原本的單筆記錄，避免重複計入本月支出
  const handleConvertToInstallment = useCallback((txId, plan) => {
    setPlans(p => [normalizePlan(plan), ...p])
    setTransactions(p => p.map(t => t.id === txId ? {
      ...t,
      installmentPlanId: plan.id,
      installmentStatus: 'converted',
      convertedAt: plan.conversionDate,
    } : t))
  }, [normalizePlan])

  // 匯入寫回：新增的接在最前面，補正入帳日的就地換掉，並把這次的 permalink
  // 記進 importedKeys 當去重鍵，下次匯入同一封信才不會再記一筆。
  const handleImportTransactions = useCallback((newTxs, updatedTxs, newKeys, summary = {}) => {
    const updates = new Map(updatedTxs.map((tx) => [tx.id, normalizeTransaction(tx)]))
    setTransactions(p => [...newTxs.map(normalizeTransaction), ...p.map((tx) => updates.get(tx.id) ?? tx)])
    setCardImport(prev => ({
      ...prev,
      importedKeys: [...prev.importedKeys, ...newKeys],
      lastImportAt: Date.now(),
      lastImportCount: newTxs.length,
      lastImportUpdatedCount: updatedTxs.length,
      lastImportDuplicateCount: summary.duplicateCount ?? 0,
      lastImportSkippedUnmapped: summary.skippedUnmapped ?? 0,
      lastImportInvalidCount: summary.invalidCount ?? 0,
      // 診斷用：Sheet 上每家銀行各抓到幾列、以及被跳過那幾列的理由。
      // 只留前 20 筆，localStorage 不需要扛完整的匯入歷史。
      lastImportBankCounts: summary.bankCounts ?? [],
      lastImportSkippedRows: (summary.skippedRows ?? []).slice(0, 20),
      lastImportRowCount: summary.rowCount ?? 0,
    }))
  }, [normalizeTransaction])

  const handleImportCardNotifications = useCallback(async () => {
    const clientId = googleSync?.clientId?.trim()
    const importSheetId = cardImport?.sheetId?.trim()
    if (!clientId || !importSheetId) {
      showToast('請先到設定填 Google Client ID 和消費記錄 Sheet ID')
      return
    }
    setImportingCardNotifications(true)
    try {
      const token = await getAccessToken(clientId)
      const rows = await fetchImportRows({ accessToken: token, sheetId: importSheetId })
      const importedKeys = new Set([
        ...(cardImport?.importedKeys ?? []),
        ...transactions.map((tx) => tx.source?.permalink).filter(Boolean),
      ])

      const newTxs = []
      const updatedTxs = []
      const newKeys = []
      const skippedRows = []
      let skippedUnmapped = 0
      let duplicateCount = 0
      let invalidCount = 0

      rows.forEach((row) => {
        if (!isUsableImportRow(row)) {
          invalidCount++
          skippedRows.push(describeSkippedRow({ row, reason: SKIP_REASON_INVALID_ROW }))
          return
        }
        const { card: mappedCard, reason } = resolveImportedCardResult({
          row, cards, bankCardMap: cardImport?.bankCardMap,
        })
        if (!mappedCard) {
          skippedUnmapped++
          skippedRows.push(describeSkippedRow({ row, reason }))
          return
        }
        const existingTx = findImportedTransaction({ row, card: mappedCard, transactions })
        const postedDate = importedPostedDate(row)
        if (existingTx) {
          if (postedDate && existingTx.postedDate !== postedDate) {
            updatedTxs.push({
              ...existingTx,
              postedDate,
              source: existingTx.source ?? {
                provider: 'card-import', permalink: row.permalink, bank: row.bank, cardLast4: row.cardLast4,
              },
            })
          } else {
            duplicateCount++
          }
          return
        }
        if (importedKeys.has(row.permalink)) {
          duplicateCount++
          return
        }
        newTxs.push({
          id: crypto.randomUUID(),
          name: row.merchant || row.bank,
          category: row.transactionType || '其他',
          cardId: mappedCard.id,
          card: mappedCard.name,
          amount: row.amount,
          date: importedConsumedDate(row),
          ...(postedDate && { postedDate }),
          note: `自動匯入・${row.bank}`,
          source: {
            provider: 'card-import',
            permalink: row.permalink,
            bank: row.bank,
            cardLast4: row.cardLast4,
          },
        })
        newKeys.push(row.permalink)
      })

      handleImportTransactions(newTxs, updatedTxs, newKeys, {
        duplicateCount,
        skippedUnmapped,
        invalidCount,
        rowCount: rows.length,
        bankCounts: summarizeImportRowsByBank(rows),
        skippedRows,
      })

      // 被跳過的筆數要講完整（之前只印未對應卡片，格式壞掉的列連提都沒提到），
      // 並指路去設定頁看逐列理由，不然使用者只會看到「少了幾筆」卻查不出原因。
      const skippedParts = [
        skippedUnmapped > 0 && `${skippedUnmapped} 筆未對應卡片`,
        invalidCount > 0 && `${invalidCount} 筆格式不符`,
      ].filter(Boolean)
      if (skippedParts.length > 0) {
        showToast(`新增 ${newTxs.length} 筆，補正入帳日 ${updatedTxs.length} 筆，重複 ${duplicateCount} 筆，${skippedParts.join('、')}（設定頁可看原因）`)
      } else {
        showToast(`新增 ${newTxs.length} 筆，補正入帳日 ${updatedTxs.length} 筆，重複略過 ${duplicateCount} 筆`)
      }
    } catch (e) {
      showToast(e.message || '更新失敗，請稍後再試')
    } finally {
      setImportingCardNotifications(false)
    }
  }, [cardImport, cards, googleSync, handleImportTransactions, showToast, transactions])

  const handleDeleteTransaction = useCallback((id) => {
    setTransactions(prev => {
      const idx = prev.findIndex(x => x.id === id)
      const item = prev[idx]
      const next = prev.filter(x => x.id !== id)
      showUndoToast(`Deleted ${item.name}`, () => {
        setTransactions(p => {
          const r = [...p]
          r.splice(Math.min(idx, r.length), 0, item)
          return r
        })
      })
      return next
    })
  }, [showUndoToast])

  // Checklist handlers（每月必繳清單）
  const handleAddChecklistItem = useCallback((item) => setChecklist(p => [...p, item]), [])
  const handleUpdateChecklistItem = useCallback((updated) => setChecklist(p => p.map(i => i.id === updated.id ? updated : i)), [])
  const handleDeleteChecklistItem = useCallback((id) => setChecklist(p => p.filter(i => i.id !== id)), [])

  // 勾選必繳項目：若有儲蓄帳戶連動此項目，當月勾選＝把「當下實際金額」存入帳戶，取消＝退回本月那筆
  const handleToggleChecklistItem = useCallback((id) => {
    const item = checklist.find(i => i.id === id)
    const nowDone = item ? !item.done : false
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i))
    if (!item) return
    const amt = Number(item.amount)
    const dateStr = `${new Date().getMonth() + 1}/${new Date().getDate()}`
    setSavings(prev => prev.map(g => {
      if (g.linkedChecklistId !== id) return g
      const entries = g.entries ?? []
      const monthEntry = entries.find(e => e.type === 'in' && e.month === checklistMonth && e.source === 'checklist')
      if (nowDone) {
        if (monthEntry) return g // 同月已存入，不重複
        const entry = { id: crypto.randomUUID(), type: 'in', amount: amt, date: dateStr, note: '?祆??亙', month: checklistMonth, source: 'checklist' }
        return { ...g, saved: Number(g.saved) + amt, entries: [...entries, entry] }
      }
      if (!monthEntry) return g // 取消本月撥入
      return { ...g, saved: Number(g.saved) - Number(monthEntry.amount), entries: entries.filter(e => e.id !== monthEntry.id) }
    }))
  }, [checklist, checklistMonth])

  // 儲蓄帳戶
  const handleAddSaving = useCallback((goal) => setSavings(p => [...p, { entries: [], ...goal }]), [])
  const handleUpdateSaving = useCallback((updated) => setSavings(p => p.map(g => g.id === updated.id ? { ...g, ...updated } : g)), [])
  const handleDeleteSaving = useCallback((id) => setSavings(p => p.filter(g => g.id !== id)), [])
  // 手動撥入（未連動的帳戶用）
  const handleContributeSaving = useCallback((id) => setSavings(p => p.map(g => {
    if (g.id !== id) return g
    const amt = Number(g.monthly)
    const dateStr = `${new Date().getMonth() + 1}/${new Date().getDate()}`
    const entry = { id: crypto.randomUUID(), type: 'in', amount: amt, date: dateStr, note: '???亙', source: 'manual' }
    return { ...g, saved: Number(g.saved) + amt, entries: [...(g.entries ?? []), entry] }
  })), [])
  // 帳戶支出（實際把錢花掉，例如繳學費）
  const handleSpendSaving = useCallback((id, amount, note) => setSavings(p => p.map(g => {
    if (g.id !== id) return g
    const amt = Number(amount)
    const dateStr = `${new Date().getMonth() + 1}/${new Date().getDate()}`
    const entry = { id: crypto.randomUUID(), type: 'out', amount: amt, date: dateStr, note: note || '?臬', source: 'manual' }
    return { ...g, saved: Number(g.saved) - amt, entries: [...(g.entries ?? []), entry] }
  })), [])
  // 領出全部（歸零，記成一筆支出）
  const handleResetSaving = useCallback((id) => setSavings(p => p.map(g => {
    if (g.id !== id) return g
    const amt = Number(g.saved)
    if (amt <= 0) return g
    const dateStr = `${new Date().getMonth() + 1}/${new Date().getDate()}`
    const entry = { id: crypto.randomUUID(), type: 'out', amount: amt, date: dateStr, note: '??券', source: 'manual' }
    return { ...g, saved: 0, entries: [...(g.entries ?? []), entry] }
  })), [])


  // Cards handlers
  const handleAddCard = useCallback((card) => setCards(p => [...p, card]), [])
  const handleSaveCard = useCallback((updated) => setCards(p => p.map(c => c.id === updated.id ? updated : c)), [])
  const handleDeleteCard = useCallback((id) => setCards(p => p.filter(c => c.id !== id)), [])
  // 標記某一期帳單已繳：cycleId 全域唯一，直接找出對應的卡片跟那一期改掉；
  // 可選擇從連動的儲蓄帳戶扣款
  const handleMarkCardPaid = useCallback((cycleId, opts = {}) => {
    const paidAt = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    setCards(prev => prev.map(c => {
      if (!c.billingCycles?.some(cy => cy.id === cycleId)) return c
      return {
        ...c,
        billingCycles: c.billingCycles.map(cy => cy.id === cycleId ? { ...cy, paid: true, paidAt } : cy),
      }
    }))
    if (opts.fromSavingId && Number(opts.amount) > 0) {
      handleSpendSaving(opts.fromSavingId, Number(opts.amount), 'Card payment')
    }
  }, [handleSpendSaving])

  // 一次把某張卡所有未繳的期數都標記已繳（例如補繳好幾期積欠的帳單）
  const handleMarkAllCyclesPaid = useCallback((cardId) => {
    const paidAt = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    setCards(prev => prev.map(c => {
      if (c.id !== cardId) return c
      return {
        ...c,
        billingCycles: (c.billingCycles ?? []).map(cy => cy.paid ? cy : { ...cy, paid: true, paidAt }),
      }
    }))
  }, [])

  // 手動改某一期的到期日（延後繳款），或編輯金額（銀行實際帳單跟估算不同時）
  const handleUpdateCycle = useCallback((cardId, cycleId, fields) => {
    setCards(prev => prev.map(c => {
      if (c.id !== cardId) return c
      return {
        ...c,
        billingCycles: applyCycleUpdate(c.billingCycles ?? [], cycleId, fields),
      }
    }))
  }, [])

  // 手動調整這個月的信用卡預估帳單金額（月初規劃用，整月穩定，不受封帳/已繳狀態影響）
  const handleUpdateEstimatedBill = useCallback((cardId, amount) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, estimatedBill: Number(amount) || 0 } : c))
  }, [])

  const handleClearData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setCards([])
    setPlans([])
    setTransactions([])
    setChecklist([])
    setIncome(0)
    setSalarySettings(normalizeSalarySettings())
    setSavings([])
    setFxSettings({ usdRate: 32.5, feeRate: 1.5 })
    setGoogleSync(null)
    setTab('dashboard')
  }, [])

  // 還原備份：用匯入的資料整批覆蓋
  const handleImportData = useCallback((data) => {
    if (!data || typeof data !== 'object') return false
    const normalized = normalizeFinanceData(data)
    setCards(normalized.cards)
    setPlans(normalized.plans)
    setTransactions(normalized.transactions)
    setChecklist(Array.isArray(data.checklist) ? data.checklist : [])
    if (data.fxSettings && typeof data.fxSettings === 'object') setFxSettings(data.fxSettings)
    if (typeof data.income === 'number') setIncome(data.income)
    setSalarySettings(normalizeSalarySettings(data.salarySettings))
    setSavings(Array.isArray(data.savings) ? data.savings : [])
    setGoogleSync(data.googleSync ?? null)
    setCardImport(data.cardImport ?? { sheetId: '', bankCardMap: {}, importedKeys: [] })
    return true
  }, [])

  // 這個日曆月內、已知會扣但還沒有對應刷卡記錄的訂閱與分期金額
  const fixedMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const fixedMonthEnd = endOfMonth(new Date())
  const fixedMonthlyAmount = plans
    .filter(p => p.type === 'subscription' ? (p.active ?? true) : (paidCountOf(p) < p.totalCount))
    .reduce((s, p) => {
      const args = { plan: p, transactions, cards, windowStart: fixedMonthStart, windowEnd: fixedMonthEnd }
      return s + (p.type === 'installment' ? installmentAmountNotRecordedInWindow(args) : planAmountNotRecorded(args))
    }, 0)

  // 必要支出 / 生活預算
  // 只算「已勾選」的必繳項目：勾選代表這個月已經確定把這筆錢留下來，
  // 未勾選的還在規劃階段，不該提前算進必要支出總額。
  const checklistTotal = checklist.filter(i => i.done).reduce((s, i) => s + Number(i.amount), 0)
  // 連動必繳項目的儲蓄：金額已在必繳清單裡，不重複計入。
  // 只有「未連動且勾選額外預留」的帳戶，才是收入之外另外存、會加進必要支出。
  const savingsMonthly = savings.reduce((s, g) => s + Number(g.monthly || 0), 0)
  const essentialSavings = savings
    .filter(g => !g.linkedChecklistId && g.countInEssential)
    .reduce((s, g) => s + Number(g.monthly || 0), 0)
  const essentialTotal = checklistTotal + essentialSavings

  const { currentMonth, enrichedCards, categories, trends } = computeDashboard(transactions, cards, fixedMonthlyAmount, plans)
  const reconciliationSummary = buildReconciliationSummary({ transactions, cards: enrichedCards, cardImport })
  const salarySchedule = getSalarySchedule(salarySettings)
  const availableIncome = salarySchedule.receivedThisMonth ? income : 0
  // commitments 用首頁同一份 fixedMonthlyAmount：本月已知會扣、但還沒有刷卡記錄的金額。
  // 傳「所有訂閱＋分期總額」的話，已經扣款並匯入的那些會跟本月刷卡重複扣一次。
  const forecastSummary = buildCardForecast(enrichedCards, { income: availableIncome, essentialTotal, commitments: fixedMonthlyAmount })

  // 信用卡預估帳單：月初規劃時設定的數字，整月穩定不變，不受封帳／已繳狀態影響——
  // 這個月的錢已經花掉就是花掉了，不會因為標記已繳就「還」回生活結餘。
  const cardEstimates = cards
    .filter(c => Number(c.estimatedBill) > 0)
    .map(c => ({ id: c.id, name: c.name, amount: Number(c.estimatedBill) }))
  const cardEstimateTotal = cardEstimates.reduce((s, c) => s + c.amount, 0)
  const lifeBalance = income - essentialTotal - cardEstimateTotal
  const weekDays = buildWeekDays(plans, enrichedCards)
  const enrichedPlans = enrichPlans(plans)

  // 繳費提醒：把每張卡「所有」未繳的週期攤平成一筆一筆提醒（同一張卡可能同時有兩期沒繳），
  // 天數用真正的日期相減，不再受換月影響。
  const paymentReminders = enrichedCards
    .flatMap(c => {
      const reserve = savings.find(g => g.linkedCardId === c.id)
      return c.unpaidCycles.map(cycle => ({
        id: cycle.id,
        cardId: c.id,
        name: c.name,
        color: c.color,
        amount: cycle.amount,
        dueDateLabel: `${Number(cycle.dueDate.slice(5, 7))}/${Number(cycle.dueDate.slice(8, 10))}`,
        daysLeft: cycle.daysLeft,
        reserve: reserve ? { id: reserve.id, name: reserve.name, saved: Number(reserve.saved) } : null,
      }))
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)

  // 各卡狀態用：補上連動的卡費預留帳戶
  const dashboardCards = enrichedCards.map(c => {
    const reserve = savings.find(g => g.linkedCardId === c.id)
    return {
      ...c,
      reserve: reserve ? { id: reserve.id, name: reserve.name, saved: Number(reserve.saved) } : null,
    }
  })

  // 補齊每張卡的帳單週期：新卡片、或距離上次開啟已經跨過新的結帳日，都會在這裡自動生成
  // 新的一期紀錄並寫回 cards。已經存在的舊週期不會被動到，未繳的會一直留著不會消失。
  useEffect(() => {
    maybeNotifyDueBills(paymentReminders)
  }, [paymentReminders])

  // 未償負債（資產負債清晰）：只計分期未繳清的剩餘期數 × 每期金額
  const liabilityItems = plans
    .filter(p => p.type === 'installment' && p.totalCount - paidCountOf(p) > 0)
    .map(p => ({
      id: p.id,
      name: p.name,
      card: p.card,
      perPeriod: p.amount,
      remainingPeriods: p.totalCount - paidCountOf(p),
      outstanding: (p.totalCount - paidCountOf(p)) * p.amount,
    }))
  const totalDebt = liabilityItems.reduce((s, i) => s + i.outstanding, 0)

  const now = new Date()
  const greeting = getGreeting(now.getHours())
  const dateLabel = `${now.getMonth() + 1} 月 ${now.getDate()} 日・${WEEKDAY_NAMES[now.getDay()]}`

  const pages = {
    dashboard: (
      <Dashboard
        greeting={greeting}
        dateLabel={dateLabel}
        currentMonth={currentMonth}
        weekDays={weekDays}
        cards={dashboardCards}
        categories={categories}
        trends={trends}
        liabilityItems={liabilityItems}
        totalDebt={totalDebt}
        paymentReminders={paymentReminders}
        onMarkCardPaid={handleMarkCardPaid}
        onMarkAllCyclesPaid={handleMarkAllCyclesPaid}
        onUpdateCycle={handleUpdateCycle}
        income={income}
        essentialTotal={essentialTotal}
        cardEstimateTotal={cardEstimateTotal}
        lifeBalance={lifeBalance}
        onGoToChecklist={() => setTab('checklist')}
        onGoToTransactions={() => setTab('transactions')}
        reconciliationSummary={reconciliationSummary}
        forecastSummary={forecastSummary}
        salarySchedule={salarySchedule}
        monthlyIncome={income}
      />
    ),
    transactions: (
      <Transactions
        showToast={showToast}
        transactions={transactions}
        cards={cards}
        onAddTransaction={handleAddTransaction}
        onUpdateTransaction={handleUpdateTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onConvertToInstallment={handleConvertToInstallment}
        cardImport={cardImport}
        importingCardNotifications={importingCardNotifications}
        onImportCardNotifications={handleImportCardNotifications}
        plans={plans}
        onUpdateCycle={handleUpdateCycle}
      />
    ),
    checklist: (
      <Checklist
        showToast={showToast}
        items={checklist}
        monthName={currentMonth.name}
        income={income}
        essentialTotal={essentialTotal}
        checklistTotal={checklistTotal}
        savingsMonthly={savingsMonthly}
        essentialSavings={essentialSavings}
        lifeBalance={lifeBalance}
        cardEstimates={cardEstimates}
        cardEstimateTotal={cardEstimateTotal}
        onUpdateEstimatedBill={handleUpdateEstimatedBill}
        savings={savings}
        cardBills={cards.map(c => ({ id: c.id, name: c.name, bill: Number(c.estimatedBill) || 0 }))}
        onIncomeChange={setIncome}
        salarySettings={salarySettings}
        salarySchedule={salarySchedule}
        onSalarySettingsChange={setSalarySettings}
        onAdd={handleAddChecklistItem}
        onToggle={handleToggleChecklistItem}
        onUpdate={handleUpdateChecklistItem}
        onDelete={handleDeleteChecklistItem}
        onAddSaving={handleAddSaving}
        onUpdateSaving={handleUpdateSaving}
        onDeleteSaving={handleDeleteSaving}
        onContributeSaving={handleContributeSaving}
        onSpendSaving={handleSpendSaving}
        onResetSaving={handleResetSaving}
        plans={enrichedPlans}
        cards={cards}
        fxSettings={fxSettings}
        onAddPlan={handleAddPlan}
        onUpdatePlan={handleUpdatePlan}
        onDeletePlan={handleDeletePlan}
        onMarkPlanPaid={handleMarkPaid}
      />
    ),
    settings: (
      <Settings
        showToast={showToast}
        cards={cards}
        fxSettings={fxSettings}
        onFxChange={setFxSettings}
        onAddCard={handleAddCard}
        onSaveCard={handleSaveCard}
        onDeleteCard={handleDeleteCard}
        backupData={{ cards, plans, transactions, checklist, checklistMonth, fxSettings, income, salarySettings, savings, googleSync, cardImport }}
        onImportData={handleImportData}
        onClearData={handleClearData}
        transactions={transactions}
        googleSync={googleSync}
        onGoogleSyncChange={setGoogleSync}
        cardImport={cardImport}
        onCardImportChange={setCardImport}
        planSummary={{
          monthKey: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
          income,
          essentialTotal,
          essentialSavings,
          cardEstimateTotal,
          lifeBalance,
        }}
      />
    ),
  }

  if (cards.length === 0 && tab !== 'settings') {
    return (
      <div className="app-root">
        <Onboarding onStart={() => setTab('settings')} />
        {toast && <Toast message={toast.message} onUndo={toast.onUndo} />}
      </div>
    )
  }

  return (
    <div className="app-root">
      <main className="app-page">
        {pages[tab]}
      </main>
      <BottomNav active={tab} onChange={setTab} />
      {toast && <Toast message={toast.message} onUndo={toast.onUndo} />}
    </div>
  )
}
