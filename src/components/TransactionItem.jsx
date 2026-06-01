import './TransactionItem.css'

const CATEGORY_COLORS = {
  餐飲: '#5E7CE2', 購物: '#D49A45', 訂閱: '#6FA37C',
  日常: '#A380C6', 交通: '#D96B5F', 娛樂: '#D49A45', 其他: '#AAA198',
}

export default function TransactionItem({ tx, onDelete }) {
  const dotColor = CATEGORY_COLORS[tx.category] ?? '#AAA198'

  return (
    <div className="tx-item">
      <div className="tx-left">
        <span className="tx-dot" style={{ background: dotColor }} />
        <div className="tx-info">
          <span className="tx-name">{tx.name}</span>
          <span className="tx-meta">{tx.date} · {tx.card}</span>
        </div>
      </div>
      <div className="tx-right">
        <span className="tx-amount">
          -{'NT$' + Number(tx.amount).toLocaleString()}
        </span>
        {tx.note ? <span className="tx-note">{tx.note}</span> : null}
      </div>
      <button className="tx-delete-btn" onClick={() => onDelete(tx.id)} aria-label="刪除">✕</button>
    </div>
  )
}
