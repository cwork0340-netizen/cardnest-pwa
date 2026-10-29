import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App.jsx'
import { goTo } from './helpers/nav'

// 現況首頁：待繳帳單、先繳哪張、目前刷卡總額。數字都來自既有算法，這裡鎖住「首頁和各卡與帳單兩邊對得起來」。

const tx = (id, card, cardId, amount, date, postedDate, name = '自動匯入') => ({
  id, name, amount, date, ...(postedDate && { postedDate }), category: '消費', cardId, card,
  note: `自動匯入・${card}`, source: { provider: 'card-import', permalink: id, bank: card },
})

const fubon = { id: 'fb', name: '富邦M', color: '#2F6FEB', billingDay: 12, dueDay: 16, budget: 30000 }
const esun = { id: 'es', name: '玉山卡', color: '#6FA37C', billingDay: 5, dueDay: 25, budget: 30000 }
const txs = [
  tx('a', '富邦M', 'fb', 28, '2026-09-11', '2026-09-14'),
  tx('b', '富邦M', 'fb', 1988, '2026-09-17', '2026-09-21'),
  tx('c', '富邦M', 'fb', 1254, '2026-09-17', '2026-09-21'),
  tx('d', '富邦M', 'fb', 580, '2026-09-21', '2026-09-23'),
  tx('o', '富邦M', 'fb', 900, '2026-10-05', '2026-10-07'),
  tx('n1', '富邦M', 'fb', 300, '2026-10-13', '2026-10-15'),
  tx('n2', '富邦M', 'fb', 500, '2026-10-20'),
  tx('e1', '玉山卡', 'es', 700, '2026-09-20', '2026-09-22'),
  tx('e2', '玉山卡', 'es', 450, '2026-10-08', '2026-10-09'),
]

function seed(cards, transactions, extra = {}) {
  localStorage.setItem('cardnest_v1', JSON.stringify({
    cards, plans: [], transactions, fxSettings: { usdRate: 32.5, feeRate: 1.5 }, ...extra,
  }))
}

const money = (text) => Number(String(text).replace(/[^\d-]/g, ''))

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 20, 10))
})
afterEach(() => vi.useRealTimers())

describe('現況：待繳與目前刷卡總額', () => {
  it('一張卡：待繳帳單、目前刷卡總額就是各卡與帳單裡的同一組數字', () => {
    seed([fubon], txs.filter((t) => t.cardId === 'fb'))
    render(<App />)
    const hero = screen.getByRole('region', { name: '待繳帳單' })
    expect(hero).toHaveTextContent('NT$4,750')
    expect(screen.getByRole('region', { name: '目前刷卡總額' })).toHaveTextContent('NT$800')
    expect(hero).toHaveTextContent('1 張待繳・富邦M還有 8 天')

    goTo('各卡與帳單')
    const row = document.querySelector('.credit-card-summary-row').textContent
    expect(row).toMatch(/目前累計刷卡NT\$800/)
    expect(row).toMatch(/待繳帳單.*NT\$4,750/)
  })

  it('多張卡：首頁合計＝各卡與帳單各卡加總；先繳最急的一張，其餘折疊', () => {
    seed([fubon, esun], txs)
    render(<App />)
    const heroTotal = money(within(screen.getByRole('region', { name: '待繳帳單' })).getByText(/^NT\$/).textContent)
    const spendTotal = money(within(screen.getByRole('region', { name: '目前刷卡總額' })).getByText(/^NT\$/).textContent)

    // 先繳：只有最急一張，帶「已繳」
    expect(screen.getByText('先繳')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '已繳' })).toHaveLength(1)
    const toggle = screen.getByRole('button', { name: /還有 1 張待繳/ })
    fireEvent.click(toggle)
    expect(screen.getAllByRole('button', { name: '已繳' })).toHaveLength(2)

    goTo('各卡與帳單')
    const rows = [...document.querySelectorAll('.credit-card-summary-row')].map((r) => r.textContent)
    const due = rows.reduce((s, r) => s + money(r.match(/待繳帳單.*?NT\$([\d,]+)/)[1]), 0)
    const current = rows.reduce((s, r) => s + money(r.match(/目前累計刷卡NT\$([\d,-]+)/)[1]), 0)
    expect(heroTotal).toBe(due)
    expect(spendTotal).toBe(current)
  })

  it('先繳那張按「已繳」，首頁待繳減掉那張的金額', () => {
    seed([fubon], txs.filter((t) => t.cardId === 'fb'))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '已繳' }))
    expect(screen.getByRole('region', { name: '待繳帳單' })).toHaveTextContent('沒有待繳')
    expect(screen.queryByText('先繳')).not.toBeInTheDocument()
  })
})

describe('現況：待辦與更新', () => {
  it('有沒填入帳日的自動匯入紀錄時，出現待辦列；點「填寫」直接開到有套用篩選的刷卡紀錄', () => {
    seed([fubon], [tx('p1', '富邦M', 'fb', 100, '2026-10-19'), tx('p2', '富邦M', 'fb', 200, '2026-10-19'), tx('q', '富邦M', 'fb', 300, '2026-10-14', '2026-10-15')])
    render(<App />)
    expect(screen.getByText('2 筆待填入帳日')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /2 筆待填入帳日/ }))
    expect(document.querySelector('.tx-audit-filter-active')).toHaveTextContent('待填入帳日')
    // 再按刷卡分頁就回到不篩選
    goTo('現況'); goTo('刷卡')
    expect(document.querySelector('.tx-audit-filter-active')).not.toHaveTextContent('待填入帳日')
  })

  it('沒有待填入帳日時不出現待辦列', () => {
    seed([fubon], [tx('q', '富邦M', 'fb', 300, '2026-10-14', '2026-10-15')])
    render(<App />)
    expect(screen.queryByText(/待填入帳日/)).not.toBeInTheDocument()
  })

  it('還沒設信件匯入時按「更新信件刷卡」，提示去設定，並顯示還沒更新過', () => {
    seed([fubon], [])
    render(<App />)
    expect(screen.getByText('還沒有更新過')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '更新信件刷卡' }))
    expect(screen.getByText(/請先到設定填 Google Client ID/)).toBeInTheDocument()
  })

  it('上次更新時間顯示在按鈕上方', () => {
    seed([fubon], [], { cardImport: { lastImportAt: new Date(2026, 9, 19, 14, 5).getTime() } })
    render(<App />)
    expect(screen.getByText('上次更新 10/19 14:05')).toBeInTheDocument()
  })
})

describe('現況：＋ 補登', () => {
  const stored = () => JSON.parse(localStorage.getItem('cardnest_v1')).transactions

  it('＋ 開補登表單，記一筆退款，和刷卡頁記出來的欄位完全相同', () => {
    seed([fubon], [])
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '補登一筆' }))
    fireEvent.click(screen.getByRole('button', { name: '退款' }))
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1254' } })
    fireEvent.submit(document.querySelector('form.qtf'))
    const fromHome = stored()[0]

    cleanup()
    localStorage.clear()
    seed([fubon], [])
    render(<App />)
    goTo('刷卡')
    fireEvent.click(document.querySelector('.fab'))
    fireEvent.click(screen.getByRole('button', { name: '退款' }))
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1254' } })
    fireEvent.submit(document.querySelector('form.qtf'))
    const fromTx = stored()[0]

    const strip = ({ id, ...rest }) => rest
    expect(strip(fromHome)).toEqual(strip(fromTx))
    expect(fromHome.kind).toBe('refund')
    expect(fromHome.amount).toBe(-1254)
  })
})
