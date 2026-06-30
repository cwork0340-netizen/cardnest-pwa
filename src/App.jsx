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
  餐飲: '#5E7CE2', 購物: '#D49A45', 訂閱: '#6FA37C',
  日常: '#A380C6', 交通: '#D96B5F', 娛樂: '#D49A45', 其他: '#AAA198',
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

// "6/15" → 當前年份的 Date 物件
function parseMonthDay(md) {
  if (!md) return null
  const [m, d] = md.split('/').map(Number)
  if (!m || !d) return null
  return new Date(new Date().getFullYear(), m - 1, d)
}

// 依「各卡結帳日」算出目前所屬帳單週期的代號（年-月）。
// 結帳日當天起算為新一期；未設結帳日則退回以日曆月 1 號為界。
// 例：結帳日 14 號，6/20→「2026-5」、7/1 仍是「2026-5」、7/14 起換成「2026-6」。
function billingCycleKey(billingDay, now = new Date()) {
  const day = Number(billingDay) > 0 ? Number(billingDay) : 1
  let year = now.getFullYear()
  let month = now.getMonth()
  if (now.getDate() < day) {
    month -= 1
    if (month < 0) { month = 11; year -= 1 }
  }
  return `${year}-${month}`
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
    const dt = parseMonthDay(p.nextDate)
    if (!dt) return
    dt.setHours(0, 0, 0, 0)
    if (dt < weekStart || dt >= weekEnd) return
    const idx = Math.round((dt - weekStart) / 86400000)
    days[idx].events.push({
      id: p.id,
      name: p.name,
      card: p.card,
      amount: p.amount,
      color: colorByCard[p.card] ?? '#5E7CE2',
    })
  })

  return days
}

