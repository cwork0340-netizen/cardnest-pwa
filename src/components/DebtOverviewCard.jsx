import './DebtOverviewCard.css'

function fmt(amount) {
  return 'NT$' + Number(amount).toLocaleString()
}

// 未償負債總覽：只計分期（剩餘期數 × 每期金額），訂閱/必繳不算負債。
export default function DebtOverviewCard({ items, total }) {
  return (
    <div className="card debt-overview">
      <div className="debt-summary">
        <span className="debt-summary-label">分期未償總額</span>
        <span className="debt-summary-amount">{fmt(total)}</span>
      </div>

      <div className="debt-list">
        {items.map((item) => (
          <div key={item.id} className="debt-row">
            <div className="debt-row-left">
              <span className="debt-name">{item.name}</span>
              <span className="debt-meta">{item.card}．剩 {item.remainingPeriods} 期</span>
            </div>
            <div className="debt-row-right">
              <span className="debt-amount">{fmt(item.outstanding)}</span>
              <span className="debt-perperiod">{fmt(item.perPeriod)} / 期</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
