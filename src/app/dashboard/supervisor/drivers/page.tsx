'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const SUPERVISOR_NAV = [
    { label: 'Overview', href: '/dashboard/supervisor', icon: 'dashboard', section: 'Main' },
    { label: 'Routes', href: '/dashboard/supervisor/routes', icon: 'route', section: 'Operations' },
    { label: 'Drivers', href: '/dashboard/supervisor/drivers', icon: 'people', section: 'Operations' },
    { label: 'Track Route', href: '/dashboard/supervisor/track-route', icon: 'gps_fixed', section: 'Operations' },
    { label: 'Alerts', href: '/dashboard/supervisor/alerts', icon: 'notifications_active', section: 'Operations' },
    { label: 'Complaints', href: '/dashboard/supervisor/complaints', icon: 'feedback', section: 'Operations' },
    { label: 'Compliance', href: '/dashboard/supervisor/schedule-compliance', icon: 'fact_check', section: 'Reports' },
    { label: 'Waste Reports', href: '/dashboard/supervisor/waste-reports', icon: 'report', section: 'Reports' },
    { label: 'Ward Heatmap', href: '/dashboard/supervisor/heatmap', icon: 'map', section: 'Reports' },
    { label: 'Shift Report', href: '/dashboard/supervisor/shift-report', icon: 'picture_as_pdf', section: 'Reports' },
    { label: 'Announcements', href: '/dashboard/supervisor/announcements', icon: 'campaign', section: 'Communications' },
    { label: 'Schedules', href: '/dashboard/supervisor/schedules', icon: 'calendar_month', section: 'Operations' },
]

interface DriverStat {
    id: string
    full_name: string
    phone: string | null
    ward: string | null
    totalRoutes: number
    completedRoutes: number
    activeRoutes: number
    totalStops: number
    completedStops: number
    skippedStops: number
    openAlerts: number
    completionRate: number
    lastActive: string | null
}

