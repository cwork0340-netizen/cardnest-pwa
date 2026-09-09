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
import { isPendingReconciliation } from './importSheetSync'

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

  // 訂閱／分期是「這一期算得進去、但還沒有對應刷卡記錄」的金額。逐筆留下來，
  // 這樣下面的明細加總才會剛好等於 App 預估，使用者才有辦法逐行跟銀行帳單核對。
  const subscriptionItems = plans
    .filter((plan) => plan.type === 'subscription' && (plan.active ?? true) && matchesCard(plan, card))
    .map((plan) => ({
      plan,
      amount: planAmountNotRecorded({ plan, transactions, cards, windowStart, windowEnd }),
    }))
    .filter((item) => item.amount !== 0)
  const subscriptionAmount = subscriptionItems.reduce((sum, item) => sum + item.amount, 0)

  const installmentItems = plans
    .filter((plan) => plan.type === 'installment' && matchesCard(plan, card))
    .map((plan) => ({
      plan,
      amount: installmentAmountNotRecordedInWindow({ plan, transactions, cards, windowStart, windowEnd }),
    }))
    .filter((item) => item.amount !== 0)
  const installmentAmount = installmentItems.reduce((sum, item) => sum + item.amount, 0)

  const estimatedAmount = transactionAmount + subscriptionAmount + installmentAmount
  const diff = amount - estimatedAmount
  const pendingImportedCount = cardTransactions
    .filter(isPendingReconciliation)
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

  // 算進這一期的每一筆，加總剛好等於 estimatedAmount。差額不是憑空出現的，
  // 一定是這張清單上某一行跟銀行帳單對不起來，或是銀行帳單上有這裡沒有的一行。
  const includedItems = [
    ...billableTransactions.map((tx) => ({
      key: `tx-${tx.id}`,
      kind: 'transaction',
      date: tx.postedDate || tx.date,
      name: tx.name || '未命名消費',
      amount: Number(tx.amount || 0),
      note: tx.postedDate && tx.postedDate !== tx.date ? `消費 ${tx.date}・入帳 ${tx.postedDate}` : '',
    })),
    ...subscriptionItems.map(({ plan, amount: planAmount }) => ({
      key: `sub-${plan.id}`,
      kind: 'subscription',
      date: '',
      name: plan.name || '訂閱',
      amount: planAmount,
      note: '訂閱推估，還沒有對應的刷卡記錄',
    })),
    ...installmentItems.map(({ plan, amount: planAmount }) => ({
      key: `inst-${plan.id}`,
      kind: 'installment',
      date: '',
      name: plan.name || '分期',
      amount: planAmount,
      note: '分期本期款，還沒有對應的刷卡記錄',
    })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)))

  // 落在這一期、但故意沒算進去的那幾筆。這些正是帳單對不起來時最常見的元凶，
  // 只給一個數字（「N 筆繳款已排除」）使用者還是得自己一筆一筆翻。
  const excludedItems = cardTransactions
    .map((tx) => {
      const consumedAt = parseISODate(tx.date, windowEnd)
      const inWindowByConsumption = consumedAt && consumedAt > windowStart && consumedAt <= windowEnd
      if (isCreditCardPayment(tx) && inWindowByConsumption) {
        return { tx, reason: '繳款，不計入消費' }
      }
      if (isInstallmentConversionCredit(tx) && inWindowByConsumption) {
        return { tx, reason: '轉分期沖銷，不計入消費' }
      }
      if (tx.postedDate && inWindowByConsumption) {
        const postedAt = parseISODate(tx.postedDate, windowEnd)
        if (postedAt && postedAt > windowEnd) return { tx, reason: '入帳日落到下一期' }
      }
      return null
    })
    .filter(Boolean)
    .map(({ tx, reason }) => ({
      key: `ex-${tx.id}`,
      date: tx.date,
      name: tx.name || '未命名消費',
      amount: Number(tx.amount || 0),
      reason,
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

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
    includedItems,
    excludedItems,
    hints,
  }
}
