// 繳費通知工具（瀏覽器通知 + 開啟 App 時的本地提醒）
const LAST_NOTIFY_KEY = 'cardnest_lastNotify'

export function notifySupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notifyPermission() {
  return notifySupported() ? Notification.permission : 'unsupported'
}

export async function requestNotifyPermission() {
  if (!notifySupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

function showNotification(title, body) {
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification(title, { body, icon: '/icon-192.png' }))
        .catch(() => { new Notification(title, { body }) })
    } else {
      new Notification(title, { body })
    }
  } catch {
    /* 通知失敗時靜默略過 */
  }
}

// 開啟 App 時，若有快到期/逾期的卡費且今天還沒通知過，跳一則彙整通知
export function maybeNotifyDueBills(reminders, { withinDays = 3 } = {}) {
  if (!notifySupported() || Notification.permission !== 'granted') return
  const due = reminders.filter(r => r.daysLeft <= withinDays)
  if (due.length === 0) return
  const today = new Date().toDateString()
  if (localStorage.getItem(LAST_NOTIFY_KEY) === today) return
  localStorage.setItem(LAST_NOTIFY_KEY, today)

  const fmt = (n) => 'NT$' + Number(n).toLocaleString()
  const first = due[0]
  const when = first.daysLeft < 0
    ? `已逾期 ${-first.daysLeft} 天`
    : first.daysLeft === 0 ? '今天到期' : `還有 ${first.daysLeft} 天`
  const title = due.length === 1
    ? `${first.name} 卡費要繳了`
    : `${due.length} 張卡待繳`
  const body = due.length === 1
    ? `${fmt(first.amount)}（${when}）`
    : due.map(r => `${r.name} ${fmt(r.amount)}`).join('、')
  showNotification(title, body)
}
