import './EnvelopeBudgetCard.css'
import ProgressBar from './ProgressBar'

function fmt(amount) {
  return 'NT$' + Number(amount).toLocaleString()
}

const NECESSITY_LABEL = { necessary: '必要', flexible: '彈性' }

export default function EnvelopeBudgetCard({ envelopes, summary }) {
  return (
    <div className="card envelope-card">
      {summary && (summary.necessaryBudget > 0 || summary.flexibleBudget > 0) && (
        <div className="env-summary">
          <div className="env-summary-col">
            <span className="env-summary-label">必要</span>
            <span className="env-summary-value">{fmt(summary.necessaryUsed)} / {fmt(summary.necessaryBudget)}</span>
          </div>
          <div className="env-summary-col">
            <span className="env-summary-label">彈性</span>
            <span className="env-summary-value">{fmt(summary.flexibleUsed)} / {fmt(summary.flexibleBudget)}</span>
          </div>
        </div>
      )}

      <div className="env-list">
        {envelopes.map((e) => {
          const over = e.remaining < 0
          return (
            <div key={e.id} className="env-row">
              <div className="env-row-head">
                <span className="env-name">
                  {e.name}
                  <span className="env-tag">{NECESSITY_LABEL[e.necessity] ?? ''}</span>
                </span>
                <span className="env-amount">{fmt(e.used)} / {fmt(e.budget)}</span>
              </div>
              <ProgressBar value={e.used} max={e.budget} />
              <span className={`env-remaining${over ? ' env-remaining-over' : ''}`}>
                {over ? `超出 ${fmt(-e.remaining)}` : `還剩 ${fmt(e.remaining)}`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
