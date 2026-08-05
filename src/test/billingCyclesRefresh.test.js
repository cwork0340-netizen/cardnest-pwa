import { describe, expect, it } from 'vitest'
import { ensureBillingCycles } from '../utils/billingCycles'

describe('estimated billing cycle refresh', () => {
  it('refreshes an estimated unpaid cycle when a transaction receives a later posted date', () => {
    const card = {
      id: 'card-1', name: '測試卡', billingDay: 6, dueDay: 15,
      billingCycles: [{ id: 'cycle-1', cycleKey: '2026-07', closeDate: '2026-07-06', dueDate: '2026-07-21', amount: 500, estimatedAmount: 500, paid: false, amountIsActual: false, refreshNeeded: true }],
    }
    const cycles = ensureBillingCycles(card, {
      today: new Date(2026, 7, 1), plans: [],
      transactions: [{ id: 'tx-1', cardId: 'card-1', amount: 500, date: '2026-07-05', postedDate: '2026-07-08' }],
    })

    expect(cycles.find((cycle) => cycle.id === 'cycle-1').amount).toBe(0)
  })
})
