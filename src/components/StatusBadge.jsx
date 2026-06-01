const STATUS_MAP = {
  safe: { className: 'badge-success', label: '安全' },
  warning: { className: 'badge-warning', label: '留意' },
  danger: { className: 'badge-danger', label: '即將到期' },
  neutral: { className: 'badge-neutral', label: '正常' },
  primary: { className: 'badge-primary', label: '' },
}

export default function StatusBadge({ status, children }) {
  const { className, label } = STATUS_MAP[status] || STATUS_MAP.neutral
  return (
    <span className={`badge ${className}`}>
      {children ?? label}
    </span>
  )
}
