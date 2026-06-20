import { useState } from 'react'
import './CreditCardSummaryCard.css'
import ProgressBar from './ProgressBar'

function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

// 期別代號（年-月，月為 0 起算）轉成「2026/7」顯示
function cycleLabel(cycleKey) {
  if (!cycleKey) return ''
  const [y, m] = cycleKey.split('-').map(Number)
  return `${y}/${m + 1}`
}

export default function CreditCardSummaryCard({ card, onMarkPaid }) {
  const [confirming, setConfirming] = useState(false)
  const [showLimit, setShowLimit] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const hasBill = card.upcomingBill != null && Number(card.upcomingBill) > 0
  const reserve = card.reserve
  const payFromAccount = reserve ? Math.min(Number(card.upcomingBill), Number(reserve.saved)) : 0
  const history = card.paymentHistory || []
  const billAmount = Number(card.upcomingBill) || 0

  // 結帳日 / 繳款截止日 文字
  const dateParts = []
  if (card.billingDay) dateParts.push(`${card.billingDay} 號結帳`)
  if (card.dueDate) dateParts.push(`${card.dueDate} 號前繳款`)
  const dateText = dateParts.join('・')

  function handlePay() {
    if (reserve && reserve.saved > 0) setConfirming(true)
    else onMarkPaid?.(card.id, { billAmount })
  }

  return (
    <div className="card credit-card-summary">
      <div className="credit-card-summary-top">
        <div className="credit-card-summary-name">
          <span className="credit-card-summary-dot" style={{ background: card.color }} />
          <span className="credit-card-summary-label">{card.name}</span>
        </div>
        {card.billPaid && <span className="credit-card-summary-paid-badge">✓ 本期已繳</span>}
      </div>

      {card.upcomingBill != null && (
        <div className="credit-card-summary-bill">
          <span className="credit-card-summary-bill-label">
            {card.billIsActual ? '本期應繳（銀行帳單）' : '下期應繳（含訂閱・分期）'}
          </span>
          <span className="credit-card-summary-bill-amount">{fmt(card.upcomingBill)}</span>
        </div>
      )}

      {dateText && <div className="credit-card-summary-dates">每月 {dateText}</div>}

      {hasBill && !card.billPaid && (
        confirming ? (
          <div className="credit-card-summary-pay-confirm">
            <span className="credit-card-summary-pay-q">用「{reserve.name}」扣款？</span>
            <div className="credit-card-summary-pay-btns">
              <button
                className="credit-card-summary-pay-btn credit-card-summary-pay-yes"
                onClick={() => { onMarkPaid?.(card.id, { fromSavingId: reserve.id, amount: payFromAccount, billAmount }); setConfirming(false) }}
              >
                從帳戶扣 {fmt(payFromAccount)}
              </button>
              <button
                className="credit-card-summary-pay-btn"
                onClick={() => { onMarkPaid?.(card.id, { billAmount }); setConfirming(false) }}
              >
                只標記已繳
              </button>
            </div>
          </div>
        ) : (
          <button className="credit-card-summary-mark" onClick={handlePay}>標記已繳</button>
        )
      )}

      <button className="credit-card-summary-limit-toggle" onClick={() => setShowLimit(v => !v)}>
        {showLimit ? '隱藏信用額度 ▴' : '顯示信用額度 ▾'}
      </button>
      {showLimit && (
        <div className="credit-card-summary-limit">
          <div className="credit-card-summary-bar">
            <ProgressBar value={card.used} max={card.budget} status={card.status} />
          </div>
          <div className="credit-card-summary-detail">
            <span>已刷 {fmt(card.used)} / 額度 {fmt(card.budget)}</span>
            <span className="credit-card-summary-status">{card.statusText}</span>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <>
          <button className="credit-card-summary-limit-toggle" onClick={() => setShowHistory(v => !v)}>
            {showHistory ? '隱藏繳費紀錄 ▴' : `繳費紀錄（${history.length}）▾`}
          </button>
          {showHistory && (
            <ul className="credit-card-summary-history">
              {history.map(h => (
                <li key={h.id} className="credit-card-summary-history-row">
                  <span className="credit-card-summary-history-cycle">{cycleLabel(h.cycleKey)} 期</span>
                  <span className="credit-card-summary-history-amount">{fmt(h.amount)}</span>
                  <span className="credit-card-summary-history-date">{h.date}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
