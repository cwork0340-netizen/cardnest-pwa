import { ensureInstallmentOccurrences } from './installmentCycles'

// 這個 App 裡的日期有三種來源格式：使用者手動輸入或舊資料的 "M/D"（沒有年份）、
// <input type="date"> 的 "YYYY-MM-DD"，以及 card-import Sheet 的 "YYYY/MM/DD"。
// 三種都要在這一個函式裡收斂——以前 importSheetSync.js 另外寫了一份同名的，
// 各自只認得對方不認得的格式，而且認不得時是「安靜地把原字串吐回去」：
// 日期沒轉成功不會報錯，只會讓那筆交易落不進任何帳單週期，帳就少一筆。
//
// 注意缺值會回傳「今天」而不是空字串或 null。呼叫端如果需要分辨「沒有這個日期」
// （例如 Sheet 上選填的入帳日），必須自己先擋掉空值，不能靠這裡。
export function toISODate(value, near = new Date()) {
  if (!value) return ymd(near)
  const text = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text

  // 有年份：2026/8/3、2026-8-3、2026/08/03 一律補成 YYYY-MM-DD
  const full = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (full) {
    return `${full[1]}-${String(Number(full[2])).padStart(2, '0')}-${String(Number(full[3])).padStart(2, '0')}`
  }

  const match = text.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!match) return value

  const month = Number(match[1])
  const day = Number(match[2])
  let candidate = new Date(near.getFullYear(), month - 1, day)
  const diffMonths = (candidate.getFullYear() - near.getFullYear()) * 12 + (candidate.getMonth() - near.getMonth())
  if (diffMonths > 6) candidate = new Date(candidate.getFullYear() - 1, candidate.getMonth(), candidate.getDate())
  if (diffMonths < -6) candidate = new Date(candidate.getFullYear() + 1, candidate.getMonth(), candidate.getDate())
  return ymd(candidate)
}

export function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseISODate(value, near = new Date()) {
  const iso = toISODate(value, near)
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}


export function isSameMonth(value, from = new Date()) {
  const date = parseISODate(value, from)
  return !!date && date.getFullYear() === from.getFullYear() && date.getMonth() === from.getMonth()
}

export function resolveCardId(item, cards) {
  if (item?.cardId) return item.cardId
  const cardName = item?.card
  return cards.find((card) => card.name === cardName)?.id ?? null
}

export function getCardName(item, cards) {
  const cardId = resolveCardId(item, cards)
  return cards.find((card) => card.id === cardId)?.name ?? item?.card ?? ''
}

export function matchesCard(item, card) {
  if (!item || !card) return false
  if (item.cardId) return item.cardId === card.id
  return item.card === card.name
}

export function normalizeFinanceData(data, near = new Date()) {
  const cards = Array.isArray(data?.cards) ? data.cards.map((card) => ({
    ...card,
    id: card.id ?? crypto.randomUUID(),
  })) : []

  const withCard = (item) => {
    const cardId = resolveCardId(item, cards)
    const card = cards.find((candidate) => candidate.id === cardId)
    return {
      ...item,
      ...(cardId && { cardId }),
      card: item.card ?? card?.name ?? '',
    }
  }

  return {
    ...data,
    cards,
    plans: Array.isArray(data?.plans) ? data.plans.map(withCard) : [],
    transactions: Array.isArray(data?.transactions)
      ? data.transactions.map((tx) => ({
        ...withCard(tx),
        amount: Number(tx.amount) || 0,
        date: toISODate(tx.date, near),
        ...(tx.postedDate && { postedDate: toISODate(tx.postedDate, near) }),
      }))
      : [],
  }
}

export function transactionCycleDate(tx) {
  return tx?.postedDate ?? tx?.date
}

export function isCreditCardPayment(tx) {
  const amount = Number(tx?.amount) || 0
  if (amount >= 0) return false
  const text = `${tx?.name ?? ''} ${tx?.category ?? ''} ${tx?.note ?? ''}`.toLowerCase()
  return /繳款|付款|條碼繳款|card payment|bill payment|payment/.test(text)
}

export function isInstallmentConversionCredit(tx) {
  const amount = Number(tx?.amount) || 0
  if (amount >= 0) return false
  const text = `${tx?.name ?? ''} ${tx?.category ?? ''} ${tx?.note ?? ''}`.toLowerCase()
  return /轉刷卡樂|分期|installment/.test(text)
}

export function isBillableTransaction(tx) {
  // Original swipes remain as audit records after conversion. The installment
  // plan, rather than the original one-off swipe, is what belongs in budget totals.
  return !tx?.installmentPlanId && !isCreditCardPayment(tx) && !isInstallmentConversionCredit(tx)
}

export function transactionRepresentsPlan(tx, plan, cards) {
  if (!matchesCard(tx, { id: resolveCardId(plan, cards), name: plan.card })) return false
  if (Number(tx.amount) !== Number(plan.amount)) return false

  const txName = String(tx.name ?? '').toLowerCase()
  const txNote = String(tx.note ?? '').toLowerCase()
  const planName = String(plan.name ?? '').toLowerCase()
  if (planName && (txName.includes(planName) || txNote.includes(planName))) return true

  const category = String(tx.category ?? '').toLowerCase()
  return category.includes(plan.type)
}

export function planAmountNotRecorded({ plan, transactions, cards, windowStart, windowEnd }) {
  const represented = transactions.some((tx) => {
    const date = parseISODate(tx.date, windowEnd)
    return date && date > windowStart && date <= windowEnd && transactionRepresentsPlan(tx, plan, cards)
  })
  return represented ? 0 : Number(plan.amount) || 0
}

export function hasUnpaidInstallmentDueInWindow(plan, windowStart, windowEnd) {
  return ensureInstallmentOccurrences(plan, { today: windowStart }).some((occurrence) => {
    if (occurrence.paid) return false
    const dueDate = parseISODate(occurrence.dueDate, windowEnd)
    return dueDate && dueDate > windowStart && dueDate <= windowEnd
  })
}

export function installmentAmountNotRecordedInWindow(args) {
  const occurrence = ensureInstallmentOccurrences(args.plan, { today: args.windowStart }).find((item) => {
    if (item.paid) return false
    const dueDate = parseISODate(item.dueDate, args.windowEnd)
    return dueDate && dueDate > args.windowStart && dueDate <= args.windowEnd
  })
  if (!occurrence) return 0
  const represented = args.transactions.some((tx) => {
    const date = parseISODate(tx.date, args.windowEnd)
    return date && date > args.windowStart && date <= args.windowEnd
      && Number(tx.amount) === Number(occurrence.amount)
      && transactionRepresentsPlan(tx, { ...args.plan, amount: occurrence.amount }, args.cards)
  })
  return represented ? 0 : Number(occurrence.amount) || 0
}
