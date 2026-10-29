// 設計規劃用的逼真資料（仿使用者提案截圖的量級：5 張卡、1 張逾期、訂閱＋分期、對帳差異、儲蓄）
const tx = (id, card, cardId, name, amount, date, postedDate, extra = {}) => ({
  id, name, amount, date, ...(postedDate && { postedDate }), category: extra.category ?? '消費', cardId, card,
  note: extra.imported === false ? (extra.note ?? '') : '自動匯入・' + card,
  ...(extra.imported === false ? {} : { source: { provider: 'card-import', permalink: id, bank: card } }),
  ...Object.fromEntries(Object.entries(extra).filter(([k]) => !['imported', 'note'].includes(k))),
})

const cards = [
  { id: 'cu', name: '國泰', color: '#0E9F8E', billingDay: 23, dueDay: 15, budget: 40000, last4: '1122', billingCycles: [
    { id: 'cu-sep', cycleKey: '2026-09', closeDate: '2026-09-27', dueDate: '2026-10-12', amount: 9068, estimatedAmount: 8580, amountIsActual: true, manuallyCalibrated: true, paid: false },
  ] },
  { id: 'tx', name: '台新', color: '#D9822B', billingDay: 2, dueDay: 15, budget: 20000, last4: '3344', billingCycles: [
    { id: 'tx-oct', cycleKey: '2026-10', closeDate: '2026-10-02', dueDate: '2026-10-17', amount: 1775, estimatedAmount: 1775, paid: false },
  ] },
  { id: 'yf', name: '永豐', color: '#C86E62', billingDay: 14, dueDay: 15, budget: 30000, last4: '5566', billingCycles: [
    { id: 'yf-sep', cycleKey: '2026-09', closeDate: '2026-09-14', dueDate: '2026-09-29', amount: 4320, estimatedAmount: 4320, paid: true, paidAt: '2026-09-28' },
  ] },
  { id: 'fj', name: '富邦J', color: '#2F6FEB', billingDay: 12, dueDay: 15, budget: 30000, last4: '7788', billingCycles: [] },
  { id: 'fm', name: '富邦M', color: '#A98274', billingDay: 12, dueDay: 15, budget: 30000, last4: '9900', billingCycles: [
    { id: 'fm-oct', cycleKey: '2026-10', closeDate: '2026-10-12', dueDate: '2026-10-28', amount: 2596, estimatedAmount: 2596, paid: false },
  ] },
]

const plans = [
  { id: 'p1', type: 'subscription', name: 'ChatGPT', card: '國泰', cardId: 'cu', currency: 'TWD', amount: 690, period: '月', billingDay: 9, active: true },
  { id: 'p2', type: 'subscription', name: 'Claude', card: '國泰', cardId: 'cu', currency: 'TWD', amount: 600, period: '月', billingDay: 18, active: true },
  { id: 'p3', type: 'subscription', name: 'Disney+', card: '富邦M', cardId: 'fm', currency: 'TWD', amount: 270, period: '月', billingDay: 20, active: true },
  { id: 'p4', type: 'subscription', name: 'Notion', card: '永豐', cardId: 'yf', currency: 'USD', amountOriginal: 10, feeRate: 1.5, amount: 330, period: '月', billingDay: 15, active: true },
  { id: 'i1', type: 'installment', name: '飛南山', card: '永豐', cardId: 'yf', currency: 'TWD', amount: 1458, period: '期', billingDay: 5, firstDueDate: '2026-01-05', paidCount: 9, totalCount: 19, totalAmount: 27702 },
  { id: 'i2', type: 'installment', name: '飛南山2', card: '永豐', cardId: 'yf', currency: 'TWD', amount: 765, period: '期', billingDay: 5, firstDueDate: '2026-04-05', paidCount: 6, totalCount: 18 },
  { id: 'i3', type: 'installment', name: '印刷橘子數位印藝文化事業有限公司', card: '國泰', cardId: 'cu', currency: 'TWD', amount: 3003, period: '期', billingDay: 23, firstDueDate: '2026-08-23', paidCount: 2, totalCount: 3 },
  { id: 'i4', type: 'installment', name: '新光人壽', card: '永豐', cardId: 'yf', currency: 'TWD', amount: 2017, period: '期', billingDay: 10, firstDueDate: '2026-03-10', paidCount: 7, totalCount: 15 },
]

