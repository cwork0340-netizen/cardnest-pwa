import './BottomNav.css'

const tabs = [
  {
    id: 'dashboard',
    label: '總覽',
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
    id: 'checklist',
    label: '規劃',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="4" y="3" width="14" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M7.5 9l1.6 1.6L12 7.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7.5 14h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
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
    id: 'settings',
    label: '設定',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M4.22 17.78l1.42-1.42M16.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
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
            className={`bottom-nav-item${active === tab.id ? ' bottom-nav-item--active' : ''}`}
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
