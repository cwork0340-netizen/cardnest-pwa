// 換裝置用的整份資料備份／還原。內容跟「匯出備份」按鈕存的 JSON 完全一樣，
// 只是不用自己搬檔案：寫進你自己的 Google Sheet 裡一個固定分頁。
//
// 格式（分頁「雲端備份」，一列一段）：
//   A 快照 id｜B 存檔時間｜C 第幾段｜D 共幾段｜E 檢查碼（hash:字數）｜F 內容
// 為什麼要分段：Google Sheets 一個儲存格最多 5 萬字，整份資料塞一格，交易一多就寫不進去。
// 為什麼留歷史：每次備份都是新增一份，最近 5 份都留著，備份壞掉還能退回前一份。
// 一份快照必須「段數齊全、檢查碼對得上」才算數，寫到一半中斷的那份會被忽略。
//
// 舊版把整份資料放在分頁「備份」的 A1:B1，還原時仍然讀得到（排在新格式之後）。
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const TAB = '雲端備份'
const LEGACY_TAB = '備份'
const CHUNK_SIZE = 40000
const KEEP = 5

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

// FNV-1a：只用來發現「少一段、錯一段」，不是安全用途
export function checksum(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${h.toString(16)}:${text.length}`
}

export function splitChunks(text, size = CHUNK_SIZE) {
  const chunks = []
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size))
  return chunks.length ? chunks : ['']
}

// 把分頁裡的列整理成快照清單（新到舊）。缺段、檢查碼不符、JSON 壞掉的標 complete:false。
export function assembleSnapshots(rows) {
  const byId = new Map()
  rows.forEach((row, rowIndex) => {
    const [id, savedAt, index, total, sum, chunk] = row.map((cell) => String(cell ?? ''))
    if (!id) return
    if (!byId.has(id)) byId.set(id, { id, savedAt, total: Number(total), sum, parts: new Map(), rowIndexes: [] })
    const snap = byId.get(id)
    snap.parts.set(Number(index), chunk)
    snap.rowIndexes.push(rowIndex)
  })
  const snapshots = [...byId.values()].map((snap) => {
    let backupData = null
    let complete = snap.parts.size === snap.total
    if (complete) {
      const text = Array.from({ length: snap.total }, (_, i) => snap.parts.get(i) ?? '').join('')
      if (checksum(text) === snap.sum) {
        try { backupData = JSON.parse(text) } catch { complete = false }
      } else {
        complete = false
      }
    }
    return { id: snap.id, savedAt: snap.savedAt, complete, backupData, rowIndexes: snap.rowIndexes }
  })
  return snapshots.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

async function tabInfo(sheetId, token) {
  const meta = await api('GET', `/${sheetId}?fields=sheets.properties(sheetId,title)`, token)
  return (meta.sheets ?? []).map((s) => s.properties)
}

async function ensureTab(sheetId, token) {
  const found = (await tabInfo(sheetId, token)).find((p) => p.title === TAB)
  if (found) return found.sheetId
  const res = await api('POST', `/${sheetId}:batchUpdate`, token, {
    requests: [{ addSheet: { properties: { title: TAB } } }],
  })
  return res.replies?.[0]?.addSheet?.properties?.sheetId
}

async function readRows(sheetId, token) {
  const data = await api('GET', `/${sheetId}/values/${encodeURIComponent(TAB)}!A:F`, token)
    .catch((e) => {
      if (String(e.message).includes('Unable to parse range')) return { values: [] }
      throw e
    })
  return data.values ?? []
}

// 連續的列合併成一段，從後面往前刪，這樣前面的列號才不會跑掉
function contiguousRanges(indexes) {
  const sorted = [...indexes].sort((a, b) => a - b)
  const ranges = []
  for (const i of sorted) {
    const last = ranges[ranges.length - 1]
    if (last && last.end === i) last.end = i + 1
    else ranges.push({ start: i, end: i + 1 })
  }
  return ranges.reverse()
}

export async function backupToSheet(token, sheetId, backupData, { now = () => new Date(), keep = KEEP } = {}) {
  const gid = await ensureTab(sheetId, token)
  const text = JSON.stringify(backupData)
  const chunks = splitChunks(text)
  const stamp = now().toISOString()
  const id = `${stamp}-${Math.random().toString(36).slice(2, 8)}`
  const sum = checksum(text)

  await api(
    'POST',
    `/${sheetId}/values/${encodeURIComponent(TAB)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    token,
    { values: chunks.map((chunk, i) => [id, stamp, i, chunks.length, sum, chunk]) }
  )

  // 清掉太舊的：只留最近 keep 份「完整」的，加上剛寫的這一份；壞掉或寫一半的也一併清掉
  const rows = await readRows(sheetId, token)
  const snapshots = assembleSnapshots(rows)
  const keepIds = new Set([id, ...snapshots.filter((s) => s.complete).slice(0, keep).map((s) => s.id)])
  const doomed = snapshots.filter((s) => !keepIds.has(s.id)).flatMap((s) => s.rowIndexes)
  if (doomed.length > 0 && gid != null) {
    await api('POST', `/${sheetId}:batchUpdate`, token, {
      requests: contiguousRanges(doomed).map((r) => ({
        deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', startIndex: r.start, endIndex: r.end } },
      })),
    })
  }
  return stamp
}

async function readLegacy(sheetId, token) {
  const data = await api('GET', `/${sheetId}/values/${encodeURIComponent(LEGACY_TAB)}!A1:B1`, token)
    .catch((e) => {
      if (String(e.message).includes('Unable to parse range')) return { values: [] }
      throw e
    })
  const row = data.values?.[0]
  if (!row?.[1]) return null
  try {
    return { id: 'legacy', savedAt: row[0], complete: true, backupData: JSON.parse(row[1]), legacy: true }
  } catch {
    return null
  }
}

// 列出可還原的備份（新到舊，只含完整、讀得回來的）。空陣列代表這個 Sheet 還沒備份過。
export async function listBackups(token, sheetId) {
  const rows = await readRows(sheetId, token)
  const found = assembleSnapshots(rows).filter((s) => s.complete)
  const legacy = await readLegacy(sheetId, token)
  return [...found, ...(legacy ? [legacy] : [])]
    .map(({ id, savedAt, backupData, legacy: isLegacy }) => ({ id, savedAt, backupData, legacy: !!isLegacy }))
}

// 回傳 null 代表這個 Sheet 裡還沒備份過
export async function restoreFromSheet(token, sheetId) {
  const [latest] = await listBackups(token, sheetId)
  return latest ? { savedAt: latest.savedAt, backupData: latest.backupData } : null
}
