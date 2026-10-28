import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from '../App.jsx'
import { goTo } from './helpers/nav'

const cards = [{ id: 'c1', name: '永豐', color: '#C86E62', billingDay: 14, dueDay: 15, budget: 30000 }]
const plans = [
  { id: 'i1', type: 'installment', name: '飛南山', card: '永豐', cardId: 'c1', currency: 'TWD', amount: 1458, period: '期', billingDay: 5, firstDueDate: '2026-01-05', paidCount: 9, totalCount: 19 },
  { id: 'i4', type: 'installment', name: '新光人壽', card: '永豐', cardId: 'c1', currency: 'TWD', amount: 2017, period: '期', billingDay: 10, firstDueDate: '2026-03-10', paidCount: 7, totalCount: 15 },
  { id: 'p1', type: 'subscription', name: 'ChatGPT', card: '永豐', cardId: 'c1', currency: 'TWD', amount: 690, period: '月', billingDay: 9, active: true },
]

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 28, 10))
  localStorage.setItem('cardnest_v1', JSON.stringify({ cards, plans, transactions: [], income: 60000, fxSettings: { usdRate: 32.5, feeRate: 1.5 } }))
})
afterEach(() => vi.useRealTimers())

describe('固定扣款', () => {
  it('現況有一列：每月固定扣款與占收入比，點進去是固定扣款頁', () => {
    render(<App />)
    const row = screen.getByRole('button', { name: /每月固定扣款/ })
    expect(row).toHaveTextContent('NT$4,165')
    expect(row).toHaveTextContent('占收入 7%')
    fireEvent.click(row)
    expect(screen.getByRole('heading', { name: '固定扣款' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '每月固定扣款' })).toHaveTextContent('NT$4,165')
    expect(document.querySelector('.bottom-nav-item--active').getAttribute('aria-label')).toBe('更多')
  })

  it('頁面上的分期剩餘總負債，跟各卡與帳單的「未償負債」是同一個數字', () => {
    render(<App />)
    goTo('固定扣款')
    const debt = document.querySelector('.fixed-debt strong').textContent
    expect(debt).toBe('NT$' + (1458 * 10 + 2017 * 8).toLocaleString())

    goTo('各卡與帳單')
    expect(document.body.textContent).toContain(debt.replace('NT$', ''))
  })

  it('列出分期（剩幾期、哪個月結束）與訂閱，並說明什麼時候少一筆', () => {
    render(<App />)
    goTo('固定扣款')
    expect(screen.getByText(/剩 10 期・2027\/7結束/)).toBeInTheDocument()
    expect(screen.getByText(/剩 8 期・2027\/5結束/)).toBeInTheDocument()
    expect(screen.getByText('ChatGPT')).toBeInTheDocument()
    expect(document.querySelector('.fixed-releases').textContent).toContain('2027/6')
  })

  it('沒有任何訂閱分期時，現況不顯示這一列', () => {
    localStorage.setItem('cardnest_v1', JSON.stringify({ cards, plans: [], transactions: [], fxSettings: { usdRate: 32.5, feeRate: 1.5 } }))
    render(<App />)
    expect(screen.queryByRole('button', { name: /每月固定扣款/ })).not.toBeInTheDocument()
  })
})
