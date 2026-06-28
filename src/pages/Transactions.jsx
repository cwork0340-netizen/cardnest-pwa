import { useState } from 'react'
import './Transactions.css'
import SectionHeader from '../components/SectionHeader'
import TransactionItem from '../components/TransactionItem'
import BottomSheet from '../components/BottomSheet'
import QuickTransactionForm from '../components/QuickTransactionForm'
import EmptyState from '../components/EmptyState'

function formatDisplayDate(isoDate) {
  const [, m, d] = isoDate.split('-')
  return `${Number(m)}/${Number(d)}`
}

const PERIOD_TABS = [
  { key: 'all', label: '全部' },
  { key: 'week', label: '本週' },
  { key: 'month', label: '本月' },
]

// 刷卡記錄的 date 是 "M/D" 字串（沒有年份），跟現在的月份／週比對即可判斷區間
function isInPeriod(displayDate, period, from = new Date()) {
  if (period === 'all' || !displayDate) return true
  const [m, d] = displayDate.split('/').map(Number)
  if (period === 'month') return m === from.getMonth() + 1
  if (period === 'week') {
    const txDate = new Date(from.getFullYear(), m - 1, d)
    const startOfWeek = new Date(from)
    startOfWeek.setDate(from.getDate() - from.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7)
    return txDate >= startOfWeek && txDate < endOfWeek
  }
  return true
}

export default function Transactions({ showToast, transactions, cards, onAddTransaction, onUpdateTransaction, onDeleteTransaction }) {
  const [showSheet, setShowSheet] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [cardFilter, setCardFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')

  const sheetOpen = showSheet || !!editingTx

  const filteredTransactions = transactions.filter((tx) => {
    if (cardFilter !== 'all' && tx.card !== cardFilter) return false
    if (!isInPeriod(tx.date, periodFilter)) return false
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      const haystack = `${tx.name ?? ''} ${tx.note ?? ''} ${tx.category ?? ''} ${tx.card ?? ''}`.toLowerCase()
      if (!haystack.includes(kw)) return false
    }
    return true
  })

  const filteredTotal = filteredTransactions.reduce((s, tx) => s + tx.amount, 0)

  function closeSheet() {
    setShowSheet(false)
    setEditingTx(null)
  }

  function handleSubmit({ amount, category, card, date, note }) {
    const fields = {
      name: note.trim() || category,
      category,
      card,
      amount,
      date: formatDisplayDate(date),
      note,
    }
    if (editingTx) {
      onUpdateTransaction({ ...editingTx, ...fields })
      showToast('記錄已更新')
    } else {
      onAddTransaction({ id: crypto.randomUUID(), ...fields })
      showToast('已幫你記好了')
    }
    closeSheet()
  }

  function handleDelete(id) {
    onDeleteTransaction(id)
    showToast('已從清單移除')
  }

  return (
    <div className="tx-page">
      <div className="tx-page-header">
        <h1 className="tx-page-title">刷卡記錄</h1>
      </div>

      {transactions.length > 0 && (
        <div className="tx-filters">
          <input
            className="fx-input tx-search-input"
            type="search"
            placeholder="搜尋備註、分類、卡片…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <div className="segmented-tabs">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`segmented-tab${periodFilter === tab.key ? ' segmented-tab-active' : ''}`}
                onClick={() => setPeriodFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <select className="fx-input tx-card-select" value={cardFilter} onChange={(e) => setCardFilter(e.target.value)}>
            <option value="all">所有卡片</option>
            {cards.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="section">
        <SectionHeader title="所有消費" />
        {filteredTransactions.length > 0 && (
          <div className="tx-total-bar">
            <span className="tx-total-label">{cardFilter === 'all' ? '全部' : cardFilter} 合計（{filteredTransactions.length} 筆）</span>
            <span className="tx-total-amount">-NT${filteredTotal.toLocaleString()}</span>
          </div>
        )}
        {transactions.length === 0 ? (
          <EmptyState
            icon="💳"
            title="還沒有刷卡記錄"
            description="點擊右下角開始記第一筆"
            actionLabel="立即記一筆"
            onAction={() => setShowSheet(true)}
          />
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="找不到符合的記錄"
            description="換個關鍵字或篩選條件試試"
          />
        ) : (
          filteredTransactions.map((tx) => (
            <div className="card" key={tx.id}>
              <TransactionItem tx={tx} onDelete={handleDelete} onEdit={setEditingTx} />
            </div>
          ))
        )}
      </div>

      <button
        className="fab"
        onClick={() => setShowSheet(true)}
        aria-label="記一筆"
      >
        <span>＋</span>
        記一筆
      </button>

      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editingTx ? '修改記錄' : '記一筆'}
      >
        <QuickTransactionForm
          onSubmit={handleSubmit}
          onClose={closeSheet}
          cards={cards}
          initialValues={editingTx}
        />
      </BottomSheet>
    </div>
  )
}
