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
        cardImport={{ lastImportAt: new Date(2026, 6, 29, 21, 0).getTime(), lastImportCount: 3 }}
        importingCardNotifications={false}
        onImportCardNotifications={onImportCardNotifications}
      />,
    )

    expect(screen.getByText(/上次更新/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '更新信件刷卡' }))
    expect(onImportCardNotifications).toHaveBeenCalledTimes(1)
  })
})
