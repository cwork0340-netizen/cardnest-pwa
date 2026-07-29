import './TransactionItem.css'

const CATEGORY_COLORS = {
  餐飲: '#A98274', 購物: '#D6A04D', 訂閱: '#8DAA91',
  日常: '#B98D6F', 交通: '#C86E62', 娛樂: '#D6A04D', 其他: '#B9ADA6',
}

function isImported(tx) {
  return String(tx.note ?? '').includes('自動匯入')
}

function sourceLabel(tx) {
  return isImported(tx) ? '信件匯入' : '手動'
}

function auditLabel(tx) {
  if (!isImported(tx)) return '自行確認'
  if (tx.postedDate) return '有入帳日'
  return '待對帳'
}

export default function TransactionItem({ tx, onDelete, onEdit, onConvert }) {
  const dotColor = CATEGORY_COLORS[tx.category] ?? '#B9ADA6'

  return (
    <div
      className="tx-item tx-item-clickable"
      onClick={() => onEdit(tx)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(tx) } }}
    >
      <div className="tx-left">
        <span className="tx-dot" style={{ background: dotColor }} />
        <div className="tx-info">
          <span className="tx-name">{tx.name}</span>
          <span className="tx-meta">{tx.date} · {tx.card}</span>
          <span className="tx-badges">
            <span className={`tx-badge${isImported(tx) ? ' tx-badge-imported' : ''}`}>{sourceLabel(tx)}</span>
            <span className={`tx-badge${tx.postedDate ? ' tx-badge-posted' : ''}`}>{auditLabel(tx)}</span>
          </span>
        </div>
      </div>
      <div className="tx-right">
        <span className="tx-amount">
          -{'NT$' + Number(tx.amount).toLocaleString()}
        </span>
        {tx.note ? <span className="tx-note">{tx.note}</span> : null}
      </div>
      <div className="tx-action-btns">
        {onConvert && (
          <button className="tx-convert-btn" onClick={(e) => { e.stopPropagation(); onConvert(tx) }} aria-label="轉為分期">轉分期</button>
        )}
        <button className="tx-edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(tx) }} aria-label="編輯">✎</button>
        <button className="tx-delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(tx.id) }} aria-label="刪除">✕</button>
      </div>
    </div>
  )
}
