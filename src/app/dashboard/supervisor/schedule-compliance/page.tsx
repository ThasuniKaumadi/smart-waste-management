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

interface ComplianceRow {
    scheduleId: string
    scheduledDate: string
    wasteType: string
    collectionTime: string
    wards: string[]
    scheduled: number   // stops scheduled
    collected: number   // stops actually collected
    skipped: number
    compliancePct: number
    status: 'compliant' | 'partial' | 'missed' | 'upcoming'
}

const WASTE_COLOR: Record<string, { color: string; bg: string }> = {
    organic: { color: '#00450d', bg: '#f0fdf4' },
    recyclable: { color: '#1d4ed8', bg: '#eff6ff' },
    non_recyclable: { color: '#ba1a1a', bg: '#fef2f2' },
    e_waste: { color: '#7c3aed', bg: '#f5f3ff' },
    bulk: { color: '#d97706', bg: '#fefce8' },
}

export default function ScheduleCompliancePage() {
    const [profile, setProfile] = useState<any>(null)
    const [rows, setRows] = useState<ComplianceRow[]>([])
    const [loading, setLoading] = useState(true)
    const [weekOffset, setWeekOffset] = useState(0) // 0 = this week, -1 = last week, etc.
    const [filterStatus, setFilterStatus] = useState<'all' | 'compliant' | 'partial' | 'missed' | 'upcoming'>('all')

    useEffect(() => { loadData() }, [weekOffset])

    function getWeekRange(offset: number) {
        const now = new Date()
        const day = now.getDay()
        const monday = new Date(now)
        monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
        monday.setHours(0, 0, 0, 0)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        sunday.setHours(23, 59, 59, 999)
        return { start: monday, end: sunday }
    }

    async function loadData() {
        setLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const wards: string[] = p?.assigned_wards || []
        const { start, end } = getWeekRange(weekOffset)

        // Fetch schedules for this week
        let schedQuery = supabase
            .from('schedules')
            .select('*')
            .eq('district', p?.district || '')
            .eq('published', true)
            .gte('scheduled_date', start.toISOString().split('T')[0])
            .lte('scheduled_date', end.toISOString().split('T')[0])
            .order('scheduled_date', { ascending: true })

        if (wards.length > 0) schedQuery = schedQuery.overlaps('wards', wards)
        const { data: schedules } = await schedQuery

        // Fetch routes for this week (to get collection_stops)
        let routeQuery = supabase
            .from('routes')
            .select(`
        id, schedule_id, ward, date, status,
        collection_stops(id, status)
      `)
            .eq('district', p?.district || '')
            .gte('date', start.toISOString().split('T')[0])
            .lte('date', end.toISOString().split('T')[0])

        if (wards.length > 0) routeQuery = routeQuery.in('ward', wards)
        const { data: routes } = await routeQuery

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const complianceRows: ComplianceRow[] = (schedules || []).map((s: any) => {
            // Find routes linked to this schedule
            const linkedRoutes = (routes || []).filter((r: any) => r.schedule_id === s.id)

            const totalStops = linkedRoutes.reduce((sum: number, r: any) => sum + (r.collection_stops?.length || 0), 0)
            const collectedStops = linkedRoutes.reduce((sum: number, r: any) => sum + (r.collection_stops?.filter((c: any) => c.status === 'completed').length || 0), 0)
            const skippedStops = linkedRoutes.reduce((sum: number, r: any) => sum + (r.collection_stops?.filter((c: any) => c.status === 'skipped').length || 0), 0)

            const schedDate = new Date(s.scheduled_date)
            schedDate.setHours(0, 0, 0, 0)
            const isUpcoming = schedDate > today
            const isMissed = schedDate < today && totalStops === 0 && linkedRoutes.length === 0

            let status: ComplianceRow['status'] = 'upcoming'
            if (!isUpcoming) {
                if (totalStops === 0) status = 'missed'
                else if (collectedStops / totalStops >= 0.9) status = 'compliant'
                else if (collectedStops > 0) status = 'partial'
                else status = 'missed'
            }

            return {
                scheduleId: s.id,
                scheduledDate: s.scheduled_date,
                wasteType: s.waste_type || 'general',
                collectionTime: s.collection_time || '',
                wards: s.wards || (s.ward ? [s.ward] : []),
                scheduled: totalStops,
                collected: collectedStops,
                skipped: skippedStops,
                compliancePct: totalStops > 0 ? Math.round((collectedStops / totalStops) * 100) : isUpcoming ? -1 : 0,
                status,
            }
        })

        setRows(complianceRows)
        setLoading(false)
    }

    const filtered = rows.filter(r => filterStatus === 'all' || r.status === filterStatus)
    const { start, end } = getWeekRange(weekOffset)

    const compliantCount = rows.filter(r => r.status === 'compliant').length
    const partialCount = rows.filter(r => r.status === 'partial').length
    const missedCount = rows.filter(r => r.status === 'missed').length
    const upcomingCount = rows.filter(r => r.status === 'upcoming').length
    const overallPct = rows.filter(r => r.status !== 'upcoming').length > 0
        ? Math.round(rows.filter(r => r.status !== 'upcoming').reduce((s, r) => s + (r.compliancePct >= 0 ? r.compliancePct : 0), 0) / rows.filter(r => r.status !== 'upcoming').length)
        : null

    function statusConfig(status: ComplianceRow['status']) {
        switch (status) {
            case 'compliant': return { color: '#00450d', bg: '#f0fdf4', label: 'Compliant', icon: 'check_circle' }
            case 'partial': return { color: '#d97706', bg: '#fefce8', label: 'Partial', icon: 'warning' }
            case 'missed': return { color: '#dc2626', bg: '#fef2f2', label: 'Missed', icon: 'cancel' }
            case 'upcoming': return { color: '#6b7280', bg: '#f8fafc', label: 'Upcoming', icon: 'schedule' }
        }
    }

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
        .compliance-row { padding: 16px 24px; border-bottom: 1px solid rgba(0,69,13,0.04); transition: background 0.15s; }
        .compliance-row:hover { background: #f9fdf9; }
        .compliance-row:last-child { border-bottom: none; }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px; font-size: 10px; font-weight: 700; font-family: 'Manrope', sans-serif; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
        .progress-track { height: 5px; background: #f0fdf4; border-radius: 99px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 99px; transition: width 0.6s ease; }
        .week-btn { padding: 7px 14px; border-radius: 10px; border: 1.5px solid rgba(0,69,13,0.15); background: white; color: #00450d; font-size: 12px; font-weight: 700; font-family: 'Manrope', sans-serif; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px; }
        .week-btn:hover { background: #f0fdf4; }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.4s ease 0.05s both; }
        .s2 { animation: staggerIn 0.4s ease 0.10s both; }
        .s3 { animation: staggerIn 0.4s ease 0.15s both; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

            {/* Header */}
            <section className="s1" style={{ marginBottom: '32px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    Supervisor · Compliance Monitoring
                </span>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '46px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: 0 }}>
                        Schedule <span style={{ color: '#1b5e20' }}>Compliance</span>
                    </h1>
                    {/* Week navigator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button className="week-btn" onClick={() => setWeekOffset(w => w - 1)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_left</span>
                            Prev
                        </button>
                        <div style={{ padding: '7px 16px', borderRadius: '10px', background: weekOffset === 0 ? '#00450d' : '#f0fdf4', color: weekOffset === 0 ? 'white' : '#00450d', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', minWidth: '160px', textAlign: 'center' }}>
                            {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : weekOffset < 0 ? `${Math.abs(weekOffset)} weeks ago` : `${weekOffset} weeks ahead`}
                            <div style={{ fontSize: '10px', opacity: 0.75, marginTop: '1px' }}>
                                {start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </div>
                        </div>
                        <button className="week-btn" onClick={() => setWeekOffset(w => w + 1)}>
                            Next
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_right</span>
                        </button>
                        {weekOffset !== 0 && (
                            <button className="week-btn" onClick={() => setWeekOffset(0)}>Today</button>
                        )}
                    </div>
                </div>
                <p style={{ fontSize: '13px', color: '#717a6d', marginTop: '6px' }}>
                    {profile?.district} · Wards: {(profile?.assigned_wards || []).join(', ') || 'All'}
                </p>
            </section>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }} className="s2">
                {[
                    { label: 'Overall Rate', value: overallPct !== null ? `${overallPct}%` : '—', icon: 'percent', color: overallPct !== null && overallPct >= 80 ? '#00450d' : '#d97706', bg: '#f0fdf4' },
                    { label: 'Compliant', value: compliantCount, icon: 'check_circle', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Partial', value: partialCount, icon: 'warning', color: '#d97706', bg: '#fefce8' },
                    { label: 'Missed', value: missedCount, icon: 'cancel', color: missedCount > 0 ? '#dc2626' : '#00450d', bg: missedCount > 0 ? '#fef2f2' : '#f0fdf4' },
                    { label: 'Upcoming', value: upcomingCount, icon: 'schedule', color: '#6b7280', bg: '#f8fafc' },
                ].map(m => (
                    <div key={m.label} className="bento-card" style={{ padding: '18px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                            <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '17px' }}>{m.icon}</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '26px', color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                        <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Compliance table */}
            <div className="bento-card s3">
                {/* Toolbar */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>Scheduled Collections</h3>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{filtered.length} schedules</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(['all', 'compliant', 'partial', 'missed', 'upcoming'] as const).map(f => (
                            <button key={f} onClick={() => setFilterStatus(f)} className={`filter-btn ${filterStatus === f ? 'active' : ''}`}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Column headers */}
                <div style={{ padding: '8px 24px', borderBottom: '1px solid rgba(0,69,13,0.04)', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 120px 100px', gap: '8px', background: '#fafdfb' }}>
                    {['Schedule', 'Wards', 'Stops', 'Compliance', 'Progress', 'Status'].map(h => (
                        <p key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#717a6d', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{h}</p>
                    ))}
                </div>

                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
                        <div style={{ width: '28px', height: '28px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>calendar_month</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: '0 0 6px' }}>No schedules found</p>
                        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>No published schedules for this week in your wards.</p>
                    </div>
                ) : (
                    <div>
                        {filtered.map(row => {
                            const wc = WASTE_COLOR[row.wasteType] || { color: '#64748b', bg: '#f8fafc' }
                            const sc = statusConfig(row.status)
                            const pColor = row.compliancePct >= 90 ? '#00450d' : row.compliancePct >= 60 ? '#d97706' : '#dc2626'
                            return (
                                <div key={row.scheduleId} className="compliance-row">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 120px 100px', gap: '8px', alignItems: 'center' }}>

                                        {/* Schedule info */}
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                                <span className="badge" style={{ background: wc.bg, color: wc.color }}>
                                                    {row.wasteType.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: '0 0 2px', fontFamily: 'Manrope, sans-serif' }}>
                                                {new Date(row.scheduledDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                                            </p>
                                            {row.collectionTime && (
                                                <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>schedule</span>
                                                    {row.collectionTime}
                                                </p>
                                            )}
                                        </div>

                                        {/* Wards */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {row.wards.slice(0, 2).map(w => (
                                                <span key={w} style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '99px', background: 'rgba(0,69,13,0.07)', color: '#00450d' }}>{w}</span>
                                            ))}
                                            {row.wards.length > 2 && (
                                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>+{row.wards.length - 2}</span>
                                            )}
                                        </div>

                                        {/* Stops */}
                                        <div>
                                            {row.status === 'upcoming' ? (
                                                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>—</p>
                                            ) : (
                                                <>
                                                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22', margin: '0 0 2px', fontFamily: 'Manrope, sans-serif' }}>
                                                        {row.collected}/{row.scheduled}
                                                    </p>
                                                    {row.skipped > 0 && (
                                                        <p style={{ fontSize: '10px', color: '#dc2626', margin: 0 }}>{row.skipped} skipped</p>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Compliance % */}
                                        <div>
                                            {row.status === 'upcoming' ? (
                                                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Scheduled</p>
                                            ) : row.scheduled === 0 ? (
                                                <p style={{ fontSize: '12px', color: '#dc2626', margin: 0 }}>No routes</p>
                                            ) : (
                                                <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: pColor, margin: 0, lineHeight: 1 }}>
                                                    {row.compliancePct}%
                                                </p>
                                            )}
                                        </div>

                                        {/* Progress bar */}
                                        <div>
                                            {row.status !== 'upcoming' && row.scheduled > 0 ? (
                                                <div className="progress-track">
                                                    <div className="progress-fill" style={{ width: `${row.compliancePct}%`, background: pColor }} />
                                                </div>
                                            ) : (
                                                <div className="progress-track">
                                                    <div style={{ height: '100%', background: '#e2e8f0', borderRadius: '99px', width: '100%' }} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Status badge */}
                                        <div>
                                            <span className="badge" style={{ background: sc.bg, color: sc.color }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>{sc.icon}</span>
                                                {sc.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9fdf9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '15px' }}>info</span>
                    <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>
                        Compliant = ≥90% stops collected. Partial = at least 1 stop collected. Missed = routes existed but no collections recorded.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    )
}