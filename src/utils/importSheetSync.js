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

// 「這筆是信件匯入來的嗎」只能有一份答案。匯入時會同時寫 source.provider 和
// 「自動匯入・銀行」的備註，但備註是使用者可以自己改的——只看備註的話，改過備註的
// 那筆就會從待對帳清單、對帳提醒、列表標籤裡一起消失，明明它還是匯入來的。
// source 才是機器寫的憑據，備註只是升級前舊資料的退路。
export function isImportedTransaction(tx) {
  return tx?.source?.provider === 'card-import' || String(tx?.note ?? '').includes('自動匯入')
}

export function isPendingReconciliation(tx) {
  return isImportedTransaction(tx) && !tx?.postedDate
}

export function findImportedTransaction({ row, card, transactions = [] }) {
  const byPermalink = transactions.filter((tx) => tx?.source?.permalink === row?.permalink)
  if (byPermalink.length === 1) return byPermalink[0]

  const consumedOn = toISODate(row?.rawDate)
  const candidates = transactions.filter((tx) => {
    const cameFromImport = isImportedTransaction(tx)
    const onSameCard = tx?.cardId === card?.id || tx?.card === card?.name
    return cameFromImport
      && onSameCard
      && Number(tx?.amount) === Number(row?.amount)
      && tx?.date === consumedOn
  })
  return candidates.length === 1 ? candidates[0] : null
}

function mappedCardFor({ row, cards, bankCardMap }) {
  const mapped = bankCardMap?.[row?.bank]
  return cards.find((card) => card.id === mapped || card.name === mapped) ?? null
}

// 這一列為什麼配到／配不到卡片。匯入畫面只給一個「N 筆未對應卡片」的數字時，
// 使用者沒辦法判斷是「Apps Script 沒把這家銀行的信解析進 Sheet」還是「卡片沒填末四碼」，
// 所以配對結果一律附上理由，讓設定頁可以照理由給出對應的下一步。
// 配對失敗以外的另一種跳過：這一列本身就不能用（日期壞掉、金額 0）。
export const SKIP_REASON_INVALID_ROW = 'invalid-row'

export const CARD_MATCH_REASON = {
  LAST4: 'last4',
  BANK: 'bank',
  BANK_FALLBACK: 'bank-fallback',
  LAST4_AMBIGUOUS: 'last4-ambiguous',
  LAST4_UNKNOWN: 'last4-unknown',
  NO_BANK_MAPPING: 'no-bank-mapping',
}

// Prefer a card's last four digits. Bank-only mapping stays as a fallback, but it
// must never override a last-four value we can actually check: if the mapped card
// has its own last four digits and they differ, the row belongs to some other card
// the user has not added yet, and guessing would corrupt that card's estimate.
export function resolveImportedCardResult({ row, cards, bankCardMap = {} }) {
  const last4 = normalizeLast4(row?.cardLast4)
  if (last4) {
    const matches = cards.filter((card) => normalizeLast4(card.last4) === last4)
    if (matches.length === 1) return { card: matches[0], reason: CARD_MATCH_REASON.LAST4 }
    if (matches.length > 1) return { card: null, reason: CARD_MATCH_REASON.LAST4_AMBIGUOUS }

    // 沒有任何一張卡認領這組末四碼。只有在「銀行對應到的那張卡自己也還沒填末四碼」時
    // 才退回銀行對應——那代表 App 手上沒有可以反駁的資訊，不是配到了別張卡。
    const fallback = mappedCardFor({ row, cards, bankCardMap })
    if (fallback && !normalizeLast4(fallback.last4)) {
      return { card: fallback, reason: CARD_MATCH_REASON.BANK_FALLBACK }
    }
    return { card: null, reason: CARD_MATCH_REASON.LAST4_UNKNOWN }
  }

  const card = mappedCardFor({ row, cards, bankCardMap })
  return card
    ? { card, reason: CARD_MATCH_REASON.BANK }
    : { card: null, reason: CARD_MATCH_REASON.NO_BANK_MAPPING }
}

export function resolveImportedCard(args) {
  return resolveImportedCardResult(args).card
}

// Sheet 上實際抓到幾列、分別屬於哪家銀行。用來分辨「這家銀行的信根本沒進 Sheet」
// （Apps Script 解析問題）和「有進 Sheet 但被 App 跳過」（末四碼／對應設定問題）。
export function summarizeImportRowsByBank(rows = []) {
  const counts = new Map()
  rows.forEach((row) => {
    const bank = String(row?.bank ?? '').trim() || '未填銀行'
    counts.set(bank, (counts.get(bank) ?? 0) + 1)
  })
  return [...counts.entries()]
    .map(([bank, count]) => ({ bank, count }))
    .sort((a, b) => b.count - a.count)
}

// 被跳過的那一列長什麼樣子，讓使用者可以直接回 Sheet／信箱裡找到它
export function describeSkippedRow({ row, reason }) {
  return {
    bank: row?.bank ?? '',
    cardLast4: normalizeLast4(row?.cardLast4),
    date: toISODate(row?.rawDate),
    amount: Number(row?.amount) || 0,
    merchant: row?.merchant ?? '',
    reason,
  }
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
