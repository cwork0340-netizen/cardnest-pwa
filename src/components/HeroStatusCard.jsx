import './HeroStatusCard.css'

function fmt(amount) {
  return 'NT$' + Number(amount).toLocaleString()
}

const STATUS_COLOR = {
  safe: 'var(--color-primary)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
}

export default function HeroStatusCard({ budget, estimatedTotal, pendingBillTotal = 0, currentCycleTotal = 0, spendingWarningTotal = 0, pendingCycleTotal = 0 }) {
  const displayTotal = Number(spendingWarningTotal || estimatedTotal || 0)
  const pct = budget > 0 ? Math.round((displayTotal / budget) * 100) : 0
  const warningStatus = pct < 70 ? 'safe' : pct < 90 ? 'warning' : 'danger'
  const amountColor = STATUS_COLOR[warningStatus] ?? STATUS_COLOR.safe

  return (
    <div className={`hero-card hero-card--${warningStatus}`}>
      <div className="hero-card-kicker">信用卡帳單總覽</div>
      <div className="hero-card-main-row">
        <div>
          <div className="hero-card-amount-label">目前累計刷卡</div>
          <div className="hero-card-amount" style={{ color: amountColor }}>
            {fmt(displayTotal)}
          </div>
        </div>
        <span className={`hero-card-status hero-card-status--${warningStatus}`}>
          {warningStatus === 'danger' ? '超出預算' : warningStatus === 'warning' ? '接近預算' : '狀態穩定'}
        </span>
      </div>
      <div className="hero-card-metrics">
        <div className="hero-card-metric">
          <span>待繳帳單</span>
          <strong>{fmt(pendingBillTotal)}</strong>
        </div>
        <div className="hero-card-metric">
          <span>銀行已入帳</span>
          <strong>{fmt(currentCycleTotal)}</strong>
        </div>
        <div className="hero-card-metric">
          <span>待確認</span>
          <strong>{fmt(pendingCycleTotal)}</strong>
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
