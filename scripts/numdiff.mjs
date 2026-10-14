// 比對兩份 numbersDump 輸出：只看 (標籤, 數值) 的多重集合，不看順序。
// 用法：node scripts/numdiff.mjs before.json after.json [允許清單.json]
// 允許清單是 { "場景": ["多出來或少掉的那一列", ...] }，改版時每一項都要附理由寫在 PR 說明裡。
import { readFileSync } from 'node:fs'

const [, , beforePath, afterPath, allowPath] = process.argv
if (!beforePath || !afterPath) {
  console.error('用法：node scripts/numdiff.mjs before.json after.json [allow.json]')
  process.exit(2)
}
const before = JSON.parse(readFileSync(beforePath, 'utf8'))
const after = JSON.parse(readFileSync(afterPath, 'utf8'))
const allow = allowPath ? JSON.parse(readFileSync(allowPath, 'utf8')) : {}

const count = (rows) => rows.reduce((m, r) => m.set(r, (m.get(r) ?? 0) + 1), new Map())
let problems = 0
let total = 0
for (const scene of new Set([...Object.keys(before), ...Object.keys(after)])) {
  const a = count(before[scene] ?? [])
  const b = count(after[scene] ?? [])
  const allowed = new Set(allow[scene] ?? [])
  total += (before[scene] ?? []).length
  for (const row of new Set([...a.keys(), ...b.keys()])) {
    const delta = (b.get(row) ?? 0) - (a.get(row) ?? 0)
    if (delta === 0 || allowed.has(row)) continue
    problems++
    console.log(`${delta > 0 ? '+' : '-'} [${scene}] ${row}${Math.abs(delta) > 1 ? ` ×${Math.abs(delta)}` : ''}`)
  }
}
console.log(problems === 0 ? `數字完全相同（${total} 列）` : `有 ${problems} 處不同`)
process.exit(problems === 0 ? 0 : 1)
