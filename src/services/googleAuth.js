const CLIENT_ID = '796868580184-95icssh2hj3rfaffiek6jojo8k66ub3h.apps.googleusercontent.com'
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file'
const AUTH_KEY = 'cardnest_gauth'

export function loadAuthState() {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveAuthState(state) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(state))
}

export function clearAuthState() {
  localStorage.removeItem(AUTH_KEY)
}

export function isTokenValid(auth) {
  return !!(auth?.accessToken && auth.expiresAt && Date.now() < auth.expiresAt)
}

export async function getUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('userinfo failed')
  return res.json()
}

export function requestToken(callback, prompt = 'select_account') {
  window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback,
  }).requestAccessToken({ prompt })
}

export function revokeToken(accessToken) {
  if (accessToken) window.google.accounts.oauth2.revoke(accessToken, () => {})
}

export function whenGoogleReady(callback) {
  if (window.google?.accounts?.oauth2) {
    callback()
  } else {
    window.onGoogleLibraryLoad = callback
  }
}
