import { useState } from 'react'
import './CreditCardSummaryCard.css'

function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

export default function CreditCardSummaryCard({ card }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card credit-card-summary">
      <button
        type="button"
        className="credit-card-summary-row"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="credit-card-summary-name">
          <span className="credit-card-summary-dot" style={{ background: card.color }} />
          <span className="credit-card-summary-label">{card.name}</span>
          <span className={`credit-card-summary-chevron${expanded ? ' credit-card-summary-chevron-open' : ''}`}>▾</span>
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
      </button>

      {expanded && (
        <div className="credit-card-summary-breakdown">
          {card.billIsActual && (
            <p className="credit-card-summary-breakdown-note">
              上期應繳已用你手動填寫的銀行帳單金額，以下是 App 估算的明細（僅供參考）
            </p>
          )}
          <div className="credit-card-summary-breakdown-row">
            <span>刷卡小計</span>
            <span>{fmt(card.used ?? 0)}</span>
          </div>
          <div className="credit-card-summary-breakdown-row">
            <span>訂閱小計</span>
            <span>{fmt(card.subsOnCard ?? 0)}</span>
          </div>
          <div className="credit-card-summary-breakdown-row">
            <span>分期小計</span>
            <span>{fmt(card.instOnCard ?? 0)}</span>
          </div>
          <div className="credit-card-summary-breakdown-row credit-card-summary-breakdown-total">
            <span>App 估算合計</span>
            <span>{fmt(card.computedBill ?? 0)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
