// 用 Google Identity Services 取得 access token，再直接呼叫 Sheets API 寫入資料。
// 整支 App 沒有後端，所以授權跟同步都是在瀏覽器裡直接打 Google 的 API。
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const SHEET_TITLE = '刷卡紀錄'

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

let tokenClient = null
let cachedToken = null

export async function getAccessToken(clientId) {
  await loadGis()
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: () => {}, // 在 requestAccessToken 呼叫時用 promise 覆寫
    })
  }
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error))
      cachedToken = resp.access_token
      resolve(cachedToken)
    }
    tokenClient.requestAccessToken({ prompt: cachedToken ? '' : 'consent' })
  })
}

async function ensureSheetExists(sheetId, accessToken) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('找不到這個 Google Sheet，請確認 Sheet ID 跟授權帳號是否正確')
  const data = await res.json()
  const exists = data.sheets?.some(s => s.properties.title === SHEET_TITLE)
  if (exists) return
  const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_TITLE } } }] }),
  })
  if (!addRes.ok) throw new Error('建立分頁失敗')
}

const HEADER = ['日期', '卡片', '金額', '類別', '備註']

function transactionToRow(tx) {
  return [tx.date ?? '', tx.card ?? '', tx.amount ?? 0, tx.category ?? '', tx.note ?? '']
}

export async function syncTransactionsToSheet({ accessToken, sheetId, transactions }) {
  await ensureSheetExists(sheetId, accessToken)
  // 先清空整個分頁，避免刪除過的舊紀錄留在底部變成殘留資料
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET_TITLE)}:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const rows = [HEADER, ...transactions.map(transactionToRow)]
  const range = `${SHEET_TITLE}!A1:Z${rows.length}`
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
