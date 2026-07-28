import { useState, useRef } from 'react'
import './Settings.css'
import SectionHeader from '../components/SectionHeader'
import BottomSheet from '../components/BottomSheet'
import CardForm from '../components/CardForm'
import { notifySupported, notifyPermission, requestNotifyPermission, sendTestNotification } from '../utils/notify'
import { getAccessToken, syncTransactionsToSheet, syncBillingCyclesToSheet, syncMonthlyPlanToSheet } from '../utils/googleSheetSync'
import { fetchImportRows, toISODate } from '../utils/importSheetSync'

// card-import（projects/card-import/Code.gs）目前支援的銀行。之後那支腳本加新銀行，
// 這裡也要跟著加一行，才有對應的卡片可以選。
const SUPPORTED_BANKS = ['富邦', '永豐', '國泰世華']

export default function Settings({
  showToast, cards, fxSettings, onFxChange, onAddCard, onSaveCard, onDeleteCard,
  backupData, onImportData, onClearData, transactions, googleSync, onGoogleSyncChange,
  cardImport, onCardImportChange, onImportTransactions, planSummary,
}) {
  const [editingCard, setEditingCard] = useState(null)
  const [showAddCard, setShowAddCard] = useState(false)
  const [deletingCardId, setDeletingCardId] = useState(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [usdRate, setUsdRate] = useState(String(fxSettings?.usdRate ?? 32.5))
  const [feeRate, setFeeRate] = useState(String(fxSettings?.feeRate ?? 1.5))
  const [fxUpdated, setFxUpdated] = useState('')
  const [notifyState, setNotifyState] = useState(notifyPermission())
  const [clientId, setClientId] = useState(googleSync?.clientId ?? '')
  const [sheetId, setSheetId] = useState(googleSync?.sheetId ?? '')
  const [syncing, setSyncing] = useState(false)
  const [importSheetId, setImportSheetId] = useState(cardImport?.sheetId ?? '')
  const [bankCardMap, setBankCardMap] = useState(cardImport?.bankCardMap ?? {})
  const [importing, setImporting] = useState(false)

  // 填完離開欄位就存，不用等同步成功——否則第一次同步失敗的話，
  // 每次進設定頁都要重打一次 Client ID / Sheet ID
  function saveSyncSettings() {
    if (clientId.trim() === (googleSync?.clientId ?? '') && sheetId.trim() === (googleSync?.sheetId ?? '')) return
    onGoogleSyncChange({ ...googleSync, clientId: clientId.trim(), sheetId: sheetId.trim() })
  }

  async function handleConnectAndSync() {
    if (!clientId.trim() || !sheetId.trim()) {
      showToast('請先填入 Client ID 跟 Sheet ID')
      return
    }
    setSyncing(true)
    try {
      const token = await getAccessToken(clientId.trim())
      const count = await syncTransactionsToSheet({ accessToken: token, sheetId: sheetId.trim(), transactions })
      const cycleCount = await syncBillingCyclesToSheet({ accessToken: token, sheetId: sheetId.trim(), cards })
      if (planSummary?.income > 0) {
        await syncMonthlyPlanToSheet({ accessToken: token, sheetId: sheetId.trim(), summary: planSummary })
      }
      onGoogleSyncChange({ clientId: clientId.trim(), sheetId: sheetId.trim(), lastSyncAt: Date.now(), lastSyncCount: count })
      showToast(`已同步 ${count} 筆刷卡紀錄、${cycleCount} 筆帳單週期，並更新本月規劃總帳`)
    } catch (e) {
      showToast(e.message || '同步失敗，請稍後再試')
    } finally {
      setSyncing(false)
    }
  }

  function handleBankMapChange(bank, cardId) {
    const next = { ...bankCardMap, [bank]: cardId }
    setBankCardMap(next)
    onCardImportChange({ ...cardImport, bankCardMap: next, sheetId: importSheetId })
  }

  function handleImportSheetIdBlur() {
    onCardImportChange({ ...cardImport, sheetId: importSheetId, bankCardMap })
  }

  async function handleImportClick() {
    if (!clientId.trim() || !importSheetId.trim()) {
      showToast('請先填入 Client ID 跟消費記錄 Sheet ID')
      return
    }
    setImporting(true)
    try {
      const token = await getAccessToken(clientId.trim())
      const rows = await fetchImportRows({ accessToken: token, sheetId: importSheetId.trim() })
      const importedKeys = new Set(cardImport?.importedKeys ?? [])

      const newTxs = []
      const newKeys = []
      let skippedUnmapped = 0

      rows.forEach((row) => {
        if (importedKeys.has(row.permalink)) return
        const mappedCard = cards.find((card) => card.id === bankCardMap[row.bank] || card.name === bankCardMap[row.bank])
        if (!mappedCard) { skippedUnmapped++; return }
        newTxs.push({
          id: crypto.randomUUID(),
          name: row.merchant || row.bank,
          category: row.transactionType || '其他',
          cardId: mappedCard.id,
          card: mappedCard.name,
          amount: row.amount,
          date: toISODate(row.rawDate),
          ...(row.rawPostedDate && { postedDate: toISODate(row.rawPostedDate) }),
          note: `自動匯入・${row.bank}`,
        })
        newKeys.push(row.permalink)
      })

      onImportTransactions(newTxs, newKeys)

      if (skippedUnmapped > 0) {
        showToast(`已匯入 ${newTxs.length} 筆，${skippedUnmapped} 筆銀行尚未設定對應卡片`)
      } else {
        showToast(`已匯入 ${newTxs.length} 筆刷卡記錄`)
      }
    } catch (e) {
      showToast(e.message || '匯入失敗，請稍後再試')
    } finally {
      setImporting(false)
    }
  }

  async function handleEnableNotify() {
    const result = await requestNotifyPermission()
    setNotifyState(result)
    if (result === 'granted') showToast('已開啟繳費通知')
    else if (result === 'denied') showToast('通知被拒絕，請到瀏覽器設定開啟')
  }

  async function handleTestNotify() {
    const result = await sendTestNotification()
    setNotifyState(notifyPermission())
    if (result === 'granted') showToast('已送出測試通知，看一下通知列')
    else if (result === 'denied') showToast('通知被拒絕，請到系統設定允許')
    else if (result === 'unsupported') showToast('此瀏覽器不支援，請先「加入主畫面」')
    else showToast('尚未允許通知')
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
  const mappedBankCount = SUPPORTED_BANKS.filter((bank) => bankCardMap[bank]).length
  const importSteps = [
    { label: '連接 Google', done: !!clientId.trim() },
    { label: '填交易 Sheet', done: !!importSheetId.trim() },
    { label: '對應信用卡', done: mappedBankCount > 0 },
    { label: '開始匯入', done: !!cardImport?.lastImportAt },
  ]

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
          首頁會依「帳單日＋繳款寬限天數」自動算出繳款截止日，列出待繳卡費並倒數提醒（也可在「各卡狀態」展開後，針對某一期手動改到期日）。開啟瀏覽器通知後，打開 App 時若有快到期（3 天內）或逾期的卡費會跳通知。
          </p>
          <p className="settings-backup-hint">📱 iPhone 必須先把本站「加入主畫面」並從主畫面開啟，通知才會生效（Safari 分頁內無法通知）。</p>
          {!notifySupported() ? (
            <p className="settings-backup-hint">此裝置／瀏覽器目前不支援通知。請從主畫面的 App 圖示開啟後再試。</p>
          ) : (
            <div className="fx-actions">
              {notifyState === 'granted'
                ? <p className="settings-backup-hint">✅ 繳費通知已開啟</p>
                : <button className="button-secondary fx-save-btn" onClick={handleEnableNotify}>開啟繳費通知</button>}
              <button className="button-secondary fx-save-btn" onClick={handleTestNotify}>傳送測試通知</button>
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

      {/* Cloud Sync */}
      <div className="section">
        <SectionHeader title="雲端同步（Google Sheet）" />
        <div className="card settings-cloud-sync">
          <span className="settings-cloud-sync-status">
            {googleSync?.lastSyncAt
              ? `上次同步：${new Date(googleSync.lastSyncAt).toLocaleString('zh-TW')}・${googleSync.lastSyncCount} 筆`
              : '尚未同步'}
          </span>
          <p className="settings-backup-hint">
            把刷卡紀錄跟每張卡的帳單週期歷史（哪個月繳了多少、有沒有遲繳）都寫進你自己的 Google Sheet 兩個分頁，方便額外做分析或留底查閱。第一次使用前要先在 Google Cloud Console 申請 OAuth Client ID，並把 Client ID 跟你建立的 Sheet ID 填在下面。
          </p>
          <div className="fx-field">
            <label>Google OAuth Client ID</label>
            <input className="fx-input" value={clientId} onChange={e => setClientId(e.target.value)} onBlur={saveSyncSettings} placeholder="xxxxxxxx.apps.googleusercontent.com" />
          </div>
          <div className="fx-field">
            <label>Google Sheet ID</label>
            <input className="fx-input" value={sheetId} onChange={e => setSheetId(e.target.value)} onBlur={saveSyncSettings} placeholder="Sheet 網址中 /d/ 跟 /edit 之間那一段" />
          </div>
          <div className="settings-backup-actions">
            <button className="button-secondary" onClick={handleConnectAndSync} disabled={syncing}>
              {syncing ? '同步中…' : '連結並立即同步'}
            </button>
          </div>
        </div>
      </div>

      {/* 自動匯入信用卡消費 */}
      <div className="section">
        <SectionHeader title="自動匯入信用卡消費" />
        <div className="card settings-cloud-sync">
          <div className="settings-flow-steps">
            {importSteps.map((step, index) => (
              <div className={`settings-flow-step${step.done ? ' settings-flow-step-done' : ''}`} key={step.label}>
                <span className="settings-flow-step-index">{step.done ? '✓' : index + 1}</span>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
          <span className="settings-cloud-sync-status">
            {cardImport?.lastImportAt
              ? `上次匯入：${new Date(cardImport.lastImportAt).toLocaleString('zh-TW')}・${cardImport.lastImportCount} 筆`
              : '尚未匯入過'}
          </span>
          <p className="settings-backup-hint">
            讀取 card-import 腳本自動收集到「CardNest 消費記錄」Sheet 裡的刷卡通知，轉成刷卡記錄。
            用的是上面同一組 Google OAuth Client ID。授權時請選擇有權限讀取那份 Sheet 的 Google 帳號。
          </p>
          <div className="fx-field">
            <label>消費記錄 Sheet ID</label>
            <input
              className="fx-input"
              value={importSheetId}
              onChange={(e) => setImportSheetId(e.target.value)}
              onBlur={handleImportSheetIdBlur}
              placeholder="「CardNest 消費記錄」Sheet 網址中 /d/ 跟 /edit 之間那一段"
            />
          </div>

          {SUPPORTED_BANKS.map((bank) => (
            <div className="fx-field" key={bank}>
              <label>{bank} 對應卡片</label>
              <select
                className="fx-input"
                value={cards.find((card) => card.id === bankCardMap[bank] || card.name === bankCardMap[bank])?.id ?? ''}
                onChange={(e) => handleBankMapChange(bank, e.target.value)}
              >
                <option value="">尚未設定</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          ))}

          <div className="settings-backup-actions">
            <button className="button-secondary" onClick={handleImportClick} disabled={importing}>
              {importing ? '匯入中…' : '匯入自動收集的刷卡紀錄'}
            </button>
          </div>
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
