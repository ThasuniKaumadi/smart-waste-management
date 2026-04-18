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
    { label: 'Profile', href: '/dashboard/commercial/profile', icon: 'manage_accounts' },
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const WASTE_STYLES: Record<string, { bg: string; text: string; border: string; icon: string; dot: string }> = {
    organic: { bg: '#f0fdf4', text: '#00450d', border: '#bbf7d0', icon: 'compost', dot: '#16a34a' },
    recyclable: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', icon: 'recycling', dot: '#3b82f6' },
    plastics: { bg: '#faf5ff', text: '#7c3aed', border: '#ddd6fe', icon: 'local_drink', dot: '#8b5cf6' },
    glass: { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc', icon: 'liquor', dot: '#06b6d4' },
    'non-recyclable': { bg: '#fefce8', text: '#92400e', border: '#fde68a', icon: 'delete', dot: '#f59e0b' },
    general: { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', icon: 'delete_sweep', dot: '#94a3b8' },
}

function ws(type: string | null) {
    if (!type) return WASTE_STYLES.general
    return WASTE_STYLES[type.toLowerCase().replace(/\s+/g, '-')] || WASTE_STYLES.general
}

function wl(type: string | null) {
    if (!type) return 'General'
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
}

function formatTime(t: string | null) {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function getDow(day: string | null) {
    if (!day) return -1
    return DAYS.findIndex(d => d.toLowerCase() === day.toLowerCase())
}

function nextOccurrence(dow: number): Date {
    const today = new Date()
    let diff = dow - today.getDay()
    if (diff <= 0) diff += 7
    const d = new Date(today)
    d.setDate(today.getDate() + diff)
    return d
}

function daysUntil(d: Date) {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const target = new Date(d); target.setHours(0, 0, 0, 0)
    return Math.round((target.getTime() - now.getTime()) / 86400000)
}

export default function CommercialSchedulePage() {
    const [profile, setProfile] = useState<any>(null)
    const [routeSchedules, setRouteSchedules] = useState<any[]>([])
    const [myStops, setMyStops] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeDay, setActiveDay] = useState<number | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }
            const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            setProfile(p)
            if (!p) { setLoading(false); return }

            const [rsRes, stopsRes] = await Promise.all([
                supabase.from('route_schedules').select('*').eq('ward', p.ward).eq('status', 'active'),
                supabase.from('collection_stops').select('*').eq('commercial_id', user.id).eq('is_commercial', true).order('stop_order'),
            ])
            setRouteSchedules(rsRes.data ?? [])
            setMyStops(stopsRes.data ?? [])
        } finally {
            setLoading(false)
        }
    }

    const today = new Date()
    const todayDow = today.getDay()

    // Build day → schedules map
    const byDay: Record<number, any[]> = {}
    routeSchedules.forEach(rs => {
        const dow = getDow(rs.day_of_week)
        if (dow === -1) return
        if (!byDay[dow]) byDay[dow] = []
        byDay[dow].push(rs)
    })

    // Next 7 days
    const week = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        const dow = d.getDay()
        return { d, dow, date: d.getDate(), isToday: i === 0, isTomorrow: i === 1, collections: byDay[dow] ?? [] }
    })

    // Timeline: upcoming collections sorted
    const timeline = routeSchedules
        .map(rs => {
            const dow = getDow(rs.day_of_week)
            if (dow === -1) return null
            const next = nextOccurrence(dow)
            return { ...rs, next, days: daysUntil(next) }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.days - b.days)

    const selectedCollections = activeDay !== null ? (byDay[activeDay] ?? []) : []
    const completedStops = myStops.filter(s => s.status === 'completed').length
    const nextCollection = timeline[0]

    return (
        <DashboardLayout
            role="Commercial"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={COMMERCIAL_NAV}
            primaryAction={{ label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' }}
        >
            <style>{`
                .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
                .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
                .card-green { background:#00450d; border-radius:20px; color:white; overflow:hidden; position:relative; }
                .day-tile { border-radius:14px; border:1.5px solid rgba(0,69,13,0.08); background:white; cursor:pointer; transition:all 0.2s; overflow:hidden; flex:1; min-width:0; }
                .day-tile:hover { border-color:#00450d; transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,69,13,0.1); }
                .day-tile.active { border-color:#00450d; border-width:2px; }
                .day-tile.today-tile { border-color:#00450d; }
                .day-tile.empty { background:#fafaf9; cursor:default; }
                .day-tile.empty:hover { transform:none; box-shadow:none; border-color:rgba(0,69,13,0.08); }
                .timeline-item { display:flex; gap:16px; padding:16px 0; position:relative; }
                .timeline-item:not(:last-child)::before { content:''; position:absolute; left:19px; top:44px; bottom:-16px; width:1px; background:rgba(0,69,13,0.1); }
                .stop-card { border-radius:14px; border:1px solid rgba(0,69,13,0.08); background:white; padding:16px; transition:background 0.15s; }
                .stop-card:hover { background:#f9fbf7; }
                .chip { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; border:1px solid transparent; }
                @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
                .a1 { animation:fadeUp 0.4s ease 0.05s both; }
                .a2 { animation:fadeUp 0.4s ease 0.1s both; }
                .a3 { animation:fadeUp 0.4s ease 0.15s both; }
                .a4 { animation:fadeUp 0.4s ease 0.2s both; }
            `}</style>

            {/* Header */}
            <div className="mb-6 a1">
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Collection Schedule · ClearPath
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif' }}>
                        Your <span style={{ color: '#00450d' }}>Schedule</span>
                    </h1>
                    {profile?.ward && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '99px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <span className="msf" style={{ fontSize: '14px', color: '#00450d' }}>location_on</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>
                                {profile.ward}{profile.district && ` · ${profile.district}`}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #00450d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* Top row: next collection hero + 2 stats */}
                    <div className="a2" style={{ display: 'grid', gridTemplateColumns: '1fr 180px 180px', gap: '16px', marginBottom: '20px' }}>
                        {/* Next collection hero */}
                        <div className="card-green" style={{ padding: '28px' }}>
                            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(163,246,156,0.07)' }} />
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(163,246,156,0.7)', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '12px' }}>
                                    Next collection
                                </p>
                                {nextCollection ? (
                                    <>
                                        <p style={{ fontSize: '28px', fontWeight: 900, lineHeight: 1.1, marginBottom: '6px', fontFamily: 'Manrope,sans-serif' }}>
                                            {nextCollection.days === 0 ? 'Today' : nextCollection.days === 1 ? 'Tomorrow' : `${nextCollection.days} days`}
                                        </p>
                                        <p style={{ color: 'rgba(163,246,156,0.75)', fontSize: '13px', marginBottom: '16px' }}>
                                            {nextCollection.next.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {timeline.filter((t: any) => t.days === nextCollection.days).map((t: any, i: number) => {
                                                const style = ws(t.waste_type)
                                                return (
                                                    <span key={i} className="chip" style={{ background: 'rgba(255,255,255,0.12)', color: 'white', borderColor: 'rgba(255,255,255,0.15)' }}>
                                                        <span className="msf" style={{ fontSize: '11px' }}>{style.icon}</span>
                                                        {wl(t.waste_type)}
                                                        {t.estimated_start_time && ` · ${formatTime(t.estimated_start_time)}`}
                                                    </span>
                                                )
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <p style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px', fontFamily: 'Manrope,sans-serif' }}>No schedule</p>
                                        <p style={{ color: 'rgba(163,246,156,0.6)', fontSize: '13px' }}>Contact CMC to set up your collection schedule</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stops stat */}
                        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                <span className="msf" style={{ color: '#00450d', fontSize: '20px' }}>delete</span>
                            </div>
                            <div>
                                <p style={{ fontSize: '32px', fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{myStops.length}</p>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>Stops</p>
                                <p style={{ fontSize: '11px', color: '#00450d', fontWeight: 600, marginTop: '6px' }}>{completedStops} collected</p>
                            </div>
                        </div>

                        {/* Collection days stat */}
                        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                <span className="msf" style={{ color: '#1d4ed8', fontSize: '20px' }}>today</span>
                            </div>
                            <div>
                                <p style={{ fontSize: '32px', fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{Object.keys(byDay).length}</p>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>Days/week</p>
                                <p style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600, marginTop: '6px' }}>in your ward</p>
                            </div>
                        </div>
                    </div>

                    {/* Weekly calendar — hero section */}
                    <div className="card a3" style={{ marginBottom: '20px' }}>
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>This Week</h2>
                                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Click a day to see collections · {week[0].d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {week[6].d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                </div>
                                {activeDay !== null && (
                                    <button onClick={() => setActiveDay(null)}
                                        style={{ fontSize: '11px', fontWeight: 700, color: '#00450d', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '99px', padding: '4px 12px', cursor: 'pointer', fontFamily: 'Manrope,sans-serif' }}>
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Day tiles */}
                        <div style={{ padding: '20px', display: 'flex', gap: '10px' }}>
                            {week.map(({ d, dow, date, isToday, isTomorrow, collections }) => {
                                const isEmpty = collections.length === 0
                                const isActive = activeDay === dow
                                return (
                                    <div
                                        key={dow}
                                        className={`day-tile ${isEmpty ? 'empty' : ''} ${isToday ? 'today-tile' : ''} ${isActive ? 'active' : ''}`}
                                        onClick={() => !isEmpty && setActiveDay(isActive ? null : dow)}
                                    >
                                        {/* Date header */}
                                        <div style={{ padding: '10px 8px 8px', textAlign: 'center', background: isToday ? '#00450d' : isActive ? '#f0fdf4' : 'transparent', borderBottom: collections.length > 0 ? '1px solid rgba(0,69,13,0.06)' : 'none' }}>
                                            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: isToday ? 'rgba(163,246,156,0.8)' : '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>
                                                {DAYS_SHORT[dow]}
                                            </p>
                                            <p style={{ fontSize: '18px', fontWeight: 900, color: isToday ? 'white' : isActive ? '#00450d' : '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1.2 }}>
                                                {date}
                                            </p>
                                            {isToday && <p style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(163,246,156,0.7)', letterSpacing: '0.12em', fontFamily: 'Manrope,sans-serif' }}>TODAY</p>}
                                            {isTomorrow && !isToday && <p style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope,sans-serif' }}>TMR</p>}
                                        </div>

                                        {/* Collection dots */}
                                        <div style={{ padding: '8px', minHeight: '40px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                            {isEmpty ? (
                                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#e2e8f0', margin: '8px auto' }} />
                                            ) : (
                                                collections.map((c: any, i: number) => {
                                                    const s = ws(c.waste_type)
                                                    return (
                                                        <div key={i} style={{ width: '100%', background: s.bg, borderRadius: '6px', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '4px', border: `1px solid ${s.border}` }}>
                                                            <span className="msf" style={{ fontSize: '10px', color: s.text }}>{s.icon}</span>
                                                            <span style={{ fontSize: '9px', fontWeight: 700, color: s.text, fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {wl(c.waste_type)}
                                                            </span>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Selected day detail */}
                        {activeDay !== null && selectedCollections.length > 0 && (
                            <div style={{ padding: '0 20px 20px' }}>
                                <div style={{ borderRadius: '14px', background: '#f9fbf7', border: '1px solid rgba(0,69,13,0.08)', padding: '16px 20px' }}>
                                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        {DAYS[activeDay]} collections
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {selectedCollections.map((c: any, i: number) => {
                                            const s = ws(c.waste_type)
                                            return (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.bg, border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <span className="msf" style={{ fontSize: '18px', color: s.text }}>{s.icon}</span>
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22' }}>{wl(c.waste_type)} collection</p>
                                                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                                            {c.estimated_start_time ? `From ${formatTime(c.estimated_start_time)}` : 'Time TBC'}
                                                            {c.estimated_duration_minutes && ` · ~${c.estimated_duration_minutes} min`}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Two-column: timeline + your stops */}
                    <div className="a4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                        {/* Upcoming timeline */}
                        <div className="card">
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>Upcoming</h2>
                                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Next scheduled collections</p>
                            </div>
                            <div style={{ padding: '16px 24px' }}>
                                {timeline.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                        <span className="msf" style={{ fontSize: '36px', color: '#e2e8f0', display: 'block', marginBottom: '12px' }}>event_busy</span>
                                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#181c22', marginBottom: '4px' }}>No active schedule</p>
                                        <p style={{ fontSize: '12px', color: '#94a3b8' }}>Contact CMC to set up your ward schedule</p>
                                    </div>
                                ) : (
                                    timeline.map((t: any, i: number) => {
                                        const s = ws(t.waste_type)
                                        const isFirst = i === 0
                                        return (
                                            <div key={t.id || i} className="timeline-item">
                                                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2px' }}>
                                                    <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: isFirst ? '#00450d' : s.bg, border: `1px solid ${isFirst ? '#00450d' : s.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span className="msf" style={{ fontSize: '18px', color: isFirst ? 'white' : s.text }}>{s.icon}</span>
                                                    </div>
                                                </div>
                                                <div style={{ flex: 1, paddingTop: '2px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22' }}>{wl(t.waste_type)} collection</p>
                                                        {isFirst && (
                                                            <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: '#f0fdf4', color: '#00450d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                                Next
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                                                        {t.next.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                        {t.estimated_start_time && ` · ${formatTime(t.estimated_start_time)}`}
                                                    </p>
                                                </div>
                                                <div style={{ flexShrink: 0, paddingTop: '4px' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: 800, color: t.days === 0 ? '#00450d' : t.days === 1 ? '#d97706' : '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>
                                                        {t.days === 0 ? 'Today' : t.days === 1 ? 'Tmr' : `${t.days}d`}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                        {/* Your stops */}
                        <div className="card">
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>Your Stops</h2>
                                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Registered bins at your premises</p>
                            </div>
                            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {myStops.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                        <span className="msf" style={{ fontSize: '36px', color: '#e2e8f0', display: 'block', marginBottom: '12px' }}>location_off</span>
                                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#181c22', marginBottom: '4px' }}>No stops registered</p>
                                        <p style={{ fontSize: '12px', color: '#94a3b8' }}>Stops appear after DE approval</p>
                                    </div>
                                ) : (
                                    myStops.map((stop: any) => {
                                        const s = ws(stop.waste_type)
                                        const isCollected = stop.status === 'completed'
                                        const isSkipped = stop.status === 'skipped'
                                        return (
                                            <div key={stop.id} className="stop-card">
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: s.bg, border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <span className="msf" style={{ fontSize: '18px', color: s.text }}>{s.icon}</span>
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                                                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22' }}>
                                                                {stop.road_name || stop.address || `Stop #${stop.stop_order}`}
                                                            </p>
                                                            <span className="chip" style={{ background: s.bg, color: s.text, borderColor: s.border }}>
                                                                {wl(stop.waste_type)}
                                                            </span>
                                                        </div>
                                                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                            {stop.bin_quantity ? `${stop.bin_quantity}× ` : ''}{stop.bin_size || ''}{stop.frequency ? ` · ${stop.frequency.replace(/_/g, ' ')}` : ''}
                                                            {stop.completed_at && ` · Last ${new Date(stop.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                                                        </p>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', flexShrink: 0 }}>
                                                        {isCollected && <span className="chip" style={{ background: '#f0fdf4', color: '#00450d', borderColor: '#bbf7d0' }}>Collected</span>}
                                                        {isSkipped && <span className="chip" style={{ background: '#fef2f2', color: '#ba1a1a', borderColor: '#fecaca' }}>{stop.skip_reason || 'Skipped'}</span>}
                                                        {stop.blockchain_tx && (
                                                            <a href={`https://amoy.polygonscan.com/tx/${stop.blockchain_tx}`} target="_blank" rel="noopener noreferrer"
                                                                className="chip" style={{ background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe', textDecoration: 'none' }}>
                                                                Chain ↗
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                            <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="msf" style={{ color: '#7c3aed', fontSize: '14px' }}>verified</span>
                                <p style={{ fontSize: '11px', color: '#717a6d' }}>Verified on Polygon Amoy · CMC EcoLedger 2026</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}