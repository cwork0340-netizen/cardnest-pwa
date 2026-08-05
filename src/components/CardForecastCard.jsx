import { useState } from 'react'
import './CardForecastCard.css'

function fmt(amount) {
  return `NT$${Number(amount || 0).toLocaleString()}`
}

export default function CardForecastCard({ forecast, salarySchedule, monthlyIncome = 0 }) {
  const [showDetails, setShowDetails] = useState(false)
  if (!forecast) return null

  return (
    <div className="card-forecast-card">
      <div className="card-forecast-heading">
        <div>
          <span>帳務安排</span>
          <h2>要準備的錢</h2>
        </div>
        {forecast.perCard.length > 0 && (
          <button className="card-forecast-detail-btn" onClick={() => setShowDetails((value) => !value)}>
            {showDetails ? '收合' : '明細'}
          </button>
        )}
      </div>
      <div className="card-forecast-grid">
        <div className="card-forecast-metric">
          <span>本期</span>
          <strong>{fmt(forecast.statementDue)}</strong>
        </div>
        <div className="card-forecast-metric card-forecast-metric--accent">
          <span>下張預估</span>
          <strong>{fmt(forecast.nextEstimate)}</strong>
        </div>
        <div className="card-forecast-metric">
          <span>固定</span>
          <strong>{fmt(forecast.commitments)}</strong>
        </div>
      </div>
      {forecast.hasIncome ? (
        <div className={`card-forecast-safe ${forecast.overCommitted > 0 ? 'card-forecast-safe--warning' : ''}`}>
          <span>{forecast.overCommitted > 0 ? '目前已超出可安排預算' : '本月建議最多再刷'}</span>
          <strong>{fmt(forecast.overCommitted > 0 ? forecast.overCommitted : forecast.safeToSpend)}</strong>
        </div>
      ) : Number(monthlyIncome) > 0 && salarySchedule ? (
        <div className="card-forecast-safe card-forecast-safe--pending">
          <span>薪水尚未入帳</span>
          <strong>{salarySchedule.payday.getMonth() + 1}/{salarySchedule.payday.getDate()}</strong>
        </div>
      ) : (
        <p className="card-forecast-income-hint">填月收入後顯示可刷額</p>
      )}
      {showDetails && forecast.perCard.length > 0 && (
        <div className="card-forecast-cards">
          {forecast.perCard.map((card) => (
            <div key={card.id}>
              <span><i style={{ background: card.color }} />{card.name}</span>
              <span>本期 {fmt(card.statementDue)} · 下張 {fmt(card.nextEstimate)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
