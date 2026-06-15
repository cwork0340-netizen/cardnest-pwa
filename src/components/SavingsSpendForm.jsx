import { useState } from 'react'
import './ChecklistForm.css'

export default function SavingsSpendForm({ goal, onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const saved = Number(goal?.saved ?? 0)

  function handleSubmit(e) {
    e.preventDefault()
    const num = Number(amount)
    if (!num || num <= 0) { setError('請輸入支出金額'); return }
    if (num > saved) { setError(`不能超過帳戶餘額 NT$${saved.toLocaleString()}`); return }
    setError('')
    onSubmit(num, note.trim())
  }

  return (
    <form className="clf" onSubmit={handleSubmit}>
      <div className="clf-fields">
        <div className="clf-field">
          <label className="clf-label">支出金額<span className="clf-label-hint">（帳戶餘額 NT${saved.toLocaleString()}）</span></label>
          <input
            className="clf-input"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>
        <div className="clf-field">
          <label className="clf-label">備註<span className="clf-label-hint">（選填）</span></label>
          <input
            className="clf-input"
            type="text"
            placeholder="繳上學期學費…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {error && <span className="clf-error">{error}</span>}

      <div className="clf-actions">
        <button type="submit" className="button-primary">記錄支出</button>
        <button type="button" className="clf-cancel" onClick={onClose}>取消</button>
      </div>
    </form>
  )
}
