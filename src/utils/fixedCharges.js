import { paidCountOf } from './installmentCycles'

// 固定扣款：每個月不管你刷不刷卡，都會自動被扣的錢（訂閱＋分期）。
// 這個頁面的目的是讓「看不見的負債」變得看得見：每月合計、占收入比、分期還剩多少、什麼時候會釋放出來。
//
// 規則（全部在這裡，畫面不另外算）：
//   訂閱：啟用中的每月金額（年繳的除以 12）。
//   分期：還有剩餘期數的，每期金額；剩餘期數 = 總期數 − 已繳期數（跟規劃頁、未償負債同一個算法）。
//   未來 12 個月：訂閱每月都有；分期從這個月起連續 剩餘期數 個月，之後消失。

const MONTHS = 12

function monthOf(today, offset) {
  const d = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function formatMonth(m, today = new Date()) {
  return m.year === today.getFullYear() ? `${m.month} 月` : `${m.year}/${m.month}`
}

export function subscriptionMonthly(plan) {
  const amount = Number(plan.amount) || 0
  return plan.period === '年' ? Math.round(amount / 12) : amount
}

export function buildFixedCharges(plans = [], { today = new Date(), income = 0 } = {}) {
  const subscriptions = plans
    .filter((p) => p.type === 'subscription' && (p.active ?? true))
    .map((p) => ({ id: p.id, name: p.name, card: p.card, monthly: subscriptionMonthly(p), yearly: subscriptionMonthly(p) * 12 }))
    .filter((s) => s.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly)

  const installments = plans
    .filter((p) => p.type === 'installment')
    .map((p) => {
      const remaining = Math.max(0, (Number(p.totalCount) || 0) - paidCountOf(p))
      const amount = Number(p.amount) || 0
      return { id: p.id, name: p.name, card: p.card, amount, remaining, remainingTotal: remaining * amount, end: remaining > 0 ? monthOf(today, remaining - 1) : null }
    })
    .filter((p) => p.remaining > 0 && p.amount > 0)
    .sort((a, b) => a.remaining - b.remaining)

  const subsTotal = subscriptions.reduce((s, x) => s + x.monthly, 0)
  const timeline = Array.from({ length: MONTHS }, (_, i) => ({
    ...monthOf(today, i),
    total: subsTotal + installments.filter((p) => i < p.remaining).reduce((s, p) => s + p.amount, 0),
  }))

  // 每月合計下降的月份：什麼時候會少一筆
  const releases = []
  for (let i = 1; i < MONTHS; i++) {
    const drop = timeline[i - 1].total - timeline[i].total
    if (drop > 0) releases.push({ ...timeline[i], amount: drop, names: installments.filter((p) => p.remaining === i).map((p) => p.name) })
  }

  const monthly = timeline[0].total
  const share = income > 0 ? monthly / income : null
  return {
    monthly,
    yearly: monthly * 12,
    share,
    // 占收入比的燈號：≤10% 正常、≤20% 偏高、更高為過高（經驗值，不是銀行規定）
    level: share == null ? null : share <= 0.1 ? 'ok' : share <= 0.2 ? 'warn' : 'danger',
    debtRemaining: installments.reduce((s, p) => s + p.remainingTotal, 0),
    subscriptions,
    installments,
    timeline,
    releases,
  }
}
