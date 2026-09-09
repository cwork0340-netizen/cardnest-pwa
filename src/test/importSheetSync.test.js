import { describe, expect, it } from 'vitest'
import {
  describeSkippedRow,
  findImportedTransaction,
  importedPostedDate,
  isImportedTransaction,
  isPendingReconciliation,
  isUsableImportRow,
  resolveImportedCard,
  resolveImportedCardResult,
  summarizeImportRowsByBank,
} from '../utils/importSheetSync'

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

  it('falls back to the bank mapping when the mapped card has no last four digits to contradict it', () => {
    // 卡片還沒填末四碼（欄位是選填），但銀行對應已經設好——這時候信件帶著末四碼
    // 進來不該整批被丟掉，否則使用者只會看到「這家銀行完全沒匯進來」。
    const cardsWithoutLast4 = [{ id: 'fubon-a', name: '富邦 J 卡' }]
    expect(resolveImportedCardResult({
      row: { bank: '富邦', cardLast4: '4321' },
      cards: cardsWithoutLast4,
      bankCardMap: { 富邦: 'fubon-a' },
    })).toMatchObject({ card: { id: 'fubon-a' }, reason: 'bank-fallback' })
  })

  it('reports why a row could not be matched to a card', () => {
    expect(resolveImportedCardResult({
      row: { bank: '永豐', cardLast4: '9999' },
      cards,
      bankCardMap: { 永豐: 'sinopac-a' },
    })).toMatchObject({ card: null, reason: 'last4-unknown' })

    expect(resolveImportedCardResult({
      row: { bank: '富邦', cardLast4: '' },
      cards,
      bankCardMap: {},
    })).toMatchObject({ card: null, reason: 'no-bank-mapping' })

    expect(resolveImportedCardResult({
      row: { bank: '永豐', cardLast4: '1234' },
      cards: [...cards, { id: 'dup', name: '永豐 重複卡', last4: '1234' }],
      bankCardMap: {},
    })).toMatchObject({ card: null, reason: 'last4-ambiguous' })
  })

  it('counts sheet rows per bank so an empty bank is distinguishable from a skipped one', () => {
    expect(summarizeImportRowsByBank([
      { bank: '國泰世華' }, { bank: '國泰世華' }, { bank: '永豐' }, { bank: '' },
    ])).toEqual([
      { bank: '國泰世華', count: 2 },
      { bank: '永豐', count: 1 },
      { bank: '未填銀行', count: 1 },
    ])
  })

  it('keeps enough of a skipped row to find it again in the sheet', () => {
    expect(describeSkippedRow({
      row: { bank: '富邦', cardLast4: '4321', rawDate: '2026/08/03', amount: 150, merchant: '全聯' },
      reason: 'last4-unknown',
    })).toEqual({
      bank: '富邦',
      cardLast4: '4321',
      date: '2026-08-03',
      amount: 150,
      merchant: '全聯',
      reason: 'last4-unknown',
    })
  })

  it('still recognises an imported transaction after its note has been edited', () => {
    // 備註是使用者可以改的，source 是匯入時機器寫的。只看備註的話，改過備註的那筆
    // 就會從待對帳清單、對帳提醒和列表標籤裡一起消失，明明它還是信件匯入來的。
    const renamed = { id: 'tx1', source: { provider: 'card-import', permalink: 'mail-1' }, note: '改成自己的備註' }
    expect(isImportedTransaction(renamed)).toBe(true)
    expect(isPendingReconciliation(renamed)).toBe(true)
    expect(isPendingReconciliation({ ...renamed, postedDate: '2026-08-05' })).toBe(false)
  })

  it('still recognises legacy imports that only carry the note', () => {
    // 這個功能上線前匯入的舊資料沒有 source，只有備註，不能因為改判斷就漏掉
    expect(isImportedTransaction({ id: 'old', note: '自動匯入・國泰世華' })).toBe(true)
  })

  it('does not mistake a hand-entered transaction for an imported one', () => {
    expect(isImportedTransaction({ id: 'manual', note: '茶包' })).toBe(false)
    expect(isImportedTransaction({ id: 'blank' })).toBe(false)
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
