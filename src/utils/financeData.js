import { ensureInstallmentOccurrences } from './installmentCycles'
import { clampDayInMonth, nextOccurrence } from './recurrence'

export function toISODate(value, near = new Date()) {
  if (!value) return ymd(near)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const match = String(value).match(/^(\d{1,2})\/(\d{1,2})$/)
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

export function toDisplayDate(value, near = new Date()) {
  const date = parseISODate(value, near)
  if (!date) return value ?? ''
  return `${date.getMonth() + 1}/${date.getDate()}`
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

// 「最近一次已經過去的週期」錨點，用來回推歷史已繳期數（跟 installmentCycles.js
// 的 currentAnchor 同一套邏輯）
function currentBillingAnchor(billingDay, near) {
  const y = near.getFullYear(), m = near.getMonth(), d = near.getDate()
  return d >= billingDay ? new Date(y, m, billingDay) : new Date(y, m - 1, billingDay)
}

function stepMonths(date, billingDay, delta) {
  let cursor = date
  const step = delta > 0 ? 1 : -1
  for (let i = 0; i < Math.abs(delta); i++) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth() + step
    const nextY = y + (m < 0 ? -1 : m > 11 ? 1 : 0)
    const nextM = ((m % 12) + 12) % 12
    cursor = new Date(nextY, nextM, clampDayInMonth(nextY, nextM, billingDay))
  }
  return cursor
}

// 分期舊資料升級：照日期重新算「照理說」已經過去幾期，取代舊的手動點擊計數
// paidCount——只算嚴格早於 near（今天）的期別，今天或之後到期的那一期留給
// 新的材料化機制去產生真實刷卡記錄，不會被這裡搶先算成「已繳」。
// 注意：parseISODate 對缺值會直接回傳「今天」而不是 null，所以一定要先看
// plan.firstDueDate 本身在不在，不能靠 parseISODate 的回傳值判斷有沒有這個欄位。
function migrateInstallmentPlan(plan, near) {
  const total = Number(plan.totalCount) || 0
  const billingDay = Number(plan.billingDay) || 1

  if (plan.firstDueDate) {
    let count = 0
    let cursor = parseISODate(plan.firstDueDate, near)
    while (cursor && count < total && cursor < near) {
      count++
      cursor = stepMonths(cursor, billingDay, 1)
    }
    return { ...plan, materializeFrom: ymd(near), legacyPaidCount: count }
  }

  // 更舊的資料連 firstDueDate 都沒有：沿用舊的 paidCount，並回推出對應的第一期
  // 到期日「固定」存起來——不能每次都用「今天」現算，不然同一期的到期日
  // 會隨著開 App 的日子飄動，材料化出來的期別也會跟著變。
  const legacyPaidCount = Math.min(Number(plan.paidCount) || 0, total)
  const firstDueDate = legacyPaidCount > 0
    ? ymd(stepMonths(currentBillingAnchor(billingDay, near), billingDay, -(legacyPaidCount - 1)))
    : ymd(nextOccurrence(billingDay, new Date(near.getFullYear(), near.getMonth(), near.getDate() + 1)))
  return { ...plan, materializeFrom: ymd(near), legacyPaidCount, firstDueDate }
}

// 舊 plan 沒有 materializeFrom 就代表這是升級前建立的——補上 materializeFrom
// （防止材料化機制回頭捏造這個功能上線前的歷史交易）跟 legacyPaidCount
// （分期專用，取代 paidCount 的意義：這個功能上線前已經繳完、查無交易的期數）。
function migratePlan(plan, near) {
  if (plan.materializeFrom) return plan
  if (plan.type === 'installment') return migrateInstallmentPlan(plan, near)
  return { ...plan, materializeFrom: ymd(near) }
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
    plans: Array.isArray(data?.plans) ? data.plans.map((p) => migratePlan(withCard(p), near)) : [],
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
  return !isCreditCardPayment(tx) && !isInstallmentConversionCredit(tx)
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
    const date = parseISODate(transactionCycleDate(tx), windowEnd)
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
  return hasUnpaidInstallmentDueInWindow(args.plan, args.windowStart, args.windowEnd)
    ? planAmountNotRecorded(args)
    : 0
}
