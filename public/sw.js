// 極簡 service worker：僅為了讓 iOS PWA 能顯示通知（showNotification）
const CARDNEST_SW_VERSION = '2026-08-19-spending-filters'
self.cardnestVersion = CARDNEST_SW_VERSION

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// 點通知就把 App 帶到前景
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/')
    })
  )
})
