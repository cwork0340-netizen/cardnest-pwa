import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assembleSnapshots, backupToSheet, checksum, listBackups, restoreFromSheet, splitChunks } from '../services/sheetsSync'

// 記憶體裡的假 Google Sheets：只實作備份會用到的幾個呼叫。
function fakeSheets({ legacy = null, cellLimit = 50000 } = {}) {
  const tabs = new Map([['備份', { gid: 1, rows: legacy ? [legacy] : [] }]])
  let nextGid = 10
  const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
  const fail = (message) => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: { message } }) })
  const fetchFn = vi.fn((url, init = {}) => {
    const path = decodeURIComponent(url.replace('https://sheets.googleapis.com/v4/spreadsheets/', ''))
    const body = init.body ? JSON.parse(init.body) : null
    if (init.method === 'GET' && path.includes('?fields=')) {
      return json({ sheets: [...tabs].map(([title, t]) => ({ properties: { title, sheetId: t.gid } })) })
    }
    if (init.method === 'POST' && path.endsWith(':batchUpdate')) {
      const replies = []
      for (const r of body.requests) {
        if (r.addSheet) {
          const gid = nextGid++
          tabs.set(r.addSheet.properties.title, { gid, rows: [] })
          replies.push({ addSheet: { properties: { sheetId: gid, title: r.addSheet.properties.title } } })
        } else if (r.deleteDimension) {
          const { sheetId, startIndex, endIndex } = r.deleteDimension.range
          const tab = [...tabs.values()].find((t) => t.gid === sheetId)
          tab.rows.splice(startIndex, endIndex - startIndex)
          replies.push({})
        }
      }
      return json({ replies })
    }
    const tabName = path.match(/\/values\/([^!]+)!/)?.[1]
    const tab = tabs.get(tabName)
    if (!tab) return fail('Unable to parse range: ' + tabName)
    if (init.method === 'POST' && path.includes(':append')) {
      for (const row of body.values) {
        if (row.some((c) => String(c).length > cellLimit)) return fail('Your input contains more than the maximum of 50000 characters in a single cell.')
      }
      tab.rows.push(...body.values.map((r) => r.map(String)))
      return json({})
    }
    if (init.method === 'GET') return json({ values: tab.rows })
    return fail('unexpected ' + init.method + ' ' + path)
  })
  return { fetchFn, tabs }
}

const clock = (iso) => () => new Date(iso)
let sheets
beforeEach(() => { sheets = fakeSheets(); vi.stubGlobal('fetch', sheets.fetchFn) })
afterEach(() => vi.unstubAllGlobals())

const bigData = (n) => ({ cards: [{ id: 'c1', name: '國泰' }], transactions: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: '交易 ' + i, amount: i, note: '自動匯入・國泰世華' + 'x'.repeat(80) })) })

describe('分段與檢查碼', () => {
  it('切成 4 萬字一段，接回來完全一樣', () => {
    const text = 'a'.repeat(100001)
    const chunks = splitChunks(text)
    expect(chunks.map((c) => c.length)).toEqual([40000, 40000, 20001])
    expect(chunks.join('')).toBe(text)
  })

  it('少一段就不算完整', () => {
    const text = JSON.stringify({ a: 'x'.repeat(100) })
    const rows = splitChunks(text, 40).map((c, i, all) => ['s1', '2026-10-28T00:00:00Z', i, all.length, checksum(text), c])
    expect(assembleSnapshots(rows)[0].complete).toBe(true)
    expect(assembleSnapshots(rows.slice(1))[0].complete).toBe(false)
  })

  it('內容被改過（檢查碼不符）不算完整', () => {
    const text = JSON.stringify({ a: 'x'.repeat(100) })
    const rows = splitChunks(text, 40).map((c, i, all) => ['s1', '2026-10-28T00:00:00Z', i, all.length, checksum(text), c])
    rows[1][5] = 'tampered'
    expect(assembleSnapshots(rows)[0].complete).toBe(false)
  })
})

describe('備份與還原', () => {
  it('資料比單一儲存格上限大也寫得進去，而且原樣還原', async () => {
    const data = bigData(600)
    expect(JSON.stringify(data).length).toBeGreaterThan(50000)
    await backupToSheet('tok', 'sheet1', data, { now: clock('2026-10-28T10:00:00Z') })
    const rows = sheets.tabs.get('雲端備份').rows
    expect(rows.length).toBeGreaterThan(1)
    const restored = await restoreFromSheet('tok', 'sheet1')
    expect(restored.backupData).toEqual(data)
    expect(restored.savedAt).toBe('2026-10-28T10:00:00.000Z')
  })

  it('只留最近 5 份，最新的在最前面', async () => {
    for (let day = 1; day <= 7; day++) {
      await backupToSheet('tok', 'sheet1', { cards: [], transactions: [{ id: String(day) }] }, { now: clock(`2026-10-0${day}T10:00:00Z`) })
    }
    const list = await listBackups('tok', 'sheet1')
    expect(list).toHaveLength(5)
    expect(list.map((b) => b.backupData.transactions[0].id)).toEqual(['7', '6', '5', '4', '3'])
  })

  it('最新一份寫到一半壞掉，還原會退回前一份，並清掉壞的', async () => {
    await backupToSheet('tok', 'sheet1', bigData(5), { now: clock('2026-10-01T10:00:00Z') })
    await backupToSheet('tok', 'sheet1', bigData(600), { now: clock('2026-10-02T10:00:00Z') })
    const tab = sheets.tabs.get('雲端備份')
    // 弄壞第二份的最後一段
    const lastRow = tab.rows[tab.rows.length - 1]
    lastRow[5] = lastRow[5].slice(0, -50)
    const restored = await restoreFromSheet('tok', 'sheet1')
    expect(restored.backupData.transactions).toHaveLength(5)

    await backupToSheet('tok', 'sheet1', bigData(7), { now: clock('2026-10-03T10:00:00Z') })
    const ids = [...new Set(tab.rows.map((r) => r[1]))]
    expect(ids).toEqual(['2026-10-01T10:00:00.000Z', '2026-10-03T10:00:00.000Z'])
  })

  it('還沒備份過回傳 null', async () => {
    expect(await restoreFromSheet('tok', 'sheet1')).toBeNull()
  })

  it('舊版（整份放在「備份」A1:B1）仍然讀得回來，新格式有的話優先用新的', async () => {
    sheets = fakeSheets({ legacy: ['2026-09-01T00:00:00Z', JSON.stringify({ cards: [], transactions: [{ id: 'old' }] })] })
    vi.stubGlobal('fetch', sheets.fetchFn)
    expect((await restoreFromSheet('tok', 'sheet1')).backupData.transactions[0].id).toBe('old')
    await backupToSheet('tok', 'sheet1', { cards: [], transactions: [{ id: 'new' }] }, { now: clock('2026-10-28T10:00:00Z') })
    expect((await restoreFromSheet('tok', 'sheet1')).backupData.transactions[0].id).toBe('new')
    expect((await listBackups('tok', 'sheet1')).map((b) => b.legacy)).toEqual([false, true])
  })

  it('寫入失敗時丟出錯誤，不會假裝成功', async () => {
    sheets = fakeSheets({ cellLimit: 10 })
    vi.stubGlobal('fetch', sheets.fetchFn)
    await expect(backupToSheet('tok', 'sheet1', bigData(3))).rejects.toThrow(/50000/)
  })
})
