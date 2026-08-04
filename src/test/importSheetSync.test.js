import { describe, expect, it } from 'vitest'
import { findImportedTransaction, importedPostedDate, isUsableImportRow, resolveImportedCard } from '../utils/importSheetSync'

const cards = [
  { id: 'sinopac-a', name: '永豐 DAWHO', last4: '1234' },
  { id: 'sinopac-b', name: '永豐 Sport', last4: '5678' },
]

describe('card notification import safeguards', () => {
  it('routes same-bank cards by their last four digits', () => {
    expect(resolveImportedCard({
      row: { bank: '永豐', cardLast4: '5678' },
      cards,
      bankCardMap: { 永豐: 'sinopac-a' },
    })).toMatchObject({ id: 'sinopac-b' })
  })

  it('does not use a bank-only mapping when the row has an unknown last four digits', () => {
    expect(resolveImportedCard({
      row: { bank: '永豐', cardLast4: '9999' },
      cards,
      bankCardMap: { 永豐: 'sinopac-a' },
    })).toBeNull()
  })

  it('rejects unusable source rows before they can affect a statement estimate', () => {
    expect(isUsableImportRow({ permalink: 'mail-1', rawDate: '2026/08/03', amount: '150' })).toBe(true)
    expect(isUsableImportRow({ permalink: 'mail-2', rawDate: 'not-a-date', amount: '150' })).toBe(false)
    expect(isUsableImportRow({ permalink: 'mail-3', rawDate: '2026/08/03', amount: '0' })).toBe(false)
    expect(isUsableImportRow({ permalink: 'mail-4', rawDate: '2026/08/03', amount: 'oops' })).toBe(false)
  })

  it('finds an existing imported transaction by source permalink before using a safe legacy match', () => {
    const card = cards[0]
    const transactions = [
      { id: 'source-match', source: { provider: 'card-import', permalink: 'mail-1' }, cardId: card.id, amount: 99, date: '2026-08-01' },
      { id: 'legacy-match', note: '自動匯入・銀行', cardId: card.id, amount: 100, date: '2026-08-02' },
    ]

    expect(findImportedTransaction({ row: { permalink: 'mail-1', rawDate: '2026/08/01', amount: 99 }, card, transactions })?.id).toBe('source-match')
    expect(findImportedTransaction({ row: { permalink: 'missing', rawDate: '2026/08/02', amount: 100 }, card, transactions })?.id).toBe('legacy-match')
  })

  it('only accepts a real posted date for a backfill', () => {
    expect(importedPostedDate({ rawPostedDate: '2026/08/05' })).toBe('2026-08-05')
    expect(importedPostedDate({ rawPostedDate: 'not posted' })).toBe('')
  })
})
