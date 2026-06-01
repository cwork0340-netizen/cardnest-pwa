import './BudgetCard.css'
import ProgressBar from './ProgressBar'

function autoStatus(percent) {
  if (percent > 95) return 'danger'
  if (percent >= 80) return 'warning'
  return 'safe'
}

export default function BudgetCard({ total, budget, used, remaining }) {
  const percent = Math.round((used / budget) * 100)
  const status = autoStatus(percent)

  return (
    <div className="card budget-card">
      <div className="budget-card-title">
        還有 {'NT$' + Number(remaining).toLocaleString()} 可以使用
      </div>
      <div className="budget-card-sub">目前還在安全範圍內</div>
      <div className="budget-card-bar">
        <ProgressBar value={used} max={budget} status={status} />
      </div>
      <div className="budget-card-footer">
        <span className="budget-card-percent">已使用 {percent}%</span>
        <span className="budget-card-detail">
          {'NT$' + Number(used).toLocaleString()} / {'NT$' + Number(budget).toLocaleString()}
        </span>
      </div>
    </div>
  )
}
