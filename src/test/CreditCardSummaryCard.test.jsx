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

describe('CreditCardSummaryCard 按錯已繳可以改回來', () => {
  const card = {
    id: 'c1', name: '國泰', color: '#0E9F8E', unpaidTotal: 0, unpaidCycles: [],
    recentPaidCycles: [{ id: 'cy1', cycleKey: '2026-09', closeDate: '2026-09-25', dueDate: '2026-10-10', amount: 10000, paid: true, paidAt: '2026-10-09' }],
  }
  const open = (onUpdateCycle = vi.fn()) => {
    render(<CreditCardSummaryCard card={card} onMarkPaid={vi.fn()} onMarkAllPaid={vi.fn()} onUpdateCycle={onUpdateCycle} />)
    fireEvent.click(screen.getByRole('button', { name: /國泰/ }))
    fireEvent.click(screen.getByRole('button', { name: '改回未繳' }))
    return onUpdateCycle
  }

  it('沒有未繳帳單時，仍列出最近已繳的，並可改回未繳', () => {
    render(<CreditCardSummaryCard card={card} onMarkPaid={vi.fn()} onMarkAllPaid={vi.fn()} onUpdateCycle={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /國泰/ }))
    expect(screen.getByText('目前沒有未繳的帳單')).toBeInTheDocument()
    expect(screen.getByText('NT$10,000')).toBeInTheDocument()
    expect(screen.getByText('結帳 2026-09-25・已繳 2026-10-09')).toBeInTheDocument()
  })

  it('其實只繳一部分：改回未繳並記下實際繳的金額', () => {
    const onUpdateCycle = open()
    fireEvent.change(screen.getByLabelText('其實只繳了多少（沒繳就留空）'), { target: { value: '4000' } })
    fireEvent.click(screen.getAllByRole('button', { name: '改回未繳' })[1])
    expect(onUpdateCycle).toHaveBeenCalledWith('c1', 'cy1', { paid: false, paidAt: null, paidAmount: 4000 })
  })

  it('金額留空：只改回未繳，不動已繳金額', () => {
    const onUpdateCycle = open()
    fireEvent.click(screen.getAllByRole('button', { name: '改回未繳' })[1])
    expect(onUpdateCycle).toHaveBeenCalledWith('c1', 'cy1', { paid: false, paidAt: null })
  })

  it('填的金額大於等於帳單就等於繳清，不做任何改動', () => {
    const onUpdateCycle = open()
    fireEvent.change(screen.getByLabelText('其實只繳了多少（沒繳就留空）'), { target: { value: '10000' } })
    fireEvent.click(screen.getAllByRole('button', { name: '改回未繳' })[1])
    expect(onUpdateCycle).not.toHaveBeenCalled()
  })
})

