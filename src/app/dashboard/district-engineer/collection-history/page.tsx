'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
    { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
    { label: 'History', href: '/dashboard/district-engineer/collection-history', icon: 'history' },
    { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
    { label: 'Heatmap', href: '/dashboard/district-engineer/heatmap', icon: 'thermostat' },
    { label: 'Reports', href: '/dashboard/district-engineer/reports', icon: 'report_problem' },
    { label: 'Incidents', href: '/dashboard/district-engineer/incidents', icon: 'warning' },
    { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
    { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

const SKIP_REASONS: Record<string, { label: string; color: string }> = {
    wrong_waste_type: { label: 'Wrong waste type', color: '#7c3aed' },
    access_denied: { label: 'Access denied', color: '#ba1a1a' },
    vehicle_breakdown: { label: 'Vehicle breakdown', color: '#d97706' },
    no_waste_out: { label: 'No waste put out', color: '#1d4ed8' },
    other: { label: 'Other', color: '#64748b' },
}

const WASTE_COLORS: Record<string, string> = {
    organic: '#00450d', non_recyclable: '#ba1a1a', recyclable: '#1d4ed8',
    e_waste: '#7c3aed', bulk: '#d97706', other: '#64748b',
}

const DATE_RANGES = [
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
    { value: 'custom', label: 'Custom range' },
]

interface ScheduleRecord {
    id: string; waste_type: string; custom_waste_type: string | null
    collection_day: string; collection_time: string; scheduled_date: string
    wards: string[]; ward: string; status: string
    streets: Record<string, string[]> | null
}

interface RouteRecord {
    id: string; schedule_id: string; route_name: string
    ward: string; date: string; status: string; stops: StopRecord[]
}

interface StopRecord {
    id: string; route_id: string; road_name: string; address: string
    status: string; skip_reason: string | null; is_commercial: boolean
    completed_at: string | null; stop_order: number
}

interface ConfirmationRecord {
    schedule_id: string; role: string; status: string
    ward: string | null; created_at: string
}

interface ScheduleAnalytics {
    schedule: ScheduleRecord; routes: RouteRecord[]
    totalStops: number; completedStops: number; skippedStops: number; pendingStops: number
    completionRate: number; skipReasons: Record<string, number>
    confirmations: { resident: number; commercial: number; unable: number }
}

// Shared tooltip style
const tooltipStyle = {
    borderRadius: 10, border: '1px solid rgba(0,69,13,0.1)',
    fontSize: 12, fontFamily: 'Manrope,sans-serif',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
}

// Empty state for charts
function ChartEmpty({ message }: { message: string }) {
    return (
        <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 8 }}>
            <span className="msym" style={{ fontSize: 28 }}>bar_chart</span>
            <p style={{ fontSize: 12, margin: 0 }}>{message}</p>
        </div>
    )
}

export default function CollectionHistoryPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [schedules, setSchedules] = useState<ScheduleRecord[]>([])
    const [routes, setRoutes] = useState<RouteRecord[]>([])
    const [confirmations, setConfirmations] = useState<ConfirmationRecord[]>([])
    const [search, setSearch] = useState('')
    const [dateRange, setDateRange] = useState('30')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [activeSection, setActiveSection] = useState<'overview' | 'schedules' | 'skips' | 'confirmations'>('overview')
    const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null)

    useEffect(() => { loadData() }, [dateRange, customStart, customEnd])

    function getDateBounds() {
        const end = new Date(); end.setHours(23, 59, 59, 999)
        if (dateRange === 'custom' && customStart && customEnd) return { start: customStart, end: customEnd }
        const start = new Date(); start.setDate(start.getDate() - parseInt(dateRange)); start.setHours(0, 0, 0, 0)
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
    }

    async function loadData() {
        setLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { start, end } = getDateBounds()
        const { data: schedData } = await supabase
            .from('schedules').select('*').eq('district', p?.district || '')
            .gte('scheduled_date', start).lte('scheduled_date', end)
            .order('scheduled_date', { ascending: true })
        const schedList = schedData || []
        setSchedules(schedList)
        if (schedList.length > 0) {
            const schedIds = schedList.map((s: any) => s.id)
            const { data: routesData } = await supabase
                .from('routes').select(`*, collection_stops(*)`)
                .in('schedule_id', schedIds).order('date', { ascending: true })
            setRoutes((routesData || []).map((r: any) => ({ ...r, stops: r.collection_stops || [] })))
            const { data: confirmData } = await supabase
                .from('waste_confirmations').select('schedule_id, role, status, ward, created_at')
                .in('schedule_id', schedIds)
            setConfirmations(confirmData || [])
        } else { setRoutes([]); setConfirmations([]) }
        setLoading(false)
    }

    const analytics: ScheduleAnalytics[] = useMemo(() => {
        return schedules.map(schedule => {
            const schedRoutes = routes.filter(r => r.schedule_id === schedule.id)
            const allStops = schedRoutes.flatMap(r => r.stops)
            const completed = allStops.filter(s => s.status === 'completed').length
            const skipped = allStops.filter(s => s.status === 'skipped').length
            const pending = allStops.filter(s => s.status === 'pending').length
            const total = allStops.length
            const skipReasons: Record<string, number> = {}
            allStops.filter(s => s.status === 'skipped' && s.skip_reason).forEach(s => {
                skipReasons[s.skip_reason!] = (skipReasons[s.skip_reason!] || 0) + 1
            })
            const schedConfirms = confirmations.filter(c => c.schedule_id === schedule.id)
            return {
                schedule, routes: schedRoutes, totalStops: total,
                completedStops: completed, skippedStops: skipped, pendingStops: pending,
                completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
                skipReasons,
                confirmations: {
                    resident: schedConfirms.filter(c => c.role === 'resident' && c.status === 'confirmed').length,
                    commercial: schedConfirms.filter(c => c.role === 'commercial_establishment' && c.status === 'confirmed').length,
                    unable: schedConfirms.filter(c => c.status === 'unable').length,
                },
            }
        })
    }, [schedules, routes, confirmations])

    const filtered = useMemo(() => {
        if (!search.trim()) return analytics
        const q = search.toLowerCase()
        return analytics.filter(a => {
            const label = a.schedule.waste_type === 'other' && a.schedule.custom_waste_type ? a.schedule.custom_waste_type.toLowerCase() : a.schedule.waste_type.toLowerCase()
            const wards = (a.schedule.wards || [a.schedule.ward]).join(' ').toLowerCase()
            const streets = a.schedule.streets ? Object.values(a.schedule.streets).flat().join(' ').toLowerCase() : ''
            const routeNames = a.routes.map(r => r.route_name).join(' ').toLowerCase()
            return label.includes(q) || wards.includes(q) || streets.includes(q) || routeNames.includes(q)
        })
    }, [analytics, search])

    // ── Per-day time series data ──────────────────────────────────────────────
    const timeSeriesData = useMemo(() => {
        const byDate: Record<string, {
            date: string; label: string
            completed: number; skipped: number
            resident: number; commercial: number; unable: number
            wrong_waste_type: number; access_denied: number
            vehicle_breakdown: number; no_waste_out: number; skip_other: number
        }> = {}

        filtered.forEach(a => {
            const d = a.schedule.scheduled_date
            if (!byDate[d]) byDate[d] = {
                date: d,
                label: new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                completed: 0, skipped: 0,
                resident: 0, commercial: 0, unable: 0,
                wrong_waste_type: 0, access_denied: 0,
                vehicle_breakdown: 0, no_waste_out: 0, skip_other: 0,
            }
            byDate[d].completed += a.completedStops
            byDate[d].skipped += a.skippedStops
            byDate[d].resident += a.confirmations.resident
            byDate[d].commercial += a.confirmations.commercial
            byDate[d].unable += a.confirmations.unable
            Object.entries(a.skipReasons).forEach(([reason, count]) => {
                const key = reason in byDate[d] ? reason : 'skip_other'
                    ; (byDate[d] as any)[key] = ((byDate[d] as any)[key] || 0) + count
            })
        })

        return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
    }, [filtered])

    // Aggregates
    const totalStops = filtered.reduce((s, a) => s + a.totalStops, 0)
    const totalCompleted = filtered.reduce((s, a) => s + a.completedStops, 0)
    const totalSkipped = filtered.reduce((s, a) => s + a.skippedStops, 0)
    const totalResidentConfirmed = filtered.reduce((s, a) => s + a.confirmations.resident, 0)
    const totalCommercialConfirmed = filtered.reduce((s, a) => s + a.confirmations.commercial, 0)
    const totalUnable = filtered.reduce((s, a) => s + a.confirmations.unable, 0)
    const overallRate = totalStops > 0 ? Math.round((totalCompleted / totalStops) * 100) : 0

    // Skip reasons aggregate
    const skipData = useMemo(() => {
        const agg: Record<string, number> = {}
        filtered.forEach(a => Object.entries(a.skipReasons).forEach(([r, c]) => { agg[r] = (agg[r] || 0) + c }))
        return Object.entries(agg).map(([reason, count]) => ({
            reason: SKIP_REASONS[reason]?.label || reason, count, color: SKIP_REASONS[reason]?.color || '#94a3b8',
        })).sort((a, b) => b.count - a.count)
    }, [filtered])

    // Most skipped streets
    const skippedStreets = useMemo(() => {
        const m: Record<string, number> = {}
        routes.forEach(r => r.stops.filter(s => s.status === 'skipped').forEach(s => {
            const n = s.road_name || s.address; if (n) m[n] = (m[n] || 0) + 1
        }))
        return Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, 8).map(([street, count]) => ({ street, count }))
    }, [routes])

    // Waste distribution
    const wasteDistribution = useMemo(() => {
        const agg: Record<string, number> = {}
        filtered.forEach(a => {
            const key = a.schedule.waste_type === 'other' && a.schedule.custom_waste_type ? a.schedule.custom_waste_type : a.schedule.waste_type
            agg[key] = (agg[key] || 0) + a.totalStops
        })
        return Object.entries(agg).map(([name, value]) => ({ name: name.replace('_', ' '), value, color: WASTE_COLORS[name] || '#94a3b8' }))
    }, [filtered])

    function exportCSV() {
        const rows = [
            ['Date', 'Ward', 'Waste Type', 'Total Stops', 'Completed', 'Skipped', 'Completion %', 'Resident Confirmations', 'Commercial Confirmations', 'Unable'],
            ...filtered.map(a => [
                a.schedule.scheduled_date,
                (a.schedule.wards || [a.schedule.ward]).join('; '),
                a.schedule.waste_type === 'other' && a.schedule.custom_waste_type ? a.schedule.custom_waste_type : a.schedule.waste_type,
                a.totalStops, a.completedStops, a.skippedStops, `${a.completionRate}%`,
                a.confirmations.resident, a.confirmations.commercial, a.confirmations.unable,
            ])
        ]
        const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `collection-history-${profile?.district}-${new Date().toISOString().split('T')[0]}.csv`
        a.click(); URL.revokeObjectURL(url)
    }

    function getWasteLabel(s: ScheduleRecord) {
        return s.waste_type === 'other' && s.custom_waste_type ? s.custom_waste_type : s.waste_type.replace('_', ' ')
    }

    const SECTIONS = [
        { key: 'overview', label: 'Overview', icon: 'dashboard' },
        { key: 'schedules', label: 'By Schedule', icon: 'calendar_month' },
        { key: 'skips', label: 'Skip Analysis', icon: 'block' },
        { key: 'confirmations', label: 'Confirmations', icon: 'thumb_up' },
    ] as const

    return (
        <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}>
            <style>{`
        .msym { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msym-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:16px; box-shadow:0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.04); border:1px solid rgba(0,69,13,0.06); overflow:hidden; }
        .chart-card { background:white; border-radius:14px; border:1px solid rgba(0,69,13,0.07); padding:20px; }
        .section-btn { padding:8px 18px; border-radius:99px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px; white-space:nowrap; }
        .section-btn.on { background:#00450d; color:white; }
        .section-btn.off { background:transparent; color:#64748b; }
        .section-btn.off:hover { background:#f1f5f9; }
        .search-input { width:100%; padding:10px 14px 10px 40px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafafa; outline:none; box-sizing:border-box; transition:all 0.2s; }
        .search-input:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .select-sm { padding:8px 32px 8px 12px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; color:#181c22; font-family:'Inter',sans-serif; background:#fafafa; outline:none; cursor:pointer; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23717a6d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; background-size:12px; transition:all 0.2s; }
        .select-sm:focus { border-color:#00450d; }
        .date-input { padding:8px 12px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; color:#181c22; font-family:'Inter',sans-serif; background:#fafafa; outline:none; transition:all 0.2s; }
        .date-input:focus { border-color:#00450d; }
        .sched-row { padding:14px 18px; border-bottom:1px solid rgba(0,69,13,0.05); transition:background 0.15s; cursor:pointer; }
        .sched-row:hover { background:#f9fdf9; }
        .sched-row:last-child { border-bottom:none; }
        .badge { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .progress-track { height:5px; background:#f1f5f9; border-radius:99px; overflow:hidden; }
        .progress-fill { height:100%; border-radius:99px; transition:width 0.6s ease; }
        .export-btn { display:flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; background:white; border:1.5px solid rgba(0,69,13,0.2); color:#00450d; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .export-btn:hover { background:#f0fdf4; }
        .chip { display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:600; font-family:'Manrope',sans-serif; white-space:nowrap; }
        .chart-label { font-size:13px; font-weight:700; color:#181c22; font-family:'Manrope',sans-serif; margin:0 0 3px; }
        .chart-sub { font-size:11px; color:#94a3b8; margin:0 0 16px; }
        .chart-stat { font-size:24px; font-weight:900; font-family:'Manrope',sans-serif; line-height:1; margin:0 0 14px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both}
        .a3{animation:fadeUp .4s ease .14s both} .a4{animation:fadeUp .4s ease .19s both}
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .slide-down { animation:slideDown .25s ease both; }
      `}</style>

            {/* ── Header ── */}
            <section className="mb-8 a1">
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 8 }}>
                    District Engineering · Analytics
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <h1 style={{ fontSize: 44, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: 0 }}>
                            Collection <span style={{ color: '#1b5e20' }}>History</span>
                        </h1>
                        <p style={{ fontSize: 13, color: '#717a6d', marginTop: 6 }}>{profile?.district} · Performance analytics and skip analysis</p>
                    </div>
                    <button onClick={exportCSV} className="export-btn">
                        <span className="msym" style={{ fontSize: 18 }}>download</span>Export CSV
                    </button>
                </div>
            </section>

            {/* ── Filters ── */}
            <div className="a2" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
                    <span className="msym" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#94a3b8' }}>search</span>
                    <input type="text" className="search-input" placeholder="Search wards, streets, waste type…" value={search} onChange={e => setSearch(e.target.value)} />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                            <span className="msym" style={{ fontSize: 16 }}>close</span>
                        </button>
                    )}
                </div>
                <select className="select-sm" value={dateRange} onChange={e => setDateRange(e.target.value)}>
                    {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {dateRange === 'custom' && (
                    <>
                        <input type="date" className="date-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>to</span>
                        <input type="date" className="date-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                    </>
                )}
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>
                    {filtered.length} schedule{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* ── Stat cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 28 }} className="a2">
                {[
                    { label: 'Total Stops', value: totalStops, icon: 'pin_drop', color: '#374151', bg: '#f8fafc', fill: false },
                    { label: 'Completed', value: totalCompleted, icon: 'check_circle', color: '#00450d', bg: '#f0fdf4', fill: true },
                    { label: 'Skipped', value: totalSkipped, icon: 'cancel', color: '#ba1a1a', bg: '#fef2f2', fill: true },
                    { label: 'Completion Rate', value: `${overallRate}%`, icon: 'percent', color: overallRate >= 80 ? '#00450d' : overallRate >= 60 ? '#d97706' : '#ba1a1a', bg: overallRate >= 80 ? '#f0fdf4' : overallRate >= 60 ? '#fefce8' : '#fef2f2', fill: false },
                    { label: 'Confirmations', value: totalResidentConfirmed + totalCommercialConfirmed, icon: 'thumb_up', color: '#1d4ed8', bg: '#eff6ff', fill: true },
                ].map(m => (
                    <div key={m.label} className="card" style={{ padding: '18px 20px' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                            <span className={m.fill ? 'msym-fill' : 'msym'} style={{ color: m.color, fontSize: 17 }}>{m.icon}</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 26, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Section tabs ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 99, marginBottom: 24, overflowX: 'auto' }} className="a3">
                {SECTIONS.map(s => (
                    <button key={s.key} onClick={() => setActiveSection(s.key)} className={`section-btn ${activeSection === s.key ? 'on' : 'off'}`}>
                        <span className="msym" style={{ fontSize: 15 }}>{s.icon}</span>{s.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                </div>
            ) : (
                <div className="a4">

                    {/* ══ OVERVIEW ══ */}
                    {activeSection === 'overview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                            {/* 2×2 chart grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                                {/* Chart 1 — Collections (bar) */}
                                <div className="chart-card">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <div>
                                            <p className="chart-label">Collections</p>
                                            <p className="chart-sub">Completed stops per day</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p className="chart-stat" style={{ color: '#00450d' }}>{totalCompleted}</p>
                                            <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>total completed</span>
                                        </div>
                                    </div>
                                    {timeSeriesData.length === 0 ? <ChartEmpty message="No collection data" /> : (
                                        <ResponsiveContainer width="100%" height={180}>
                                            <BarChart data={timeSeriesData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,69,13,0.06)" vertical={false} />
                                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,69,13,0.04)' }} />
                                                <Bar dataKey="completed" name="Completed" fill="#00450d" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

                                {/* Chart 2 — Confirmations (line, resident vs commercial) */}
                                <div className="chart-card">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <div>
                                            <p className="chart-label">Confirmations</p>
                                            <p className="chart-sub">Residents vs commercial entities</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p className="chart-stat" style={{ color: '#1d4ed8' }}>{totalResidentConfirmed + totalCommercialConfirmed}</p>
                                            <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>total confirmed</span>
                                        </div>
                                    </div>
                                    {timeSeriesData.length === 0 ? <ChartEmpty message="No confirmation data" /> : (
                                        <ResponsiveContainer width="100%" height={180}>
                                            <LineChart data={timeSeriesData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,69,13,0.06)" />
                                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={tooltipStyle} />
                                                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Manrope,sans-serif' }} />
                                                <Line type="monotone" dataKey="resident" name="Resident" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 4, fill: '#1d4ed8' }} />
                                                <Line type="monotone" dataKey="commercial" name="Commercial" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: '#7c3aed' }} strokeDasharray="5 3" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

                                {/* Chart 3 — Unable (bar) */}
                                <div className="chart-card">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <div>
                                            <p className="chart-label">Unable to hand over</p>
                                            <p className="chart-sub">Residents & commercial who couldn't hand over</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p className="chart-stat" style={{ color: '#d97706' }}>{totalUnable}</p>
                                            <span className="badge" style={{ background: '#fefce8', color: '#d97706' }}>total unable</span>
                                        </div>
                                    </div>
                                    {timeSeriesData.length === 0 ? <ChartEmpty message="No data" /> : (
                                        <ResponsiveContainer width="100%" height={180}>
                                            <BarChart data={timeSeriesData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(217,119,6,0.04)' }} />
                                                <Bar dataKey="unable" name="Unable" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

                                {/* Chart 4 — Skips (stacked bar by reason) */}
                                <div className="chart-card">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <div>
                                            <p className="chart-label">Skipped stops</p>
                                            <p className="chart-sub">By skip reason per day</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p className="chart-stat" style={{ color: '#ba1a1a' }}>{totalSkipped}</p>
                                            <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>total skipped</span>
                                        </div>
                                    </div>
                                    {timeSeriesData.length === 0 ? <ChartEmpty message="No skips recorded" /> : (
                                        <ResponsiveContainer width="100%" height={180}>
                                            <BarChart data={timeSeriesData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(186,26,26,0.04)' }} />
                                                <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'Manrope,sans-serif' }} />
                                                <Bar dataKey="no_waste_out" name="No waste out" stackId="a" fill="#1d4ed8" maxBarSize={32} />
                                                <Bar dataKey="access_denied" name="Access denied" stackId="a" fill="#ba1a1a" maxBarSize={32} />
                                                <Bar dataKey="wrong_waste_type" name="Wrong type" stackId="a" fill="#7c3aed" maxBarSize={32} />
                                                <Bar dataKey="vehicle_breakdown" name="Breakdown" stackId="a" fill="#d97706" maxBarSize={32} />
                                                <Bar dataKey="skip_other" name="Other" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Waste distribution + most skipped streets */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="chart-card">
                                    <p className="chart-label">Waste type distribution</p>
                                    <p className="chart-sub">Stops by waste type</p>
                                    {wasteDistribution.length === 0 ? <ChartEmpty message="No data" /> : (
                                        <ResponsiveContainer width="100%" height={200}>
                                            <PieChart>
                                                <Pie data={wasteDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                                                    {wasteDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                                </Pie>
                                                <Tooltip contentStyle={tooltipStyle} />
                                                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Manrope,sans-serif' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

                                <div className="chart-card">
                                    <p className="chart-label">Most skipped streets</p>
                                    <p className="chart-sub">Streets with recurring missed collections</p>
                                    {skippedStreets.length === 0 ? <ChartEmpty message="No skipped streets" /> : (
                                        <ResponsiveContainer width="100%" height={200}>
                                            <BarChart data={skippedStreets} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
                                                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <YAxis type="category" dataKey="street" tick={{ fontSize: 10, fill: '#374151', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} width={110} />
                                                <Tooltip contentStyle={tooltipStyle} />
                                                <Bar dataKey="count" name="Skips" radius={[0, 4, 4, 0]}>
                                                    {skippedStreets.map((_, i) => <Cell key={i} fill={i === 0 ? '#ba1a1a' : i === 1 ? '#d97706' : '#94a3b8'} />)}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══ BY SCHEDULE ══ */}
                    {activeSection === 'schedules' && (
                        <div className="card">
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', margin: 0 }}>Schedule breakdown</h3>
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>{filtered.length} schedules</span>
                            </div>
                            {filtered.length === 0 ? (
                                <div style={{ padding: '60px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No schedules found</div>
                            ) : filtered.map(a => {
                                const isExpanded = expandedSchedule === a.schedule.id
                                const wards = a.schedule.wards?.length > 0 ? a.schedule.wards : a.schedule.ward ? [a.schedule.ward] : []
                                const pColor = a.completionRate >= 80 ? '#00450d' : a.completionRate >= 50 ? '#d97706' : '#ba1a1a'
                                return (
                                    <div key={a.schedule.id}>
                                        <div className="sched-row" onClick={() => setExpandedSchedule(isExpanded ? null : a.schedule.id)}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                <div style={{ width: 48, flexShrink: 0, textAlign: 'center' }}>
                                                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>
                                                        {new Date(a.schedule.scheduled_date).toLocaleDateString('en-GB', { month: 'short' })}
                                                    </p>
                                                    <p style={{ fontSize: 22, fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1.1, margin: 0 }}>
                                                        {new Date(a.schedule.scheduled_date).getDate()}
                                                    </p>
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', textTransform: 'capitalize' }}>{getWasteLabel(a.schedule)}</span>
                                                        {wards.length > 0 && <span className="badge" style={{ background: 'rgba(0,69,13,0.07)', color: '#00450d' }}>{wards.join(', ')}</span>}
                                                        {a.schedule.collection_day && <span style={{ fontSize: 12, color: '#94a3b8' }}>{a.schedule.collection_day} · {a.schedule.collection_time}</span>}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                                        <div style={{ width: 100 }}>
                                                            <div className="progress-track">
                                                                <div className="progress-fill" style={{ width: `${a.completionRate}%`, background: pColor }} />
                                                            </div>
                                                        </div>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: pColor, fontFamily: 'Manrope,sans-serif' }}>{a.completionRate}%</span>
                                                        <span className="chip" style={{ background: '#f0fdf4', color: '#00450d' }}>✓ {a.completedStops}</span>
                                                        <span className="chip" style={{ background: '#fef2f2', color: '#ba1a1a' }}>✗ {a.skippedStops}</span>
                                                        {a.confirmations.resident + a.confirmations.commercial > 0 && (
                                                            <span className="chip" style={{ background: '#eff6ff', color: '#1d4ed8' }}>👍 {a.confirmations.resident + a.confirmations.commercial}</span>
                                                        )}
                                                        {a.confirmations.unable > 0 && (
                                                            <span className="chip" style={{ background: '#fefce8', color: '#d97706' }}>⚠ {a.confirmations.unable} unable</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="msym" style={{ fontSize: 20, color: '#94a3b8', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="slide-down" style={{ background: '#f9fdf9', borderBottom: '1px solid rgba(0,69,13,0.05)', padding: '14px 20px' }}>
                                                {a.routes.length === 0 ? (
                                                    <p style={{ fontSize: 13, color: '#94a3b8' }}>No routes linked to this schedule.</p>
                                                ) : a.routes.map(route => (
                                                    <div key={route.id} style={{ marginBottom: 14 }}>
                                                        <p style={{ fontSize: 12, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span className="msym" style={{ fontSize: 14 }}>route</span>
                                                            {route.route_name}
                                                            {route.ward && <span style={{ fontWeight: 400, color: '#717a6d' }}>· {route.ward}</span>}
                                                        </p>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                            {route.stops.map(stop => (
                                                                <div key={stop.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, background: stop.status === 'completed' ? 'rgba(0,69,13,0.04)' : stop.status === 'skipped' ? 'rgba(186,26,26,0.04)' : 'white', border: `1px solid ${stop.status === 'completed' ? 'rgba(0,69,13,0.08)' : stop.status === 'skipped' ? 'rgba(186,26,26,0.08)' : '#f1f5f9'}` }}>
                                                                    <span className="msym-fill" style={{ fontSize: 15, color: stop.status === 'completed' ? '#00450d' : stop.status === 'skipped' ? '#ba1a1a' : '#94a3b8', flexShrink: 0 }}>
                                                                        {stop.status === 'completed' ? 'check_circle' : stop.status === 'skipped' ? 'cancel' : 'radio_button_unchecked'}
                                                                    </span>
                                                                    <span style={{ fontSize: 12, color: '#181c22', flex: 1 }}>{stop.road_name || stop.address}</span>
                                                                    {stop.is_commercial && <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Commercial</span>}
                                                                    {stop.skip_reason && <span style={{ fontSize: 11, color: '#ba1a1a', fontStyle: 'italic' }}>{SKIP_REASONS[stop.skip_reason]?.label || stop.skip_reason}</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* ══ SKIP ANALYSIS ══ */}
                    {activeSection === 'skips' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div className="chart-card">
                                <p className="chart-label">Skip reasons breakdown</p>
                                <p className="chart-sub">Total skips by reason across all schedules</p>
                                {skipData.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: 13 }}>
                                        <span className="msym" style={{ fontSize: 32, display: 'block', marginBottom: 10 }}>check_circle</span>
                                        No skips recorded in this period
                                    </div>
                                ) : (
                                    <>
                                        <ResponsiveContainer width="100%" height={260}>
                                            <BarChart data={skipData} margin={{ top: 4, right: 16, bottom: 4, left: -10 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                                                <XAxis dataKey="reason" tick={{ fontSize: 11, fill: '#374151', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={tooltipStyle} />
                                                <Bar dataKey="count" name="Skips" radius={[6, 6, 0, 0]}>
                                                    {skipData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                                            {skipData.map(item => {
                                                const pct = totalSkipped > 0 ? Math.round((item.count / totalSkipped) * 100) : 0
                                                return (
                                                    <div key={item.reason}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{item.reason}</span>
                                                            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>{item.count} ({pct}%)</span>
                                                        </div>
                                                        <div className="progress-track">
                                                            <div className="progress-fill" style={{ width: `${pct}%`, background: item.color }} />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="card">
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', margin: '0 0 3px' }}>Streets with most skips</h3>
                                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Consider adjusting routes for recurring problem streets</p>
                                </div>
                                {skippedStreets.length === 0 ? (
                                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No skipped streets</div>
                                ) : skippedStreets.map((item, i) => (
                                    <div key={item.street} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(0,69,13,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#fef2f2' : i === 1 ? '#fefce8' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? '#ba1a1a' : i === 1 ? '#d97706' : '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>{i + 1}</span>
                                        </div>
                                        <span style={{ flex: 1, fontSize: 13, color: '#181c22', fontWeight: 500 }}>{item.street}</span>
                                        <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>{item.count} skip{item.count !== 1 ? 's' : ''}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ══ CONFIRMATIONS ══ */}
                    {activeSection === 'confirmations' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Summary cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                                {[
                                    { label: 'Resident confirmations', value: totalResidentConfirmed, icon: 'home', color: '#00450d', bg: '#f0fdf4' },
                                    { label: 'Commercial confirmations', value: totalCommercialConfirmed, icon: 'business', color: '#1d4ed8', bg: '#eff6ff' },
                                    { label: 'Unable to hand over', value: totalUnable, icon: 'cancel', color: '#ba1a1a', bg: '#fef2f2' },
                                ].map(m => (
                                    <div key={m.label} className="card" style={{ padding: '20px 22px' }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                            <span className="msym-fill" style={{ color: m.color, fontSize: 18 }}>{m.icon}</span>
                                        </div>
                                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 28, color: '#181c22', margin: '0 0 3px', lineHeight: 1 }}>{m.value}</p>
                                        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{m.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Separate line charts for resident and commercial */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="chart-card">
                                    <p className="chart-label">Resident confirmations</p>
                                    <p className="chart-sub">Residents who confirmed waste handover over time</p>
                                    <p className="chart-stat" style={{ color: '#00450d' }}>{totalResidentConfirmed}</p>
                                    {timeSeriesData.length === 0 ? <ChartEmpty message="No data" /> : (
                                        <ResponsiveContainer width="100%" height={160}>
                                            <LineChart data={timeSeriesData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,69,13,0.06)" />
                                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={tooltipStyle} />
                                                <Line type="monotone" dataKey="resident" name="Residents" stroke="#00450d" strokeWidth={2.5} dot={{ r: 4, fill: '#00450d' }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

                                <div className="chart-card">
                                    <p className="chart-label">Commercial confirmations</p>
                                    <p className="chart-sub">Commercial entities who confirmed waste handover</p>
                                    <p className="chart-stat" style={{ color: '#7c3aed' }}>{totalCommercialConfirmed}</p>
                                    {timeSeriesData.length === 0 ? <ChartEmpty message="No data" /> : (
                                        <ResponsiveContainer width="100%" height={160}>
                                            <LineChart data={timeSeriesData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.06)" />
                                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={tooltipStyle} />
                                                <Line type="monotone" dataKey="commercial" name="Commercial" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: '#7c3aed' }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

                                <div className="chart-card">
                                    <p className="chart-label">Unable to hand over</p>
                                    <p className="chart-sub">Who indicated they couldn't hand over waste</p>
                                    <p className="chart-stat" style={{ color: '#d97706' }}>{totalUnable}</p>
                                    {timeSeriesData.length === 0 ? <ChartEmpty message="No data" /> : (
                                        <ResponsiveContainer width="100%" height={160}>
                                            <BarChart data={timeSeriesData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(217,119,6,0.04)' }} />
                                                <Bar dataKey="unable" name="Unable" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

                                <div className="chart-card">
                                    <p className="chart-label">Confirmed vs collected</p>
                                    <p className="chart-sub">Comparison of confirmations against actual completions</p>
                                    <p className="chart-stat" style={{ color: '#374151' }}>{totalResidentConfirmed + totalCommercialConfirmed} / {totalCompleted}</p>
                                    {timeSeriesData.length === 0 ? <ChartEmpty message="No data" /> : (
                                        <ResponsiveContainer width="100%" height={160}>
                                            <LineChart data={timeSeriesData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Manrope,sans-serif' }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={tooltipStyle} />
                                                <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'Manrope,sans-serif' }} />
                                                <Line type="monotone" dataKey="resident" name="Confirmed (R)" stroke="#1d4ed8" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                                                <Line type="monotone" dataKey="commercial" name="Confirmed (C)" stroke="#7c3aed" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                                                <Line type="monotone" dataKey="completed" name="Collected" stroke="#00450d" strokeWidth={2.5} dot={{ r: 3, fill: '#00450d' }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Per-schedule detail */}
                            <div className="card">
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', margin: 0 }}>Per schedule detail</h3>
                                </div>
                                {filtered.filter(a => a.confirmations.resident + a.confirmations.commercial + a.confirmations.unable > 0).length === 0 ? (
                                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No confirmations in this period</div>
                                ) : filtered.filter(a => a.confirmations.resident + a.confirmations.commercial + a.confirmations.unable > 0).map(a => {
                                    const wards = a.schedule.wards?.length > 0 ? a.schedule.wards : a.schedule.ward ? [a.schedule.ward] : []
                                    return (
                                        <div key={a.schedule.id} style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,69,13,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
                                            <div style={{ width: 44, flexShrink: 0, textAlign: 'center' }}>
                                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>
                                                    {new Date(a.schedule.scheduled_date).toLocaleDateString('en-GB', { month: 'short' })}
                                                </p>
                                                <p style={{ fontSize: 20, fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1.1, margin: 0 }}>
                                                    {new Date(a.schedule.scheduled_date).getDate()}
                                                </p>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', textTransform: 'capitalize' }}>{getWasteLabel(a.schedule)}</span>
                                                    {wards.length > 0 && <span style={{ fontSize: 11, color: '#717a6d' }}>· {wards.join(', ')}</span>}
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    <span className="chip" style={{ background: '#f0fdf4', color: '#00450d' }}>🏠 {a.confirmations.resident} resident</span>
                                                    <span className="chip" style={{ background: '#eff6ff', color: '#1d4ed8' }}>🏢 {a.confirmations.commercial} commercial</span>
                                                    {a.confirmations.unable > 0 && <span className="chip" style={{ background: '#fef2f2', color: '#ba1a1a' }}>✗ {a.confirmations.unable} unable</span>}
                                                    <span className="chip" style={{ background: '#f0fdf4', color: '#00450d' }}>✓ {a.completedStops} collected</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </DashboardLayout>
    )
}