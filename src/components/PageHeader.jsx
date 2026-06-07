import './PageHeader.css'

export default function PageHeader({ greeting, dateLabel }) {
  return (
    <div className="page-header">
      <div className="page-header-greeting">{greeting}</div>
      <div className="page-header-sub">{dateLabel}</div>
    </div>
  )
}
