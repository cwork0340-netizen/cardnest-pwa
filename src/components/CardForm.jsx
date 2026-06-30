import { useState } from 'react'
import './CardForm.css'

export default function CardForm({ onSubmit, onClose, initialValues }) {
  const isEdit = !!initialValues
  const [name, setName] = useState(initialValues?.name ?? '')
  const [color, setColor] = useState(initialValues?.color ?? '#5E7CE2')
  const [billingDay, setBillingDay] = useState(initialValues?.billingDay ?? '')
  const [budget, setBudget] = useState(initialValues?.budget ?? '')
  const [actualBill, setActualBill] = useState(initialValues?.actualBill ? String(initialValues.actualBill) : '')
  const [usedOverride, setUsedOverride] = useState(initialValues?.usedOverride ? String(initialValues.usedOverride) : '')
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ? String(initialValues.dueDate) : '')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('請輸入卡名'); return }
    const bd = Number(billingDay)
    if (!bd || bd < 1 || bd > 31) { setError('帳單日請填 1–31'); return }
    const bgt = Number(budget)
    if (!bgt || bgt <= 0) { setError('請輸入有效預算'); return }
    let bill = 0
    if (actualBill !== '') {
      bill = Number(actualBill)
      if (Number.isNaN(bill) || bill < 0) { setError('本期應繳請填有效金額'); return }
    }
    let used = 0
    if (usedOverride !== '') {
      used = Number(usedOverride)
      if (Number.isNaN(used) || used < 0) { setError('本期已刷請填有效金額'); return }
    }
    let due = 0
    if (dueDate !== '') {
      due = Number(dueDate)
      if (!Number.isInteger(due) || due < 1 || due > 31) { setError('繳款截止日請填 1–31'); return }
    }
    setError('')

    const card = {
      id: initialValues?.id ?? crypto.randomUUID(),
      name: name.trim(),
      nickname: name.trim(),
      color,
      billingDay: bd,
      dueDate: due,
      budget: bgt,
      actualBill: bill,
      usedOverride: used,
      billPaidMonth: initialValues?.billPaidMonth ?? null,
      used: initialValues?.used ?? 0,
      prevUsed: initialValues?.prevUsed ?? 0,
      status: initialValues?.status ?? 'safe',
      statusText: initialValues?.statusText ?? '還有可用額度',
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
            <label className="cdf-label">繳款截止日<span className="cdf-label-hint">（每月幾號）</span></label>
            <input
              className="cdf-input"
              type="number"
              inputMode="numeric"
              placeholder="例如 17"
              min="1"
              max="31"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
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

        <div className="cdf-field cdf-reconcile">
          <span className="cdf-reconcile-title">📱 銀行帳單對帳（選填，打開銀行 App 抄兩個數字）</span>
          <div className="cdf-row">
            <div className="cdf-field cdf-field-half">
              <label className="cdf-label">本期應繳</label>
              <input
                className="cdf-input"
                type="number"
                inputMode="decimal"
                placeholder="例如 4605"
                value={actualBill}
                onChange={(e) => setActualBill(e.target.value)}
              />
            </div>
            <div className="cdf-field cdf-field-half">
              <label className="cdf-label">本期已刷</label>
              <input
                className="cdf-input"
                type="number"
                inputMode="decimal"
                placeholder="例如 8400"
                value={usedOverride}
                onChange={(e) => setUsedOverride(e.target.value)}
              />
            </div>
          </div>
          <span className="cdf-reconcile-hint">不填就照舊用逐筆刷卡紀錄加總估算；填了就以這裡的數字為準。</span>
        </div>
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
