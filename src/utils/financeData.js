import { ensureInstallmentOccurrences } from './installmentCycles'

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

function normalizePlanText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
}

function amountCloseEnough(txAmount, planAmount) {
  const tx = Number(txAmount)
  const plan = Number(planAmount)
  if (!Number.isFinite(tx) || !Number.isFinite(plan)) return false
  const diff = Math.abs(tx - plan)
  return diff === 0 || diff <= Math.max(20, Math.round(plan * 0.03))
}

function planNameMatchesTransaction(tx, plan) {
  const txText = normalizePlanText(`${tx?.name ?? ''} ${tx?.note ?? ''} ${tx?.category ?? ''}`)
  const planText = normalizePlanText(plan?.name)
  if (!txText || !planText) return false
  if (txText.includes(planText) || planText.includes(txText)) return true

  const aliases = [
    ['chatgpt', 'openai'],
    ['claude', 'anthropic'],
    ['googleone', 'google'],
    ['disneyplus', 'disney'],
  ]

  return aliases.some(([planAlias, txAlias]) => (
    planText.includes(planAlias) && txText.includes(txAlias)
  ))
}

export function transactionRepresentsPlan(tx, plan, cards) {
  if (!matchesCard(tx, { id: resolveCardId(plan, cards), name: plan.card })) return false
  if (!amountCloseEnough(tx.amount, plan.amount)) return false

  if (planNameMatchesTransaction(tx, plan)) return true

  const category = String(tx.category ?? '').toLowerCase()
  return category.includes(plan.type) || (plan.type === 'subscription' && /訂閱|subscription/.test(category))
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
