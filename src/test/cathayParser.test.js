import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildNotificationImport } from '../utils/importSheetSync'

const context = vm.createContext({ Date })
vm.runInContext(readFileSync('scripts/card-import/CathayMulti.gs', 'utf8'), context)
const table = (amount, merchant, time, mobile = '', date = '2025/09/26') => `<table>
  <tr><td>卡別</td><td>行動卡號<br>後4碼</td><td>授權日期</td><td>授權時間</td><td>消費地區</td></tr>
  <tr><td>正卡</td><td>${mobile}</td><td>${date}</td><td>${time}</td><td>TW</td></tr>
  <tr><td>消費金額</td><td>商店名稱</td><td>消費類別</td><td>備註</td></tr>
  <tr><td>NT$${amount}</td><td>${merchant}</td><td>一般購物</td><td>註一</td></tr>
</table>`
// Synthetic fixtures model the supplied screenshot; no personal records in Git.
const fixture = '<p>通知日期 2025/09/27</p><div>卡號後4碼：1234</div>'
  + table('101', '測試商店', '18:12') + table('502', '', '16:52')
  + table('603', 'TEST*<br>SUBSCRIPTION SERVICE', '15:09', '9876')
  + table('2,004', '測試百貨有限公司', '17:31')
const parse = (html = fixture) => context.parseCathayMulti_(html, 'test-email')

describe('Cathay HTML notification recovery', () => {
  it('reads every purchase, its authorization date, blank merchants, and the physical card', () => {
    const result = parse()
    expect(result.errors).toEqual([])
    expect(result.rows.map((r) => r.amount)).toEqual([101, 502, 603, 2004])
    expect(result.rows.every((r) => r.date === '2025/09/26' && r.cardLast4 === '1234')).toBe(true)
    expect(result.rows[1].merchant).toBe('')
    expect(result.rows[2].merchant).toBe('TEST* SUBSCRIPTION SERVICE')
    expect(result.rows.every((r) => r.transactionType === '消費')).toBe(true)
    expect(new Set(result.rows.map((r) => r.transactionId)).size).toBe(4)
  })

  it('handles nested presentation tables, entities, and multiple card sections', () => {
    const nested = `<table><tr><td>${fixture}<div>卡號後4碼：5678</div>${table('42', 'A &amp; B', '12:00')}</td></tr></table>`
    const result = parse(nested)
    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(5)
    expect(result.rows[4]).toMatchObject({ cardLast4: '5678', merchant: 'A & B' })
  })

  it('rejects the entire message when one date, amount or layout is unrecognised', () => {
    for (const broken of [fixture.replace('2025/09/26', 'unknown'), fixture.replace('NT$502', 'USD$502'),
      fixture.replace('NT$603', 'NT$?'), fixture.replace('2025/09/26', '2025/02/30'),
      fixture + '<p>NT$999</p>']) {
      expect(parse(broken).errors.length).toBeGreaterThan(0)
      expect(parse(broken).rows).toEqual([])
    }
  })

  it('upgrades the old first row and inserts three missing rows; a second run does nothing', () => {
    const old = [['import-time', '國泰世華', '1234', '2025/09/27', 101, '測試商店', 'test-email', '2025/09/30', '繳款']]
    const result = context.planCathayRecovery_(old, parse().rows)
    expect(result.errors).toEqual([])
    expect(result.updates).toHaveLength(1)
    expect(result.inserts).toHaveLength(3)
    expect(result.updates[0].values.slice(3, 5)).toEqual(['2025/09/26', 101])
    expect(result.updates[0].values[7]).toBe('2025/09/30')
    expect(result.updates[0].values[8]).toBe('消費')
    expect(result.updates[0].values.slice(10)).toEqual(['2025/09/27', '繳款'])
    const recovered = [result.updates[0].values, ...result.inserts]
    const second = context.planCathayRecovery_(recovered, parse().rows)
    expect(second.inserts).toHaveLength(0)
    expect(second.updates).toHaveLength(0)

    const rows = recovered.map((r) => ({ bank: r[1], cardLast4: r[2], rawDate: r[3], amount: r[4], merchant: r[5],
      permalink: r[6], rawPostedDate: r[7], transactionType: r[8], transactionId: r[9], rawPreviousDate: r[10], previousTransactionType: r[11] }))
    const existingTx = { id: 'old', cardId: 'card', amount: 101, name: '測試商店', date: '2025-09-27', category: '繳款',
      source: { provider: 'card-import', permalink: 'test-email' } }
    const app = buildNotificationImport({ rows, cards: [{ id: 'card', name: '卡', last4: '1234' }],
      transactions: [existingTx], importedKeys: ['test-email'] })
    expect(app.newTxs).toHaveLength(3)
    expect(app.updatedTxs[0]).toMatchObject({ date: '2025-09-26', category: '消費', postedDate: '2025-09-30' })
    expect(app.newTxs.reduce((sum, tx) => sum + tx.amount, app.updatedTxs[0].amount)).toBe(3210)
  })

  it('does not insert duplicates when legacy matching is ambiguous', () => {
    const old = ['import-time', '國泰世華', '1234', '2025/09/27', 101, '測試商店', 'test-email']
    const duplicate = context.planCathayRecovery_([old, old], parse().rows)
    expect(duplicate.errors.length).toBeGreaterThan(0)
    expect(duplicate.inserts).toEqual([])
    const edited = context.planCathayRecovery_([[...old.slice(0, 5), 'edited', 'test-email']], parse().rows)
    expect(edited.errors.length).toBeGreaterThan(0)
    expect(edited.inserts).toEqual([])
  })

  it('retains two identical purchases with distinct occurrence IDs', () => {
    const html = '<div>卡號後4碼：1234</div>' + table('42', '商店', '12:00') + table('42', '商店', '12:00')
    const result = parse(html)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].transactionId).not.toBe(result.rows[1].transactionId)
    expect(context.planCathayRecovery_([], result.rows).inserts).toHaveLength(2)
  })
})
