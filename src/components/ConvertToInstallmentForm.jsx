import { useState } from 'react'
import './AddPlanForm.css'
import { dayFromMD } from '../utils/recurrence'

export default function ConvertToInstallmentForm({ tx, onSubmit, onClose }) {
  const [totalCount, setTotalCount] = useState('3')
  const [amount, setAmount] = useState(String(Math.round(tx.amount / 3)))
  const [amountTouched, setAmountTouched] = useState(false)
  const [billingDay, setBillingDay] = useState(String(dayFromMD(tx.date) || new Date().getDate()))
  const [error, setError] = useState('')

  function handleTotalCountChange(v) {
    setTotalCount(v)
    const n = Number(v)
    if (!amountTouched && n > 0) {
      setAmount(String(Math.round(tx.amount / n)))
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const total = Number(totalCount)
    if (!Number.isInteger(total) || total < 2) { setError('分期總期數至少 2 期'); return }
    const perAmount = Number(amount)
    if (!perAmount || perAmount <= 0) { setError('請輸入有效每期金額'); return }
    const day = Number(billingDay)
    if (!Number.isInteger(day) || day < 1 || day > 31) { setError('請輸入每月 1～31 號'); return }
    setError('')

    onSubmit({
      id: crypto.randomUUID(),
      type: 'installment',
      name: tx.name,
      card: tx.card,
      currency: 'TWD',
      amount: perAmount,
      period: '期',
      billingDay: day,
      paidCount: 0,
      totalCount: total,
      paid: false,
    })
  }

  return (
    <form className="apf" onSubmit={handleSubmit}>
      <p className="apf-convert-hint">
        「{tx.name}」（NT${Number(tx.amount).toLocaleString()}）將轉為分期計畫，這筆刷卡記錄會被移除，改由分期計畫每月追蹤應繳金額。
      </p>

      <div className="apf-fields">
        <div className="apf-field-row">
          <div className="apf-field">
            <label className="apf-label">總期數</label>
            <input
              className="apf-input"
              type="number"
              inputMode="numeric"
              placeholder="3"
              value={totalCount}
              onChange={(e) => handleTotalCountChange(e.target.value)}
            />
          </div>
          <div className="apf-field">
            <label className="apf-label">每期金額</label>
            <input
              className="apf-input"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => { setAmountTouched(true); setAmount(e.target.value) }}
            />
          </div>
        </div>

        <div className="apf-field">
          <label className="apf-label">每月幾號繳款</label>
          <input
            className="apf-input"
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            value={billingDay}
            onChange={(e) => setBillingDay(e.target.value)}
          />
          <span className="apf-fx-hint">預設帶入原刷卡日，可依銀行實際扣款日調整</span>
        </div>
      </div>

      {error && <span className="apf-error">{error}</span>}

      <div className="apf-actions">
        <button type="submit" className="button-primary">轉為分期</button>
        <button type="button" className="apf-cancel" onClick={onClose}>取消</button>
      </div>
    </form>
  )
}
