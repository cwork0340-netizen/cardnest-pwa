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

export default function Transactions({ showToast, transactions, cards, onAddTransaction, onUpdateTransaction, onDeleteTransaction }) {
  const [showSheet, setShowSheet] = useState(false)
  const [editingTx, setEditingTx] = useState(null)

  const sheetOpen = showSheet || !!editingTx

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

      <div className="section">
        <SectionHeader title="所有消費" />
        {transactions.length === 0 ? (
          <EmptyState
            icon="💳"
            title="還沒有刷卡記錄"
            description="點擊右下角開始記第一筆"
            actionLabel="立即記一筆"
            onAction={() => setShowSheet(true)}
          />
        ) : (
          transactions.map((tx) => (
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
