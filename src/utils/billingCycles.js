// 信用卡帳單週期：把「這期到底繳了沒、欠多少」變成一筆一筆有真實日期的獨立紀錄，
// 取代舊版「只記得每月幾號」＋「billPaidMonth 這個月份字串」的機制。
// 舊機制的問題：billPaidMonth 只跟日曆月比對，換月之後舊的欠款會被誤判成「新的一期還早」，
// 逾期感消失；訂閱／分期也完全沒有跟卡片的結帳週期綁在一起。
//
// 新機制：
// - 每一期都是 { cycleKey, closeDate, dueDate, amount, amountIsActual, paid, paidAt }
// - amount 在該期「結帳日」當下拍照定案，之後不會被重新計算覆蓋（除非手動編輯）
// - 未繳的期數會一直留著往後累加，不會因為換月就消失或被下一期蓋掉
// - dueDate 是完整日期（含年月日），可以手動改成任何一天，不再限制「當月同一天」

import { clampDayInMonth } from './recurrence'
import { ensureInstallmentOccurrences } from './installmentCycles'
import {
  installmentAmountNotRecordedInWindow,
  isBillableTransaction,
  matchesCard,
  parseISODate,
  planAmountNotRecorded,
  transactionCycleDate,
} from './financeData'

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 用本地時區解析 "YYYY-MM-DD"，不能直接 new Date(字串)——那會被當成 UTC 午夜，
// 跟其他用 new Date(y, m, d) 建構的本地時間日期比較時會因時區產生誤差。
function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function cycleKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// 從某個結帳日往後推一個月，取得下一次結帳日（沿用 clampDayInMonth 處理 2 月等短月份）
function nextCloseDate(prevClose, billingDay) {
  const y = prevClose.getFullYear()
  const m = prevClose.getMonth() + 1
  const nextY = y + (m > 11 ? 1 : 0)
  const nextM = m % 12
  return new Date(nextY, nextM, clampDayInMonth(nextY, nextM, billingDay))
}

// 把一段時間窗內的刷卡記錄、訂閱、未繳分期，加總成那個結帳週期「結帳當下」該有的金額。
// tx.date 是 "M/D" 字串，跟 App.jsx 既有的 resolveNearDate 邏輯一致（避免跨年誤判）。
function resolveNearDate(displayDate, near) {
  return parseISODate(displayDate, near)
}

function snapshotAmount({ card, cardName, windowStart, windowEnd, transactions, plans }) {
  const cardRef = card ?? { name: cardName }
  const cards = card?.id ? [card] : []
  const txAmount = transactions
    .filter((tx) => matchesCard(tx, cardRef))
    .filter(isBillableTransaction)
    .filter((tx) => {
      const dt = resolveNearDate(transactionCycleDate(tx), windowEnd)
      return dt && dt > windowStart && dt <= windowEnd
    })
    .reduce((s, tx) => s + tx.amount, 0)

  // 訂閱：扣款日落在這個結帳週期時間窗內才算進這一期（不是無條件全部塞進每一期）
  const subsAmount = plans
    .filter((p) => p.type === 'subscription' && (p.active ?? true) && matchesCard(p, cardRef))
    .filter((p) => {
      const day = Number(p.billingDay) || 1
      const occurrence = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), clampDayInMonth(windowEnd.getFullYear(), windowEnd.getMonth(), day))
      return occurrence > windowStart && occurrence <= windowEnd
    })
    .reduce((s, p) => s + planAmountNotRecorded({ plan: p, transactions, cards, windowStart, windowEnd }), 0)

  // 分期：這期結帳當下還有未繳期數的分期，每期金額算進這一期。用 ensure（現算）
  // 而不是直接讀 p.occurrences，因為卡片與分期的資料補齊是兩個獨立的 effect，
  // 執行順序不保證，snapshot 當下 plans 可能還沒補齊過 occurrences。
  const instAmount = plans
    .filter((p) => p.type === 'installment' && matchesCard(p, cardRef))
    .filter((p) => ensureInstallmentOccurrences(p).some((o) => !o.paid))
    .reduce((s, p) => s + installmentAmountNotRecordedInWindow({ plan: p, transactions, cards, windowStart, windowEnd }), 0)

  return txAmount + subsAmount + instAmount
}

// 確保卡片的 billingCycles 補齊到「今天所在的這一期」為止，缺的都自動生成。
// 不會動到已經存在的舊紀錄（包含已經手動改過金額或到期日的）。
export function ensureBillingCycles(card, { transactions, plans, today = new Date() }) {
  const billingDay = Number(card.billingDay) || 1
  const graceDays = Number(card.dueDay) || 0
  const cycles = [...(card.billingCycles ?? [])]

  // 沒有任何歷史紀錄：用舊欄位（billPaidMonth／actualBill／dueDate）轉出第一筆，避免資料斷層
  if (cycles.length === 0) {
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
    const lastClose = d >= billingDay ? new Date(y, m, billingDay) : new Date(y, m - 1, billingDay)
    const prevClose = new Date(lastClose.getFullYear(), lastClose.getMonth() - 1, billingDay)
    const cycleKey = cycleKeyOf(lastClose)
    const dueDate = new Date(lastClose)
    dueDate.setDate(dueDate.getDate() + graceDays)

    const amount = Number(card.actualBill) > 0
      ? Number(card.actualBill)
      : snapshotAmount({ card, cardName: card.name, windowStart: prevClose, windowEnd: lastClose, transactions, plans })

    cycles.push({
      id: crypto.randomUUID(),
      cycleKey,
      closeDate: ymd(lastClose),
      dueDate: ymd(dueDate),
      amount,
      amountIsActual: Number(card.actualBill) > 0,
      paid: card.billPaidMonth === `${today.getFullYear()}-${today.getMonth()}`,
      paidAt: null,
    })
  }

  // 從最後一筆紀錄的結帳日開始，往後補到「今天所在的這一期」為止
  let lastCycle = cycles[cycles.length - 1]
  let lastClose = parseYmd(lastCycle.closeDate)
  const currentCloseAnchor = (() => {
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
    return d >= billingDay ? new Date(y, m, billingDay) : new Date(y, m - 1, billingDay)
  })()

  while (lastClose < currentCloseAnchor) {
    const windowStart = lastClose
    const windowEnd = nextCloseDate(lastClose, billingDay)
    const dueDate = new Date(windowEnd)
    dueDate.setDate(dueDate.getDate() + graceDays)

    cycles.push({
      id: crypto.randomUUID(),
      cycleKey: cycleKeyOf(windowEnd),
      closeDate: ymd(windowEnd),
      dueDate: ymd(dueDate),
      amount: snapshotAmount({ card, cardName: card.name, windowStart, windowEnd, transactions, plans }),
      amountIsActual: false,
      paid: false,
      paidAt: null,
    })
    lastClose = windowEnd
  }

  return cycles
}

// 未繳清的週期，依到期日排序（最早到期的在前面）
export function unpaidCycles(card) {
  return [...(card.billingCycles ?? [])]
    .filter((c) => !c.paid && c.amount > 0)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
}

export function totalUnpaid(card) {
  return unpaidCycles(card).reduce((s, c) => s + c.amount, 0)
}

// 逾期天數：用真正的日期相減，不再只比對「號數」，換月也不會誤判
export function daysUntilDue(cycle, today = new Date()) {
  const due = parseYmd(cycle.dueDate)
  const ref = new Date(today)
  ref.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.round((due - ref) / 86400000)
}
