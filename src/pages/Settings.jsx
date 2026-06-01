import { useState } from 'react'
import './Settings.css'
import SectionHeader from '../components/SectionHeader'
import BottomSheet from '../components/BottomSheet'
import CardForm from '../components/CardForm'

export default function Settings({ showToast, cards, fxSettings, onFxChange, onAddCard, onSaveCard, onDeleteCard }) {
  const [editingCard, setEditingCard] = useState(null)
  const [showAddCard, setShowAddCard] = useState(false)
  const [deletingCardId, setDeletingCardId] = useState(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  function handleClearData() {
    localStorage.removeItem('cardnest_v1')
    window.location.reload()
  }
  const [usdRate, setUsdRate] = useState(String(fxSettings?.usdRate ?? 32.5))
  const [feeRate, setFeeRate] = useState(String(fxSettings?.feeRate ?? 1.5))
  const [fxUpdated, setFxUpdated] = useState('')

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
          <div className="card settings-card-row" key={card.id}>
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
              <button className="settings-edit-btn" onClick={() => setEditingCard(card)}>編輯</button>
              {deletingCardId === card.id ? (
                <div className="settings-delete-confirm">
                  <span className="settings-delete-msg">確定刪除？</span>
                  <button className="settings-delete-yes" onClick={() => handleDeleteCard(card.id)}>刪除</button>
                  <button className="settings-delete-no" onClick={() => setDeletingCardId(null)}>取消</button>
                </div>
              ) : (
                <button className="settings-delete-btn" onClick={() => setDeletingCardId(card.id)}>刪除</button>
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

      {/* Google Sheets */}
      <div className="section">
        <SectionHeader title="Google Sheets 連結" />
        <div className="card">
          <p className="settings-desc">連結後，帳務資料自動同步至 Google Sheets</p>
          <button className="button-secondary" style={{ marginTop: 12 }} onClick={() => showToast('即將推出')}>
            連結 Google Sheets
          </button>
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
                <button className="settings-logout-confirm-btn" onClick={handleClearData}>確定清除</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 帳號 */}
      <div className="section">
        <SectionHeader title="帳號" />
        <div className="card">
          <button className="button-danger-outline" onClick={() => setShowLogoutConfirm(true)}>登出</button>
          {showLogoutConfirm && (
            <div className="settings-logout-confirm">
              <p className="settings-logout-msg">確定要登出嗎？</p>
              <p className="settings-logout-sub">你的資料仍會保留在 Google Sheets。</p>
              <div className="settings-logout-actions">
                <button className="settings-logout-cancel" onClick={() => setShowLogoutConfirm(false)}>取消</button>
                <button className="settings-logout-confirm-btn" onClick={() => { showToast('已登出'); setShowLogoutConfirm(false) }}>確定登出</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
