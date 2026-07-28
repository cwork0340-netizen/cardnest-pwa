import { useState } from 'react'
import './CreditCardSummaryCard.css'

function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

function dueLabel(cycle) {
  const md = `${Number(cycle.dueDate.slice(5, 7))}/${Number(cycle.dueDate.slice(8, 10))}`
  if (cycle.daysLeft < 0) return `到期 ${md}・逾期 ${-cycle.daysLeft} 天`
  if (cycle.daysLeft === 0) return `到期 ${md}・今天到期`
  return `到期 ${md}・還有 ${cycle.daysLeft} 天`
}

export default function CreditCardSummaryCard({ card, onMarkPaid, onMarkAllPaid, onUpdateCycle }) {
  const [expanded, setExpanded] = useState(false)
  const [editingCycleId, setEditingCycleId] = useState(null)
  const [editDate, setEditDate] = useState('')

  const unpaid = card.unpaidCycles ?? []

  function startEdit(e, cycle) {
    e.stopPropagation()
    setEditingCycleId(cycle.id)
    setEditDate(cycle.dueDate)
  }

  function saveEdit(e, cycle) {
    e.stopPropagation()
    onUpdateCycle(card.id, cycle.id, { dueDate: editDate })
    setEditingCycleId(null)
  }

  return (
    <div className="card credit-card-summary" style={{ borderLeftColor: card.color }}>
      <button
        type="button"
        className="credit-card-summary-row"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="credit-card-summary-name-block">
          <div className="credit-card-summary-name">
            <span className="credit-card-summary-dot" style={{ background: card.color }} />
            <span className="credit-card-summary-label">{card.name}</span>
            <span className={`credit-card-summary-chevron${expanded ? ' credit-card-summary-chevron-open' : ''}`}>▾</span>
          </div>
          {card.nextCloseLabel && (
            <span className="credit-card-summary-schedule">
              結帳 {card.nextCloseLabel}・繳款 {card.nextDueLabel}
            </span>
          )}
        </div>
        <div className="credit-card-summary-amounts">
          <div className="credit-card-summary-amount-col">
            <span className="credit-card-summary-amount-label">
              待繳帳單{unpaid.length > 1 ? `（${unpaid.length} 期）` : ''}
            </span>
            <span className="credit-card-summary-amount-value">{fmt(card.unpaidTotal ?? 0)}</span>
          </div>
          <div className="credit-card-summary-amount-col">
            <span className="credit-card-summary-amount-label">本期已入帳</span>
            <span className="credit-card-summary-amount-value">{fmt(card.currentCycleAmount ?? 0)}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="credit-card-summary-breakdown">
          {unpaid.length === 0 ? (
            <p className="credit-card-summary-breakdown-note">目前沒有未繳的帳單</p>
          ) : (
            <>
              {unpaid.map((cycle) => (
                <div className="credit-card-cycle-row" key={cycle.id}>
                  <div className="credit-card-cycle-info">
                    <span className="credit-card-cycle-amount">{fmt(cycle.amount)}</span>
                    {editingCycleId === cycle.id ? (
                      <span className="credit-card-cycle-edit" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="date"
                          className="credit-card-cycle-date-input"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                        <button className="credit-card-cycle-save" onClick={(e) => saveEdit(e, cycle)}>存</button>
                      </span>
                    ) : (
                      <button className="credit-card-cycle-due" onClick={(e) => startEdit(e, cycle)}>
                        {dueLabel(cycle)}
                      </button>
                    )}
                  </div>
                  <button
                    className="credit-card-cycle-pay"
                    onClick={(e) => { e.stopPropagation(); onMarkPaid(cycle.id) }}
                  >
                    已繳
                  </button>
                </div>
              ))}
              {unpaid.length > 1 && (
                <button
                  className="credit-card-cycle-pay-all"
                  onClick={(e) => { e.stopPropagation(); onMarkAllPaid(card.id) }}
                >
                  全部標記已繳
                </button>
              )}
            </>
          )}

          <p className="credit-card-summary-breakdown-note">App 估算帳單組成：</p>
          <div className="credit-card-summary-breakdown-row">
            <span>已入帳刷卡</span>
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
            <span>{fmt((card.used ?? 0) + (card.subsOnCard ?? 0) + (card.instOnCard ?? 0))}</span>
          </div>
        </div>
      )}
    </div>
  )
}
