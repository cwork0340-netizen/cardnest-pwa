import { useState, useCallback, useEffect, useRef } from 'react'
import BottomNav from './components/BottomNav'
import Toast from './components/Toast'
import Dashboard from './pages/Dashboard'
import Plans from './pages/Plans'
import Transactions from './pages/Transactions'
import Settings from './pages/Settings'
import Checklist from './pages/Checklist'
import Onboarding from './pages/Onboarding'
import { maybeNotifyDueBills } from './utils/notify'
import { nextOccurrence, daysUntil, formatMD, statusForDaysLeft, dayFromMD, effectiveDueDay } from './utils/recurrence'

const STORAGE_KEY = 'cardnest_v1'

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const MONTH_NAMES = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
const WEEKDAY_NAMES = ['日','一','二','三','四','五','六']
const CATEGORY_COLORS = {
  餐飲: '#A98274', 購物: '#D6A04D', 訂閱: '#8DAA91',
  日常: '#B98D6F', 交通: '#C86E62', 娛樂: '#D6A04D', 其他: '#B9ADA6',
}
const TREND_BASE = [
  { month: '12月', amount: 31200 }, { month: '1月', amount: 28940 },
  { month: '2月', amount: 25380 }, { month: '3月', amount: 36120 },
  { month: '4月', amount: 33880 }, { month: '5月', amount: 39140 },
]

function getGreeting(hour) {
  if (hour < 5) return '夜深了，記得早點休息'
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
    const billingDay = billingDayOf(p)
    const next = nextOccurrence(billingDay)
    const daysLeft = daysUntil(next)
    return { ...p, billingDay, nextDate: formatMD(next), daysLeft, status: statusForDaysLeft(daysLeft) }
  })
}

// 建立本週（週日起算）七天的扣款行事曆，事件以卡片顏色標示
function buildWeekDays(plans, cards) {
  const colorByCard = {}
  cards.forEach(c => { colorByCard[c.name] = c.color })

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
      : (p.paidCount < p.totalCount)
    if (!stillActive) return
    const dt = nextOccurrence(billingDayOf(p))
    dt.setHours(0, 0, 0, 0)
    if (dt < weekStart || dt >= weekEnd) return
    const idx = Math.round((dt - weekStart) / 86400000)
    days[idx].events.push({
      id: p.id,
      name: p.name,
      card: p.card,
      amount: p.amount,
      color: colorByCard[p.card] ?? '#A98274',
    })
  })

  return days
}

// 刷卡記錄的 date 是 "M/D" 顯示字串（沒有年份），跟現在比對月份即可判斷是不是本期
function isThisMonth(displayDate, from = new Date()) {
  if (!displayDate) return false
  const [m] = displayDate.split('/').map(Number)
  return m === from.getMonth() + 1
}

// 把沒有年份的 "M/D" 還原成跟 near 最接近的完整日期，避免跨年誤判（例如 12 月帳單週期跨到 1 月）
function resolveNearDate(displayDate, near) {
  const [m, d] = displayDate.split('/').map(Number)
  let candidate = new Date(near.getFullYear(), m - 1, d)
  const diffMonths = (candidate.getFullYear() - near.getFullYear()) * 12 + (candidate.getMonth() - near.getMonth())
  if (diffMonths > 6) candidate = new Date(candidate.getFullYear() - 1, candidate.getMonth(), candidate.getDate())
  else if (diffMonths < -6) candidate = new Date(candidate.getFullYear() + 1, candidate.getMonth(), candidate.getDate())
  return candidate
}

// 依「結帳日」算出目前所在帳單週期的邊界：上次結帳日（本期帳單截止點）、上上次結帳日（上期帳單起點）
function billingCycleBounds(billingDay, today) {
  if (!billingDay) return null
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
  const lastBillingDate = d >= billingDay ? new Date(y, m, billingDay) : new Date(y, m - 1, billingDay)
  const prevBillingDate = new Date(lastBillingDate.getFullYear(), lastBillingDate.getMonth() - 1, billingDay)
  return { prevBillingDate, lastBillingDate }
}

