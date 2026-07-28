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
import {
  getCardName,
  isSameMonth,
  isBillableTransaction,
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
const CATEGORY_COLORS = {}

function getGreeting(hour) {
  if (hour < 5) return '夜深'
  if (hour < 11) return '早安'
  if (hour < 13) return '午安'
  if (hour < 18) return '午後好'
  return '晚安'
}

// 瘥?撟曇???狡嚗像甈曄??券?嚗鞈???billingDay嚗?鞈?敺?nextDate 摮葡?典???
function billingDayOf(plan) {
  return plan.billingDay ?? dayFromMD(plan.nextDate) ?? 1
}

// ???梧?????甈∠??擗予?詻???瘥活皜脫??賢??銝甈∴?
// 銝??訾縑?啣??嗡????脰??ㄐ??nextDate / daysLeft / status嚗?
// ?見?交?撠曹???典遣蝡憭抬?瘞賊?頝???憭押?敺???
function enrichPlans(plans) {
  return plans.map(p => {
    if (p.type === 'installment') {
      const unpaid = unpaidInstallmentOccurrences(p)
      const paidCount = paidCountOf(p)
      const next = unpaid[0]
      if (!next) {
        // 撌脩??券蝜喳?嚗???鋆?鞈?嚗?蝬剜??Ｘ?甈?銝撥銵?撖?
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

// 撱箇??祇梧??望韏瑞?嚗?憭拍???狡銵???鈭辣隞亙???脫?蝷?
function buildWeekDays(plans, cards) {
  const colorByCard = {}
  const colorByCardId = {}
  cards.forEach(c => { colorByCard[c.name] = c.color })
  cards.forEach(c => { colorByCardId[c.id] = c.color })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay()) // ?望
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

// ?瑕閮???date ??"M/D" 憿舐內摮葡嚗??僑隞踝?嚗??曉瘥??遢?喳?斗?臭??舀??
function isThisMonth(displayDate, from = new Date()) {
  return isSameMonth(displayDate, from)
}

// ???僑隞賜? "M/D" ???? near ??亥????湔???踹?頝典僑隤文嚗?憒?12 ?董?桅望?頝典 1 ??
function resolveNearDate(displayDate, near) {
  return parseISODate(displayDate, near)
}

// 靘?撣單???箇???典董?桅望?????銝活蝯董?伐??祆?撣喳?芣迫暺???銝活蝯董?伐?銝?撣喳韏琿?嚗?
function billingCycleBounds(billingDay, today) {
  if (!billingDay) return null
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
  const lastBillingDate = d >= billingDay ? new Date(y, m, billingDay) : new Date(y, m - 1, billingDay)
  const prevBillingDate = new Date(lastBillingDate.getFullYear(), lastBillingDate.getMonth() - 1, billingDay)
  return { prevBillingDate, lastBillingDate }
}

function computeDashboard(transactions, cards, fixedMonthlyAmount = 0, envelopes = [], plans = []) {
  // ??嚗?蝜喳????瑕閮?嚗楊????????頝臬?銝敞??
  const monthTx = transactions.filter(tx => Number(tx.amount) > 0 && isThisMonth(tx.date))
  const totalSpent = monthTx.reduce((s, tx) => s + tx.amount, 0)
  const totalBudget = cards.reduce((s, c) => s + c.budget, 0)
  // ?祆??臬 = 撌脰????+ 閮嚗???擐?嚗?∠???銝敹像皜嚗?
  const monthlyOut = totalSpent + fixedMonthlyAmount
  const remaining = Math.max(0, totalBudget - monthlyOut)
  const pct = totalBudget > 0 ? monthlyOut / totalBudget : 0
  const status = pct < 0.7 ? 'safe' : pct < 0.9 ? 'warning' : 'danger'
  const monthName = MONTH_NAMES[new Date().getMonth()]

  const today = new Date()
  const enrichedCards = cards.map(card => {
    const cardTx = transactions.filter(tx => matchesCard(tx, card) && isBillableTransaction(tx))
    const bounds = billingCycleBounds(card.billingDay, today)
    // 銝?嚗歇蝯董嚗?敺像甈橘?嚗?敞蝛?蝯董?乩?敺?瑞?嚗?瘝撣喉?嚗?蝯董?亙?嚗??舀??
    let used, currentCycleAmount
    if (bounds) {
      used = cardTx
        .filter(tx => { const dt = resolveNearDate(transactionCycleDate(tx), today); return dt && dt > bounds.prevBillingDate && dt <= bounds.lastBillingDate })
        .reduce((s, tx) => s + tx.amount, 0)
      currentCycleAmount = cardTx
        .filter(tx => { const dt = resolveNearDate(transactionCycleDate(tx), today); return dt && dt > bounds.lastBillingDate && dt <= today })
        .reduce((s, tx) => s + tx.amount, 0)
    } else {
      // 瘝‵蝯董?伐?????祆??隡啁?
      used = cardTx.filter(tx => isThisMonth(tx.date)).reduce((s, tx) => s + tx.amount, 0)
      currentCycleAmount = 0
    }
    // ???脰?銝剔?閮嚗???蝯艾?敞蝛?蝝啣??嚗?撣喳?望?甇瑕閮??臬隞嗡?嚗?
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
    const cardRemaining = card.budget - used
    const cp = card.budget > 0 ? used / card.budget : 0
    const cardStatus = cp < 0.7 ? 'safe' : cp < 0.9 ? 'warning' : 'danger'

    // 撣喳?望?嚗?銝??舀??祕?交??蝡????芰像??銝?渡敞??銝??????憭望?鋡怨炊??
    const unpaid = unpaidCycles(card)
    const unpaidTotal = totalUnpaid(card)
    const unpaidWithDaysLeft = unpaid.map(c => ({ ...c, daysLeft: daysUntilDue(c) }))

    // ?箏?憿舐內??甈∠?撣喉?蝜單狡?伐??湔敺?身摰蝞?銝?鞈湔?瘝??芰像撣喳嚗?
    // 撠梁???????0 銋?敺?撐?⊥?????撣喋???蝜喋?
    const nextClose = nextOccurrence(Number(card.billingDay) || 1)
    const nextDue = new Date(nextClose)
    nextDue.setDate(nextDue.getDate() + (Number(card.dueDay) || 0))

    return {
      ...card, used, currentCycleAmount,
      subsOnCard, instOnCard,
      unpaidCycles: unpaidWithDaysLeft, unpaidTotal,
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
      color: CATEGORY_COLORS[name] ?? '#B9ADA6',
    }))
    .sort((a, b) => b.amount - a.amount)

  // ??靽∪???嚗??縑撠??祆?撌脰嚗?瑕???蜇嚗?瘥?憿漲
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

  const trendMap = monthTx.reduce((map, tx) => {
    const date = parseISODate(tx.date, today)
    if (!date) return map
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + Number(tx.amount || 0))
    return map
  }, new Map())
  const trends = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => {
      const [, month] = key.split('-')
      return { month: `${Number(month)}/${today.getFullYear()}`, amount }
    })

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

  return { currentMonth, enrichedCards, categories, trends, envelopeView, envelopeSummary }
}

export default function App() {
  const stored = loadStorage()

  // 敹像皜?????蝵柴?頝冽?????????格敺拍?芰像
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

  // 鋆?瘥撐?∠?撣喳?望?嚗?∠???頝銝活??撌脩?頝券??啁?蝯董?伐??賣??券ㄐ?芸???
  // ?啁?銝???蒂撖怠? cards?歇蝬??函??望?銝?鋡怠??堆??芰像??銝?渡?????憭晞?
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

  // 瘥?靽∠?⊿?隡啣董?殷???閬???瘥撐?∠策銝??憭扳?閬像憭????詨?嚗?
  // ?湔?蝛拙?銝?嚗????箸?瘝?撠董??閮歇蝜唾蕭擃蕭雿??楊???身撣嗅
  // 銝??祕??撣喟???嚗雿絲憪摯閮?Chia ?臭誑?典?蝜喲???隤踵??
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

  // 鋆?瘥??????貊????摩頝?董?桅望?銝璅??靘?????敞?蝜單??賂?
  // 銝??芷???暺???閮歇隞狡??莎?敹?暺?銝?頝??蝭??
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
      // 閮瘝??璁艙嚗??撌脖????
      if (x.type !== 'installment') return { ...x, paid: !x.paid }

      // ??嚗?閮??拇蝜喟?銝?撌脩像嚗?桀?瘝??芰像???末?賜像摰?嚗?
      // 隞?”?活暺??航????餈?甈⊥?閮??孵??日?????撌脩像?????
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
  const handleUpdateTransaction = useCallback((updated) => setTransactions(p => p.map(t => t.id === updated.id ? normalizeTransaction(updated) : t)), [normalizeTransaction])
  // ?桃??瑕頧????啣???閮銝衣宏?文??祉??桃?閮?嚗??銴??交???
  const handleConvertToInstallment = useCallback((txId, plan) => {
    setPlans(p => [normalizePlan(plan), ...p])
    setTransactions(p => p.filter(t => t.id !== txId))
  }, [normalizePlan])

  // ?銵????瑕??臬嚗ettings 撌脩 permalink ?駁?銴祟??撠??∠???銵?
  // ?ㄐ?芾?鞎祆??蕪敺??唬漱???脖?嚗蒂閮?? permalink ?踹?銝活???臬
  const handleImportTransactions = useCallback((newTxs, newKeys) => {
    setTransactions(p => [...newTxs.map(normalizeTransaction), ...p])
    setCardImport(prev => ({
      ...prev,
      importedKeys: [...prev.importedKeys, ...newKeys],
      lastImportAt: Date.now(),
      lastImportCount: newTxs.length,
    }))
  }, [normalizeTransaction])
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

  // Checklist handlers嚗???蝜單??殷?
  const handleAddChecklistItem = useCallback((item) => setChecklist(p => [...p, item]), [])
  const handleUpdateChecklistItem = useCallback((updated) => setChecklist(p => p.map(i => i.id === updated.id ? updated : i)), [])
  const handleDeleteChecklistItem = useCallback((id) => setChecklist(p => p.filter(i => i.id !== id)), [])

  // ?暸敹像?嚗??董?園??甇日??殷??嗆??暸嚗??銝祕??憿??亙董?塚???嚗??蝑?
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
        if (monthEntry) return g // ??撌脣??伐?銝?銴?
        const entry = { id: crypto.randomUUID(), type: 'in', amount: amt, date: dateStr, note: '?祆??亙', month: checklistMonth, source: 'checklist' }
        return { ...g, saved: Number(g.saved) + amt, entries: [...entries, entry] }
      }
      if (!monthEntry) return g // ???祆??亙
      return { ...g, saved: Number(g.saved) - Number(monthEntry.amount), entries: entries.filter(e => e.id !== monthEntry.id) }
    }))
  }, [checklist, checklistMonth])

  // ?脰?撣單
  const handleAddSaving = useCallback((goal) => setSavings(p => [...p, { entries: [], ...goal }]), [])
  const handleUpdateSaving = useCallback((updated) => setSavings(p => p.map(g => g.id === updated.id ? { ...g, ...updated } : g)), [])
  const handleDeleteSaving = useCallback((id) => setSavings(p => p.filter(g => g.id !== id)), [])
  // ???亙嚗????董?嗥嚗?
  const handleContributeSaving = useCallback((id) => setSavings(p => p.map(g => {
    if (g.id !== id) return g
    const amt = Number(g.monthly)
    const dateStr = `${new Date().getMonth() + 1}/${new Date().getDate()}`
    const entry = { id: crypto.randomUUID(), type: 'in', amount: amt, date: dateStr, note: '???亙', source: 'manual' }
    return { ...g, saved: Number(g.saved) + amt, entries: [...(g.entries ?? []), entry] }
  })), [])
  // 撣單?臬嚗祕???Ｚ??靘?蝜喳飛鞎鳴?
  const handleSpendSaving = useCallback((id, amount, note) => setSavings(p => p.map(g => {
    if (g.id !== id) return g
    const amt = Number(amount)
    const dateStr = `${new Date().getMonth() + 1}/${new Date().getDate()}`
    const entry = { id: crypto.randomUUID(), type: 'out', amount: amt, date: dateStr, note: note || '?臬', source: 'manual' }
    return { ...g, saved: Number(g.saved) - amt, entries: [...(g.entries ?? []), entry] }
  })), [])
  // ??券嚗飛?塚?閮?銝蝑?綽?
  const handleResetSaving = useCallback((id) => setSavings(p => p.map(g => {
    if (g.id !== id) return g
    const amt = Number(g.saved)
    if (amt <= 0) return g
    const dateStr = `${new Date().getMonth() + 1}/${new Date().getDate()}`
    const entry = { id: crypto.randomUUID(), type: 'out', amount: amt, date: dateStr, note: '??券', source: 'manual' }
    return { ...g, saved: 0, entries: [...(g.entries ?? []), entry] }
  })), [])

  // Envelope handlers嚗?憿縑撠?蝞?
  const handleAddEnvelope = useCallback((env) => setEnvelopes(p => [...p, env]), [])
  const handleUpdateEnvelope = useCallback((updated) => setEnvelopes(p => p.map(e => e.id === updated.id ? updated : e)), [])
  const handleDeleteEnvelope = useCallback((id) => setEnvelopes(p => p.filter(e => e.id !== id)), [])

  // Cards handlers
  const handleAddCard = useCallback((card) => setCards(p => [...p, card]), [])
  const handleSaveCard = useCallback((updated) => setCards(p => p.map(c => c.id === updated.id ? updated : c)), [])
  const handleDeleteCard = useCallback((id) => setCards(p => p.filter(c => c.id !== id)), [])
  // 璅????董?桀歇蝜喉?cycleId ?典??臭?嚗?交?箏????∠?頝銝???
  // ?舫???????董?嗆甈?
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

  // 銝甈⊥??撐?⊥??蝜喟???賣?閮歇蝜喉?靘?鋆像憟賢嗾??甈?撣喳嚗?
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

  // ???寞?銝???唳??伐?撱嗅?蝜單狡嚗??楊頛舫?憿??銵祕?董?株?隡啁?銝???
  const handleUpdateCycle = useCallback((cardId, cycleId, fields) => {
    setCards(prev => prev.map(c => {
      if (c.id !== cardId) return c
      return {
        ...c,
        billingCycles: (c.billingCycles ?? []).map(cy => cy.id === cycleId ? { ...cy, ...fields } : cy),
      }
    }))
  }, [])

  // ??隤踵???縑?典?摯撣喳??嚗????嚗?帘摰?銝?撠董/撌脩像??蔣?選?
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

  // ???遢嚗?臬????寡???
  const handleImportData = useCallback((data) => {
    if (!data || typeof data !== 'object') return false
    const normalized = normalizeFinanceData(data)
    setCards(normalized.cards)
    setPlans(normalized.plans)
    setTransactions(normalized.transactions)
    setChecklist(Array.isArray(data.checklist) ? data.checklist : [])
    setEnvelopes(Array.isArray(data.envelopes) ? data.envelopes : [])
    if (data.fxSettings && typeof data.fxSettings === 'object') setFxSettings(data.fxSettings)
    if (typeof data.income === 'number') setIncome(data.income)
    setSavings(Array.isArray(data.savings) ? data.savings : [])
    setGoogleSync(data.googleSync ?? null)
    setCardImport(data.cardImport ?? { sheetId: '', bankCardMap: {}, importedKeys: [] })
    return true
  }, [])

  // 擐?嚗?∠????祆??臬?摰?? ?????+ ?芰像皜???瘥?嚗?銝敹像皜
  const fixedMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const fixedMonthEnd = endOfMonth(new Date())
  const fixedMonthlyAmount = plans
    .filter(p => p.type === 'subscription' ? (p.active ?? true) : (paidCountOf(p) < p.totalCount))
    .reduce((s, p) => {
      const args = { plan: p, transactions, cards, windowStart: fixedMonthStart, windowEnd: fixedMonthEnd }
      return s + (p.type === 'installment' ? installmentAmountNotRecordedInWindow(args) : planAmountNotRecorded(args))
    }, 0)

  // 敹??臬 / ?暑??
  // ?芰??歇?暸??敹像?嚗?訾誨銵券?撌脩?蝣箏????Ｙ?銝?嚗?
  // ?芸?貊??閬??挾嚗?閰脫????脣?閬?箇蜇憿?
  const checklistTotal = checklist.filter(i => i.done).reduce((s, i) => s + Number(i.amount), 0)
  // ???敹像??????撌脣敹像皜鋆∴?銝?銴??乓?
  // ?芣?????銝?賊?憭???撣單嚗??舀?乩?憭憭????脣?閬?箝?
  const savingsMonthly = savings.reduce((s, g) => s + Number(g.monthly || 0), 0)
  const essentialSavings = savings
    .filter(g => !g.linkedChecklistId && g.countInEssential)
    .reduce((s, g) => s + Number(g.monthly || 0), 0)
  const essentialTotal = checklistTotal + essentialSavings

  const { currentMonth, enrichedCards, categories, trends, envelopeView, envelopeSummary } = computeDashboard(transactions, cards, fixedMonthlyAmount, envelopes, plans)

  // 靽∠?⊿?隡啣董?殷???閬??身摰??詨?嚗?帘摰?霈?銝?撠董嚗歇蝜喟??蔣?踱?
  // ???撌脩??望?撠望?望?鈭?銝??璅?撌脩像撠晞????暑蝯???
  const cardEstimates = cards
    .filter(c => Number(c.estimatedBill) > 0)
    .map(c => ({ id: c.id, name: c.name, amount: Number(c.estimatedBill) }))
  const cardEstimateTotal = cardEstimates.reduce((s, c) => s + c.amount, 0)
  const lifeBalance = income - essentialTotal - cardEstimateTotal
  const weekDays = buildWeekDays(plans, enrichedCards)
  const enrichedPlans = enrichPlans(plans)

  // 蝜唾祥??嚗?瘥撐?～??蝜喟??望??文像??蝑?蝑?????撘萄?航?????蝜喉?嚗?
  // 憭拇?函?甇???交??豢?嚗?????敶梢??
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

  // ???嚗?銝???鞎駁??董??
  const dashboardCards = enrichedCards.map(c => {
    const reserve = savings.find(g => g.linkedCardId === c.id)
    return {
      ...c,
      reserve: reserve ? { id: reserve.id, name: reserve.name, saved: Number(reserve.saved) } : null,
    }
  })

  // ?? App ???交?敹怠???暹??鞎餃停頝喃??汗?券嚗?憭拙頝喃?甈∴?
  useEffect(() => {
    maybeNotifyDueBills(paymentReminders)
  }, [paymentReminders])

  // ?芸?鞎嚗??Ｚ??菜??堆?嚗閮??蝜單??擗???? 瘥???
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
  const dateLabel = `${now.getMonth() + 1}??{now.getDate()}????${WEEKDAY_NAMES[now.getDay()]}`

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
        backupData={{ cards, plans, transactions, checklist, checklistMonth, envelopes, fxSettings, income, savings, googleSync, cardImport }}
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
