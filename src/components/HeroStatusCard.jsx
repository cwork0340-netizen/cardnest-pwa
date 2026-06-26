import './HeroStatusCard.css'

function fmt(amount) {
  return 'NT$' + Number(amount).toLocaleString()
}

const STATUS_COLOR = {
  safe: 'var(--color-primary)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
}

export default function HeroStatusCard({ budget, estimatedTotal, status }) {
  const pct = budget > 0 ? Math.round((estimatedTotal / budget) * 100) : 0
  const amountColor = STATUS_COLOR[status] ?? STATUS_COLOR.safe

  return (
    <div className={`hero-card hero-card--${status}`}>
      <div className="hero-card-amount-label">本月已刷金額</div>
      <div className="hero-card-amount" style={{ color: amountColor }}>
        {fmt(estimatedTotal)}
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
