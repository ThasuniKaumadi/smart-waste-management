'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const SUPERVISOR_NAV = [
    { label: 'Overview', href: '/dashboard/supervisor', icon: 'dashboard' },
    { label: 'Alerts', href: '/dashboard/supervisor/alerts', icon: 'notifications_active' },
    { label: 'Routes', href: '/dashboard/supervisor/routes', icon: 'route' },
    { label: 'Complaints', href: '/dashboard/supervisor/complaints', icon: 'feedback' },
]

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    critical: { color: '#ba1a1a', bg: '#fef2f2', label: 'Critical' },
    high: { color: '#dc2626', bg: '#fef2f2', label: 'High' },
    medium: { color: '#d97706', bg: '#fffbeb', label: 'Medium' },
    low: { color: '#00450d', bg: '#f0fdf4', label: 'Low' },
}

const TYPE_ICON: Record<string, string> = {
    breakdown: 'car_crash',
    skip: 'do_not_disturb_on',
    deviation: 'alt_route',
    delay: 'schedule',
    other: 'warning',
}

interface Alert {
    id: string
    type: string
    severity: string
    title: string
    message: string
    route_id: string | null
    driver_id: string | null
    is_read: boolean
    is_resolved: boolean
    resolved_by: string | null
    resolved_at: string | null
    created_at: string
    driver?: { full_name: string }
    route?: { route_name: string }
}

