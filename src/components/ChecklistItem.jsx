import './ChecklistItem.css'

export default function ChecklistItem({ item, onToggle, onEdit, onDelete }) {
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }
  return (
    <div
      className={`card cl-item cl-item-clickable${item.done ? ' cl-item-done' : ''}`}
      onClick={() => onEdit(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(item) } }}
    >
      <button
        className={`cl-check${item.done ? ' cl-check-done' : ''}`}
        onClick={stop(() => onToggle(item.id))}
        aria-label={item.done ? '取消規劃' : '標記已規劃'}
      >
        {item.done ? '✓' : ''}
      </button>

      <div className="cl-info">
        <span className="cl-name">{item.name}</span>
        {item.day && <span className="cl-day">每月 {item.day} 號</span>}
      </div>

      <div className="cl-right">
        <span className="cl-amount">NT${Number(item.amount).toLocaleString()}</span>
        <div className="cl-btns">
          <button className="cl-edit" onClick={stop(() => onEdit(item))} aria-label="編輯">✎</button>
          <button className="cl-delete" onClick={stop(() => onDelete(item.id))} aria-label="刪除">✕</button>
        </div>
      </div>
    </div>
  )
}
