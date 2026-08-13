export function buildCardForecast(cards = [], plans = [], { income = 0, essentialTotal = 0 } = {}) {
  const commitments = plans
    .filter((plan) => plan.type === 'subscription'
      ? (plan.active ?? true)
      : Number(plan.paidCount ?? 0) < Number(plan.totalCount ?? 0))
    .reduce((total, plan) => total + Number(plan.amount || 0), 0)

  const perCard = cards.map((card) => ({
    id: card.id,
    name: card.name,
    color: card.color,
    statementDue: Number(card.unpaidTotal || 0),
    nextEstimate: Number(card.spendingWarningTotal ?? (
      Number(card.currentCycleAmount || 0)
      + Number(card.subsOnCard || 0)
      + Number(card.instOnCard || 0)
    )),
  }))

  const statementDue = perCard.reduce((total, card) => total + card.statementDue, 0)
  const currentCyclePurchases = cards.reduce((total, card) => total + Number(card.currentCyclePurchaseAmount ?? card.currentCycleAmount ?? 0), 0)
  const nextEstimate = perCard.reduce((total, card) => total + card.nextEstimate, 0)

  return {
    statementDue,
    nextEstimate,
    commitments,
    currentCyclePurchases,
    hasIncome: Number(income) > 0,
    safeToSpend: Math.max(0, Number(income) - Number(essentialTotal) - statementDue - currentCyclePurchases - commitments),
    overCommitted: Math.max(0, Number(essentialTotal) + statementDue + currentCyclePurchases + commitments - Number(income)),
    perCard,
  }
}
