import { useState, useCallback, useEffect, useRef } from 'react'
import BottomNav from './components/BottomNav'
import Toast from './components/Toast'
import Dashboard from './pages/Dashboard'
import Plans from './pages/Plans'
import Transactions from './pages/Transactions'
import Settings from './pages/Settings'
import { cards as mockCards, plans as mockPlans, transactions as mockTx } from './data/mock'

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
const CATEGORY_COLORS = {
  餐飲: '#5E7CE2', 購物: '#D49A45', 訂閱: '#6FA37C',
  日常: '#A380C6', 交通: '#D96B5F', 娛樂: '#D49A45', 其他: '#AAA198',
}
const TREND_BASE = [
  { month: '12月', amount: 31200 }, { month: '1月', amount: 28940 },
  { month: '2月', amount: 25380 }, { month: '3月', amount: 36120 },
  { month: '4月', amount: 33880 }, { month: '5月', amount: 39140 },
]

function computeDashboard(transactions, cards, fixedMonthlyAmount = 0) {
  const totalSpent = transactions.reduce((s, tx) => s + tx.amount, 0)
  const totalBudget = cards.reduce((s, c) => s + c.budget, 0)
  const remaining = Math.max(0, totalBudget - totalSpent)
  const pct = totalBudget > 0 ? totalSpent / totalBudget : 0
  const status = pct < 0.7 ? 'safe' : pct < 0.9 ? 'warning' : 'danger'
  const monthName = MONTH_NAMES[new Date().getMonth()]

  const txByCard = {}
  transactions.forEach(tx => { txByCard[tx.card] = (txByCard[tx.card] ?? 0) + tx.amount })
  const enrichedCards = cards.map(card => {
    const used = txByCard[card.name] ?? 0
    const cardRemaining = card.budget - used
    const cp = card.budget > 0 ? used / card.budget : 0
    const cardStatus = cp < 0.7 ? 'safe' : cp < 0.9 ? 'warning' : 'danger'
    return {
      ...card, used,
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

  const trends = [...TREND_BASE, { month: monthName, amount: totalSpent }]

  const estimatedTotal = totalSpent + fixedMonthlyAmount
  const currentMonth = {
    name: monthName,
    lastSync: '剛剛',
    total: totalSpent,
    budget: totalBudget,
    remaining,
    fixedMonthlyAmount,
    estimatedTotal,
    status,
    statusText: status === 'safe' ? `${monthName}目前很穩` : status === 'warning' ? `${monthName}需要留意` : `${monthName}已超支`,
  }

  return { currentMonth, enrichedCards, categories, trends }
}

export default function App() {
  const stored = loadStorage()

  const [tab, setTab] = useState('dashboard')
  const [toast, setToast] = useState(null) // { message, onUndo? }
  const toastTimer = useRef(null)
  const [cards, setCards] = useState(stored?.cards ?? mockCards)
  const [plans, setPlans] = useState(stored?.plans ?? mockPlans)
  const [transactions, setTransactions] = useState(stored?.transactions ?? mockTx)
  const [fxSettings, setFxSettings] = useState(stored?.fxSettings ?? { usdRate: 32.5, feeRate: 1.5 })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards, plans, transactions, fxSettings }))
  }, [cards, plans, transactions, fxSettings])

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
  const handleMarkPaid = useCallback((id) => setPlans(p => p.map(x => x.id === id ? { ...x, paid: !x.paid } : x)), [])

  // Transactions handlers
  const handleAddTransaction = useCallback((tx) => setTransactions(p => [tx, ...p]), [])
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

  // Cards handlers
  const handleAddCard = useCallback((card) => setCards(p => [...p, card]), [])
  const handleSaveCard = useCallback((updated) => setCards(p => p.map(c => c.id === updated.id ? updated : c)), [])
  const handleDeleteCard = useCallback((id) => setCards(p => p.filter(c => c.id !== id)), [])

  const fixedMonthlyAmount = plans
    .filter(p => p.daysLeft <= 30 && (p.type === 'subscription' || (p.type === 'installment' && !p.paid)))
    .reduce((s, p) => s + p.amount, 0)

  const { currentMonth, enrichedCards, categories, trends } = computeDashboard(transactions, cards, fixedMonthlyAmount)
  const notices = plans
    .filter(p => p.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const pages = {
    dashboard: (
      <Dashboard
        currentMonth={currentMonth}
        notices={notices}
        cards={enrichedCards}
        categories={categories}
        trends={trends}
      />
    ),
    plans: (
      <Plans
        showToast={showToast}
        plans={plans}
        cards={cards}
        fxSettings={fxSettings}
        onAddPlan={handleAddPlan}
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
        onDeleteTransaction={handleDeleteTransaction}
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
      />
    ),
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
