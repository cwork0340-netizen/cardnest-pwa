import './SavingGoalCard.css'

function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

export default function SavingGoalCard({ goal, onEdit, onDelete, onContribute, onReset }) {
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }
  const saved = Number(goal.saved)
  const target = Number(goal.target)
  const monthly = Number(goal.monthly)
  const hasTarget = target > 0
  const pct = hasTarget ? Math.min(100, Math.round((saved / target) * 100)) : 0
  const remain = Math.max(0, target - saved)
  const monthsLeft = hasTarget && monthly > 0 ? Math.ceil(remain / monthly) : 0
  const reached = hasTarget && saved >= target

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
          <span className="sg-name">{goal.name}</span>
          <span className="sg-monthly">每月撥入 {fmt(monthly)}</span>
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
        <button className="sg-action-btn sg-contribute" onClick={stop(() => onContribute(goal.id))}>
          撥入本月 +{fmt(monthly)}
        </button>
        <button className="sg-action-btn sg-reset" onClick={stop(() => onReset(goal.id))} disabled={saved <= 0}>
          動用（歸零）
        </button>
      </div>
    </div>
  )
}
