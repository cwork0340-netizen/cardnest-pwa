import { describe, expect, it } from 'vitest'
import { buildNotificationImport, importedRowKey } from '../utils/importSheetSync'

const cards = [{ id: 'card', name: '測試卡', last4: '1234' }]
const rows = [101, 502, 603, 2004].map((amount, i) => ({
  bank: '測試銀行', cardLast4: '1234', rawDate: '2025/09/26', amount,
  merchant: ['測試商店', '', 'TEST SUBSCRIPTION', '測試百貨'][i],
  permalink: 'test-email', transactionId: `test-email:${i}`, transactionType: '消費',
}))
const run = (extra = {}) => buildNotificationImport({ rows, cards, ...extra })
const apply = (transactions, result) => [...result.newTxs,
  ...transactions.map((tx) => result.updatedTxs.find((u) => u.id === tx.id) ?? tx)]

describe('multiple purchases in a single notification', () => {
  it('imports all four rows including a blank merchant, then imports none on retry', () => {
    const first = run()
    expect(first.newTxs.map((tx) => tx.amount)).toEqual([101, 502, 603, 2004])
    expect(new Set(first.newKeys).size).toBe(4)
    const second = run({ transactions: first.newTxs, importedKeys: first.newKeys })
    expect(second.newTxs).toHaveLength(0)
    expect(second.duplicateCount).toBe(4)
  })

  it('recovers three rows from a previously imported email without duplicating the first', () => {
    const old = { id: 'old', cardId: 'card', amount: 101, date: '2025-09-26', name: '測試商店',
      source: { provider: 'card-import', permalink: 'test-email' }, note: '使用者備註' }
    const result = run({ transactions: [old], importedKeys: ['test-email'] })
    expect(result.newTxs.map((tx) => tx.amount)).toEqual([502, 603, 2004])
    expect(result.updatedTxs[0].note).toBe('使用者備註')
    expect(run({ transactions: apply([old], result), importedKeys: result.newKeys }).newTxs).toHaveLength(0)
  })

  it('keeps equal-amount purchases distinct when their transaction IDs differ', () => {
    const identical = rows.slice(0, 2).map((r) => ({ ...r, amount: 101, merchant: '同一家店' }))
    const first = run({ rows: identical })
    expect(first.newTxs).toHaveLength(2)
    expect(run({ rows: identical, transactions: first.newTxs }).newTxs).toHaveLength(0)
  })

  it('deduplicates repeated rows within one response and honours deleted row markers', () => {
    expect(run({ rows: [rows[0], rows[0]] }).newTxs).toHaveLength(1)
    expect(run({ importedKeys: [importedRowKey(rows[0])] }).newTxs).toHaveLength(3)
    expect(run({ rows: [rows[0]], importedKeys: ['test-email'] }).newTxs).toHaveLength(0)
  })

  it('does not match another email with the same card, amount and date', () => {
    const first = run({ rows: [rows[0]] })
    const other = { ...rows[0], permalink: 'different-email', transactionId: 'different:1' }
    expect(run({ rows: [other], transactions: first.newTxs }).newTxs).toHaveLength(1)
  })

  it('backfills only the matching row posted date while keeping edited amounts and notes', () => {
    const first = run()
    const edited = first.newTxs.map((tx, i) => i === 2 ? { ...tx, amount: 615, note: '含手續費' } : tx)
    const revised = rows.map((row, i) => i === 2 ? { ...row, rawPostedDate: '2025/09/29' } : row)
    const second = run({ rows: revised, transactions: edited })
    expect(second.newTxs).toHaveLength(0)
    expect(second.postedUpdatedCount).toBe(1)
    expect(second.updatedTxs[2]).toMatchObject({ amount: 615, note: '含手續費', postedDate: '2025-09-29' })
    expect(second.updatedTxs[0].postedDate).toBeUndefined()
  })

  it('preserves edited legacy single-email transactions and supports seven-column sheets', () => {
    const old = { id: 'old', cardId: 'card', amount: 115, date: '2025-09-25', name: 'edited',
      source: { provider: 'card-import', permalink: 'test-email' } }
    expect(run({ rows: [rows[0]], transactions: [old] }).newTxs).toHaveLength(0)
    const legacyRows = rows.map(({ transactionId: _id, ...row }) => row)
    const first = run({ rows: legacyRows })
    expect(first.newTxs).toHaveLength(4)
    expect(run({ rows: legacyRows, transactions: first.newTxs }).newTxs).toHaveLength(0)
    expect(run({ transactions: first.newTxs, importedKeys: first.newKeys }).newTxs).toHaveLength(0)
  })
})
