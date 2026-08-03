import { describe, expect, it } from 'vitest'
import { isUsableImportRow, resolveImportedCard } from '../utils/importSheetSync'

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
})
