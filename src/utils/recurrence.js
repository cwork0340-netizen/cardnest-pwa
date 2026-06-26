// 統一的每月週期日期邏輯：所有訂閱／分期／卡片都用「每月幾號」這個錨點，
// 在每次渲染時即時算出下一次發生日，避免在新增當下把日期凍結進資料裡。

export function clampDayInMonth(year, month, day) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.min(day, lastDay)
}

// 找出「每月 day 號」這個錨點，從 from（含）起算的下一次發生日。
export function nextOccurrence(day, from = new Date()) {
  const ref = new Date(from)
  ref.setHours(0, 0, 0, 0)
  const thisMonth = new Date(ref.getFullYear(), ref.getMonth(), clampDayInMonth(ref.getFullYear(), ref.getMonth(), day))
  if (thisMonth >= ref) return thisMonth
  const nextMonth = ref.getMonth() + 1
  const nextYear = ref.getFullYear() + (nextMonth > 11 ? 1 : 0)
  return new Date(nextYear, nextMonth % 12, clampDayInMonth(nextYear, nextMonth % 12, day))
}

export function daysUntil(date, from = new Date()) {
  const ref = new Date(from)
  ref.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - ref) / 86400000)
}

export function formatMD(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function statusForDaysLeft(daysLeft) {
  if (daysLeft <= 1) return 'danger'
  if (daysLeft <= 3) return 'warning'
  return 'neutral'
}

// 舊資料相容：從 "6/15" 這種顯示字串解析出日（號數），抓不到就回 null。
export function dayFromMD(md) {
  if (!md) return null
  const [, d] = md.split('/').map(Number)
  return d || null
}
