import { useState, useRef } from 'react'
import './Settings.css'
import SectionHeader from '../components/SectionHeader'
import BottomSheet from '../components/BottomSheet'
import CardForm from '../components/CardForm'
import { notifySupported, notifyPermission, requestNotifyPermission } from '../utils/notify'

export default function Settings({ showToast, cards, fxSettings, onFxChange, onAddCard, onSaveCard, onDeleteCard, backupData, onImportData, onClearData }) {
  const [editingCard, setEditingCard] = useState(null)
  const [showAddCard, setShowAddCard] = useState(false)
  const [deletingCardId, setDeletingCardId] = useState(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [usdRate, setUsdRate] = useState(String(fxSettings?.usdRate ?? 32.5))
  const [feeRate, setFeeRate] = useState(String(fxSettings?.feeRate ?? 1.5))
  const [fxUpdated, setFxUpdated] = useState('')
  const [notifyState, setNotifyState] = useState(notifyPermission())

  async function handleEnableNotify() {
    const result = await requestNotifyPermission()
    setNotifyState(result)
    if (result === 'granted') showToast('已開啟繳費通知')
    else if (result === 'denied') showToast('通知被拒絕，請到瀏覽器設定開啟')
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

      {/* 繳費通知 */}
      <div className="section">
        <SectionHeader title="繳費通知" />
        <div className="card">
          <p className="settings-backup-hint">
            在卡片設定「繳款截止日」後，首頁會列出待繳卡費並倒數提醒。開啟瀏覽器通知後，打開 App 時若有快到期（3 天內）或逾期的卡費會跳通知。
          </p>
          {!notifySupported() ? (
            <p className="settings-backup-hint">此裝置／瀏覽器不支援通知。建議把本站「加入主畫面」後再試。</p>
          ) : notifyState === 'granted' ? (
            <p className="settings-backup-hint">✅ 繳費通知已開啟</p>
          ) : (
            <div className="fx-actions">
              <button className="button-secondary fx-save-btn" onClick={handleEnableNotify}>開啟繳費通知</button>
            </div>
          )}
        </div>
      </div>

      <BottomSheet open={!!editingCard} onClose={() => setEditingCard(null)} title="編輯信用卡">
        <CardForm onSubmit={handleSaveCard} onClose={() => setEditingCard(null)} initialValues={editingCard} />
      </BottomSheet>

      <BottomSheet open={showAddCard} onClose={() => setShowAddCard(false)} title="新增信用卡">
        <CardForm onSubmit={handleAddCard} onClose={() => setShowAddCard(false)} initialValues={null} />
      </BottomSheet>

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
