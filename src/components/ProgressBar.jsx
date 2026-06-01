function autoStatus(percent) {
  if (percent > 95) return 'danger'
  if (percent >= 80) return 'warning'
  return 'safe'
}

export default function ProgressBar({ value, max, status }) {
  const percent = Math.min((value / max) * 100, 100)
  const resolvedStatus = status || autoStatus(percent)

  return (
    <div className="progress-track">
      <div
        className={`progress-fill progress-fill-${resolvedStatus}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
