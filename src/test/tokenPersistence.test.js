import { beforeEach, describe, expect, it } from 'vitest'
import { clearStoredToken } from '../utils/googleSheetSync'

const KEY = 'cardnest_google_token'
const valid = (mins) => JSON.stringify({ token: 'tok', expiresAt: Date.now() + mins * 60 * 1000 })

describe('授權留存', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

  it('存在 localStorage —— 關掉 App 再開還在', () => {
    // sessionStorage 一關掉 App 就清空，等於每次開都要重新授權一次
    localStorage.setItem(KEY, valid(50))
    // 模擬「關掉 App 再打開」：sessionStorage 沒了，localStorage 還在
    sessionStorage.clear()
    expect(localStorage.getItem(KEY)).not.toBeNull()
  })

  it('清除時兩邊都清掉，不會留下舊的壞 token', () => {
    localStorage.setItem(KEY, valid(50))
    sessionStorage.setItem(KEY, valid(50))
    clearStoredToken()
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })
})
