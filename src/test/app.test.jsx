import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import App from '../App.jsx'

const CARDS = [
  { id: 'c1', name: '永豐卡', color: '#5E7CE2', billingDay: 12, dueDay: 2, budget: 20000 },
  { id: 'c2', name: '玉山卡', color: '#6FA37C', billingDay: 18, dueDay: 8, budget: 30000 },
]

function seed(data = {}) {
  localStorage.setItem('cardnest_v1', JSON.stringify({
    cards: CARDS,
    plans: [],
    transactions: [],
    fxSettings: { usdRate: 32.5, feeRate: 1.5 },
    ...data,
  }))
}

function todayMD() {
  const d = new Date()
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function sheet() {
  return document.querySelector('.sheet-panel')
}

beforeEach(() => {
  localStorage.clear()
})

describe('基本渲染', () => {
  it('沒有卡片時顯示 Onboarding', () => {
    render(<App />)
    expect(screen.getByText('新增我的第一張卡')).toBeInTheDocument()
  })

  it('有卡片時顯示動態問候語與底部導覽', () => {
    seed()
    render(<App />)
    expect(screen.getByText(/早安|午安|午後好|晚安|夜深/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '總覽' })).toBeInTheDocument()
  })
})

describe('刷卡記錄：新增 / 編輯 / 刪除', () => {
  it('可新增、編輯金額、再刪除一筆記錄', () => {
    seed()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '刷卡' }))

    // 空狀態
    expect(screen.getByText('還沒有刷卡記錄')).toBeInTheDocument()

    // 新增
    fireEvent.click(screen.getByRole('button', { name: '記一筆' }))
    const addForm = sheet()
    fireEvent.change(addForm.querySelector('.qtf-amount-input'), { target: { value: '500' } })
    fireEvent.change(addForm.querySelector('input[placeholder="例如：全聯、星巴克、IKEA"]'), { target: { value: '星巴克' } })
    fireEvent.click(within(addForm).getByRole('button', { name: '記一筆' }))

    expect(screen.getAllByText('星巴克').length).toBeGreaterThan(0)
    expect(screen.getByText('-NT$500')).toBeInTheDocument()

    // 編輯
    fireEvent.click(screen.getByRole('button', { name: '編輯' }))
    expect(screen.getByText('修改記錄')).toBeInTheDocument()
    const editForm = sheet()
    fireEvent.change(editForm.querySelector('.qtf-amount-input'), { target: { value: '800' } })
    fireEvent.click(within(editForm).getByRole('button', { name: '儲存修改' }))

    expect(screen.getByText('-NT$800')).toBeInTheDocument()
    expect(screen.queryByText('-NT$500')).not.toBeInTheDocument()

    // 刪除
    fireEvent.click(screen.getByRole('button', { name: '刪除' }))
    expect(screen.queryByText('-NT$800')).not.toBeInTheDocument()
    expect(screen.getByText('還沒有刷卡記錄')).toBeInTheDocument()
  })
})

describe('分期計畫：已繳期數', () => {
  it('新增分期時填已繳期數，會算出剩餘期數與剩餘總額', () => {
    seed()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '訂閱分期' }))
    fireEvent.click(screen.getByRole('button', { name: '新增計畫' }))

    const form = sheet()
    fireEvent.click(within(form).getByRole('button', { name: '分期' }))

    const inputs = form.querySelectorAll('.apf-input')
    // [0]名稱 [1]信用卡 [2]金額 [3]總期數 [4]已繳期數 [5]日期
    fireEvent.change(inputs[0], { target: { value: '手機分期' } })
    fireEvent.change(inputs[2], { target: { value: '1000' } })
    fireEvent.change(inputs[3], { target: { value: '12' } })
    fireEvent.change(inputs[4], { target: { value: '8' } })

    fireEvent.click(within(form).getByRole('button', { name: '新增計畫' }))

    expect(screen.getByText('手機分期')).toBeInTheDocument()
    expect(screen.getByText(/已付 8\/12 期/)).toBeInTheDocument()
    expect(screen.getByText(/剩餘總額.*NT\$4,000/)).toBeInTheDocument()
  })

  it('已繳期數留空時預設為整筆未繳（已付 0）', () => {
    seed()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '訂閱分期' }))
    fireEvent.click(screen.getByRole('button', { name: '新增計畫' }))

    const form = sheet()
    fireEvent.click(within(form).getByRole('button', { name: '分期' }))
    const inputs = form.querySelectorAll('.apf-input')
    fireEvent.change(inputs[0], { target: { value: '筆電分期' } })
    fireEvent.change(inputs[2], { target: { value: '2000' } })
    fireEvent.change(inputs[3], { target: { value: '6' } })
    fireEvent.click(within(form).getByRole('button', { name: '新增計畫' }))

    expect(screen.getByText(/已付 0\/6 期/)).toBeInTheDocument()
  })

  it('編輯既有分期可改已繳期數', () => {
    seed({
      plans: [{
        id: 'p1', type: 'installment', name: 'iPhone 分期', card: '永豐卡',
        currency: 'TWD', amount: 2000, period: '期', paidCount: 8, totalCount: 12,
        nextDate: '6/15', daysLeft: 5, status: 'neutral', paid: false,
      }],
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '訂閱分期' }))
    expect(screen.getByText(/已付 8\/12 期/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '編輯' }))
    const form = sheet()
    const inputs = form.querySelectorAll('.apf-input')
    // 已繳期數欄位（index 4）此時應預填為 8
    expect(inputs[4].value).toBe('8')
    fireEvent.change(inputs[4], { target: { value: '10' } })
    fireEvent.click(within(form).getByRole('button', { name: '儲存修改' }))

    expect(screen.getByText(/已付 10\/12 期/)).toBeInTheDocument()
  })
})

