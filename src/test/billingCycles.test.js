import { describe, expect, it } from 'vitest'
import { applyCycleUpdate, ensureBillingCycles, cycleRemaining, totalUnpaid, unpaidCycles, dedupeCyclesByCloseDate } from '../utils/billingCycles'

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

describe('同一個結帳日只算一期', () => {
  // 富邦M 2026-10-12：自動產生的一期（估算 3,850、到期 10/27）加上校準過的一期（銀行 2,596、到期 10/28）
  const auto = { id: 'auto', cycleKey: '2026-10', closeDate: '2026-10-12', dueDate: '2026-10-27', amount: 3850, estimatedAmount: 3850, paid: false }
  const calibrated = { id: 'cal', cycleKey: '2026-10', closeDate: '2026-10-12', dueDate: '2026-10-28', amount: 2596, estimatedAmount: 3850, amountIsActual: true, manuallyCalibrated: true, paid: false }

  it('待繳只算校準過的那一筆，不會變成 6,446', () => {
    const card = { billingCycles: [auto, calibrated] }
    expect(totalUnpaid(card)).toBe(2596)
    expect(unpaidCycles(card).map((c) => c.id)).toEqual(['cal'])
    expect(totalUnpaid({ billingCycles: [calibrated, auto] })).toBe(2596)
  })

  it('留哪一筆：已繳 > 校準過 > 銀行實際 > 估算', () => {
    const actual = { ...auto, id: 'actual', amountIsActual: true }
    const paid = { ...auto, id: 'paid', paid: true }
    expect(dedupeCyclesByCloseDate([auto, actual]).map((c) => c.id)).toEqual(['actual'])
    expect(dedupeCyclesByCloseDate([actual, calibrated]).map((c) => c.id)).toEqual(['cal'])
    expect(dedupeCyclesByCloseDate([calibrated, paid]).map((c) => c.id)).toEqual(['paid'])
  })

  it('結帳日不同的不會被合併，沒有結帳日的也不動', () => {
    const sep = { ...auto, id: 'sep', closeDate: '2026-09-12' }
    const odd = { id: 'odd', amount: 1 }
    expect(dedupeCyclesByCloseDate([sep, auto, odd]).map((c) => c.id)).toEqual(['sep', 'auto', 'odd'])
  })

  it('把另一期校準成已存在的結帳日時，那個結帳日的估算期不再留著', () => {
    const sep = { id: 'sep', cycleKey: '2026-09', closeDate: '2026-09-12', dueDate: '2026-09-27', amount: 3000, paid: false }
    const result = applyCycleUpdate([sep, auto], 'sep', {
      amount: 2596, closeDate: '2026-10-12', dueDate: '2026-10-28', cycleKey: '2026-10', amountIsActual: true, manuallyCalibrated: true,
    })
    expect(result.map((c) => c.id)).toEqual(['sep'])
    expect(result[0]).toMatchObject({ closeDate: '2026-10-12', amount: 2596 })
  })

  it('同結帳日的另一期如果已繳或校準過，校準不會刪掉它', () => {
    const paid = { ...auto, id: 'paid', paid: true }
    const sep = { id: 'sep', cycleKey: '2026-09', closeDate: '2026-09-12', dueDate: '2026-09-27', amount: 3000, paid: false }
    const result = applyCycleUpdate([sep, paid], 'sep', { amount: 1, closeDate: '2026-10-12', manuallyCalibrated: true })
    expect(result.map((c) => c.id)).toEqual(['sep', 'paid'])
  })
})

