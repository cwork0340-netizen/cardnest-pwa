// 檢查每個按鈕捲到畫面中央之後點不點得到（有沒有被浮動按鈕、導覽列蓋住）。用法：node covered-audit.js <網址>
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/opt/node22/lib/node_modules/playwright/node_modules/playwright-core')
const { data } = require('./seed.cjs')
const URL = process.argv[2] || 'http://localhost:5198/'
const OUT = process.argv[3] || 'audit-result.json'
const ONLY = process.argv[4] ? process.argv[4].split(',').map(Number) : null

// 加一張有「已繳／部分繳款／已轉分期」的國泰帳單，讓更多按鈕出現
const seed = JSON.parse(JSON.stringify(data))
const cu = seed.cards.find((c) => c.id === 'cu')
cu.billingCycles = [
  { id: 'cu-1', cycleKey: '2026-09', closeDate: '2026-09-27', dueDate: '2026-10-12', amount: 16308, estimatedAmount: 8858, paidAmount: 7240, paid: false, manuallyCalibrated: true, amountIsActual: true },
  { id: 'cu-2', cycleKey: '2026-10', closeDate: '2026-10-26', dueDate: '2026-11-09', amount: 25209, estimatedAmount: 9695, paid: false, manuallyCalibrated: true, amountIsActual: true },
]

const SCENARIOS = [
  ['現況', []],
  ['現況・展開其他待繳', [/還有 \d+ 張待繳/]],
  ['現況・補登表單', ['補登一筆']],
  ['刷卡', ['刷卡']],
  ['刷卡・打開校準', ['刷卡', '打開校準']],
  ['刷卡・記一筆表單', ['刷卡', '記一筆']],
  ['更多', ['更多']],
  ['各卡與帳單', ['更多', '各卡與帳單']],
  ['各卡與帳單・展開國泰', ['更多', '各卡與帳單', 'css:.credit-card-summary-row']],
  ['各卡與帳單・國泰・校準表單', ['更多', '各卡與帳單', 'css:.credit-card-summary-row', 'nth:校準:1']],
  ['各卡與帳單・國泰・部分繳款表單', ['更多', '各卡與帳單', 'css:.credit-card-summary-row', 'nth:部分繳款:0']],
  ['各卡與帳單・國泰・轉分期表單', ['更多', '各卡與帳單', 'css:.credit-card-summary-row', 'nth:轉分期:0']],
  ['固定扣款', ['更多', '固定扣款']],
  ['規劃', ['更多', '規劃']],
  ['設定', ['更多', '設定']],
  ['設定・新增信用卡表單', ['更多', '設定', '＋ 新增']],
]

async function runSteps(page, steps) {
  for (const s of steps) {
    if (typeof s === 'string' && s.startsWith('css:')) await page.locator(s.slice(4)).first().click()
    else if (typeof s === 'string' && s.startsWith('nth:')) { const [, name, n] = s.split(':'); await page.getByRole('button', { name, exact: true }).nth(Number(n)).click() }
    else await page.getByRole('button', { name: s, exact: typeof s === 'string' }).first().click()
    await page.waitForTimeout(450)
  }
}

const CLICKABLE = 'button:visible, [role=button]:visible, a[href]:visible, summary:visible, input[type=submit]:visible, input[type=checkbox]:visible, input[type=radio]:visible'

async function fresh(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-TW' })
  await ctx.clock.setFixedTime(new Date('2026-10-29T10:00:00Z'))
  await ctx.route(/accounts\.google\.com|apis\.google\.com|googleapis\.com/, (r) => r.abort())
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|google/i.test(m.text())) errors.push('console: ' + m.text()) })
  await page.addInitScript((s) => { if (!localStorage.getItem('cardnest_v1')) localStorage.setItem('cardnest_v1', JSON.stringify(s)) }, seed)
  await page.goto(URL); await page.waitForTimeout(500)
  return { ctx, page, errors }
}



;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const bad = []
  let total = 0
  for (const [name, steps] of SCENARIOS) {
    const t = await fresh(browser)
    try { await runSteps(t.page, steps) } catch (e) { bad.push({ scenario: name, label: '(進入這個畫面)', problem: e.message.split('\n')[0] }); await t.ctx.close(); continue }
    const res = await t.page.locator(CLICKABLE).evaluateAll((els) => els.filter((e) => !e.disabled).map((e) => {
      e.scrollIntoView({ block: 'center' })
      const r = e.getBoundingClientRect()
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      const label = (e.getAttribute('aria-label') || e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 30)
      const covered = !(hit && (hit === e || e.contains(hit) || hit.contains(e)))
      const sheetOpen = document.querySelector('.sheet-panel')
      const blockedByModal = covered && sheetOpen && !sheetOpen.contains(e)
      return { label, covered: covered && !blockedByModal, by: covered && hit ? (hit.outerHTML.slice(0, 90)) : '', w: Math.round(r.width), h: Math.round(r.height), small: r.height < 32 && r.width < 44 }
    }))
    total += res.length
    for (const r of res) if (r.covered) bad.push({ scenario: name, label: r.label, problem: '被 ' + r.by + ' 蓋住，點不到' })
    await t.ctx.close()
  }
  console.log('檢查了', total, '個按鈕，被蓋住：', bad.length)
  for (const b of bad) console.log(JSON.stringify(b))
  await browser.close()
})()
