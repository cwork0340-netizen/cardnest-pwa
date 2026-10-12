import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../utils/googleSheetSync', async () => ({
  ...(await vi.importActual('../utils/googleSheetSync')),
  getAccessToken: vi.fn(async () => 'token'),
  runSheetSync: vi.fn(async () => ({ count: 12, cycleCount: 3, planUpdated: false })),
}))

import App from '../App.jsx'
import { getAccessToken, runSheetSync } from '../utils/googleSheetSync'

const DAY = 24 * 60 * 60 * 1000
const CLIENT_ID = '123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com'

function seed(googleSync) {
  localStorage.setItem('cardnest_v1', JSON.stringify({
    cards: [{ id: 'c1', name: '永豐卡', color: '#5E7CE2', billingDay: 12, dueDay: 2, budget: 20000 }],
    plans: [], transactions: [], fxSettings: { usdRate: 32.5, feeRate: 1.5 },
    googleSync,
  }))
}

beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })
afterEach(() => vi.useRealTimers())

describe('Google Sheet 同步提醒', () => {
  it('超過一週沒同步時在總覽提醒', () => {
    seed({ clientId: CLIENT_ID, sheetId: 'sheet1', lastSyncAt: Date.now() - 10 * DAY })
    render(<App />)
    expect(screen.getByText('已經 10 天沒有同步到 Google Sheet')).toBeInTheDocument()
  })

  it('一週內同步過、或根本沒設定同步，就不打擾', () => {
    seed({ clientId: CLIENT_ID, sheetId: 'sheet1', lastSyncAt: Date.now() - 1 * DAY })
    const { unmount } = render(<App />)
    expect(screen.queryByText(/沒有同步到 Google Sheet/)).not.toBeInTheDocument()
    unmount()

    localStorage.clear()
    seed(null)
    render(<App />)
    expect(screen.queryByText(/沒有同步到 Google Sheet/)).not.toBeInTheDocument()
  })

  it('點「立即同步」才授權並同步，成功後提醒消失並記下同步時間', async () => {
    seed({ clientId: CLIENT_ID, sheetId: 'sheet1', lastSyncAt: Date.now() - 10 * DAY, lastBackupAt: 'keep-me' })
    render(<App />)
    expect(getAccessToken).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '立即同步' }))

    await waitFor(() => expect(screen.queryByText(/沒有同步到 Google Sheet/)).not.toBeInTheDocument())
    expect(getAccessToken).toHaveBeenCalledTimes(1)
    expect(runSheetSync).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'token', sheetId: 'sheet1' }))
    const saved = JSON.parse(localStorage.getItem('cardnest_v1')).googleSync
    expect(saved.lastSyncCount).toBe(12)
    expect(Date.now() - saved.lastSyncAt).toBeLessThan(60 * 1000)
    expect(saved.lastBackupAt).toBe('keep-me')
  })

  it('Client ID 有問題時不去授權，直接說明原因', async () => {
    seed({ clientId: 'not-a-client-id', sheetId: 'sheet1', lastSyncAt: Date.now() - 10 * DAY })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '立即同步' }))
    await waitFor(() => expect(screen.getByText(/Client ID/)).toBeInTheDocument())
    expect(getAccessToken).not.toHaveBeenCalled()
  })
})
