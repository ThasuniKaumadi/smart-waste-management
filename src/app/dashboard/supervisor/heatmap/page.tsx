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
]

interface WardStat {
    ward: string
    totalRoutes: number
    completedRoutes: number
    totalStops: number
    completedStops: number
    skippedStops: number
    openAlerts: number
    completionPct: number
    collectionRate: number
}

const COLOMBO_WARDS: Record<string, { district: string; x: number; y: number; w: number; h: number }> = {
    'Ward 1': { district: 'Colombo North - District 1', x: 1, y: 0, w: 2, h: 2 },
    'Ward 2': { district: 'Colombo North - District 1', x: 3, y: 0, w: 2, h: 2 },
    'Ward 3': { district: 'Colombo North - District 1', x: 5, y: 0, w: 2, h: 2 },
    'Ward 4': { district: 'Colombo North - District 1', x: 7, y: 0, w: 2, h: 2 },
    'Ward 5': { district: 'Colombo North - District 1', x: 1, y: 2, w: 2, h: 2 },
    'Ward 6': { district: 'Colombo North - District 1', x: 3, y: 2, w: 2, h: 2 },
    'Ward 7': { district: 'Colombo North - District 1', x: 5, y: 2, w: 2, h: 2 },
    'Ward 8': { district: 'Colombo North - District 1', x: 7, y: 2, w: 2, h: 2 },
    'Ward 9': { district: 'Colombo Central - District 2', x: 1, y: 4, w: 2, h: 2 },
    'Ward 10': { district: 'Colombo Central - District 2', x: 3, y: 4, w: 2, h: 2 },
    'Ward 11': { district: 'Colombo Central - District 2', x: 5, y: 4, w: 2, h: 2 },
    'Ward 12': { district: 'Colombo Central - District 2', x: 7, y: 4, w: 2, h: 2 },
    'Ward 13': { district: 'Colombo Central - District 2', x: 1, y: 6, w: 2, h: 2 },
    'Ward 14': { district: 'Colombo Central - District 2', x: 3, y: 6, w: 2, h: 2 },
    'Ward 15': { district: 'Colombo South - District 3', x: 5, y: 6, w: 2, h: 2 },
    'Ward 16': { district: 'Colombo South - District 3', x: 7, y: 6, w: 2, h: 2 },
    'Ward 17': { district: 'Colombo South - District 3', x: 1, y: 8, w: 2, h: 2 },
    'Ward 18': { district: 'Colombo South - District 3', x: 3, y: 8, w: 2, h: 2 },
    'Ward 19': { district: 'Colombo South - District 3', x: 5, y: 8, w: 2, h: 2 },
    'Ward 20': { district: 'Colombo South - District 3', x: 7, y: 8, w: 2, h: 2 },
}

function getRateColor(pct: number, noData: boolean): { fill: string; text: string } {
    if (noData) return { fill: '#f1f5f9', text: '#94a3b8' }
    if (pct >= 90) return { fill: '#00450d', text: 'white' }
    if (pct >= 75) return { fill: '#16a34a', text: 'white' }
    if (pct >= 60) return { fill: '#65a30d', text: 'white' }
    if (pct >= 40) return { fill: '#d97706', text: 'white' }
    if (pct >= 20) return { fill: '#ea580c', text: 'white' }
    return { fill: '#dc2626', text: 'white' }
}

