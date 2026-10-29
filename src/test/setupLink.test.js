import { describe, expect, it } from 'vitest'
import { buildSetupLink, parseSetupHash } from '../utils/setupLink'

const ids = { clientId: '123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com', sheetId: '1fY9uE-AbrTkNStOI2a8gJpyXHEvTdoZq7kixBAVURVc' }

describe('設定連結', () => {
  it('產生之後可以原樣讀回', () => {
    const link = buildSetupLink('https://cardnest.example', ids)
    expect(link.startsWith('https://cardnest.example/#setup=')).toBe(true)
    expect(parseSetupHash('#' + link.split('#')[1])).toEqual(ids)
  })

  it('網址裡不會出現需要跳脫的字元', () => {
    expect(buildSetupLink('https://x', ids).split('#')[1]).toMatch(/^setup=[A-Za-z0-9_-]+$/)
  })

  it('不是設定連結、被截斷、內容不對都回傳 null，不丟錯', () => {
    expect(parseSetupHash('')).toBeNull()
    expect(parseSetupHash('#other=abc')).toBeNull()
    expect(parseSetupHash('#setup=!!!')).toBeNull()
    expect(parseSetupHash('#setup=' + btoa('{"c":1}'))).toBeNull()
    expect(parseSetupHash('#setup=' + btoa('{"c":"","s":"x"}'))).toBeNull()
    expect(parseSetupHash(undefined)).toBeNull()
  })
})
