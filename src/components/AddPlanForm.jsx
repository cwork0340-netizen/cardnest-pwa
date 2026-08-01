import { useState } from 'react'
import './AddPlanForm.css'
import { clampDayInMonth, dayFromMD, nextOccurrence } from '../utils/recurrence'
import { resolveCardId, ymd } from '../utils/financeData'

// 舊資料只有 nextDate（如 "6/15"）沒有 billingDay 時，從顯示字串推回每月幾號；
// 新增時預設今天的號數，跟原本「下次扣款日」預填今天的行為一致
function initialBillingDay(initialValues) {
  if (!initialValues) return String(new Date().getDate())
  if (initialValues.billingDay) return String(initialValues.billingDay)
  const day = dayFromMD(initialValues.nextDate)
  return day ? String(day) : String(new Date().getDate())
}

// 「已繳幾期」是中途加入時回填的歷史資訊，不是真的有交易——回推出對應的
// 第一期到期日，讓材料化機制知道從哪一期開始才是這個功能該負責的範圍。
// legacyPaidCount 為 0（全新分期）時，第一期就是下一個扣款日。
function currentAnchor(billingDay, today) {
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
  return d >= billingDay ? new Date(y, m, billingDay) : new Date(y, m - 1, billingDay)
}

function computeFirstDueDate(legacyPaidCount, billingDay, today = new Date()) {
  if (legacyPaidCount <= 0) {
    // 全新分期：第一期一定要在「今天之後」，不然萬一今天剛好就是扣款日，
    // 材料化機制會把它當成已經到期，剛新增就自動算成已繳一期
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    return ymd(nextOccurrence(billingDay, tomorrow))
  }
  let cursor = currentAnchor(billingDay, today)
  for (let i = 0; i < legacyPaidCount - 1; i++) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, clampDayInMonth(cursor.getFullYear(), cursor.getMonth() - 1, billingDay))
  }
  return ymd(cursor)
}

export default function AddPlanForm({ onSubmit, onClose, cards, fxSettings, initialValues = null }) {
  const usdRate = fxSettings?.usdRate ?? 32.5
  const feeRate = fxSettings?.feeRate ?? 1.5
  const isEditing = !!initialValues

  const [type, setType] = useState(initialValues?.type ?? 'subscription')
  const [currency, setCurrency] = useState(initialValues?.currency ?? 'TWD')
  const [name, setName] = useState(initialValues?.name ?? '')
  const [cardId, setCardId] = useState(resolveCardId(initialValues, cards) ?? cards[0]?.id ?? '')
  const [amount, setAmount] = useState(
    initialValues
      ? String(initialValues.currency === 'USD' ? initialValues.amountOriginal : initialValues.amount)
      : ''
  )
  const [billingDay, setBillingDay] = useState(initialBillingDay(initialValues))
  const [totalCount, setTotalCount] = useState(initialValues?.totalCount ? String(initialValues.totalCount) : '')
  const [paidCountInput, setPaidCountInput] = useState(
    initialValues?.legacyPaidCount != null ? String(initialValues.legacyPaidCount)
      : initialValues?.paidCount != null ? String(initialValues.paidCount) : ''
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
    const day = Number(billingDay)
    if (!Number.isInteger(day) || day < 1 || day > 31) { setError('請輸入每月 1～31 號'); return }

    let paidCount = 0
    let total = 0
    if (type === 'installment') {
      total = Number(totalCount)
      if (!total || total < 2) { setError('分期總期數至少 2 期'); return }
      const paid = paidCountInput === '' ? 0 : Number(paidCountInput)
      if (!Number.isInteger(paid) || paid < 0 || paid > total) {
        setError('已繳期數需介於 0 與總期數之間')
        return
      }
      paidCount = paid
    }
    setError('')

    const amountTWD = currency === 'USD'
      ? Math.round(num * usdRate * (1 + feeRate / 100))
      : num

    const base = {
      id: initialValues?.id ?? crypto.randomUUID(),
      type,
      name: name.trim(),
      cardId,
      card: cards.find((c) => c.id === cardId)?.name ?? '',
      currency,
      amount: amountTWD,
      period: type === 'subscription' ? '月' : '期',
      billingDay: day,
      ...(currency === 'USD' && { amountOriginal: num, usdRate, feeRate }),
    }

    const newPlan = type === 'subscription'
      ? {
          ...base,
          active: initialValues?.active ?? true,
          materializeFrom: initialValues?.materializeFrom ?? ymd(new Date()),
        }
      : {
          ...base,
          legacyPaidCount: paidCount,
          totalCount: total,
          firstDueDate: initialValues?.firstDueDate ?? computeFirstDueDate(paidCount, day),
          materializeFrom: initialValues?.materializeFrom ?? ymd(new Date()),
        }

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
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
              <label className="apf-label">已繳期數</label>
              <input
                className="apf-input"
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={paidCountInput}
                onChange={(e) => setPaidCountInput(e.target.value)}
              />
              <span className="apf-fx-hint">中途加入可填已繳幾期，預設為 0</span>
            </div>
          </div>
        )}

        <div className="apf-field">
          <label className="apf-label">
            {type === 'subscription' ? '每月幾號扣款' : '每月幾號繳款'}
          </label>
          <input
            className="apf-input"
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            placeholder="15"
            value={billingDay}
            onChange={(e) => setBillingDay(e.target.value)}
          />
          <span className="apf-fx-hint">日期會自動算到下一次發生日，不用每期手動改</span>
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
