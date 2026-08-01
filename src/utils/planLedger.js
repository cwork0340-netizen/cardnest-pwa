// 訂閱／分期不再自己維護一份「已繳/未繳」清單——每一期輪到扣款日，就必須在
// 刷卡記錄裡有一筆真實、綁定 planId 的交易；「已繳幾期」「下次扣款日」全部
// 改成對 transactions 做即時查詢，不再是第二份手動維護的陣列。
// 這樣不需要協調 setPlans / setTransactions 兩邊的寫入時機：一個計畫「有沒有
// 被記到帳」永遠只看 transactions 裡有沒有對應 planId + planCycleKey 那一筆。

import { clampDayInMonth, dayFromMD, nextOccurrence } from './recurrence'
import { parseISODate, resolveCardId } from './financeData'

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function cycleKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function nextMonthDate(date, billingDay) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const nextY = y + (m > 11 ? 1 : 0)
  const nextM = m % 12
  return new Date(nextY, nextM, clampDayInMonth(nextY, nextM, billingDay))
}

// 舊資料相容：新資料用 billingDay，舊資料從 nextDate 字串反推
function billingDayOf(plan) {
  return Number(plan.billingDay) || dayFromMD(plan.nextDate) || 1
}

// 分期：期數固定、按月往後排，只回傳 legacyPaidCount 之後（這個功能上線後才
// 負責追蹤）的期別。不看「今天」——到期與否交給呼叫端用 dueDate 比對。
function installmentSchedule(plan) {
  const billingDay = billingDayOf(plan)
  const total = Number(plan.totalCount) || 0
  const legacyPaidCount = Math.min(Number(plan.legacyPaidCount) || 0, total)
  const firstDue = parseISODate(plan.firstDueDate) ?? new Date()

  const schedule = []
  let cursor = firstDue
  for (let i = 0; i < total; i++) {
    if (i >= legacyPaidCount) {
      schedule.push({ cycleKey: cycleKeyOf(cursor), dueDate: ymd(cursor) })
    }
    cursor = nextMonthDate(cursor, billingDay)
  }
  return schedule
}

// 訂閱：無上限的每月排程，從 materializeFrom 所在週期開始，最多排到「今天
// 往後 monthsAhead 個月」——多排一點是為了讓「這個月固定支出估算」能看到
// 這個月還沒到扣款日、但已知會發生的訂閱費用。
function subscriptionSchedule(plan, { today, monthsAhead }) {
  const billingDay = billingDayOf(plan)
  const from = parseISODate(plan.materializeFrom) ?? today
  const end = new Date(today.getFullYear(), today.getMonth() + monthsAhead, today.getDate())

  const schedule = []
  let occ = nextOccurrence(billingDay, from)
  while (occ <= end) {
    schedule.push({ cycleKey: cycleKeyOf(occ), dueDate: ymd(occ) })
    occ = nextMonthDate(occ, billingDay)
  }
  return schedule
}

export function planOccurrenceSchedule(plan, { today = new Date(), monthsAhead = 2 } = {}) {
  return plan.type === 'installment'
    ? installmentSchedule(plan)
    : subscriptionSchedule(plan, { today, monthsAhead })
}

export function materializedCycleKeys(planId, transactions) {
  return new Set(
    transactions.filter((tx) => tx.planId === planId).map((tx) => tx.planCycleKey)
  )
}

export function installmentPaidCount(plan, transactions) {
  const legacy = Number(plan.legacyPaidCount) || 0
  const materialized = materializedCycleKeys(plan.id, transactions).size
  return Math.min(legacy + materialized, Number(plan.totalCount) || 0)
}

// 已到期（dueDate <= today）但還沒材料化成交易的期別——材料化跟「逾期提醒」
// 共用這一份查詢：忘記開 App 好幾個月，這裡會一次列出所有欠的期別，不會漏。
export function duePlanOccurrences(plan, transactions, { today = new Date() } = {}) {
  const materialized = materializedCycleKeys(plan.id, transactions)
  const materializeFrom = parseISODate(plan.materializeFrom) ?? today
  return planOccurrenceSchedule(plan, { today }).filter((occ) => {
    const due = parseISODate(occ.dueDate)
    return due && due <= today && due >= materializeFrom && !materialized.has(occ.cycleKey)
  })
}

// 這個窗口內「已知會發生、但還沒材料化」的金額——取代 planAmountNotRecorded /
// installmentAmountNotRecordedInWindow，用於首頁「本月固定支出估算」。
export function upcomingUnmaterializedInWindow(plan, transactions, { windowStart, windowEnd }) {
  const materialized = materializedCycleKeys(plan.id, transactions)
  return planOccurrenceSchedule(plan, { today: windowEnd }).filter((occ) => {
    const due = parseISODate(occ.dueDate)
    return due && due > windowStart && due <= windowEnd && !materialized.has(occ.cycleKey)
  })
}

export function nextDueOccurrence(plan, transactions, { today = new Date() } = {}) {
  const materialized = materializedCycleKeys(plan.id, transactions)
  const schedule = planOccurrenceSchedule(plan, { today, monthsAhead: 3 })
    .filter((occ) => !materialized.has(occ.cycleKey))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return schedule[0] ?? null
}

export function daysUntilDue(occurrence, today = new Date()) {
  const due = parseISODate(occurrence.dueDate)
  const ref = new Date(today)
  ref.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.round((due - ref) / 86400000)
}

// 銀行匯入對帳時，拿交易日期跟計畫到期日比對用的容忍天數——放在這裡方便之後
// 看真實匯入狀況再調整，不要散落在 App.jsx 裡當一個沒有名字的魔術數字。
export const IMPORT_MATCH_TOLERANCE_DAYS = 5

// 產生每個計畫「到期未材料化」的期別，變成真實、綁定 planId 的刷卡記錄。
// 純函式，用同樣的 transactions 重跑會回傳空陣列——天生冪等。
export function materializeDuePlanTransactions({ plans, transactions, cards, today = new Date() }) {
  const newTransactions = []
  plans.forEach((plan) => {
    if (plan.type === 'subscription' && !(plan.active ?? true)) return
    const due = duePlanOccurrences(plan, transactions, { today })
    due.forEach((occ) => {
      newTransactions.push({
        id: crypto.randomUUID(),
        planId: plan.id,
        planCycleKey: occ.cycleKey,
        autoGenerated: true,
        confirmed: false,
        name: plan.name,
        category: plan.type === 'subscription' ? '訂閱' : '分期',
        cardId: resolveCardId(plan, cards),
        card: plan.card,
        amount: plan.amount,
        date: occ.dueDate,
        note: '',
      })
    })
  })
  return { newTransactions }
}
