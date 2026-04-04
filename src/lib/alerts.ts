import { createClient } from '@/lib/supabase'

interface AlertParams {
    type: string
    title: string
    message: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    route_id?: string
    driver_id?: string
    collection_event_id?: string
}

// Map alert severity to notification recipients
const SEVERITY_ROLES: Record<string, string[]> = {
    critical: ['supervisor', 'district_engineer', 'admin'],
    high: ['supervisor', 'district_engineer'],
    medium: ['supervisor'],
    low: ['supervisor'],
}

// Map alert type to dashboard URL for notification click
const ALERT_URLS: Record<string, string> = {
    stop_skipped: '/dashboard/supervisor/alerts',
    all_stops_skipped: '/dashboard/supervisor/alerts',
    breakdown_reported: '/dashboard/supervisor/alerts',
    route_not_started: '/dashboard/supervisor/alerts',
    waste_report_escalated: '/dashboard/district-engineer/waste-reports',
}

export async function createExceptionAlert(params: AlertParams): Promise<void> {
    const supabase = createClient()

    // 1. Save alert to Supabase
    const { error } = await supabase.from('exception_alerts').insert({
        alert_type: params.type,
        severity: params.severity,
        message: params.message,
        driver_id: params.driver_id || null,
        route_id: params.route_id || null,
        collection_event_id: params.collection_event_id || null,
        resolved: false,
        created_at: new Date().toISOString(),
    })

    if (error) {
        console.error('Failed to create exception alert:', error)
        return
    }

    // 2. Send push notification to relevant roles
    try {
        const roles = SEVERITY_ROLES[params.severity] || ['supervisor']
        const url = ALERT_URLS[params.type] || '/dashboard/supervisor/alerts'

        await fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roles,
                title: `⚠ ${params.title}`,
                body: params.message.length > 100
                    ? params.message.slice(0, 97) + '...'
                    : params.message,
                type: params.type,
                url,
            }),
        })
    } catch (err) {
        // Non-fatal — alert is saved, notification is best-effort
        console.error('Push notification failed:', err)
    }
}