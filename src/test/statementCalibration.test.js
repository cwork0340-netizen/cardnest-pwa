import { describe, expect, it } from 'vitest'
import { buildStatementCalibration } from '../utils/statementCalibration'

describe('statement calibration diagnostics', () => {
  it('explains transactions that move to the next cycle by posted date', () => {
    const card = {
      id: 'c1',
      name: '永豐卡',
      billingDay: 6,
      billingCycles: [
        { id: 'jun', closeDate: '2026-06-06', dueDate: '2026-06-21', amount: 0, paid: true },
        { id: 'jul', closeDate: '2026-07-06', dueDate: '2026-07-21', amount: 1000, paid: false },
      ],
    }

    const result = buildStatementCalibration({
      card,
      cards: [card],
      transactions: [
        { id: 'tx1', cardId: 'c1', name: '本期消費', amount: 1000, date: '2026-07-02' },
        { id: 'tx2', cardId: 'c1', name: '下期入帳', amount: 500, date: '2026-07-03', postedDate: '2026-07-08' },
      ],
      plans: [],
      cycle: card.billingCycles[1],
      closeDate: '2026-07-06',
      statementAmount: 1000,
    })

    expect(result.estimatedAmount).toBe(1000)
    expect(result.diff).toBe(0)
    expect(result.movedToNextCycleCount).toBe(1)
    expect(result.hints).toContain('1 筆消費日落在本期，但入帳日已落到下期。')
  })

  it('itemises the estimate so the lines add up to it', () => {
    const card = {
      id: 'c1',
      name: '永豐卡',
      billingDay: 6,
      billingCycles: [
        { id: 'jun', closeDate: '2026-06-06', dueDate: '2026-06-21', amount: 0, paid: true },
        { id: 'jul', closeDate: '2026-07-06', dueDate: '2026-07-21', amount: 1000, paid: false },
      ],
    }
    const plans = [
      {
        id: 'sub1', type: 'subscription', name: 'Netflix', cardId: 'c1', card: '永豐卡',
        amount: 390, billingDay: 1, active: true,
      },
    ]

    const result = buildStatementCalibration({
      card,
      cards: [card],
      transactions: [
        { id: 'tx1', cardId: 'c1', name: '全聯', amount: 1000, date: '2026-07-02' },
      ],
      plans,
      cycle: card.billingCycles[1],
      closeDate: '2026-07-06',
      statementAmount: 1390,
    })

    const itemTotal = result.includedItems.reduce((sum, item) => sum + item.amount, 0)
    expect(itemTotal).toBe(result.estimatedAmount)
    expect(result.diff).toBe(0)
    expect(result.includedItems.map((item) => [item.name, item.amount])).toEqual(
      expect.arrayContaining([['全聯', 1000], ['Netflix', 390]]),
    )
  })

  it('lists what was left out of the cycle and why', () => {
    const card = {
      id: 'c1',
      name: '國泰卡',
      billingDay: 6,
      billingCycles: [
        { id: 'jun', closeDate: '2026-06-06', dueDate: '2026-06-21', amount: 0, paid: true },
        { id: 'jul', closeDate: '2026-07-06', dueDate: '2026-07-21', amount: 1000, paid: false },
      ],
    }

    const result = buildStatementCalibration({
      card,
      cards: [card],
      transactions: [
        { id: 'tx1', cardId: 'c1', name: '全聯', amount: 1000, date: '2026-07-02' },
        { id: 'tx2', cardId: 'c1', name: '行動條碼繳款', amount: -8000, date: '2026-07-03', category: '繳款' },
        { id: 'tx3', cardId: 'c1', name: '一般消費轉刷卡樂分期', amount: -3000, date: '2026-07-04', category: '分期' },
        { id: 'tx4', cardId: 'c1', name: '延後入帳', amount: 500, date: '2026-07-05', postedDate: '2026-07-20' },
      ],
      plans: [],
      cycle: card.billingCycles[1],
      closeDate: '2026-07-06',
      statementAmount: 1000,
    })

    expect(result.estimatedAmount).toBe(1000)
    expect(result.excludedItems.map((item) => [item.name, item.reason])).toEqual([
      ['行動條碼繳款', '繳款，不計入消費'],
      ['一般消費轉刷卡樂分期', '轉分期沖銷，不計入消費'],
      ['延後入帳', '入帳日落到下一期'],
    ])
  })
})
