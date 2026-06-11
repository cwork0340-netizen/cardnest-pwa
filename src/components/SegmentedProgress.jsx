// 分段式期數進度條：每一期一格，已繳的格子上色。
// 期數過多（預設 > 12）時改用連續進度條，避免格子過細看不清。
export default function SegmentedProgress({ paid, total, maxSegments = 12 }) {
  const safeTotal = Math.max(0, total || 0)
  const safePaid = Math.min(Math.max(0, paid || 0), safeTotal)

  if (safeTotal > maxSegments) {
    const percent = safeTotal > 0 ? Math.min((safePaid / safeTotal) * 100, 100) : 0
    return (
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={safePaid}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
      >
        <div className="progress-fill progress-fill-safe" style={{ width: `${percent}%` }} />
      </div>
    )
  }

  return (
    <div
      className="seg-progress"
      role="progressbar"
      aria-valuenow={safePaid}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
    >
      {Array.from({ length: safeTotal }, (_, i) => (
        <span key={i} className={`seg-cell${i < safePaid ? ' seg-cell-done' : ''}`} />
      ))}
    </div>
  )
}
