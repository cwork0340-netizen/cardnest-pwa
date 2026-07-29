import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import CreditCardSummaryCard from '../components/CreditCardSummaryCard'

describe('CreditCardSummaryCard reconciliation monitor', () => {
  it('shows the bank actual amount, app estimate, difference, and likely causes after calibration', () => {
    const onMarkPaid = vi.fn()
    const onMarkAllPaid = vi.fn()
    const onUpdateCycle = vi.fn()

    render(
      <CreditCardSummaryCard
        card={{
          id: 'sinopac',
          name: '永豐卡',
          color: '#C62828',
          unpaidTotal: 4607,
          currentCycleAmount: 4607,
          used: 0,
          subsOnCard: 0,
          instOnCard: 4607,
          reconciliationHints: [
            '2 筆分期轉換沖銷不算一般消費',
            '1 筆繳款入帳不算消費',
          ],
          unpaidCycles: [{
            id: 'cycle-2026-07',
            cycleKey: '2026-07',
            closeDate: '2026-07-06',
            dueDate: '2026-07-21',
            daysLeft: 2,
            amount: 4607,
            estimatedAmount: 28186,
            manuallyCalibrated: true,
            amountIsActual: true,
            paid: false,
          }],
        }}
        onMarkPaid={onMarkPaid}
        onMarkAllPaid={onMarkAllPaid}
        onUpdateCycle={onUpdateCycle}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /永豐卡/ }))

    expect(screen.getByText('銀行實際')).toBeInTheDocument()
    expect(screen.getByText('App 原估')).toBeInTheDocument()
    expect(screen.getByText('和 App 預估差 NT$-23,579')).toBeInTheDocument()
    expect(screen.getByText(/原刷卡轉分期/)).toBeInTheDocument()
    expect(screen.getByText(/繳款入帳會影響剩餘未繳/)).toBeInTheDocument()
    expect(screen.getByText(/銀行帳單比 App 預估低/)).toBeInTheDocument()
  })
})
