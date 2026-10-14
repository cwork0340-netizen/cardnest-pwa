import './ActionBar.css'

// 現況畫面底部、導覽列上方的主要動作：更新信件刷卡，旁邊一顆小的「＋」補登。
export default function ActionBar({ importing, onImport, onAdd }) {
  return (
    <div className="action-bar">
      <div className="action-bar-inner">
        <button type="button" className="action-bar-main" onClick={onImport} disabled={importing}>
          {importing ? '更新中…' : '更新信件刷卡'}
        </button>
        <button type="button" className="action-bar-add" onClick={onAdd} aria-label="補登一筆">
          <span aria-hidden="true">＋</span>
        </button>
      </div>
    </div>
  )
}
