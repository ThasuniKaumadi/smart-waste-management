'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const SUPERVISOR_NAV = [
    { label: 'Overview', href: '/dashboard/supervisor', icon: 'dashboard', section: 'Menu' },
    { label: 'Schedules', href: '/dashboard/supervisor/schedules', icon: 'calendar_month', section: 'Menu' },
    { label: 'Routes', href: '/dashboard/supervisor/routes', icon: 'route', section: 'Menu' },
    { label: 'Drivers', href: '/dashboard/supervisor/drivers', icon: 'people', section: 'Menu' },
    { label: 'Track Route', href: '/dashboard/supervisor/track-route', icon: 'gps_fixed', section: 'Menu' },
    { label: 'Alerts', href: '/dashboard/supervisor/alerts', icon: 'notifications_active', section: 'Menu' },
    { label: 'Complaints', href: '/dashboard/supervisor/complaints', icon: 'feedback', section: 'Menu' },
    { label: 'Compliance', href: '/dashboard/supervisor/schedule-compliance', icon: 'fact_check', section: 'Menu' },
    { label: 'Waste Reports', href: '/dashboard/supervisor/waste-reports', icon: 'report', section: 'Menu' },
    { label: 'Ward Heatmap', href: '/dashboard/supervisor/heatmap', icon: 'map', section: 'Menu' },
    { label: 'Shift Report', href: '/dashboard/supervisor/shift-report', icon: 'picture_as_pdf', section: 'Menu' },
    { label: 'Announcements', href: '/dashboard/supervisor/announcements', icon: 'campaign', section: 'Menu' },
]

const WASTE_STYLES: Record<string, { label: string; color: string; bg: string; icon: string; dot: string }> = {
    organic: { label: 'Organic', color: '#00450d', bg: '#f0fdf4', icon: 'compost', dot: '#16a34a' },
    non_recyclable: { label: 'Non-Recyclable', color: '#dc2626', bg: '#fef2f2', icon: 'delete', dot: '#ef4444' },
    recyclable: { label: 'Recyclable', color: '#1d4ed8', bg: '#eff6ff', icon: 'recycling', dot: '#3b82f6' },
    e_waste: { label: 'E-Waste', color: '#7c3aed', bg: '#faf5ff', icon: 'computer', dot: '#a855f7' },
    bulk: { label: 'Bulk Waste', color: '#d97706', bg: '#fffbeb', icon: 'inventory_2', dot: '#f59e0b' },
    other: { label: 'Other', color: '#64748b', bg: '#f8fafc', icon: 'category', dot: '#94a3b8' },
}
const FREQUENCIES: Record<string, string> = {
    daily: 'Daily', twice_weekly: '2× week', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly',
}

interface Schedule {
    id: string; waste_type: string; custom_waste_type: string | null
    collection_day: string; collection_time: string; frequency: string | null
    scheduled_date: string; wards: string[]; ward: string | null
    streets: Record<string, string[]> | null; status: string
    cancellation_note: string | null; notes: string | null
}
interface Route {
    id: string; route_name: string; ward: string; shift: string; status: string
    driver_id: string | null; vehicle_number: string | null; driver_name: string | null
}

function getWasteStyle(type: string, custom?: string | null) {
    const base = WASTE_STYLES[type] || WASTE_STYLES.other
    if (type === 'other' && custom) return { ...base, label: custom }
    return base
}

