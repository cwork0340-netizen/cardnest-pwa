import { useState } from 'react'
import './QuickTransactionForm.css'
import { resolveCardId, toISODate } from '../utils/financeData'

const CATEGORIES = ['餐飲', '購物', '訂閱', '日常', '交通', '娛樂', '其他']

function todayString() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// "6/7" → "2025-06-07"（補上當前年份，供 date input 預填）
function mdToIso(md) {
  return toISODate(md || todayString())
}

export default function QuickTransactionForm({ onSubmit, onClose, cards, initialValues = null }) {
  const isEditing = !!initialValues
  const [amount, setAmount] = useState(initialValues ? String(initialValues.amount) : '')
  const [category, setCategory] = useState(initialValues?.category ?? CATEGORIES[0])
  const [cardId, setCardId] = useState(resolveCardId(initialValues, cards) ?? cards[0]?.id ?? '')
  const [date, setDate] = useState(initialValues ? mdToIso(initialValues.date) : todayString())
  const [note, setNote] = useState(initialValues?.note ?? '')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const num = Number(amount)
    if (!num || num <= 0) {
      setError('請輸入有效金額')
      return
    }
    setError('')
    const selectedCard = cards.find((c) => c.id === cardId)
    onSubmit({ amount: num, category, cardId, card: selectedCard?.name ?? '', date, note })
  }

  return (
    <form className="qtf" onSubmit={handleSubmit}>
      <div className="qtf-field qtf-amount-field">
        <input
          className="qtf-amount-input"
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        {error && <span className="qtf-error">{error}</span>}
      </div>

      <div className="qtf-fields">
        <div className="qtf-field">
          <label className="qtf-label">分類</label>
          <select
            className="qtf-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="qtf-field">
          <label className="qtf-label">信用卡</label>
          <select
            className="qtf-select"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="qtf-field">
          <label className="qtf-label">日期</label>
          <input
            className="qtf-select"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="qtf-field">
          <label className="qtf-label">消費名稱</label>
          <input
            className="qtf-select"
            type="text"
            placeholder="例如：全聯、星巴克、IKEA"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <div className="qtf-actions">
        <button type="submit" className="button-primary">{isEditing ? '儲存修改' : '記一筆'}</button>
        <button type="button" className="qtf-cancel" onClick={onClose}>取消</button>
      </div>
    </form>
  )
}
