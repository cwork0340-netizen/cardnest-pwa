import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App.jsx'
import { goTo } from './helpers/nav'

const cards = [{
  id: 'cu', name: '國泰', color: '#0E9F8E', billingDay: 26, dueDay: 15, budget: 40000,
  billingCycles: [{ id: 'c2', cycleKey: '2026-10', closeDate: '2026-10-26', dueDate: '2026-11-09', amount: 25209, paid: false, manuallyCalibrated: true, amountIsActual: true }],
}]
const tx = { id: 't1', name: '全聯', amount: 300, date: '2026-10-20', category: '日常', cardId: 'cu', card: '國泰' }

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 29, 10))
  localStorage.setItem('cardnest_v1', JSON.stringify({ cards, plans: [], transactions: [tx], fxSettings: { usdRate: 32.5, feeRate: 1.5 } }))
})
afterEach(() => vi.useRealTimers())

describe('逐一點按鈕測試找到的問題', () => {
  it('部分繳款沒填金額就按儲存：要告訴你要填，而不是什麼都沒發生', () => {
    render(<App />)
    goTo('各卡與帳單')
    const summary = document.querySelector('.credit-card-summary')
    fireEvent.click(summary.querySelector('.credit-card-summary-row'))
    fireEvent.click(within(summary).getByText('部分繳款'))
    fireEvent.click(within(summary).getByText('儲存'))
    expect(within(summary).getByRole('alert')).toHaveTextContent('請填寫這次繳了多少')
    expect(JSON.parse(localStorage.getItem('cardnest_v1')).cards[0].billingCycles[0].paidAmount).toBeUndefined()
  })

  it('刪除一筆刷卡：提示是中文，5 秒內可以復原', () => {
    render(<App />)
    goTo('刷卡')
    fireEvent.click(screen.getByRole('button', { name: '刪除' }))
    expect(screen.getByText('已刪除「全聯」')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    expect(JSON.parse(localStorage.getItem('cardnest_v1')).transactions.map((t) => t.id)).toEqual(['t1'])
  })
})
