import { useState } from 'react'
import './Checklist.css'
import SectionHeader from '../components/SectionHeader'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import ChecklistItem from '../components/ChecklistItem'
import ChecklistForm from '../components/ChecklistForm'
import SavingGoalCard from '../components/SavingGoalCard'
import SavingsForm from '../components/SavingsForm'
import SavingsSpendForm from '../components/SavingsSpendForm'
import PlanCard from '../components/PlanCard'
import AddPlanForm from '../components/AddPlanForm'

export default function Checklist({
  showToast, items, monthName,
  income = 0, essentialTotal = 0, checklistTotal = 0, essentialSavings = 0, lifeBalance = 0,
  cardEstimates = [], cardEstimateTotal = 0, onUpdateEstimatedBill,
  savings = [], cardBills = [], onIncomeChange,
  onAdd, onToggle, onUpdate, onDelete,
  onAddSaving, onUpdateSaving, onDeleteSaving, onContributeSaving, onSpendSaving, onResetSaving,
  plans = [], cards = [], fxSettings,
  onAddPlan, onUpdatePlan, onDeletePlan, onMarkPlanPaid,
}) {
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showSavingsSheet, setShowSavingsSheet] = useState(false)
  const [editingSaving, setEditingSaving] = useState(null)
  const [spendingGoal, setSpendingGoal] = useState(null)
  const [spendSuggest, setSpendSuggest] = useState(0)
  const [incomeInput, setIncomeInput] = useState(income ? String(income) : '')
  const [estimateInputs, setEstimateInputs] = useState({})
  const [expandedCardId, setExpandedCardId] = useState(null)
  const [showPlanSheet, setShowPlanSheet] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const planSheetOpen = showPlanSheet || !!editingPlan

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
    showToast(item?.done ? '已取消規劃' : '已規劃這筆支出')
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
    showToast('已領出全部')
  }

  function openSpend(goal, suggest) {
    setSpendingGoal(goal)
    setSpendSuggest(suggest || 0)
  }

  function handleSpendSubmit(amount, note) {
    onSpendSaving(spendingGoal.id, amount, note)
    setSpendingGoal(null)
    setSpendSuggest(0)
    showToast('已記錄帳戶支出')
  }

  function handleDeleteSaving(id) {
    onDeleteSaving(id)
    showToast('已刪除儲蓄目標')
  }

  function estimateValue(card) {
    return estimateInputs[card.id] ?? String(card.bill || '')
  }

  function handleEstimateInput(cardId, value) {
    setEstimateInputs((prev) => ({ ...prev, [cardId]: value }))
  }

  function commitEstimate(card) {
    const raw = estimateInputs[card.id]
    if (raw === undefined) return
    const n = Number(raw)
    if (!Number.isNaN(n) && n !== card.bill) {
      onUpdateEstimatedBill(card.id, n)
      showToast(`已更新「${card.name}」本月預估帳單`)
    }
    setEstimateInputs((prev) => { const next = { ...prev }; delete next[card.id]; return next })
  }

  // 這張卡「已知一定會發生」的部分：啟用中的訂閱＋還沒繳完的分期（每期金額）。
  // 預估帳單低於這個底線代表估太低了——訂閱分期是確定會扣的錢。
  function cardCommitted(cardName) {
    return plans
      .filter((p) => p.card === cardName)
      .filter((p) => p.type === 'subscription' ? (p.active ?? true) : (p.unpaidOccurrences?.length ?? 0) > 0)
      .reduce((s, p) => s + p.amount, 0)
  }

  function cardPlans(cardName) {
    return plans.filter((p) => p.card === cardName)
  }

  // 訂閱分頁拿掉後，訂閱只會出現在各卡片展開後的清單裡，很容易忘記自己訂了什麼、
  // 每月加起來多少錢。這裡固定顯示全部啟用中的訂閱，不用逐卡展開才看得到。
  const activeSubscriptions = plans.filter((p) => p.type === 'subscription' && (p.active ?? true))
  const subscriptionMonthlyTotal = activeSubscriptions.reduce((s, p) => s + Number(p.amount), 0)

  function handlePlanSubmit(plan) {
    if (editingPlan) {
      onUpdatePlan(plan)
      showToast('計畫已更新')
    } else {
      onAddPlan(plan)
      showToast('新的計畫已加入')
    }
    setShowPlanSheet(false)
    setEditingPlan(null)
  }

  function handleMarkPlanPaid(id) {
    const plan = plans.find(p => p.id === id)
    onMarkPlanPaid(id)
    const wasFullyPaid = plan?.type === 'subscription'
      ? plan?.paid
      : (plan?.unpaidOccurrences?.length ?? 0) === 0
    showToast(wasFullyPaid ? '已取消付款標記' : '這期已標記付款')
  }

  function handleDeletePlan(id) {
    onDeletePlan(id)
  }

  return (
    <div className="checklist-page">
      <div className="checklist-header">
        <h1 className="checklist-title">每月規劃</h1>
        {monthName && <span className="checklist-sub">{monthName}．收入扣掉必要支出與卡費＝可生活的錢</span>}
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
        {cardEstimateTotal > 0 && (
          <div className="checklist-budget-row">
            <span className="checklist-budget-label">信用卡預估帳單</span>
            <span className="checklist-budget-amount">NT${cardEstimateTotal.toLocaleString()}</span>
          </div>
        )}
        {cardEstimates.length > 0 && (
          <div className="checklist-budget-sub">
            {cardEstimates.map((c) => (
              <span key={c.id}>・{c.name} NT${c.amount.toLocaleString()}</span>
            ))}
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
        {lifeBalance < 0 && cardEstimates.length > 0 && (
          <div className="checklist-budget-hint" style={{ marginTop: 4 }}>
            主要是{[...cardEstimates].sort((a, b) => b.amount - a.amount)[0].name}卡費 NT$
            {[...cardEstimates].sort((a, b) => b.amount - a.amount)[0].amount.toLocaleString()} 拖累，可考慮調整必要支出或延後非必要刷卡
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="card checklist-summary">
          <div className="checklist-summary-row">
            <span className="checklist-summary-label">本月進度</span>
            <span className="checklist-summary-value">{doneCount}/{items.length} 已規劃</span>
          </div>
          <div className="checklist-summary-row">
            <span className="checklist-summary-label">尚未規劃</span>
            <span className="checklist-summary-amount">NT${remainingAmount.toLocaleString()}</span>
          </div>
        </div>
      )}

      {activeSubscriptions.length > 0 && (
        <div className="section" style={{ marginTop: 'var(--section-gap)' }}>
          <SectionHeader title="訂閱總覽" />
          <div className="card checklist-summary">
            <div className="checklist-summary-row">
              <span className="checklist-summary-label">每月訂閱合計</span>
              <span className="checklist-summary-amount">NT${subscriptionMonthlyTotal.toLocaleString()}</span>
            </div>
          </div>
          <div className="checklist-estimate-plans" style={{ marginTop: 8 }}>
            {activeSubscriptions.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onMarkPaid={handleMarkPlanPaid}
                onDelete={handleDeletePlan}
                onEdit={setEditingPlan}
              />
            ))}
          </div>
        </div>
      )}

      {cardBills.length > 0 && (
        <div className="section" style={{ marginTop: 'var(--section-gap)' }}>
          <div className="checklist-section-header-row">
            <SectionHeader title="信用卡承諾" />
            <button className="checklist-add-plan-btn" onClick={() => setShowPlanSheet(true)}>
              ＋ 訂閱/分期
            </button>
          </div>
          <p className="checklist-estimate-hint">
            每張卡填一個「這個月預估要繳多少」，整月穩定不變。展開可看這張卡已被訂閱／分期吃掉多少——預估金額至少要蓋過這些確定會扣的錢。
          </p>
          <div className="card checklist-estimate-card">
            {cardBills.map((c) => {
              const committed = cardCommitted(c.name)
              const plansOnCard = cardPlans(c.name)
              const expanded = expandedCardId === c.id
              const tooLow = Number(estimateValue(c) || 0) < committed
              return (
                <div className="checklist-estimate-group" key={c.id}>
                  <div className="checklist-estimate-row">
                    <button
                      className="checklist-estimate-name checklist-estimate-toggle"
                      onClick={() => setExpandedCardId(expanded ? null : c.id)}
                      aria-expanded={expanded}
                    >
                      {c.name}
                      {plansOnCard.length > 0 && (
                        <span className="checklist-estimate-count">{plansOnCard.length} 筆訂閱/分期</span>
                      )}
                      <span className={`checklist-estimate-chevron${expanded ? ' checklist-estimate-chevron-open' : ''}`}>▾</span>
                    </button>
                    <div className="checklist-budget-input-wrap checklist-estimate-input-wrap">
                      <span className="checklist-budget-prefix">NT$</span>
                      <input
                        className="checklist-budget-input"
                        type="number"
                        inputMode="numeric"
                        placeholder="填預估金額"
                        value={estimateValue(c)}
                        onChange={(e) => handleEstimateInput(c.id, e.target.value)}
                        onBlur={() => commitEstimate(c)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                      />
                    </div>
                  </div>
                  {committed > 0 && tooLow && (
                    <div className="checklist-estimate-warning">
                      這張卡的訂閱＋分期就有 NT${committed.toLocaleString()}，預估金額低於這個底線，
                      <button className="checklist-estimate-fill" onClick={() => { onUpdateEstimatedBill(c.id, committed); setEstimateInputs((prev) => { const next = { ...prev }; delete next[c.id]; return next }); showToast(`已帶入底線金額 NT$${committed.toLocaleString()}`) }}>
                        一鍵帶入
                      </button>
                    </div>
                  )}
                  {expanded && (
                    <div className="checklist-estimate-plans">
                      {plansOnCard.length === 0 ? (
                        <p className="checklist-estimate-hint" style={{ margin: '8px 0' }}>這張卡沒有訂閱或分期</p>
                      ) : (
                        plansOnCard.map((plan) => (
                          <PlanCard
                            key={plan.id}
                            plan={plan}
                            onMarkPaid={handleMarkPlanPaid}
                            onDelete={handleDeletePlan}
                            onEdit={setEditingPlan}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="section" style={{ marginTop: 'var(--section-gap)' }}>
        <SectionHeader title="必繳項目" />
        {items.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="還沒有必繳項目"
            description="把房租、水電、電信等每月固定支出加進來，確定要留這筆錢再打勾"
            actionLabel="新增必繳項目"
            onAction={() => setShowAddSheet(true)}
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
            actionLabel="新增儲蓄目標"
            onAction={() => setShowSavingsSheet(true)}
          />
        ) : (
          savings.map((goal) => (
            <SavingGoalCard
              key={goal.id}
              goal={goal}
              linkedItem={items.find((i) => i.id === goal.linkedChecklistId)}
              linkedCard={cardBills.find((c) => c.id === goal.linkedCardId)}
              onEdit={setEditingSaving}
              onDelete={handleDeleteSaving}
              onContribute={handleContribute}
              onSpend={openSpend}
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
          checklistItems={items}
          cardBills={cardBills}
        />
      </BottomSheet>

      <BottomSheet
        open={planSheetOpen}
        onClose={() => { setShowPlanSheet(false); setEditingPlan(null) }}
        title={editingPlan ? '修改計畫' : '新增訂閱/分期'}
      >
        <AddPlanForm
          onSubmit={handlePlanSubmit}
          onClose={() => { setShowPlanSheet(false); setEditingPlan(null) }}
          cards={cards}
          fxSettings={fxSettings}
          initialValues={editingPlan}
        />
      </BottomSheet>

      <BottomSheet
        open={!!spendingGoal}
        onClose={() => setSpendingGoal(null)}
        title={spendingGoal ? `${spendingGoal.name}・記一筆支出` : '記一筆支出'}
      >
        {spendingGoal && (
          <SavingsSpendForm
            goal={spendingGoal}
            initialAmount={spendSuggest}
            onSubmit={handleSpendSubmit}
            onClose={() => setSpendingGoal(null)}
          />
        )}
      </BottomSheet>
    </div>
  )
}
