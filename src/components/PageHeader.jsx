import './PageHeader.css'

export default function PageHeader({ greeting, month, lastSync }) {
  return (
    <div className="page-header">
      <div className="page-header-greeting">{greeting}</div>
      <div className="page-header-sub">{month} · {lastSync}同步</div>
    </div>
  )
}
