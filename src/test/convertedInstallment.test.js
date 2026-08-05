import { describe, expect, it } from 'vitest'
import { ensureInstallmentOccurrences } from '../utils/installmentCycles'
import { isBillableTransaction } from '../utils/financeData'

describe('converted installment audit records', () => {
  it('keeps the original swipe outside budget totals once linked to a plan', () => {
    expect(isBillableTransaction({ amount: 9009, installmentPlanId: 'plan-1' })).toBe(false)
    expect(isBillableTransaction({ amount: 9009 })).toBe(true)
  })

  it('puts any rounding remainder into the final installment', () => {
    const occurrences = ensureInstallmentOccurrences({
      type: 'installment', amount: 333, totalAmount: 1000, totalCount: 3,
      billingDay: 10, firstDueDate: '2026-08-10', occurrences: [
        { id: 'one', dueDate: '2026-08-10', amount: 333, paid: true },
        { id: 'two', dueDate: '2026-09-10', amount: 333, paid: true },
      ],
    }, { today: new Date(2026, 8, 11) })

    expect(occurrences[2].amount).toBe(334)
    expect(occurrences.reduce((sum, item) => sum + item.amount, 0)).toBe(1000)
  })
})
