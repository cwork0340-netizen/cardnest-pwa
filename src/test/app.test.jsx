import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

  it('點整筆刷卡記錄即可開啟編輯並修改金額', () => {
    seed({
      transactions: [{ id: 't1', name: '星巴克', card: '永豐卡', category: '餐飲', amount: 500, date: todayMD() }],
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '刷卡' }))

    // 點整列（非 ✎ 鈕）即開啟編輯
    fireEvent.click(document.querySelector('.tx-item-clickable'))
    expect(screen.getByText('修改記錄')).toBeInTheDocument()

    const form = sheet()
    expect(form.querySelector('.qtf-amount-input').value).toBe('500')
    fireEvent.change(form.querySelector('.qtf-amount-input'), { target: { value: '650' } })
    fireEvent.click(within(form).getByRole('button', { name: '儲存修改' }))

    expect(screen.getByText('-NT$650')).toBeInTheDocument()
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

describe('分類信封預算', () => {
  it('設定信封後，首頁顯示該分類的已花/額度與剩餘', () => {
    seed({
      transactions: [
        { id: 't1', name: '午餐', card: '永豐卡', category: '餐飲', amount: 1200, date: todayMD() },
        { id: 't2', name: '晚餐', card: '永豐卡', category: '餐飲', amount: 800, date: todayMD() },
      ],
      envelopes: [{ id: 'e1', name: '餐飲', necessity: 'flexible', monthlyBudget: 5000 }],
    })
    render(<App />)
    const env = document.querySelector('.envelope-card')
    expect(env).not.toBeNull()
    // 已花 2000 / 額度 5000，還剩 3000
    expect(env.querySelector('.env-amount').textContent).toBe('NT$2,000 / NT$5,000')
    expect(within(env).getByText(/還剩 NT\$3,000/)).toBeInTheDocument()
  })

  it('超出額度時顯示超出金額', () => {
    seed({
      transactions: [{ id: 't1', name: '購物', card: '永豐卡', category: '購物', amount: 4000, date: todayMD() }],
      envelopes: [{ id: 'e1', name: '購物', necessity: 'flexible', monthlyBudget: 3000 }],
    })
    render(<App />)
    const env = document.querySelector('.envelope-card')
    expect(within(env).getByText(/超出 NT\$1,000/)).toBeInTheDocument()
  })

  it('沒有設定信封時首頁不顯示分類預算', () => {
    seed()
    render(<App />)
    expect(screen.queryByText('分類預算（信封）')).not.toBeInTheDocument()
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

  it('首頁本月支出只算刷卡＋訂閱分期，不含必繳清單', () => {
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
    // 首頁＝刷卡狀態：只有刷卡 1000，必繳清單不計入
    expect(document.querySelector('.hero-card-amount').textContent).toBe('NT$1,000')
    expect(document.querySelector('.hero-card-breakdown').textContent).toContain('已記錄刷卡 NT$1,000')
  })

  it('必要支出頁：收入扣掉必要支出後顯示生活結餘', () => {
    seed({
      income: 10000,
      checklist: [{ id: 'cl1', name: '房租', amount: 3000, day: 5, done: false }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    // 收入 10000 − 必要支出 3000 → 生活結餘 7000
    expect(screen.getByText(/還有 NT\$7,000 可生活/)).toBeInTheDocument()
  })

  it('必要支出頁：必要支出超過收入顯示沒有餘裕', () => {
    seed({
      income: 2000,
      checklist: [{ id: 'cl1', name: '房租', amount: 3000, day: 5, done: false }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    // 收入 2000 − 必要支出 3000 → 超出 1000
    expect(screen.getByText(/超出 NT\$1,000/)).toBeInTheDocument()
  })

  it('預設儲蓄不重複計入必要支出（已含在必繳清單）', () => {
    seed({
      income: 10000,
      checklist: [{ id: 'cl1', name: '學費', amount: 3000, day: 5, done: false }],
      savings: [{ id: 's1', name: '學費累積', monthly: 3000, target: 60000, saved: 0 }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    // 必要支出＝必繳 3000（儲蓄不另外加）；生活結餘 10000 − 3000 = 7000
    expect(screen.getByText(/還有 NT\$7,000 可生活/)).toBeInTheDocument()
  })

  it('勾選額外預留的儲蓄才計入必要支出', () => {
    seed({
      income: 10000,
      checklist: [{ id: 'cl1', name: '房租', amount: 3000, day: 5, done: false }],
      savings: [{ id: 's1', name: '旅遊基金', monthly: 2000, target: 0, saved: 0, countInEssential: true }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    // 必要支出＝必繳 3000 + 額外儲蓄 2000 = 5000；生活結餘 10000 − 5000 = 5000
    expect(screen.getByText(/還有 NT\$5,000 可生活/)).toBeInTheDocument()
    expect(screen.getByText(/額外儲蓄 NT\$2,000/)).toBeInTheDocument()
  })

  it('撥入本月把每月金額累積到已存', () => {
    seed({
      income: 10000,
      savings: [{ id: 's1', name: '學費', monthly: 2000, target: 60000, saved: 4000 }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    expect(screen.getByText('NT$4,000')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/撥入本月/))
    // 4000 + 2000 = 6000
    expect(screen.getByText('NT$6,000')).toBeInTheDocument()
  })

  it('領出全部把已存清為 0', () => {
    seed({
      income: 10000,
      checklist: [{ id: 'cl1', name: '房租', amount: 3000, day: 5, done: false }],
      savings: [{ id: 's1', name: '學費', monthly: 2000, target: 60000, saved: 6000 }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    fireEvent.click(screen.getByText(/領出全部/))
    expect(document.querySelector('.sg-saved').textContent).toBe('NT$0')
  })

  it('連動必繳項目：勾選時把當下金額自動存入帳戶，且不重複計入必要支出', () => {
    seed({
      income: 10000,
      checklist: [{ id: 'cl1', name: '學費', amount: 3000, day: 5, done: false }],
      savings: [{ id: 's1', name: '學費存款', linkedChecklistId: 'cl1', monthly: 3000, target: 60000, saved: 0, entries: [] }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    // 連動不重複計入：必要支出＝必繳 3000，生活結餘 10000−3000＝7000
    expect(screen.getByText(/還有 NT\$7,000 可生活/)).toBeInTheDocument()
    expect(document.querySelector('.sg-saved').textContent).toBe('NT$0')
    // 勾選必繳項目 → 自動存入 3000
    fireEvent.click(screen.getByLabelText('標記已繳'))
    expect(document.querySelector('.sg-saved').textContent).toBe('NT$3,000')
    // 取消勾選 → 退回本月撥入
    fireEvent.click(screen.getByLabelText('取消已繳標記'))
    expect(document.querySelector('.sg-saved').textContent).toBe('NT$0')
  })

  it('記一筆支出從帳戶扣款', () => {
    seed({
      income: 10000,
      checklist: [{ id: 'cl1', name: '房租', amount: 3000, day: 5, done: false }],
      savings: [{ id: 's1', name: '學費', monthly: 2000, target: 60000, saved: 6000, entries: [] }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    fireEvent.click(screen.getByText('記一筆支出'))
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '4000' } })
    fireEvent.click(screen.getByText('記錄支出'))
    // 6000 − 4000 = 2000
    expect(document.querySelector('.sg-saved').textContent).toBe('NT$2,000')
  })

  it('連動信用卡：支付卡費依本期帳單預填並扣款', () => {
    seed({
      income: 50000,
      transactions: [{ id: 't1', name: '購物', card: '永豐卡', category: '生活', amount: 5000, date: todayMD() }],
      savings: [{ id: 's1', name: '卡費預留', linkedCardId: 'c1', monthly: 5000, target: 0, saved: 6000, entries: [] }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    // 本期卡費＝永豐卡本月刷卡 5000
    fireEvent.click(screen.getByText('支付卡費 NT$5,000'))
    fireEvent.click(screen.getByText('記錄支出'))
    // 6000 − 5000 = 1000
    expect(document.querySelector('.sg-saved').textContent).toBe('NT$1,000')
  })
})

describe('整列點擊即可編輯', () => {
  it('點整張分期卡開啟編輯', () => {
    seed({
      plans: [{ id: 'p1', type: 'installment', name: 'iPhone 分期', card: '永豐卡',
        amount: 2000, period: '期', paidCount: 8, totalCount: 12,
        nextDate: '6/15', daysLeft: 5, status: 'neutral', paid: false }],
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '訂閱分期' }))
    fireEvent.click(document.querySelector('.plan-card-clickable'))
    expect(screen.getByText('修改計畫')).toBeInTheDocument()
  })

  it('點整筆必繳項目開啟編輯', () => {
    seed({ checklist: [{ id: 'cl1', name: '房租', amount: 15000, day: 5, done: false }] })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    fireEvent.click(document.querySelector('.cl-item-clickable'))
    expect(screen.getByText('修改項目')).toBeInTheDocument()
  })

  it('點整列信用卡開啟編輯', () => {
    seed()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '設定' }))
    fireEvent.click(document.querySelectorAll('.settings-row-clickable')[0])
    expect(screen.getByText('編輯信用卡')).toBeInTheDocument()
  })

  it('點必繳項目的勾選鈕只切換狀態、不會開啟編輯', () => {
    seed({ checklist: [{ id: 'cl1', name: '電信費', amount: 599, day: 8, done: false }] })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    fireEvent.click(screen.getByRole('button', { name: '標記已繳' }))
    expect(screen.queryByText('修改項目')).not.toBeInTheDocument()
    expect(screen.getByText('1/1 已繳')).toBeInTheDocument()
  })
})

describe('資料備份：匯入還原', () => {
  it('匯入備份檔可一次還原卡片與消費紀錄', async () => {
    seed() // 兩張卡、無紀錄
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '設定' }))

    const backup = {
      cards: [{ id: 'b1', name: '國泰世華卡', color: '#5E7CE2', billingDay: 5, dueDay: 15, budget: 40000 }],
      plans: [],
      transactions: [{ id: 'tb1', name: '家樂福', card: '國泰世華卡', category: '餐飲', amount: 1234, date: '6/10' }],
      checklist: [],
      envelopes: [],
      fxSettings: { usdRate: 32.5, feeRate: 1.5 },
    }
    const file = new File([JSON.stringify(backup)], 'cardnest-backup.json', { type: 'application/json' })

    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [file] } })

    // 還原後切到刷卡頁應看到匯入的紀錄
    await screen.findByText('已還原備份資料')
    fireEvent.click(screen.getByRole('button', { name: '刷卡' }))
    expect(await screen.findByText('家樂福')).toBeInTheDocument()
    expect(screen.getByText('-NT$1,234')).toBeInTheDocument()
  })
})

describe('各卡本期應繳', () => {
  function yongfengBill() {
    const cards = document.querySelectorAll('.credit-card-summary')
    const yongfeng = Array.from(cards).find(c => c.textContent.includes('永豐卡'))
    return yongfeng.querySelector('.credit-card-summary-bill-amount').textContent
  }

  it('未勾「本期支付」的分期不算進本期應繳（刷卡＋訂閱）', () => {
    seed({
      transactions: [
        { id: 't1', name: '購物', card: '永豐卡', category: '購物', amount: 1000, date: todayMD() },
        { id: 't2', name: '別張卡', card: '玉山卡', category: '餐飲', amount: 9999, date: todayMD() },
      ],
      plans: [
        { id: 's1', type: 'subscription', name: 'Netflix', card: '永豐卡', currency: 'TWD', amount: 390, period: '月', nextDate: '6/20', daysLeft: 8, status: 'neutral', active: true },
        { id: 'i1', type: 'installment', name: '手機分期', card: '永豐卡', amount: 600, period: '期', paidCount: 2, totalCount: 6, nextDate: '6/15', daysLeft: 5, status: 'neutral', paid: false },
      ],
    })
    render(<App />)
    // 永豐卡：1000 + 390 = 1390（未勾的分期不計入）
    expect(yongfengBill()).toBe('NT$1,390')
  })

  it('勾了「本期支付」的分期才把該期金額加進本期應繳', () => {
    seed({
      transactions: [
        { id: 't1', name: '購物', card: '永豐卡', category: '購物', amount: 1000, date: todayMD() },
      ],
      plans: [
        { id: 's1', type: 'subscription', name: 'Netflix', card: '永豐卡', currency: 'TWD', amount: 390, period: '月', nextDate: '6/20', daysLeft: 8, status: 'neutral', active: true },
        { id: 'i1', type: 'installment', name: '手機分期', card: '永豐卡', amount: 600, period: '期', paidCount: 2, totalCount: 6, nextDate: '6/15', daysLeft: 5, status: 'neutral', paid: true },
      ],
    })
    render(<App />)
    // 永豐卡：1000 + 390 + 600 = 1990（已勾本期支付的分期計入）
    expect(yongfengBill()).toBe('NT$1,990')
  })

  it('在分期頁勾「本期支付」後，回首頁該卡本期應繳即增加', () => {
    seed({
      transactions: [
        { id: 't1', name: '購物', card: '永豐卡', category: '購物', amount: 1000, date: todayMD() },
      ],
      plans: [
        { id: 'i1', type: 'installment', name: '手機分期', card: '永豐卡', amount: 600, period: '期', paidCount: 2, totalCount: 6, nextDate: '6/15', daysLeft: 5, status: 'neutral', paid: false },
      ],
    })
    render(<App />)
    expect(yongfengBill()).toBe('NT$1,000')
    // 切到分期頁，勾選該分期的「本期支付」
    fireEvent.click(screen.getByRole('button', { name: '訂閱分期' }))
    fireEvent.click(screen.getByRole('button', { name: '標記已付款' }))
    // 回首頁，本期應繳應增加 600
    fireEvent.click(screen.getByRole('button', { name: '總覽' }))
    expect(yongfengBill()).toBe('NT$1,600')
  })
})

describe('繳費提醒', () => {
  it('首頁列出設有截止日且本期應繳的卡，標記已繳後消失', () => {
    seed({
      cards: [{ id: 'c1', name: '台新卡', color: '#5E7CE2', billingDay: 2, dueDay: 15, dueDate: 17, budget: 50000, actualBill: 3022 }],
    })
    render(<App />)
    const reminder = document.querySelector('.pay-reminder')
    expect(reminder).toBeTruthy()
    expect(within(reminder).getByText('台新卡')).toBeInTheDocument()
    expect(within(reminder).getByText('NT$3,022')).toBeInTheDocument()
    fireEvent.click(within(reminder).getByText('已繳'))
    expect(document.querySelector('.pay-reminder')).toBeNull()
  })

  it('沒設截止日就不出現在繳費提醒', () => {
    seed({
      cards: [{ id: 'c1', name: '台新卡', color: '#5E7CE2', billingDay: 2, dueDay: 15, budget: 50000, actualBill: 3022 }],
    })
    render(<App />)
    expect(document.querySelector('.pay-reminder')).toBeNull()
  })
})

describe('標記已繳從連動帳戶扣款', () => {
  it('有連動儲蓄帳戶時，已繳可從帳戶扣款並記支出', () => {
    seed({
      cards: [{ id: 'c1', name: '台新卡', color: '#5E7CE2', billingDay: 2, dueDay: 15, dueDate: 17, budget: 50000, actualBill: 3000 }],
      savings: [{ id: 's1', name: '台新卡費預留', linkedCardId: 'c1', monthly: 3000, target: 0, saved: 5000, entries: [] }],
    })
    render(<App />)
    const reminder = document.querySelector('.pay-reminder')
    fireEvent.click(within(reminder).getByText('已繳'))
    // 詢問是否從帳戶扣款
    fireEvent.click(screen.getByText('從帳戶扣 NT$3,000'))
    // 提醒消失
    expect(document.querySelector('.pay-reminder')).toBeNull()
    // 到必繳頁看帳戶餘額：5000 − 3000 = 2000
    fireEvent.click(screen.getByRole('button', { name: '必繳' }))
    expect(document.querySelector('.sg-saved').textContent).toBe('NT$2,000')
  })
})

describe('各卡狀態：日期與標記已繳', () => {
  it('卡片顯示結帳/繳款日，按標記已繳後顯示本期已繳', () => {
    seed({
      cards: [{ id: 'c1', name: '台新卡', color: '#5E7CE2', billingDay: 2, dueDay: 15, dueDate: 17, budget: 50000, actualBill: 3022 }],
    })
    render(<App />)
    const summary = Array.from(document.querySelectorAll('.credit-card-summary'))
      .find(c => c.textContent.includes('台新卡'))
    expect(summary.textContent).toContain('2 號結帳')
    expect(summary.textContent).toContain('17 號前繳款')
    fireEvent.click(within(summary).getByText('標記已繳'))
    const after = Array.from(document.querySelectorAll('.credit-card-summary'))
      .find(c => c.textContent.includes('台新卡'))
    expect(after.textContent).toContain('本期已繳')
  })
})

describe('繳費歷史紀錄', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function newCardSummary() {
    return Array.from(document.querySelectorAll('.credit-card-summary'))
      .find(c => c.textContent.includes('台新卡'))
  }

  it('標記已繳後留下一筆紀錄，可展開看到期別、金額與日期', () => {
    // 2026/6/20，結帳日 2 號 → 當期代號 2026-5 → 顯示「2026/6 期」
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 20))
    seed({
      cards: [{ id: 'c1', name: '台新卡', color: '#5E7CE2', billingDay: 2, dueDay: 15, dueDate: 17, budget: 50000, actualBill: 3022 }],
    })
    render(<App />)
    fireEvent.click(within(newCardSummary()).getByText('標記已繳'))
    fireEvent.click(within(newCardSummary()).getByText(/繳費紀錄（1）/))
    const after = newCardSummary()
    expect(after.textContent).toContain('2026/6 期')
    expect(after.textContent).toContain('NT$3,022')
    expect(after.textContent).toContain('2026-06-20')
  })

  it('預先帶入的繳費紀錄會直接顯示在卡片上', () => {
    seed({
      cards: [{
        id: 'c1', name: '台新卡', color: '#5E7CE2', billingDay: 2, dueDate: 17, budget: 50000, actualBill: 1200,
        paymentHistory: [
          { id: 'h1', cycleKey: '2026-4', amount: 4500, date: '2026-05-10' },
          { id: 'h2', cycleKey: '2026-3', amount: 3800, date: '2026-04-09' },
        ],
      }],
    })
    render(<App />)
    fireEvent.click(within(newCardSummary()).getByText(/繳費紀錄（2）/))
    const after = newCardSummary()
    expect(after.textContent).toContain('2026/5 期')
    expect(after.textContent).toContain('NT$4,500')
    expect(after.textContent).toContain('2026/4 期')
    expect(after.textContent).toContain('NT$3,800')
  })

  it('同一期重複標記不會堆疊成兩筆', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 20))
    seed({
      cards: [{ id: 'c1', name: '台新卡', color: '#5E7CE2', billingDay: 2, dueDate: 17, budget: 50000, actualBill: 3022 }],
    })
    render(<App />)
    fireEvent.click(within(newCardSummary()).getByText('標記已繳'))
    // 已繳後沒有「標記已繳」按鈕可再按，仍應只有一筆紀錄
    expect(within(newCardSummary()).getByText(/繳費紀錄（1）/)).toBeInTheDocument()
  })
})

describe('本期已繳依各卡結帳日換期', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function yongfengSummary() {
    return Array.from(document.querySelectorAll('.credit-card-summary'))
      .find(c => c.textContent.includes('永豐卡'))
  }

  it('結帳日 14 號：跨到下個月 1 號仍維持「本期已繳」，不會在月初就重置', () => {
    // 7/5：未到 14 號結帳日，所屬週期仍是 6 月（month index 5）
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 5))
    seed({
      cards: [{ id: 'c1', name: '永豐卡', color: '#5E7CE2', billingDay: 14, dueDay: 2, dueDate: 28, budget: 20000, actualBill: 4605, billPaidMonth: '2026-5' }],
    })
    render(<App />)
    expect(yongfengSummary().textContent).toContain('本期已繳')
  })

  it('結帳日 14 號：到了 14 號新一期，自動重置成可再次標記已繳', () => {
    // 7/14：已達結帳日，所屬週期變成 7 月（month index 6），舊紀錄 2026-5 失效
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 14))
    seed({
      cards: [{ id: 'c1', name: '永豐卡', color: '#5E7CE2', billingDay: 14, dueDay: 2, dueDate: 28, budget: 20000, actualBill: 4605, billPaidMonth: '2026-5' }],
    })
    render(<App />)
    expect(yongfengSummary().textContent).not.toContain('本期已繳')
    expect(within(yongfengSummary()).getByText('標記已繳')).toBeInTheDocument()
  })
})
