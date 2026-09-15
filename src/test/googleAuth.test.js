import { describe, expect, it } from 'vitest'
import { describeClientIdProblem, sanitizeClientId } from '../utils/googleSheetSync'

describe('Client ID 檢查', () => {
  it('正確的 Client ID 沒有問題', () => {
    expect(describeClientIdProblem('123456789-abcdef.apps.googleusercontent.com')).toBe('')
    expect(describeClientIdProblem('  123456789-abcdef.apps.googleusercontent.com  ')).toBe('')
  })

  it('抓出最常見的貼錯：貼成 Client Secret', () => {
    // Secret 長這樣，結尾不是 .apps.googleusercontent.com。送出去 Google 會回
    // 一個跳轉出去的 400 頁面，App 這邊收不到任何訊息。
    const problem = describeClientIdProblem('GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ')
    expect(problem).toContain('.apps.googleusercontent.com')
  })

  it('抓出只複製到一半', () => {
    expect(describeClientIdProblem('123456789-abcdef')).toContain('.apps.googleusercontent.com')
  })

  it('抓出中間夾了空白或換行', () => {
    expect(describeClientIdProblem('123456789 -abc.apps.googleusercontent.com')).toContain('空白')
    expect(describeClientIdProblem('123456789\n-abc.apps.googleusercontent.com')).toContain('空白')
  })

  it('空的就說要先填', () => {
    expect(describeClientIdProblem('')).toContain('請先填')
    expect(describeClientIdProblem(undefined)).toContain('請先填')
  })
})

describe('看不見的字元', () => {
  it('清掉從網頁複製時夾帶的零寬字元', () => {
    // 這是最難查的一種：Client ID 看起來一字不差，Google 卻回 400
    const withZwsp = '123456789-abc​.apps.googleusercontent.com'
    expect(sanitizeClientId(withZwsp)).toBe('123456789-abc.apps.googleusercontent.com')
    expect(describeClientIdProblem(withZwsp)).toBe('')
  })

  it('也處理 BOM、軟連字號、word joiner', () => {
    for (const ch of ['﻿', '­', '⁠', '‍']) {
      expect(sanitizeClientId(`123456789-abc${ch}.apps.googleusercontent.com`))
        .toBe('123456789-abc.apps.googleusercontent.com')
    }
  })

  it('零寬字元躲在結尾也抓得到——否則結尾比對會失敗', () => {
    expect(describeClientIdProblem('123456789-abc.apps.googleusercontent.com​')).toBe('')
  })
})
