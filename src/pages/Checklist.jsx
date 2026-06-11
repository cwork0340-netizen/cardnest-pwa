import { useState } from 'react'
import './Checklist.css'
import SectionHeader from '../components/SectionHeader'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import ChecklistItem from '../components/ChecklistItem'
import ChecklistForm from '../components/ChecklistForm'

export default function Checklist({ showToast, items, monthName, onAdd, onToggle, onUpdate, onDelete }) {
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  const sheetOpen = showAddSheet || !!editingItem

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
        <h1 className="checklist-title">必繳清單</h1>
        {monthName && <span className="checklist-sub">{monthName}．每月月初自動重置</span>}
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
