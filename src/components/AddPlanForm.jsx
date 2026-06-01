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

export default function AddPlanForm({ onSubmit, onClose, cards, fxSettings }) {
  const usdRate = fxSettings?.usdRate ?? 32.5
  const feeRate = fxSettings?.feeRate ?? 1.5

  const [type, setType] = useState('subscription')
  const [currency, setCurrency] = useState('TWD')
  const [name, setName] = useState('')
  const [card, setCard] = useState(cards[0]?.name ?? '')
  const [amount, setAmount] = useState('')
  const [nextDate, setNextDate] = useState(todayString())
  const [totalCount, setTotalCount] = useState('')
  const [error, setError] = useState('')

  const estimatedTWD = currency === 'USD' && Number(amount) > 0
    ? Math.round(Number(amount) * usdRate * (1 + feeRate / 100))
    : null

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('請輸入名稱'); return }
    const num = Number(amount)
    if (!num || num <= 0) { setError('請輸入有效金額'); return }
    if (type === 'installment') {
      const tc = Number(totalCount)
      if (!tc || tc < 2) { setError('分期總期數至少 2 期'); return }
    }
    setError('')

    const daysLeft = calcDaysLeft(nextDate)
    const status = calcStatus(daysLeft)
    const displayDate = toDisplayDate(nextDate)

    const amountTWD = currency === 'USD'
      ? Math.round(num * usdRate * (1 + feeRate / 100))
      : num

    const base = {
      id: crypto.randomUUID(),
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
      ? { ...base, active: true }
      : { ...base, paidCount: 0, totalCount: Number(totalCount), paid: false }

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
        <button type="submit" className="button-primary">新增計畫</button>
        <button type="button" className="apf-cancel" onClick={onClose}>取消</button>
      </div>
    </form>
  )
}
