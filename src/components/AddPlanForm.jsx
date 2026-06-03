import { useState } from 'react'
import './AddPlanForm.css'

function todayString() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function toDisplayDate(isoDate) {
  const [, m, d] = isoDate.split('-')
  return `${Number(m)}/${Number(d)}`
}

// "6/15" → "2025-06-15"（補上當前年份，供 date input 預填）
function mdToIso(md) {
  if (!md) return todayString()
  const [m, d] = md.split('/').map(Number)
  const y = new Date().getFullYear()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function calcDaysLeft(isoDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(isoDate)
  target.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((target - today) / 86400000))
}

function calcStatus(daysLeft) {
  if (daysLeft <= 1) return 'danger'
  if (daysLeft <= 3) return 'warning'
  return 'neutral'
}

export default function AddPlanForm({ onSubmit, onClose, cards, fxSettings, initialValues = null }) {
  const usdRate = fxSettings?.usdRate ?? 32.5
  const feeRate = fxSettings?.feeRate ?? 1.5
  const isEditing = !!initialValues

  const [type, setType] = useState(initialValues?.type ?? 'subscription')
  const [currency, setCurrency] = useState(initialValues?.currency ?? 'TWD')
  const [name, setName] = useState(initialValues?.name ?? '')
  const [card, setCard] = useState(initialValues?.card ?? cards[0]?.name ?? '')
  const [amount, setAmount] = useState(
    initialValues
      ? String(initialValues.currency === 'USD' ? initialValues.amountOriginal : initialValues.amount)
      : ''
  )
  const [nextDate, setNextDate] = useState(initialValues ? mdToIso(initialValues.nextDate) : todayString())
  const [totalCount, setTotalCount] = useState(initialValues?.totalCount ? String(initialValues.totalCount) : '')
  const [remainingCount, setRemainingCount] = useState(
    initialValues?.totalCount != null
      ? String(initialValues.totalCount - initialValues.paidCount)
      : ''
  )
  const [error, setError] = useState('')

  const estimatedTWD = currency === 'USD' && Number(amount) > 0
    ? Math.round(Number(amount) * usdRate * (1 + feeRate / 100))
    : null

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('請輸入名稱'); return }
    const num = Number(amount)
    if (!num || num <= 0) { setError('請輸入有效金額'); return }

    let paidCount = 0
    let total = 0
    if (type === 'installment') {
      total = Number(totalCount)
      if (!total || total < 2) { setError('分期總期數至少 2 期'); return }
      const remaining = remainingCount === '' ? total : Number(remainingCount)
      if (!remaining || remaining < 1 || remaining > total) {
        setError('剩餘期數需介於 1 與總期數之間')
        return
      }
      paidCount = total - remaining
    }
    setError('')

    const daysLeft = calcDaysLeft(nextDate)
    const status = calcStatus(daysLeft)
    const displayDate = toDisplayDate(nextDate)

    const amountTWD = currency === 'USD'
      ? Math.round(num * usdRate * (1 + feeRate / 100))
      : num

    const base = {
      id: initialValues?.id ?? crypto.randomUUID(),
      type,
      name: name.trim(),
      card,
      currency,
      amount: amountTWD,
      period: type === 'subscription' ? '月' : '期',
      nextDate: displayDate,
      daysLeft,
      status,
      ...(currency === 'USD' && { amountOriginal: num, usdRate, feeRate }),
    }

    const newPlan = type === 'subscription'
      ? { ...base, active: initialValues?.active ?? true }
      : { ...base, paidCount, totalCount: total, paid: initialValues?.paid ?? false }

    onSubmit(newPlan)
  }

  return (
    <form className="apf" onSubmit={handleSubmit}>
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

      <div className="apf-fields">
        <div className="apf-field">
          <label className="apf-label">名稱</label>
          <input
            className="apf-input"
            type="text"
            placeholder={type === 'subscription' ? 'Netflix、Spotify…' : 'iPhone 分期、AirPods…'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="apf-field">
          <label className="apf-label">信用卡</label>
          <select
            className="apf-input"
            value={card}
            onChange={(e) => setCard(e.target.value)}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="apf-field">
          <label className="apf-label">幣別</label>
          <div className="apf-type-toggle">
            <button
              type="button"
              className={`apf-type-btn${currency === 'TWD' ? ' apf-type-btn-active' : ''}`}
              onClick={() => setCurrency('TWD')}
            >
              TWD
            </button>
            <button
              type="button"
              className={`apf-type-btn${currency === 'USD' ? ' apf-type-btn-active' : ''}`}
              onClick={() => setCurrency('USD')}
            >
              USD
            </button>
          </div>
        </div>

        <div className="apf-field">
          <label className="apf-label">
            {type === 'subscription' ? '每月金額' : '每期金額'}
            {currency === 'USD' && <span className="apf-label-hint">（美金）</span>}
          </label>
          <input
            className="apf-input"
            type="number"
            inputMode="decimal"
            placeholder={currency === 'USD' ? '19.99' : '0'}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {estimatedTWD && (
            <span className="apf-fx-hint">
              約 NT${estimatedTWD.toLocaleString()}（匯率 {usdRate} + {feeRate}% 手續費）
            </span>
          )}
        </div>

        {type === 'installment' && (
          <div className="apf-field-row">
            <div className="apf-field">
              <label className="apf-label">總期數</label>
              <input
                className="apf-input"
                type="number"
                inputMode="numeric"
                placeholder="24"
                value={totalCount}
                onChange={(e) => setTotalCount(e.target.value)}
              />
            </div>
            <div className="apf-field">
              <label className="apf-label">剩餘期數</label>
              <input
                className="apf-input"
                type="number"
                inputMode="numeric"
                placeholder={totalCount || '同總期數'}
                value={remainingCount}
                onChange={(e) => setRemainingCount(e.target.value)}
              />
              <span className="apf-fx-hint">中途加入可填，預設為整筆未繳</span>
            </div>
          </div>
        )}

        <div className="apf-field">
          <label className="apf-label">
            {type === 'subscription' ? '下次扣款日' : '下次繳款日'}
          </label>
          <input
            className="apf-input"
            type="date"
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
          />
        </div>
      </div>

      {error && <span className="apf-error">{error}</span>}

      <div className="apf-actions">
        <button type="submit" className="button-primary">{isEditing ? '儲存修改' : '新增計畫'}</button>
        <button type="button" className="apf-cancel" onClick={onClose}>取消</button>
      </div>
    </form>
  )
}
