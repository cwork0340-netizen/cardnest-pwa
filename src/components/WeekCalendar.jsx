import './WeekCalendar.css'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function WeekCalendar({ days }) {
  // 攤平成依日期排序的扣款清單（grid 已是日期順序）
  const items = days.flatMap(day =>
    day.events.map(e => ({ ...e, date: day.date }))
  )

  return (
    <div className="card week-cal">
      <div className="week-cal-grid">
        {days.map((day, i) => (
          <div key={i} className={`week-cal-day${day.isToday ? ' week-cal-day-today' : ''}`}>
            <span className="week-cal-weekday">{WEEKDAYS[day.date.getDay()]}</span>
            <span className="week-cal-date">{day.date.getDate()}</span>
            <div className="week-cal-events">
              {day.events.map(e => (
                <span
                  key={e.id}
                  className="week-cal-chip"
                  style={{ background: `${e.color}1A`, color: e.color }}
                  title={e.name}
                >
                  {e.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="week-cal-empty">本週沒有預定扣款，安心 ✅</p>
      ) : (
        <div className="week-cal-list">
          {items.map(e => (
            <div className="week-cal-item" key={e.id}>
              <span className="week-cal-item-dot" style={{ background: e.color }} />
              <div className="week-cal-item-info">
                <span className="week-cal-item-name">{e.name}</span>
                <span className="week-cal-item-meta">
                  {e.date.getMonth() + 1}/{e.date.getDate()} 週{WEEKDAYS[e.date.getDay()]} · {e.card}
                </span>
              </div>
              <span className="week-cal-item-amount">NT${Number(e.amount).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
