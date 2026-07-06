const SHEET_TITLE = 'CardNest 帳務'
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

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

export async function findOrCreateSpreadsheet(token, existingId) {
  if (existingId) {
    try {
      await api('GET', `/${existingId}?fields=spreadsheetId`, token)
      return existingId
    } catch { /* fall through */ }
  }
  const data = await api('POST', '', token, {
    properties: { title: SHEET_TITLE },
    sheets: [
      { properties: { title: 'Cards' } },
      { properties: { title: 'Plans' } },
      { properties: { title: 'Transactions' } },
      { properties: { title: 'Settings' } },
    ],
  })
  return data.spreadsheetId
}

const CARD_KEYS = ['id', 'name', 'color', 'billingDay', 'dueDay', 'budget']
const PLAN_KEYS = ['id', 'type', 'name', 'card', 'amount', 'period', 'nextDate', 'daysLeft', 'paidCount', 'totalCount', 'paid', 'currency', 'amountOriginal', 'usdRate', 'feeRate']
const TX_KEYS = ['id', 'date', 'category', 'name', 'amount', 'card', 'note']

function toRows(keys, items) {
  return [keys, ...items.map(item => keys.map(k => item[k] ?? ''))]
}

function fromRows(rows) {
  if (!rows || rows.length < 2) return []
  const [headers, ...data] = rows
  return data.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])))
}

export async function syncToSheets(token, sheetId, { cards, plans, transactions, fxSettings }) {
  await api('POST', `/${sheetId}/values:batchClear`, token, {
    ranges: ['Cards!A:Z', 'Plans!A:Z', 'Transactions!A:Z', 'Settings!A:Z'],
  })
  await api('POST', `/${sheetId}/values:batchUpdate`, token, {
    valueInputOption: 'RAW',
    data: [
      { range: 'Cards!A1', values: toRows(CARD_KEYS, cards) },
      { range: 'Plans!A1', values: toRows(PLAN_KEYS, plans) },
      { range: 'Transactions!A1', values: toRows(TX_KEYS, transactions) },
      { range: 'Settings!A1', values: [['key', 'value'], ['usdRate', fxSettings.usdRate], ['feeRate', fxSettings.feeRate]] },
    ],
  })
}

export async function loadFromSheets(token, sheetId) {
  const data = await api('GET', `/${sheetId}/values:batchGet?ranges=Cards!A:Z&ranges=Plans!A:Z&ranges=Transactions!A:Z&ranges=Settings!A:Z`, token)
  const [cardsRows, plansRows, txRows, settingsRows] = (data.valueRanges ?? []).map(r => r.values)

  const cards = fromRows(cardsRows).map(c => ({
    ...c, billingDay: Number(c.billingDay), dueDay: Number(c.dueDay), budget: Number(c.budget),
  }))

  const plans = fromRows(plansRows).map(p => ({
    ...p,
    amount: Number(p.amount),
    daysLeft: Number(p.daysLeft),
    paidCount: Number(p.paidCount),
    totalCount: Number(p.totalCount),
    paid: p.paid === 'true',
    amountOriginal: p.amountOriginal ? Number(p.amountOriginal) : undefined,
    usdRate: p.usdRate ? Number(p.usdRate) : undefined,
    feeRate: p.feeRate ? Number(p.feeRate) : undefined,
  }))

  const transactions = fromRows(txRows).map(tx => ({ ...tx, amount: Number(tx.amount) }))

  const fxSettings = { usdRate: 32.5, feeRate: 1.5 }
  fromRows(settingsRows).forEach(({ key, value }) => {
    if (key === 'usdRate') fxSettings.usdRate = Number(value)
    if (key === 'feeRate') fxSettings.feeRate = Number(value)
  })

  return { cards, plans, transactions, fxSettings }
}

export function hasSheetData(data) {
  return data.cards.length > 0 || data.plans.length > 0 || data.transactions.length > 0
}
