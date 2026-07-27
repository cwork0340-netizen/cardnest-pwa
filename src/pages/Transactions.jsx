import { useState } from 'react'
import './Transactions.css'
import SectionHeader from '../components/SectionHeader'
import TransactionItem from '../components/TransactionItem'
import BottomSheet from '../components/BottomSheet'
import QuickTransactionForm from '../components/QuickTransactionForm'
import ConvertToInstallmentForm from '../components/ConvertToInstallmentForm'
import EmptyState from '../components/EmptyState'
import { matchesCard, parseISODate, resolveCardId, toISODate } from '../utils/financeData'

const PERIOD_TABS = [
  { key: 'all', label: '全部' },
  { key: 'week', label: '本週' },
  { key: 'month', label: '本月' },
  { key: 'range', label: '自訂區間' },
]

// 用本地時區解析 "YYYY-MM-DD"（<input type="date"> 的格式），不能直接 new Date(字串)——
// 那會被當成 UTC 午夜，跟其他本地時間日期比較時會因時區產生誤差。
function parseYmd(s) {
  return parseISODate(s)
}

// 把沒有年份的 "M/D" 還原成跟 near 最接近的完整日期，避免跨年誤判
function resolveNearDate(displayDate, near) {
  return parseISODate(displayDate, near)
}

// 刷卡記錄的 date 是 "M/D" 字串（沒有年份），跟現在的月份／週比對即可判斷區間
function isInPeriod(displayDate, period, { from = new Date(), rangeStart, rangeEnd } = {}) {
  if (period === 'all' || !displayDate) return true
  const parsed = parseISODate(displayDate, from)
  if (!parsed) return true
  if (period === 'month') return parsed.getFullYear() === from.getFullYear() && parsed.getMonth() === from.getMonth()
  if (period === 'week') {
    const txDate = parsed
    const startOfWeek = new Date(from)
    startOfWeek.setDate(from.getDate() - from.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7)
    return txDate >= startOfWeek && txDate < endOfWeek
  }
  if (period === 'range') {
    if (!rangeStart && !rangeEnd) return true
    const near = parseYmd(rangeEnd || rangeStart)
    const txDate = resolveNearDate(displayDate, near)
    if (rangeStart && txDate < parseYmd(rangeStart)) return false
    if (rangeEnd && txDate > parseYmd(rangeEnd)) return false
    return true
  }
  return true
}

export default function Transactions({ showToast, transactions, cards, onAddTransaction, onUpdateTransaction, onDeleteTransaction, onConvertToInstallment }) {
  const [showSheet, setShowSheet] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [convertingTx, setConvertingTx] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [cardFilter, setCardFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  const sheetOpen = showSheet || !!editingTx

  const filteredTransactions = transactions.filter((tx) => {
    if (cardFilter !== 'all') {
      const card = cards.find((c) => c.id === cardFilter || c.name === cardFilter)
      if (!matchesCard(tx, card)) return false
    }
    if (!isInPeriod(tx.date, periodFilter, { rangeStart, rangeEnd })) return false
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

  function handleSubmit({ amount, category, cardId, card, date, note }) {
    const selectedCard = cards.find((c) => c.id === (cardId || resolveCardId({ card }, cards)))
    const fields = {
      name: note.trim() || category,
      category,
      cardId: selectedCard?.id,
      card: selectedCard?.name ?? card,
      amount,
      date: toISODate(date),
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

  function handleConvertSubmit(plan) {
    onConvertToInstallment(convertingTx.id, plan)
    showToast(`已轉為分期，「${plan.name}」改由分期計畫追蹤`)
    setConvertingTx(null)
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
          {periodFilter === 'range' && (
            <div className="tx-range-row">
              <input
                type="date"
                className="fx-input tx-range-input"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
              <span className="tx-range-sep">～</span>
              <input
                type="date"
                className="fx-input tx-range-input"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      <div className="section">
        <SectionHeader title="所有消費" />
        {filteredTransactions.length > 0 && (
          <div className="tx-total-bar">
            <span className="tx-total-label">{cardFilter === 'all' ? '全部' : cards.find((c) => c.id === cardFilter || c.name === cardFilter)?.name} 合計（{filteredTransactions.length} 筆）</span>
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
              <TransactionItem tx={tx} onDelete={handleDelete} onEdit={setEditingTx} onConvert={setConvertingTx} />
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

      <BottomSheet
        open={!!convertingTx}
        onClose={() => setConvertingTx(null)}
        title="轉為分期"
      >
        {convertingTx && (
          <ConvertToInstallmentForm
            tx={convertingTx}
            onSubmit={handleConvertSubmit}
            onClose={() => setConvertingTx(null)}
          />
        )}
      </BottomSheet>
    </div>
  )
}
