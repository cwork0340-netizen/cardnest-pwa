import './MonthlyBalanceCard.css'

function fmt(amount) {
  return 'NT$' + Number(amount).toLocaleString()
}

export default function MonthlyBalanceCard({
  income = 0,
  essentialTotal = 0,
  cardEstimateTotal = 0,
  lifeBalance = 0,
  onGoToChecklist,
}) {
  if (income <= 0) {
    return (
      <div className="mb-card">
        <div className="mb-card-label">本月餘額</div>
        <button className="mb-card-fill-income" onClick={onGoToChecklist}>
          先填月收入才能看餘額 →
        </button>
      </div>
    )
  }

  const isNegative = lifeBalance < 0

  return (
    <div className={`mb-card${isNegative ? ' mb-card--danger' : ''}`}>
      <div className="mb-card-label">本月餘額</div>
      <div className="mb-card-amount">
        {isNegative ? '－' : ''}{fmt(Math.abs(lifeBalance))}
      </div>
      <div className="mb-card-status">
        {isNegative ? '超出，沒有餘裕' : '這個月真正能運用的錢'}
      </div>

      <div className="mb-card-breakdown">
        <span>收入 {fmt(income)}</span>
        <span>－ 必要支出（含預留）{fmt(essentialTotal)}</span>
        <span>－ 信用卡預估帳單 {fmt(cardEstimateTotal)}</span>
      </div>

      {!isNegative && lifeBalance > 0 && (
        <div className="mb-card-actions">
          <span className="mb-card-hint">還有剩餘，要怎麼安排？</span>
          <div className="mb-card-btn-row">
            <button className="mb-card-btn" onClick={onGoToChecklist}>額外存起來</button>
            <button className="mb-card-btn" onClick={onGoToChecklist}>增加必要支出</button>
          </div>
        </div>
      )}

      {isNegative && (
        <button className="mb-card-fill-income" onClick={onGoToChecklist}>
          去調整必要支出或儲蓄 →
        </button>
      )}
    </div>
  )
}