export default function WardHeatmapPage() {
    const [profile, setProfile] = useState<any>(null)
    const [wardStats, setWardStats] = useState<Record<string, WardStat>>({})
    const [loading, setLoading] = useState(true)
    const [selectedWard, setSelectedWard] = useState<string | null>(null)
    const [days, setDays] = useState(7)
    const [metric, setMetric] = useState<'completion' | 'collection' | 'alerts'>('completion')

    useEffect(() => { loadData() }, [days])

    async function loadData() {
        setLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const since = new Date()
        since.setDate(since.getDate() - days)

        const { data: routes } = await supabase
            .from('routes')
            .select(`
        id, ward, status,
        collection_stops(id, status),
        exception_alerts(id, is_resolved)
      `)
            .eq('district', p?.district || '')
            .gte('date', since.toISOString().split('T')[0])

        // Aggregate per ward
        const stats: Record<string, WardStat> = {}

        for (const route of routes || []) {
            const ward = route.ward || 'Unknown'
            if (!stats[ward]) {
                stats[ward] = {
                    ward,
                    totalRoutes: 0,
                    completedRoutes: 0,
                    totalStops: 0,
                    completedStops: 0,
                    skippedStops: 0,
                    openAlerts: 0,
                    completionPct: 0,
                    collectionRate: 0,
                }
            }
            const s = stats[ward]
            s.totalRoutes++
            if (route.status === 'completed') s.completedRoutes++
            const stops = (route.collection_stops as any[]) || []
            s.totalStops += stops.length
            s.completedStops += stops.filter(st => st.status === 'completed').length
            s.skippedStops += stops.filter(st => st.status === 'skipped').length
            const alerts = (route.exception_alerts as any[]) || []
            s.openAlerts += alerts.filter(a => !a.is_resolved).length
        }

        // Compute rates
        Object.values(stats).forEach(s => {
            s.completionPct = s.totalStops > 0 ? Math.round((s.completedStops / s.totalStops) * 100) : 0
            s.collectionRate = s.totalRoutes > 0 ? Math.round((s.completedRoutes / s.totalRoutes) * 100) : 0
        })

        setWardStats(stats)
        setLoading(false)
    }

    function getMetricValue(ward: string): number {
        const s = wardStats[ward]
        if (!s) return 0
        if (metric === 'completion') return s.completionPct
        if (metric === 'collection') return s.collectionRate
        return s.openAlerts
    }

    function getMetricColor(ward: string): { fill: string; text: string } {
        const s = wardStats[ward]
        if (!s || s.totalRoutes === 0) return { fill: '#f1f5f9', text: '#94a3b8' }
        if (metric === 'alerts') {
            const a = s.openAlerts
            if (a === 0) return { fill: '#f0fdf4', text: '#00450d' }
            if (a <= 2) return { fill: '#fefce8', text: '#d97706' }
            if (a <= 5) return { fill: '#ffedd5', text: '#ea580c' }
            return { fill: '#fef2f2', text: '#dc2626' }
        }
        return getRateColor(getMetricValue(ward), !s || s.totalRoutes === 0)
    }

    const assignedWards = profile?.assigned_wards || []
    const selectedStat = selectedWard ? wardStats[selectedWard] : null

    // Legend
    const legendItems = metric === 'alerts'
        ? [
            { label: '0 alerts', fill: '#f0fdf4', text: '#00450d' },
            { label: '1–2 alerts', fill: '#fefce8', text: '#d97706' },
            { label: '3–5 alerts', fill: '#ffedd5', text: '#ea580c' },
            { label: '6+ alerts', fill: '#fef2f2', text: '#dc2626' },
        ]
        : [
            { label: '≥90%', fill: '#00450d', text: 'white' },
            { label: '75–89%', fill: '#16a34a', text: 'white' },
            { label: '60–74%', fill: '#65a30d', text: 'white' },
            { label: '40–59%', fill: '#d97706', text: 'white' },
            { label: '20–39%', fill: '#ea580c', text: 'white' },
            { label: '<20%', fill: '#dc2626', text: 'white' },
            { label: 'No data', fill: '#f1f5f9', text: '#94a3b8' },
        ]

    return (
        <DashboardLayout role="Supervisor" userName={profile?.full_name || ''} navItems={SUPERVISOR_NAV}>
            <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .bento-card { background: white; border-radius: 16px; box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08); border: 1px solid rgba(0,69,13,0.04); overflow: hidden; }
        .filter-btn { padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 700; font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
        .filter-btn.active { background: #00450d; color: white; }
        .filter-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .ward-cell { cursor: pointer; transition: all 0.15s; }
        .ward-cell:hover { opacity: 0.85; filter: brightness(1.05); }
        .ward-cell.assigned { stroke: #00450d; stroke-width: 2; }
        .ward-cell.selected { stroke: #181c22; stroke-width: 2.5; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2)); }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.4s ease 0.05s both; }
        .s2 { animation: staggerIn 0.4s ease 0.10s both; }
        .s3 { animation: staggerIn 0.4s ease 0.15s both; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .detail-panel { animation: fadeIn 0.2s ease both; }
      `}</style>

            {/* Header */}
            <section className="s1" style={{ marginBottom: '32px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    Supervisor · Spatial Analytics
                </span>
                <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '46px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 6px' }}>
                    Ward <span style={{ color: '#1b5e20' }}>Heatmap</span>
                </h1>
                <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>
                    {profile?.district} · Collection performance by ward
                </p>
            </section>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }} className="s2">
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#717a6d', fontWeight: 500 }}>Period:</span>
                    {[7, 14, 30].map(d => (
                        <button key={d} className={`filter-btn ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
                            {d} days
                        </button>
                    ))}
                </div>
                <div style={{ width: '1px', height: '20px', background: 'rgba(0,69,13,0.1)' }} />
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#717a6d', fontWeight: 500 }}>Metric:</span>
                    {([
                        { key: 'completion', label: 'Stop Completion' },
                        { key: 'collection', label: 'Route Completion' },
                        { key: 'alerts', label: 'Open Alerts' },
                    ] as const).map(m => (
                        <button key={m.key} className={`filter-btn ${metric === m.key ? 'active' : ''}`} onClick={() => setMetric(m.key)}>
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }} className="s3">

                {/* Heatmap SVG */}
                <div className="bento-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>
                            {profile?.district || 'District'} — Ward Grid
                        </h3>
                        {assignedWards.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#717a6d' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '2px solid #00450d', background: 'transparent' }} />
                                Your assigned wards
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '360px' }}>
                            <div style={{ width: '28px', height: '28px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                    ) : (
                        <>
                            {/* SVG Grid */}
                            <svg viewBox="0 0 10 10" style={{ width: '100%', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden' }}>
                                {/* Background */}
                                <rect x="0" y="0" width="10" height="10" fill="#f8fafc" rx="0.3" />

                                {/* Ward cells */}
                                {Object.entries(COLOMBO_WARDS).map(([ward, pos]) => {
                                    const colors = getMetricColor(ward)
                                    const isAssigned = assignedWards.includes(ward)
                                    const isSelected = selectedWard === ward
                                    const val = wardStats[ward]
                                    const noData = !val || val.totalRoutes === 0
                                    const displayVal = metric === 'alerts'
                                        ? (val ? val.openAlerts.toString() : '—')
                                        : (val && !noData ? `${getMetricValue(ward)}%` : '—')

                                    return (
                                        <g key={ward} className={`ward-cell ${isAssigned ? 'assigned' : ''} ${isSelected ? 'selected' : ''}`}
                                            onClick={() => setSelectedWard(selectedWard === ward ? null : ward)}>
                                            <rect
                                                x={pos.x + 0.08} y={pos.y + 0.08}
                                                width={pos.w - 0.16} height={pos.h - 0.16}
                                                fill={colors.fill}
                                                rx="0.2"
                                                stroke={isSelected ? '#181c22' : isAssigned ? '#00450d' : 'rgba(0,0,0,0.06)'}
                                                strokeWidth={isSelected ? 0.12 : isAssigned ? 0.1 : 0.04}
                                            />
                                            <text
                                                x={pos.x + pos.w / 2} y={pos.y + pos.h / 2 - 0.18}
                                                textAnchor="middle" dominantBaseline="middle"
                                                fontSize="0.22" fontWeight="700" fill={colors.text}
                                                fontFamily="Manrope, sans-serif"
                                            >
                                                {ward}
                                            </text>
                                            <text
                                                x={pos.x + pos.w / 2} y={pos.y + pos.h / 2 + 0.22}
                                                textAnchor="middle" dominantBaseline="middle"
                                                fontSize="0.28" fontWeight="800" fill={colors.text}
                                                fontFamily="Manrope, sans-serif"
                                            >
                                                {displayVal}
                                            </text>
                                        </g>
                                    )
                                })}
                            </svg>

                            {/* Legend */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px', justifyContent: 'center' }}>
                                {legendItems.map(l => (
                                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: l.fill, border: `1px solid rgba(0,0,0,0.08)` }} />
                                        <span style={{ fontSize: '11px', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>{l.label}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Side panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Selected ward detail */}
                    {selectedWard && selectedStat ? (
                        <div className="bento-card detail-panel" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>
                                    {selectedWard}
                                </h3>
                                <button onClick={() => setSelectedWard(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#64748b' }}>✕</button>
                            </div>
                            {[
                                { label: 'Stop completion', value: `${selectedStat.completionPct}%`, color: selectedStat.completionPct >= 80 ? '#00450d' : selectedStat.completionPct >= 60 ? '#d97706' : '#dc2626' },
                                { label: 'Route completion', value: `${selectedStat.collectionRate}%`, color: selectedStat.collectionRate >= 80 ? '#00450d' : '#d97706' },
                                { label: 'Total routes', value: selectedStat.totalRoutes, color: '#181c22' },
                                { label: 'Stops done', value: `${selectedStat.completedStops}/${selectedStat.totalStops}`, color: '#181c22' },
                                { label: 'Stops skipped', value: selectedStat.skippedStops, color: selectedStat.skippedStops > 0 ? '#dc2626' : '#00450d' },
                                { label: 'Open alerts', value: selectedStat.openAlerts, color: selectedStat.openAlerts > 0 ? '#dc2626' : '#00450d' },
                            ].map(m => (
                                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,69,13,0.04)' }}>
                                    <span style={{ fontSize: '12px', color: '#717a6d' }}>{m.label}</span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: m.color, fontFamily: 'Manrope, sans-serif' }}>{m.value}</span>
                                </div>
                            ))}
                            {/* Progress bar */}
                            <div style={{ marginTop: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '11px', color: '#717a6d' }}>Stop completion rate</span>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#00450d' }}>{selectedStat.completionPct}%</span>
                                </div>
                                <div style={{ height: '8px', background: '#f0fdf4', borderRadius: '99px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: '99px', background: selectedStat.completionPct >= 80 ? '#00450d' : selectedStat.completionPct >= 60 ? '#d97706' : '#dc2626', width: `${selectedStat.completionPct}%`, transition: 'width 0.6s ease' }} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bento-card" style={{ padding: '20px', textAlign: 'center' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>touch_app</span>
                            </div>
                            <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', color: '#181c22', margin: '0 0 4px' }}>Select a ward</p>
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Click any ward cell on the heatmap to see detailed stats.</p>
                        </div>
                    )}

                    {/* District summary */}
                    <div className="bento-card" style={{ padding: '20px' }}>
                        <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', color: '#181c22', margin: '0 0 14px' }}>
                            District Summary · {days}d
                        </h3>
                        {loading ? (
                            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>Loading...</p>
                        ) : Object.keys(wardStats).length === 0 ? (
                            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>No route data in this period.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {Object.values(wardStats)
                                    .sort((a, b) => b.completionPct - a.completionPct)
                                    .slice(0, 8)
                                    .map(s => (
                                        <div key={s.ward} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                            onClick={() => setSelectedWard(s.ward)}>
                                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#41493e', minWidth: '54px', fontFamily: 'Manrope, sans-serif' }}>{s.ward}</span>
                                            <div style={{ flex: 1, height: '6px', background: '#f0fdf4', borderRadius: '99px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', borderRadius: '99px', width: `${s.completionPct}%`, background: s.completionPct >= 80 ? '#00450d' : s.completionPct >= 60 ? '#d97706' : '#dc2626', transition: 'width 0.6s ease' }} />
                                            </div>
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: s.completionPct >= 80 ? '#00450d' : s.completionPct >= 60 ? '#d97706' : '#dc2626', minWidth: '34px', textAlign: 'right', fontFamily: 'Manrope, sans-serif' }}>
                                                {s.completionPct}%
                                            </span>
                                            {s.openAlerts > 0 && (
                                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '99px', background: '#fef2f2', color: '#dc2626', fontFamily: 'Manrope, sans-serif' }}>
                                                    {s.openAlerts}⚠
                                                </span>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* Top/bottom performers */}
                    {!loading && Object.keys(wardStats).length > 0 && (
                        <div className="bento-card" style={{ padding: '20px' }}>
                            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', color: '#181c22', margin: '0 0 12px' }}>Attention Needed</h3>
                            {Object.values(wardStats)
                                .filter(s => s.completionPct < 70 && s.totalRoutes > 0)
                                .sort((a, b) => a.completionPct - b.completionPct)
                                .slice(0, 3)
                                .map(s => (
                                    <div key={s.ward} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '10px', background: '#fef2f2', marginBottom: '6px', cursor: 'pointer' }}
                                        onClick={() => setSelectedWard(s.ward)}>
                                        <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: '16px' }}>warning</span>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '12px', fontWeight: 700, color: '#181c22', margin: 0, fontFamily: 'Manrope, sans-serif' }}>{s.ward}</p>
                                            <p style={{ fontSize: '10px', color: '#dc2626', margin: 0 }}>{s.completionPct}% completion · {s.openAlerts} alerts</p>
                                        </div>
                                    </div>
                                ))}
                            {Object.values(wardStats).filter(s => s.completionPct < 70 && s.totalRoutes > 0).length === 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '10px', background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '16px' }}>check_circle</span>
                                    <p style={{ fontSize: '12px', color: '#00450d', margin: 0 }}>All wards performing well</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}