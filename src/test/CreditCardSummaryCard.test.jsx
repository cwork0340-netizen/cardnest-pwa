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

describe('CreditCardSummaryCard 部分繳款', () => {
  const makeCard = (paidAmount) => ({
    id: 'c1', name: '富邦M', color: '#2F6FEB', unpaidTotal: 10000 - (paidAmount ?? 0),
    unpaidCycles: [{
      id: 'cy1', cycleKey: '2026-10', closeDate: '2026-10-12', dueDate: '2026-10-28', daysLeft: 5,
      amount: 10000, ...(paidAmount && { paidAmount }), remaining: 10000 - (paidAmount ?? 0), paid: false,
    }],
  })
  const open = (card, onUpdateCycle = vi.fn()) => {
    render(<CreditCardSummaryCard card={card} onMarkPaid={vi.fn()} onMarkAllPaid={vi.fn()} onUpdateCycle={onUpdateCycle} />)
    fireEvent.click(screen.getByRole('button', { name: /富邦M/ }))
    return onUpdateCycle
  }

  it('只繳一部分：記下已繳金額，不標記整期已繳', () => {
    const onUpdateCycle = open(makeCard())
    fireEvent.click(screen.getByRole('button', { name: '部分繳款' }))
    fireEvent.change(screen.getByLabelText('這次繳了多少'), { target: { value: '4000' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(onUpdateCycle).toHaveBeenCalledWith('c1', 'cy1', { paidAmount: 4000 })
  })

  it('這次補繳之後湊滿帳單，就標記整期已繳', () => {
    const onUpdateCycle = open(makeCard(4000))
    fireEvent.click(screen.getByRole('button', { name: '部分繳款' }))
    fireEvent.change(screen.getByLabelText('這次繳了多少'), { target: { value: '6000' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(onUpdateCycle).toHaveBeenCalledWith('c1', 'cy1', expect.objectContaining({ paidAmount: 10000, paid: true }))
  })

  it('已繳一部分的那期顯示還欠多少，並註明帳單與已繳', () => {
    open(makeCard(4000))
    expect(screen.getAllByText('NT$6,000').length).toBeGreaterThan(0)
    expect(screen.getByText('帳單 NT$10,000・已繳 NT$4,000')).toBeInTheDocument()
  })

  it('沒填金額或填 0 不會存', () => {
    const onUpdateCycle = open(makeCard())
    fireEvent.click(screen.getByRole('button', { name: '部分繳款' }))
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(onUpdateCycle).not.toHaveBeenCalled()
  })
})

