import { useState } from 'react'
import './ChecklistForm.css'

export default function SavingsForm({ onSubmit, onClose, initialValues = null }) {
  const isEditing = !!initialValues
  const [name, setName] = useState(initialValues?.name ?? '')
  const [monthly, setMonthly] = useState(initialValues ? String(initialValues.monthly) : '')
  const [target, setTarget] = useState(initialValues?.target ? String(initialValues.target) : '')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('請輸入目標名稱'); return }
    const monthlyNum = Number(monthly)
    if (!monthlyNum || monthlyNum <= 0) { setError('請輸入每月撥入金額'); return }
    let targetNum = 0
    if (target !== '') {
      targetNum = Number(target)
      if (Number.isNaN(targetNum) || targetNum < 0) { setError('目標金額需為有效數字'); return }
    }
    setError('')

    onSubmit({
      id: initialValues?.id ?? crypto.randomUUID(),
      name: name.trim(),
      monthly: monthlyNum,
      target: targetNum,
      saved: initialValues?.saved ?? 0,
    })
  }

  return (
    <form className="clf" onSubmit={handleSubmit}>
      <div className="clf-fields">
        <div className="clf-field">
          <label className="clf-label">目標名稱</label>
          <input
            className="clf-input"
            type="text"
            placeholder="學費、旅遊、緊急預備金…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="clf-field">
          <label className="clf-label">每月撥入</label>
          <input
            className="clf-input"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
          />
        </div>

        <div className="clf-field">
          <label className="clf-label">目標金額<span className="clf-label-hint">（選填）</span></label>
          <input
            className="clf-input"
            type="number"
            inputMode="decimal"
            placeholder="例如 60000"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
      </div>

      {error && <span className="clf-error">{error}</span>}

      <div className="clf-actions">
        <button type="submit" className="button-primary">{isEditing ? '儲存修改' : '新增目標'}</button>
        <button type="button" className="clf-cancel" onClick={onClose}>取消</button>
      </div>
    </form>
  )
}
