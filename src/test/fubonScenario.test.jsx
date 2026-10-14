import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from '../App.jsx'
import { goTo } from './helpers/nav'

// 富邦M：結帳日 12 號、繳款日再 16 天（10/28）。資料與金額取自 2026-10-12 銀行 App 的
// 「未出帳單消費」畫面：580、−1,254（09/19 退款）、1,254、1,988、28，合計 2,596。
const tx = (id, amount, date, postedDate) => ({
  id, name: '自動匯入・富邦', amount, date, postedDate, category: '消費', cardId: 'fb', card: '富邦M',
  note: '自動匯入・富邦', source: { provider: 'card-import', permalink: id, bank: '富邦' },
})
const seed = () => localStorage.setItem('cardnest_v1', JSON.stringify({
  cards: [{ id: 'fb', name: '富邦M', color: '#2F6FEB', billingDay: 12, dueDay: 16, budget: 30000 }],
  plans: [], fxSettings: { usdRate: 32.5, feeRate: 1.5 },
  transactions: [
    tx('a', 28, '2026-09-11', '2026-09-14'), tx('b', 1988, '2026-09-17', '2026-09-21'),
    tx('c', 1254, '2026-09-17', '2026-09-21'), tx('d', 580, '2026-09-21', '2026-09-23'),
  ],
}))
const openCalibration = () => {
  goTo('刷卡')
  fireEvent.click(screen.getByRole('button', { name: '打開校準' }))
  fireEvent.change(screen.getByPlaceholderText('例如 4607'), { target: { value: '2596' } })
}
const card = () => document.querySelector('.credit-card-summary').textContent

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(new Date(2026, 9, 12, 22, 40)) })
afterEach(() => vi.useRealTimers())

describe('富邦M 2026-10-12（對照銀行 App 的 2,596）', () => {
  it('沒記退款時，App 比銀行多出剛好一筆退款', () => {
    seed(); render(<App />)
    openCalibration()
    expect(screen.getByText('NT$3,850')).toBeInTheDocument()
    expect(screen.getByText('NT$-1,254')).toBeInTheDocument()
  })

  it('用表單補記退款（9/19、入帳 9/21）之後，校準與待繳帳單都等於銀行', () => {
    seed(); render(<App />)
    expect(card()).toContain('NT$3,850')

    goTo('刷卡')
    fireEvent.click(document.querySelector('.fab'))
    fireEvent.click(screen.getByRole('button', { name: '退款' }))
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1254' } })
    const [date, posted] = document.querySelectorAll('form.qtf input[type="date"]')
    fireEvent.change(date, { target: { value: '2026-09-19' } })
    fireEvent.change(posted, { target: { value: '2026-09-21' } })
    fireEvent.submit(document.querySelector('form.qtf'))

    fireEvent.click(screen.getByRole('button', { name: '打開校準' }))
    fireEvent.change(screen.getByPlaceholderText('例如 4607'), { target: { value: '2596' } })
    expect(screen.getByText('銀行帳單和 App 估算一致。')).toBeInTheDocument()

    goTo('總覽')
    expect(card()).toContain('NT$2,596')
    expect(card()).not.toContain('NT$3,850')
  })

  // 已知還沒修：結帳日當天，銀行的「目前刷卡消費金額」仍是 2,596，
  // 但 App 的「目前累計刷卡」按日曆月份算，是 NT$0（錢已經移到待繳帳單）。
  it.fails('「目前累計刷卡」與銀行的未出帳單消費一致', () => {
    seed(); render(<App />)
    const row = document.querySelector('.credit-card-summary-row').textContent
    expect(row).toMatch(/目前累計刷卡NT\$2,(596|[0-9]{3})/)
  })
})