describe('未償負債總覽', () => {
  it('首頁加總所有分期的剩餘期數×金額，訂閱不計入負債', () => {
    seed({
      plans: [
        { id: 'p1', type: 'installment', name: 'iPhone 分期', card: '永豐卡',
          amount: 2000, period: '期', paidCount: 8, totalCount: 12,
          nextDate: '6/15', daysLeft: 5, status: 'neutral', paid: false },
        { id: 'p2', type: 'subscription', name: 'Netflix', card: '玉山卡',
          currency: 'TWD', amount: 390, period: '月',
          nextDate: '6/20', daysLeft: 8, status: 'neutral', active: true },
      ],
    })
    render(<App />)
    // 剩 4 期 × 2000 = 8000，訂閱不算
    const debt = document.querySelector('.debt-overview')
    expect(debt).not.toBeNull()
    expect(debt.querySelector('.debt-summary-amount').textContent).toBe('NT$8,000')
    expect(within(debt).getByText(/剩 4 期/)).toBeInTheDocument()
    expect(within(debt).queryByText('Netflix')).not.toBeInTheDocument()
  })

  it('沒有分期時不顯示負債總覽', () => {
    seed({
      plans: [
        { id: 'p2', type: 'subscription', name: 'Spotify', card: '玉山卡',
          currency: 'TWD', amount: 149, period: '月',
          nextDate: '6/20', daysLeft: 8, status: 'neutral', active: true },
      ],
    })
    render(<App />)
    expect(screen.queryByText('未償負債')).not.toBeInTheDocument()
  })
})

describe('本週扣款行事曆', () => {
  it('本週內的扣款會以服務名稱與卡片顯示在行事曆', () => {
    seed({
      plans: [{
        id: 'p1', type: 'subscription', name: 'NetflixTest', card: '永豐卡',
        currency: 'TWD', amount: 390, period: '月',
        nextDate: todayMD(), daysLeft: 0, status: 'danger', active: true,
      }],
    })
    render(<App />)
    // 預設在 dashboard
    expect(screen.getByText('本週扣款')).toBeInTheDocument()
    // 服務名稱、卡片與金額顯示在行事曆元件內
    const cal = within(document.querySelector('.week-cal'))
    expect(cal.getAllByText('NetflixTest').length).toBeGreaterThan(0)
    expect(cal.getByText(/永豐卡/)).toBeInTheDocument()
    expect(cal.getByText('NT$390')).toBeInTheDocument()
  })

  it('本週無扣款時顯示安心提示', () => {
    seed({
      plans: [{
        id: 'p1', type: 'subscription', name: 'FarAway', card: '永豐卡',
        currency: 'TWD', amount: 100, period: '月',
        nextDate: '1/1', daysLeft: 200, status: 'neutral', active: true,
      }],
    })
    render(<App />)
    expect(screen.getByText(/本週沒有預定扣款/)).toBeInTheDocument()
  })
})

describe('每月必繳清單', () => {
  it('可新增項目、標記繳清、再刪除', () => {
    seed()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))

    // 空狀態
    expect(screen.getByText('還沒有必繳項目')).toBeInTheDocument()

    // 新增
    fireEvent.click(screen.getByRole('button', { name: '新增項目' }))
    const form = sheet()
    const inputs = form.querySelectorAll('.clf-input')
    fireEvent.change(inputs[0], { target: { value: '房租' } })
    fireEvent.change(inputs[1], { target: { value: '15000' } })
    fireEvent.click(within(form).getByRole('button', { name: '加入清單' }))

    expect(screen.getByText('房租')).toBeInTheDocument()
    // 金額同時出現在項目與「尚未繳清」摘要
    expect(screen.getAllByText('NT$15,000').length).toBeGreaterThan(0)
    expect(screen.getByText('0/1 已繳')).toBeInTheDocument()

    // 標記繳清 → 進度與剩餘金額更新
    fireEvent.click(screen.getByRole('button', { name: '標記已繳' }))
    expect(screen.getByText('1/1 已繳')).toBeInTheDocument()

    // 刪除
    fireEvent.click(screen.getByRole('button', { name: '刪除' }))
    expect(screen.getByText('還沒有必繳項目')).toBeInTheDocument()
  })

  it('跨月開啟時自動清空勾選狀態', () => {
    seed({
      checklist: [{ id: 'cl1', name: '水電費', amount: 2000, day: 10, done: true }],
      checklistMonth: '2000-0', // 久遠的月份，模擬跨月
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    // done 應被重置為未繳
    expect(screen.getByText('0/1 已繳')).toBeInTheDocument()
  })

  it('未繳清單金額計入首頁本月固定扣款', () => {
    const d = new Date()
    seed({
      transactions: [{ id: 't1', name: '午餐', card: '永豐卡', category: '餐飲', amount: 1000, date: todayMD() }],
      checklist: [
        { id: 'cl1', name: '房租', amount: 3000, day: 5, done: false },
        { id: 'cl2', name: '已繳項', amount: 500, day: 6, done: true },
      ],
      checklistMonth: `${d.getFullYear()}-${d.getMonth()}`, // 當月，避免觸發月初重置
    })
    render(<App />)
    // 只有未繳的 3000 計入固定扣款，已繳的 500 不算
    const breakdown = document.querySelector('.hero-card-breakdown')
    expect(breakdown.textContent).toContain('本月固定扣款 NT$3,000')
    expect(breakdown.textContent).toContain('本月預估帳單 NT$4,000')
  })
})
