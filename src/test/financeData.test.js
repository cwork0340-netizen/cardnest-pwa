import { describe, expect, it } from 'vitest'
import { planAmountNotRecorded, transactionRepresentsPlan, isBillableTransaction, isCreditCardPayment, isInstallmentConversionCredit, normalizeFinanceData, toISODate, transactionCycleDate } from '../utils/financeData'

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

describe('toISODate 收斂三種來源格式', () => {
  const near = new Date(2026, 7, 15) // 2026-08-15

  it('認得 Sheet 的 YYYY/MM/DD——以前這裡是安靜地原樣吐回', () => {
    expect(toISODate('2026/08/03', near)).toBe('2026-08-03')
    expect(toISODate('2026/8/3', near)).toBe('2026-08-03')
    expect(toISODate('2026-8-3', near)).toBe('2026-08-03')
  })

  it('認得沒有年份的 M/D，補上最接近的年份', () => {
    expect(toISODate('8/3', near)).toBe('2026-08-03')
    // 12/31 離 8/15 超過半年，應該算成去年而不是今年年底
    expect(toISODate('12/31', new Date(2026, 0, 5))).toBe('2025-12-31')
  })

  it('已經是 ISO 就原樣通過', () => {
    expect(toISODate('2026-08-03', near)).toBe('2026-08-03')
  })

  it('真的不認得的才原樣回傳', () => {
    expect(toISODate('not-a-date', near)).toBe('not-a-date')
  })

  it('缺值回傳今天——呼叫端要自己擋空值', () => {
    // 這個行為有呼叫端依賴（見 importSheetSync 的 sheetDate），不能隨手改成 null
    expect(toISODate('', near)).toBe('2026-08-15')
  })
})

describe('設為訂閱的明確認領', () => {
  const cards = [{ id: 'c1', name: '國泰' }]
  const plan = { id: 'p1', type: 'subscription', name: 'ChatGPT', card: '國泰', cardId: 'c1', amount: 690 }
  const placeholder = { id: 't1', name: '自動匯入・國泰世華', cardId: 'c1', card: '國泰', category: '訂閱', amount: 700, date: '2026-09-10' }

  it('名稱與金額都對不上，沒有認領就不算', () => {
    expect(transactionRepresentsPlan(placeholder, plan, cards)).toBe(false)
  })

  it('tx.planId 指向這個訂閱就算，不看名稱與金額', () => {
    expect(transactionRepresentsPlan({ ...placeholder, planId: 'p1' }, plan, cards)).toBe(true)
    expect(transactionRepresentsPlan({ ...placeholder, planId: 'other' }, plan, cards)).toBe(false)
  })

  it('認領後這期不再重複估算', () => {
    const claimed = { ...placeholder, planId: 'p1', date: '2026-09-11', postedDate: '2026-09-14' }
    const win = (start, end) => ({ windowStart: new Date(...start), windowEnd: new Date(...end) })
    expect(planAmountNotRecorded({ plan, transactions: [claimed], cards, ...win([2026, 8, 5], [2026, 9, 5]) })).toBe(0)
    expect(planAmountNotRecorded({ plan, transactions: [claimed], cards, ...win([2026, 9, 5], [2026, 10, 5]) })).toBe(690)
  })
})

describe('手動記的退款', () => {
  const refund = { id: 'r', name: '退款', amount: -1254, category: '購物', note: 'momo 取消付款', date: '2026-09-19', card: '富邦M' }

  it('備註有「付款」字樣時，沒標記會被當成繳款排除、有標記才算進帳單', () => {
    expect(isCreditCardPayment(refund)).toBe(true)
    expect(isBillableTransaction(refund)).toBe(false)
    expect(isCreditCardPayment({ ...refund, kind: 'refund' })).toBe(false)
    expect(isBillableTransaction({ ...refund, kind: 'refund' })).toBe(true)
  })

  it('標記為退款的負數不會被當成分期沖銷', () => {
    const t = { ...refund, note: '分期退回', kind: 'refund' }
    expect(isInstallmentConversionCredit(t)).toBe(false)
    expect(isBillableTransaction(t)).toBe(true)
  })
})

