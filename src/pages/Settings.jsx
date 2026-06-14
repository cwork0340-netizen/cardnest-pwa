import { useState, useRef } from 'react'
import './Settings.css'
import SectionHeader from '../components/SectionHeader'
import BottomSheet from '../components/BottomSheet'
import CardForm from '../components/CardForm'

export default function Settings({ showToast, cards, fxSettings, income = 0, onIncomeChange, onFxChange, onAddCard, onSaveCard, onDeleteCard, backupData, onImportData, onClearData }) {
  const [editingCard, setEditingCard] = useState(null)
  const [showAddCard, setShowAddCard] = useState(false)
  const [deletingCardId, setDeletingCardId] = useState(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [incomeInput, setIncomeInput] = useState(income ? String(income) : '')
  const [usdRate, setUsdRate] = useState(String(fxSettings?.usdRate ?? 32.5))
  const [feeRate, setFeeRate] = useState(String(fxSettings?.feeRate ?? 1.5))
  const [fxUpdated, setFxUpdated] = useState('')

  function handleIncomeSave() {
    const n = Number(incomeInput)
    if (n < 0 || Number.isNaN(n)) { showToast('請輸入有效的收入金額'); return }
    onIncomeChange(n)
    showToast('月收入已儲存')
  }

  function handleFxSave() {
    const rate = Number(usdRate)
    const fee = Number(feeRate)
    if (!rate || rate <= 0 || !fee || fee < 0) {
      showToast('請輸入有效的匯率與手續費')
      return
    }
    onFxChange({ usdRate: rate, feeRate: fee })
    const now = new Date()
    setFxUpdated(`${now.getMonth() + 1}/${now.getDate()}`)
    showToast('外幣設定已儲存')
  }

  function handleSaveCard(updated) {
    onSaveCard(updated)
    showToast('信用卡已更新')
    setEditingCard(null)
  }

  function handleAddCard(newCard) {
    onAddCard(newCard)
    showToast('新的信用卡已加入')
    setShowAddCard(false)
  }

  function handleDeleteCard(id) {
    onDeleteCard(id)
    setDeletingCardId(null)
    showToast('已從清單移除')
  }

  const fileInputRef = useRef(null)

  function handleExport() {
    const json = JSON.stringify(backupData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const d = new Date()
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    a.href = url
    a.download = `cardnest-backup-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('已匯出備份檔')
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        const ok = onImportData(data)
        showToast(ok ? '已還原備份資料' : '備份檔格式不正確')
      } catch {
        showToast('讀取備份檔失敗，請確認檔案')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // 允許重複選同一檔
  }

  const stop = (fn) => (e) => { e.stopPropagation(); fn() }
  const rowEditProps = (onEdit) => ({
    onClick: onEdit,
    role: 'button',
    tabIndex: 0,
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit() } },
  })

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="settings-title">設定</h1>
      </div>

      {/* 我的信用卡 */}
      <div className="section">
        <div className="settings-section-header-row">
          <SectionHeader title="我的信用卡" />
          <button className="settings-add-btn" onClick={() => setShowAddCard(true)}>
            ＋ 新增
          </button>
        </div>
        {cards.map((card) => (
          <div className="card settings-card-row settings-row-clickable" key={card.id} {...rowEditProps(() => setEditingCard(card))}>
            <div className="settings-card-info">
              <div className="settings-card-name-row">
                <span className="settings-card-name">{card.name}</span>
                <span className="settings-card-dot" style={{ background: card.color }} />
              </div>
              <span className="settings-card-detail">帳單日：每月 {card.billingDay} 日</span>
              <span className="settings-card-detail">繳款期限：帳單後 {card.dueDay} 日</span>
              <span className="settings-card-detail">預算上限：{'NT$' + Number(card.budget).toLocaleString()}</span>
            </div>
            <div className="settings-card-actions">
              <button className="settings-edit-btn" onClick={stop(() => setEditingCard(card))}>編輯</button>
              {deletingCardId === card.id ? (
                <div className="settings-delete-confirm">
                  <span className="settings-delete-msg">確定刪除？</span>
                  <button className="settings-delete-yes" onClick={stop(() => handleDeleteCard(card.id))}>刪除</button>
                  <button className="settings-delete-no" onClick={stop(() => setDeletingCardId(null))}>取消</button>
                </div>
              ) : (
                <button className="settings-delete-btn" onClick={stop(() => setDeletingCardId(card.id))}>刪除</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <BottomSheet open={!!editingCard} onClose={() => setEditingCard(null)} title="編輯信用卡">
        <CardForm onSubmit={handleSaveCard} onClose={() => setEditingCard(null)} initialValues={editingCard} />
      </BottomSheet>

      <BottomSheet open={showAddCard} onClose={() => setShowAddCard(false)} title="新增信用卡">
        <CardForm onSubmit={handleAddCard} onClose={() => setShowAddCard(false)} initialValues={null} />
      </BottomSheet>

      {/* 月收入 */}
      <div className="section">
        <SectionHeader title="月收入" />
        <div className="card">
          <p className="settings-backup-hint">填入每月收入（薪水＋其他），首頁就會顯示「結餘」並在花超過收入時提醒超支。</p>
          <div className="fx-row">
            <div className="fx-field">
              <label className="fx-label">每月收入（NT$）</label>
              <input className="fx-input" type="number" inputMode="numeric" placeholder="例如 60000" value={incomeInput} onChange={(e) => setIncomeInput(e.target.value)} />
            </div>
          </div>
          <div className="fx-actions">
            <button className="button-secondary fx-save-btn" onClick={handleIncomeSave}>儲存</button>
          </div>
        </div>
      </div>

      {/* 外幣設定 */}
      <div className="section">
        <SectionHeader title="外幣設定" />
        <div className="card">
          <div className="fx-row">
            <div className="fx-field">
              <label className="fx-label">USD 匯率</label>
              <input className="fx-input" type="number" inputMode="decimal" value={usdRate} onChange={(e) => setUsdRate(e.target.value)} />
            </div>
            <div className="fx-field">
              <label className="fx-label">外幣手續費 %</label>
              <input className="fx-input" type="number" inputMode="decimal" value={feeRate} onChange={(e) => setFeeRate(e.target.value)} />
            </div>
          </div>
          {fxUpdated && <p className="fx-updated">上次更新：{fxUpdated}</p>}
          <div className="fx-actions">
            <button className="button-secondary fx-save-btn" onClick={handleFxSave}>儲存</button>
            <a className="fx-link" href="https://www.google.com/search?q=1+USD+to+TWD" target="_blank" rel="noopener noreferrer">
              查今日匯率 →
            </a>
          </div>
        </div>
      </div>

      {/* 資料備份 */}
      <div className="section">
        <SectionHeader title="資料備份" />
        <div className="card settings-backup-card">
          <p className="settings-backup-hint">
            資料只存在這台裝置的瀏覽器，建議定期匯出備份；換手機或清除資料後，可用備份檔一鍵還原。
          </p>
          <div className="settings-backup-actions">
            <button className="button-secondary" onClick={handleExport}>匯出備份</button>
            <button className="button-secondary" onClick={() => fileInputRef.current?.click()}>匯入還原</button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </div>

      {/* 資料管理 */}
      <div className="section">
        <SectionHeader title="資料管理" />
        <div className="card">
          <button className="button-danger-outline" onClick={() => setShowClearConfirm(true)}>清除本機資料</button>
          {showClearConfirm && (
            <div className="settings-logout-confirm">
              <p className="settings-logout-msg">確定要清除所有資料嗎？</p>
              <p className="settings-logout-sub">所有信用卡、計畫、刷卡記錄都會清空，無法復原。</p>
              <div className="settings-logout-actions">
                <button className="settings-logout-cancel" onClick={() => setShowClearConfirm(false)}>取消</button>
                <button className="settings-logout-confirm-btn" onClick={onClearData}>確定清除</button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
