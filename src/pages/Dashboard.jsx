import './Dashboard.css'
import PageHeader from '../components/PageHeader'
import SectionHeader from '../components/SectionHeader'
import HeroStatusCard from '../components/HeroStatusCard'
import MonthlyBalanceCard from '../components/MonthlyBalanceCard'
import PaymentReminderCard from '../components/PaymentReminderCard'
import WeekCalendar from '../components/WeekCalendar'
import CreditCardSummaryCard from '../components/CreditCardSummaryCard'
import CategoryBreakdownCard from '../components/CategoryBreakdownCard'
import TrendChartCard from '../components/TrendChartCard'
import DebtOverviewCard from '../components/DebtOverviewCard'
import EnvelopeBudgetCard from '../components/EnvelopeBudgetCard'
import CardForecastCard from '../components/CardForecastCard'

export default function Dashboard({
  greeting, dateLabel, currentMonth, weekDays, cards, categories, trends,
  liabilityItems = [], totalDebt = 0, envelopeView = [], envelopeSummary = null,
  paymentReminders = [], onMarkCardPaid, onMarkAllCyclesPaid, onUpdateCycle,
  income = 0, essentialTotal = 0, cardEstimateTotal = 0, lifeBalance = 0, onGoToChecklist,
  onGoToTransactions, reconciliationSummary = null,
  forecastSummary = null,
}) {
  const pendingBillTotal = cards.reduce((sum, card) => sum + Number(card.unpaidTotal ?? 0), 0)
  const currentCycleTotal = cards.reduce((sum, card) => sum + Number(card.currentCycleAmount ?? 0), 0)
  const needsReconciliation = Number(reconciliationSummary?.totalIssueCount ?? 0) > 0

  return (
    <div className="dashboard">
      <PageHeader
        greeting={greeting}
        dateLabel={dateLabel}
      />

      <MonthlyBalanceCard
        income={income}
        essentialTotal={essentialTotal}
        cardEstimateTotal={cardEstimateTotal}
        lifeBalance={lifeBalance}
        onGoToChecklist={onGoToChecklist}
      />

      <div className="section">
        <CardForecastCard forecast={forecastSummary} />
      </div>

      <PaymentReminderCard reminders={paymentReminders} onMarkPaid={onMarkCardPaid} />

      {needsReconciliation && (
        <div className="section dashboard-reconcile-section">
          <div className="dashboard-reconcile-card">
            <div className="dashboard-reconcile-head">
              <div>
                <span className="dashboard-reconcile-kicker">對帳提醒</span>
                <h2>有資料需要確認</h2>
              </div>
              <button onClick={onGoToTransactions}>去刷卡紀錄</button>
            </div>
            <div className="dashboard-reconcile-stats">
              <span>待對帳 {reconciliationSummary.pendingCount} 筆</span>
              <span>未對應 {reconciliationSummary.unmappedCount} 筆</span>
              <span>調整項 {reconciliationSummary.adjustmentCount} 筆</span>
            </div>
            {reconciliationSummary.cardAlerts.length > 0 && (
              <div className="dashboard-reconcile-list">
                {reconciliationSummary.cardAlerts.slice(0, 3).map((item) => (
                  <span key={item.id}>
                    <i style={{ background: item.color }} />
                    {item.name}
                    {item.pendingCount > 0 ? `・待對帳 ${item.pendingCount} 筆` : ''}
                    {item.diffCount > 0 ? `・帳單有差異` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="section" style={{ marginTop: 'var(--section-gap)' }}>
        <SectionHeader title="本月刷卡狀況" />
        <HeroStatusCard
          budget={currentMonth.budget}
          estimatedTotal={currentMonth.estimatedTotal}
          pendingBillTotal={pendingBillTotal}
          currentCycleTotal={currentCycleTotal}
          status={currentMonth.status}
        />
      </div>

      <div className="section" style={{ marginTop: 'var(--section-gap)' }}>
        <SectionHeader title="本週扣款" />
        <WeekCalendar days={weekDays} />
      </div>

      {envelopeView.length > 0 && (
        <div className="section">
          <SectionHeader title="分類預算（信封）" />
          <EnvelopeBudgetCard envelopes={envelopeView} summary={envelopeSummary} />
        </div>
      )}

      <div className="section">
        <SectionHeader title="各卡狀態" />
        {cards.map((card) => (
          <CreditCardSummaryCard
            key={card.id}
            card={card}
            onMarkPaid={onMarkCardPaid}
            onMarkAllPaid={onMarkAllCyclesPaid}
            onUpdateCycle={onUpdateCycle}
          />
        ))}
      </div>

      {liabilityItems.length > 0 && (
        <div className="section">
          <SectionHeader title="未償負債" />
          <DebtOverviewCard items={liabilityItems} total={totalDebt} />
        </div>
      )}

      <div className="section">
        <SectionHeader title="本月花在哪" />
        <div className="card">
          <CategoryBreakdownCard categories={categories} />
        </div>
      </div>

      <div className="section">
        <SectionHeader title="最近 7 個月" />
        <div className="card">
          <TrendChartCard trends={trends} />
        </div>
      </div>
    </div>
  )
}
