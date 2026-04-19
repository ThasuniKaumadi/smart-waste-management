'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const SUPERVISOR_NAV = [
    { label: 'Overview', href: '/dashboard/supervisor', icon: 'dashboard' },
    { label: 'Routes', href: '/dashboard/supervisor/routes', icon: 'route' },
    { label: 'Track Route', href: '/dashboard/supervisor/track-route', icon: 'gps_fixed' },
    { label: 'Alerts', href: '/dashboard/supervisor/alerts', icon: 'notifications' },
    { label: 'Complaints', href: '/dashboard/supervisor/complaints', icon: 'feedback' },
    { label: 'Waste Reports', href: '/dashboard/supervisor/waste-reports', icon: 'report' },
]

const STATUS_STYLE: Record<string, { color: string; bg: string; dot: string }> = {
    pending: { color: '#d97706', bg: '#fefce8', dot: '#d97706' },
    active: { color: '#1d4ed8', bg: '#eff6ff', dot: '#3b82f6' },
    completed: { color: '#00450d', bg: '#f0fdf4', dot: '#16a34a' },
    cancelled: { color: '#ba1a1a', bg: '#fef2f2', dot: '#ef4444' },
}

interface Route {
    id: string
    route_name: string
    district: string
    ward: string
    vehicle_number: string
    date: string
    status: string
    shift: string
    driver_id: string | null
    schedule_id: string | null
    profiles: { full_name: string } | null
    collection_stops: { id: string; status: string; skip_reason: string | null }[]
    exception_alerts: { id: string; severity: string }[]
}

interface Stop {
    id: string
    road_name: string
    address: string
    stop_order: number
    status: string
    skip_reason: string | null
    is_commercial: boolean
    frequency: string | null
}

