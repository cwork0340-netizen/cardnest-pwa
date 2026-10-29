import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../utils/googleSheetSync', async () => ({
  ...(await vi.importActual('../utils/googleSheetSync')),
  getAccessToken: vi.fn(async () => 'token'),
}))
vi.mock('../utils/importSheetSync', async () => ({
  ...(await vi.importActual('../utils/importSheetSync')),
  fetchImportRows: vi.fn(async () => []),
}))
vi.mock('../services/sheetsSync', async () => ({
  ...(await vi.importActual('../services/sheetsSync')),
  backupToSheet: vi.fn(async () => '2026-10-28T10:00:00.000Z'),
  listBackups: vi.fn(),
}))

import App from '../App.jsx'
import { goTo } from './helpers/nav'
import { getAccessToken } from '../utils/googleSheetSync'
import { backupToSheet, listBackups } from '../services/sheetsSync'
import { buildSetupLink } from '../utils/setupLink'

const CLIENT_ID = '123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com'
const DAY = 24 * 60 * 60 * 1000
const card = { id: 'c1', name: '國泰', color: '#0E9F8E', billingDay: 26, dueDay: 15, budget: 40000 }

function seed(extra = {}) {
  localStorage.setItem('cardnest_v1', JSON.stringify({
    cards: [card], plans: [], transactions: [{ id: 't1', name: '全聯', amount: 300, date: '2026-10-20', category: '日常', cardId: 'c1', card: '國泰' }],
    fxSettings: { usdRate: 32.5, feeRate: 1.5 }, ...extra,
  }))
}
const configured = (extra = {}) => ({ googleSync: { clientId: CLIENT_ID, sheetId: 'sheet1', lastSyncAt: Date.now(), ...extra }, cardImport: { sheetId: 'imp1', bankCardMap: {}, importedKeys: [] } })
const saved = () => JSON.parse(localStorage.getItem('cardnest_v1'))

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); window.location.hash = '' })
afterEach(() => { window.location.hash = '' })

describe('自動雲端備份', () => {
  it('按「更新信件刷卡」之後自動備份，備份的是更新後的資料，並記下備份時間', async () => {
    seed(configured())
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '更新信件刷卡' }))
    await waitFor(() => expect(backupToSheet).toHaveBeenCalledTimes(1))
    const [token, sheetId, data] = backupToSheet.mock.calls[0]
    expect(token).toBe('token')
    expect(sheetId).toBe('sheet1')
    expect(data.cards).toHaveLength(1)
    expect(data.transactions.map((t) => t.id)).toContain('t1')
    await waitFor(() => expect(saved().googleSync.lastBackupAt).toBe('2026-10-28T10:00:00.000Z'))
  })

  it('沒設定 Sheet 就不備份，也不報錯', async () => {
    seed({ googleSync: { clientId: CLIENT_ID }, cardImport: { sheetId: 'imp1', bankCardMap: {}, importedKeys: [] } })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '更新信件刷卡' }))
    await waitFor(() => expect(getAccessToken).toHaveBeenCalled())
    expect(backupToSheet).not.toHaveBeenCalled()
  })

  it('備份失敗只提示，不會把剛更新的資料弄丟', async () => {
    backupToSheet.mockRejectedValueOnce(new Error('quota'))
    seed(configured())
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '更新信件刷卡' }))
    await waitFor(() => expect(screen.getByText(/雲端備份失敗：quota/)).toBeInTheDocument())
    expect(saved().transactions).toHaveLength(1)
    expect(saved().googleSync.lastBackupAt).toBeUndefined()
  })
})