export default function SupervisorDriversPage() {
    const [profile, setProfile] = useState<any>(null)
    const [drivers, setDrivers] = useState<DriverStat[]>([])
    const [loading, setLoading] = useState(true)
    const [sortBy, setSortBy] = useState<'name' | 'completion' | 'alerts' | 'skipped'>('completion')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const wards: string[] = p?.assigned_wards || []
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        // Get routes in supervisor's wards from the last 7 days
        let routeQuery = supabase
            .from('routes')
            .select(`
        id, status, driver_id, ward, date,
        profiles:driver_id(id, full_name, phone, ward),
        collection_stops(id, status),
        exception_alerts(id, is_resolved)
      `)
            .eq('district', p?.district || '')
            .gte('date', sevenDaysAgo.toISOString().split('T')[0])
            .not('driver_id', 'is', null)

        if (wards.length > 0) {
            routeQuery = routeQuery.in('ward', wards)
        }

        const { data: routeData } = await routeQuery

        // Aggregate per driver
        const driverMap: Record<string, DriverStat> = {}

        for (const route of routeData || []) {
            const driverProfile = (route.profiles as any)
            if (!driverProfile) continue

            const driverId = route.driver_id as string
            if (!driverMap[driverId]) {
                driverMap[driverId] = {
                    id: driverId,
                    full_name: driverProfile.full_name || 'Unknown Driver',
                    phone: driverProfile.phone || null,
                    ward: driverProfile.ward || route.ward || null,
                    totalRoutes: 0,
                    completedRoutes: 0,
                    activeRoutes: 0,
                    totalStops: 0,
                    completedStops: 0,
                    skippedStops: 0,
                    openAlerts: 0,
                    completionRate: 0,
                    lastActive: null,
                }
            }

            const d = driverMap[driverId]
            d.totalRoutes++
            if (route.status === 'completed') d.completedRoutes++
            if (route.status === 'active') d.activeRoutes++

            const stops = (route.collection_stops as any[]) || []
            d.totalStops += stops.length
            d.completedStops += stops.filter(s => s.status === 'completed').length
            d.skippedStops += stops.filter(s => s.status === 'skipped').length

            const routeAlerts = (route.exception_alerts as any[]) || []
            d.openAlerts += routeAlerts.filter(a => !a.is_resolved).length

            // Track last active date
            if (!d.lastActive || route.date > d.lastActive) {
                d.lastActive = route.date
            }
        }

        // Compute completion rate
        const driverList = Object.values(driverMap).map(d => ({
            ...d,
            completionRate: d.totalStops > 0
                ? Math.round((d.completedStops / d.totalStops) * 100)
                : 0,
        }))

        setDrivers(driverList)
        setLoading(false)
    }

    function toggleSort(field: typeof sortBy) {
        if (sortBy === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(field)
            setSortDir('desc')
        }
    }

    const filtered = drivers
        .filter(d => d.full_name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            let diff = 0
            if (sortBy === 'name') diff = a.full_name.localeCompare(b.full_name)
            if (sortBy === 'completion') diff = a.completionRate - b.completionRate
            if (sortBy === 'alerts') diff = a.openAlerts - b.openAlerts
            if (sortBy === 'skipped') diff = a.skippedStops - b.skippedStops
            return sortDir === 'asc' ? diff : -diff
        })

    function performanceColor(rate: number) {
        if (rate >= 85) return { color: '#00450d', bg: '#f0fdf4' }
        if (rate >= 65) return { color: '#d97706', bg: '#fefce8' }
        return { color: '#dc2626', bg: '#fef2f2' }
    }

    function performanceLabel(rate: number) {
        if (rate >= 85) return 'Excellent'
        if (rate >= 65) return 'Average'
        return 'Needs attention'
    }

    const avgCompletion = drivers.length > 0
        ? Math.round(drivers.reduce((s, d) => s + d.completionRate, 0) / drivers.length)
        : 0

    const totalOpenAlerts = drivers.reduce((s, d) => s + d.openAlerts, 0)
    const driversNeedingAttention = drivers.filter(d => d.completionRate < 65 || d.openAlerts > 0).length

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
        .driver-row {
          padding: 16px 24px; border-bottom: 1px solid rgba(0,69,13,0.04);
          transition: background 0.2s;
        }
        .driver-row:hover { background: #f9fdf9; }
        .driver-row:last-child { border-bottom: none; }
        .sort-btn {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 700; color: #717a6d;
          font-family: 'Manrope', sans-serif; text-transform: uppercase;
          letter-spacing: 0.08em; cursor: pointer; border: none;
          background: none; padding: 4px 8px; border-radius: 6px;
          transition: all 0.15s;
        }
        .sort-btn:hover { background: rgba(0,69,13,0.06); color: #00450d; }
        .sort-btn.active { color: #00450d; background: rgba(0,69,13,0.08); }
        .search-input {
          border: 1.5px solid rgba(0,69,13,0.1); border-radius: 10px;
          padding: 8px 14px; font-size: 13px; font-family: 'Inter', sans-serif;
          outline: none; color: #181c22; background: white; width: 220px;
          transition: border 0.2s;
        }
        .search-input:focus { border-color: #00450d; }
        .badge {
          display: inline-flex; align-items: center; padding: 3px 10px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.06em;
          text-transform: uppercase; white-space: nowrap;
        }
        .progress-track { height: 5px; background: #f0fdf4; border-radius: 99px; overflow: hidden; }
        .progress-fill  { height: 100%; border-radius: 99px; transition: width 0.6s ease; }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.45s ease 0.05s both; }
        .s2 { animation: staggerIn 0.45s ease 0.10s both; }
        .s3 { animation: staggerIn 0.45s ease 0.15s both; }
      `}</style>

            {/* Header */}
            <section className="s1" style={{ marginBottom: '32px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    Supervisor · Driver Performance
                </span>
                <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '46px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: 0 }}>
                    Driver <span style={{ color: '#1b5e20' }}>Performance</span>
                </h1>
                <p style={{ fontSize: '13px', color: '#717a6d', marginTop: '6px' }}>
                    Last 7 days · {profile?.district} · Wards: {(profile?.assigned_wards || []).join(', ') || 'All'}
                </p>
            </section>

            {/* Summary stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }} className="s2">
                {[
                    { label: 'Total Drivers', value: drivers.length, icon: 'people', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Avg Completion', value: `${avgCompletion}%`, icon: 'percent', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Open Alerts', value: totalOpenAlerts, icon: 'warning', color: totalOpenAlerts > 0 ? '#dc2626' : '#00450d', bg: totalOpenAlerts > 0 ? '#fef2f2' : '#f0fdf4' },
                    { label: 'Need Attention', value: driversNeedingAttention, icon: 'person_alert', color: driversNeedingAttention > 0 ? '#d97706' : '#00450d', bg: driversNeedingAttention > 0 ? '#fefce8' : '#f0fdf4' },
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

            {/* Driver table */}
            <div className="bento-card s3">
                {/* Toolbar */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>
                            Driver List
                        </h3>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{filtered.length} driver{filtered.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                            className="search-input"
                            placeholder="Search drivers..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Column headers */}
                <div style={{ padding: '8px 24px', borderBottom: '1px solid rgba(0,69,13,0.04)', display: 'flex', alignItems: 'center', gap: '8px', background: '#fafdfb' }}>
                    <div style={{ flex: 2 }}>
                        <button className={`sort-btn ${sortBy === 'name' ? 'active' : ''}`} onClick={() => toggleSort('name')}>
                            Driver
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                {sortBy === 'name' ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                            </span>
                        </button>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <button className={`sort-btn ${sortBy === 'completion' ? 'active' : ''}`} onClick={() => toggleSort('completion')}>
                            Completion
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                {sortBy === 'completion' ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                            </span>
                        </button>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <button className={`sort-btn ${sortBy === 'skipped' ? 'active' : ''}`} onClick={() => toggleSort('skipped')}>
                            Skipped
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                {sortBy === 'skipped' ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                            </span>
                        </button>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <button className={`sort-btn ${sortBy === 'alerts' ? 'active' : ''}`} onClick={() => toggleSort('alerts')}>
                            Alerts
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                {sortBy === 'alerts' ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                            </span>
                        </button>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#717a6d', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</span>
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
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>people</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: '0 0 6px' }}>
                            {search ? 'No drivers match your search' : 'No driver data in the last 7 days'}
                        </p>
                        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                            {search ? 'Try a different name.' : 'Drivers will appear here once routes are assigned in your wards.'}
                        </p>
                    </div>
                ) : (
                    <div>
                        {filtered.map(driver => {
                            const pc = performanceColor(driver.completionRate)
                            const isActive = driver.activeRoutes > 0
                            return (
                                <div key={driver.id} className="driver-row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                                        {/* Avatar + name */}
                                        <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isActive ? '#00450d' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 700, color: isActive ? 'white' : '#9ca3af', fontFamily: 'Manrope, sans-serif' }}>
                                                    {driver.full_name.charAt(0).toUpperCase()}
                                                </span>
                                                {isActive && (
                                                    <span style={{ position: 'absolute', bottom: '0', right: '0', width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', border: '2px solid white' }} />
                                                )}
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif', margin: '0 0 2px' }}>
                                                    {driver.full_name}
                                                </p>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {driver.ward && (
                                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{driver.ward}</span>
                                                    )}
                                                    {driver.phone && (
                                                        <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>phone</span>
                                                            {driver.phone}
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                        {driver.totalRoutes} route{driver.totalRoutes !== 1 ? 's' : ''} · {driver.totalStops} stops
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Completion rate */}
                                        <div style={{ flex: 1, textAlign: 'center' }}>
                                            <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: pc.color, margin: '0 0 4px', lineHeight: 1 }}>
                                                {driver.completionRate}%
                                            </p>
                                            <div className="progress-track" style={{ maxWidth: '80px', margin: '0 auto' }}>
                                                <div className="progress-fill" style={{ width: `${driver.completionRate}%`, background: pc.color }} />
                                            </div>
                                            <p style={{ fontSize: '10px', color: '#94a3b8', margin: '4px 0 0' }}>
                                                {driver.completedStops}/{driver.totalStops}
                                            </p>
                                        </div>

                                        {/* Skipped stops */}
                                        <div style={{ flex: 1, textAlign: 'center' }}>
                                            <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '18px', color: driver.skippedStops > 5 ? '#dc2626' : driver.skippedStops > 0 ? '#d97706' : '#00450d', margin: 0, lineHeight: 1 }}>
                                                {driver.skippedStops}
                                            </p>
                                            <p style={{ fontSize: '10px', color: '#94a3b8', margin: '4px 0 0' }}>skipped</p>
                                        </div>

                                        {/* Open alerts */}
                                        <div style={{ flex: 1, textAlign: 'center' }}>
                                            <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '18px', color: driver.openAlerts > 0 ? '#dc2626' : '#00450d', margin: 0, lineHeight: 1 }}>
                                                {driver.openAlerts}
                                            </p>
                                            <p style={{ fontSize: '10px', color: '#94a3b8', margin: '4px 0 0' }}>open alerts</p>
                                        </div>

                                        {/* Performance status */}
                                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                            <span className="badge" style={{ background: pc.bg, color: pc.color }}>
                                                {performanceLabel(driver.completionRate)}
                                            </span>
                                        </div>

                                    </div>

                                    {/* Last active + route breakdown */}
                                    <div style={{ marginTop: '8px', paddingLeft: '48px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                        {driver.lastActive && (
                                            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>calendar_today</span>
                                                Last active: {new Date(driver.lastActive).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </span>
                                        )}
                                        {driver.completedRoutes > 0 && (
                                            <span style={{ fontSize: '11px', color: '#00450d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check_circle</span>
                                                {driver.completedRoutes} completed
                                            </span>
                                        )}
                                        {driver.activeRoutes > 0 && (
                                            <span style={{ fontSize: '11px', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>directions_car</span>
                                                {driver.activeRoutes} active now
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9fdf9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '15px' }}>info</span>
                    <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>
                        Performance based on routes in your assigned wards over the last 7 days. Read-only view.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    )
}