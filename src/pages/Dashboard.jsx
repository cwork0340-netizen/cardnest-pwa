import './Dashboard.css'
import PageHeader from '../components/PageHeader'
import SectionHeader from '../components/SectionHeader'
import HeroStatusCard from '../components/HeroStatusCard'
import NoticeItem from '../components/NoticeItem'
import BudgetCard from '../components/BudgetCard'
import CreditCardSummaryCard from '../components/CreditCardSummaryCard'
import CategoryBreakdownCard from '../components/CategoryBreakdownCard'
import TrendChartCard from '../components/TrendChartCard'
import EmptyState from '../components/EmptyState'

export default function Dashboard({ greeting, dateLabel, currentMonth, notices, cards, categories, trends }) {
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
        <SectionHeader title="今天需要注意" />
        {notices.length === 0 ? (
          <EmptyState icon="✅" title="近期沒有即將扣款" description="目前訂閱都還早，安心" />
        ) : (
          notices.map((n) => (
            <div className="card" key={n.id}>
              <NoticeItem
                name={n.name}
                card={n.card}
                amount={n.amount}
                daysLeft={n.daysLeft}
                status={n.status}
              />
            </div>
          ))
        )}
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