function computeDashboard(transactions, cards, fixedMonthlyAmount = 0, envelopes = [], plans = []) {
  // 預算／應繳只看本月的刷卡記錄，跨月的舊記錄不會一路往上累加
  const monthTx = transactions.filter(tx => isThisMonth(tx.date))
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
    const cardTx = transactions.filter(tx => tx.card === card.name)
    const bounds = billingCycleBounds(card.billingDay, today)
    // 上期（已結帳，等待繳款）／本期累積（結帳日之後新刷的，還沒出帳）：依結帳日切，不是日曆月
    let used, currentCycleAmount
    if (bounds) {
      used = cardTx
        .filter(tx => { const dt = resolveNearDate(tx.date, today); return dt > bounds.prevBillingDate && dt <= bounds.lastBillingDate })
        .reduce((s, tx) => s + tx.amount, 0)
      currentCycleAmount = cardTx
        .filter(tx => { const dt = resolveNearDate(tx.date, today); return dt > bounds.lastBillingDate && dt <= today })
        .reduce((s, tx) => s + tx.amount, 0)
    } else {
      // 沒填結帳日，退回原本日曆月估算
      used = cardTx.filter(tx => isThisMonth(tx.date)).reduce((s, tx) => s + tx.amount, 0)
      currentCycleAmount = 0
    }
    // 下期應繳 = 這張卡的 刷卡消費 + 訂閱 + 未繳清的分期（每期）
    const subsOnCard = plans
      .filter(p => p.type === 'subscription' && (p.active ?? true) && p.card === card.name)
      .reduce((s, p) => s + p.amount, 0)
    const instOnCard = plans
      .filter(p => p.type === 'installment' && !p.paid && p.card === card.name)
      .reduce((s, p) => s + p.amount, 0)
    // 有手動填銀行「本期應繳」就以實際金額為準，否則用 app 估算
    const computedBill = used + subsOnCard + instOnCard
    const upcomingBill = Number(card.actualBill) > 0 ? Number(card.actualBill) : computedBill
    const cardRemaining = card.budget - used
    const cp = card.budget > 0 ? used / card.budget : 0
    const cardStatus = cp < 0.7 ? 'safe' : cp < 0.9 ? 'warning' : 'danger'
    // 繳款截止日：沒手動填就用「帳單日 + 繳款寬限天數」自動算
    const dueDate = Number(card.dueDate) > 0 ? Number(card.dueDate) : effectiveDueDay(card.billingDay, card.dueDay)
    return {
      ...card, used, currentCycleAmount, upcomingBill, dueDate,
      subsOnCard, instOnCard, computedBill,
      billIsActual: Number(card.actualBill) > 0,
      status: cardStatus,
      statusText: cardStatus === 'safe'
        ? `還有 NT$${cardRemaining.toLocaleString()} 可用`
        : cardStatus === 'warning' ? '接近預算上限'
        : '已超出預算',
    }
  })

  const catMap = {}
  monthTx.forEach(tx => { catMap[tx.category] = (catMap[tx.category] ?? 0) + tx.amount })
  const categories = Object.entries(catMap)
    .map(([name, amount]) => ({
      name, amount,
      percent: totalSpent > 0 ? Math.round(amount / totalSpent * 100) : 0,
      color: CATEGORY_COLORS[name] ?? '#B9ADA6',
    }))
    .sort((a, b) => b.amount - a.amount)

  // 分類信封預算：每個信封的本月已花（由刷卡分類加總）對比月額度
  const envelopeView = envelopes.map(e => {
    const used = catMap[e.name] ?? 0
    return {
      id: e.id,
      name: e.name,
      necessity: e.necessity,
      budget: e.monthlyBudget,
      used,
      remaining: e.monthlyBudget - used,
      color: CATEGORY_COLORS[e.name] ?? '#B9ADA6',
    }
  })
  const envelopeSummary = {
    necessaryBudget: envelopes.filter(e => e.necessity === 'necessary').reduce((s, e) => s + e.monthlyBudget, 0),
    flexibleBudget: envelopes.filter(e => e.necessity === 'flexible').reduce((s, e) => s + e.monthlyBudget, 0),
    necessaryUsed: envelopeView.filter(e => e.necessity === 'necessary').reduce((s, e) => s + e.used, 0),
    flexibleUsed: envelopeView.filter(e => e.necessity === 'flexible').reduce((s, e) => s + e.used, 0),
  }

  const trends = [...TREND_BASE, { month: monthName, amount: totalSpent }]

  const estimatedTotal = totalSpent + fixedMonthlyAmount
  const currentMonth = {
    name: monthName,
    total: totalSpent,
    budget: totalBudget,
    remaining,
    fixedMonthlyAmount,
    estimatedTotal,
    status,
    statusText: status === 'safe' ? `${monthName}目前很穩` : status === 'warning' ? `${monthName}需要留意` : `${monthName}已超支`,
  }

  return { currentMonth, enrichedCards, categories, trends, envelopeView, envelopeSummary }
}

