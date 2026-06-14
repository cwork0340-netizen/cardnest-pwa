import { useState } from 'react'
import './Checklist.css'
import SectionHeader from '../components/SectionHeader'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import ChecklistItem from '../components/ChecklistItem'
import ChecklistForm from '../components/ChecklistForm'

export default function Checklist({ showToast, items, monthName, income = 0, essentialTotal = 0, lifeBalance = 0, onIncomeChange, onAdd, onToggle, onUpdate, onDelete }) {
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [incomeInput, setIncomeInput] = useState(income ? String(income) : '')

  const sheetOpen = showAddSheet || !!editingItem

  function commitIncome() {
    const n = Number(incomeInput)
    if (Number.isNaN(n) || n < 0) { setIncomeInput(income ? String(income) : ''); return }
    if (n !== income) {
      onIncomeChange(n)
      showToast('月收入已更新')
    }
  }

  function closeSheet() {
    setShowAddSheet(false)
    setEditingItem(null)
  }

  const doneCount = items.filter((i) => i.done).length
  const remainingAmount = items
    .filter((i) => !i.done)
    .reduce((s, i) => s + Number(i.amount), 0)

  function handleToggle(id) {
    const item = items.find((i) => i.id === id)
    onToggle(id)
    showToast(item?.done ? '已取消已繳標記' : '已標記繳清')
  }

  function handleDelete(id) {
    onDelete(id)
    showToast('已從清單移除')
  }

  function handleSubmit(item) {
    if (editingItem) {
      onUpdate(item)
      showToast('項目已更新')
    } else {
      onAdd(item)
      showToast('已加入必繳清單')
    }
    closeSheet()
  }

  return (
    <div className="checklist-page">
      <div className="checklist-header">
        <h1 className="checklist-title">必要支出</h1>
        {monthName && <span className="checklist-sub">{monthName}．收入扣掉必要支出＝可生活的錢</span>}
      </div>

      <div className="card checklist-budget">
        <div className="checklist-budget-row">
          <label className="checklist-budget-label" htmlFor="income-input">月收入</label>
          <div className="checklist-budget-input-wrap">
            <span className="checklist-budget-prefix">NT$</span>
            <input
              id="income-input"
              className="checklist-budget-input"
              type="number"
              inputMode="numeric"
              placeholder="填入每月收入"
              value={incomeInput}
              onChange={(e) => setIncomeInput(e.target.value)}
              onBlur={commitIncome}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
            />
          </div>
        </div>
        <div className="checklist-budget-row">
          <span className="checklist-budget-label">必要支出</span>
          <span className="checklist-budget-amount">NT${essentialTotal.toLocaleString()}</span>
        </div>
        <div className="checklist-budget-divider" />
        <div className="checklist-budget-row">
          <span className="checklist-budget-label">生活結餘</span>
          {income > 0 ? (
            lifeBalance >= 0 ? (
              <span className="checklist-budget-left">還有 NT${lifeBalance.toLocaleString()} 可生活</span>
            ) : (
              <span className="checklist-budget-over">超出 NT${(-lifeBalance).toLocaleString()}，沒有餘裕</span>
            )
          ) : (
            <span className="checklist-budget-hint">填上月收入即可看生活結餘</span>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="card checklist-summary">
          <div className="checklist-summary-row">
            <span className="checklist-summary-label">本月進度</span>
            <span className="checklist-summary-value">{doneCount}/{items.length} 已繳</span>
          </div>
          <div className="checklist-summary-row">
            <span className="checklist-summary-label">尚未繳清</span>
            <span className="checklist-summary-amount">NT${remainingAmount.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="section" style={{ marginTop: 'var(--section-gap)' }}>
        <SectionHeader title="必繳項目" />
        {items.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="還沒有必繳項目"
            description="把房租、水電、電信等每月固定支出加進來，繳完打勾就好"
          />
        ) : (
          items.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onEdit={setEditingItem}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <button
        className="fab"
        onClick={() => setShowAddSheet(true)}
        aria-label="新增項目"
      >
        <span>＋</span>新增項目
      </button>

      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editingItem ? '修改項目' : '新增必繳項目'}
      >
        <ChecklistForm
          onSubmit={handleSubmit}
          onClose={closeSheet}
          initialValues={editingItem}
        />
      </BottomSheet>
    </div>
  )
}
