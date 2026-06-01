import './SectionHeader.css'

export default function SectionHeader({ title, action, onAction }) {
  return (
    <div className="section-header">
      <span className="section-header-title">{title}</span>
      {action && (
        <button className="section-header-action" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}
