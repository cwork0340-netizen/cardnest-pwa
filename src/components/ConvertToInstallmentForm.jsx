import { useState } from 'react'
import './AddPlanForm.css'
import { clampDayInMonth } from '../utils/recurrence'
import { parseISODate, ymd } from '../utils/financeData'

function defaultBillingDay(tx) {
  const date = parseISODate(tx.date)
  return date ? date.getDate() : new Date().getDate()
}

function defaultFirstDueDate(tx, billingDay) {
  const date = parseISODate(tx.date) ?? new Date()
  const nextMonth = date.getMonth() + 1
  const year = date.getFullYear() + (nextMonth > 11 ? 1 : 0)
  const month = nextMonth % 12
  return ymd(new Date(year, month, clampDayInMonth(year, month, billingDay)))
}

export default function ConvertToInstallmentForm({ tx, onSubmit, onClose }) {
  const [totalCount, setTotalCount] = useState('3')
  const [totalAmount, setTotalAmount] = useState(String(tx.amount))
  const [billingDay, setBillingDay] = useState(String(defaultBillingDay(tx)))
  const [firstDueDate, setFirstDueDate] = useState(() => defaultFirstDueDate(tx, defaultBillingDay(tx)))
  const [conversionDate, setConversionDate] = useState(tx.postedDate ?? tx.date)
  const [error, setError] = useState('')

  const count = Number(totalCount) || 0
  const convertedTotal = Number(totalAmount) || 0
  const regularAmount = count > 0 ? Math.floor(convertedTotal / count) : 0
  const finalAmount = count > 0 ? convertedTotal - regularAmount * (count - 1) : 0

  function handleBillingDayChange(value) {
    setBillingDay(value)
    const day = Number(value)
    if (Number.isInteger(day) && day >= 1 && day <= 31) setFirstDueDate(defaultFirstDueDate(tx, day))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!Number.isInteger(count) || count < 2) return setError('分期期數至少為 2 期')
    if (!convertedTotal || convertedTotal <= 0) return setError('請填寫銀行確認的分期總額')
    const day = Number(billingDay)
    if (!Number.isInteger(day) || day < 1 || day > 31) return setError('請填寫 1 到 31 的帳單日')
    if (!parseISODate(firstDueDate)) return setError('請填寫首期入帳日')
    if (!parseISODate(conversionDate)) return setError('請填寫轉分期確認日')

    onSubmit({
      id: crypto.randomUUID(),
      type: 'installment',
      name: tx.name,
      cardId: tx.cardId,
      card: tx.card,
      currency: 'TWD',
      amount: regularAmount,
      totalAmount: convertedTotal,
      period: '期',
      billingDay: day,
      firstDueDate,
      conversionDate,
      originalTransactionId: tx.id,
      originalAmount: Number(tx.amount),
      originalDate: tx.date,
      originalPostedDate: tx.postedDate,
      paidCount: 0,
      totalCount: count,
      paid: false,
    })
  }

  return (
    <form className="apf" onSubmit={handleSubmit}>
      <p className="apf-convert-hint">
        原刷卡紀錄會保留為「已轉分期」憑據，不再算入一次性消費；從首期入帳日開始，才會列入每期帳單與承諾支出。
      </p>

      <div className="apf-fields">
        <div className="apf-field-row">
          <div className="apf-field">
            <label className="apf-label">分期期數</label>
            <input className="apf-input" type="number" inputMode="numeric" min="2" value={totalCount} onChange={(e) => setTotalCount(e.target.value)} />
          </div>
          <div className="apf-field">
            <label className="apf-label">銀行確認的分期總額</label>
            <input className="apf-input" type="number" inputMode="decimal" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
          </div>
        </div>
        {count >= 2 && convertedTotal > 0 && (
          <span className="apf-fx-hint">前 {count - 1} 期 NT${regularAmount.toLocaleString()}，末期 NT${finalAmount.toLocaleString()}；合計會等於分期總額。</span>
        )}
        <div className="apf-field">
          <label className="apf-label">每期預計列帳日</label>
          <input className="apf-input" type="number" inputMode="numeric" min="1" max="31" value={billingDay} onChange={(e) => handleBillingDayChange(e.target.value)} />
        </div>
        <div className="apf-field">
          <label className="apf-label">首期入帳日</label>
          <input className="apf-input" type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
        </div>
        <div className="apf-field">
          <label className="apf-label">銀行轉分期確認日</label>
          <input className="apf-input" type="date" value={conversionDate} onChange={(e) => setConversionDate(e.target.value)} />
          <span className="apf-fx-hint">若帳單同時出現原消費與沖銷，請以銀行實際入帳資料為準。</span>
        </div>
      </div>

      {error && <span className="apf-error">{error}</span>}
      <div className="apf-actions">
        <button type="submit" className="button-primary">確認轉分期</button>
        <button type="button" className="apf-cancel" onClick={onClose}>取消</button>
      </div>
    </form>
  )
}
