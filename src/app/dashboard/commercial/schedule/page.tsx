'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const COMMERCIAL_NAV = [
    { label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' },
    { label: 'Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_month' },
    { label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' },
    { label: 'Bins', href: '/dashboard/commercial/bins', icon: 'delete' },
    { label: 'Collection History', href: '/dashboard/commercial/collection-history', icon: 'history' },
    { label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' },
    { label: 'Complaints', href: '/dashboard/commercial/complaints', icon: 'feedback' },
    { label: 'Rate Service', href: '/dashboard/commercial/feedback', icon: 'star' },
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const WASTE_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    organic: { bg: '#f0fdf4', text: '#00450d', border: '#bbf7d0', icon: 'compost' },
    recyclable: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', icon: 'recycling' },
    plastics: { bg: '#faf5ff', text: '#7c3aed', border: '#ddd6fe', icon: 'local_drink' },
    glass: { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc', icon: 'liquor' },
    'non-recyclable': { bg: '#fefce8', text: '#92400e', border: '#fde68a', icon: 'delete' },
    general: { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', icon: 'delete_sweep' },
}

function wasteStyle(type: string | null) {
    if (!type) return WASTE_COLORS.general
    const key = type.toLowerCase().replace(/\s+/g, '-')
    return WASTE_COLORS[key] || WASTE_COLORS.general
}

function wasteLabel(type: string | null) {
    if (!type) return 'General'
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
}

function formatTime(timeStr: string | null) {
    if (!timeStr) return '—'
    const [h, m] = timeStr.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getDayOfWeekFromString(day: string | null) {
    if (!day) return -1
    return DAYS.findIndex(d => d.toLowerCase() === day.toLowerCase())
}

function getNextOccurrence(dayOfWeek: number): Date {
    const today = new Date()
    const todayDow = today.getDay()
    let diff = dayOfWeek - todayDow
    if (diff <= 0) diff += 7
    const next = new Date(today)
    next.setDate(today.getDate() + diff)
    return next
}

function daysUntil(date: Date): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function CommercialSchedulePage() {
    const [profile, setProfile] = useState<any>(null)
    const [schedules, setSchedules] = useState<any[]>([])
    const [routeSchedules, setRouteSchedules] = useState<any[]>([])
    const [myStops, setMyStops] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoadError('Not signed in'); setLoading(false); return }

            const { data: p } = await supabase
                .from('profiles').select('*').eq('id', user.id).single()
            setProfile(p)

            if (!p) { setLoading(false); return }

            const [schedulesRes, routeSchedulesRes, stopsRes] = await Promise.all([
                supabase
                    .from('schedules')
                    .select('*')
                    .eq('district', p.district)
                    .eq('published', true)
                    .order('scheduled_date', { ascending: true }),
                supabase
                    .from('route_schedules')
                    .select('*')
                    .eq('ward', p.ward)
                    .eq('status', 'active')
                    .order('day_of_week', { ascending: true }),
                supabase
                    .from('collection_stops')
                    .select('*')
                    .eq('commercial_id', user.id)
                    .eq('is_commercial', true)
                    .order('stop_order', { ascending: true }),
            ])

            if (schedulesRes.error) console.error('Schedules error:', schedulesRes.error)
            if (routeSchedulesRes.error) console.error('Route schedules error:', routeSchedulesRes.error)
            if (stopsRes.error) console.error('Stops error:', stopsRes.error)

            setSchedules(schedulesRes.data ?? [])
            setRouteSchedules(routeSchedulesRes.data ?? [])
            setMyStops(stopsRes.data ?? [])
        } catch (err: any) {
            setLoadError(err?.message || 'Failed to load schedule')
        } finally {
            setLoading(false)
        }
    }

    // Build upcoming collections for next 7 days from route_schedules
    const today = new Date()
    const upcomingByDay: Record<number, any[]> = {}
    routeSchedules.forEach(rs => {
        const dow = getDayOfWeekFromString(rs.day_of_week)
        if (dow === -1) return
        if (!upcomingByDay[dow]) upcomingByDay[dow] = []
        upcomingByDay[dow].push(rs)
    })

    // Next 7 days including today
    const next7: { date: Date; dow: number; label: string; isToday: boolean; isTomorrow: boolean }[] = []
    for (let i = 0; i < 7; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        next7.push({
            date: d,
            dow: d.getDay(),
            label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
            isToday: i === 0,
            isTomorrow: i === 1,
        })
    }

    // Next upcoming collections (soonest first, from route_schedules)
    const upcomingList = routeSchedules
        .map(rs => {
            const dow = getDayOfWeekFromString(rs.day_of_week)
            if (dow === -1) return null
            const nextDate = getNextOccurrence(dow)
            const days = daysUntil(new Date(nextDate))
            return { ...rs, nextDate, daysUntil: days }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.daysUntil - b.daysUntil)

    return (
        <DashboardLayout
            role="Commercial"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={COMMERCIAL_NAV}
            primaryAction={{ label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' }}
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
                .bento-card-green {
                    background: #00450d; border-radius: 16px; color: white;
                    overflow: hidden; position: relative;
                }
                .day-col {
                    flex: 1; min-width: 0; border-radius: 12px;
                    border: 1px solid rgba(0,69,13,0.06);
                    background: #fafaf9; overflow: hidden;
                }
                .day-col.has-collection { background: white; border-color: rgba(0,69,13,0.1); }
                .day-col.today { border-color: #00450d; border-width: 2px; }
                .waste-chip {
                    border-radius: 8px; padding: 6px 10px;
                    font-size: 11px; font-weight: 700;
                    font-family: 'Manrope', sans-serif;
                    display: flex; align-items: center; gap: 5px;
                    border: 1px solid transparent;
                }
                .stop-row {
                    padding: 16px 24px;
                    border-bottom: 1px solid rgba(0,69,13,0.05);
                    display: flex; align-items: center; gap-16px;
                    gap: 16px;
                }
                .stop-row:last-child { border-bottom: none; }
                .freq-badge {
                    font-size: 10px; font-weight: 700; padding: 3px 10px;
                    border-radius: 99px; font-family: 'Manrope', sans-serif;
                    letter-spacing: 0.06em; text-transform: uppercase;
                    background: #f0fdf4; color: #00450d; border: 1px solid #bbf7d0;
                }
                .upcoming-row {
                    padding: 14px 24px;
                    border-bottom: 1px solid rgba(0,69,13,0.05);
                    display: flex; align-items: center; gap: 16px;
                }
                .upcoming-row:last-child { border-bottom: none; }
                @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
                .s1 { animation: staggerIn 0.5s ease 0.05s both; }
                .s2 { animation: staggerIn 0.5s ease 0.1s both; }
                .s3 { animation: staggerIn 0.5s ease 0.15s both; }
                .s4 { animation: staggerIn 0.5s ease 0.2s both; }
            `}</style>

            {/* Header */}
            <section className="mb-8 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    Collection Schedule · ClearPath
                </span>
                <h1 className="font-headline font-extrabold tracking-tight"
                    style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Your <span style={{ color: '#1b5e20' }}>Schedule</span>
                </h1>
                {profile && (
                    <p className="text-sm mt-2" style={{ color: '#717a6d' }}>
                        {profile.ward && `Ward: ${profile.ward}`}
                        {profile.ward && profile.district && ' · '}
                        {profile.district && `District: ${profile.district}`}
                    </p>
                )}
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {loadError && (
                        <div className="rounded-2xl p-5 mb-6 flex items-start gap-4"
                            style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                            <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '22px' }}>error</span>
                            <p className="text-sm" style={{ color: '#991b1b' }}>{loadError}</p>
                        </div>
                    )}

                    {/* Summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 s2">
                        <div className="bento-card-green p-6">
                            <div className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-10 -mt-10"
                                style={{ background: 'rgba(163,246,156,0.06)' }} />
                            <div className="relative z-10">
                                <span className="material-symbols-outlined mb-3 block"
                                    style={{ color: 'rgba(163,246,156,0.7)', fontSize: '26px' }}>calendar_month</span>
                                <p className="text-xs font-bold uppercase mb-1"
                                    style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                                    Next Collection
                                </p>
                                <p className="font-headline font-extrabold tracking-tight" style={{ fontSize: '22px' }}>
                                    {upcomingList.length > 0
                                        ? upcomingList[0].daysUntil === 0 ? 'Today'
                                            : upcomingList[0].daysUntil === 1 ? 'Tomorrow'
                                                : `In ${upcomingList[0].daysUntil} days`
                                        : '—'}
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'rgba(163,246,156,0.5)' }}>
                                    {upcomingList.length > 0
                                        ? upcomingList[0].nextDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
                                        : 'No schedule found'}
                                </p>
                            </div>
                        </div>

                        <div className="bento-card p-6">
                            <span className="material-symbols-outlined mb-3 block"
                                style={{ color: '#00450d', fontSize: '26px' }}>delete</span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Registered Stops
                            </p>
                            <p className="font-headline font-extrabold tracking-tight" style={{ fontSize: '26px', color: '#181c22' }}>
                                {myStops.length}
                            </p>
                            <p className="text-xs mt-1 font-semibold" style={{ color: '#00450d' }}>
                                {myStops.filter(s => s.status === 'completed').length} completed this period
                            </p>
                        </div>

                        <div className="bento-card p-6">
                            <span className="material-symbols-outlined mb-3 block"
                                style={{ color: '#00450d', fontSize: '26px' }}>route</span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Collection Days
                            </p>
                            <p className="font-headline font-extrabold tracking-tight" style={{ fontSize: '26px', color: '#181c22' }}>
                                {Object.keys(upcomingByDay).length}
                            </p>
                            <p className="text-xs mt-1 font-semibold" style={{ color: '#00450d' }}>
                                days per week in your ward
                            </p>
                        </div>
                    </div>

                    {/* Weekly calendar */}
                    <div className="bento-card mb-6 s3">
                        <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                This Week
                            </h3>
                            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                                Scheduled collections for your ward over the next 7 days
                            </p>
                        </div>
                        <div className="p-6">
                            <div className="flex gap-3">
                                {next7.map(({ date, dow, label, isToday, isTomorrow }) => {
                                    const collections = upcomingByDay[dow] ?? []
                                    return (
                                        <div
                                            key={dow}
                                            className={`day-col ${collections.length > 0 ? 'has-collection' : ''} ${isToday ? 'today' : ''}`}
                                        >
                                            <div className="px-3 py-3 text-center"
                                                style={{
                                                    borderBottom: collections.length > 0 ? '1px solid rgba(0,69,13,0.06)' : 'none',
                                                    background: isToday ? '#00450d' : 'transparent'
                                                }}>
                                                <p className="text-xs font-bold"
                                                    style={{
                                                        fontFamily: 'Manrope, sans-serif',
                                                        color: isToday ? 'rgba(163,246,156,0.8)' : '#94a3b8',
                                                        letterSpacing: '0.08em'
                                                    }}>
                                                    {DAYS_SHORT[dow]}
                                                </p>
                                                <p className="font-bold text-sm mt-0.5"
                                                    style={{ color: isToday ? 'white' : '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                    {date.getDate()}
                                                </p>
                                                {isToday && (
                                                    <p className="text-xs mt-0.5" style={{ color: 'rgba(163,246,156,0.7)', fontSize: '9px', fontFamily: 'Manrope, sans-serif', fontWeight: 700, letterSpacing: '0.1em' }}>TODAY</p>
                                                )}
                                                {isTomorrow && !isToday && (
                                                    <p className="text-xs mt-0.5" style={{ color: '#94a3b8', fontSize: '9px', fontFamily: 'Manrope, sans-serif', fontWeight: 700, letterSpacing: '0.1em' }}>TMR</p>
                                                )}
                                            </div>
                                            <div className="p-2 flex flex-col gap-1.5">
                                                {collections.length === 0 ? (
                                                    <div className="py-4 text-center">
                                                        <span className="material-symbols-outlined" style={{ color: '#e2e8f0', fontSize: '16px' }}>remove</span>
                                                    </div>
                                                ) : (
                                                    collections.map((rs: any, i: number) => {
                                                        const style = wasteStyle(rs.waste_type)
                                                        return (
                                                            <div key={i} className="waste-chip"
                                                                style={{ background: style.bg, color: style.text, borderColor: style.border }}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{style.icon}</span>
                                                                <span style={{ fontSize: '10px' }}>{wasteLabel(rs.waste_type)}</span>
                                                            </div>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Upcoming collections list */}
                    <div className="bento-card mb-6 s3">
                        <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                Upcoming Collections
                            </h3>
                            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                                Next scheduled collections for your ward
                            </p>
                        </div>

                        {upcomingList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>
                                        event_busy
                                    </span>
                                </div>
                                <p className="font-headline font-bold text-base mb-1" style={{ color: '#181c22' }}>
                                    No schedule found
                                </p>
                                <p className="text-sm" style={{ color: '#94a3b8' }}>
                                    No active collection schedule found for your ward. Contact CMC if you believe this is an error.
                                </p>
                            </div>
                        ) : (
                            <div>
                                {upcomingList.map((rs: any, i: number) => {
                                    const style = wasteStyle(rs.waste_type)
                                    const isNext = i === 0
                                    return (
                                        <div key={rs.id} className="upcoming-row">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                                                <span className="material-symbols-outlined"
                                                    style={{ color: style.text, fontSize: '20px' }}>{style.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold" style={{ color: '#181c22' }}>
                                                    {wasteLabel(rs.waste_type)} collection
                                                    {isNext && (
                                                        <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                                                            style={{ background: '#f0fdf4', color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                                            Next up
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                                                    {rs.nextDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                    {rs.estimated_start_time && ` · From ${formatTime(rs.estimated_start_time)}`}
                                                    {rs.estimated_duration_minutes && ` · ~${rs.estimated_duration_minutes} min`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <span className="text-sm font-bold" style={{ color: rs.daysUntil === 0 ? '#00450d' : '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                    {rs.daysUntil === 0 ? 'Today' : rs.daysUntil === 1 ? 'Tomorrow' : `${rs.daysUntil}d`}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* My registered stops */}
                    <div className="bento-card s4">
                        <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                Your Collection Stops
                            </h3>
                            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                                Registered bins and stops at your premises
                            </p>
                        </div>

                        {myStops.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>
                                        location_off
                                    </span>
                                </div>
                                <p className="font-headline font-bold text-base mb-1" style={{ color: '#181c22' }}>
                                    No stops registered
                                </p>
                                <p className="text-sm" style={{ color: '#94a3b8' }}>
                                    Your collection stops will appear here once approved by your District Engineer.
                                </p>
                            </div>
                        ) : (
                            <div>
                                {myStops.map((stop: any) => {
                                    const style = wasteStyle(stop.waste_type)
                                    const isCompleted = stop.status === 'completed'
                                    const isSkipped = stop.status === 'skipped'
                                    return (
                                        <div key={stop.id} className="stop-row">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                                                <span className="material-symbols-outlined"
                                                    style={{ color: style.text, fontSize: '20px' }}>{style.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-semibold" style={{ color: '#181c22' }}>
                                                        {stop.road_name || stop.address || `Stop #${stop.stop_order}`}
                                                    </p>
                                                    {stop.waste_type && (
                                                        <span className="waste-chip"
                                                            style={{ background: style.bg, color: style.text, borderColor: style.border, padding: '2px 8px' }}>
                                                            {wasteLabel(stop.waste_type)}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                                                    {stop.bin_quantity && `${stop.bin_quantity}× `}
                                                    {stop.bin_size && `${stop.bin_size} `}
                                                    {stop.bin_count && !stop.bin_quantity && `${stop.bin_count} bin${stop.bin_count !== 1 ? 's' : ''} · `}
                                                    {stop.frequency && `${stop.frequency} collection`}
                                                    {stop.completed_at && ` · Last collected ${formatDate(stop.completed_at)}`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {isCompleted && (
                                                    <span className="freq-badge" style={{ background: '#f0fdf4', color: '#00450d', border: '1px solid #bbf7d0' }}>
                                                        Collected
                                                    </span>
                                                )}
                                                {isSkipped && (
                                                    <span className="freq-badge" style={{ background: '#fef2f2', color: '#ba1a1a', border: '1px solid #fecaca' }}>
                                                        {stop.skip_reason || 'Skipped'}
                                                    </span>
                                                )}
                                                {!isCompleted && !isSkipped && stop.status && (
                                                    <span className="freq-badge">
                                                        {stop.status.charAt(0).toUpperCase() + stop.status.slice(1)}
                                                    </span>
                                                )}
                                                {stop.blockchain_tx && (
                                                    <a
                                                        href={`https://amoy.polygonscan.com/tx/${stop.blockchain_tx}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="freq-badge"
                                                        style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', cursor: 'pointer', textDecoration: 'none' }}
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '10px', marginRight: '3px' }}>link</span>
                                                        Chain
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        <div className="px-8 py-4 flex items-center gap-3"
                            style={{ borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>verified</span>
                            <p className="text-xs" style={{ color: '#717a6d' }}>
                                Collection stops verified on Polygon Amoy · CMC EcoLedger 2026
                            </p>
                        </div>
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}