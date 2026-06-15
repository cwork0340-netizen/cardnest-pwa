import { useState } from 'react'
import './ChecklistForm.css'

export default function SavingsForm({ onSubmit, onClose, initialValues = null, checklistItems = [] }) {
  const isEditing = !!initialValues
  const [name, setName] = useState(initialValues?.name ?? '')
  const [linkedId, setLinkedId] = useState(initialValues?.linkedChecklistId ?? '')
  const [monthly, setMonthly] = useState(initialValues ? String(initialValues.monthly ?? '') : '')
  const [target, setTarget] = useState(initialValues?.target ? String(initialValues.target) : '')
  const [countInEssential, setCountInEssential] = useState(initialValues?.countInEssential ?? false)
  const [error, setError] = useState('')

  const linkedItem = checklistItems.find((i) => i.id === linkedId)
  const isLinked = !!linkedItem

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('請輸入目標名稱'); return }
    // 連動必繳項目時，每月金額自動取自該項目，不需手動填
    let monthlyNum = isLinked ? Number(linkedItem.amount) : Number(monthly)
    if (!isLinked && (!monthlyNum || monthlyNum <= 0)) { setError('請輸入每月撥入金額'); return }
    let targetNum = 0
    if (target !== '') {
      targetNum = Number(target)
      if (Number.isNaN(targetNum) || targetNum < 0) { setError('目標金額需為有效數字'); return }
    }
    setError('')

    onSubmit({
      id: initialValues?.id ?? crypto.randomUUID(),
      name: name.trim(),
      linkedChecklistId: isLinked ? linkedId : null,
      monthly: monthlyNum,
      target: targetNum,
      countInEssential: isLinked ? false : countInEssential,
      saved: initialValues?.saved ?? 0,
      entries: initialValues?.entries ?? [],
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
          <label className="clf-label">連動必繳項目<span className="clf-label-hint">（選填）</span></label>
          <select className="clf-input" value={linkedId} onChange={(e) => setLinkedId(e.target.value)}>
            <option value="">不連動（手動撥入）</option>
            {checklistItems.map((i) => (
              <option key={i.id} value={i.id}>{i.name}（NT${Number(i.amount).toLocaleString()}）</option>
            ))}
          </select>
          {isLinked && (
            <span className="clf-label-hint">勾選「{linkedItem.name}」當月即自動存入該筆金額，金額調整時存入實際金額</span>
          )}
        </div>

        {!isLinked && (
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
        )}

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

      {!isLinked && (
        <label className="sf-check">
          <input
            type="checkbox"
            checked={countInEssential}
            onChange={(e) => setCountInEssential(e.target.checked)}
          />
          <span className="sf-check-text">
            額外預留（計入必要支出）
            <span className="sf-check-hint">這筆是收入裡額外要存的；若已列在必繳項目，請改用上面的「連動」，以免重複計算</span>
          </span>
        </label>
      )}

      {error && <span className="clf-error">{error}</span>}

      <div className="clf-actions">
        <button type="submit" className="button-primary">{isEditing ? '儲存修改' : '新增目標'}</button>
        <button type="button" className="clf-cancel" onClick={onClose}>取消</button>
      </div>
    </form>
  )
}
