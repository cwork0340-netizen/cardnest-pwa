// 分期計畫：把「已繳期數」從手動點擊的計數器，改成每一期都有真實到期日的
// 獨立紀錄，跟卡片帳單週期（billingCycles.js）同一套邏輯。
//
// 舊機制的問題：paidCount/totalCount 完全靠手動點擊推進，忘記點兩個月，
// 資料不會知道時間已經過去、也不會知道其實已經欠了兩期——跟卡片帳單週期
// 換月誤判是同一種「跟時間脫節」的根本問題。
//
// 新機制：occurrences 陣列，每一期是 { id, cycleKey, dueDate, amount, paid, paidAt }。
// 未繳的期數依照時間流逝自動累加（忘記標記也會累積成好幾期未繳，不會悄悄消失），
// 一旦達到 totalCount 就不再產生新的一期（分期繳完了）。

import { clampDayInMonth, nextOccurrence, dayFromMD } from './recurrence'

// 舊資料相容：新資料用 billingDay，舊資料從 nextDate 字串反推
function billingDayOf(plan) {
  return Number(plan.billingDay) || dayFromMD(plan.nextDate) || 1
}

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function cycleKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// 用本地時區解析 "YYYY-MM-DD"，避免 new Date(字串) 被當成 UTC 午夜造成時區誤差
function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function nextDueDate(prevDue, billingDay) {
  const y = prevDue.getFullYear()
  const m = prevDue.getMonth() + 1
  const nextY = y + (m > 11 ? 1 : 0)
  const nextM = m % 12
  return new Date(nextY, nextM, clampDayInMonth(nextY, nextM, billingDay))
}

// 「最近一次已經過去的週期」錨點，用來回推歷史已繳期數
function currentAnchor(billingDay, today) {
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
  return d >= billingDay ? new Date(y, m, billingDay) : new Date(y, m - 1, billingDay)
}

export function ensureInstallmentOccurrences(plan, { today = new Date() } = {}) {
  const billingDay = billingDayOf(plan)
  const totalCount = Number(plan.totalCount) || 0
  let occurrences = [...(plan.occurrences ?? [])]

  if (occurrences.length === 0) {
    const paidCount = Math.min(Number(plan.paidCount) || 0, totalCount)
    if (paidCount > 0) {
      // 舊資料遷移：手動點過幾期已繳，往前推算對應筆數的歷史紀錄（真實已繳日期
      // 舊資料沒記錄過，用推算的週期日期代替）
      let cursor = currentAnchor(billingDay, today)
      const historical = []
      for (let i = 0; i < paidCount; i++) {
        historical.unshift({
          id: crypto.randomUUID(),
          cycleKey: cycleKeyOf(cursor),
          dueDate: ymd(cursor),
          amount: plan.amount,
          paid: true,
          paidAt: null,
        })
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, cursor.getDate())
      }
      occurrences = historical
    }
  }

  // 補齊「下一期未繳」：一定會產生（讓她提前看到下期到期日），除非最後一筆
  // 未繳的還沒到期──那才是真正該停下來的地方。已經到期還沒繳的話，代表時間
  // 已經推進到下一期了，繼續往下疊加，忘記標記也會正確累加多期未繳。
  const anchor = currentAnchor(billingDay, today)
  while (occurrences.length < totalCount) {
    const last = occurrences[occurrences.length - 1]
    if (last && !last.paid) {
      const lastDue = parseYmd(last.dueDate)
      if (lastDue >= anchor) break // 最後一筆未繳的還沒到期（或剛好是這期），先不疊加更多
    }
    const lastPaidDue = last ? parseYmd(last.dueDate) : null
    const nextDate = lastPaidDue ? nextDueDate(lastPaidDue, billingDay) : nextOccurrence(billingDay, today)
    occurrences.push({
      id: crypto.randomUUID(),
      cycleKey: cycleKeyOf(nextDate),
      dueDate: ymd(nextDate),
      amount: plan.amount,
      paid: false,
      paidAt: null,
    })
    if (!lastPaidDue) break // 全新分期的第一期，交給下次呼叫自然累加後續
  }

  return occurrences
}

export function unpaidInstallmentOccurrences(plan) {
  return [...(plan.occurrences ?? [])]
    .filter((o) => !o.paid)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
}

export function paidCountOf(plan) {
  return (plan.occurrences ?? []).filter((o) => o.paid).length
}

export function daysUntilDue(occurrence, today = new Date()) {
  const due = parseYmd(occurrence.dueDate)
  const ref = new Date(today)
  ref.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.round((due - ref) / 86400000)
}
