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
})
