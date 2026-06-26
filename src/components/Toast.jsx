import './Toast.css'

export default function Toast({ message, onUndo }) {
  const variant = onUndo ? 'ignore' : 'success'
  return (
    <div className={`toast toast--${variant}`} role="status" aria-live="polite">
      <span className="toast-message">{message}</span>
      {onUndo && (
        <button className="toast-undo" onClick={onUndo}>復原</button>
      )}
    </div>
  )
}
