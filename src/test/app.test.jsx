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
  // 固定測試時間：6/12（= 永豐卡結帳日），讓 todayMD() 與帳單週期計算結果可預期
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 5, 12))
})

afterEach(() => {
  vi.useRealTimers()
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

describe('刷卡記錄：篩選後的合計', () => {
  it('篩選特定卡別時，合計只加總該卡的記錄', () => {
    seed({
      transactions: [
        { id: 't1', name: '午餐', card: '永豐卡', category: '餐飲', amount: 100, date: '6/10' },
        { id: 't2', name: '晚餐', card: '永豐卡', category: '餐飲', amount: 200, date: '6/11' },
        { id: 't3', name: '購物', card: '玉山卡', category: '購物', amount: 9999, date: '6/12' },
      ],
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '刷卡' }))

    expect(document.querySelector('.tx-total-amount').textContent).toBe('-NT$10,299')

    const select = document.querySelector('.tx-card-select')
    fireEvent.change(select, { target: { value: '永豐卡' } })

    expect(document.querySelector('.tx-total-label').textContent).toContain('永豐卡')
    expect(document.querySelector('.tx-total-amount').textContent).toBe('-NT$300')
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
    expect(document.querySelector('.tx-amount').textContent).toBe('-NT$500')

    // 編輯
    fireEvent.click(screen.getByRole('button', { name: '編輯' }))
    expect(screen.getByText('修改記錄')).toBeInTheDocument()
    const editForm = sheet()
    fireEvent.change(editForm.querySelector('.qtf-amount-input'), { target: { value: '800' } })
    fireEvent.click(within(editForm).getByRole('button', { name: '儲存修改' }))

    expect(document.querySelector('.tx-amount').textContent).toBe('-NT$800')

    // 刪除
    fireEvent.click(screen.getByRole('button', { name: '刪除' }))
    expect(document.querySelector('.tx-amount')).toBeNull()
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

    expect(document.querySelector('.tx-amount').textContent).toBe('-NT$650')
  })
})

describe('分期計畫：已繳期數', () => {
  it('新增分期時填已繳期數，會算出剩餘期數與剩餘總額', () => {
    seed()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
    fireEvent.click(screen.getByText('＋ 訂閱/分期'))

    const form = sheet()
    fireEvent.click(within(form).getByRole('button', { name: '分期' }))

    const inputs = form.querySelectorAll('.apf-input')
    // [0]名稱 [1]信用卡 [2]金額 [3]總期數 [4]已繳期數 [5]日期
    fireEvent.change(inputs[0], { target: { value: '手機分期' } })
    fireEvent.change(inputs[2], { target: { value: '1000' } })
    fireEvent.change(inputs[3], { target: { value: '12' } })
    fireEvent.change(inputs[4], { target: { value: '8' } })

    fireEvent.click(within(form).getByRole('button', { name: '新增計畫' }))

    // 展開永豐卡群組才看得到這張卡的分期
    fireEvent.click(document.querySelector('.checklist-estimate-toggle'))
    expect(screen.getByText('手機分期')).toBeInTheDocument()
    expect(screen.getByText(/已付 8\/12 期/)).toBeInTheDocument()
    expect(screen.getByText(/剩餘總額.*NT\$4,000/)).toBeInTheDocument()
  })

  it('已繳期數留空時預設為整筆未繳（已付 0）', () => {
    seed()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
    fireEvent.click(screen.getByText('＋ 訂閱/分期'))

    const form = sheet()
    fireEvent.click(within(form).getByRole('button', { name: '分期' }))
    const inputs = form.querySelectorAll('.apf-input')
    fireEvent.change(inputs[0], { target: { value: '筆電分期' } })
    fireEvent.change(inputs[2], { target: { value: '2000' } })
    fireEvent.change(inputs[3], { target: { value: '6' } })
    fireEvent.click(within(form).getByRole('button', { name: '新增計畫' }))

    fireEvent.click(document.querySelector('.checklist-estimate-toggle'))
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
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
    fireEvent.click(document.querySelector('.checklist-estimate-toggle'))
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
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))

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
    expect(screen.getByText('0/1 已規劃')).toBeInTheDocument()

    // 標記規劃 → 進度與剩餘金額更新
    fireEvent.click(screen.getByRole('button', { name: '標記已規劃' }))
    expect(screen.getByText('1/1 已規劃')).toBeInTheDocument()

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
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
    // done 應被重置為未規劃
    expect(screen.getByText('0/1 已規劃')).toBeInTheDocument()
  })

  it('首頁本月支出只算刷卡＋訂閱分期，不含必繳清單', () => {
    const d = new Date()
    seed({
      transactions: [{ id: 't1', name: '午餐', card: '永豐卡', category: '餐飲', amount: 1000, date: todayMD() }],
      checklist: [
        { id: 'cl1', name: '房租', amount: 3000, day: 5, done: false },
        { id: 'cl2', name: '已規劃項', amount: 500, day: 6, done: true },
      ],
      checklistMonth: `${d.getFullYear()}-${d.getMonth()}`, // 當月，避免觸發月初重置
    })
    render(<App />)
    // 首頁＝刷卡狀態：只有刷卡 1000，必繳清單不計入
    expect(document.querySelector('.hero-card-amount').textContent).toBe('NT$1,000')
  })

  it('必要支出頁：收入扣掉必要支出後顯示生活結餘', () => {
    seed({
      income: 10000,
      checklist: [{ id: 'cl1', name: '房租', amount: 3000, day: 5, done: true }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
    // 收入 10000 − 必要支出 3000 → 生活結餘 7000
    expect(screen.getByText(/還有 NT\$7,000 可生活/)).toBeInTheDocument()
  })

  it('必要支出頁：必要支出超過收入顯示沒有餘裕', () => {
    seed({
      income: 2000,
      checklist: [{ id: 'cl1', name: '房租', amount: 3000, day: 5, done: true }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
    // 收入 2000 − 必要支出 3000 → 超出 1000
    expect(screen.getByText(/超出 NT\$1,000/)).toBeInTheDocument()
  })

  it('預設儲蓄不重複計入必要支出（已含在必繳清單）', () => {
    seed({
      income: 10000,
      checklist: [{ id: 'cl1', name: '學費', amount: 3000, day: 5, done: true }],
      savings: [{ id: 's1', name: '學費累積', monthly: 3000, target: 60000, saved: 0 }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
    // 必要支出＝必繳 3000（儲蓄不另外加）；生活結餘 10000 − 3000 = 7000
    expect(screen.getByText(/還有 NT\$7,000 可生活/)).toBeInTheDocument()
  })

  it('勾選額外預留的儲蓄才計入必要支出', () => {
    seed({
      income: 10000,
      checklist: [{ id: 'cl1', name: '房租', amount: 3000, day: 5, done: true }],
      savings: [{ id: 's1', name: '旅遊基金', monthly: 2000, target: 0, saved: 0, countInEssential: true }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
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
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
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
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
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
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
    // 尚未勾選：還在規劃階段，必要支出＝0，生活結餘＝收入 10000
    expect(screen.getByText(/還有 NT\$10,000 可生活/)).toBeInTheDocument()
    expect(document.querySelector('.sg-saved').textContent).toBe('NT$0')
    // 勾選必繳項目 → 自動存入 3000，且必要支出只算一次 3000（不會因為連動儲蓄又多算一次變 6000）
    fireEvent.click(screen.getByLabelText('標記已規劃'))
    expect(document.querySelector('.sg-saved').textContent).toBe('NT$3,000')
    expect(screen.getByText(/還有 NT\$7,000 可生活/)).toBeInTheDocument()
    // 取消勾選 → 退回本月撥入，必要支出也退回 0
    fireEvent.click(screen.getByLabelText('取消規劃'))
    expect(document.querySelector('.sg-saved').textContent).toBe('NT$0')
    expect(screen.getByText(/還有 NT\$10,000 可生活/)).toBeInTheDocument()
  })

  it('記一筆支出從帳戶扣款', () => {
    seed({
      income: 10000,
      checklist: [{ id: 'cl1', name: '房租', amount: 3000, day: 5, done: false }],
      savings: [{ id: 's1', name: '學費', monthly: 2000, target: 60000, saved: 6000, entries: [] }],
      checklistMonth: `${new Date().getFullYear()}-${new Date().getMonth()}`,
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
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
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
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
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
    fireEvent.click(document.querySelector('.checklist-estimate-toggle'))
    fireEvent.click(document.querySelector('.plan-card-clickable'))
    expect(screen.getByText('修改計畫')).toBeInTheDocument()
  })

  it('點整筆必繳項目開啟編輯', () => {
    seed({ checklist: [{ id: 'cl1', name: '房租', amount: 15000, day: 5, done: false }] })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
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
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
    fireEvent.click(screen.getByRole('button', { name: '標記已規劃' }))
    expect(screen.queryByText('修改項目')).not.toBeInTheDocument()
    expect(screen.getByText('1/1 已規劃')).toBeInTheDocument()
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
    expect(document.querySelector('.tx-amount').textContent).toBe('-NT$1,234')
  })
})

describe('各卡下期應繳', () => {
  it('卡片下期應繳＝該卡刷卡＋訂閱＋未繳分期', () => {
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
    // 永豐卡：上期應繳 = 1000（已過結帳日的刷卡）+ 390（訂閱）+ 600（分期）= 1990
    const cards = document.querySelectorAll('.credit-card-summary')
    const yongfeng = Array.from(cards).find(c => c.textContent.includes('永豐卡'))
    const amountValues = yongfeng.querySelectorAll('.credit-card-summary-amount-value')
    expect(amountValues[0].textContent).toBe('NT$1,990')
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

  it('沒設截止日時會自動用帳單日+寬限天數算出，仍會出現提醒', () => {
    seed({
      // 帳單日 2 號 + 寬限 15 天 = 17 號自動成為截止日
      cards: [{ id: 'c1', name: '台新卡', color: '#5E7CE2', billingDay: 2, dueDay: 15, budget: 50000, actualBill: 3022 }],
    })
    render(<App />)
    const reminder = document.querySelector('.pay-reminder')
    expect(reminder).toBeTruthy()
    expect(within(reminder).getByText('台新卡')).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: '規劃' }))
    expect(document.querySelector('.sg-saved').textContent).toBe('NT$2,000')
  })
})

describe('各卡狀態：上期與本期累積', () => {
  it('卡片顯示上期應繳（銀行帳單金額）與本期累積（結帳日之後新刷的）', () => {
    // 固定測試日為 6/27，結帳日 2 號：6/2 之後才算「本期累積」
    vi.setSystemTime(new Date(2026, 5, 27))
    seed({
      cards: [{ id: 'c1', name: '台新卡', color: '#5E7CE2', billingDay: 2, dueDay: 15, dueDate: 17, budget: 50000, actualBill: 3022 }],
      transactions: [
        { id: 't1', card: '台新卡', amount: 500, date: '6/10', category: '餐飲', name: '本期消費' },
      ],
    })
    render(<App />)
    const summary = Array.from(document.querySelectorAll('.credit-card-summary'))
      .find(c => c.textContent.includes('台新卡'))
    expect(summary.textContent).toContain('待繳帳單')
    expect(summary.textContent).toContain('NT$3,022')
    expect(summary.textContent).toContain('本期已入帳')
    expect(summary.textContent).toContain('NT$500')
  })

  it('點卡片可展開看刷卡／訂閱／分期小計', () => {
    vi.setSystemTime(new Date(2026, 5, 12))
    seed({
      transactions: [{ id: 't1', card: '永豐卡', amount: 1000, date: '6/12', category: '購物', name: '購物' }],
      plans: [
        { id: 's1', type: 'subscription', name: 'Netflix', card: '永豐卡', currency: 'TWD', amount: 390, period: '月', nextDate: '6/20', daysLeft: 8, status: 'neutral', active: true },
        { id: 'i1', type: 'installment', name: '手機分期', card: '永豐卡', amount: 600, period: '期', paidCount: 2, totalCount: 6, nextDate: '6/15', daysLeft: 5, status: 'neutral', paid: false },
      ],
    })
    render(<App />)
    const summary = Array.from(document.querySelectorAll('.credit-card-summary'))
      .find(c => c.textContent.includes('永豐卡'))
    expect(summary.querySelector('.credit-card-summary-breakdown')).not.toBeInTheDocument()

    fireEvent.click(summary.querySelector('.credit-card-summary-row'))

    const breakdown = summary.querySelector('.credit-card-summary-breakdown')
    expect(breakdown).toBeInTheDocument()
    expect(breakdown.textContent).toContain('已入帳刷卡')
    expect(breakdown.textContent).toContain('NT$1,000')
    expect(breakdown.textContent).toContain('訂閱小計')
    expect(breakdown.textContent).toContain('NT$390')
    expect(breakdown.textContent).toContain('分期小計')
    expect(breakdown.textContent).toContain('NT$600')
    expect(breakdown.textContent).toContain('App 估算合計')
    expect(breakdown.textContent).toContain('NT$1,990')
  })
})
