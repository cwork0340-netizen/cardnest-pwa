// 讀取 card-import Apps Script（projects/card-import）產生的「CardNest 消費記錄」Sheet，
// 把銀行自動收集的刷卡通知轉成 CardNest 的刷卡記錄。跟 googleSheetSync.js 共用同一組
// OAuth（scope 都是 spreadsheets），差別只在這支是讀取，不是寫入。
const SHEET_TAB = '消費紀錄'
// Sheet 欄位順序：
// 匯入時間、銀行、卡末四碼、消費日期、金額、商店/交易內容、原始信件連結、
// 入帳日（選填）、交易類型（選填）

export async function fetchImportRows({ accessToken, sheetId }) {
  const range = `${encodeURIComponent(SHEET_TAB)}!A2:I2000`
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error?.message || '讀取失敗，請確認 Sheet ID 跟授權帳號是否正確')
  }
  const data = await res.json()
  const rows = data.values ?? []
  return rows
    .filter((r) => r[6]) // 一定要有原始信件連結才能去重複，沒有就跳過
    .map((r) => ({
      bank: r[1] ?? '',
      cardLast4: r[2] ?? '',
      rawDate: r[3] ?? '',
      amount: Number(String(r[4] ?? '0').replace(/,/g, '')),
      merchant: r[5] ?? '',
      permalink: r[6],
      rawPostedDate: r[7] ?? '',
      transactionType: r[8] ?? '',
    }))
}

export function normalizeLast4(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length === 4 ? digits : ''
}

export function isUsableImportRow(row) {
  return Boolean(
    row?.permalink
    && Number.isFinite(Number(row.amount))
    && Number(row.amount) !== 0
    && /^\d{4}-\d{2}-\d{2}$/.test(toISODate(row.rawDate)),
  )
}

export function importedPostedDate(row) {
  const date = toISODate(row?.rawPostedDate)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''
}

export function findImportedTransaction({ row, card, transactions = [] }) {
  const byPermalink = transactions.filter((tx) => tx?.source?.permalink === row?.permalink)
  if (byPermalink.length === 1) return byPermalink[0]

  const consumedOn = toISODate(row?.rawDate)
  const candidates = transactions.filter((tx) => {
    const cameFromImport = tx?.source?.provider === 'card-import' || String(tx?.note ?? '').includes('自動匯入')
    const onSameCard = tx?.cardId === card?.id || tx?.card === card?.name
    return cameFromImport
      && onSameCard
      && Number(tx?.amount) === Number(row?.amount)
      && tx?.date === consumedOn
  })
  return candidates.length === 1 ? candidates[0] : null
}

// Prefer a card's last four digits. Bank-only mapping is retained for existing
// users, but only as a fallback when no last-four value is available.
export function resolveImportedCard({ row, cards, bankCardMap = {} }) {
  const last4 = normalizeLast4(row?.cardLast4)
  if (last4) {
    const matches = cards.filter((card) => normalizeLast4(card.last4) === last4)
    return matches.length === 1 ? matches[0] : null
  }

  const mapped = bankCardMap[row?.bank]
  return cards.find((card) => card.id === mapped || card.name === mapped) ?? null
}

// Sheet 上的日期可能是 2026/04/07、2026-06-30 等格式，統一轉成 CardNest 慣用的 "M/D"
export function toDisplayDate(rawDate) {
  const parts = String(rawDate).split(/[/-]/).map(Number)
  if (parts.length < 3 || parts.some(Number.isNaN)) return rawDate
  const [, m, d] = parts
  return `${m}/${d}`
}

export function toISODate(rawDate) {
  const parts = String(rawDate).split(/[/-]/).map(Number)
  if (parts.length < 3 || parts.some(Number.isNaN)) return rawDate
  const [y, m, d] = parts
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
