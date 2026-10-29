// 逐一點擊每個畫面上的每個按鈕，記錄點了之後有什麼變化。用法：node click-audit.js <網址> <輸出.json> [場景編號,逗號分隔]
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

async function snapshot(page) {
  return page.evaluate(() => ({
    store: localStorage.getItem('cardnest_v1'),
    text: document.body.innerText,
    sheets: document.querySelectorAll('.sheet-panel').length,
    toast: document.querySelector('.toast')?.innerText ?? '',
    nav: document.querySelector('.bottom-nav-item--active')?.getAttribute('aria-label') ?? '',
    heading: document.querySelector('h1,h2')?.innerText ?? '',
  }))
}

async function labelsOf(page, tries = 4) {
  try { return await labelsOnce(page) } catch (e) { if (tries <= 1) throw e; await page.waitForTimeout(600); return labelsOf(page, tries - 1) }
}
async function labelsOnce(page) {
  return page.locator(CLICKABLE).evaluateAll((els) => els.map((e, i) => ({
    i, tag: e.tagName.toLowerCase(), type: e.getAttribute('type') ?? '',
    label: (e.getAttribute('aria-label') || e.innerText || e.value || e.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 40),
    disabled: e.disabled === true || e.getAttribute('aria-disabled') === 'true',
  })))
}

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const results = []
  for (const [idx, [name, steps]] of SCENARIOS.entries()) {
    if (ONLY && !ONLY.includes(idx)) continue
    let probe
    try {
      probe = await fresh(browser); await runSteps(probe.page, steps)
    } catch (e) { results.push({ scenario: name, label: '(進入這個畫面)', verdict: 'ERROR', detail: e.message.split('\n')[0] }); continue }
    const list = await labelsOf(probe.page)
    await probe.ctx.close()
    for (const item of list) {
      const rec = { scenario: name, label: item.label || `(${item.tag}${item.type ? ':' + item.type : ''} 沒有文字)`, tag: item.tag }
      if (item.disabled) { rec.verdict = 'DISABLED'; results.push(rec); continue }
      const t = await fresh(browser)
      try {
        await runSteps(t.page, steps)
        const loc = t.page.locator(CLICKABLE).nth(item.i)
        const now = (await labelsOf(t.page))[item.i]
        if (!now || now.label !== item.label) { rec.verdict = 'SKIP'; rec.detail = '畫面順序變動'; results.push(rec); await t.ctx.close(); continue }
        const before = await snapshot(t.page)
        t.errors.length = 0
        await loc.click({ timeout: 3000 })
        await t.page.waitForTimeout(450)
        const after = await snapshot(t.page)
        const changes = []
        if (before.store !== after.store) changes.push('資料')
        if (before.nav !== after.nav || before.heading !== after.heading) changes.push('換頁')
        if (before.sheets !== after.sheets) changes.push(after.sheets > before.sheets ? '開啟彈窗' : '關閉彈窗')
        if (after.toast && after.toast !== before.toast) changes.push('提示：' + after.toast.replace(/\s+/g, ' ').slice(0, 50))
        if (before.text !== after.text && !changes.length) changes.push('畫面內容')
        else if (before.text !== after.text) changes.push('畫面')
        rec.changes = changes
        rec.errors = [...t.errors]
        rec.verdict = t.errors.length ? 'ERROR' : (changes.length ? 'OK' : 'NO_EFFECT')
        if (t.errors.length) rec.detail = t.errors.join(' || ').slice(0, 200)
      } catch (e) { rec.verdict = 'FAIL'; rec.detail = e.message.split('\n')[0].slice(0, 160) }
      results.push(rec)
      await t.ctx.close()
    }
    process.stderr.write(`done ${name}: ${list.length}\n`)
    require('fs').writeFileSync(OUT, JSON.stringify(results, null, 1))
  }
  require('fs').writeFileSync(OUT, JSON.stringify(results, null, 1))
  await browser.close()
})()
