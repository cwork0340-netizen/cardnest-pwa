import { useState } from 'react'
import './AddPlanForm.css'
import ConvertToInstallmentForm from './ConvertToInstallmentForm'
import { parseISODate } from '../utils/financeData'

function defaultBillingDay(tx) {
  const date = parseISODate(tx.date)
  return date ? date.getDate() : new Date().getDate()
}

export default function ConvertToPlanForm({ tx, onSubmit, onClose }) {
  const [type, setType] = useState('subscription')
  const [name, setName] = useState(tx.name ?? '')
  const [amount, setAmount] = useState(String(tx.amount))
  const [billingDay, setBillingDay] = useState(String(defaultBillingDay(tx)))
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const monthly = Number(amount)
    const day = Number(billingDay)
    if (!name.trim()) return setError('請填寫訂閱名稱')
    if (!monthly || monthly <= 0) return setError('請輸入有效金額')
    if (!Number.isInteger(day) || day < 1 || day > 31) return setError('請輸入每月 1～31 號')
    setError('')
    onSubmit({
      id: crypto.randomUUID(),
      type: 'subscription',
      name: name.trim(),
      cardId: tx.cardId,
      card: tx.card,
      currency: 'TWD',
      amount: monthly,
      period: '月',
      billingDay: day,
      active: true,
    })
  }

  return (
    <div>
      <div className="apf-type-toggle">
        <button
          type="button"
          className={`apf-type-btn${type === 'subscription' ? ' apf-type-btn-active' : ''}`}
          onClick={() => setType('subscription')}
        >
          訂閱
        </button>
        <button
          type="button"
          className={`apf-type-btn${type === 'installment' ? ' apf-type-btn-active' : ''}`}
          onClick={() => setType('installment')}
        >
          分期
        </button>
      </div>

      {type === 'installment' ? (
        <ConvertToInstallmentForm tx={tx} onSubmit={onSubmit} onClose={onClose} />
      ) : (
        <form className="apf" onSubmit={handleSubmit}>
          <p className="apf-convert-hint" style={{ marginTop: 12 }}>
            {`這筆刷卡記錄（NT$${Number(tx.amount).toLocaleString()}）會保留，並標記為這個訂閱本期的扣款，所以不會再被「訂閱小計」多算一次。之後每月只要有名稱、金額、卡片都相符的刷卡記錄，也會自動對應。`}
          </p>
          <div className="apf-fields">
            <div className="apf-field">
              <label className="apf-label" htmlFor="cpf-name">訂閱名稱</label>
              <input id="cpf-name" className="apf-input" type="text" value={name} onChange={(e) => setName(e.target.value)} />
              <span className="apf-fx-hint">匯入的名稱常常只有「自動匯入・銀行」，改成實際服務名稱（例如 ChatGPT）之後才對得上</span>
            </div>
            <div className="apf-field">
              <label className="apf-label" htmlFor="cpf-amount">每月金額</label>
              <input id="cpf-amount" className="apf-input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="apf-field">
              <label className="apf-label" htmlFor="cpf-day">每月幾號扣款</label>
              <input id="cpf-day" className="apf-input" type="number" inputMode="numeric" min="1" max="31" value={billingDay} onChange={(e) => setBillingDay(e.target.value)} />
              <span className="apf-fx-hint">預設帶入原刷卡日，可依銀行實際扣款日調整</span>
            </div>
          </div>
          {error && <span className="apf-error">{error}</span>}
          <div className="apf-actions">
            <button type="submit" className="button-primary">設為訂閱</button>
            <button type="button" className="apf-cancel" onClick={onClose}>取消</button>
          </div>
        </form>
      )}
    </div>
  )
}
