// 「標籤→數值」傾印：改版時用來證明數字沒變。不比整頁文字（文案會改、版面會搬），
// 只記錄每個金額／筆數旁邊的標籤與數值。平常不執行；要用時設定輸出檔：
//   DIFF_OUT=/tmp/before.json npx vitest run src/test/numbersDump.test.jsx   （在 master）
//   DIFF_OUT=/tmp/after.json  npx vitest run src/test/numbersDump.test.jsx   （在分支）
//   node scripts/numdiff.mjs /tmp/before.json /tmp/after.json
import { describe, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { writeFileSync } from 'node:fs'
import App from '../App.jsx'
import { designSeed as data } from './fixtures/designSeed.js'

const NUM = /^[−－-]?\s?NT\$\s?[−－-]?[\d,]+(\.\d+)?$|^[\d,]+\s?(筆|期|天|張)$|^\d+%$/
function leafTexts(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const out = []
  while (w.nextNode()) { const t = w.currentNode.textContent.trim(); if (t) out.push({ t, el: w.currentNode.parentElement }) }
  return out
}
// 每個數值配上「同一容器內、它前面最近的非數值文字」當標籤；再補上所在卡片名稱當脈絡
function dump(root, ctxName) {
  const leaves = leafTexts(root)
  const rows = []
  leaves.forEach((leaf, i) => {
    if (!NUM.test(leaf.t)) return
    let label = ''
    for (let j = i - 1; j >= 0 && j >= i - 4; j--) { if (!NUM.test(leaves[j].t)) { label = leaves[j].t; break } }
    rows.push(`${ctxName} | ${label.slice(0, 24)} = ${leaf.t}`)
  })
  return rows
}

describe.skipIf(!process.env.DIFF_OUT)('numbers dump', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())
  it('dump', () => {
    const out = {}
    for (const [tn, when] of Object.entries({ day13: new Date(2026, 9, 13, 8, 30), day26: new Date(2026, 9, 26, 10) })) {
      cleanup(); localStorage.clear(); vi.setSystemTime(when)
      localStorage.setItem('cardnest_v1', JSON.stringify(data))
      render(<App />)
      out[`${tn}/dashboard`] = dump(document.body, 'dash')
      document.querySelectorAll('.credit-card-summary-row').forEach((r) => fireEvent.click(r))
      out[`${tn}/dashboard-expanded`] = dump(document.body, 'dash-x')
      fireEvent.click(screen.getByRole('button', { name: '規劃', exact: true }))
      out[`${tn}/plan`] = dump(document.body, 'plan')
      fireEvent.click(screen.getByRole('button', { name: '刷卡', exact: true }))
      out[`${tn}/tx`] = dump(document.body, 'tx')
      fireEvent.click(screen.getByRole('button', { name: '打開校準' }))
      out[`${tn}/tx-calib`] = dump(document.body, 'calib')
    }
    writeFileSync(process.env.DIFF_OUT, JSON.stringify(out, null, 1))
  })
})
