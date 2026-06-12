import { useState } from 'react'
import './EnvelopeForm.css'

export default function EnvelopeForm({ onSubmit, onClose, initialValues = null }) {
  const isEditing = !!initialValues
  const [name, setName] = useState(initialValues?.name ?? '')
  const [necessity, setNecessity] = useState(initialValues?.necessity ?? 'flexible')
  const [budget, setBudget] = useState(initialValues ? String(initialValues.monthlyBudget) : '')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('請輸入分類名稱'); return }
    const num = Number(budget)
    if (!num || num <= 0) { setError('請輸入有效的月額度'); return }
    setError('')
    onSubmit({
      id: initialValues?.id ?? crypto.randomUUID(),
      name: name.trim(),
      necessity,
      monthlyBudget: num,
    })
  }

  return (
    <form className="envf" onSubmit={handleSubmit}>
      <div className="envf-fields">
        <div className="envf-field">
          <label className="envf-label">分類名稱<span className="envf-label-hint">（對應刷卡分類，如 餐飲、交通）</span></label>
          <input
            className="envf-input"
            type="text"
            placeholder="餐飲、購物、交通、娛樂…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="envf-field">
          <label className="envf-label">性質</label>
          <div className="envf-toggle">
            <button
              type="button"
              className={`envf-toggle-btn${necessity === 'necessary' ? ' envf-toggle-btn-active' : ''}`}
              onClick={() => setNecessity('necessary')}
            >
              必要
            </button>
            <button
              type="button"
              className={`envf-toggle-btn${necessity === 'flexible' ? ' envf-toggle-btn-active' : ''}`}
              onClick={() => setNecessity('flexible')}
            >
              彈性
            </button>
          </div>
        </div>

        <div className="envf-field">
          <label className="envf-label">每月額度</label>
          <input
            className="envf-input"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
      </div>

      {error && <span className="envf-error">{error}</span>}

      <div className="envf-actions">
        <button type="submit" className="button-primary">{isEditing ? '儲存修改' : '新增信封'}</button>
        <button type="button" className="envf-cancel" onClick={onClose}>取消</button>
      </div>
    </form>
  )
}
