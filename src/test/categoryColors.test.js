import { describe, expect, it } from 'vitest'
import { categoryColor } from '../utils/categoryColors'

describe('category colours', () => {
  it('gives每個已知分類不同的顏色', () => {
    const known = ['餐飲', '購物', '訂閱', '日常', '交通', '娛樂', '保險', '醫療']
    const colours = known.map(categoryColor)
    expect(new Set(colours).size).toBe(known.length)
  })

  it('never lets an unnamed category impersonate a named one', () => {
    // 自訂分類雜湊到跟「餐飲」同色的話，同一張圓餅圖上就有兩塊一樣的顏色
    const named = ['餐飲', '購物', '訂閱', '日常', '交通', '娛樂', '保險', '醫療', '其他'].map(categoryColor)
    for (const custom of ['自訂分類', '寵物', 'coffee', '孝親費', '健身房', '書', '禮物', '旅遊', '停車']) {
      expect(named).not.toContain(categoryColor(custom))
    }
  })

  it('keeps a category on the same colour regardless of how much was spent', () => {
    // 用名稱雜湊而不是排名，這樣月月對照顏色才有意義
    expect(categoryColor('寵物')).toBe(categoryColor('寵物'))
    expect(categoryColor('餐飲')).toBe(categoryColor('餐飲'))
  })

  it('falls back to a real colour for a blank category', () => {
    expect(categoryColor('')).toMatch(/^#[0-9A-F]{6}$/i)
    expect(categoryColor(undefined)).toMatch(/^#[0-9A-F]{6}$/i)
  })
})
