import { describe, expect, it } from 'vitest'
import { getSalarySchedule, normalizeSalarySettings } from '../utils/salarySchedule'

describe('salary schedule', () => {
  it('moves a weekend payday to the prior workday by default', () => {
    const result = getSalarySchedule({ day: 5 }, new Date(2026, 8, 4))

    expect(result.paydayKey).toBe('2026-09-04')
    expect(result.receivedThisMonth).toBe(true)
  })

  it('can move a weekend payday to the next workday', () => {
    const result = getSalarySchedule({ day: 5, nonWorkingDayPolicy: 'next' }, new Date(2026, 8, 6))

    expect(result.paydayKey).toBe('2026-09-07')
    expect(result.receivedThisMonth).toBe(false)
  })

  it('uses an entered actual payday for a public-holiday exception', () => {
    const result = getSalarySchedule({ day: 5, overrides: { '2026-08': '2026-08-04' } }, new Date(2026, 7, 3))

    expect(result.paydayKey).toBe('2026-08-04')
    expect(result.hasOverride).toBe(true)
  })

  it('normalizes incomplete settings safely', () => {
    expect(normalizeSalarySettings({ day: 99, nonWorkingDayPolicy: 'something' })).toMatchObject({
      day: 31,
      nonWorkingDayPolicy: 'previous',
      overrides: {},
    })
  })
})
