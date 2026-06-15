import './CreditCardSummaryCard.css'
import ProgressBar from './ProgressBar'

export default function CreditCardSummaryCard({ card }) {
  const remaining = card.budget - card.used

  return (
    <div className="card credit-card-summary">
      <div className="credit-card-summary-top">
        <div className="credit-card-summary-name">
          <span
            className="credit-card-summary-dot"
            style={{ background: card.color }}
          />
          <span className="credit-card-summary-label">{card.name}</span>
        </div>
        <span className="credit-card-summary-status">{card.statusText}</span>
      </div>
      <div className="credit-card-summary-bar">
        <ProgressBar value={card.used} max={card.budget} status={card.status} />
      </div>
      <div className="credit-card-summary-detail">
        {'NT$' + Number(card.used).toLocaleString()} / {'NT$' + Number(card.budget).toLocaleString()}
      </div>
      {card.upcomingBill != null && (
        <div className="credit-card-summary-bill">
          <span className="credit-card-summary-bill-label">{card.billIsActual ? '本期應繳（銀行帳單）' : '下期應繳（含訂閱・分期）'}</span>
          <span className="credit-card-summary-bill-amount">
            {'NT$' + Number(card.upcomingBill).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}
