import './TrendChartCard.css'

export default function TrendChartCard({ trends }) {
  if (!trends || trends.length === 0) return null

  const n = trends.length
  const amounts = trends.map(t => t.amount)
  const max = Math.max(...amounts)
  const min = Math.min(...amounts)
  const range = max - min || 1

  const points = trends.map((t, i) => ({
    x: i * (280 / (n - 1)),
    y: 72 - ((t.amount - min) / range) * 60,
    month: t.month,
    amount: t.amount,
  }))

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ')
  const last = points[points.length - 1]

  return (
    <div className="card trend-chart-card">
      <svg viewBox="0 0 280 88" width="100%" style={{ display: 'block' }}>
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          i === points.length - 1 ? (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="var(--color-primary)"
            />
          ) : null
        ))}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y="86"
            textAnchor="middle"
            fontSize="9"
            fill="var(--color-text-muted)"
          >
            {p.month}
          </text>
        ))}
      </svg>
    </div>
  )
}
