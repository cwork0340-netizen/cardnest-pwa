import { useState } from 'react'
import './PaymentReminderCard.css'

function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

function urgency(daysLeft) {
  if (daysLeft < 0) return { cls: 'danger', text: `逾期 ${-daysLeft} 天` }
  if (daysLeft === 0) return { cls: 'danger', text: '今天到期' }
  if (daysLeft <= 3) return { cls: 'danger', text: `還有 ${daysLeft} 天` }
  if (daysLeft <= 7) return { cls: 'warning', text: `還有 ${daysLeft} 天` }
  return { cls: 'safe', text: `還有 ${daysLeft} 天` }
}

export default function PaymentReminderCard({ reminders, onMarkPaid }) {
  const [confirmingId, setConfirmingId] = useState(null)
  if (!reminders || reminders.length === 0) return null

  function handlePaidClick(r) {
    // 有連動儲蓄帳戶且有餘額 → 詢問要不要從帳戶扣款；否則直接標記
    if (r.reserve && r.reserve.saved > 0) {
      setConfirmingId(r.id)
    } else {
      onMarkPaid(r.id)
    }
  }

  return (
    <div className="card pay-reminder">
      <div className="pay-reminder-head">
        <span className="pay-reminder-title">繳費提醒</span>
        <span className="pay-reminder-count">{reminders.length} 張待繳</span>
      </div>
      {reminders.map((r) => {
        const u = urgency(r.daysLeft)
        const confirming = confirmingId === r.id
        const payFromAccount = r.reserve ? Math.min(r.amount, r.reserve.saved) : 0
        return (
          <div key={r.id} className={`pay-reminder-row pay-reminder-row--${u.cls}`}>
            <span className="pay-reminder-dot" style={{ background: r.color }} />
            <div className="pay-reminder-info">
              <span className="pay-reminder-name">{r.name}</span>
              <span className="pay-reminder-due">{r.dueDateLabel} 到期・<span className={`pay-reminder-when pay-reminder-when--${u.cls}`}>{u.text}</span></span>
              {confirming && (
                <div className="pay-reminder-confirm">
                  <span className="pay-reminder-confirm-q">用「{r.reserve.name}」扣款？</span>
                  <button
                    className="pay-reminder-confirm-btn pay-reminder-confirm-yes"
                    onClick={() => { onMarkPaid(r.id, { fromSavingId: r.reserve.id, amount: payFromAccount }); setConfirmingId(null) }}
                  >
                    從帳戶扣 {fmt(payFromAccount)}
                  </button>
                  <button
                    className="pay-reminder-confirm-btn"
                    onClick={() => { onMarkPaid(r.id); setConfirmingId(null) }}
                  >
                    只標記已繳
                  </button>
                </div>
              )}
            </div>
            {!confirming && (
              <>
                <span className="pay-reminder-amount">{fmt(r.amount)}</span>
                <button className="pay-reminder-paid" onClick={() => handlePaidClick(r)}>已繳</button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