function computeDashboard(transactions, cards, fixedMonthlyAmount = 0, envelopes = [], plans = []) {
  const totalSpent = transactions.reduce((s, tx) => s + tx.amount, 0)
  const totalBudget = cards.reduce((s, c) => s + c.budget, 0)
  // 本月支出 = 已記錄刷卡 + 訂閱／分期（首頁＝刷卡狀態，不含必繳清單）
  const monthlyOut = totalSpent + fixedMonthlyAmount
  const remaining = Math.max(0, totalBudget - monthlyOut)
  const pct = totalBudget > 0 ? monthlyOut / totalBudget : 0
  const status = pct < 0.7 ? 'safe' : pct < 0.9 ? 'warning' : 'danger'
  const monthName = MONTH_NAMES[new Date().getMonth()]

  const txByCard = {}
  transactions.forEach(tx => { txByCard[tx.card] = (txByCard[tx.card] ?? 0) + tx.amount })
  const enrichedCards = cards.map(card => {
    const txUsed = txByCard[card.name] ?? 0
    // 有手動填銀行「本期已刷」就以實際金額為準，否則用逐筆交易加總估算
    const used = Number(card.usedOverride) > 0 ? Number(card.usedOverride) : txUsed
    // 本期應繳 = 這張卡的 刷卡消費 + 訂閱 + 已勾「本期支付」的分期（每期）
    const subsOnCard = plans
      .filter(p => p.type === 'subscription' && (p.active ?? true) && p.card === card.name)
      .reduce((s, p) => s + p.amount, 0)
    // 分期：只有勾了「本期支付」(paid) 的，才把這期金額算進本期卡費
    const instOnCard = plans
      .filter(p => p.type === 'installment' && p.paid && p.card === card.name)
      .reduce((s, p) => s + p.amount, 0)
    // 有手動填銀行「本期應繳」就以實際金額為準，否則用 app 估算
    const computedBill = used + subsOnCard + instOnCard
    const rawBill = Number(card.actualBill) > 0 ? Number(card.actualBill) : computedBill
    // 本期已繳金額（依該卡結帳日所屬週期加總）。
    // 應繳 = 帳單 − 本期已繳：繳清即歸 0；跨到下一期已繳歸零，又顯示應繳（累加下一期）。
    const currentCycle = billingCycleKey(card.billingDay)
    const paidThisCycle = (card.paymentHistory || [])
      .filter(h => h.cycleKey === currentCycle)
      .reduce((s, h) => s + Number(h.amount || 0), 0)
    const upcomingBill = Math.max(0, rawBill - paidThisCycle)
    const cardRemaining = card.budget - used
    const cp = card.budget > 0 ? used / card.budget : 0
    const cardStatus = cp < 0.7 ? 'safe' : cp < 0.9 ? 'warning' : 'danger'
    return {
      ...card, used, upcomingBill,
      billIsActual: Number(card.actualBill) > 0,
      usedIsActual: Number(card.usedOverride) > 0,
      status: cardStatus,
      statusText: cardStatus === 'safe'
        ? `還有 NT$${cardRemaining.toLocaleString()} 可用`
        : cardStatus === 'warning' ? '接近預算上限'
        : '已超出預算',
    }
  })

  const catMap = {}
  transactions.forEach(tx => { catMap[tx.category] = (catMap[tx.category] ?? 0) + tx.amount })
  const categories = Object.entries(catMap)
    .map(([name, amount]) => ({
      name, amount,
      percent: totalSpent > 0 ? Math.round(amount / totalSpent * 100) : 0,
      color: CATEGORY_COLORS[name] ?? '#AAA198',
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
      color: CATEGORY_COLORS[e.name] ?? '#AAA198',
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

  const [tab, setTab] = useState('dashboard')
  const [toast, setToast] = useState(null) // { message, onUndo? }
  const toastTimer = useRef(null)
  const [cards, setCards] = useState(stored?.cards ?? [])
  const [plans, setPlans] = useState(stored?.plans ?? [])
  const [transactions, setTransactions] = useState(stored?.transactions ?? [])
  const [fxSettings, setFxSettings] = useState(stored?.fxSettings ?? { usdRate: 32.5, feeRate: 1.5 })
  const [checklist, setChecklist] = useState(initialChecklist)
  const [checklistMonth] = useState(currentMonthKey)
  const [envelopes, setEnvelopes] = useState(stored?.envelopes ?? [])
  const [income, setIncome] = useState(stored?.income ?? 0)
  const [savings, setSavings] = useState(stored?.savings ?? [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards, plans, transactions, fxSettings, checklist, checklistMonth, envelopes, income, savings }))
  }, [cards, plans, transactions, fxSettings, checklist, checklistMonth, envelopes, income, savings])

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
  // 標記本期卡費已繳：當期不再提醒；可選擇從連動的儲蓄帳戶扣款；並留下繳費紀錄
  const handleMarkCardPaid = useCallback((id, opts = {}) => {
    const today = new Date().toISOString().slice(0, 10)
    setCards(p => p.map(c => {
      if (c.id !== id) return c
      // 以「該卡結帳日」算出當期代號，標記為已繳；下次結帳日到才會自動換期
      const cycleKey = billingCycleKey(c.billingDay)
      const amount = Number(opts.billAmount) || 0
      const entry = { id: crypto.randomUUID(), cycleKey, amount, date: today }
      // 累加記錄本期繳款；應繳金額會在 computeDashboard 依此扣減而歸零
      return { ...c, billPaidMonth: cycleKey, paymentHistory: [entry, ...(c.paymentHistory || [])] }
    }))
    if (opts.fromSavingId && Number(opts.amount) > 0) {
      handleSpendSaving(opts.fromSavingId, Number(opts.amount), '繳卡費')
    }
  }, [handleSpendSaving])

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
  const lifeBalance = income - essentialTotal

  const { currentMonth, enrichedCards, categories, trends, envelopeView, envelopeSummary } = computeDashboard(transactions, cards, fixedMonthlyAmount, envelopes, plans)
  const weekDays = buildWeekDays(plans, enrichedCards)

  // 繳費提醒：本期應繳 > 0、有設繳款截止日、且本月尚未標記已繳
  const todayDate = new Date().getDate()
  const paymentReminders = enrichedCards
    .filter(c => Number(c.upcomingBill) > 0 && Number(c.dueDate) > 0 && c.billPaidMonth !== billingCycleKey(c.billingDay))
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
      billPaid: c.billPaidMonth === billingCycleKey(c.billingDay),
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
      />
    ),
    plans: (
      <Plans
        showToast={showToast}
        plans={plans}
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
