// 用 Google Identity Services 取得 access token，再直接呼叫 Sheets API 寫入資料。
// 整支 App 沒有後端，所以授權跟同步都是在瀏覽器裡直接打 Google 的 API。
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const SHEET_TITLE = '刷卡紀錄'
const TOKEN_STORAGE_KEY = 'cardnest_google_token'
// access token 效期通常 1 小時，提前 2 分鐘視為過期，避免卡在請求中途才過期
const EXPIRY_BUFFER_MS = 2 * 60 * 1000

let gisLoadPromise = null
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisLoadPromise) return gisLoadPromise
  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = resolve
    script.onerror = () => reject(new Error('無法載入 Google 登入元件，請檢查網路連線'))
    document.head.appendChild(script)
  })
  return gisLoadPromise
}

function loadStoredToken() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.token || !parsed?.expiresAt) return null
    if (Date.now() > parsed.expiresAt - EXPIRY_BUFFER_MS) return null
    return parsed.token
  } catch {
    return null
  }
}

function storeToken(token, expiresInSeconds) {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
    token,
    expiresAt: Date.now() + Number(expiresInSeconds || 3600) * 1000,
  }))
}

let tokenClient = null
let tokenClientId = null
function getTokenClient(clientId) {
  // Client ID 變更時要重建連線物件——否則使用者在同一個畫面修正過 ID 之後，
  // 重試仍然拿著第一次的舊 ID 去請求，永遠失敗
  if (!tokenClient || tokenClientId !== clientId) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: () => {}, // 在 requestAccessToken 呼叫時用 promise 覆寫
    })
    tokenClientId = clientId
  }
  return tokenClient
}

function requestToken(client, prompt) {
  return new Promise((resolve, reject) => {
    client.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error))
      resolve(resp)
    }
    client.requestAccessToken({ prompt })
  })
}

// 之前登入過、token 還沒過期就直接沿用；過期了先嘗試背景默默換新（大部分時候
// 不會再跳出選帳號畫面），只有真的需要重新同意時才彈出完整畫面。
export async function getAccessToken(clientId) {
  const cached = loadStoredToken()
  if (cached) return cached

  await loadGis()
  const client = getTokenClient(clientId)

  try {
    const resp = await requestToken(client, '')
    storeToken(resp.access_token, resp.expires_in)
    return resp.access_token
  } catch {
    // 背景換新失敗（例如從未同意過、或已撤銷授權），退回完整同意畫面
    const resp = await requestToken(client, 'consent')
    storeToken(resp.access_token, resp.expires_in)
    return resp.access_token
  }
}

async function ensureSheetExists(sheetId, accessToken, title = SHEET_TITLE) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('找不到這個 Google Sheet，請確認 Sheet ID 跟授權帳號是否正確')
  const data = await res.json()
  const exists = data.sheets?.some(s => s.properties.title === title)
  if (exists) return
  const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  })
  if (!addRes.ok) throw new Error('建立分頁失敗')
}

async function writeRows(sheetId, accessToken, title, rows) {
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(title)}:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const range = `${title}!A1:Z${rows.length}`
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error?.message || '同步失敗，請稍後再試')
  }
  return rows.length - 1
}

const HEADER = ['日期', '卡片', '金額', '類別', '備註']

function transactionToRow(tx) {
  return [tx.date ?? '', tx.card ?? '', tx.amount ?? 0, tx.category ?? '', tx.note ?? '']
}

export async function syncTransactionsToSheet({ accessToken, sheetId, transactions }) {
  await ensureSheetExists(sheetId, accessToken, SHEET_TITLE)
  const rows = [HEADER, ...transactions.map(transactionToRow)]
  return writeRows(sheetId, accessToken, SHEET_TITLE, rows)
}

const CYCLE_SHEET_TITLE = '帳單週期'
const CYCLE_HEADER = ['卡片', '帳單月份', '結帳日', '到期日', '金額', '是否已繳', '已繳日期']

function cycleToRow(cardName, cycle) {
  return [
    cardName,
    cycle.cycleKey ?? '',
    cycle.closeDate ?? '',
    cycle.dueDate ?? '',
    cycle.amount ?? 0,
    cycle.paid ? '已繳' : '未繳',
    cycle.paidAt ?? '',
  ]
}

const MONTHLY_SHEET_TITLE = '月度規劃'
const MONTHLY_HEADER = ['月份', '收入', '必要支出', '額外儲蓄', '信用卡預估', '生活結餘', '更新時間']

// 每月規劃摘要：一個月一列，同步時 upsert 當月那一列（已存在就更新，不存在就往下加），
// 讓 Sheet 累積成逐月的財務總帳，可以回頭看每個月的收支結構變化。
export async function syncMonthlyPlanToSheet({ accessToken, sheetId, summary }) {
  await ensureSheetExists(sheetId, accessToken, MONTHLY_SHEET_TITLE)

  const getRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(MONTHLY_SHEET_TITLE)}!A1:A200`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!getRes.ok) throw new Error('讀取月度規劃分頁失敗')
  const existing = (await getRes.json()).values ?? []

  const now = new Date()
  const row = [
    summary.monthKey,
    summary.income,
    summary.essentialTotal,
    summary.essentialSavings,
    summary.cardEstimateTotal,
    summary.lifeBalance,
    `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  ]

  const hasHeader = existing.length > 0 && existing[0][0] === MONTHLY_HEADER[0]
  const rowIndex = existing.findIndex((r) => r[0] === summary.monthKey)

  const writes = []
  if (!hasHeader) {
    writes.push({ range: `${MONTHLY_SHEET_TITLE}!A1`, values: [MONTHLY_HEADER] })
  }
  if (rowIndex > 0) {
    writes.push({ range: `${MONTHLY_SHEET_TITLE}!A${rowIndex + 1}`, values: [row] })
  } else {
    const nextRow = Math.max(existing.length + 1, 2)
    writes.push({ range: `${MONTHLY_SHEET_TITLE}!A${nextRow}`, values: [row] })
  }

  for (const w of writes) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(w.range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: w.values }),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.error?.message || '月度規劃同步失敗')
    }
  }
  return true
}

// 每張卡的帳單週期歷史（每期結帳日、到期日、金額、是否已繳）寫進獨立分頁，
// 方便留底查閱哪個月繳了多少、有沒有遲繳，跟刷卡記錄的同步共用同一組授權。
export async function syncBillingCyclesToSheet({ accessToken, sheetId, cards }) {
  await ensureSheetExists(sheetId, accessToken, CYCLE_SHEET_TITLE)
  const dataRows = cards
    .flatMap((card) => (card.billingCycles ?? []).map((cycle) => ({ card, cycle })))
    .sort((a, b) => (a.card.name === b.card.name
      ? a.cycle.cycleKey.localeCompare(b.cycle.cycleKey)
      : a.card.name.localeCompare(b.card.name)))
    .map(({ card, cycle }) => cycleToRow(card.name, cycle))
  const rows = [CYCLE_HEADER, ...dataRows]
  return writeRows(sheetId, accessToken, CYCLE_SHEET_TITLE, rows)
}