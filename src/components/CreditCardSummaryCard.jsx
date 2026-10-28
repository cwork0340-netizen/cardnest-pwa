import { useState } from 'react'
import './CreditCardSummaryCard.css'
import StatementAmountMode from './StatementAmountMode'
import { carriedInBefore, resolveStatementAmount } from '../utils/billingCycles'

function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

function dueLabel(cycle) {
  const md = `${Number(cycle.dueDate.slice(5, 7))}/${Number(cycle.dueDate.slice(8, 10))}`
  if (cycle.daysLeft < 0) return `到期 ${md}・逾期 ${-cycle.daysLeft} 天`
  if (cycle.daysLeft === 0) return `到期 ${md}・今天到期`
  return `到期 ${md}・還有 ${cycle.daysLeft} 天`
}

function actualDiff(cycle) {
  if (cycle.estimatedAmount == null) return null
  // 銀行金額含上期未繳時，跟 App 的刷卡估算比的是「這期新增」那一部分
  return Number(cycle.amount || 0) - Number(cycle.carriedIn || 0) - Number(cycle.estimatedAmount || 0)
}

function diffLabel(diff) {
  if (diff === 0) return '和 App 預估一致'
  return `和 App 預估差 ${fmt(diff)}`
}

function cycleAuditHints(cycle, cardHints) {
  const diff = actualDiff(cycle)
  if (diff == null || Math.abs(diff) < 1) {
    return ['本期銀行帳單和 App 預估一致，日常信件監控可繼續使用。']
  }

  const hints = [
    '信件只代表刷卡通知，銀行帳單才知道實際入帳、轉分期與繳款結果。',
  ]

  const joinedHints = cardHints.join(' ')
  if (/分期|沖銷|轉分期/.test(joinedHints)) {
    hints.push('這期可能有原刷卡轉分期、分期沖銷或第幾期入帳。')
  }
  if (/繳款|付款/.test(joinedHints)) {
    hints.push('繳款入帳會影響剩餘未繳，但不應該被當成消費。')
  }
  if (/入帳日|請款|未入帳/.test(joinedHints)) {
    hints.push('部分消費可能刷卡日和入帳日不同，會落到不同帳期。')
  }

  hints.push(diff > 0
    ? '銀行帳單比 App 預估高，請優先檢查未匯入信件、手續費或分期本期款。'
    : '銀行帳單比 App 預估低，請優先檢查未入帳、退款、繳款或轉分期沖銷。')

  return hints
}

