import './Toast.css'

export default function Toast({ message, onUndo }) {
  return (
    <div className="toast">
      <span className="toast-message">{message}</span>
      {onUndo && (
        <button className="toast-undo" onClick={onUndo}>復原</button>
      )}
    </div>
  )
}
