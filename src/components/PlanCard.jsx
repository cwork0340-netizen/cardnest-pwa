import './PlanCard.css'
import SegmentedProgress from './SegmentedProgress'

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

export default function PlanCard({ plan, onMarkPaid, onDelete, onEdit }) {
  const isSubscription = plan.type === 'subscription'

  const editProps = {
    onClick: () => onEdit(plan),
    role: 'button',
    tabIndex: 0,
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(plan) } },
  }
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }

  if (isSubscription) {
    return (
      <div className="card plan-card plan-card-clickable" {...editProps}>
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
            <div className="plan-action-btns">
              <button className="plan-edit-btn" onClick={stop(() => onEdit(plan))} aria-label="編輯">✎</button>
              <button className="plan-delete-btn" onClick={stop(() => onDelete(plan.id))} aria-label="刪除">✕</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // installment：下次到期資訊改用「最早未繳的一期」，逾期天數用真實日期算，
  // 不再受換月影響；忘記標記時未繳期數會累加，這裡用小提示告知
  const unpaidOccurrences = plan.unpaidOccurrences ?? []
  const allPaid = unpaidOccurrences.length === 0
  const remaining = plan.totalCount - plan.paidCount
  const overdueCount = unpaidOccurrences.length

  return (
    <div className="card plan-card plan-card-clickable" {...editProps}>
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
            {allPaid
              ? '已繳清'
              : plan.daysLeft < 0
                ? `到期 ${plan.nextDate}・逾期 ${-plan.daysLeft} 天`
                : `下次 ${plan.nextDate}`}
          </span>
          <div className="plan-installment-btns">
            <button className="plan-edit-btn" onClick={stop(() => onEdit(plan))} aria-label="編輯">✎</button>
            <button
              className={`plan-check-btn${allPaid ? ' plan-check-btn-done' : ''}`}
              onClick={stop(() => onMarkPaid(plan.id))}
              aria-label={allPaid ? '取消付款標記' : '標記已付款'}
            >
              {allPaid ? '✓' : '○'}
            </button>
            <button className="plan-delete-btn" onClick={stop(() => onDelete(plan.id))} aria-label="刪除">✕</button>
          </div>
        </div>
      </div>
      <div className="plan-progress-area">
        <SegmentedProgress paid={plan.paidCount} total={plan.totalCount} />
        <span className="plan-progress-text">已付 {plan.paidCount}/{plan.totalCount} 期，還剩 {remaining} 期</span>
        <span className="plan-remaining-total">
          剩餘總額 {'NT$' + (plan.amount * remaining).toLocaleString()}
        </span>
        {overdueCount > 1 && (
          <span className="plan-overdue-hint">還有 {overdueCount} 期積欠，一次只能標記最早的一期</span>
        )}
      </div>
    </div>
  )
}
