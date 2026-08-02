import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Dashboard from '../pages/Dashboard'

function baseProps(overrides = {}) {
  return {
    greeting: '晚安',
    dateLabel: '7 月 29 日',
    currentMonth: { budget: 50000, estimatedTotal: 1200, status: 'safe' },
    weekDays: [],
    cards: [],
    categories: [],
    trends: [],
    paymentReminders: [],
    onMarkCardPaid: vi.fn(),
    onMarkAllCyclesPaid: vi.fn(),
    onUpdateCycle: vi.fn(),
    onGoToChecklist: vi.fn(),
    onGoToTransactions: vi.fn(),
    ...overrides,
  }
}

describe('Dashboard reconciliation alerts', () => {
  it('shows a reconciliation alert and links to transactions when imported data needs review', () => {
    const onGoToTransactions = vi.fn()

    render(
      <Dashboard
        {...baseProps({
          onGoToTransactions,
          reconciliationSummary: {
            totalIssueCount: 2,
            pendingCount: 1,
            unmappedCount: 1,
            adjustmentCount: 1,
            cardAlerts: [{
              id: 'c1',
              name: '永豐卡',
              color: '#C62828',
              pendingCount: 1,
              diffCount: 0,
            }],
          },
        })}
      />,
    )

    expect(screen.getByText('對帳提醒')).toBeInTheDocument()
    expect(screen.getByText('有資料需要確認')).toBeInTheDocument()
    expect(screen.getByText('待對帳 1 筆')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '去刷卡紀錄' }))
    expect(onGoToTransactions).toHaveBeenCalledTimes(1)
  })
})
