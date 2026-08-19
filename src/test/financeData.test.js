import { describe, expect, it } from 'vitest'
import {
  isBillableTransaction,
  isCreditCardPayment,
  isInstallmentConversionCredit,
  normalizeFinanceData,
  planAmountNotRecorded,
  transactionCycleDate,
} from '../utils/financeData'

describe('finance transaction classification', () => {
  it('uses posted date as the card billing cycle date when available', () => {
    const data = normalizeFinanceData({
      cards: [{ id: 'cathay', name: '國泰卡' }],
      transactions: [{
        id: 'tx1',
        name: '全家便利商店 APP 線上',
        card: '國泰卡',
        amount: 385,
        date: '2026-06-26',
        postedDate: '2026-07-23',
      }],
    })

    expect(transactionCycleDate(data.transactions[0])).toBe('2026-07-23')
  })

  it('does not treat credit-card payments as spending transactions', () => {
    const tx = { name: '全家行動條碼繳款 25101', amount: -14275 }

    expect(isCreditCardPayment(tx)).toBe(true)
    expect(isBillableTransaction(tx)).toBe(false)
  })

  it('does not treat installment conversion credits as spending transactions', () => {
    const tx = { name: '一般消費轉刷卡樂分期', amount: -9009 }

    expect(isInstallmentConversionCredit(tx)).toBe(true)
    expect(isBillableTransaction(tx)).toBe(false)
  })

  it('does not add planned subscriptions again when bank transactions already contain them', () => {
    const cards = [{ id: 'cathay', name: '國泰' }]
    const windowStart = new Date(2026, 6, 23)
    const windowEnd = new Date(2026, 7, 19)
    const transactions = [
      { id: 'tx1', card: '國泰', amount: 650, date: '2026-08-03', category: '一般購物', name: 'GOOGLE*GOOGLE ONE' },
      { id: 'tx2', card: '國泰', amount: 690, date: '2026-08-04', category: '一般購物', name: 'OPENAI *CHATGPT SUBSCR' },
      { id: 'tx3', card: '國泰', amount: 335, date: '2026-08-09', category: '一般購物', name: 'DISNEY PLUS' },
      { id: 'tx4', card: '國泰', amount: 647, date: '2026-07-26', category: '一般購物', name: 'ANTHROPIC* CLAUDE SUB' },
    ]

    expect(planAmountNotRecorded({
      plan: { type: 'subscription', name: 'Google One', card: '國泰', amount: 650 },
      transactions,
      cards,
      windowStart,
      windowEnd,
    })).toBe(0)
    expect(planAmountNotRecorded({
      plan: { type: 'subscription', name: 'ChatGPT', card: '國泰', amount: 690 },
      transactions,
      cards,
      windowStart,
      windowEnd,
    })).toBe(0)
    expect(planAmountNotRecorded({
      plan: { type: 'subscription', name: 'Disney+', card: '國泰', amount: 335 },
      transactions,
      cards,
      windowStart,
      windowEnd,
    })).toBe(0)
    expect(planAmountNotRecorded({
      plan: { type: 'subscription', name: 'Claude', card: '國泰', amount: 649 },
      transactions,
      cards,
      windowStart,
      windowEnd,
    })).toBe(0)
  })
})
