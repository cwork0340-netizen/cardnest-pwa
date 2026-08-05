import { useState } from 'react'
import './CardForm.css'

export default function CardForm({ onSubmit, onClose, initialValues }) {
  const isEdit = !!initialValues
  const [name, setName] = useState(initialValues?.name ?? '')
  const [color, setColor] = useState(initialValues?.color ?? '#A98274')
  const [billingDay, setBillingDay] = useState(initialValues?.billingDay ?? '')
  const [dueDay, setDueDay] = useState(initialValues?.dueDay ?? '')
  const [budget, setBudget] = useState(initialValues?.budget ?? '')
  const [last4, setLast4] = useState(initialValues?.last4 ?? '')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('請輸入卡名'); return }
    const bd = Number(billingDay)
    if (!bd || bd < 1 || bd > 31) { setError('帳單日請填 1–31'); return }
    const dd = Number(dueDay)
    if (!dd || dd < 1 || dd > 30) { setError('繳款寬限天數請填 1–30'); return }
    const bgt = Number(budget)
    if (!bgt || bgt <= 0) { setError('請輸入有效預算'); return }
    const normalizedLast4 = String(last4).replace(/\D/g, '')
    if (normalizedLast4 && normalizedLast4.length !== 4) { setError('卡號末四碼請填 4 位數字'); return }
    setError('')

    const card = {
      id: initialValues?.id ?? crypto.randomUUID(),
      name: name.trim(),
      nickname: name.trim(),
      color,
      billingDay: bd,
      dueDay: dd,
      budget: bgt,
      ...(normalizedLast4 && { last4: normalizedLast4 }),
      billingCycles: initialValues?.billingCycles ?? [],
    }

    onSubmit(card)
  }

  return (
    <form className="cdf" onSubmit={handleSubmit}>
      <div className="cdf-fields">
        <div className="cdf-field">
          <label className="cdf-label">卡名</label>
          <input
            className="cdf-input"
            type="text"
            placeholder="永豐 Debit、玉山 Preferential…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="cdf-field">
          <label className="cdf-label">卡片顏色</label>
          <div className="cdf-color-row">
            <input
              className="cdf-color-picker"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <span className="cdf-color-value">{color}</span>
          </div>
        </div>

        <div className="cdf-row">
          <div className="cdf-field cdf-field-half">
            <label className="cdf-label">帳單日（每月幾號）</label>
            <input
              className="cdf-input"
              type="number"
              inputMode="numeric"
              placeholder="12"
              min="1"
              max="31"
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
            />
          </div>
          <div className="cdf-field cdf-field-half">
            <label className="cdf-label">繳款寬限（帳單後幾天）</label>
            <input
              className="cdf-input"
              type="number"
              inputMode="numeric"
              placeholder="20"
              min="1"
              max="30"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            />
          </div>
        </div>

        <div className="cdf-field">
          <label className="cdf-label">預算上限（NT$）</label>
          <input
            className="cdf-input"
            type="number"
            inputMode="decimal"
            placeholder="20000"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>

        <div className="cdf-field">
          <label className="cdf-label">卡號末四碼（建議填寫）</label>
          <input
            className="cdf-input"
            type="text"
            inputMode="numeric"
            maxLength="4"
            placeholder="1234"
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
          />
          <p className="cdf-field-note">用於正確匯入同一家銀行的多張信用卡；不會儲存完整卡號。</p>
        </div>

        <p className="cdf-field-note">
          每期的實際應繳金額跟到期日，新增卡片後會自動產生，可以在「各卡狀態」展開後編輯。
        </p>
      </div>

      {error && <span className="cdf-error">{error}</span>}

      <div className="cdf-actions">
        <button type="submit" className="button-primary">
          {isEdit ? '儲存變更' : '新增信用卡'}
        </button>
        <button type="button" className="cdf-cancel" onClick={onClose}>取消</button>
      </div>
    </form>
  )
}
