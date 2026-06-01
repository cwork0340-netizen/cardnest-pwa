import './HeroStatusCard.css'

function fmt(amount) {
  return 'NT$' + Number(amount).toLocaleString()
}

const STATUS_CONFIG = {
  safe:    { label: '目前很穩',              sub: '目前都在安全範圍內',               amountColor: 'var(--color-primary)' },
  warning: { label: '接近預算，最近要留意',  sub: '接近預算，最近要留意',              amountColor: 'var(--color-warning)' },
  danger:  { label: '已超出預算',            sub: '建議先暫停非必要刷卡',             amountColor: 'var(--color-danger)'  },
}

export default function HeroStatusCard({ month, total, remaining, budget, fixedMonthlyAmount, estimatedTotal, status, statusText }) {
  const pct = budget > 0 ? Math.round((total / budget) * 100) : 0
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.safe

  return (
    <div className={`hero-card hero-card--${status}`}>
      <div className="hero-card-left">
        <div className="hero-card-title">{statusText || cfg.label}</div>
        <div className="hero-card-sub">{cfg.sub}</div>
        <div className="hero-card-amount" style={{ color: cfg.amountColor }}>
          {fmt(total)}
        </div>
        <div className="hero-card-breakdown">
          <span className="hero-card-breakdown-item">已記錄刷卡 {fmt(total)}</span>
          {fixedMonthlyAmount > 0 && (
            <span className="hero-card-breakdown-item">本月固定扣款 {fmt(fixedMonthlyAmount)}</span>
          )}
          {fixedMonthlyAmount > 0 && (
            <span className="hero-card-breakdown-estimate">本月預估帳單 {fmt(estimatedTotal)}</span>
          )}
        </div>
        <div className="hero-card-budget-row">
          <div className="hero-card-progress-track">
            <div
              className="hero-card-progress-fill"
              style={{ width: `${Math.min(pct, 100)}%`, background: cfg.amountColor }}
            />
          </div>
          <span className="hero-card-pct">{pct}%</span>
        </div>
        <div className="hero-card-remaining">還有 {fmt(remaining)} 可以使用</div>
      </div>
      <div className="hero-card-illustration">🐻</div>
    </div>
  )
}
