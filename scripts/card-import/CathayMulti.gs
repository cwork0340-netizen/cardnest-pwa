/**
 * Cathay authorization-table parser. Pure functions; no Gmail/Sheet writes.
 * Read HTML cells to preserve empty merchants and spaces within merchant names.
 * The account card number comes from the section header, never the mobile token.
 */
function cardText_(html) {
  return String(html).replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ').trim()
}

function cardTableRows_(html) {
  const rows = [], stack = []
  const tokens = /<\/?(?:tr|td|th)\b[^>]*>|[^<]+|<[^>]*>/gi
  let match
  while ((match = tokens.exec(html))) {
    const token = match[0]
    if (/^<tr\b/i.test(token)) {
      if (stack.length) stack[stack.length - 1].nested = true
      stack.push({ cells: [], active: null, position: match.index, nested: false })
    } else if (/^<\/tr\b/i.test(token)) {
      const row = stack.pop()
      if (row && !row.nested && row.cells.length) {
        rows.push({ cells: row.cells.map(cardText_), position: row.position })
      }
    } else if (stack.length) {
      const row = stack[stack.length - 1]
      if (/^<t[dh]\b/i.test(token)) {
        row.cells.push('')
        row.active = row.cells.length - 1
      } else if (/^<\/t[dh]\b/i.test(token)) {
        row.active = null
      } else if (row.active !== null) {
        row.cells[row.active] += token
      }
    }
  }
  return rows
}

function cardDate_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Taipei', 'yyyy/MM/dd')
  const m = String(value).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() + 1 !== Number(m[2]) || d.getDate() !== Number(m[3])) return ''
  return m[1] + '/' + m[2].padStart(2, '0') + '/' + m[3].padStart(2, '0')
}

function parseCathayMulti_(html, permalink) {
  const parsed = [], errors = []
  const tableRows = cardTableRows_(html)
  let header = null, pending = null, expected = 0
  for (const row of tableRows) {
    const labels = row.cells.map((cell) => cell.replace(/\s/g, ''))
    if (labels.includes('授權日期') || labels.includes('消費金額')) {
      header = labels
      continue
    }
    if (!header) continue
    const value = (label) => row.cells[header.indexOf(label)] ?? ''
    if (header.includes('授權日期')) {
      if (pending) errors.push('上一筆缺少金額欄位')
      const before = cardText_(html.slice(0, row.position))
      const cards = [...before.matchAll(/卡號後\s*4\s*碼\s*[：:]\s*(\d{4})/g)]
      pending = { bank: '國泰世華', cardLast4: cards.length ? cards[cards.length - 1][1] : '',
        date: cardDate_(value('授權日期')), time: value('授權時間').replace(/\s/g, ''), permalink }
      header = null
    } else if (header.includes('消費金額')) {
      expected++
      const amount = value('消費金額').match(/^NT\s*\$\s*([\d,]+(?:\.\d+)?)$/i)
      if (!pending || !pending.cardLast4 || !pending.date || !/^\d{2}:\d{2}(?::\d{2})?$/.test(pending.time) || !amount) {
        errors.push('第 ' + expected + ' 筆缺少卡號、授權日期、時間或金額')
      } else {
        parsed.push({ ...pending, amount: Number(amount[1].replace(/,/g, '')),
          merchant: value('商店名稱'), transactionType: '消費' })
      }
      pending = null
      header = null
    }
  }
  if (pending) errors.push('最後一筆缺少金額欄位')
  // Independent count prevents a changed table layout from silently dropping a
  // transaction and still treating the message as complete.
  const moneyCount = (cardText_(html).match(/NT\s*\$\s*[\d,]+(?:\.\d+)?/gi) || []).length
  if (moneyCount !== parsed.length || expected !== parsed.length || !parsed.length) errors.push('通知金額筆數與解析筆數不符')
  const occurrences = {}
  parsed.forEach((row) => {
    const base = [row.cardLast4, row.date, row.time, row.amount, row.merchant].join('|')
    occurrences[base] = (occurrences[base] || 0) + 1
    row.transactionId = 'cathay-v2:' + JSON.stringify([base, occurrences[base]])
  })
  return { rows: errors.length ? [] : parsed, errors }
}

