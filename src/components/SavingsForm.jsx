import { useState } from 'react'
import './ChecklistForm.css'

export default function SavingsForm({ onSubmit, onClose, initialValues = null, checklistItems = [], cardBills = [] }) {
  const isEditing = !!initialValues
  const initialLink = initialValues?.linkedChecklistId
    ? `cl:${initialValues.linkedChecklistId}`
    : initialValues?.linkedCardId
      ? `card:${initialValues.linkedCardId}`
      : ''
  const [name, setName] = useState(initialValues?.name ?? '')
  const [link, setLink] = useState(initialLink)
  const [monthly, setMonthly] = useState(initialValues ? String(initialValues.monthly ?? '') : '')
  const [target, setTarget] = useState(initialValues?.target ? String(initialValues.target) : '')
  const [countInEssential, setCountInEssential] = useState(initialValues?.countInEssential ?? false)
  const [error, setError] = useState('')

  const linkChecklistId = link.startsWith('cl:') ? link.slice(3) : null
  const linkCardId = link.startsWith('card:') ? link.slice(5) : null
  const linkedItem = checklistItems.find((i) => i.id === linkChecklistId)
  const isChecklistLinked = !!linkedItem
  const isCardLinked = !!linkCardId
  // 連動必繳項目時每月金額自動取自該項目；其餘（不連動、連動信用卡）為手動撥入金額
  const needManual = !isChecklistLinked

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('請輸入目標名稱'); return }
    let monthlyNum = isChecklistLinked ? Number(linkedItem.amount) : Number(monthly)
    if (needManual && (!monthlyNum || monthlyNum <= 0)) { setError('請輸入每月撥入金額'); return }
    let targetNum = 0
    if (target !== '') {
      targetNum = Number(target)
      if (Number.isNaN(targetNum) || targetNum < 0) { setError('目標金額需為有效數字'); return }
    }
    setError('')

    onSubmit({
      id: initialValues?.id ?? crypto.randomUUID(),
      name: name.trim(),
      linkedChecklistId: isChecklistLinked ? linkChecklistId : null,
      linkedCardId: isCardLinked ? linkCardId : null,
      monthly: monthlyNum,
      target: targetNum,
      countInEssential: isChecklistLinked ? false : countInEssential,
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
            placeholder="學費、旅遊、信用卡費…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="clf-field">
          <label className="clf-label">連動對象<span className="clf-label-hint">（選填）</span></label>
          <select className="clf-input" value={link} onChange={(e) => setLink(e.target.value)}>
            <option value="">不連動（手動撥入）</option>
            {checklistItems.length > 0 && (
              <optgroup label="必繳項目（勾選時存入）">
                {checklistItems.map((i) => (
                  <option key={i.id} value={`cl:${i.id}`}>{i.name}（NT${Number(i.amount).toLocaleString()}）</option>
                ))}
              </optgroup>
            )}
            {cardBills.length > 0 && (
              <optgroup label="信用卡（預留卡費）">
                {cardBills.map((c) => (
                  <option key={c.id} value={`card:${c.id}`}>{c.name}（本期 NT${Number(c.bill).toLocaleString()}）</option>
                ))}
              </optgroup>
            )}
          </select>
          {isChecklistLinked && (
            <span className="clf-label-hint">勾選「{linkedItem.name}」當月即自動存入該筆金額，金額調整時存入實際金額</span>
          )}
          {isCardLinked && (
            <span className="clf-label-hint">每月撥入要預留的卡費；帳上可用「支付卡費」直接結清本期帳單</span>
          )}
        </div>

        {needManual && (
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

      {needManual && (
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
