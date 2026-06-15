import { useState } from 'react'
import './Checklist.css'
import SectionHeader from '../components/SectionHeader'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import ChecklistItem from '../components/ChecklistItem'
import ChecklistForm from '../components/ChecklistForm'
import SavingGoalCard from '../components/SavingGoalCard'
import SavingsForm from '../components/SavingsForm'

export default function Checklist({
  showToast, items, monthName,
  income = 0, essentialTotal = 0, checklistTotal = 0, savingsMonthly = 0, essentialSavings = 0, lifeBalance = 0,
  savings = [], onIncomeChange,
  onAdd, onToggle, onUpdate, onDelete,
  onAddSaving, onUpdateSaving, onDeleteSaving, onContributeSaving, onResetSaving,
}) {
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showSavingsSheet, setShowSavingsSheet] = useState(false)
  const [editingSaving, setEditingSaving] = useState(null)
  const [incomeInput, setIncomeInput] = useState(income ? String(income) : '')

  const sheetOpen = showAddSheet || !!editingItem
  const savingsSheetOpen = showSavingsSheet || !!editingSaving

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

  function closeSavingsSheet() {
    setShowSavingsSheet(false)
    setEditingSaving(null)
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

  function handleSavingsSubmit(goal) {
    if (editingSaving) {
      onUpdateSaving(goal)
      showToast('儲蓄目標已更新')
    } else {
      onAddSaving(goal)
      showToast('已新增儲蓄目標')
    }
    closeSavingsSheet()
  }

  function handleContribute(id) {
    onContributeSaving(id)
    showToast('已撥入本月儲蓄')
  }

  function handleReset(id) {
    onResetSaving(id)
    showToast('已動用，重新累積')
  }

  function handleDeleteSaving(id) {
    onDeleteSaving(id)
    showToast('已刪除儲蓄目標')
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
        {essentialSavings > 0 && (
          <div className="checklist-budget-sub">
            <span>・必繳清單 NT${checklistTotal.toLocaleString()}</span>
            <span>・額外儲蓄 NT${essentialSavings.toLocaleString()}</span>
          </div>
        )}
        {savingsMonthly > 0 && (
          <div className="checklist-budget-note">
            儲蓄每月撥入 NT${savingsMonthly.toLocaleString()}（已含在必繳清單的不重複計入）
          </div>
        )}
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

      <div className="section" style={{ marginTop: 'var(--section-gap)' }}>
        <SectionHeader title="儲蓄目標" />
        {savings.length === 0 ? (
          <EmptyState
            icon="🐖"
            title="還沒有儲蓄目標"
            description="例如每月存學費、旅遊基金。每月撥入會算進必要支出，幫你先把錢留下來"
          />
        ) : (
          savings.map((goal) => (
            <SavingGoalCard
              key={goal.id}
              goal={goal}
              onEdit={setEditingSaving}
              onDelete={handleDeleteSaving}
              onContribute={handleContribute}
              onReset={handleReset}
            />
          ))
        )}
        <button className="checklist-add-saving" onClick={() => setShowSavingsSheet(true)}>
          ＋ 新增儲蓄目標
        </button>
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

      <BottomSheet
        open={savingsSheetOpen}
        onClose={closeSavingsSheet}
        title={editingSaving ? '修改儲蓄目標' : '新增儲蓄目標'}
      >
        <SavingsForm
          onSubmit={handleSavingsSubmit}
          onClose={closeSavingsSheet}
          initialValues={editingSaving}
        />
      </BottomSheet>
    </div>
  )
}
