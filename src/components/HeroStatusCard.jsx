import './HeroStatusCard.css'

function fmt(amount) {
  return 'NT$' + Number(amount).toLocaleString()
}

const STATUS_CONFIG = {
  safe:    { label: '目前很穩',              sub: '收支健康，繼續保持',               amountColor: 'var(--color-primary)' },
  warning: { label: '最近要留意',            sub: '支出接近收入，留意一下',            amountColor: 'var(--color-warning)' },
  danger:  { label: '已超支',                sub: '這個月花得比賺的多',               amountColor: 'var(--color-danger)'  },
}

export default function HeroStatusCard({ total, remaining, budget, income = 0, balance = 0, overspent = false, fixedMonthlyAmount, estimatedTotal, status, statusText }) {
  const hasIncome = income > 0
  const base = hasIncome ? income : budget
  const pct = base > 0 ? Math.round((estimatedTotal / base) * 100) : 0
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.safe

  return (
    <div className={`hero-card hero-card--${status}`}>
      <div className="hero-card-left">
        <div className="hero-card-title">{statusText || cfg.label}</div>
        <div className="hero-card-sub">{cfg.sub}</div>
        <div className="hero-card-amount-label">本月支出（含訂閱・分期・必繳）</div>
        <div className="hero-card-amount" style={{ color: cfg.amountColor }}>
          {fmt(estimatedTotal)}
        </div>
        <div className="hero-card-breakdown">
          <span className="hero-card-breakdown-item">已記錄刷卡 {fmt(total)}</span>
          {fixedMonthlyAmount > 0 && (
            <span className="hero-card-breakdown-item">訂閱・分期・必繳 {fmt(fixedMonthlyAmount)}</span>
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
        {hasIncome ? (
          <div className="hero-card-balance">
            <span className="hero-card-balance-income">月收入 {fmt(income)}</span>
            {overspent ? (
              <span className="hero-card-balance-over">超支 {fmt(-balance)}</span>
            ) : (
              <span className="hero-card-balance-left">結餘 {fmt(balance)}</span>
            )}
          </div>
        ) : (
          <div className="hero-card-remaining">設定月收入，即可追蹤結餘與超支</div>
        )}
      </div>
      <div className="hero-card-illustration">
        <img src="/hero-illustration.png" alt="" aria-hidden="true" />
      </div>
    </div>
  )
}
