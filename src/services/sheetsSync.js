// 換裝置用的整份資料備份／還原。存的內容跟「匯出備份」按鈕存的 JSON 完全一樣，
// 只是不用你自己搬檔案——直接寫進／讀出 Google Sheet 裡一個固定分頁的一格儲存格。
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const BACKUP_TAB = '備份'

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e?.error?.message ?? `HTTP ${res.status}`)
  }
  return res.json()
}

async function ensureBackupTab(sheetId, token) {
  const meta = await api('GET', `/${sheetId}?fields=sheets.properties.title`, token)
  const exists = (meta.sheets ?? []).some(s => s.properties.title === BACKUP_TAB)
  if (!exists) {
    await api('POST', `/${sheetId}:batchUpdate`, token, {
      requests: [{ addSheet: { properties: { title: BACKUP_TAB } } }],
    })
  }
}

export async function backupToSheet(token, sheetId, backupData) {
  await ensureBackupTab(sheetId, token)
  const stamp = new Date().toISOString()
  await api(
    'PUT',
    `/${sheetId}/values/${encodeURIComponent(BACKUP_TAB)}!A1:B1?valueInputOption=RAW`,
    token,
    { values: [[stamp, JSON.stringify(backupData)]] }
  )
  return stamp
}

// 回傳 null 代表這個 Sheet 裡還沒備份過
export async function restoreFromSheet(token, sheetId) {
  const data = await api(
    'GET',
    `/${sheetId}/values/${encodeURIComponent(BACKUP_TAB)}!A1:B1`,
    token
  ).catch((e) => {
    if (String(e.message).includes('Unable to parse range')) return { values: [] }
    throw e
  })
  const row = data.values?.[0]
  if (!row?.[1]) return null
  return { savedAt: row[0], backupData: JSON.parse(row[1]) }
}