export default function App() {
  const stored = loadStorage()

  // 必繳清單「月初自動重置」：跨月開啟時把所有項目恢復為未繳
  const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`
  const storedChecklist = stored?.checklist ?? []
  const initialChecklist = stored?.checklistMonth === currentMonthKey
    ? storedChecklist
    : storedChecklist.map(i => ({ ...i, done: false }))

  // 卡片帳單週期「跨月自動重置」：上次標記已繳是在過去某個月，代表那是上一期的
  // 銀行帳單金額，開啟新月份時清空「本期應繳」，回到用刷卡＋訂閱／分期估算，
  // 避免本期應繳一直沿用上一期數字，跟必繳清單一樣每月自動重新開始。
  const storedCards = stored?.cards ?? []
  const initialCards = storedCards.map(c =>
    c.billPaidMonth && c.billPaidMonth !== currentMonthKey && Number(c.actualBill) > 0
      ? { ...c, actualBill: 0 }
      : c
  )

  const [tab, setTab] = useState('dashboard')
  const [toast, setToast] = useState(null) // { message, onUndo? }
  const toastTimer = useRef(null)
  const [cards, setCards] = useState(initialCards)
  const [plans, setPlans] = useState(stored?.plans ?? [])
  const [transactions, setTransactions] = useState(stored?.transactions ?? [])
  const [fxSettings, setFxSettings] = useState(stored?.fxSettings ?? { usdRate: 32.5, feeRate: 1.5 })
  const [checklist, setChecklist] = useState(initialChecklist)
  const [checklistMonth] = useState(currentMonthKey)
  const [envelopes, setEnvelopes] = useState(stored?.envelopes ?? [])
  const [income, setIncome] = useState(stored?.income ?? 0)
  const [savings, setSavings] = useState(stored?.savings ?? [])
  const [googleSync, setGoogleSync] = useState(stored?.googleSync ?? null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards, plans, transactions, fxSettings, checklist, checklistMonth, envelopes, income, savings, googleSync }))
  }, [cards, plans, transactions, fxSettings, checklist, checklistMonth, envelopes, income, savings, googleSync])

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
  const handleAddPlan = useCallback((plan) => setPlans(p => [plan, ...p]), [])
  const handleUpdatePlan = useCallback((updated) => setPlans(p => p.map(pl => pl.id === updated.id ? updated : pl)), [])
  const handleDeletePlan = useCallback((id) => {
    setPlans(prev => {
      const idx = prev.findIndex(x => x.id === id)
      const item = prev[idx]
      const next = prev.filter(x => x.id !== id)
      showUndoToast(`已移除「${item.name}」`, () => {
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
      if (x.totalCount == null) return { ...x, paid: !x.paid }
      // 分期：標記已付時前進一期，取消時退回一期，並夾在 0 ~ 總期數之間
      const paidCount = x.paid
        ? Math.max(0, (x.paidCount ?? 0) - 1)
        : Math.min(x.totalCount, (x.paidCount ?? 0) + 1)
      return { ...x, paid: !x.paid, paidCount }
    }))
  }, [])

  // Transactions handlers
  const handleAddTransaction = useCallback((tx) => setTransactions(p => [tx, ...p]), [])
  const handleUpdateTransaction = useCallback((updated) => setTransactions(p => p.map(t => t.id === updated.id ? updated : t)), [])
  // 單筆刷卡轉分期：新增分期計畫並移除原本的單筆記錄，避免重複計入本月支出
  const handleConvertToInstallment = useCallback((txId, plan) => {
    setPlans(p => [plan, ...p])
    setTransactions(p => p.filter(t => t.id !== txId))
  }, [])
  const handleDeleteTransaction = useCallback((id) => {
    setTransactions(prev => {
      const idx = prev.findIndex(x => x.id === id)
      const item = prev[idx]
      const next = prev.filter(x => x.id !== id)
      showUndoToast(`已移除「${item.name}」`, () => {
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
        const entry = { id: crypto.randomUUID(), type: 'in', amount: amt, date: dateStr, note: '本月撥入', month: checklistMonth, source: 'checklist' }
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
    const entry = { id: crypto.randomUUID(), type: 'in', amount: amt, date: dateStr, note: '手動撥入', source: 'manual' }
    return { ...g, saved: Number(g.saved) + amt, entries: [...(g.entries ?? []), entry] }
  })), [])
  // 帳戶支出（實際把錢花掉，例如繳學費）
  const handleSpendSaving = useCallback((id, amount, note) => setSavings(p => p.map(g => {
    if (g.id !== id) return g
    const amt = Number(amount)
    const dateStr = `${new Date().getMonth() + 1}/${new Date().getDate()}`
    const entry = { id: crypto.randomUUID(), type: 'out', amount: amt, date: dateStr, note: note || '支出', source: 'manual' }
    return { ...g, saved: Number(g.saved) - amt, entries: [...(g.entries ?? []), entry] }
  })), [])
  // 領出全部（歸零，記成一筆支出）
  const handleResetSaving = useCallback((id) => setSavings(p => p.map(g => {
    if (g.id !== id) return g
    const amt = Number(g.saved)
    if (amt <= 0) return g
    const dateStr = `${new Date().getMonth() + 1}/${new Date().getDate()}`
    const entry = { id: crypto.randomUUID(), type: 'out', amount: amt, date: dateStr, note: '領出全部', source: 'manual' }
    return { ...g, saved: 0, entries: [...(g.entries ?? []), entry] }
  })), [])

  // Envelope handlers（分類信封預算）
  const handleAddEnvelope = useCallback((env) => setEnvelopes(p => [...p, env]), [])
  const handleUpdateEnvelope = useCallback((updated) => setEnvelopes(p => p.map(e => e.id === updated.id ? updated : e)), [])
  const handleDeleteEnvelope = useCallback((id) => setEnvelopes(p => p.filter(e => e.id !== id)), [])

  // Cards handlers
  const handleAddCard = useCallback((card) => setCards(p => [...p, card]), [])
  const handleSaveCard = useCallback((updated) => setCards(p => p.map(c => c.id === updated.id ? updated : c)), [])
  const handleDeleteCard = useCallback((id) => setCards(p => p.filter(c => c.id !== id)), [])
  // 標記本期卡費已繳：當月不再提醒；可選擇從連動的儲蓄帳戶扣款
  const handleMarkCardPaid = useCallback((id, opts = {}) => {
    setCards(p => p.map(c => c.id === id ? { ...c, billPaidMonth: currentMonthKey } : c))
    if (opts.fromSavingId && Number(opts.amount) > 0) {
      handleSpendSaving(opts.fromSavingId, Number(opts.amount), '繳卡費')
    }
  }, [currentMonthKey, handleSpendSaving])

  const handleClearData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setCards([])
    setPlans([])
    setTransactions([])
    setChecklist([])
    setEnvelopes([])
    setIncome(0)
    setSavings([])
    setFxSettings({ usdRate: 32.5, feeRate: 1.5 })
    setGoogleSync(null)
    setTab('dashboard')
  }, [])

  // 還原備份：用匯入的資料整批覆蓋
  const handleImportData = useCallback((data) => {
    if (!data || typeof data !== 'object') return false
    setCards(Array.isArray(data.cards) ? data.cards : [])
    setPlans(Array.isArray(data.plans) ? data.plans : [])
    setTransactions(Array.isArray(data.transactions) ? data.transactions : [])
    setChecklist(Array.isArray(data.checklist) ? data.checklist : [])
    setEnvelopes(Array.isArray(data.envelopes) ? data.envelopes : [])
    if (data.fxSettings && typeof data.fxSettings === 'object') setFxSettings(data.fxSettings)
    if (typeof data.income === 'number') setIncome(data.income)
    setSavings(Array.isArray(data.savings) ? data.savings : [])
    return true
  }, [])

  // 首頁＝刷卡狀態：本月支出的「固定部分」＝ 所有訂閱 + 未繳清分期（每期），不含必繳清單
  const fixedMonthlyAmount = plans
    .filter(p => p.type === 'subscription' ? (p.active ?? true) : (p.paidCount < p.totalCount))
    .reduce((s, p) => s + p.amount, 0)

  // 必要支出 / 生活預算
  const checklistTotal = checklist.reduce((s, i) => s + Number(i.amount), 0)
  // 連動必繳項目的儲蓄：金額已在必繳清單裡，不重複計入。
  // 只有「未連動且勾選額外預留」的帳戶，才是收入之外另外存、會加進必要支出。
  const savingsMonthly = savings.reduce((s, g) => s + Number(g.monthly || 0), 0)
  const essentialSavings = savings
    .filter(g => !g.linkedChecklistId && g.countInEssential)
    .reduce((s, g) => s + Number(g.monthly || 0), 0)
  const essentialTotal = checklistTotal + essentialSavings

  const { currentMonth, enrichedCards, categories, trends, envelopeView, envelopeSummary } = computeDashboard(transactions, cards, fixedMonthlyAmount, envelopes, plans)

  // 上期卡費：本期應繳 > 0 且本月尚未標記已繳的各卡加總，計入生活結餘
  const unpaidCardBills = enrichedCards
    .filter(c => Number(c.upcomingBill) > 0 && c.billPaidMonth !== currentMonthKey)
    .map(c => ({ id: c.id, name: c.name, amount: Number(c.upcomingBill) }))
  const unpaidCardBillsTotal = unpaidCardBills.reduce((s, c) => s + c.amount, 0)
  const lifeBalance = income - essentialTotal - unpaidCardBillsTotal
  const weekDays = buildWeekDays(plans, enrichedCards)
  const enrichedPlans = enrichPlans(plans)

  // 繳費提醒：本期應繳 > 0、有設繳款截止日、且本月尚未標記已繳
  const todayDate = new Date().getDate()
  const paymentReminders = enrichedCards
    .filter(c => Number(c.upcomingBill) > 0 && Number(c.dueDate) > 0 && c.billPaidMonth !== currentMonthKey)
    .map(c => {
      const reserve = savings.find(g => g.linkedCardId === c.id)
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        amount: Number(c.upcomingBill),
        dueDate: Number(c.dueDate),
        daysLeft: Number(c.dueDate) - todayDate,
        reserve: reserve ? { id: reserve.id, name: reserve.name, saved: Number(reserve.saved) } : null,
      }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)

  // 各卡狀態用：補上「本期是否已繳」與連動的卡費預留帳戶
  const dashboardCards = enrichedCards.map(c => {
    const reserve = savings.find(g => g.linkedCardId === c.id)
    return {
      ...c,
      billPaid: c.billPaidMonth === currentMonthKey,
      reserve: reserve ? { id: reserve.id, name: reserve.name, saved: Number(reserve.saved) } : null,
    }
  })

  // 開啟 App 時，若有快到期/逾期的卡費就跳一則瀏覽器通知（今天只跳一次）
  useEffect(() => {
    maybeNotifyDueBills(paymentReminders)
  }, [paymentReminders])

  // 未償負債（資產負債清晰）：只計分期未繳清的剩餘期數 × 每期金額
  const liabilityItems = plans
    .filter(p => p.type === 'installment' && p.totalCount - p.paidCount > 0)
    .map(p => ({
      id: p.id,
      name: p.name,
      card: p.card,
      perPeriod: p.amount,
      remainingPeriods: p.totalCount - p.paidCount,
      outstanding: (p.totalCount - p.paidCount) * p.amount,
    }))
  const totalDebt = liabilityItems.reduce((s, i) => s + i.outstanding, 0)

  const now = new Date()
  const greeting = getGreeting(now.getHours())
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEKDAY_NAMES[now.getDay()]}`

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
        envelopeView={envelopeView}
        envelopeSummary={envelopeSummary}
        paymentReminders={paymentReminders}
        onMarkCardPaid={handleMarkCardPaid}
        income={income}
        essentialTotal={essentialTotal}
        unpaidCardBillsTotal={unpaidCardBillsTotal}
        lifeBalance={lifeBalance}
        onGoToChecklist={() => setTab('checklist')}
      />
    ),
    plans: (
      <Plans
        showToast={showToast}
        plans={enrichedPlans}
        cards={cards}
        fxSettings={fxSettings}
        onAddPlan={handleAddPlan}
        onUpdatePlan={handleUpdatePlan}
        onDeletePlan={handleDeletePlan}
        onMarkPaid={handleMarkPaid}
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
        unpaidCardBills={unpaidCardBills}
        unpaidCardBillsTotal={unpaidCardBillsTotal}
        savings={savings}
        cardBills={enrichedCards.map(c => ({ id: c.id, name: c.name, bill: c.upcomingBill }))}
        onIncomeChange={setIncome}
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
      />
    ),
    settings: (
      <Settings
        showToast={showToast}
        cards={cards}
        fxSettings={fxSettings}
        envelopes={envelopes}
        onFxChange={setFxSettings}
        onAddCard={handleAddCard}
        onSaveCard={handleSaveCard}
        onDeleteCard={handleDeleteCard}
        onAddEnvelope={handleAddEnvelope}
        onUpdateEnvelope={handleUpdateEnvelope}
        onDeleteEnvelope={handleDeleteEnvelope}
        backupData={{ cards, plans, transactions, checklist, checklistMonth, envelopes, fxSettings, income }}
        onImportData={handleImportData}
        onClearData={handleClearData}
        transactions={transactions}
        googleSync={googleSync}
        onGoogleSyncChange={setGoogleSync}
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
