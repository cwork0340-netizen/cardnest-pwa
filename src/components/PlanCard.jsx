import './PlanCard.css'
import SegmentedProgress from './SegmentedProgress'

function daysLeftColor(daysLeft) {
  if (daysLeft <= 1) return 'var(--color-danger)'
  if (daysLeft <= 3) return 'var(--color-warning)'
  return 'var(--color-text-muted)'
}

function AmountDisplay({ plan }) {
  if (plan.currency === 'USD') {
    return <div className="plan-amount-block"><span className="plan-amount">US${Number(plan.amountOriginal).toFixed(2)}<span className="plan-period"> / {plan.period}</span></span><span className="plan-amount-twd">約 NT${Number(plan.amount).toLocaleString()}（含 {plan.feeRate}% 手續費）</span></div>
  }
  return <span className="plan-amount">NT${Number(plan.amount).toLocaleString()}<span className="plan-period"> / {plan.period}</span></span>
}

function formatYearMonth(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null
  const [year, month] = value.split('-')
  return `${year}/${Number(month)}`
}

function isThisMonth(value, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false
  const [year, month] = value.split('-').map(Number)
  return year === today.getFullYear() && month === today.getMonth() + 1
}

export default function PlanCard({ plan, onMarkPaid, onDelete, onEdit }) {
  const isSubscription = plan.type === 'subscription'
  const editProps = { onClick: () => onEdit(plan), role: 'button', tabIndex: 0, onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onEdit(plan) } } }
  const stop = (fn) => (event) => { event.stopPropagation(); fn() }

  if (isSubscription) {
    return <div className="card plan-card plan-card-clickable" {...editProps}><div className="plan-row"><div className="plan-left"><span className="badge badge-primary plan-badge">訂閱</span><span className="plan-name">{plan.name}</span><span className="plan-card-name">{plan.card}</span></div><div className="plan-right"><AmountDisplay plan={plan} /><span className="plan-next" style={{ color: daysLeftColor(plan.daysLeft) }}>下次扣款 {plan.nextDate}（{plan.daysLeft === 0 ? '今天' : plan.daysLeft === 1 ? '明天' : `${plan.daysLeft} 天後`}）</span><div className="plan-action-btns"><button className="plan-edit-btn" onClick={stop(() => onEdit(plan))} aria-label="編輯">✎</button><button className="plan-delete-btn" onClick={stop(() => onDelete(plan.id))} aria-label="刪除">✕</button></div></div></div></div>
  }

  const unpaidOccurrences = plan.unpaidOccurrences ?? []
  const allPaid = unpaidOccurrences.length === 0
  const remaining = plan.totalCount - plan.paidCount
  const firstDueMonth = formatYearMonth(plan.firstDueDate)
  const currentMonthIncluded = unpaidOccurrences.some((occurrence) => isThisMonth(occurrence.dueDate))
  const originalAmount = Number(plan.originalAmount)
  const conversionSummary = Number.isFinite(originalAmount) && originalAmount > 0 ? `原刷卡 NT$${originalAmount.toLocaleString()}・確認日 ${plan.conversionDate ?? '待補'}` : null
  const remainingTotal = Number.isFinite(Number(plan.totalAmount)) && Number(plan.totalAmount) > 0 ? Number(plan.totalAmount) - Number(plan.amount) * plan.paidCount : Number(plan.amount) * remaining

  return <div className="card plan-card plan-card-clickable" {...editProps}><div className="plan-row"><div className="plan-left"><span className="badge badge-installment plan-badge">分期</span><span className="plan-name">{plan.name}</span><span className="plan-card-name">{plan.card}</span></div><div className="plan-right plan-right-installment"><span className="plan-amount">NT${Number(plan.amount).toLocaleString()}<span className="plan-period"> / 期</span></span><span className="plan-next" style={{ color: daysLeftColor(plan.daysLeft) }}>{allPaid ? '已全部完成' : plan.daysLeft < 0 ? `已逾期 ${-plan.daysLeft} 天` : `下期 ${plan.nextDate}`}</span><div className="plan-installment-btns"><button className="plan-edit-btn" onClick={stop(() => onEdit(plan))} aria-label="編輯">✎</button><button className={`plan-check-btn${allPaid ? ' plan-check-btn-done' : ''}`} onClick={stop(() => onMarkPaid(plan.id))} aria-label={allPaid ? '取消最近一期完成狀態' : '標記下一期已繳'}>{allPaid ? '✓' : '○'}</button><button className="plan-delete-btn" onClick={stop(() => onDelete(plan.id))} aria-label="刪除">✕</button></div></div></div><div className="plan-progress-area"><SegmentedProgress paid={plan.paidCount} total={plan.totalCount} /><span className="plan-progress-text">已付 {plan.paidCount}/{plan.totalCount} 期，尚餘 {remaining} 期</span><div className="plan-installment-meta">{firstDueMonth && <span>首期：{firstDueMonth}</span>}{!allPaid && <span className={currentMonthIncluded ? 'plan-meta-included' : 'plan-meta-muted'}>{currentMonthIncluded ? '本期已預留' : '本期尚未列入'}</span>}</div><span className="plan-remaining-total">剩餘總額 NT${remainingTotal.toLocaleString()}</span>{conversionSummary && <span className="plan-conversion-summary">{conversionSummary}</span>}</div></div>
}