export default function SupervisorRoutesPage() {
    const [profile, setProfile] = useState<any>(null)
    const [routes, setRoutes] = useState<Route[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('all')
    const [filterShift, setFilterShift] = useState('all')
    const [expandedRoute, setExpandedRoute] = useState<string | null>(null)
    const [routeStops, setRouteStops] = useState<Record<string, Stop[]>>({})
    const [loadingStops, setLoadingStops] = useState<string | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const wards: string[] = p?.assigned_wards || []

        let query = supabase
            .from('routes')
            .select(`
        id, route_name, district, ward, vehicle_number, date,
        status, shift, driver_id, schedule_id,
        profiles:driver_id(full_name),
        collection_stops(id, status, skip_reason),
        exception_alerts(id, severity)
      `)
            .eq('district', p?.district || '')
            .order('date', { ascending: false })

        if (wards.length > 0) {
            query = query.in('ward', wards)
        }

        const { data } = await query
        setRoutes((data || []) as any)
        setLoading(false)
    }

    async function loadStops(routeId: string) {
        if (routeStops[routeId]) {
            setExpandedRoute(expandedRoute === routeId ? null : routeId)
            return
        }
        setLoadingStops(routeId)
        const supabase = createClient()
        const { data } = await supabase
            .from('collection_stops')
            .select('*')
            .eq('route_id', routeId)
            .order('stop_order', { ascending: true })
        setRouteStops(prev => ({ ...prev, [routeId]: data || [] }))
        setExpandedRoute(routeId)
        setLoadingStops(null)
    }

    const filtered = routes.filter(r => {
        if (filterStatus !== 'all' && r.status !== filterStatus) return false
        if (filterShift !== 'all' && r.shift !== filterShift) return false
        return true
    })

    const wards = [...new Set(routes.map(r => r.ward).filter(Boolean))]
    const wardStats = wards.map(ward => ({
        ward,
        active: routes.filter(r => r.ward === ward && r.status === 'active').length,
        completed: routes.filter(r => r.ward === ward && r.status === 'completed').length,
        pending: routes.filter(r => r.ward === ward && r.status === 'pending').length,
        alerts: routes.filter(r => r.ward === ward).reduce((sum, r) => sum + (r.exception_alerts?.length || 0), 0),
    }))

    const totalAlerts = routes.reduce((sum, r) => sum + (r.exception_alerts?.length || 0), 0)

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
        .bento-card {
          background: white; border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
          border: 1px solid rgba(0,69,13,0.04); overflow: hidden;
        }
        .filter-btn {
          padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 700;
          font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s;
        }
        .filter-btn.active { background: #00450d; color: white; }
        .filter-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .filter-btn:not(.active):hover { background: #e2e8f0; }
        .route-row {
          padding: 18px 24px; border-bottom: 1px solid rgba(0,69,13,0.04);
          transition: background 0.2s; cursor: pointer;
        }
        .route-row:hover { background: #f9fdf9; }
        .route-row:last-child { border-bottom: none; }
        .badge {
          display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em;
          text-transform: uppercase; white-space: nowrap;
        }
        .stop-row {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 16px; border-bottom: 1px solid rgba(0,69,13,0.04); font-size: 13px;
        }
        .stop-row:last-child { border-bottom: none; }
        .ward-chip {
          background: white; border-radius: 12px; padding: 14px 18px;
          border: 1px solid rgba(0,69,13,0.08); transition: all 0.2s;
        }
        .ward-chip:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); transform: translateY(-1px); }
        .progress-track { height: 5px; background: #f0fdf4; border-radius: 99px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 99px; transition: width 0.6s ease; }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.45s ease 0.05s both; }
        .s2 { animation: staggerIn 0.45s ease 0.10s both; }
        .s3 { animation: staggerIn 0.45s ease 0.15s both; }
        .s4 { animation: staggerIn 0.45s ease 0.20s both; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .slide-down { animation: slideDown 0.25s ease both; }
      `}</style>

            {/* Header */}
            <section className="mb-8 s1">
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    Supervisor · Route Monitoring
                </span>
                <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '46px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: 0 }}>
                    Collection <span style={{ color: '#1b5e20' }}>Routes</span>
                </h1>
                <p style={{ fontSize: '13px', color: '#717a6d', marginTop: '6px' }}>
                    Read-only view · {profile?.district} · Wards: {(profile?.assigned_wards || []).join(', ') || 'All'}
                </p>
            </section>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }} className="s2">
                {[
                    { label: 'Total Routes', value: routes.length, icon: 'route', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Active', value: routes.filter(r => r.status === 'active').length, icon: 'directions_car', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Completed', value: routes.filter(r => r.status === 'completed').length, icon: 'check_circle', color: '#16a34a', bg: '#f0fdf4' },
                    { label: 'Open Alerts', value: totalAlerts, icon: 'warning', color: totalAlerts > 0 ? '#dc2626' : '#00450d', bg: totalAlerts > 0 ? '#fef2f2' : '#f0fdf4' },
                ].map(m => (
                    <div key={m.label} className="bento-card" style={{ padding: '20px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                            <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '18px' }}>{m.icon}</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '28px', color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Read-only notice */}
            <div style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.12)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }} className="s2">
                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>visibility</span>
                <p style={{ fontSize: '13px', color: '#41493e', margin: 0 }}>
                    Routes are created and managed by your District Engineer. You have read-only access to monitor progress and raise alerts.
                </p>
            </div>

            {/* Ward coverage */}
            {wardStats.length > 0 && (
                <div className="s3" style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '15px', color: '#181c22', marginBottom: '12px' }}>Ward Coverage</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                        {wardStats.map(w => (
                            <div key={w.ward} className="ward-chip">
                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>{w.ward}</p>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {w.active > 0 && <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{w.active} active</span>}
                                    {w.pending > 0 && <span className="badge" style={{ background: '#fefce8', color: '#d97706' }}>{w.pending} pending</span>}
                                    {w.completed > 0 && <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>{w.completed} done</span>}
                                    {w.alerts > 0 && <span className="badge" style={{ background: '#fef2f2', color: '#dc2626' }}>{w.alerts} alert{w.alerts > 1 ? 's' : ''}</span>}
                                    {w.active + w.pending + w.completed === 0 && <span className="badge" style={{ background: '#f8fafc', color: '#94a3b8' }}>No routes</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Route list */}
            <div className="bento-card s4">
                <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '18px', color: '#181c22', margin: 0 }}>All Routes</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {(['all', 'active', 'pending', 'completed'] as const).map(f => (
                            <button key={f} onClick={() => setFilterStatus(f)} className={`filter-btn ${filterStatus === f ? 'active' : ''}`}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                        <div style={{ width: '1px', height: '20px', background: 'rgba(0,69,13,0.1)' }} />
                        {(['all', 'day', 'night'] as const).map(f => (
                            <button key={f} onClick={() => setFilterShift(f)} className={`filter-btn ${filterShift === f ? 'active' : ''}`}>
                                {f === 'day' ? '☀️ Day' : f === 'night' ? '🌙 Night' : 'All Shifts'}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
                        <div style={{ width: '28px', height: '28px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>route</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: '0 0 6px' }}>No routes found</p>
                        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                            {filterStatus === 'all' ? 'No routes in your assigned wards yet.' : `No ${filterStatus} routes.`}
                        </p>
                    </div>
                ) : (
                    <div>
                        {filtered.map(route => {
                            const ss = STATUS_STYLE[route.status] || STATUS_STYLE.pending
                            const stops = route.collection_stops || []
                            const completedStops = stops.filter(s => s.status === 'completed').length
                            const skippedStops = stops.filter(s => s.status === 'skipped').length
                            const progressPct = stops.length > 0 ? Math.round(((completedStops + skippedStops) / stops.length) * 100) : 0
                            const routeAlerts = route.exception_alerts || []
                            const isExpanded = expandedRoute === route.id
                            const expandedStops = routeStops[route.id] || []

                            return (
                                <div key={route.id}>
                                    <div className="route-row" onClick={() => loadStops(route.id)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: ss.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span className="material-symbols-outlined" style={{ color: ss.color, fontSize: '20px' }}>
                                                    {route.status === 'completed' ? 'check_circle' : route.status === 'active' ? 'directions_car' : route.status === 'cancelled' ? 'cancel' : 'schedule'}
                                                </span>
                                            </div>

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif', margin: 0 }}>
                                                        {route.route_name}
                                                    </p>
                                                    <span className="badge" style={{ background: ss.bg, color: ss.color }}>
                                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ss.dot, display: 'inline-block' }} />
                                                        {route.status}
                                                    </span>
                                                    {route.shift === 'night' && (
                                                        <span className="badge" style={{ background: '#eff6ff', color: '#1e3a8a' }}>🌙 Night</span>
                                                    )}
                                                    {routeAlerts.length > 0 && (
                                                        <span className="badge" style={{ background: '#fef2f2', color: '#dc2626' }}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>warning</span>
                                                            {routeAlerts.length} alert{routeAlerts.length > 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: '#94a3b8' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                                        {route.ward || route.district}
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>person</span>
                                                        {(route.profiles as any)?.full_name || 'Unassigned'}
                                                    </span>
                                                    {route.vehicle_number && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>directions_car</span>
                                                            {route.vehicle_number}
                                                        </span>
                                                    )}
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>
                                                        {new Date(route.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>

                                                {/* Progress bar for active routes */}
                                                {route.status === 'active' && stops.length > 0 && (
                                                    <div style={{ marginTop: '10px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                            <span style={{ fontSize: '11px', color: '#717a6d' }}>
                                                                {completedStops} of {stops.length} stops done · {skippedStops} skipped
                                                            </span>
                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: progressPct >= 80 ? '#00450d' : '#d97706' }}>
                                                                {progressPct}%
                                                            </span>
                                                        </div>
                                                        <div className="progress-track" style={{ maxWidth: '320px' }}>
                                                            <div className="progress-fill" style={{
                                                                width: `${progressPct}%`,
                                                                background: progressPct >= 80 ? '#00450d' : progressPct >= 50 ? '#d97706' : '#94a3b8',
                                                            }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '20px', flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                                                expand_more
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expanded stop list */}
                                    {isExpanded && (
                                        <div className="slide-down" style={{ background: '#f9fdf9', borderBottom: '1px solid rgba(0,69,13,0.04)' }}>
                                            {loadingStops === route.id ? (
                                                <div style={{ padding: '20px', textAlign: 'center' }}>
                                                    <div style={{ width: '22px', height: '22px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
                                                </div>
                                            ) : expandedStops.length === 0 ? (
                                                <p style={{ padding: '16px 24px', fontSize: '13px', color: '#94a3b8', margin: 0 }}>No stops added to this route yet.</p>
                                            ) : (
                                                <div>
                                                    <div style={{ padding: '10px 24px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <p style={{ fontSize: '11px', fontWeight: 700, color: '#717a6d', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif', margin: 0 }}>
                                                            {expandedStops.length} stops
                                                        </p>
                                                        <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
                                                            <span style={{ color: '#00450d' }}>✓ {expandedStops.filter(s => s.status === 'completed').length} done</span>
                                                            <span style={{ color: '#dc2626' }}>✗ {expandedStops.filter(s => s.status === 'skipped').length} skipped</span>
                                                            <span style={{ color: '#d97706' }}>○ {expandedStops.filter(s => s.status === 'pending').length} pending</span>
                                                        </div>
                                                    </div>
                                                    {expandedStops.map(stop => (
                                                        <div key={stop.id} className="stop-row">
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, background: stop.status === 'completed' ? '#f0fdf4' : stop.status === 'skipped' ? '#fef2f2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: stop.status === 'completed' ? '#00450d' : stop.status === 'skipped' ? '#ba1a1a' : '#94a3b8' }}>
                                                                    {stop.status === 'completed' ? 'check' : stop.status === 'skipped' ? 'close' : 'radio_button_unchecked'}
                                                                </span>
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <p style={{ margin: 0, fontWeight: 600, color: '#181c22', fontSize: '13px' }}>
                                                                    {stop.road_name || stop.address}
                                                                </p>
                                                                {stop.skip_reason && (
                                                                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#ba1a1a' }}>
                                                                        Skipped: {stop.skip_reason.replace(/_/g, ' ')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                                                {stop.frequency && (
                                                                    <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>
                                                                        {stop.frequency.replace(/_/g, ' ')}
                                                                    </span>
                                                                )}
                                                                {stop.is_commercial && (
                                                                    <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Commercial</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9fdf9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '15px' }}>info</span>
                    <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>
                        Showing {filtered.length} of {routes.length} routes in your assigned wards
                    </p>
                </div>
            </div>
        </DashboardLayout>
    )
}