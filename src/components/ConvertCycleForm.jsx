import { useState } from 'react'
import { parseISODate, toISODate } from '../utils/financeData'

function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

// 把一期帳單裡還沒繳的金額，向銀行申請「帳單分期」之後，在這裡記下來：
// 這期的待繳扣掉轉出的金額，並新增一筆分期（出現在固定扣款）。
// 每期的實際金額與利息以銀行帳單為準；這裡只是用總額均分，最後一期補差額。
export default function ConvertCycleForm({ card, cycle, remaining, onSubmit, onCancel }) {
  const [total, setTotal] = useState(String(remaining))
  const [count, setCount] = useState('3')
  const [firstDate, setFirstDate] = useState(() => toISODate())
  const [firstBilled, setFirstBilled] = useState(true)
  const [apr, setApr] = useState('')
  const [error, setError] = useState('')

  const amount = Number(total) || 0
  const periods = Number(count) || 0
  const regular = periods > 0 ? Math.floor(amount / periods) : 0
  const last = periods > 0 ? amount - regular * (periods - 1) : 0

  function submit(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!(amount > 0)) return setError('請填寫轉分期的金額')
    if (amount > remaining) return setError(`最多只能轉這期還欠的 ${fmt(remaining)}`)
    if (!Number.isInteger(periods) || periods < 2) return setError('分期期數至少為 2 期')
    const first = parseISODate(firstDate)
    if (!first) return setError('請填寫首期列帳日')

    onSubmit({
      plan: {
        id: crypto.randomUUID(),
        type: 'installment',
        name: '帳單分期',
        cardId: card.id,
        card: card.name,
        currency: 'TWD',
        amount: regular,
        totalAmount: amount,
        period: '期',
        billingDay: first.getDate(),
        firstDueDate: toISODate(firstDate),
        conversionDate: toISODate(),
        // 第 1 期已經列在最新一張帳單裡，那張帳單繳掉就算繳過：剩餘期數才會跟銀行一致
        paidCount: firstBilled ? 1 : 0,
        totalCount: periods,
        paid: false,
        convertedFromCycleId: cycle.id,
        ...(Number(apr) > 0 && { apr: Number(apr) }),
      },
      amount,
    })
  }

  return (
    <form className="credit-card-cycle-calibration" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
      <label>
        轉分期的金額（這期還欠 {fmt(remaining)}）
        <input type="number" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />
      </label>
      <label>
        分期期數
        <input type="number" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
      </label>
      {periods >= 2 && amount > 0 && (
        <span className="credit-card-cycle-diff">前 {periods - 1} 期 {fmt(regular)}，末期 {fmt(last)}（利息另計，以銀行帳單為準）</span>
      )}
      <label>
        第 1 期列帳日（帳單上「帳單分期 01/{String(periods || 3).padStart(2, '0')}」那一天）
        <input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} />
      </label>
      <label className="convert-cycle-check">
        <input type="checkbox" checked={firstBilled} onChange={(e) => setFirstBilled(e.target.checked)} />
        第 1 期已經列在最新一張帳單裡
      </label>
      <label>
        年百分率（選填，例如 14.4）
        <input type="number" inputMode="decimal" value={apr} onChange={(e) => setApr(e.target.value)} />
      </label>
      {error && <span className="credit-card-cycle-diff" role="alert">{error}</span>}
      <div className="credit-card-cycle-calibration-actions">
        <button type="submit">確認轉分期</button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onCancel() }}>取消</button>
      </div>
    </form>
  )
}
