import { describe, expect, it } from 'vitest'
import { ensureInstallmentOccurrences } from '../utils/installmentCycles'
import { installmentAmountNotRecordedInWindow } from '../utils/financeData'

describe('installment start cycle', () => {
  it('starts a converted installment from the stored first due date', () => {
    const occurrences = ensureInstallmentOccurrences({
      type: 'installment',
      name: '9009 installment',
      amount: 3003,
      billingDay: 12,
      firstDueDate: '2026-07-12',
      paidCount: 0,
      totalCount: 3,
    }, { today: new Date(2026, 5, 12) })

    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]).toMatchObject({
      dueDate: '2026-07-12',
      amount: 3003,
      paid: false,
    })
  })

  it('does not count a next-cycle installment in the current month', () => {
    const amount = installmentAmountNotRecordedInWindow({
      plan: {
        type: 'installment',
        name: '9009 installment',
        amount: 3003,
        billingDay: 12,
        firstDueDate: '2026-07-12',
        paidCount: 0,
        totalCount: 3,
      },
      transactions: [],
      cards: [],
      windowStart: new Date(2026, 5, 1),
      windowEnd: new Date(2026, 5, 30),
    })

    expect(amount).toBe(0)
  })

  it('counts the installment once the first due date is in the active month', () => {
    const amount = installmentAmountNotRecordedInWindow({
      plan: {
        type: 'installment',
        name: '9009 installment',
        amount: 3003,
        billingDay: 12,
        firstDueDate: '2026-07-12',
        paidCount: 0,
        totalCount: 3,
      },
      transactions: [],
      cards: [],
      windowStart: new Date(2026, 6, 1),
      windowEnd: new Date(2026, 6, 31),
    })

    expect(amount).toBe(3003)
  })
})
