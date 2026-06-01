import './BottomSheet.css'

export default function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null

  return (
    <div className="sheet-root">
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet-panel">
        <div className="sheet-handle" />
        {title && <h2 className="sheet-title">{title}</h2>}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
