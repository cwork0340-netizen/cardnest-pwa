import './CreditCardSummaryCard.css'

function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

export default function CreditCardSummaryCard({ card }) {
  return (
    <div className="card credit-card-summary">
      <div className="credit-card-summary-name">
        <span className="credit-card-summary-dot" style={{ background: card.color }} />
        <span className="credit-card-summary-label">{card.name}</span>
      </div>
      <div className="credit-card-summary-amounts">
        <div className="credit-card-summary-amount-col">
          <span className="credit-card-summary-amount-label">上期應繳</span>
          <span className="credit-card-summary-amount-value">{fmt(card.upcomingBill ?? 0)}</span>
        </div>
        <div className="credit-card-summary-amount-col">
          <span className="credit-card-summary-amount-label">本期累積</span>
          <span className="credit-card-summary-amount-value">{fmt(card.currentCycleAmount ?? 0)}</span>
        </div>
      </div>
    </div>
  )
}
