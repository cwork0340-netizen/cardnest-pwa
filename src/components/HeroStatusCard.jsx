import './HeroStatusCard.css'

function fmt(amount) {
  return 'NT$' + Number(amount).toLocaleString()
}

const STATUS_COLOR = {
  safe: 'var(--color-primary)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
}

export default function HeroStatusCard({ budget, estimatedTotal, pendingBillTotal = 0, currentCycleTotal = 0, status }) {
  const pct = budget > 0 ? Math.round((estimatedTotal / budget) * 100) : 0
  const amountColor = STATUS_COLOR[status] ?? STATUS_COLOR.safe

  return (
    <div className={`hero-card hero-card--${status}`}>
      <div className="hero-card-kicker">信用卡帳單總覽</div>
      <div className="hero-card-main-row">
        <div>
          <div className="hero-card-amount-label">待繳帳單</div>
          <div className="hero-card-amount" style={{ color: amountColor }}>
            {fmt(pendingBillTotal)}
          </div>
        </div>
        <span className={`hero-card-status hero-card-status--${status}`}>
          {status === 'danger' ? '超出預算' : status === 'warning' ? '接近預算' : '狀態穩定'}
        </span>
      </div>
      <div className="hero-card-metrics">
        <div className="hero-card-metric">
          <span>本期已入帳</span>
          <strong>{fmt(currentCycleTotal)}</strong>
        </div>
        <div className="hero-card-metric">
          <span>本月預估</span>
          <strong>{fmt(estimatedTotal)}</strong>
        </div>
      </div>
      <div className="hero-card-budget-row">
        <div className="hero-card-progress-track">
          <div
            className="hero-card-progress-fill"
            style={{ width: `${Math.min(pct, 100)}%`, background: amountColor }}
          />
        </div>
        <span className="hero-card-pct">{pct}%</span>
      </div>
    </div>
  )
}
