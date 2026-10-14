import './BottomNav.css'

const tabs = [
  {
    id: 'dashboard',
    label: '現況',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="2" width="8" height="8" rx="2.5" fill="currentColor" opacity="0.85"/>
        <rect x="12" y="2" width="8" height="8" rx="2.5" fill="currentColor" opacity="0.85"/>
        <rect x="2" y="12" width="8" height="8" rx="2.5" fill="currentColor" opacity="0.85"/>
        <rect x="12" y="12" width="8" height="8" rx="2.5" fill="currentColor" opacity="0.85"/>
      </svg>
    ),
  },
  {
    id: 'transactions',
    label: '刷卡',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="5" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M2 9h18" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="5" y="12" width="5" height="2" rx="1" fill="currentColor" opacity="0.6"/>
      </svg>
    ),
  },
  {
    id: 'more',
    label: '更多',
    minor: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="4.5" cy="11" r="1.7" fill="currentColor"/>
        <circle cx="11" cy="11" r="1.7" fill="currentColor"/>
        <circle cx="17.5" cy="11" r="1.7" fill="currentColor"/>
      </svg>
    ),
  },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`bottom-nav-item${tab.minor ? ' bottom-nav-item--minor' : ''}${active === tab.id ? ' bottom-nav-item--active' : ''}`}
            onClick={() => onChange(tab.id)}
            aria-label={tab.label}
          >
            <span className="bottom-nav-icon">{tab.icon}</span>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
