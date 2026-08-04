import './CardForecastCard.css'

function fmt(amount) {
  return `NT$${Number(amount || 0).toLocaleString()}`
}

export default function CardForecastCard({ forecast, salarySchedule, monthlyIncome = 0 }) {
  if (!forecast) return null

  return (
    <div className="card-forecast-card">
      <div className="card-forecast-heading">
        <div>
          <span>帳務安排</span>
          <h2>接下來需要準備的錢</h2>
        </div>
        <p>預估會隨入帳與對帳更新</p>
      </div>
      <div className="card-forecast-grid">
        <div className="card-forecast-metric">
          <span>本期應繳</span>
          <strong>{fmt(forecast.statementDue)}</strong>
          <small>已結帳、尚未標記付款</small>
        </div>
        <div className="card-forecast-metric card-forecast-metric--accent">
          <span>下期預估</span>
          <strong>{fmt(forecast.nextEstimate)}</strong>
          <small>本期已刷＋尚未入帳的固定扣款</small>
        </div>
        <div className="card-forecast-metric">
          <span>每月承諾支出</span>
          <strong>{fmt(forecast.commitments)}</strong>
          <small>進行中的訂閱與分期</small>
        </div>
      </div>
      {forecast.hasIncome ? (
        <div className={`card-forecast-safe ${forecast.overCommitted > 0 ? 'card-forecast-safe--warning' : ''}`}>
          <span>{forecast.overCommitted > 0 ? '目前已超出可安排預算' : '本月建議最多再刷'}</span>
          <strong>{fmt(forecast.overCommitted > 0 ? forecast.overCommitted : forecast.safeToSpend)}</strong>
          <small>{forecast.overCommitted > 0
            ? '先調整固定支出、繳款安排或本期消費，再新增刷卡。'
            : '已扣必要支出、本期應繳、目前帳期消費與每月承諾支出。'}</small>
        </div>
      ) : Number(monthlyIncome) > 0 && salarySchedule ? (
        <div className="card-forecast-safe card-forecast-safe--pending">
          <span>薪水尚未入帳，暫不計入可刷額</span>
          <strong>{salarySchedule.payday.getMonth() + 1}/{salarySchedule.payday.getDate()}</strong>
          <small>{salarySchedule.hasOverride ? '依本月實際入帳日計算。' : '依薪資日規則預估；國定假日可在每月規劃填入實際入帳日。'}</small>
        </div>
      ) : (
        <p className="card-forecast-income-hint">填寫月收入後，這裡會替你算出保守的建議可刷額。</p>
      )}
      {forecast.perCard.length > 0 && (
        <div className="card-forecast-cards">
          {forecast.perCard.map((card) => (
            <div key={card.id}>
              <span><i style={{ background: card.color }} />{card.name}</span>
              <span>本期 {fmt(card.statementDue)} · 下期 {fmt(card.nextEstimate)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