export default function SupervisorAlertsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved')
    const [resolvingId, setResolvingId] = useState<string | null>(null)
    const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [toast, setToast] = useState('')
    const [realtimeConnected, setRealtimeConnected] = useState(false)
    const channelRef = useRef<any>(null)

    useEffect(() => {
        loadData()

        const supabase = createClient()
        channelRef.current = supabase
            .channel('supervisor-alerts-page')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'exception_alerts',
            }, async (payload) => {
                // Fetch full alert with joins
                const { data } = await supabase
                    .from('exception_alerts')
                    .select('*, driver:driver_id(full_name), route:route_id(route_name)')
                    .eq('id', payload.new.id)
                    .single()
                if (data) {
                    setAlerts(prev => [data as Alert, ...prev])
                    showToast('New alert received')
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'exception_alerts',
            }, (payload) => {
                setAlerts(prev => prev.map(a =>
                    a.id === payload.new.id ? { ...a, ...payload.new } : a
                ))
            })
            .subscribe((status) => {
                setRealtimeConnected(status === 'SUBSCRIBED')
            })

        return () => {
            supabase.removeChannel(channelRef.current)
        }
    }, [])

    function showToast(msg: string) {
        setToast(msg)
        setTimeout(() => setToast(''), 3000)
    }

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase
            .from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: alertsData, error } = await supabase
            .from('exception_alerts')
            .select(`
                *,
                driver:driver_id(full_name),
                route:route_id(route_name)
            `)
            .order('created_at', { ascending: false })

        if (error) console.error('Alerts fetch error:', error)
        setAlerts(alertsData || [])
        setLoading(false)
    }

    async function handleResolve(alert: Alert) {
        setResolvingId(alert.id)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const res = await fetch('/api/alerts/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                alert_id: alert.id,
                resolved_by: user?.id,
                resolution_notes: resolutionNotes[alert.id] || '',
            }),
        })

        if (res.ok) {
            showToast('Alert marked as resolved')
            setExpandedId(null)
            await loadData()
        } else {
            await supabase.from('exception_alerts').update({
                is_resolved: true,
                resolved_by: user?.id,
                resolved_at: new Date().toISOString(),
            }).eq('id', alert.id)
            showToast('Alert marked as resolved')
            setExpandedId(null)
            await loadData()
        }
        setResolvingId(null)
    }

    async function handleMarkRead(alertId: string) {
        const supabase = createClient()
        await supabase.from('exception_alerts')
            .update({ is_read: true })
            .eq('id', alertId)
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a))
    }

    const filtered = alerts.filter(a => {
        if (filter === 'unresolved') return !a.is_resolved
        if (filter === 'resolved') return a.is_resolved
        return true
    })

    const unresolvedCount = alerts.filter(a => !a.is_resolved).length
    const criticalCount = alerts.filter(a => !a.is_resolved && (a.severity === 'critical' || a.severity === 'high')).length

    return (
        <DashboardLayout
            role="Supervisor"
            userName={profile?.full_name || ''}
            navItems={SUPERVISOR_NAV}
        >
            <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .bento-card {
          background: white; border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
          border: 1px solid rgba(0,69,13,0.04); overflow: hidden;
        }
        .alert-row {
          padding: 20px 24px; border-bottom: 1px solid rgba(0,69,13,0.04);
          transition: background 0.2s; cursor: pointer;
        }
        .alert-row:hover { background: #f9fafb; }
        .alert-row:last-child { border-bottom: none; }
        .filter-btn {
          padding: 7px 16px; border-radius: 99px; font-size: 12px;
          font-weight: 700; font-family: 'Manrope', sans-serif;
          border: none; cursor: pointer; transition: all 0.2s;
        }
        .filter-btn.active { background: #00450d; color: white; }
        .filter-btn:not(.active) { background: #f0fdf4; color: #00450d; }
        .resolve-btn {
          background: #00450d; color: white; border: none;
          border-radius: 99px; padding: 8px 18px;
          font-family: 'Manrope', sans-serif; font-weight: 700;
          font-size: 12px; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 6px;
        }
        .resolve-btn:hover { background: #1b5e20; }
        .resolve-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .notes-input {
          width: 100%; border: 1.5px solid #e2e8f0; border-radius: 10px;
          padding: 10px 14px; font-size: 13px; font-family: 'Inter', sans-serif;
          outline: none; resize: none; transition: border 0.2s;
          box-sizing: border-box;
        }
        .notes-input:focus { border-color: #00450d; }
        .severity-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; border-radius: 99px;
          font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn  { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .s1 { animation: staggerIn 0.4s ease 0.05s both; }
        .s2 { animation: staggerIn 0.4s ease 0.1s  both; }
        .s3 { animation: staggerIn 0.4s ease 0.15s both; }
        .new-alert { animation: slideIn 0.3s ease both; }
        .live-dot { animation: pulse 2s ease-in-out infinite; }
      `}</style>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                    background: '#181c22', color: 'white', padding: '10px 20px',
                    borderRadius: '99px', fontSize: '13px', fontWeight: 500,
                    zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#4ade80' }}>check_circle</span>
                    {toast}
                </div>
            )}

            {/* Header */}
            <section className="mb-8 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    Supervisor · Exception Management
                </span>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <h1 className="font-headline font-extrabold tracking-tight"
                        style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                        Exception <span style={{ color: '#1b5e20' }}>Alerts</span>
                    </h1>
                    {/* Realtime status indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '99px', background: realtimeConnected ? '#f0fdf4' : '#f8fafc', border: `1px solid ${realtimeConnected ? 'rgba(0,69,13,0.15)' : 'rgba(0,0,0,0.08)'}` }}>
                        <div className="live-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: realtimeConnected ? '#16a34a' : '#94a3b8' }} />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: realtimeConnected ? '#00450d' : '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                            {realtimeConnected ? 'Live' : 'Connecting...'}
                        </span>
                    </div>
                </div>
                <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                    {profile?.district || 'Your Area'} · Alerts update automatically in real-time
                </p>
            </section>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 s2">
                <div className="bento-card p-6" style={{ background: unresolvedCount > 0 ? '#fef2f2' : 'white', border: unresolvedCount > 0 ? '1px solid #fecaca' : undefined }}>
                    <span className="material-symbols-outlined mb-2 block"
                        style={{ color: unresolvedCount > 0 ? '#ba1a1a' : '#00450d', fontSize: '28px' }}>
                        {unresolvedCount > 0 ? 'error' : 'check_circle'}
                    </span>
                    <p className="text-xs font-bold uppercase mb-1"
                        style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>Unresolved</p>
                    <p className="font-headline font-extrabold text-3xl" style={{ color: unresolvedCount > 0 ? '#ba1a1a' : '#181c22' }}>
                        {unresolvedCount}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                        {unresolvedCount === 0 ? 'All clear' : 'Require attention'}
                    </p>
                </div>

                <div className="bento-card p-6" style={{ background: criticalCount > 0 ? '#fffbeb' : 'white' }}>
                    <span className="material-symbols-outlined mb-2 block"
                        style={{ color: criticalCount > 0 ? '#d97706' : '#00450d', fontSize: '28px' }}>warning</span>
                    <p className="text-xs font-bold uppercase mb-1"
                        style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>High Priority</p>
                    <p className="font-headline font-extrabold text-3xl" style={{ color: criticalCount > 0 ? '#d97706' : '#181c22' }}>
                        {criticalCount}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Critical + high severity</p>
                </div>

                <div className="bento-card p-6">
                    <span className="material-symbols-outlined mb-2 block"
                        style={{ color: '#00450d', fontSize: '28px' }}>task_alt</span>
                    <p className="text-xs font-bold uppercase mb-1"
                        style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>Resolved</p>
                    <p className="font-headline font-extrabold text-3xl" style={{ color: '#181c22' }}>
                        {alerts.filter(a => a.is_resolved).length}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Total resolved alerts</p>
                </div>
            </div>

            {/* Filter + List */}
            <div className="bento-card s3">
                <div className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>Alert Feed</h3>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{filtered.length} alerts</span>
                    </div>
                    <div className="flex gap-2">
                        {(['unresolved', 'all', 'resolved'] as const).map(f => (
                            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`}
                                onClick={() => setFilter(f)}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                                {f === 'unresolved' && unresolvedCount > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
                                        style={{ background: filter === 'unresolved' ? 'rgba(255,255,255,0.25)' : '#fee2e2', color: filter === 'unresolved' ? 'white' : '#ba1a1a' }}>
                                        {unresolvedCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-7 h-7 border-2 rounded-full animate-spin"
                            style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                            style={{ background: '#f0fdf4' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>
                                notifications_off
                            </span>
                        </div>
                        <p className="font-bold text-base mb-1" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                            {filter === 'unresolved' ? 'No unresolved alerts' : 'No alerts found'}
                        </p>
                        <p className="text-sm" style={{ color: '#94a3b8' }}>
                            {filter === 'unresolved' ? 'All exceptions have been resolved.' : 'No alerts match this filter.'}
                        </p>
                    </div>
                ) : (
                    <div>
                        {filtered.map((alert, idx) => {
                            const sc = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium
                            const icon = TYPE_ICON[alert.type] || 'warning'
                            const isExpanded = expandedId === alert.id

                            return (
                                <div key={alert.id}
                                    className={`alert-row ${idx === 0 ? 'new-alert' : ''}`}
                                    onClick={() => {
                                        setExpandedId(isExpanded ? null : alert.id)
                                        if (!alert.is_read) handleMarkRead(alert.id)
                                    }}>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: sc.bg }}>
                                            <span className="material-symbols-outlined"
                                                style={{ color: sc.color, fontSize: '20px' }}>{icon}</span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <p className="text-sm font-bold" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                    {alert.title}
                                                </p>
                                                <span className="severity-badge" style={{ background: sc.bg, color: sc.color }}>
                                                    {sc.label}
                                                </span>
                                                {!alert.is_read && !alert.is_resolved && (
                                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#dc2626' }} />
                                                )}
                                                {alert.is_resolved && (
                                                    <span className="severity-badge" style={{ background: '#f0fdf4', color: '#00450d' }}>
                                                        Resolved
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs mb-1" style={{ color: '#64748b' }}>{alert.message}</p>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                {alert.route && (
                                                    <span className="text-xs flex items-center gap-1" style={{ color: '#94a3b8' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>route</span>
                                                        {(alert.route as any).route_name}
                                                    </span>
                                                )}
                                                {alert.driver && (
                                                    <span className="text-xs flex items-center gap-1" style={{ color: '#94a3b8' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>person</span>
                                                        {(alert.driver as any).full_name}
                                                    </span>
                                                )}
                                                <span className="text-xs" style={{ color: '#94a3b8' }}>
                                                    {new Date(alert.created_at).toLocaleString('en-GB', {
                                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        <span className="material-symbols-outlined flex-shrink-0"
                                            style={{ color: '#94a3b8', fontSize: '20px', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                            expand_more
                                        </span>
                                    </div>

                                    {isExpanded && !alert.is_resolved && (
                                        <div className="mt-4 ml-14" onClick={e => e.stopPropagation()}>
                                            <div className="p-4 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                <p className="text-xs font-bold mb-2" style={{ color: '#475569', fontFamily: 'Manrope, sans-serif' }}>
                                                    Resolution Notes (optional)
                                                </p>
                                                <textarea
                                                    className="notes-input mb-3"
                                                    rows={2}
                                                    placeholder="Describe how this was resolved..."
                                                    value={resolutionNotes[alert.id] || ''}
                                                    onChange={e => setResolutionNotes(prev => ({ ...prev, [alert.id]: e.target.value }))}
                                                />
                                                <button
                                                    className="resolve-btn"
                                                    disabled={resolvingId === alert.id}
                                                    onClick={() => handleResolve(alert)}
                                                >
                                                    {resolvingId === alert.id ? (
                                                        <>
                                                            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                            </svg>
                                                            Resolving...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>task_alt</span>
                                                            Mark as Resolved
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {isExpanded && alert.is_resolved && (
                                        <div className="mt-4 ml-14">
                                            <div className="p-4 rounded-xl flex items-center gap-3"
                                                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>task_alt</span>
                                                <div>
                                                    <p className="text-xs font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>Resolved</p>
                                                    {alert.resolved_at && (
                                                        <p className="text-xs" style={{ color: '#16a34a' }}>
                                                            {new Date(alert.resolved_at).toLocaleString('en-GB', {
                                                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}