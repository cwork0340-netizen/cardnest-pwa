import './FixedCharges.css'
import { buildFixedCharges, formatMonth } from '../utils/fixedCharges'

function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

const LEVEL_TEXT = { ok: '占收入比例正常', warn: '偏高', danger: '過高' }

// 固定扣款：訂閱＋分期。每月合計、占收入比、分期還剩多少、什麼時候會少一筆。
export default function FixedCharges({ plans, income = 0, onBack }) {
  const today = new Date()
  const f = buildFixedCharges(plans, { today, income })
  const peak = Math.max(...f.timeline.map((m) => m.total), 1)

  return (
    <div className="fixed-page">
      <button type="button" className="fixed-back" onClick={onBack}>‹ 更多</button>
      <h1 className="fixed-title">固定扣款</h1>

      <section className="fixed-summary" aria-label="每月固定扣款">
        <span className="fixed-label">每月固定扣款（訂閱＋分期）</span>
        <strong className="fixed-amount">{fmt(f.monthly)}</strong>
        <div className="fixed-meta">
          {f.share != null && (
            <span className={`fixed-tag fixed-tag--${f.level}`}>占收入 {Math.round(f.share * 100)}%・{LEVEL_TEXT[f.level]}</span>
          )}
          <span>一年約 {fmt(f.yearly)}</span>
        </div>
        {f.share == null && f.monthly > 0 && <p className="fixed-hint">到「規劃」填月收入，就會顯示占收入的比例。</p>}
        <div className="fixed-debt">
          <span>分期剩餘總負債</span>
          <strong>{fmt(f.debtRemaining)}</strong>
        </div>
      </section>

      {f.monthly > 0 && (
        <section className="fixed-block">
          <h2>未來 12 個月每月扣款</h2>
          <div className="fixed-chart" role="img" aria-label="未來 12 個月每月固定扣款">
            {f.timeline.map((m, i) => (
              <div key={`${m.year}-${m.month}`} className={i === 0 ? 'fixed-bar fixed-bar--now' : 'fixed-bar'} style={{ height: `${Math.max(4, (m.total / peak) * 100)}%` }} title={`${m.year}/${m.month} ${fmt(m.total)}`} />
            ))}
          </div>
          <div className="fixed-chart-x">
            {f.timeline.map((m) => <span key={`${m.year}-${m.month}`}>{m.month}</span>)}
          </div>
          {f.releases.length > 0 ? (
            <ul className="fixed-releases">
              {f.releases.slice(0, 3).map((r) => (
                <li key={`${r.year}-${r.month}`}>
                  <b>{formatMonth(r, today)}</b>起每月少 {fmt(r.amount)}
                  <span>（{r.names.join('、')}結束）</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fixed-hint">這 12 個月內沒有分期結束，每月都是這個金額。</p>
          )}
        </section>
      )}

      {f.installments.length > 0 && (
        <section className="fixed-block">
          <h2>分期</h2>
          <ul className="fixed-list">
            {f.installments.map((p) => (
              <li key={p.id}>
                <div>
                  <span className="fixed-name">{p.name}</span>
                  <span className="fixed-sub">{p.card}・剩 {p.remaining} 期・{formatMonth(p.end, today)}結束・還欠 {fmt(p.remainingTotal)}</span>
                </div>
                <strong>{fmt(p.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {f.subscriptions.length > 0 && (
        <section className="fixed-block">
          <h2>訂閱</h2>
          <ul className="fixed-list">
            {f.subscriptions.map((s) => (
              <li key={s.id}>
                <div>
                  <span className="fixed-name">{s.name}</span>
                  <span className="fixed-sub">{s.card}・一年 {fmt(s.yearly)}</span>
                </div>
                <strong>{fmt(s.monthly)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {f.monthly === 0 && <p className="fixed-hint">目前沒有訂閱或分期。到「規劃」新增後會顯示在這裡。</p>}
    </div>
  )
}
