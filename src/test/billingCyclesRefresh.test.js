import { describe, expect, it } from 'vitest'
import { totalUnpaid, withLiveCycleEstimates } from '../utils/billingCycles'

const card = {
  id: 'card-1', name: '測試卡', billingDay: 6, dueDay: 15,
  billingCycles: [{
    id: 'cycle-1', cycleKey: '2026-07', closeDate: '2026-07-06', dueDate: '2026-07-21',
    amount: 500, estimatedAmount: 500, paid: false, amountIsActual: false,
  }],
}

function liveAmount(input, transactions) {
  return withLiveCycleEstimates(input, { transactions, plans: [] })
    .billingCycles.find((cycle) => cycle.id === 'cycle-1').amount
}

describe('estimated billing cycle amounts', () => {
  it('drops a transaction whose posted date moved it out of the cycle', () => {
    expect(liveAmount(card, [
      { id: 'tx-1', cardId: 'card-1', amount: 500, date: '2026-07-05', postedDate: '2026-07-08' },
    ])).toBe(0)
  })

  it('picks up a transaction imported after the cycle already closed', () => {
    // 銀行通知信晚幾天才匯入，那時候這一期早就結帳了。舊的做法要有人記得標記
    // refreshNeeded 才會重算，匯入路徑沒標，這筆錢就永遠進不了待繳帳單。
    expect(liveAmount(card, [
      { id: 'tx-1', cardId: 'card-1', amount: 500, date: '2026-07-02' },
      { id: 'tx-late', cardId: 'card-1', amount: 800, date: '2026-07-03' },
    ])).toBe(1300)
  })

  it('leaves a cycle calibrated against a real statement alone', () => {
    const calibrated = {
      ...card,
      billingCycles: [{ ...card.billingCycles[0], amount: 4607, amountIsActual: true, manuallyCalibrated: true }],
    }
    expect(liveAmount(calibrated, [
      { id: 'tx-1', cardId: 'card-1', amount: 999, date: '2026-07-02' },
    ])).toBe(4607)
  })

  it('leaves a settled cycle alone', () => {
    const settled = { ...card, billingCycles: [{ ...card.billingCycles[0], paid: true }] }
    expect(liveAmount(settled, [
      { id: 'tx-1', cardId: 'card-1', amount: 999, date: '2026-07-02' },
    ])).toBe(500)
  })

  it('feeds the unpaid total, so 待繳帳單 tracks the same transactions', () => {
    const live = withLiveCycleEstimates(card, {
      transactions: [{ id: 'tx-late', cardId: 'card-1', amount: 800, date: '2026-07-03' }],
      plans: [],
    })
    expect(totalUnpaid(live)).toBe(800)
  })
})
