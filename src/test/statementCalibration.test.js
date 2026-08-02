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
})
