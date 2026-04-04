// public/firebase-messaging-sw.js
// This service worker handles background push notifications
// It must be in the /public folder so it's served from the root

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

firebase.initializeApp({
    apiKey: 'AIzaSyAhBv0mCw9rqj5C-fU_Mmn_UAiDhpBsQvc',
    authDomain: 'smart-waste-management-454ac.firebaseapp.com',
    projectId: 'smart-waste-management-454ac',
    storageBucket: 'smart-waste-management-454ac.firebasestorage.app',
    messagingSenderId: '718679011420',
    appId: '1:718679011420:web:56a5674c7183d138e43699',
})

const messaging = firebase.messaging()

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload)

    const { title, body, icon } = payload.notification || {}

    self.registration.showNotification(title || 'EcoLedger Alert', {
        body: body || 'You have a new notification',
        icon: icon || '/icon-192.png',
        badge: '/icon-192.png',
        tag: payload.data?.type || 'ecoledger',
        data: payload.data || {},
        actions: [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' },
        ],
    })
})

// Handle notification click — open the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    if (event.action === 'dismiss') return

    const urlToOpen = event.notification.data?.url || '/'

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing tab if open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus()
                    client.navigate(urlToOpen)
                    return
                }
            }
            // Otherwise open new tab
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen)
            }
        })
    )
})