import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import QuickTransactionForm from '../components/QuickTransactionForm'
import TransactionItem from '../components/TransactionItem'

const cards = [{ id: 'c1', name: '富邦M' }]

describe('refunds in the transaction form', () => {
  it('records a refund as a negative amount', () => {
    const onSubmit = vi.fn()
    render(<QuickTransactionForm cards={cards} onSubmit={onSubmit} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '退款' }))
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1254' } })
    fireEvent.click(screen.getByRole('button', { name: '記一筆' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: -1254, isRefund: true }))
  })

  it('still records a normal purchase as a positive amount', () => {
    const onSubmit = vi.fn()
    render(<QuickTransactionForm cards={cards} onSubmit={onSubmit} onClose={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '300' } })
    fireEvent.click(screen.getByRole('button', { name: '記一筆' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 300 }))
  })

  it('opens an existing refund as a refund and keeps its sign when saved', () => {
    const onSubmit = vi.fn()
    render(
      <QuickTransactionForm
        cards={cards}
        onSubmit={onSubmit}
        onClose={vi.fn()}
        initialValues={{ amount: -1254, category: '購物', cardId: 'c1', date: '2026-09-19', name: 'momo' }}
      />,
    )

    expect(screen.getByPlaceholderText('0').value).toBe('1254')
    expect(screen.getByRole('button', { name: '退款' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '儲存修改' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: -1254 }))
  })

  it('shows a refund as money coming back, not as a double negative', () => {
    render(<TransactionItem tx={{ id: 'r', name: 'momo', card: '富邦M', category: '購物', amount: -1254, date: '2026-09-19' }} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('+NT$1,254')).toBeInTheDocument()
  })
})
