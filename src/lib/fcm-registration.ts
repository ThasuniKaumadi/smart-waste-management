import { createClient } from '@/lib/supabase'
import { requestNotificationPermission } from '@/lib/firebase'

/**
 * Register the current user's FCM token in Supabase.
 * Call this after login for roles that receive push notifications.
 */
export async function registerFCMToken(userId: string, role: string): Promise<void> {
    // Only register for roles that receive notifications
    const notifiedRoles = ['supervisor', 'district_engineer', 'admin', 'engineer']
    if (!notifiedRoles.includes(role)) return

    try {
        const token = await requestNotificationPermission()
        if (!token) return

        const supabase = createClient()

        // Upsert — update token if it already exists for this user/device
        await supabase.from('fcm_tokens').upsert(
            {
                user_id: userId,
                token,
                role,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,token' }
        )
    } catch (err) {
        // Non-fatal — notifications are a nice-to-have
        console.error('FCM token registration failed:', err)
    }
}

/**
 * Remove FCM token on logout.
 */
export async function unregisterFCMToken(userId: string): Promise<void> {
    try {
        const supabase = createClient()
        await supabase.from('fcm_tokens').delete().eq('user_id', userId)
    } catch (err) {
        console.error('FCM token removal failed:', err)
    }
}