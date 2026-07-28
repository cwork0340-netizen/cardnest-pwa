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

export default function Dashboard({
  greeting, dateLabel, currentMonth, weekDays, cards, categories, trends,
  liabilityItems = [], totalDebt = 0, envelopeView = [], envelopeSummary = null,
  paymentReminders = [], onMarkCardPaid, onMarkAllCyclesPaid, onUpdateCycle,
  income = 0, essentialTotal = 0, cardEstimateTotal = 0, lifeBalance = 0, onGoToChecklist,
}) {
  const pendingBillTotal = cards.reduce((sum, card) => sum + Number(card.unpaidTotal ?? 0), 0)
  const currentCycleTotal = cards.reduce((sum, card) => sum + Number(card.currentCycleAmount ?? 0), 0)

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

      <PaymentReminderCard reminders={paymentReminders} onMarkPaid={onMarkCardPaid} />

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
