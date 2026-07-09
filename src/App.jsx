import { useState, useCallback, useEffect, useRef } from 'react'
import BottomNav from './components/BottomNav'
import Toast from './components/Toast'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Settings from './pages/Settings'
import Checklist from './pages/Checklist'
import Onboarding from './pages/Onboarding'
import { maybeNotifyDueBills } from './utils/notify'
import { nextOccurrence, daysUntil, formatMD, statusForDaysLeft, dayFromMD } from './utils/recurrence'
import { ensureBillingCycles, unpaidCycles, totalUnpaid, daysUntilDue } from './utils/billingCycles'
import {
  ensureInstallmentOccurrences, unpaidInstallmentOccurrences, paidCountOf,
  daysUntilDue as daysUntilInstallmentDue,
} from './utils/installmentCycles'

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
      : (paidCountOf(p) < p.totalCount)
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
    // 這一期進行中的訂閱／分期，給「本期累積」明細參考用（跟帳單週期歷史記錄是兩件事）
    const subsOnCard = plans
      .filter(p => p.type === 'subscription' && (p.active ?? true) && p.card === card.name)
      .reduce((s, p) => s + p.amount, 0)
    const instOnCard = plans
      .filter(p => p.type === 'installment' && p.card === card.name && unpaidInstallmentOccurrences(p).length > 0)
      .reduce((s, p) => s + p.amount, 0)
    const cardRemaining = card.budget - used
    const cp = card.budget > 0 ? used / card.budget : 0
    const cardStatus = cp < 0.7 ? 'safe' : cp < 0.9 ? 'warning' : 'danger'

    // 帳單週期：每一期都是有真實日期的獨立紀錄，未繳的會一直累加，不會因為換月而消失或被誤判
    const unpaid = unpaidCycles(card)
    const unpaidTotal = totalUnpaid(card)
    const unpaidWithDaysLeft = unpaid.map(c => ({ ...c, daysLeft: daysUntilDue(c) }))

    return {
      ...card, used, currentCycleAmount,
      subsOnCard, instOnCard,
      unpaidCycles: unpaidWithDaysLeft, unpaidTotal,
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
  const [googleSync, setGoogleSync] = useState(stored?.googleSync ?? null)
  const [cardImport, setCardImport] = useState(
    stored?.cardImport ?? { sheetId: '', bankCardMap: {}, importedKeys: [] }
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards, plans, transactions, fxSettings, checklist, checklistMonth, envelopes, income, savings, googleSync, cardImport }))
  }, [cards, plans, transactions, fxSettings, checklist, checklistMonth, envelopes, income, savings, googleSync, cardImport])

  // 補齊每張卡的帳單週期：新卡片、或距離上次開啟已經跨過新的結帳日，都會在這裡自動生成
  // 新的一期紀錄並寫回 cards。已經存在的舊週期不會被動到，未繳的會一直留著不會消失。
  useEffect(() => {
    setCards((prev) => {
      let changed = false
      const next = prev.map((card) => {
        const cycles = ensureBillingCycles(card, { transactions, plans })
        if (cycles.length !== (card.billingCycles?.length ?? 0)) {
          changed = true
          return { ...card, billingCycles: cycles }
        }
        return card
      })
      return changed ? next : prev
    })
  }, [cards, transactions, plans])

  // 每月信用卡預估帳單：月初規劃時，每張卡給一個「這個月大概要繳多少」的數字，
  // 整月穩定不變（不會因為有沒有封帳、標記已繳而忽高忽低）。跨月時預設帶入
  // 上一期實際封帳的金額，當作起始估計，Chia 可以在必繳頁手動調整。
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

  // 補齊每筆分期的期數紀錄：邏輯跟卡片帳單週期一樣，依時間流逝自動累加未繳期數，
  // 不再只靠手動點擊「標記已付款」推進，忘記點也不會跟時間脫節。
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
  const handleAddTransaction = useCallback((tx) => setTransactions(p => [tx, ...p]), [])
  const handleUpdateTransaction = useCallback((updated) => setTransactions(p => p.map(t => t.id === updated.id ? updated : t)), [])
  // 單筆刷卡轉分期：新增分期計畫並移除原本的單筆記錄，避免重複計入本月支出
  const handleConvertToInstallment = useCallback((txId, plan) => {
    setPlans(p => [plan, ...p])
    setTransactions(p => p.filter(t => t.id !== txId))
  }, [])

  // 銀行自動收集的刷卡通知匯入：Settings 已用 permalink 去重複、篩掉沒對應卡片的銀行，
  // 這裡只負責把過濾後的新交易加進來，並記錄這批 permalink 避免下次重複匯入
  const handleImportTransactions = useCallback((newTxs, newKeys) => {
    setTransactions(p => [...newTxs, ...p])
    setCardImport(prev => ({
      ...prev,
      importedKeys: [...prev.importedKeys, ...newKeys],
      lastImportAt: Date.now(),
      lastImportCount: newTxs.length,
    }))
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
      handleSpendSaving(opts.fromSavingId, Number(opts.amount), '繳卡費')
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
        billingCycles: (c.billingCycles ?? []).map(cy => cy.id === cycleId ? { ...cy, ...fields } : cy),
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
    .filter(p => p.type === 'subscription' ? (p.active ?? true) : (paidCountOf(p) < p.totalCount))
    .reduce((s, p) => s + p.amount, 0)

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

  const { currentMonth, enrichedCards, categories, trends, envelopeView, envelopeSummary } = computeDashboard(transactions, cards, fixedMonthlyAmount, envelopes, plans)

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

  // 開啟 App 時，若有快到期/逾期的卡費就跳一則瀏覽器通知（今天只跳一次）
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
        onMarkAllCyclesPaid={handleMarkAllCyclesPaid}
        onUpdateCycle={handleUpdateCycle}
        income={income}
        essentialTotal={essentialTotal}
        cardEstimateTotal={cardEstimateTotal}
        lifeBalance={lifeBalance}
        onGoToChecklist={() => setTab('checklist')}
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
        cardEstimates={cardEstimates}
        cardEstimateTotal={cardEstimateTotal}
        onUpdateEstimatedBill={handleUpdateEstimatedBill}
        savings={savings}
        cardBills={cards.map(c => ({ id: c.id, name: c.name, bill: Number(c.estimatedBill) || 0 }))}
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
        cardImport={cardImport}
        onCardImportChange={setCardImport}
        onImportTransactions={handleImportTransactions}
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
