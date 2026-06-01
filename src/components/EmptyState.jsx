import './EmptyState.css'

export default function EmptyState({ icon, title, description }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {description && (
        <div className="empty-state-desc">{description}</div>
      )}
    </div>
  )
}
