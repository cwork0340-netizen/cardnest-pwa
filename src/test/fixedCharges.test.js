import { describe, expect, it } from 'vitest'
import { buildFixedCharges, formatMonth } from '../utils/fixedCharges'

const today = new Date(2026, 9, 28)
const inst = (id, name, amount, totalCount, paidCount) => ({
  id, name, type: 'installment', card: '永豐', amount, totalCount,
  occurrences: Array.from({ length: paidCount }, (_, i) => ({ id: `${id}-${i}`, paid: true, dueDate: '2026-01-05', amount })),
})
const sub = (id, name, amount, extra = {}) => ({ id, name, type: 'subscription', card: '國泰', amount, period: '月', active: true, ...extra })

const plans = [
  inst('i3', '印刷橘子', 3003, 3, 2),     // 剩 1
  inst('i4', '新光人壽', 2017, 15, 7),    // 剩 8
  inst('i1', '飛南山', 1458, 19, 9),      // 剩 10
  inst('i2', '飛南山2', 765, 18, 6),      // 剩 12
  sub('p1', 'ChatGPT', 690), sub('p2', 'Claude', 600), sub('p3', 'Disney+', 270), sub('p4', 'Notion', 330),
]

describe('固定扣款', () => {
  const r = buildFixedCharges(plans, { today, income: 60000 })

  it('每月合計＝分期當期款＋訂閱月費', () => {
    expect(r.monthly).toBe(3003 + 2017 + 1458 + 765 + 690 + 600 + 270 + 330)
    expect(r.monthly).toBe(9133)
    expect(r.yearly).toBe(9133 * 12)
  })

  it('占收入比與燈號：15% 偏高', () => {
    expect(r.share).toBeCloseTo(0.152, 3)
    expect(r.level).toBe('warn')
    expect(buildFixedCharges(plans, { today, income: 100000 }).level).toBe('ok')
    expect(buildFixedCharges(plans, { today, income: 30000 }).level).toBe('danger')
    expect(buildFixedCharges(plans, { today }).level).toBeNull()
  })

  it('分期剩餘總負債＝各筆 剩餘期數 × 每期金額', () => {
    expect(r.debtRemaining).toBe(3003 * 1 + 2017 * 8 + 1458 * 10 + 765 * 12)
  })

  it('未來 12 個月：分期結束的月份少一筆', () => {
    expect(r.timeline.map((m) => m.total)).toEqual([9133, 6130, 6130, 6130, 6130, 6130, 6130, 6130, 4113, 4113, 2655, 2655])
    expect(r.timeline[0]).toMatchObject({ year: 2026, month: 10 })
    expect(r.timeline[11]).toMatchObject({ year: 2027, month: 9 })
  })

  it('什麼時候釋放：每一次下降的月份、金額與哪一筆', () => {
    expect(r.releases.map((x) => [x.year, x.month, x.amount, x.names])).toEqual([
      [2026, 11, 3003, ['印刷橘子']],
      [2027, 6, 2017, ['新光人壽']],
      [2027, 8, 1458, ['飛南山']],
    ])
  })

  it('分期結束月：剩 N 期＝從這個月起算第 N 個月', () => {
    expect(r.installments.map((p) => [p.name, p.remaining, formatMonth(p.end, today)])).toEqual([
      ['印刷橘子', 1, '10 月'], ['新光人壽', 8, '2027/5'], ['飛南山', 10, '2027/7'], ['飛南山2', 12, '2027/9'],
    ])
  })

  it('停用的訂閱、已繳完的分期、年繳訂閱', () => {
    const r2 = buildFixedCharges([
      sub('a', '停用的', 500, { active: false }),
      inst('done', '繳完了', 1000, 3, 3),
      sub('y', '年繳', 1200, { period: '年' }),
    ], { today })
    expect(r2.monthly).toBe(100)
    expect(r2.installments).toEqual([])
    expect(r2.subscriptions.map((s) => s.name)).toEqual(['年繳'])
  })

  it('沒有任何固定扣款', () => {
    const r3 = buildFixedCharges([], { today, income: 50000 })
    expect(r3.monthly).toBe(0)
    expect(r3.releases).toEqual([])
    expect(r3.level).toBe('ok')
  })
})
