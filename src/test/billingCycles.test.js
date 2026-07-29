import { describe, expect, it } from 'vitest'
import { applyCycleUpdate, ensureBillingCycles } from '../utils/billingCycles'

describe('billing cycle calibration', () => {
  it('removes later unconfirmed estimates after a bank statement calibration', () => {
    const cycles = [
      { id: 'may', closeDate: '2026-05-02', dueDate: '2026-05-17', amount: 500, amountIsActual: false, paid: true },
      { id: 'jun', closeDate: '2026-06-02', dueDate: '2026-06-17', amount: 800, amountIsActual: false, paid: false },
      { id: 'jul', closeDate: '2026-07-02', dueDate: '2026-07-17', amount: 1200, amountIsActual: false, paid: false },
      { id: 'actual', closeDate: '2026-07-10', dueDate: '2026-07-25', amount: 3000, amountIsActual: true, paid: false },
    ]

    const updated = applyCycleUpdate(cycles, 'jun', {
      closeDate: '2026-06-03',
      dueDate: '2026-06-18',
      amount: 888,
      amountIsActual: true,
      manuallyCalibrated: true,
    })

    expect(updated.map(cycle => cycle.id)).toEqual(['may', 'jun', 'actual'])
    expect(updated.find(cycle => cycle.id === 'jun')).toMatchObject({
      closeDate: '2026-06-03',
      dueDate: '2026-06-18',
      amount: 888,
      manuallyCalibrated: true,
    })
  })

  it('uses the calibrated close date as the next generated cycle boundary', () => {
    const card = {
      id: 'c1',
      name: 'Test Card',
      billingDay: 2,
      dueDay: 15,
      billingCycles: [{
        id: 'jun',
        cycleKey: '2026-06',
        closeDate: '2026-06-03',
        dueDate: '2026-06-18',
        amount: 888,
        amountIsActual: true,
        manuallyCalibrated: true,
        paid: false,
      }],
    }
    const transactions = [
      { id: 'before', cardId: 'c1', amount: 100, date: '2026-06-03', category: 'food', name: 'excluded' },
      { id: 'after', cardId: 'c1', amount: 200, date: '2026-06-04', category: 'food', name: 'included' },
      { id: 'close', cardId: 'c1', amount: 300, date: '2026-07-02', category: 'food', name: 'included on close' },
      { id: 'next', cardId: 'c1', amount: 400, date: '2026-07-03', category: 'food', name: 'next open cycle' },
    ]

    const cycles = ensureBillingCycles(card, { transactions, plans: [], today: new Date(2026, 6, 10) })

    expect(cycles).toHaveLength(2)
    expect(cycles[1]).toMatchObject({
      cycleKey: '2026-07',
      closeDate: '2026-07-02',
      dueDate: '2026-07-17',
      amount: 500,
      estimatedAmount: 500,
      amountIsActual: false,
    })
  })
})
