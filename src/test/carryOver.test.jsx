import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App.jsx'
import { goTo } from './helpers/nav'
import { carriedInBefore, totalUnpaid } from '../utils/billingCycles'

// 國泰：9/27 那期帳單 16,308，只繳了 7,240；10/26 那期校準成銀行金額。
const card = {
  id: 'cu', name: '國泰',
  billingCycles: [
    { id: 'c1', cycleKey: '2026-09', closeDate: '2026-09-27', dueDate: '2026-10-12', amount: 16308, paidAmount: 7240, paid: false, manuallyCalibrated: true },
    { id: 'c2', cycleKey: '2026-10', closeDate: '2026-10-26', dueDate: '2026-11-10', amount: 25209, paid: false, manuallyCalibrated: true },
  ],
}

describe('上期未繳要不要算進這期', () => {
  it('現況：兩期各自剩下的相加（截圖上的 34,277）', () => {
    expect(totalUnpaid(card)).toBe(9068 + 25209)
  })

  it('10/26 那期結帳之前還欠 9,068', () => {
    expect(carriedInBefore(card, '2026-10-26', 'c2')).toBe(9068)
  })

  it('第一期之前沒有上期未繳', () => {
    expect(carriedInBefore(card, '2026-09-27', 'c1')).toBe(0)
  })

  it('併進這一期的前期不再算待繳，但對這一期重新校準時還看得到', () => {
    const rolled = { ...card, billingCycles: [{ ...card.billingCycles[0], rolledInto: 'c2' }, card.billingCycles[1]] }
    expect(totalUnpaid(rolled)).toBe(25209)
    expect(carriedInBefore(rolled, '2026-10-26', 'c2')).toBe(9068)
    expect(carriedInBefore(rolled, '2026-10-26', 'other')).toBe(0)
  })

  it('上期繳清之後，沒有未繳可以帶', () => {
    const paid = { ...card, billingCycles: [{ ...card.billingCycles[0], paid: true }, card.billingCycles[1]] }
    expect(carriedInBefore(paid, '2026-10-26', 'c2')).toBe(0)
  })
})

// 同一組數字，從畫面操作校準。
const seedCathay = () => localStorage.setItem('cardnest_v1', JSON.stringify({
  cards: [{ ...card, color: '#0E9F8E', billingDay: 26, dueDay: 15, budget: 40000 }],
  plans: [], transactions: [], fxSettings: { usdRate: 32.5, feeRate: 1.5 },
}))

describe('校準：銀行金額是「本期新增」還是「含上期未繳的應繳總額」', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(new Date(2026, 9, 28, 21, 58)) })
  afterEach(() => vi.useRealTimers())

  const open = () => {
    seedCathay(); render(<App />); goTo('各卡與帳單')
    const summary = document.querySelector('.credit-card-summary')
    fireEvent.click(summary.querySelector('.credit-card-summary-row'))
    // 第二期（10/26）的校準按鈕
    const rows = summary.querySelectorAll('.credit-card-cycle-row')
    fireEvent.click(within(rows[1]).getByText('校準'))
    return summary
  }

  it('預設（本期新增）：維持現在的算法，待繳 34,277', () => {
    const summary = open()
    expect(summary.textContent).toContain('上期還有 NT$9,068 沒繳')
    fireEvent.change(within(summary).getByLabelText('銀行帳單金額'), { target: { value: '25209' } })
    fireEvent.click(within(summary).getByText('儲存校準'))
    expect(summary.querySelector('.credit-card-summary-row').textContent).toMatch(/待繳帳單.*NT\$34,277/)
  })

  const saveTotal = (summary) => {
    fireEvent.change(within(summary).getByLabelText('銀行帳單金額'), { target: { value: '25209' } })
    fireEvent.click(within(summary).getByLabelText(/本期應繳總額/))
    fireEvent.change(within(summary).getByLabelText('實際繳款日'), { target: { value: '2026-11-09' } })
    fireEvent.change(within(summary).getByLabelText('最低應繳（選填）'), { target: { value: '8116' } })
    fireEvent.click(within(summary).getByText('儲存校準'))
  }
  const dueRow = (summary) => summary.querySelector('.credit-card-summary-row').textContent

  it('選「含上期未繳」：銀行的 25,209 已經包含 9,068，上期併進這一張帳單，只剩一行 25,209，不再有「逾期」', () => {
    const summary = open()
    saveTotal(summary)
    expect(dueRow(summary)).toMatch(/待繳帳單NT\$25,209/)
    expect(summary.querySelectorAll('.credit-card-cycle-row')).toHaveLength(1)
    expect(summary.textContent).toContain('已含上期未繳 NT$9,068')
    expect(summary.textContent).toContain('到期 11/9')
    expect(summary.textContent).toContain('最低應繳 NT$8,116')
    expect(summary.textContent).not.toContain('逾期')
  })

  it('併進去之後，繳 5,000 只剩 20,209；全額繳清就是 0', () => {
    const summary = open()
    saveTotal(summary)
    const row = () => summary.querySelector('.credit-card-cycle-row')
    fireEvent.click(within(row()).getByText('部分繳款'))
    fireEvent.change(within(row()).getByLabelText('這次繳了多少'), { target: { value: '5000' } })
    fireEvent.click(within(row()).getByText('儲存'))
    expect(dueRow(summary)).toMatch(/NT\$20,209/)
    fireEvent.click(within(row()).getByText('已繳'))
    expect(dueRow(summary)).toMatch(/NT\$0/)
  })

  it('選錯了：重新校準改選「本期新增」，上期那 9,068 就放回來', () => {
    const summary = open()
    saveTotal(summary)
    fireEvent.click(within(summary.querySelector('.credit-card-cycle-row')).getByText('校準'))
    expect(summary.textContent).toContain('上期還有 NT$9,068 沒繳')
    fireEvent.click(within(summary).getByLabelText(/本期新增消費/))
    fireEvent.click(within(summary).getByText('儲存校準'))
    expect(dueRow(summary)).toMatch(/待繳帳單（2 期）NT\$34,277/)
  })

  it('上期沒有未繳時不問這個問題', () => {
    localStorage.setItem('cardnest_v1', JSON.stringify({
      cards: [{ id: 'cu', name: '國泰', color: '#0E9F8E', billingDay: 26, dueDay: 15, budget: 40000, billingCycles: [card.billingCycles[1]] }],
      plans: [], transactions: [], fxSettings: { usdRate: 32.5, feeRate: 1.5 },
    }))
    render(<App />); goTo('各卡與帳單')
    const summary = document.querySelector('.credit-card-summary')
    fireEvent.click(summary.querySelector('.credit-card-summary-row'))
    fireEvent.click(within(summary).getByText('校準'))
    expect(summary.textContent).not.toContain('沒繳，你填的是')
    expect(screen.queryByLabelText(/本期應繳總額/)).not.toBeInTheDocument()
  })
})
