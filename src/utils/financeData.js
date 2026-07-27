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
      ? data.transactions.map((tx) => ({ ...withCard(tx), date: toISODate(tx.date, near) }))
      : [],
  }
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
