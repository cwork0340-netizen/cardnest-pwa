import { useState } from 'react'
import './SavingGoalCard.css'

function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

export default function SavingGoalCard({ goal, linkedItem, linkedCard, onEdit, onDelete, onContribute, onSpend, onReset }) {
  const [showLog, setShowLog] = useState(false)
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }
  const saved = Number(goal.saved)
  const target = Number(goal.target)
  const isLinked = !!linkedItem
  const isCardLinked = !!linkedCard
  const cardBill = isCardLinked ? Number(linkedCard.bill) : 0
  const monthly = isLinked ? Number(linkedItem.amount) : Number(goal.monthly)
  const hasTarget = target > 0
  const pct = hasTarget ? Math.min(100, Math.round((saved / target) * 100)) : 0
  const remain = Math.max(0, target - saved)
  const monthsLeft = hasTarget && monthly > 0 ? Math.ceil(remain / monthly) : 0
  const reached = hasTarget && saved >= target
  const entries = [...(goal.entries ?? [])].reverse()

  return (
    <div
      className="card sg-card sg-card-clickable"
      onClick={() => onEdit(goal)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(goal) } }}
    >
      <div className="sg-top">
        <div className="sg-info">
          <span className="sg-name">
            {goal.name}
            {isLinked && <span className="sg-badge">連動 {linkedItem.name}</span>}
            {isCardLinked && <span className="sg-badge">預留 {linkedCard.name}卡費</span>}
            {!isLinked && !isCardLinked && goal.countInEssential && <span className="sg-badge">額外預留</span>}
          </span>
          <span className="sg-monthly">
            每月撥入 {fmt(monthly)}{isLinked ? '（勾選該項目時存入）' : ''}
          </span>
          {isCardLinked && (
            <span className="sg-monthly">本期卡費 {fmt(cardBill)}</span>
          )}
        </div>
        <div className="sg-btns">
          <button className="sg-edit" onClick={stop(() => onEdit(goal))} aria-label="編輯">✎</button>
          <button className="sg-delete" onClick={stop(() => onDelete(goal.id))} aria-label="刪除">✕</button>
        </div>
      </div>

      <div className="sg-amount-row">
        <span className="sg-saved">{fmt(saved)}</span>
        {hasTarget && <span className="sg-target">／ {fmt(target)}</span>}
        {reached && <span className="sg-reached">已達標 🎉</span>}
      </div>

      {hasTarget && (
        <>
          <div className="sg-progress-track">
            <div className="sg-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="sg-hint">
            {reached ? '已存滿，可動用了' : `還差 ${fmt(remain)}・約 ${monthsLeft} 個月`}
          </div>
        </>
      )}

      <div className="sg-actions">
        {!isLinked && (
          <button className="sg-action-btn sg-contribute" onClick={stop(() => onContribute(goal.id))}>
            撥入本月 +{fmt(monthly)}
          </button>
        )}
        {isCardLinked && cardBill > 0 && (
          <button className="sg-action-btn sg-spend" onClick={stop(() => onSpend(goal, cardBill))} disabled={saved <= 0}>
            支付卡費 {fmt(cardBill)}
          </button>
        )}
        <button className="sg-action-btn sg-spend" onClick={stop(() => onSpend(goal, 0))} disabled={saved <= 0}>
          記一筆支出
        </button>
        <button className="sg-action-btn sg-reset" onClick={stop(() => onReset(goal.id))} disabled={saved <= 0}>
          領出全部
        </button>
      </div>

      {entries.length > 0 && (
        <>
          <button className="sg-log-toggle" onClick={stop(() => setShowLog((v) => !v))}>
            明細（{entries.length}）{showLog ? '▴' : '▾'}
          </button>
          {showLog && (
            <div className="sg-log">
              {entries.map((e) => (
                <div key={e.id} className="sg-log-row">
                  <span className="sg-log-date">{e.date}</span>
                  <span className="sg-log-note">{e.note}</span>
                  <span className={e.type === 'in' ? 'sg-log-in' : 'sg-log-out'}>
                    {e.type === 'in' ? '+' : '−'}{fmt(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
