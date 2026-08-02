import { clampDayInMonth } from './recurrence'
import {
  installmentAmountNotRecordedInWindow,
  isBillableTransaction,
  isCreditCardPayment,
  isInstallmentConversionCredit,
  matchesCard,
  parseISODate,
  planAmountNotRecorded,
  transactionCycleDate,
} from './financeData'

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function previousCloseFromCard(card, closeDate) {
  const close = parseISODate(closeDate)
  if (!close) return null

  const earlierCycles = [...(card?.billingCycles ?? [])]
    .filter((cycle) => cycle.closeDate && cycle.closeDate < closeDate)
    .sort((a, b) => b.closeDate.localeCompare(a.closeDate))

  if (earlierCycles[0]?.closeDate) return parseISODate(earlierCycles[0].closeDate, close)

  const billingDay = Number(card?.billingDay) || close.getDate()
  const y = close.getFullYear()
  const m = close.getMonth() - 1
  return new Date(y, m, clampDayInMonth(y, m, billingDay))
}

function txDateInWindow(tx, windowStart, windowEnd) {
  const date = parseISODate(transactionCycleDate(tx), windowEnd)
  return date && date > windowStart && date <= windowEnd
}

export function buildStatementCalibration({
  card,
  cards,
  transactions,
  plans,
  cycle,
  closeDate,
  statementAmount,
}) {
  const amount = Number(statementAmount)
  const windowEnd = parseISODate(closeDate)
  const windowStart = previousCloseFromCard(card, closeDate)

  if (!card || !cycle || !windowStart || !windowEnd || !Number.isFinite(amount)) {
    return null
  }

  const cardTransactions = transactions.filter((tx) => matchesCard(tx, card))
  const billableTransactions = cardTransactions
    .filter(isBillableTransaction)
    .filter((tx) => txDateInWindow(tx, windowStart, windowEnd))

  const transactionAmount = billableTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  const subscriptionAmount = plans
    .filter((plan) => plan.type === 'subscription' && (plan.active ?? true) && matchesCard(plan, card))
    .reduce((sum, plan) => sum + planAmountNotRecorded({
      plan,
      transactions,
      cards,
      windowStart,
      windowEnd,
    }), 0)

  const installmentAmount = plans
    .filter((plan) => plan.type === 'installment' && matchesCard(plan, card))
    .reduce((sum, plan) => sum + installmentAmountNotRecordedInWindow({
      plan,
      transactions,
      cards,
      windowStart,
      windowEnd,
    }), 0)

  const estimatedAmount = transactionAmount + subscriptionAmount + installmentAmount
  const diff = amount - estimatedAmount
  const pendingImportedCount = cardTransactions
    .filter((tx) => String(tx.note ?? '').includes('自動匯入') && !tx.postedDate)
    .filter((tx) => {
      const date = parseISODate(tx.date, windowEnd)
      return date && date > windowStart && date <= windowEnd
    }).length
  const movedToNextCycleCount = cardTransactions
    .filter((tx) => tx.postedDate)
    .filter((tx) => {
      const consumedAt = parseISODate(tx.date, windowEnd)
      const postedAt = parseISODate(tx.postedDate, windowEnd)
      return consumedAt && postedAt && consumedAt <= windowEnd && postedAt > windowEnd
    }).length
  const paymentCount = cardTransactions.filter(isCreditCardPayment).length
  const installmentCreditCount = cardTransactions.filter(isInstallmentConversionCredit).length

  const hints = []
  if (Math.abs(diff) < 1) {
    hints.push('銀行帳單和 App 估算一致。')
  } else {
    hints.push(diff > 0
      ? '銀行帳單比 App 高，優先檢查未匯入信件、手續費或本期分期款。'
      : '銀行帳單比 App 低，優先檢查尚未入帳、退款、繳款或轉分期沖銷。')
  }
  if (pendingImportedCount > 0) hints.push(`${pendingImportedCount} 筆信件匯入還沒有銀行入帳日，可能還不能算進本期。`)
  if (movedToNextCycleCount > 0) hints.push(`${movedToNextCycleCount} 筆消費日落在本期，但入帳日已落到下期。`)
  if (installmentCreditCount > 0) hints.push(`${installmentCreditCount} 筆分期轉換沖銷已排除，請用銀行帳單確認第幾期開始入帳。`)
  if (paymentCount > 0) hints.push(`${paymentCount} 筆繳款已排除消費計算，避免把還款當刷卡。`)

  return {
    windowStart: ymd(windowStart),
    windowEnd: ymd(windowEnd),
    statementAmount: amount,
    estimatedAmount,
    diff,
    transactionAmount,
    subscriptionAmount,
    installmentAmount,
    pendingImportedCount,
    movedToNextCycleCount,
    paymentCount,
    installmentCreditCount,
    hints,
  }
}
