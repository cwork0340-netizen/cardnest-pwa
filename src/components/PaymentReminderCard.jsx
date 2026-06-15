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
  if (!reminders || reminders.length === 0) return null

  return (
    <div className="card pay-reminder">
      <div className="pay-reminder-head">
        <span className="pay-reminder-title">繳費提醒</span>
        <span className="pay-reminder-count">{reminders.length} 張待繳</span>
      </div>
      {reminders.map((r) => {
        const u = urgency(r.daysLeft)
        return (
          <div key={r.id} className={`pay-reminder-row pay-reminder-row--${u.cls}`}>
            <span className="pay-reminder-dot" style={{ background: r.color }} />
            <div className="pay-reminder-info">
              <span className="pay-reminder-name">{r.name}</span>
              <span className="pay-reminder-due">每月 {r.dueDate} 號・<span className={`pay-reminder-when pay-reminder-when--${u.cls}`}>{u.text}</span></span>
            </div>
            <span className="pay-reminder-amount">{fmt(r.amount)}</span>
            <button className="pay-reminder-paid" onClick={() => onMarkPaid(r.id)}>已繳</button>
          </div>
        )
      })}
    </div>
  )
}