export default function CreditCardSummaryCard({ card, onMarkPaid, onMarkAllPaid, onUpdateCycle }) {
  const [expanded, setExpanded] = useState(false)
  const [editingCycleId, setEditingCycleId] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [calibratingCycleId, setCalibratingCycleId] = useState(null)
  const [calibration, setCalibration] = useState({ amount: '', closeDate: '', dueDate: '', minDue: '', mode: 'new' })
  const [payingCycleId, setPayingCycleId] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [restoringCycleId, setRestoringCycleId] = useState(null)
  const [restoreAmount, setRestoreAmount] = useState('')

  const unpaid = card.unpaidCycles ?? []
  const recentPaid = card.recentPaidCycles ?? []
  const reconciliationHints = card.reconciliationHints ?? []
  const currentCyclePurchaseAmount = card.currentCyclePurchaseAmount ?? card.currentCycleAmount ?? 0
  const currentCyclePendingAmount = card.currentCyclePendingAmount ?? Math.max(0, currentCyclePurchaseAmount - Number(card.currentCycleAmount ?? 0))
  const spendingWarningTotal = card.spendingWarningTotal
    ?? (currentCyclePurchaseAmount + Number(card.subsOnCard ?? 0) + Number(card.instOnCard ?? 0))

  function startEdit(e, cycle) {
    e.stopPropagation()
    setEditingCycleId(cycle.id)
    setEditDate(cycle.dueDate)
  }

  function saveEdit(e, cycle) {
    e.stopPropagation()
    onUpdateCycle(card.id, cycle.id, { dueDate: editDate })
    setEditingCycleId(null)
  }

  function startCalibration(e, cycle) {
    e.stopPropagation()
    setCalibratingCycleId(cycle.id)
    setCalibration({
      amount: String(cycle.amount ?? ''),
      closeDate: cycle.closeDate ?? '',
      dueDate: cycle.dueDate ?? '',
      minDue: cycle.minDue ? String(cycle.minDue) : '',
      mode: 'new',
    })
  }

  function saveCalibration(e, cycle) {
    e.stopPropagation()
    const closeDate = calibration.closeDate || cycle.closeDate
    const { amount, carriedIn, total } = resolveStatementAmount({ card, cycle, closeDate, raw: calibration.amount, mode: calibration.mode })
    onUpdateCycle(card.id, cycle.id, {
      amount: amount ?? cycle.amount,
      // 填的是含上期未繳的應繳總額時，記下來，畫面才解釋得出「帳單金額」為什麼比銀行小
      statementTotal: total ?? undefined,
      carriedIn: carriedIn > 0 ? carriedIn : undefined,
      minDue: Number(calibration.minDue) > 0 ? Number(calibration.minDue) : undefined,
      closeDate,
      dueDate: calibration.dueDate || cycle.dueDate,
      cycleKey: closeDate?.slice(0, 7) ?? cycle.cycleKey,
      amountIsActual: true,
      manuallyCalibrated: true,
    })
    setCalibratingCycleId(null)
  }

  function startPartialPayment(e, cycle) {
    e.stopPropagation()
    setPayingCycleId(cycle.id)
    setPayAmount('')
  }

  // 這次繳了多少就記多少（會跟之前繳過的累加）。繳不夠的部分不用另外處理：
  // 這期還是未繳、金額只剩沒繳的那一份，跟之後的帳單一起算進待繳。
  function savePartialPayment(e, cycle) {
    e.stopPropagation()
    const paid = Number(payAmount)
    if (!Number.isFinite(paid) || paid <= 0) return
    const totalPaid = Number(cycle.paidAmount ?? 0) + paid
    const d = new Date()
    const paidAt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    onUpdateCycle(card.id, cycle.id, {
      paidAmount: totalPaid,
      ...(totalPaid >= Number(cycle.amount ?? 0) && { paid: true, paidAt }),
    })
    setPayingCycleId(null)
  }

  function startRestore(e, cycle) {
    e.stopPropagation()
    setRestoringCycleId(cycle.id)
    setRestoreAmount('')
  }

  // 按錯「已繳」就改回未繳。如果其實只繳了一部分，可以順便填實際繳了多少
  // （這期已繳的總額），沒繳的部分就會留在待繳帳單。
  function saveRestore(e, cycle) {
    e.stopPropagation()
    const amount = Number(restoreAmount)
    const hasAmount = restoreAmount.trim() !== '' && Number.isFinite(amount) && amount > 0
    if (hasAmount && amount >= Number(cycle.amount ?? 0)) {
      setRestoringCycleId(null)
      return
    }
    onUpdateCycle(card.id, cycle.id, {
      paid: false,
      paidAt: null,
      ...(hasAmount && { paidAmount: amount }),
    })
    setRestoringCycleId(null)
  }

  function calibrationDiff(cycle) {
    const { newAmount } = resolveStatementAmount({ card, cycle, closeDate: calibration.closeDate, raw: calibration.amount, mode: calibration.mode })
    return (newAmount ?? Number(cycle.amount || 0) - Number(cycle.carriedIn || 0)) - Number(cycle.estimatedAmount || 0)
  }

  return (
    <div className="card credit-card-summary" style={{ borderLeftColor: card.color }}>
      <button
        type="button"
        className="credit-card-summary-row"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="credit-card-summary-name-block">
          <div className="credit-card-summary-name">
            <span className="credit-card-summary-dot" style={{ background: card.color }} />
            <span className="credit-card-summary-label">{card.name}</span>
            <span className={`credit-card-summary-chevron${expanded ? ' credit-card-summary-chevron-open' : ''}`}>▾</span>
          </div>
          {card.nextCloseLabel && (
            <span className="credit-card-summary-schedule">
              結帳 {card.nextCloseLabel}・繳款 {card.nextDueLabel}
            </span>
          )}
        </div>
        <div className="credit-card-summary-amounts">
          <div className="credit-card-summary-amount-col">
            <span className="credit-card-summary-amount-label">目前累計刷卡</span>
            <span className="credit-card-summary-amount-value credit-card-summary-amount-value-main">{fmt(spendingWarningTotal)}</span>
          </div>
          <div className="credit-card-summary-amount-col credit-card-summary-amount-col-secondary">
            <span className="credit-card-summary-amount-label">
              待繳帳單{unpaid.length > 1 ? `（${unpaid.length} 期）` : ''}
            </span>
            <span className="credit-card-summary-amount-value">{fmt(card.unpaidTotal ?? 0)}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="credit-card-summary-breakdown">
          {unpaid.length === 0 ? (
            <p className="credit-card-summary-breakdown-note">目前沒有未繳的帳單</p>
          ) : (
            <>
              {unpaid.map((cycle) => (
                <div className="credit-card-cycle-row" key={cycle.id}>
                  <div className="credit-card-cycle-info">
                    <span className="credit-card-cycle-amount">{fmt(cycle.remaining ?? cycle.amount)}</span>
                    {Number(cycle.paidAmount) > 0 && (
                      <span className="credit-card-cycle-partial">
                        帳單 {fmt(cycle.amount)}・已繳 {fmt(cycle.paidAmount)}
                      </span>
                    )}
                    {cycle.carriedIn > 0 && (
                      <span className="credit-card-cycle-partial">
                        銀行應繳總額，已含上期未繳 {fmt(cycle.carriedIn)}
                      </span>
                    )}
                    {cycle.minDue > 0 && (
                      <span className="credit-card-cycle-partial">
                        最低應繳 {fmt(cycle.minDue)}（繳款截止前至少繳這個）
                      </span>
                    )}
                    {editingCycleId === cycle.id ? (
                      <span className="credit-card-cycle-edit" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="date"
                          className="credit-card-cycle-date-input"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                        <button className="credit-card-cycle-save" onClick={(e) => saveEdit(e, cycle)}>存</button>
                      </span>
                    ) : (
                      <button className="credit-card-cycle-due" onClick={(e) => startEdit(e, cycle)}>
                        {dueLabel(cycle)}
                      </button>
                    )}
                    {cycle.manuallyCalibrated && (
                      <span className="credit-card-cycle-calibrated">已用銀行帳單校準</span>
                    )}
                  </div>
                  <div className="credit-card-cycle-actions">
                    <button className="credit-card-cycle-calibrate" onClick={(e) => startCalibration(e, cycle)}>
                      校準
                    </button>
                    <button className="credit-card-cycle-calibrate" onClick={(e) => startPartialPayment(e, cycle)}>
                      部分繳款
                    </button>
                    <button
                      className="credit-card-cycle-pay"
                      onClick={(e) => { e.stopPropagation(); onMarkPaid(cycle.id) }}
                    >
                      已繳
                    </button>
                  </div>
                  {payingCycleId === cycle.id && (
                    <div className="credit-card-cycle-calibration" onClick={(e) => e.stopPropagation()}>
                      <label>
                        這次繳了多少
                        <input
                          type="number"
                          inputMode="numeric"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                        />
                      </label>
                      <span className="credit-card-cycle-diff">
                        還欠 {fmt(cycle.remaining ?? cycle.amount)}。沒繳的部分會留在待繳帳單，累積到下一期一起算。
                      </span>
                      <div className="credit-card-cycle-calibration-actions">
                        <button onClick={(e) => savePartialPayment(e, cycle)}>儲存</button>
                        <button onClick={(e) => { e.stopPropagation(); setPayingCycleId(null) }}>取消</button>
                      </div>
                    </div>
                  )}
                  {calibratingCycleId === cycle.id && (
                    <div className="credit-card-cycle-calibration" onClick={(e) => e.stopPropagation()}>
                      <label>
                        銀行帳單金額
                        <input
                          type="number"
                          inputMode="numeric"
                          value={calibration.amount}
                          onChange={(e) => setCalibration((prev) => ({ ...prev, amount: e.target.value }))}
                        />
                      </label>
                      <StatementAmountMode
                        carriedIn={carriedInBefore(card, calibration.closeDate || cycle.closeDate, cycle.id)}
                        mode={calibration.mode}
                        onChange={(mode) => setCalibration((prev) => ({ ...prev, mode }))}
                      />
                      <label>
                        最低應繳（選填）
                        <input
                          type="number"
                          inputMode="numeric"
                          value={calibration.minDue}
                          onChange={(e) => setCalibration((prev) => ({ ...prev, minDue: e.target.value }))}
                        />
                      </label>
                      <label>
                        實際結帳日
                        <input
                          type="date"
                          value={calibration.closeDate}
                          onChange={(e) => setCalibration((prev) => ({ ...prev, closeDate: e.target.value }))}
                        />
                      </label>
                      <label>
                        實際繳款日
                        <input
                          type="date"
                          value={calibration.dueDate}
                          onChange={(e) => setCalibration((prev) => ({ ...prev, dueDate: e.target.value }))}
                        />
                      </label>
                      {cycle.estimatedAmount != null && (
                        <span className="credit-card-cycle-diff">
                          和 App 原估算差 {fmt(calibrationDiff(cycle))}
                        </span>
                      )}
                      <div className="credit-card-cycle-calibration-actions">
                        <button onClick={(e) => saveCalibration(e, cycle)}>儲存校準</button>
                        <button onClick={(e) => { e.stopPropagation(); setCalibratingCycleId(null) }}>取消</button>
                      </div>
                    </div>
                  )}
                  {cycle.manuallyCalibrated && cycle.estimatedAmount != null && (
                    <div className="credit-card-cycle-audit">
                      <div className="credit-card-cycle-audit-grid">
                        <span>銀行實際{cycle.carriedIn > 0 ? '（本期新增）' : ''}</span>
                        <strong>{fmt(Number(cycle.amount || 0) - Number(cycle.carriedIn || 0))}</strong>

                        <span>App 原估</span>
                        <strong>{fmt(cycle.estimatedAmount)}</strong>
                        <span>差異</span>
                        <strong className={actualDiff(cycle) === 0 ? '' : 'credit-card-cycle-audit-diff'}>
                          {diffLabel(actualDiff(cycle))}
                        </strong>
                      </div>
                      <div className="credit-card-cycle-audit-hints">
                        {cycleAuditHints(cycle, reconciliationHints).map((hint) => (
                          <span key={hint}>{hint}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {unpaid.length > 1 && (
                <button
                  className="credit-card-cycle-pay-all"
                  onClick={(e) => { e.stopPropagation(); onMarkAllPaid(card.id) }}
                >
                  全部標記已繳
                </button>
              )}
            </>
          )}

          {recentPaid.length > 0 && (
            <>
              <p className="credit-card-summary-breakdown-note">最近已繳的帳單（按錯可以改回來）：</p>
              {recentPaid.map((cycle) => (
                <div className="credit-card-cycle-row" key={cycle.id}>
                  <div className="credit-card-cycle-info">
                    <span className="credit-card-cycle-amount">{fmt(cycle.amount)}</span>
                    <span className="credit-card-cycle-partial">
                      結帳 {cycle.closeDate}{cycle.paidAt ? `・已繳 ${cycle.paidAt}` : '・已繳'}
                    </span>
                  </div>
                  <div className="credit-card-cycle-actions">
                    <button className="credit-card-cycle-calibrate" onClick={(e) => startRestore(e, cycle)}>
                      改回未繳
                    </button>
                  </div>
                  {restoringCycleId === cycle.id && (
                    <div className="credit-card-cycle-calibration" onClick={(e) => e.stopPropagation()}>
                      <label>
                        其實只繳了多少（沒繳就留空）
                        <input
                          type="number"
                          inputMode="numeric"
                          value={restoreAmount}
                          onChange={(e) => setRestoreAmount(e.target.value)}
                        />
                      </label>
                      <span className="credit-card-cycle-diff">
                        這期會回到未繳；有填金額的話，帳單 {fmt(cycle.amount)} 扣掉已繳的，剩下的留在待繳帳單。
                      </span>
                      <div className="credit-card-cycle-calibration-actions">
                        <button onClick={(e) => saveRestore(e, cycle)}>改回未繳</button>
                        <button onClick={(e) => { e.stopPropagation(); setRestoringCycleId(null) }}>取消</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          <p className="credit-card-summary-breakdown-note">App 估算帳單組成：</p>
          {reconciliationHints.length > 0 && (
            <div className="credit-card-reconcile-box">
              <span className="credit-card-reconcile-title">對帳提示</span>
              {reconciliationHints.map((hint) => (
                <span className="credit-card-reconcile-hint" key={hint}>{hint}</span>
              ))}
            </div>
          )}
          <div className="credit-card-summary-breakdown-row">
            <span>目前刷卡紀錄</span>
            <span>{fmt(currentCyclePurchaseAmount)}</span>
          </div>
          <div className="credit-card-summary-breakdown-row">
            <span>銀行已入帳</span>
            <span>{fmt(card.currentCycleAmount ?? 0)}</span>
          </div>
          <div className="credit-card-summary-breakdown-row">
            <span>待確認入帳</span>
            <span>{fmt(currentCyclePendingAmount)}</span>
          </div>
          <div className="credit-card-summary-breakdown-row">
            <span>訂閱小計</span>
            <span>{fmt(card.subsOnCard ?? 0)}</span>
          </div>
          <div className="credit-card-summary-breakdown-row">
            <span>分期小計</span>
            <span>{fmt(card.instOnCard ?? 0)}</span>
          </div>
          <div className="credit-card-summary-breakdown-row credit-card-summary-breakdown-total">
            <span>預警合計</span>
            <span>{fmt(spendingWarningTotal)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
