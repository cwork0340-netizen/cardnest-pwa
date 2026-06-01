import './PlanCard.css'

function daysLeftColor(daysLeft) {
  if (daysLeft <= 1) return 'var(--color-danger)'
  if (daysLeft <= 3) return 'var(--color-warning)'
  return 'var(--color-text-muted)'
}

function AmountDisplay({ plan }) {
  if (plan.currency === 'USD') {
    return (
      <div className="plan-amount-block">
        <span className="plan-amount">
          US${Number(plan.amountOriginal).toFixed(2)}
          <span className="plan-period"> / {plan.period}</span>
        </span>
        <span className="plan-amount-twd">
          約 NT${Number(plan.amount).toLocaleString()} 含 {plan.feeRate}% 手續費
        </span>
      </div>
    )
  }
  return (
    <span className="plan-amount">
      {'NT$' + Number(plan.amount).toLocaleString()}
      <span className="plan-period"> / {plan.period}</span>
    </span>
  )
}

export default function PlanCard({ plan, onMarkPaid, onDelete }) {
  const isSubscription = plan.type === 'subscription'

  if (isSubscription) {
    return (
      <div className="card plan-card">
        <div className="plan-row">
          <div className="plan-left">
            <span className="badge badge-primary plan-badge">訂閱</span>
            <span className="plan-name">{plan.name}</span>
            <span className="plan-card-name">{plan.card}</span>
          </div>
          <div className="plan-right">
            <AmountDisplay plan={plan} />
            <span
              className="plan-next"
              style={{ color: daysLeftColor(plan.daysLeft) }}
            >
              下次扣款 {plan.nextDate}，
              {plan.daysLeft === 0 ? '今天' : plan.daysLeft === 1 ? '明天' : `${plan.daysLeft} 天後`}
            </span>
            <button className="plan-delete-btn" onClick={() => onDelete(plan.id)} aria-label="刪除">✕</button>
          </div>
        </div>
      </div>
    )
  }

  // installment
  const progress = plan.paidCount / plan.totalCount
  const remaining = plan.totalCount - plan.paidCount

  return (
    <div className="card plan-card">
      <div className="plan-row">
        <div className="plan-left">
          <span className="badge badge-installment plan-badge">分期</span>
          <span className="plan-name">{plan.name}</span>
          <span className="plan-card-name">{plan.card}</span>
        </div>
        <div className="plan-right plan-right-installment">
          <span className="plan-amount">
            {'NT$' + Number(plan.amount).toLocaleString()}
            <span className="plan-period"> / 期</span>
          </span>
          <span className="plan-next" style={{ color: daysLeftColor(plan.daysLeft) }}>
            下次 {plan.nextDate}
          </span>
          <div className="plan-installment-btns">
            <button
              className={`plan-check-btn${plan.paid ? ' plan-check-btn-done' : ''}`}
              onClick={() => onMarkPaid(plan.id)}
              aria-label={plan.paid ? '取消付款標記' : '標記已付款'}
            >
              {plan.paid ? '✓' : '○'}
            </button>
            <button className="plan-delete-btn" onClick={() => onDelete(plan.id)} aria-label="刪除">✕</button>
          </div>
        </div>
      </div>
      <div className="plan-progress-area">
        <div className="progress-track">
          <div className="progress-fill progress-fill-safe" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="plan-progress-text">已付 {plan.paidCount}/{plan.totalCount} 期，還剩 {remaining} 期</span>
        <span className="plan-remaining-total">
          剩餘總額 {'NT$' + (plan.amount * remaining).toLocaleString()}
        </span>
      </div>
    </div>
  )
}
