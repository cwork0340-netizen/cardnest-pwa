import { describe, expect, it } from 'vitest'
import { buildCardForecast } from '../utils/cardForecast'

describe('card forecast summary', () => {
  it('keeps due bills, next-cycle estimates, and monthly commitments separate', () => {
    const result = buildCardForecast([
      { id: 'a', name: 'A', unpaidTotal: 1200, currentCycleAmount: 600, subsOnCard: 200, instOnCard: 300 },
      { id: 'b', name: 'B', unpaidTotal: 800, currentCycleAmount: 100, subsOnCard: 0, instOnCard: 0 },
    ], [
      { type: 'subscription', amount: 200, active: true },
      { type: 'installment', amount: 300, paidCount: 2, totalCount: 12 },
      { type: 'installment', amount: 900, paidCount: 3, totalCount: 3 },
    ], { income: 10000, essentialTotal: 2000 })

    expect(result.statementDue).toBe(2000)
    expect(result.nextEstimate).toBe(1200)
    expect(result.commitments).toBe(500)
    expect(result.safeToSpend).toBe(4800)
    expect(result.overCommitted).toBe(0)
  })

  it('does not report a spend limit until income is available', () => {
    const result = buildCardForecast([], [], { income: 0, essentialTotal: 2000 })

    expect(result.hasIncome).toBe(false)
    expect(result.safeToSpend).toBe(0)
  })
})