const transactions = [
  // 國泰
  tx('c1', '國泰', 'cu', 'OPENAI *CHATGPT SUBSCR', 690, '2026-10-09', '2026-10-11', { category: '訂閱' }),
  tx('c2', '國泰', 'cu', '全聯', 540, '2026-10-03', '2026-10-05', { category: '日常' }),
  tx('c3', '國泰', 'cu', '自動匯入・國泰世華', 1280, '2026-10-06', '2026-10-08', { category: '消費' }),
  tx('c4', '國泰', 'cu', '好市多', 3260, '2026-10-10', null, { category: '日常' }),
  tx('c5', '國泰', 'cu', '自動匯入・國泰世華', 450, '2026-10-12', null, { category: '消費' }),
  tx('c6', '國泰', 'cu', '加油', 900, '2026-09-29', '2026-10-01', { category: '交通' }),
  tx('c7', '國泰', 'cu', '繳款', -9068, '2026-10-12', '2026-10-12', { category: '繳款', imported: false, note: '' }),
  tx('c8', '國泰', 'cu', 'Anthropic Claude', 600, '2026-09-18', '2026-09-20', { category: '訂閱' }),
  // 台新
  tx('t1', '台新', 'tx', '誠品', 1500, '2026-09-20', '2026-09-22', { category: '購物' }),
  tx('t2', '台新', 'tx', '加油', 800, '2026-10-02', '2026-10-04', { category: '交通' }),
  tx('t3', '台新', 'tx', '餐飲', 350, '2026-10-10', '2026-10-11', { category: '餐飲' }),
  tx('t4', '台新', 'tx', '自動匯入・台新', 1775, '2026-10-05', null, { category: '消費' }),
  // 永豐
  tx('y1', '永豐', 'yf', '星巴克', 160, '2026-10-01', '2026-10-03', { category: '餐飲' }),
  tx('y2', '永豐', 'yf', 'Uber Eats', 428, '2026-10-07', '2026-10-09', { category: '餐飲' }),
  tx('y3', '永豐', 'yf', '蝦皮購物', 1635, '2026-10-11', null, { category: '購物' }),
  // 富邦
  tx('f1', '富邦M', 'fm', 'Disney Plus', 270, '2026-10-09', '2026-10-13', { category: '訂閱' }),
  tx('f2', '富邦M', 'fm', '全家', 90, '2026-10-11', null, { category: '日常' }),
  tx('f3', '富邦M', 'fm', 'momo 退款', -1254, '2026-10-02', '2026-10-04', { category: '購物', kind: 'refund' }),
  tx('f4', '富邦M', 'fm', 'momo', 1254, '2026-09-17', '2026-09-21', { category: '購物' }),
  tx('f5', '富邦M', 'fm', '康是美', 580, '2026-09-21', '2026-09-23', { category: '日常' }),
  tx('f6', '富邦M', 'fm', '', 2596, '2026-09-25', '2026-09-27', { category: '購物', imported: false, note: '手動記' }),
  tx('j1', '富邦J', 'fj', '麥當勞', 189, '2026-10-12', null, { category: '餐飲' }),
  tx('j2', '富邦J', 'fj', '高鐵', 1490, '2026-10-04', '2026-10-06', { category: '交通' }),
  tx('j3', '富邦J', 'fj', '電影', 320, '2026-10-08', '2026-10-10', { category: '娛樂' }),
]

const checklist = [
  { id: 'k1', name: '房租', amount: 12000, day: 5, done: true },
  { id: 'k2', name: '水電瓦斯', amount: 1500, day: 15, done: true },
  { id: 'k3', name: '電信費', amount: 999, day: 20, done: false },
  { id: 'k4', name: '保險', amount: 3000, day: 25, done: true },
]
const savings = [
  { id: 's1', name: '學費', target: 60000, saved: 18000, monthly: 3000, linkedChecklistId: null, linkedCardId: null, countInEssential: true, entries: [
    { id: 'e1', type: 'in', amount: 3000, date: '9/5', note: '每月撥入', source: 'manual' },
    { id: 'e2', type: 'in', amount: 3000, date: '10/5', note: '每月撥入', source: 'manual' },
  ] },
  { id: 's2', name: '國泰卡費預留', target: 0, saved: 9000, monthly: 4000, linkedChecklistId: null, linkedCardId: 'cu', countInEssential: false, entries: [] },
]

const data = {
  cards, plans, transactions, checklist, checklistMonth: '2026-9', income: 33996,
  fxSettings: { usdRate: 32.5, feeRate: 1.5 }, savings,
  googleSync: { clientId: '12345-abc.apps.googleusercontent.com', sheetId: 'sheet123', lastSyncAt: Date.parse('2026-09-28T10:00:00Z'), lastSyncCount: 40 },
  cardImport: { sheetId: 'imp123', bankCardMap: { 富邦: 'fm', 永豐: 'yf', 國泰世華: 'cu' }, importedKeys: [], lastImportAt: Date.parse('2026-10-12T14:00:00Z'), lastImportCount: 5, lastImportUpdatedCount: 2, lastImportDuplicateCount: 12, lastImportSkippedUnmapped: 2, lastImportInvalidCount: 1, lastImportRowCount: 22,
    lastImportBankCounts: [{ bank: '富邦', count: 9 }, { bank: '永豐', count: 6 }, { bank: '國泰世華', count: 7 }],
    lastImportSkippedRows: [
      { date: '10/09', bank: '台新', cardLast4: '3344', amount: 640, merchant: '誠品', reason: 'no-bank-mapping' },
      { date: '10/11', bank: '富邦', cardLast4: '0000', amount: 120, merchant: '', reason: 'last4-unknown' },
    ] },
}
module.exports = { data, cards, plans, transactions }
if (require.main === module) console.log(JSON.stringify(data))
