import { useState } from 'react'
import './Home.css'
import PageHeader from '../components/PageHeader'
import PaymentReminderCard from '../components/PaymentReminderCard'
import ActionBar from '../components/ActionBar'
import BottomSheet from '../components/BottomSheet'
import QuickTransactionForm from '../components/QuickTransactionForm'
import { buildManualTransactionFields } from '../utils/manualTransaction'

function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

function formatUpdatedAt(ms) {
  if (!ms) return '還沒有更新過'
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `上次更新 ${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatBackedUpAt(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `已備份 ${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function urgentText(daysLeft) {
  if (daysLeft < 0) return `逾期 ${-daysLeft} 天`
  if (daysLeft === 0) return '今天到期'
  return `還有 ${daysLeft} 天`
}

// 現況：欠多少、先繳哪張、目前刷了多少。更新信件刷卡在底部。
export default function Home({
  greeting, dateLabel, cards, paymentReminders = [], onMarkCardPaid,
  cardImport, importing, onImport, syncReminder = null, backupReminder = null, lastBackupAt = null, pendingCount = 0, onGoToPending, fixed = null, onGoToFixed,
  onAddTransaction, showToast, budget = 0,
}) {
  const [showMoreBills, setShowMoreBills] = useState(false)
  const [adding, setAdding] = useState(false)

  const pendingBillTotal = cards.reduce((sum, card) => sum + Number(card.unpaidTotal ?? 0), 0)
  const currentSpendTotal = cards.reduce((sum, card) => sum + Number(card.spendingWarningTotal ?? 0), 0)
  const pct = budget > 0 ? Math.round((currentSpendTotal / budget) * 100) : 0
  const spendTone = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'safe'
  const [first, ...rest] = paymentReminders

  function handleAdd(form) {
    onAddTransaction({ id: crypto.randomUUID(), ...buildManualTransactionFields(form, cards) })
    showToast('已幫你記好了')
    setAdding(false)
  }

  return (
    <div className="home">
      <PageHeader greeting={greeting} dateLabel={dateLabel} />

      <section className="home-hero" aria-label="待繳帳單">
        <span className="home-hero-label">待繳帳單</span>
        <strong className="home-hero-amount">{pendingBillTotal > 0 ? fmt(pendingBillTotal) : '沒有待繳'}</strong>
        {first && (
          <span className="home-hero-sub">
            {paymentReminders.length} 張待繳・{first.name}{urgentText(first.daysLeft)}
          </span>
        )}
      </section>

      {first && (
        <div className="home-bills">
          <PaymentReminderCard title="先繳" showCount={false} reminders={[first]} onMarkPaid={onMarkCardPaid} />
          {rest.length > 0 && (
            <>
              <button
                type="button"
                className="home-more-bills"
                aria-expanded={showMoreBills}
                onClick={() => setShowMoreBills((v) => !v)}
              >
                還有 {rest.length} 張待繳 {showMoreBills ? '⌃' : '›'}
              </button>
              {showMoreBills && (
                <PaymentReminderCard title="其他待繳" showCount={false} reminders={rest} onMarkPaid={onMarkCardPaid} />
              )}
            </>
          )}
        </div>
      )}

      <section className="home-spend" aria-label="目前刷卡總額">
        <div>
          <span className="home-spend-label">目前刷卡總額</span>
          <span className="home-spend-note">上次結帳後累計，含訂閱與分期</span>
        </div>
        <strong className={`home-spend-amount home-spend-amount--${spendTone}`}>{fmt(currentSpendTotal)}</strong>
      </section>

      {fixed && fixed.monthly > 0 && (
        <button type="button" className="home-fixed" onClick={onGoToFixed}>
          <span className="home-fixed-text">
            <span className="home-fixed-label">每月固定扣款</span>
            <strong className="home-fixed-amount">
              {fmt(fixed.monthly)}
              {fixed.share != null && <small>・占收入 {Math.round(fixed.share * 100)}%</small>}
            </strong>
          </span>
          <span className="home-fixed-go" aria-hidden="true">›</span>
        </button>
      )}

      {pendingCount > 0 && (
        <button type="button" className="home-todo" onClick={onGoToPending}>
          <span>{pendingCount} 筆待填入帳日</span>
          <span className="home-todo-go">填寫 ›</span>
        </button>
      )}

      {syncReminder && (
        <div className="home-todo home-todo--static">
          <span>
            {syncReminder.daysSince == null
              ? '還沒有同步過到 Google Sheet'
              : `已經 ${syncReminder.daysSince} 天沒有同步到 Google Sheet`}
          </span>
          <button type="button" className="home-todo-go" onClick={syncReminder.onSync} disabled={syncReminder.syncing}>
            {syncReminder.syncing ? '同步中…' : '立即同步'}
          </button>
        </div>
      )}

      {backupReminder && (
        <div className="home-todo home-todo--static">
          <span>
            {backupReminder.daysSince == null
              ? '還沒有備份到雲端，換手機會拿不回來'
              : `已經 ${backupReminder.daysSince} 天沒有備份到雲端`}
          </span>
          <button type="button" className="home-todo-go" onClick={backupReminder.onBackup} disabled={backupReminder.backingUp}>
            {backupReminder.backingUp ? '備份中…' : '立即備份'}
          </button>
        </div>
      )}

      <p className="home-updated">
        {formatUpdatedAt(cardImport?.lastImportAt)}
        {lastBackupAt && `・${formatBackedUpAt(lastBackupAt)}`}
      </p>

      <ActionBar importing={importing} onImport={onImport} onAdd={() => setAdding(true)} />

      <BottomSheet open={adding} onClose={() => setAdding(false)} title="補登一筆">
        <QuickTransactionForm onSubmit={handleAdd} onClose={() => setAdding(false)} cards={cards} />
      </BottomSheet>
    </div>
  )
}
