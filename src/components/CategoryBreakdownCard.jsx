import './CategoryBreakdownCard.css'

const MAX_SLICES = 5

export default function CategoryBreakdownCard({ categories }) {
  const top = categories.slice(0, MAX_SLICES)
  const totalPercent = top.reduce((s, c) => s + c.percent, 0)

  let cumulative = 0
  const stops = top.map((cat) => {
    const start = totalPercent > 0 ? (cumulative / totalPercent) * 100 : 0
    cumulative += cat.percent
    const end = totalPercent > 0 ? (cumulative / totalPercent) * 100 : 0
    return `${cat.color} ${start}% ${end}%`
  })
  const donutStyle = stops.length > 0
    ? { background: `conic-gradient(${stops.join(', ')})` }
    : { background: 'var(--divider)' }

  return (
    <div className="card category-breakdown">
      <div className="category-donut-wrap">
        <div className="category-donut" style={donutStyle}>
          <div className="category-donut-hole" />
        </div>
      </div>
      {top.map((cat) => (
        <div key={cat.name} className="category-row">
          <div className="category-row-left">
            <span
              className="category-dot"
              style={{ background: cat.color }}
            />
            <span className="category-name">{cat.name}</span>
          </div>
          <div className="category-row-right">
            <span className="category-amount">
              {'NT$' + Number(cat.amount).toLocaleString()}
            </span>
            <span className="category-percent">{cat.percent}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}
