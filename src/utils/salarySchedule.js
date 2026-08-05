const DEFAULT_SETTINGS = {
  day: 5,
  nonWorkingDayPolicy: 'previous',
  overrides: {},
}

function toLocalDate(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const [year, month, day] = String(value || '').split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : null
}

export function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getMonthKey(date) {
  return toDateKey(date).slice(0, 7)
}

export function normalizeSalarySettings(settings = {}) {
  const day = Math.min(31, Math.max(1, Number(settings.day) || DEFAULT_SETTINGS.day))
  return {
    day,
    nonWorkingDayPolicy: settings.nonWorkingDayPolicy === 'next' ? 'next' : 'previous',
    overrides: settings.overrides && typeof settings.overrides === 'object' ? settings.overrides : {},
  }
}

function scheduledPayday(monthStart, settings) {
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
  const result = new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(settings.day, daysInMonth))
  const direction = settings.nonWorkingDayPolicy === 'next' ? 1 : -1
  while (result.getDay() === 0 || result.getDay() === 6) result.setDate(result.getDate() + direction)
  return result
}

export function getSalarySchedule(settings, today = new Date()) {
  const normalized = normalizeSalarySettings(settings)
  const current = toLocalDate(today)
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
  const monthKey = getMonthKey(monthStart)
  const override = toLocalDate(normalized.overrides[monthKey])
  const payday = override || scheduledPayday(monthStart, normalized)
  const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1)
  const nextMonthKey = getMonthKey(nextMonth)
  const nextPayday = toLocalDate(normalized.overrides[nextMonthKey]) || scheduledPayday(nextMonth, normalized)

  return {
    ...normalized,
    monthKey,
    payday,
    paydayKey: toDateKey(payday),
    nextPayday,
    nextPaydayKey: toDateKey(nextPayday),
    hasOverride: Boolean(override),
    receivedThisMonth: current >= payday,
  }
}
