import { describe, expect, it } from 'vitest'
import {
  isBillableTransaction,
  isCreditCardPayment,
  isInstallmentConversionCredit,
  normalizeFinanceData,
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
})
