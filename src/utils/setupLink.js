// 換手機用的「設定連結」：把 Google Client ID 和 Sheet ID 放在網址 # 後面，
// 新手機打開就自動帶入，不用在小螢幕上手打一長串。
// 這兩個都不是密碼：Sheet ID 沒有你的 Google 登入也打不開，Client ID 本來就會出現在網頁原始碼裡。
const PREFIX = '#setup='

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4)
  const binary = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

export function buildSetupLink(origin, { clientId, sheetId }) {
  return `${origin}/${PREFIX}${toBase64Url(JSON.stringify({ c: clientId, s: sheetId }))}`
}

// 讀不出來（不是設定連結、被截斷、內容不對）一律回傳 null
export function parseSetupHash(hash) {
  if (typeof hash !== 'string' || !hash.startsWith(PREFIX)) return null
  try {
    const { c, s } = JSON.parse(fromBase64Url(hash.slice(PREFIX.length)))
    if (typeof c !== 'string' || typeof s !== 'string' || !c.trim() || !s.trim()) return null
    return { clientId: c.trim(), sheetId: s.trim() }
  } catch {
    return null
  }
}