/** Plan Sheet changes without writing. Existing H (posted date) stays intact. */
function planCathayRecovery_(existing, parsed) {
  const updates = [], inserts = [], used = new Set(), errors = []
  const seen = new Set(existing.map((r) => r[9] ? JSON.stringify([r[6], r[9]]) : '').filter(Boolean))
  for (const row of parsed) {
    const key = JSON.stringify([row.permalink, row.transactionId])
    if (seen.has(key)) continue
    const candidates = existing.map((r, index) => ({ r, index })).filter(({ r, index }) =>
      !used.has(index) && !r[9] && r[6] === row.permalink && String(r[2]) === row.cardLast4
      && Number(r[4]) === row.amount && cardText_(r[5] || '') === row.merchant)
    if (candidates.length > 1) {
      errors.push('舊資料有多筆相同來源與金額，需先核對，不自動新增')
      continue
    }
    const values = [new Date(), row.bank, row.cardLast4, row.date, row.amount, row.merchant,
      row.permalink, '', row.transactionType, row.transactionId, '', '']
    if (candidates.length === 1) {
      const { r, index } = candidates[0]
      used.add(index)
      values[0] = r[0]
      values[7] = r[7] || ''
      values[10] = cardDate_(r[3])
      values[11] = r[8] || ''
      updates.push({ rowNumber: index + 2, values })
    } else {
      // A truncated/edited legacy merchant is not enough evidence to insert a
      // second copy. Stop this message and make the ambiguity visible.
      const uncertain = existing.some((r, index) => !used.has(index) && !r[9]
        && r[6] === row.permalink && String(r[2]) === row.cardLast4 && Number(r[4]) === row.amount)
      if (uncertain) errors.push('舊資料商店名稱不同，需先核對')
      else inserts.push(values)
    }
    seen.add(key)
  }
  return { updates: errors.length ? [] : updates, inserts: errors.length ? [] : inserts, errors }
}

/**
 * Run previewCathayRecovery first. Set CARDNEST_SHEET_ID in Script Properties.
 * No label exclusion: previously labelled partial emails must be revisited.
 * Existing bank parsers and triggers can remain until the live script is reviewed.
 */
function previewCathayRecovery() { return runCathayRecovery_(true) }
function recoverCathayNotifications() { return runCathayRecovery_(false) }

function runCathayRecovery_(preview) {
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const id = PropertiesService.getScriptProperties().getProperty('CARDNEST_SHEET_ID')
    if (!id) throw new Error('請先設定 CARDNEST_SHEET_ID，避免寫入錯誤試算表')
    const ss = SpreadsheetApp.openById(id)
    const sheet = ss.getSheetByName('消費紀錄')
    if (!sheet) throw new Error('找不到消費紀錄分頁')
    let existing = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues() : []
    const query = 'from:cathaybk.com.tw newer_than:30d'
    const summary = { messages: 0, inserts: 0, updates: 0, failures: 0, preview }
    let backupMade = false
    for (let offset = 0; offset < 500; offset += 50) {
      const threads = GmailApp.search(query, offset, 50)
      for (const thread of threads) {
        for (const msg of thread.getMessages()) {
          if (!/cathaybk\.com\.tw/i.test(msg.getFrom())) continue
          const html = msg.getBody()
          if (!cardText_(html).includes('授權日期')) continue
          summary.messages++
          const permalink = 'https://mail.google.com/mail/u/0/#all/' + msg.getId()
          const parsed = parseCathayMulti_(html, permalink)
          const plan = parsed.errors.length ? { errors: parsed.errors } : planCathayRecovery_(existing, parsed.rows)
          if (plan.errors.length) {
            summary.failures++
            Logger.log('需核對信件 ' + msg.getId() + ': ' + plan.errors.join('；'))
            continue
          }
          summary.inserts += plan.inserts.length
          summary.updates += plan.updates.length
          if (!preview && (plan.inserts.length || plan.updates.length)) {
            if (!backupMade) {
              sheet.copyTo(ss).setName('消費紀錄備份_' + new Date().getTime())
              sheet.getRange(1, 10, 1, 3).setValues([['交易識別碼', '修正前消費日期', '修正前交易類型']])
              backupMade = true
            }
            plan.updates.forEach((u) => sheet.getRange(u.rowNumber, 1, 1, 12).setValues([u.values]))
            if (plan.inserts.length) sheet.getRange(sheet.getLastRow() + 1, 1, plan.inserts.length, 12).setValues(plan.inserts)
          }
          plan.updates.forEach((u) => { existing[u.rowNumber - 2] = u.values })
          existing = existing.concat(plan.inserts)
        }
      }
      if (threads.length < 50) break
      if (offset === 450) Logger.log('已達 500 封對話上限；請縮小日期區間再核對')
    }
    Logger.log(JSON.stringify(summary))
    return summary
  } finally {
    lock.releaseLock()
  }
}
