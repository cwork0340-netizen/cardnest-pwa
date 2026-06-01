import { useState } from 'react'
import './Transactions.css'
import SectionHeader from '../components/SectionHeader'
import TransactionItem from '../components/TransactionItem'
import BottomSheet from '../components/BottomSheet'
import QuickTransactionForm from '../components/QuickTransactionForm'
import EmptyState from '../components/EmptyState'

export default function Transactions({ showToast, transactions, cards, onAddTransaction, onDeleteTransaction }) {
  const [showSheet, setShowSheet] = useState(false)

  function handleSubmit({ amount, category, card, date, note }) {
    const newTx = {
      id: crypto.randomUUID(),
      name: note.trim() || category,
      category,
      card,
      amount,
      date: formatDisplayDate(date),
      note,
    }
    onAddTransaction(newTx)
    showToast('已幫你記好了')
    setShowSheet(false)
  }

  function handleDelete(id) {
    onDeleteTransaction(id)
    showToast('已從清單移除')
  }

  function formatDisplayDate(isoDate) {
    const [, m, d] = isoDate.split('-')
    return `${Number(m)}/${Number(d)}`
  }

  return (
    <div className="tx-page">
      <div className="tx-page-header">
        <h1 className="tx-page-title">刷卡記錄</h1>
      </div>

      <div className="section">
        <SectionHeader title="所有消費" />
        {transactions.length === 0 ? (
          <EmptyState
            icon="💳"
            title="還沒有刷卡記錄"
            description="點擊右下角開始記第一筆"
          />
        ) : (
          transactions.map((tx) => (
            <div className="card" key={tx.id}>
              <TransactionItem tx={tx} onDelete={handleDelete} />
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
        open={showSheet}
        onClose={() => setShowSheet(false)}
        title="記一筆"
      >
        <QuickTransactionForm
          onSubmit={handleSubmit}
          onClose={() => setShowSheet(false)}
          cards={cards}
        />
      </BottomSheet>
    </div>
  )
}
