import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Transactions from '../pages/Transactions'

describe('Transactions import entry', () => {
  it('puts the card notification update action on the transactions page', () => {
    const onImportCardNotifications = vi.fn()

    render(
      <Transactions
        showToast={vi.fn()}
        transactions={[]}
        cards={[]}
        onAddTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
        onDeleteTransaction={vi.fn()}
        onConvertToInstallment={vi.fn()}
        cardImport={{
          lastImportAt: new Date(2026, 6, 29, 21, 0).getTime(),
          lastImportCount: 3,
          lastImportDuplicateCount: 2,
          lastImportSkippedUnmapped: 1,
        }}
        importingCardNotifications={false}
        onImportCardNotifications={onImportCardNotifications}
      />,
    )

    expect(screen.getByText(/上次更新/)).toBeInTheDocument()
    expect(screen.getByText(/新增 3 筆/)).toBeInTheDocument()
    expect(screen.getByText(/重複 2 筆/)).toBeInTheDocument()
    expect(screen.getByText(/未對應 1 筆/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '更新信件刷卡' }))
    expect(onImportCardNotifications).toHaveBeenCalledTimes(1)
  })

  it('shows transaction source and reconciliation state', () => {
    render(
      <Transactions
        showToast={vi.fn()}
        transactions={[{
          id: 'tx1',
          name: '南山保費',
          card: '永豐卡',
          category: '保險',
          amount: 1458,
          date: '2026-07-23',
          postedDate: '2026-07-27',
          note: '自動匯入・永豐',
        }]}
        cards={[{ id: 'c1', name: '永豐卡' }]}
        onAddTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
        onDeleteTransaction={vi.fn()}
        onConvertToInstallment={vi.fn()}
        cardImport={null}
        importingCardNotifications={false}
        onImportCardNotifications={vi.fn()}
      />,
    )

    expect(screen.getByText('信件匯入')).toBeInTheDocument()
    expect(screen.getByText('有入帳日')).toBeInTheDocument()
  })

  it('lets the user reconcile an imported transaction with no posted date', () => {
    const onUpdateTransaction = vi.fn()
    const showToast = vi.fn()

    render(
      <Transactions
        showToast={showToast}
        transactions={[{
          id: 'tx2',
          name: '南山保費',
          card: '永豐卡',
          category: '保險',
          amount: 1458,
          date: '2026-07-23',
          note: '自動匯入・永豐',
        }]}
        cards={[{ id: 'c1', name: '永豐卡' }]}
        onAddTransaction={vi.fn()}
        onUpdateTransaction={onUpdateTransaction}
        onDeleteTransaction={vi.fn()}
        onConvertToInstallment={vi.fn()}
        cardImport={null}
        importingCardNotifications={false}
        onImportCardNotifications={vi.fn()}
      />,
    )

    expect(screen.getByText('待對帳')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '對帳' }))

    expect(onUpdateTransaction).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith('已標記對帳')
  })

  it('filters the list to pending reconciliation transactions', () => {
    render(
      <Transactions
        showToast={vi.fn()}
        transactions={[
          {
            id: 'tx1',
            name: '待入帳消費',
            card: '永豐卡',
            category: '日常',
            amount: 500,
            date: '2026-07-23',
            note: '自動匯入・永豐',
          },
          {
            id: 'tx2',
            name: '已入帳消費',
            card: '永豐卡',
            category: '日常',
            amount: 600,
            date: '2026-07-22',
            postedDate: '2026-07-24',
            note: '自動匯入・永豐',
          },
        ]}
        cards={[{ id: 'c1', name: '永豐卡' }]}
        onAddTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
        onDeleteTransaction={vi.fn()}
        onConvertToInstallment={vi.fn()}
        cardImport={null}
        importingCardNotifications={false}
        onImportCardNotifications={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '只看待對帳（1）' }))

    expect(screen.getByText('待入帳消費')).toBeInTheDocument()
    expect(screen.queryByText('已入帳消費')).not.toBeInTheDocument()
  })

  it('calibrates a statement cycle from the transactions page', () => {
    const onUpdateCycle = vi.fn()
    const showToast = vi.fn()

    render(
      <Transactions
        showToast={showToast}
        transactions={[
          {
            id: 'tx1',
            name: '本期消費',
            cardId: 'c1',
            card: '永豐卡',
            category: '日常',
            amount: 1000,
            date: '2026-07-02',
          },
          {
            id: 'tx2',
            name: '下期才入帳',
            cardId: 'c1',
            card: '永豐卡',
            category: '日常',
            amount: 500,
            date: '2026-07-03',
            postedDate: '2026-07-08',
          },
        ]}
        cards={[{
          id: 'c1',
          name: '永豐卡',
          billingDay: 6,
          dueDay: 15,
          billingCycles: [{
            id: 'cycle1',
            closeDate: '2026-07-06',
            dueDate: '2026-07-21',
            amount: 1000,
            estimatedAmount: 1000,
            paid: false,
          }],
        }]}
        onAddTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
        onDeleteTransaction={vi.fn()}
        onConvertToInstallment={vi.fn()}
        cardImport={null}
        importingCardNotifications={false}
        onImportCardNotifications={vi.fn()}
        plans={[]}
        onUpdateCycle={onUpdateCycle}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '打開校準' }))
    fireEvent.change(screen.getByPlaceholderText('例如 4607'), { target: { value: '1000' } })

    expect(screen.getByText('銀行帳單和 App 估算一致。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '儲存校準' }))

    expect(onUpdateCycle).toHaveBeenCalledWith('c1', 'cycle1', expect.objectContaining({
      amount: 1000,
      closeDate: '2026-07-06',
      dueDate: '2026-07-21',
      amountIsActual: true,
      manuallyCalibrated: true,
    }))
    expect(showToast).toHaveBeenCalledWith('已用銀行帳單校準')
  })
})
