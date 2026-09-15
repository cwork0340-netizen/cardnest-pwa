// 用 Google Identity Services 取得 access token，再直接呼叫 Sheets API 寫入資料。
// 整支 App 沒有後端，所以授權跟同步都是在瀏覽器裡直接打 Google 的 API。
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

// Google 的 OAuth Client ID 長得像 123456789-abc.apps.googleusercontent.com。
// 貼錯（最常見的是貼成 Client Secret，或少複製了一段）的話，Google 會在收到請求的
// 當下就回 400 malformed，而且那是一個跳轉出去的錯誤頁——App 這邊什麼都收不到，
// 使用者只會看到一片空白的失敗。所以在送出去之前先擋下來，直接說是哪裡不對。
// 從網頁複製貼上很容易夾帶看不見的字元（零寬空格、軟連字號、BOM）。trim() 清不掉
// 它們，肉眼也看不出來——Client ID 看起來一字不差，Google 卻回 400 malformed。
// 所以一律先清掉再用，而不是叫使用者去找一個他看不見的東西。
const INVISIBLE_CHARS = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g

export function sanitizeClientId(value) {
  return String(value ?? '').replace(INVISIBLE_CHARS, '').trim()
}

export function describeClientIdProblem(value) {
  const id = sanitizeClientId(value)
  if (!id) return '請先填 Google OAuth Client ID'
  if (/\s/.test(id)) return 'Client ID 中間不該有空白，請重新複製一次'
  if (!id.endsWith('.apps.googleusercontent.com')) {
    return 'Client ID 結尾應該是 .apps.googleusercontent.com——你貼的可能是 Client Secret 或只複製到一半'
  }
  if (id.length <= '.apps.googleusercontent.com'.length) return 'Client ID 看起來不完整'
  return ''
}
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
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY)
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
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
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

// 授權視窗如果在 Google 那端就被擋掉（例如 Client ID 不對、或這個網址沒有登記在
// OAuth 用戶端的「已授權的 JavaScript 來源」裡），使用者會看到 Google 自己的
// 400 錯誤頁，而 callback 永遠不會被呼叫——這個 Promise 就會無聲地吊死，畫面
// 停在「同步中…」，什麼線索都沒有。所以設一個上限，逾時就講清楚可能是什麼問題。
const AUTH_TIMEOUT_MS = 90 * 1000
// 靜默換新不該讓使用者等：它失敗是常態（第一次使用、或授權被撤銷），
// 失敗了要趕快退回完整同意畫面，不能卡在這裡九十秒。
const SILENT_TIMEOUT_MS = 15 * 1000

function requestToken(client, prompt, timeoutMs = AUTH_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn) => (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn(value)
    }
    const ok = finish(resolve)
    const fail = finish(reject)

    const timer = setTimeout(() => {
      fail(new Error('授權沒有完成。如果剛才看到 Google 的錯誤頁面，通常是 Client ID 填錯，或這個網址沒有登記在該 OAuth 用戶端的「已授權的 JavaScript 來源」裡'))
    }, timeoutMs)

    client.callback = (resp) => {
      if (resp?.error) return fail(new Error(describeAuthError(resp)))
      if (!resp?.access_token) return fail(new Error('Google 沒有回傳授權碼，請再試一次'))
      ok(resp)
    }
    // GIS 自己偵測到的錯誤（例如彈出視窗被瀏覽器擋住）走這裡，不會進 callback
    client.error_callback = (err) => fail(new Error(describeAuthError(err)))

    try {
      client.requestAccessToken({ prompt })
    } catch (err) {
      fail(new Error(describeAuthError(err)))
    }
  })
}

// 把 Google 回的代碼翻成看得懂、而且說得出下一步的話
function describeAuthError(resp) {
  const code = String(resp?.error ?? resp?.type ?? '').trim()
  const detail = String(resp?.error_description ?? resp?.message ?? '').trim()
  const known = {
    popup_closed: '授權視窗被關掉了，請再按一次',
    popup_closed_by_user: '授權視窗被關掉了，請再按一次',
    popup_failed_to_open: '瀏覽器擋住了授權視窗，請允許彈出視窗後再試',
    access_denied: '你在同意畫面選擇了拒絕，沒有取得授權',
    invalid_client: 'Google 不認得這個 Client ID，請到 Google Cloud Console 確認後重填',
    invalid_request: '授權請求被 Google 判定格式錯誤，最常見的原因是 Client ID 填錯，或這個網址沒有登記在該 OAuth 用戶端的「已授權的 JavaScript 來源」裡',
    idpiframe_initialization_failed: '無法初始化 Google 登入，請確認這個網址已登記在 OAuth 用戶端的已授權來源',
  }
  if (known[code]) return known[code]
  if (code && detail) return `Google 授權失敗：${code}（${detail}）`
  if (code) return `Google 授權失敗：${code}`
  return 'Google 授權失敗，原因不明'
}

// 之前登入過、token 還沒過期就直接沿用；過期了先嘗試背景默默換新（大部分時候
// 不會再跳出選帳號畫面），只有真的需要重新同意時才彈出完整畫面。
export async function getAccessToken(clientId) {
  const cached = loadStoredToken()
  if (cached) return cached

  // 格式明顯不對就不要送出去——Google 會回一個跳轉出去的 400 頁面，
  // App 這邊收不到任何訊息，使用者只會看到沒有解釋的失敗。
  const problem = describeClientIdProblem(clientId)
  if (problem) throw new Error(problem)

  await loadGis()
  const client = getTokenClient(sanitizeClientId(clientId))

  try {
    const resp = await requestToken(client, '', SILENT_TIMEOUT_MS)
    storeToken(resp.access_token, resp.expires_in)
    return resp.access_token
  } catch {
    // 背景換新失敗（例如從未同意過、或已撤銷授權），退回完整同意畫面。
    // 這一次的錯誤要往外拋，不能再吞掉——它才是使用者需要看到的那個原因。
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

const HEADER = ['日期', '卡片ID', '卡片', '金額', '類別', '備註']

function transactionToRow(tx) {
  return [tx.date ?? '', tx.cardId ?? '', tx.card ?? '', tx.amount ?? 0, tx.category ?? '', tx.note ?? '']
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
