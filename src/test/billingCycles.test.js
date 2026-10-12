import { describe, expect, it } from 'vitest'
import { applyCycleUpdate, ensureBillingCycles, cycleRemaining, totalUnpaid, unpaidCycles } from '../utils/billingCycles'

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

describe('部分繳款：沒繳的累積到下一期', () => {
  const cycle = (id, due, amount, extra = {}) => ({ id, cycleKey: id, closeDate: due, dueDate: due, amount, paid: false, ...extra })

  it('剩下的是帳單扣掉已繳，沒有 paidAmount 的舊資料維持整張帳單', () => {
    expect(cycleRemaining(cycle('a', '2026-05-20', 10000))).toBe(10000)
    expect(cycleRemaining(cycle('a', '2026-05-20', 10000, { paidAmount: 4000 }))).toBe(6000)
    expect(cycleRemaining(cycle('a', '2026-05-20', 10000, { paidAmount: 12000 }))).toBe(0)
  })

  it('待繳總額用剩下的算，跟下一期一起累積', () => {
    const card = { billingCycles: [cycle('may', '2026-05-20', 10000, { paidAmount: 4000 }), cycle('jun', '2026-06-20', 2500)] }
    expect(totalUnpaid(card)).toBe(8500)
    expect(unpaidCycles(card).map((c) => [c.id, c.remaining])).toEqual([['may', 6000], ['jun', 2500]])
  })

  it('已經繳清（paid 或剩下 0）的期別不再算待繳', () => {
    const card = { billingCycles: [cycle('a', '2026-05-20', 100, { paid: true }), cycle('b', '2026-06-20', 100, { paidAmount: 100 })] }
    expect(unpaidCycles(card)).toHaveLength(0)
    expect(totalUnpaid(card)).toBe(0)
  })
})

