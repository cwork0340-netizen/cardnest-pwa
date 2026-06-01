import { useState } from 'react'
import './Plans.css'
import SectionHeader from '../components/SectionHeader'
import PlanCard from '../components/PlanCard'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import AddPlanForm from '../components/AddPlanForm'

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'subscription', label: '訂閱' },
  { key: 'installment', label: '分期' },
]

export default function Plans({ showToast, plans, cards, fxSettings, onAddPlan, onDeletePlan, onMarkPaid }) {
  const [activeTab, setActiveTab] = useState('all')
  const [showAddSheet, setShowAddSheet] = useState(false)

  const filteredPlans = activeTab === 'all'
    ? plans
    : plans.filter((p) => p.type === activeTab)

  function handleMarkPaid(id) {
    const plan = plans.find(p => p.id === id)
    onMarkPaid(id)
    showToast(plan?.paid ? '已取消付款標記' : '這期已標記付款')
  }

  function handleDelete(id) {
    onDeletePlan(id)
    showToast('已從清單移除')
  }

  function handleAddPlan(newPlan) {
    onAddPlan(newPlan)
    showToast('新的計畫已加入')
    setShowAddSheet(false)
  }

  return (
    <div className="plans-page">
      <div className="plans-header">
        <h1 className="plans-title">計畫管理</h1>
      </div>

      <div className="segmented-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`segmented-tab${activeTab === tab.key ? ' segmented-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="section" style={{ marginTop: 'var(--section-gap)' }}>
        <SectionHeader title={
          activeTab === 'all' ? '所有計畫'
          : activeTab === 'subscription' ? '訂閱服務'
          : '分期付款'
        } />

        {filteredPlans.length === 0 ? (
          <EmptyState
            icon="📋"
            title="還沒有計畫"
            description="新增訂閱或分期，讓每筆帳務都在掌握之中"
          />
        ) : (
          filteredPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onMarkPaid={handleMarkPaid}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <button
        className="fab"
        onClick={() => setShowAddSheet(true)}
        aria-label="新增計畫"
      >
        <span>＋</span>新增計畫
      </button>

      <BottomSheet
        open={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        title="新增計畫"
      >
        <AddPlanForm
          onSubmit={handleAddPlan}
          onClose={() => setShowAddSheet(false)}
          cards={cards}
          fxSettings={fxSettings}
        />
      </BottomSheet>
    </div>
  )
}
