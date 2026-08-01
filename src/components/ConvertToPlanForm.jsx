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

// 這筆刷卡記錄本身就是這期的扣款，所以訂閱計畫要從「這筆之後」才開始材料化，
// 不然下次算週期時會把同一筆錢又算成一次到期的訂閱
function dayAfter(isoDate) {
  const date = parseISODate(isoDate) ?? new Date()
  return ymd(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1))
}

export default function ConvertToPlanForm({ tx, onSubmit, onClose }) {
  const [type, setType] = useState('subscription')
  const [totalCount, setTotalCount] = useState('3')
  const [amount, setAmount] = useState(String(tx.amount))
  const [amountTouched, setAmountTouched] = useState(false)
  const [billingDay, setBillingDay] = useState(String(defaultBillingDay(tx)))
  const [firstDueDate, setFirstDueDate] = useState(() => defaultFirstDueDate(tx, defaultBillingDay(tx)))
  const [error, setError] = useState('')

  // 訂閱直接沿用刷卡金額（本期就是這筆），分期才需要拆成每期金額；
  // 使用者手動改過金額後就不要再幫他覆蓋
  function handleTypeChange(next) {
    setType(next)
    if (amountTouched) return
    setAmount(next === 'installment' ? String(Math.round(tx.amount / Number(totalCount || 3))) : String(tx.amount))
  }

  function handleTotalCountChange(v) {
    setTotalCount(v)
    const n = Number(v)
    if (!amountTouched && n > 0) setAmount(String(Math.round(tx.amount / n)))
  }

  function handleBillingDayChange(v) {
    setBillingDay(v)
    const day = Number(v)
    if (Number.isInteger(day) && day >= 1 && day <= 31) setFirstDueDate(defaultFirstDueDate(tx, day))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const num = Number(amount)
    if (!num || num <= 0) { setError('請輸入有效金額'); return }
    const day = Number(billingDay)
    if (!Number.isInteger(day) || day < 1 || day > 31) { setError('請輸入每月 1～31 號'); return }

    if (type === 'installment') {
      const total = Number(totalCount)
      if (!Number.isInteger(total) || total < 2) { setError('分期總期數至少 2 期'); return }
      if (!parseISODate(firstDueDate)) { setError('請選擇第一期開始日'); return }
      setError('')
      onSubmit({
        id: crypto.randomUUID(),
        type: 'installment',
        name: tx.name,
        cardId: tx.cardId,
        card: tx.card,
        currency: 'TWD',
        amount: num,
        period: '期',
        billingDay: day,
        firstDueDate,
        legacyPaidCount: 0,
        materializeFrom: firstDueDate,
        totalCount: total,
      })
      return
    }

    setError('')
    onSubmit({
      id: crypto.randomUUID(),
      type: 'subscription',
      name: tx.name,
      cardId: tx.cardId,
      card: tx.card,
      currency: 'TWD',
      amount: num,
      period: '月',
      billingDay: day,
      active: true,
      materializeFrom: dayAfter(tx.date),
    })
  }

  return (
    <form className="apf" onSubmit={handleSubmit}>
      <div className="apf-type-toggle">
        <button
          type="button"
          className={`apf-type-btn${type === 'subscription' ? ' apf-type-btn-active' : ''}`}
          onClick={() => handleTypeChange('subscription')}
        >
          訂閱
        </button>
        <button
          type="button"
          className={`apf-type-btn${type === 'installment' ? ' apf-type-btn-active' : ''}`}
          onClick={() => handleTypeChange('installment')}
        >
          分期
        </button>
      </div>

      {type === 'subscription' ? (
        <p className="apf-convert-hint">
          「{tx.name}」（NT${Number(tx.amount).toLocaleString()}）將建立訂閱計畫追蹤每月扣款。這筆刷卡記錄會保留，視為這期已扣款；之後每月只要有金額、名稱、卡片都相符的刷卡記錄，都會自動算作這個訂閱本期已入帳，不會跟「訂閱小計」重複估算。
        </p>
      ) : (
        <p className="apf-convert-hint">
          「{tx.name}」（NT${Number(tx.amount).toLocaleString()}）將轉為分期計畫，這筆刷卡記錄會被移除，改由分期計畫每月追蹤應繳金額。
        </p>
      )}

      <div className="apf-fields">
        {type === 'installment' && (
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
        )}

        {type === 'subscription' && (
          <div className="apf-field">
            <label className="apf-label">每月金額</label>
            <input
              className="apf-input"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => { setAmountTouched(true); setAmount(e.target.value) }}
            />
            <span className="apf-fx-hint">下個月扣款金額如果不一樣（例如漲價），到時候記得手動改這裡</span>
          </div>
        )}

        <div className="apf-field">
          <label className="apf-label">{type === 'subscription' ? '每月幾號扣款' : '每月幾號繳款'}</label>
          <input
            className="apf-input"
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            value={billingDay}
            onChange={(e) => handleBillingDayChange(e.target.value)}
          />
          <span className="apf-fx-hint">預設帶入原刷卡日，可依銀行實際扣款日調整</span>
        </div>

        {type === 'installment' && (
          <div className="apf-field">
            <label className="apf-label">第一期開始日</label>
            <input
              className="apf-input"
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
            />
            <span className="apf-fx-hint">預設從下一期開始，避免本期刷卡金額和分期重複計算</span>
          </div>
        )}
      </div>

      {error && <span className="apf-error">{error}</span>}

      <div className="apf-actions">
        <button type="submit" className="button-primary">{type === 'subscription' ? '設為訂閱' : '轉為分期'}</button>
        <button type="button" className="apf-cancel" onClick={onClose}>取消</button>
      </div>
    </form>
  )
}
