import './CategoryBreakdownCard.css'

export default function CategoryBreakdownCard({ categories }) {
  return (
    <div className="card category-breakdown">
      {categories.map((cat, index) => (
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