describe('備份提醒', () => {
  it('超過 3 天沒備份就在現況提醒，點「立即備份」才授權', async () => {
    seed(configured({ lastBackupAt: new Date(Date.now() - 5 * DAY).toISOString() }))
    render(<App />)
    expect(screen.getByText('已經 5 天沒有備份到雲端')).toBeInTheDocument()
    expect(getAccessToken).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '立即備份' }))
    await waitFor(() => expect(backupToSheet).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText(/天沒有備份到雲端/)).not.toBeInTheDocument())
  })

  it('從來沒備份過，提醒說換手機會拿不回來', () => {
    seed(configured())
    render(<App />)
    expect(screen.getByText('還沒有備份到雲端，換手機會拿不回來')).toBeInTheDocument()
  })

  it('3 天內備份過，或根本沒設定雲端，就不打擾，並顯示上次備份時間', () => {
    seed(configured({ lastBackupAt: new Date(Date.now() - 1 * DAY).toISOString() }))
    const { unmount } = render(<App />)
    expect(screen.queryByText(/沒有備份到雲端|還沒有備份/)).not.toBeInTheDocument()
    expect(screen.getByText(/已備份 \d+\/\d+ \d\d:\d\d/)).toBeInTheDocument()
    unmount()

    localStorage.clear()
    seed()
    render(<App />)
    expect(screen.queryByText(/沒有備份到雲端|還沒有備份/)).not.toBeInTheDocument()
  })
})

describe('換手機：設定連結與還原', () => {
  it('新手機打開設定連結：自動帶入 Client ID 與 Sheet ID，並跳到設定頁', async () => {
    window.location.hash = new URL(buildSetupLink('http://localhost', { clientId: CLIENT_ID, sheetId: 'sheetX' })).hash
    render(<App />)
    await waitFor(() => expect(screen.getByText('已帶入雲端設定，往下按「還原整份資料」')).toBeInTheDocument())
    expect(saved().googleSync).toEqual({ clientId: CLIENT_ID, sheetId: 'sheetX' })
    expect(screen.getByRole('button', { name: '還原整份資料' })).toBeInTheDocument()
    expect(window.location.hash).toBe('')
  })

  it('這台已經有設定時，連結不會覆蓋', async () => {
    seed(configured())
    window.location.hash = new URL(buildSetupLink('http://localhost', { clientId: 'other.apps.googleusercontent.com', sheetId: 'sheetX' })).hash
    render(<App />)
    await waitFor(() => expect(screen.getByText('這台已經有 Google 設定，沒有被連結覆蓋')).toBeInTheDocument())
    expect(saved().googleSync.sheetId).toBe('sheet1')
  })

  it('還原：先列出雲端備份讓你選，選舊的一份還原，才會取代本機資料', async () => {
    seed(configured())
    listBackups.mockResolvedValue([
      { id: 'b2', savedAt: '2026-10-28T10:00:00.000Z', legacy: false, backupData: { cards: [card, { ...card, id: 'c2', name: '台新' }], plans: [], transactions: [] } },
      { id: 'b1', savedAt: '2026-10-20T10:00:00.000Z', legacy: false, backupData: { cards: [{ ...card, id: 'c9', name: '富邦M' }], plans: [], transactions: [{ id: 'old', name: '舊的', amount: 1, date: '2026-10-01', cardId: 'c9', card: '富邦M' }] } },
    ])
    render(<App />)
    goTo('設定')
    fireEvent.click(screen.getByRole('button', { name: '還原整份資料' }))
    await waitFor(() => expect(screen.getByText(/目前的資料（1 張卡、1 筆刷卡）會被取代/)).toBeInTheDocument())
    // 還沒按確認，本機資料沒動
    expect(saved().cards.map((c) => c.name)).toEqual(['國泰'])

    const options = screen.getAllByRole('radio', { name: /張卡・.* 筆刷卡/ })
    fireEvent.click(options[1])
    fireEvent.click(screen.getByRole('button', { name: '用這份還原' }))
    await waitFor(() => expect(saved().cards.map((c) => c.name)).toEqual(['富邦M']))
    expect(saved().transactions.map((t) => t.id)).toEqual(['old'])
  })

  it('取消還原：本機資料不變', async () => {
    seed(configured())
    listBackups.mockResolvedValue([{ id: 'b1', savedAt: '2026-10-20T10:00:00.000Z', legacy: false, backupData: { cards: [], plans: [], transactions: [] } }])
    render(<App />)
    goTo('設定')
    fireEvent.click(screen.getByRole('button', { name: '還原整份資料' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '用這份還原' })).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: '取消' }).pop())
    expect(saved().cards).toHaveLength(1)
  })
})
