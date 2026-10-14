import './More.css'

const ITEMS = [
  { id: 'checklist', title: '規劃', sub: '收入、必要支出、訂閱與分期、儲蓄' },
  { id: 'settings', title: '設定', sub: '信用卡、信件匯入、同步、備份' },
]

export default function More({ onOpen }) {
  return (
    <div className="more-page">
      <h1 className="more-title">更多</h1>
      <ul className="more-list">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <button type="button" className="more-row" aria-label={item.title} onClick={() => onOpen(item.id)}>
              <span className="more-row-text">
                <span className="more-row-title">{item.title}</span>
                <span className="more-row-sub">{item.sub}</span>
              </span>
              <span className="more-row-chevron" aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
