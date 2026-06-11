import { useState } from 'react'
import './ChecklistForm.css'

export default function ChecklistForm({ onSubmit, onClose, initialValues = null }) {
  const isEditing = !!initialValues
  const [name, setName] = useState(initialValues?.name ?? '')
  const [amount, setAmount] = useState(initialValues ? String(initialValues.amount) : '')
  const [day, setDay] = useState(initialValues?.day ? String(initialValues.day) : '')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('請輸入項目名稱'); return }
    const num = Number(amount)
    if (!num || num <= 0) { setError('請輸入有效金額'); return }
    let dayNum = null
    if (day !== '') {
      dayNum = Number(day)
      if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) {
        setError('繳款日需介於 1 與 31 之間')
        return
      }
    }
    setError('')

    onSubmit({
      id: initialValues?.id ?? crypto.randomUUID(),
      name: name.trim(),
      amount: num,
      day: dayNum,
      done: initialValues?.done ?? false,
    })
  }

  return (
    <form className="clf" onSubmit={handleSubmit}>
      <div className="clf-fields">
        <div className="clf-field">
          <label className="clf-label">項目名稱</label>
          <input
            className="clf-input"
            type="text"
            placeholder="房租、水電、電信費…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="clf-field">
          <label className="clf-label">金額</label>
          <input
            className="clf-input"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="clf-field">
          <label className="clf-label">繳款日<span className="clf-label-hint">（選填）</span></label>
          <input
            className="clf-input"
            type="number"
            inputMode="numeric"
            placeholder="例如 5（每月 5 號）"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
      </div>

      {error && <span className="clf-error">{error}</span>}

      <div className="clf-actions">
        <button type="submit" className="button-primary">{isEditing ? '儲存修改' : '加入清單'}</button>
        <button type="button" className="clf-cancel" onClick={onClose}>取消</button>
      </div>
    </form>
  )
}
