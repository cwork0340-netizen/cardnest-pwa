import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import App from '../App.jsx'

// 「目前累計刷卡」要跟銀行 App 的「目前刷卡消費金額」同一個意思：
// 這張卡「上次結帳日之後」刷的錢（以入帳日歸期，沒有入帳日就用消費日），
// 還沒出帳、正在累積的那一段。已經結帳的那一期歸「待繳帳單」，兩邊不重複、不遺漏。

const tx = (id, card, cardId, amount, date, postedDate, name = '自動匯入') => ({
  id, name, amount, date, ...(postedDate && { postedDate }), category: '消費', cardId, card,
  note: `自動匯入・${card}`, source: { provider: 'card-import', permalink: id, bank: card },
})

// 富邦M：每月 12 號結帳。10/12 結帳的那一期（9/12～10/12）有 4 筆九月消費＋10/5 一筆。
const fubonCard = { id: 'fb', name: '富邦M', color: '#2F6FEB', billingDay: 12, dueDay: 16, budget: 30000 }
const closedCycle = [
  tx('a', '富邦M', 'fb', 28, '2026-09-11', '2026-09-14'),
  tx('b', '富邦M', 'fb', 1988, '2026-09-17', '2026-09-21'),
  tx('c', '富邦M', 'fb', 1254, '2026-09-17', '2026-09-21'),
  tx('d', '富邦M', 'fb', 580, '2026-09-21', '2026-09-23'),
  tx('o', '富邦M', 'fb', 900, '2026-10-05', '2026-10-07'),
]
const afterClose = [
  tx('n1', '富邦M', 'fb', 300, '2026-10-13', '2026-10-15'),
  tx('n2', '富邦M', 'fb', 500, '2026-10-20'),
]

function show(cards, plans, transactions, when) {
  localStorage.clear()
  vi.setSystemTime(when)
  localStorage.setItem('cardnest_v1', JSON.stringify({
    cards, plans, transactions, fxSettings: { usdRate: 32.5, feeRate: 1.5 },
  }))
  render(<App />)
  const row = document.querySelector('.credit-card-summary-row').textContent
  const money = (label) => Number(row.match(new RegExp(`${label}NT\\$(-?[\\d,]+)`))[1].replace(/,/g, ''))
  return { current: money('目前累計刷卡'), due: money('待繳帳單') }
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => vi.useRealTimers())

describe('目前累計刷卡 ＝ 上次結帳日之後刷的錢', () => {
  it('結帳日當天：整期已歸待繳，目前累計是 0，錢不會同時出現兩次', () => {
    const r = show([fubonCard], [], closedCycle, new Date(2026, 9, 12, 22, 40))
    expect(r).toEqual({ current: 0, due: 4750 })
  })

  it('結帳之後：只算 10/12 之後的消費（300＋500），不再把結帳前的 10/5 那筆算兩次', () => {
    const r = show([fubonCard], [], [...closedCycle, ...afterClose], new Date(2026, 9, 20, 10))
    expect(r).toEqual({ current: 800, due: 4750 })
  })

  it('跨月後也一樣：11/5 時 10/13～10/31 的消費還沒出帳，仍然算在目前累計', () => {
    const next = tx('n3', '富邦M', 'fb', 200, '2026-11-03')
    const r = show([fubonCard], [], [...closedCycle, ...afterClose, next], new Date(2026, 10, 5, 10))
    expect(r).toEqual({ current: 1000, due: 4750 })
  })

  it('退款（負數）也算進目前累計', () => {
    const refund = tx('r', '富邦M', 'fb', -300, '2026-10-16', '2026-10-17', '退款')
    const r = show([fubonCard], [], [...closedCycle, ...afterClose, refund], new Date(2026, 9, 20, 10))
    expect(r.current).toBe(500)
  })

  it('沒設結帳日的卡，維持用日曆月份算', () => {
    const noDay = { id: 'x', name: '無結帳日', color: '#999', budget: 10000 }
    const r = show([noDay], [], [tx('p', '無結帳日', 'x', 700, '2026-10-03', '2026-10-04')], new Date(2026, 9, 20, 10))
    expect(r.current).toBe(700)
  })
})

describe('消費日在結帳前、入帳日在結帳後的訂閱（國泰每月 25 號結帳，Claude 24 號扣款、26 號入帳）', () => {
  const cathay = { id: 'cu', name: '國泰', color: '#0E9F8E', billingDay: 25, dueDay: 15, budget: 40000 }
  const claude = { id: 'p2', type: 'subscription', name: 'Claude', card: '國泰', cardId: 'cu', amount: 600, billingDay: 24, active: true }
  const charges = [
    tx('a', '國泰', 'cu', 600, '2026-07-24', '2026-07-26', 'Anthropic Claude'),
    tx('b', '國泰', 'cu', 600, '2026-08-24', '2026-08-26', 'Anthropic Claude'),
    tx('c', '國泰', 'cu', 600, '2026-09-24', '2026-09-26', 'Anthropic Claude'),
  ]

  it('結帳前：9/26 入帳的那筆算在目前累計，訂閱估算不再重複加一次', () => {
    expect(show([cathay], [claude], charges, new Date(2026, 9, 20, 10))).toEqual({ current: 600, due: 600 })
  })

  it('結帳後：待繳只有一筆 600，不是 1,200', () => {
    expect(show([cathay], [claude], charges, new Date(2026, 9, 26, 10))).toEqual({ current: 600, due: 600 })
  })
})
