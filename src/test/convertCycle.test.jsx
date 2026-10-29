import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App.jsx'
import { goTo } from './helpers/nav'

// 國泰：9/27 那期帳單 16,308、只繳了 7,240，剩 9,068；10/26 那期帳單 25,209。
// 9,068 在 10/15 向銀行轉成 3 期帳單分期（帳單上「帳單分期 01/03」）。
const cathay = {
  id: 'cu', name: '國泰', color: '#0E9F8E', billingDay: 26, dueDay: 15, budget: 40000,
  billingCycles: [
    { id: 'c1', cycleKey: '2026-09', closeDate: '2026-09-27', dueDate: '2026-10-12', amount: 16308, paidAmount: 7240, paid: false, manuallyCalibrated: true, amountIsActual: true },
    { id: 'c2', cycleKey: '2026-10', closeDate: '2026-10-26', dueDate: '2026-11-09', amount: 25209, paid: false, manuallyCalibrated: true, amountIsActual: true },
  ],
}

const stored = () => JSON.parse(localStorage.getItem('cardnest_v1'))
const summary = () => document.querySelector('.credit-card-summary')
const rows = () => summary().querySelectorAll('.credit-card-cycle-row')
const head = () => summary().querySelector('.credit-card-summary-row').textContent

function open() {
  render(<App />)
  goTo('各卡與帳單')
  fireEvent.click(summary().querySelector('.credit-card-summary-row'))
  fireEvent.click(within(rows()[0]).getByText('轉分期'))
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 29, 10))
  localStorage.setItem('cardnest_v1', JSON.stringify({ cards: [cathay], plans: [], transactions: [], income: 60000, fxSettings: { usdRate: 32.5, feeRate: 1.5 } }))
})
afterEach(() => vi.useRealTimers())

describe('帳單轉分期', () => {
  it('9,068 轉 3 期：那期從待繳消失，待繳只剩 25,209；分期剩 2 期、還欠 6,044（跟銀行帳單一致）', () => {
    expect(head).toBeDefined()
    open()
    fireEvent.change(screen.getByLabelText(/第 1 期列帳日/), { target: { value: '2026-10-15' } })
    fireEvent.change(screen.getByLabelText(/年百分率/), { target: { value: '14.4' } })
    fireEvent.click(screen.getByText('確認轉分期'))

    expect(head()).toMatch(/待繳帳單NT\$25,209/)
    expect(rows()).toHaveLength(1)

    const plan = stored().plans[0]
    expect(plan).toMatchObject({ type: 'installment', name: '帳單分期', cardId: 'cu', totalCount: 3, totalAmount: 9068, amount: 3022, apr: 14.4, convertedFromCycleId: 'c1' })
    expect(stored().cards[0].billingCycles[0].convertedAmount).toBe(9068)

    goTo('固定扣款')
    expect(screen.getByText(/剩 2 期/)).toBeInTheDocument()
    expect(document.querySelector('.fixed-debt strong').textContent).toBe('NT$6,044')
  })

  it('5 秒內按「復原」：待繳、分期都回到轉之前', () => {
    open()
    fireEvent.click(screen.getByText('確認轉分期'))
    expect(head()).toMatch(/待繳帳單NT\$25,209/)
    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    expect(head()).toMatch(/待繳帳單（2 期）NT\$34,277/)
    expect(stored().plans).toEqual([])
  })

  it('只轉一部分：剩下的還留在那期，並標出已轉分期的金額', () => {
    open()
    fireEvent.change(screen.getByLabelText(/轉分期的金額/), { target: { value: '5000' } })
    fireEvent.click(screen.getByText('確認轉分期'))
    expect(head()).toMatch(/待繳帳單（2 期）NT\$29,277/)
    expect(rows()[0].textContent).toContain('已轉分期 NT$5,000')
    expect(rows()[0].textContent).toContain('NT$4,068')
  })

  it('第 1 期還沒出現在帳單上：分期剩 3 期', () => {
    open()
    fireEvent.click(screen.getByLabelText('第 1 期已經列在最新一張帳單裡'))
    fireEvent.click(screen.getByText('確認轉分期'))
    expect(stored().plans[0].paidCount).toBe(0)
    goTo('固定扣款')
    expect(screen.getByText(/剩 3 期/)).toBeInTheDocument()
  })

  it('金額超過這期還欠的、或期數不到 2 期，不會送出', () => {
    open()
    fireEvent.change(screen.getByLabelText(/轉分期的金額/), { target: { value: '9999' } })
    fireEvent.click(screen.getByText('確認轉分期'))
    expect(screen.getByRole('alert')).toHaveTextContent('最多只能轉這期還欠的 NT$9,068')
    fireEvent.change(screen.getByLabelText(/轉分期的金額/), { target: { value: '9068' } })
    fireEvent.change(screen.getByLabelText('分期期數'), { target: { value: '1' } })
    fireEvent.click(screen.getByText('確認轉分期'))
    expect(screen.getByRole('alert')).toHaveTextContent('分期期數至少為 2 期')
    expect(stored().plans).toEqual([])
  })
})
