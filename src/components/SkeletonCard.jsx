import './SkeletonCard.css'

export default function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card skeleton-card">
      {Array.from({ length: lines }, (_, i) => {
        const baseWidth = 100
        const width = Math.max(baseWidth - i * 15, 40)
        return (
          <div
            key={i}
            className="skeleton-line"
            style={{ width: `${width}%` }}
          />
        )
      })}
    </div>
  )
}
