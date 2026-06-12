import './Dashboard.css'
import PageHeader from '../components/PageHeader'
import SectionHeader from '../components/SectionHeader'
import HeroStatusCard from '../components/HeroStatusCard'
import WeekCalendar from '../components/WeekCalendar'
import BudgetCard from '../components/BudgetCard'
import CreditCardSummaryCard from '../components/CreditCardSummaryCard'
import CategoryBreakdownCard from '../components/CategoryBreakdownCard'
import TrendChartCard from '../components/TrendChartCard'
import DebtOverviewCard from '../components/DebtOverviewCard'

export default function Dashboard({ greeting, dateLabel, currentMonth, weekDays, cards, categories, trends, liabilityItems = [], totalDebt = 0 }) {
  return (
    <div className="dashboard">
      <PageHeader
        greeting={greeting}
        dateLabel={dateLabel}
      />

      <HeroStatusCard
        month={currentMonth.name}
        total={currentMonth.total}
        remaining={currentMonth.remaining}
        budget={currentMonth.budget}
        fixedMonthlyAmount={currentMonth.fixedMonthlyAmount}
        estimatedTotal={currentMonth.estimatedTotal}
        status={currentMonth.status}
        statusText={currentMonth.statusText}
      />

      <div className="section" style={{ marginTop: 'var(--section-gap)' }}>
        <SectionHeader title="本週扣款" />
        <WeekCalendar days={weekDays} />
      </div>

      <div className="section">
        <SectionHeader title="本月可用額度" />
        <div className="card">
          <BudgetCard
            total={currentMonth.total}
            budget={currentMonth.budget}
            used={currentMonth.total}
            remaining={currentMonth.remaining}
          />
        </div>
      </div>

      <div className="section">
        <SectionHeader title="各卡狀態" />
        {cards.map((card) => (
          <CreditCardSummaryCard key={card.id} card={card} />
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
