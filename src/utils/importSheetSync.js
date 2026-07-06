// 讀取 card-import Apps Script（projects/card-import）產生的「CardNest 消費記錄」Sheet，
// 把銀行自動收集的刷卡通知轉成 CardNest 的刷卡記錄。跟 googleSheetSync.js 共用同一組
// OAuth（scope 都是 spreadsheets），差別只在這支是讀取，不是寫入。
const SHEET_TAB = '消費紀錄'
// Sheet 欄位順序：匯入時間、銀行、卡末四碼、消費日期、金額、商店/交易內容、原始信件連結

export async function fetchImportRows({ accessToken, sheetId }) {
  const range = `${encodeURIComponent(SHEET_TAB)}!A2:G2000`
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
    }))
}

// Sheet 上的日期可能是 2026/04/07、2026-06-30 等格式，統一轉成 CardNest 慣用的 "M/D"
export function toDisplayDate(rawDate) {
  const parts = String(rawDate).split(/[/-]/).map(Number)
  if (parts.length < 3 || parts.some(Number.isNaN)) return rawDate
  const [, m, d] = parts
  return `${m}/${d}`
}
