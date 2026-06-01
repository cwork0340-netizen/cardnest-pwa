import './NoticeItem.css'

const STATUS_DOT_COLOR = {
  danger: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  neutral: 'var(--color-text-muted)',
  safe: 'var(--color-success)',
}

function daysBadgeClass(daysLeft) {
  if (daysLeft === 1) return 'badge-danger'
  if (daysLeft <= 3) return 'badge-warning'
  return 'badge-neutral'
}

function daysLabel(daysLeft) {
  if (daysLeft === 1) return '明天'
  return `${daysLeft} 天`
}

export default function NoticeItem({ name, card, amount, daysLeft, status }) {
  const dotColor = STATUS_DOT_COLOR[status] || STATUS_DOT_COLOR.neutral

  return (
    <div className="notice-item">
      <div className="notice-item-left">
        <span
          className="notice-item-dot"
          style={{ background: dotColor }}
        />
        <div className="notice-item-info">
          <span className="notice-item-name">{name}</span>
          <span className="notice-item-card">{card}</span>
        </div>
      </div>
      <div className="notice-item-right">
        <span className="notice-item-amount">
          {'NT$' + Number(amount).toLocaleString()}
        </span>
        <span className={`badge ${daysBadgeClass(daysLeft)}`}>
          {daysLabel(daysLeft)}
        </span>
      </div>
    </div>
  )
}
