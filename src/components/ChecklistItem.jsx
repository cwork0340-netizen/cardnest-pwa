import './ChecklistItem.css'

export default function ChecklistItem({ item, onToggle, onEdit, onDelete }) {
  return (
    <div className={`card cl-item${item.done ? ' cl-item-done' : ''}`}>
      <button
        className={`cl-check${item.done ? ' cl-check-done' : ''}`}
        onClick={() => onToggle(item.id)}
        aria-label={item.done ? '取消已繳標記' : '標記已繳'}
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
          <button className="cl-edit" onClick={() => onEdit(item)} aria-label="編輯">✎</button>
          <button className="cl-delete" onClick={() => onDelete(item.id)} aria-label="刪除">✕</button>
        </div>
      </div>
    </div>
  )
}
