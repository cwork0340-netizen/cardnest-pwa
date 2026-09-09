import { describe, expect, it } from 'vitest'
import { buildCardForecast } from '../utils/cardForecast'

describe('card forecast summary', () => {
  it('keeps due bills, next-cycle estimates, and monthly commitments separate', () => {
    const result = buildCardForecast([
      { id: 'a', name: 'A', unpaidTotal: 1200, currentCycleAmount: 600, subsOnCard: 200, instOnCard: 300 },
      { id: 'b', name: 'B', unpaidTotal: 800, currentCycleAmount: 100, subsOnCard: 0, instOnCard: 0 },
    ], { income: 10000, essentialTotal: 2000, commitments: 500 })

    expect(result.statementDue).toBe(2000)
    expect(result.nextEstimate).toBe(1200)
    expect(result.commitments).toBe(500)
    expect(result.safeToSpend).toBe(4800)
    expect(result.overCommitted).toBe(0)
  })

  it('does not report a spend limit until income is available', () => {
    const result = buildCardForecast([], { income: 0, essentialTotal: 2000 })

    expect(result.hasIncome).toBe(false)
    expect(result.safeToSpend).toBe(0)
  })

  it('does not deduct a subscription twice once it has been charged', () => {
    // Netflix 390 已經扣款，銀行信件匯入成一筆真實交易，所以它在 currentCyclePurchases 裡。
    // commitments 傳進來的是「還沒扣的」，這筆已經扣了就不該再算一次。
    const cards = [{ id: 'c1', name: '國泰', unpaidTotal: 0, currentCyclePurchaseAmount: 390 }]
    const charged = buildCardForecast(cards, { income: 50000, essentialTotal: 0, commitments: 0 })
    expect(charged.safeToSpend).toBe(49610)

    // 還沒扣款的月份：這時候才由 commitments 代表它
    const notYet = buildCardForecast(
      [{ id: 'c1', name: '國泰', unpaidTotal: 0, currentCyclePurchaseAmount: 0 }],
      { income: 50000, essentialTotal: 0, commitments: 390 },
    )
    expect(notYet.safeToSpend).toBe(49610)
  })

  it('leaves it to the caller to decide which plans are still owed', () => {
    // 以前這裡自己過濾 plan.paidCount < totalCount，但 paidCount 是舊的手動欄位、
    // 不會跟著實際期數走，繳完的分期會被永遠算成固定支出。
    const result = buildCardForecast([], { income: 10000, essentialTotal: 0, commitments: 0 })
    expect(result.commitments).toBe(0)
    expect(result.safeToSpend).toBe(10000)
  })
})
