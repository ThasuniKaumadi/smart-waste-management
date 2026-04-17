/**
 * Shared notification helper for EcoLedger (R8)
 * Call from any client component to send push notifications via FCM.
 */
export async function sendNotification({
    roles,
    user_ids,
    title,
    body,
    type,
    url,
}: {
    roles?: string[]
    user_ids?: string[]
    title: string
    body: string
    type?: string
    url?: string
}): Promise<void> {
    try {
        await fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roles, user_ids, title, body, type, url }),
        })
    } catch (err) {
        // Non-fatal — push notifications should never break core flows
        console.error('[notify] send failed:', err)
    }
}