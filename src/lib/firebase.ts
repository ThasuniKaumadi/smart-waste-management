import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging'

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Prevent duplicate app initialization in Next.js
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

let messaging: Messaging | null = null

// Messaging is only available in browser (not SSR)
if (typeof window !== 'undefined') {
    try {
        messaging = getMessaging(app)
    } catch (err) {
        console.error('Firebase messaging init failed:', err)
    }
}

export { app, messaging }

/**
 * Request notification permission and return FCM token.
 * Returns null if permission denied or not supported.
 */
export async function requestNotificationPermission(): Promise<string | null> {
    if (typeof window === 'undefined' || !messaging) return null

    try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
            console.info('Notification permission denied')
            return null
        }

        const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        })

        return token || null
    } catch (err) {
        console.error('Failed to get FCM token:', err)
        return null
    }
}

/**
 * Listen for foreground messages (app is open).
 * Background messages are handled by the service worker.
 */
export function onForegroundMessage(callback: (payload: any) => void) {
    if (!messaging) return () => { }
    return onMessage(messaging, callback)
}