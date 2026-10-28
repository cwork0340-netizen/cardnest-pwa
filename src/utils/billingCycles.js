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

function previousCloseDate(closeDate, billingDay) {
  const year = closeDate.getFullYear()
  const month = closeDate.getMonth() - 1
  const previousYear = year + (month < 0 ? -1 : 0)
  const previousMonth = (month + 12) % 12
  return new Date(previousYear, previousMonth, clampDayInMonth(previousYear, previousMonth, billingDay))
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

    const estimatedAmount = snapshotAmount({ card, cardName: card.name, windowStart: prevClose, windowEnd: lastClose, transactions, plans })
    const amount = Number(card.actualBill) > 0
      ? Number(card.actualBill)
      : estimatedAmount

    cycles.push({
      id: crypto.randomUUID(),
      cycleKey,
      closeDate: ymd(lastClose),
      dueDate: ymd(dueDate),
      amount,
      estimatedAmount,
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

    const estimatedAmount = snapshotAmount({ card, cardName: card.name, windowStart, windowEnd, transactions, plans })
    cycles.push({
      id: crypto.randomUUID(),
      cycleKey: cycleKeyOf(windowEnd),
      closeDate: ymd(windowEnd),
      dueDate: ymd(dueDate),
      amount: estimatedAmount,
      estimatedAmount,
      amountIsActual: false,
      paid: false,
      paidAt: null,
    })
    lastClose = windowEnd
  }

  return cycles
}

// 一期還沒被確認過的金額，永遠用當下的刷卡記錄重算，不要停在結帳那一刻。
//
// 凍結只對「人確認過的數字」有意義：已繳、或已用銀行帳單校準過的期別是事實，
// 不能被之後的刷卡記錄變動蓋掉。但一個還沒人確認的估算沒有理由凍結——晚到的
// 對帳信件、事後補登的消費、改掉的入帳日，都會落在早就結帳的窗口裡，凍結的話
// 那些錢就永遠進不了待繳帳單，跟同一張卡即時重算的「App 估算合計」對不起來。
//
// 這裡只回傳覆蓋後的副本，不寫回 state：算給畫面看就好，存起來只會再度過期。
export function withLiveCycleEstimates(card, { transactions = [], plans = [] } = {}) {
  const cycles = dedupeCyclesByCloseDate(card?.billingCycles ?? [])
  if (cycles.length === 0) return card

  const billingDay = Number(card.billingDay) || 1
  const byCloseDate = [...cycles].sort((a, b) => String(a.closeDate).localeCompare(String(b.closeDate)))

  return {
    ...card,
    billingCycles: cycles.map((cycle) => {
      if (cycle.paid || cycle.amountIsActual || cycle.manuallyCalibrated) return cycle
      const closeDate = parseYmd(cycle.closeDate)
      if (!closeDate) return cycle

      // 窗口起點優先用「上一期實際的結帳日」，校準改過結帳日之後才對得起來；
      // 沒有上一期才退回用結帳日往前推一個月。
      const earlier = byCloseDate.filter((item) => item.closeDate < cycle.closeDate).pop()
      const windowStart = earlier ? parseYmd(earlier.closeDate) : previousCloseDate(closeDate, billingDay)

      const amount = snapshotAmount({
        card,
        cardName: card.name,
        windowStart,
        windowEnd: closeDate,
        transactions,
        plans,
      })
      return { ...cycle, amount, estimatedAmount: amount }
    }),
  }
}

// 這張卡最近一次已經結帳的日期（YYYY-MM-DD）：看實際存在的帳單週期，所以校準過的結帳日也算。
// 還沒有任何帳單週期紀錄時回傳 null，由呼叫的人退回用「結帳日」推算。
export function latestCloseDate(card, today = new Date()) {
  const limit = ymd(today)
  const dates = (card?.billingCycles ?? []).map((c) => c.closeDate).filter((d) => d && d <= limit).sort()
  return dates.length ? dates[dates.length - 1] : null
}

// 同一個結帳日只該有一期（一個結帳日只會有一張帳單）。校準時把結帳日改成跟另一期相同、
// 或舊資料留下的重複，都只留一筆，不然同一張帳單會被算兩次。
// 留哪一筆：已繳 > 校準過 > 銀行實際金額 > 其他估算；同等級取較後面的。
export function dedupeCyclesByCloseDate(cycles = []) {
  const rank = (c) => (c.paid ? 3 : c.manuallyCalibrated ? 2 : c.amountIsActual ? 1 : 0)
  const best = new Map()
  for (const c of cycles) {
    if (!c.closeDate) continue
    const current = best.get(c.closeDate)
    if (!current || rank(c) >= rank(current)) best.set(c.closeDate, c)
  }
  return cycles.filter((c) => !c.closeDate || best.get(c.closeDate) === c)
}

// 這一期還欠多少：帳單金額扣掉已經繳過的部分。沒有 paidAmount 的舊資料，
// 剩下的就是整張帳單，跟以前完全一樣。
export function cycleRemaining(cycle) {
  return Math.max(0, Number(cycle?.amount ?? 0) - Number(cycle?.paidAmount ?? 0))
}

// 未繳清的週期，依到期日排序（最早到期的在前面）。amount 仍是帳單金額，
// remaining 才是還要繳的；只繳一部分的那期沒繳的錢會一直留著，累積到後面的帳單。
export function unpaidCycles(card) {
  return dedupeCyclesByCloseDate(card.billingCycles ?? [])
    .filter((c) => !c.paid && !c.rolledInto && cycleRemaining(c) > 0)
    .map((c) => ({ ...c, remaining: cycleRemaining(c) }))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
}

export function totalUnpaid(card) {
  return unpaidCycles(card).reduce((s, c) => s + c.remaining, 0)
}

// 這一期結帳之前、還沒繳清的前幾期，合計還欠多少。銀行帳單的「本期應繳總額」會把這筆
// 上期未繳一起算進去；App 的待繳帳單是「各期剩餘」相加，所以校準時要知道這個數字，
// 才不會把同一筆錢算兩次。
export function carriedInBefore(card, closeDate, excludeId = null) {
  return dedupeCyclesByCloseDate(card?.billingCycles ?? [])
    // 已經併進別張帳單的前期不再算；併進「這一期」的仍然算（重新校準時還要看得到）
    .filter((c) => c.id !== excludeId && c.closeDate < closeDate && !c.paid && cycleRemaining(c) > 0 && (!c.rolledInto || c.rolledInto === excludeId))
    .reduce((s, c) => s + cycleRemaining(c), 0)
}

// 校準時，使用者輸入的銀行金額是哪一種：
//   new   ＝ 本期新增（只有這個結帳週期刷的錢），這一期就記這個金額，前面沒繳完的另外算
//   total ＝ 本期應繳總額（銀行已經把上期沒繳完的錢算進去），這一期就記這個金額，
//           前面沒繳完的那幾期併進這一期，不再另外算（見 applyCycleUpdate）
// 有上期未繳時才需要選；沒有的話兩種一樣，不顯示。
// amount 是要存的帳單金額；newAmount 是「這期新增了多少」，拿來跟 App 的刷卡估算比對。
export function resolveStatementAmount({ card, cycle, closeDate, raw, mode }) {
  const entered = Number(raw)
  const carriedIn = carriedInBefore(card, closeDate || cycle.closeDate, cycle.id)
  if (!Number.isFinite(entered) || String(raw).trim() === '') return { amount: null, newAmount: null, carriedIn, total: null }
  if (mode === 'total' && carriedIn > 0) return { amount: entered, newAmount: entered - carriedIn, carriedIn, total: entered }
  return { amount: entered, newAmount: entered, carriedIn: 0, total: null }
}

// 逾期天數：用真正的日期相減，不再只比對「號數」，換月也不會誤判
export function daysUntilDue(cycle, today = new Date()) {
  const due = parseYmd(cycle.dueDate)
  const ref = new Date(today)
  ref.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.round((due - ref) / 86400000)
}

export function applyCycleUpdate(cycles = [], cycleId, fields = {}) {
  let updated = cycles.map(cycle => cycle.id === cycleId ? { ...cycle, ...fields } : cycle)

  // 校準表單：填的是含上期未繳的應繳總額時，前面還沒繳清的那幾期併進這一期（銀行帳單已經包含它們）；
  // 改回「本期新增」就放回來。
  if ('statementTotal' in fields) {
    const target = updated.find((c) => c.id === cycleId)
    const rolled = Number(fields.carriedIn) > 0
    updated = updated.map((c) => {
      if (c.id === cycleId) return c
      if (rolled && !c.paid && !c.rolledInto && cycleRemaining(c) > 0 && c.closeDate < target.closeDate) return { ...c, rolledInto: cycleId }
      if (!rolled && c.rolledInto === cycleId) { const { rolledInto, ...rest } = c; void rolledInto; return rest }
      return c
    })
  }

  if (!fields.manuallyCalibrated || !fields.closeDate) return updated

  const calibratedClose = parseYmd(fields.closeDate)
  return updated.filter((cycle) => {
    if (cycle.id === cycleId) return true
    const closeDate = parseYmd(cycle.closeDate)
    // 校準後的結帳日剛好是另一期的結帳日：那是同一張帳單，沒確認過的估算那一期就不留了
    if (closeDate.getTime() === calibratedClose.getTime()) return cycle.paid || cycle.manuallyCalibrated || cycle.amountIsActual
    return closeDate < calibratedClose || cycle.paid || cycle.manuallyCalibrated || cycle.amountIsActual
  })
}