export default function SupervisorSchedulesPage() {
    const [profile, setProfile] = useState<any>(null)
    const [schedules, setSchedules] = useState<Schedule[]>([])
    const [routes, setRoutes] = useState<Record<string, Route[]>>({})
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'cancelled'>('all')
    const [assignedWards, setAssignedWards] = useState<string[]>([])

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const wards: string[] = p?.assigned_wards || []
        setAssignedWards(wards)
        const today = new Date().toISOString().split('T')[0]
        const { data: schedData } = await supabase.from('schedules').select('*')
            .eq('district', p?.district || '').in('status', ['published', 'cancelled'])
            .gte('scheduled_date', today).order('scheduled_date', { ascending: true })
        let filtered = schedData || []
        if (wards.length > 0) {
            filtered = filtered.filter((s: Schedule) => {
                const schedWards = s.wards?.length > 0 ? s.wards : s.ward ? [s.ward] : []
                if (schedWards.length === 0) return true
                return schedWards.some((w: string) => wards.includes(w))
            })
        }
        setSchedules(filtered)
        if (filtered.length > 0) {
            const ids = filtered.map((s: any) => s.id)
            const { data: routesData } = await supabase.from('routes')
                .select(`id, route_name, ward, shift, status, schedule_id, driver_id, vehicle_number, driver:profiles!driver_id(full_name)`)
                .in('schedule_id', ids)
            const bySchedule: Record<string, Route[]> = {}
                ; (routesData || []).forEach((r: any) => {
                    if (!bySchedule[r.schedule_id]) bySchedule[r.schedule_id] = []
                    bySchedule[r.schedule_id].push({ id: r.id, route_name: r.route_name, ward: r.ward, shift: r.shift, status: r.status, driver_id: r.driver_id, vehicle_number: r.vehicle_number, driver_name: r.driver?.full_name || null })
                })
            setRoutes(bySchedule)
        }
        setLoading(false)
    }

    const displayed = schedules.filter(s => {
        if (filterStatus === 'published') return s.status === 'published'
        if (filterStatus === 'cancelled') return s.status === 'cancelled'
        return true
    })
    const publishedCount = schedules.filter(s => s.status === 'published').length
    const cancelledCount = schedules.filter(s => s.status === 'cancelled').length

    return (
        <DashboardLayout role="Supervisor" userName={profile?.full_name || ''} navItems={SUPERVISOR_NAV}>
            <style>{`
        .msf      { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msf-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:16px; box-shadow:0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.04); border:1px solid rgba(0,69,13,0.06); overflow:hidden; }
        .sched-row { padding:16px 20px; border-bottom:1px solid rgba(0,69,13,0.05); cursor:pointer; transition:background 0.15s; }
        .sched-row:hover { background:#f9fdf9; }
        .sched-row:last-child { border-bottom:none; }
        .sched-row.cancelled { background:rgba(186,26,26,0.02); }
        .pill-btn { padding:6px 16px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .pill-btn.on { background:#00450d; color:white; }
        .pill-btn.off { background:#f1f5f9; color:#64748b; }
        .pill-btn.off:hover { background:#e2e8f0; }
        .badge { display:inline-flex; align-items:center; gap:3px; padding:3px 9px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .street-chip { display:inline-flex; align-items:center; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:600; font-family:'Manrope',sans-serif; background:rgba(0,69,13,0.07); color:#00450d; }
        .route-row { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:10px; background:#f9fdf9; margin-bottom:6px; border:1px solid rgba(0,69,13,0.07); }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both} .a3{animation:fadeUp .4s ease .14s both}
        .slide-down { animation:slideDown .2s ease both; }
      `}</style>

            {/* Header */}
            <section style={{ marginBottom: '24px' }} className="a1">
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 8px' }}>
                    Supervisor · Schedule View
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: '46px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 6px' }}>
                            Collection <span style={{ color: '#1b5e20' }}>Schedules</span>
                        </h1>
                        <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>
                            {profile?.district}
                            {assignedWards.length > 0 && <> · <span style={{ color: '#00450d', fontWeight: 600 }}>{assignedWards.join(', ')}</span></>}
                        </p>
                    </div>
                    {assignedWards.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 12, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.12)' }}>
                            <span className="msf-fill" style={{ color: '#00450d', fontSize: 16 }}>location_on</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>
                                {assignedWards.length} ward{assignedWards.length !== 1 ? 's' : ''} assigned
                            </span>
                        </div>
                    )}
                </div>
            </section>

            {/* Stats */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Upcoming', value: schedules.length, icon: 'calendar_month', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Published', value: publishedCount, icon: 'check_circle', color: '#1b5e20', bg: '#f0fdf4' },
                    { label: 'Cancelled', value: cancelledCount, icon: 'cancel', color: '#ba1a1a', bg: '#fef2f2' },
                ].map(m => (
                    <div key={m.label} className="card" style={{ padding: '18px 20px' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                            <span className="msf-fill" style={{ color: m.color, fontSize: 17 }}>{m.icon}</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 26, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {assignedWards.length === 0 && (
                <div className="a2" style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, background: '#fefce8', border: '1px solid rgba(217,119,6,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="msf" style={{ color: '#d97706', fontSize: 16 }}>info</span>
                    <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>No wards assigned to your profile — showing all district schedules. Contact your District Engineer to assign wards.</p>
                </div>
            )}

            {/* Filters */}
            <div className="a2" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {([
                    { key: 'all', label: 'All' },
                    { key: 'published', label: '✓ Published' },
                    { key: 'cancelled', label: '✕ Cancelled' },
                ] as const).map(f => (
                    <button key={f.key} onClick={() => setFilterStatus(f.key)} className={`pill-btn ${filterStatus === f.key ? 'on' : 'off'}`}>{f.label}</button>
                ))}
            </div>

            {/* Schedule list */}
            <div className="a3">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                        <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                    </div>
                ) : displayed.length === 0 ? (
                    <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
                        <span className="msf" style={{ fontSize: 36, color: '#d1d5db', display: 'block', marginBottom: 12 }}>event_busy</span>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', marginBottom: 6 }}>No schedules found</p>
                        <p style={{ fontSize: 13, color: '#94a3b8' }}>
                            {assignedWards.length > 0 ? `No upcoming schedules for ${assignedWards.join(', ')}` : 'No upcoming schedules in your district'}
                        </p>
                    </div>
                ) : (
                    <div className="card">
                        {displayed.map(schedule => {
                            const ws = getWasteStyle(schedule.waste_type, schedule.custom_waste_type)
                            const schedWards = schedule.wards?.length > 0 ? schedule.wards : schedule.ward ? [schedule.ward] : []
                            const cancelled = schedule.status === 'cancelled'
                            const isExpanded = expandedId === schedule.id
                            const schedRoutes = routes[schedule.id] || []
                            const relevantStreets: string[] = []
                            if (schedule.streets) {
                                const wardsToShow = assignedWards.length > 0
                                    ? Object.entries(schedule.streets).filter(([w]) => assignedWards.includes(w))
                                    : Object.entries(schedule.streets)
                                wardsToShow.forEach(([, streets]) => relevantStreets.push(...streets))
                            }
                            return (
                                <div key={schedule.id}>
                                    <div className={`sched-row ${cancelled ? 'cancelled' : ''}`} onClick={() => setExpandedId(isExpanded ? null : schedule.id)}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 12, background: cancelled ? '#fef2f2' : ws.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span className="msf-fill" style={{ fontSize: 20, color: cancelled ? '#ba1a1a' : ws.color }}>{cancelled ? 'cancel' : ws.icon}</span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: cancelled ? '#94a3b8' : '#181c22', fontFamily: 'Manrope,sans-serif', textDecoration: cancelled ? 'line-through' : 'none', textTransform: 'capitalize' }}>{ws.label}</span>
                                                    {cancelled
                                                        ? <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}><span className="msf-fill" style={{ fontSize: 11 }}>cancel</span>Cancelled</span>
                                                        : <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}><span className="msf-fill" style={{ fontSize: 11 }}>check_circle</span>Published</span>}
                                                    {schedRoutes.length > 0 && (
                                                        <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                                                            <span className="msf" style={{ fontSize: 11 }}>route</span>{schedRoutes.length} route{schedRoutes.length !== 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 12, color: '#717a6d' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <span className="msf" style={{ fontSize: 13 }}>event</span>
                                                        {new Date(schedule.scheduled_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <span className="msf" style={{ fontSize: 13 }}>schedule</span>{schedule.collection_day} · {schedule.collection_time}
                                                    </span>
                                                    {schedWards.length > 0 && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <span className="msf" style={{ fontSize: 13 }}>location_on</span>{schedWards.join(', ')}
                                                        </span>
                                                    )}
                                                    {schedule.frequency && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <span className="msf" style={{ fontSize: 13 }}>repeat</span>{FREQUENCIES[schedule.frequency] || schedule.frequency}
                                                        </span>
                                                    )}
                                                </div>
                                                {relevantStreets.length > 0 && !cancelled && (
                                                    <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                        {relevantStreets.map(street => <span key={street} className="street-chip">{street}</span>)}
                                                    </div>
                                                )}
                                                {cancelled && schedule.cancellation_note && (
                                                    <div style={{ marginTop: 7, padding: '6px 10px', borderRadius: 8, background: '#fef2f2', border: '1px solid rgba(186,26,26,0.1)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                                        <span className="msf" style={{ fontSize: 12, color: '#ba1a1a', flexShrink: 0, marginTop: 1 }}>info</span>
                                                        <p style={{ fontSize: 11, color: '#ba1a1a', margin: 0, fontStyle: 'italic' }}>{schedule.cancellation_note}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="msf" style={{ fontSize: 20, color: '#94a3b8', flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="slide-down" style={{ padding: '12px 20px', background: '#f9fdf9', borderBottom: '1px solid rgba(0,69,13,0.05)' }}>
                                            {schedRoutes.length === 0 ? (
                                                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>No routes linked to this schedule yet.</p>
                                            ) : (
                                                <>
                                                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>Routes — assigned by contractor</p>
                                                    {schedRoutes.map(route => (
                                                        <div key={route.id} className="route-row">
                                                            <span className="msf" style={{ fontSize: 16, color: '#00450d', flexShrink: 0 }}>route</span>
                                                            <div style={{ flex: 1 }}>
                                                                <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>{route.route_name}</p>
                                                                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#94a3b8', flexWrap: 'wrap' }}>
                                                                    {route.ward && <span>📍 {route.ward}</span>}
                                                                    {route.shift && <span>{route.shift === 'night' ? '🌙' : '☀️'} {route.shift}</span>}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                                <span className="badge" style={{ background: route.driver_id ? '#f0fdf4' : '#fef2f2', color: route.driver_id ? '#00450d' : '#ba1a1a' }}>
                                                                    <span className="msf" style={{ fontSize: 11 }}>person</span>{route.driver_name || 'No driver'}
                                                                </span>
                                                                {route.vehicle_number && (
                                                                    <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>
                                                                        <span className="msf" style={{ fontSize: 11 }}>local_shipping</span>{route.vehicle_number}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
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