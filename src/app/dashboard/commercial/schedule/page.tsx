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
    { label: 'Rate Service', href: '/dashboard/commercial/feedback', icon: 'star' },
    { label: 'Profile', href: '/dashboard/commercial/profile', icon: 'manage_accounts' },
]

const WASTE_STYLES: Record<string, { bg: string; text: string; border: string; icon: string; dot: string; label: string }> = {
    organic: { bg: '#f0fdf4', text: '#00450d', border: '#bbf7d0', icon: 'compost', dot: '#16a34a', label: 'Organic Waste' },
    recyclable: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', icon: 'recycling', dot: '#3b82f6', label: 'Recyclable' },
    non_recyclable: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', icon: 'delete', dot: '#ef4444', label: 'Non-Recyclable' },
    e_waste: { bg: '#faf5ff', text: '#7c3aed', border: '#e9d5ff', icon: 'computer', dot: '#a855f7', label: 'E-Waste' },
    bulk: { bg: '#fffbeb', text: '#d97706', border: '#fde68a', icon: 'inventory_2', dot: '#f59e0b', label: 'Bulk Waste' },
    other: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', icon: 'category', dot: '#94a3b8', label: 'Other' },
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const FREQUENCIES: Record<string, string> = {
    daily: 'Daily', twice_weekly: '2× week', weekly: 'Weekly',
    fortnightly: 'Fortnightly', monthly: 'Monthly',
}

interface Schedule {
    id: string; district: string; ward: string; wards: string[]
    waste_type: string; custom_waste_type: string | null
    collection_day: string; collection_time: string
    frequency: string | null; notes: string; scheduled_date: string
    streets: Record<string, string[]> | null
    status: string; cancellation_note: string | null
}

interface MyStop {
    id: string; road_name: string; address: string
    status: string; waste_type: string; bin_quantity: number
    bin_size: string; blockchain_tx: string; completed_at: string
    skip_reason: string; stop_order: number
}

function getWasteStyle(type: string | null, customLabel?: string | null) {
    const base = WASTE_STYLES[type?.toLowerCase() || ''] || WASTE_STYLES.other
    if (type === 'other' && customLabel) return { ...base, label: customLabel }
    return base
}

function formatTime(t: string | null) {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function StreetsDisplay({ streets, ward }: { streets: Record<string, string[]> | null; ward: string | null }) {
    if (!streets || Object.keys(streets).length === 0) return null
    const relevant = ward ? Object.entries(streets).filter(([w]) => w === ward) : Object.entries(streets)
    if (relevant.length === 0) return null
    const allStreets = relevant.flatMap(([, s]) => s)
    return (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {allStreets.map(street => (
                <span key={street} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(0,69,13,0.07)', color: '#00450d', fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>{street}</span>
            ))}
        </div>
    )
}

export default function CommercialSchedulePage() {
    const [profile, setProfile] = useState<any>(null)
    const [schedules, setSchedules] = useState<Schedule[]>([])
    const [myStops, setMyStops] = useState<MyStop[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'calendar' | 'list'>('calendar')
    const [currentDate, setCurrentDate] = useState(new Date())
    const [confirmStatuses, setConfirmStatuses] = useState<Record<string, 'confirmed' | 'unable'>>({})
    const [confirmingId, setConfirmingId] = useState<string | null>(null)
    const [toast, setToast] = useState('')
    const [selectedDay, setSelectedDay] = useState<number | null>(null)

    useEffect(() => { loadData() }, [])

    function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500) }

    async function loadData() {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }
            const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            setProfile(p)
            if (!p) { setLoading(false); return }

            const today = new Date().toISOString().split('T')[0]

            // Fetch published AND cancelled schedules — commercial sees both
            const { data: schedData } = await supabase
                .from('schedules')
                .select('*')
                .eq('district', p.district || '')
                .in('status', ['published', 'cancelled'])
                .gte('scheduled_date', today)
                .order('scheduled_date', { ascending: true })

            let filtered = schedData || []

            // Ward filtering — same logic as resident
            if (p.ward && filtered.length > 0) {
                const wardSpecific = filtered.filter((s: Schedule) =>
                    (s.wards && s.wards.includes(p.ward)) || (s.ward && s.ward === p.ward)
                )
                const districtWide = filtered.filter((s: Schedule) => !s.wards?.length && !s.ward)
                filtered = wardSpecific.length > 0
                    ? [...wardSpecific, ...districtWide]
                    : districtWide.length > 0 ? districtWide : filtered
            }
            setSchedules(filtered)

            // My collection stops
            const { data: stopsData } = await supabase
                .from('collection_stops')
                .select('*')
                .eq('commercial_id', user.id)
                .eq('is_commercial', true)
                .order('stop_order')
            setMyStops(stopsData || [])

            // Confirmations
            const { data: confirmData } = await supabase
                .from('waste_confirmations')
                .select('schedule_id, status')
                .eq('user_id', user.id)
            const statusMap: Record<string, 'confirmed' | 'unable'> = {}
                ; (confirmData || []).forEach((c: any) => { statusMap[c.schedule_id] = c.status })
            setConfirmStatuses(statusMap)
        } finally {
            setLoading(false)
        }
    }

    async function confirmHandover(scheduleId: string, status: 'confirmed' | 'unable') {
        const schedule = schedules.find(s => s.id === scheduleId)
        if (!schedule || schedule.status === 'cancelled') return
        if (confirmStatuses[scheduleId]) return
        setConfirmingId(scheduleId)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { error } = await supabase.from('waste_confirmations').insert({
                schedule_id: scheduleId, user_id: user.id,
                role: 'commercial_establishment',
                district: profile?.district, ward: profile?.ward || null, status,
            })
            if (!error) {
                setConfirmStatuses(prev => ({ ...prev, [scheduleId]: status }))
                showToast(status === 'confirmed' ? '✓ Confirmed — District Engineer notified.' : 'Noted — marked as unable to hand over.')
            }
        } finally {
            setConfirmingId(null)
        }
    }

    async function cancelConfirmation(scheduleId: string) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('waste_confirmations').delete().eq('schedule_id', scheduleId).eq('user_id', user.id)
        setConfirmStatuses(prev => { const next = { ...prev }; delete next[scheduleId]; return next })
        showToast('Confirmation cancelled.')
    }

    // Calendar helpers
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()

    function schedulesForDay(day: number) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        return schedules.filter(s => s.scheduled_date === dateStr)
    }

    const todayDayName = DAYS_FULL[today.getDay()]
    const todaySchedules = schedules.filter(s => s.collection_day === todayDayName && s.status === 'published')
    const nextSchedule = schedules.find(s => s.status === 'published')
    const upcomingCancellations = schedules.filter(s => s.status === 'cancelled')
    const completedStops = myStops.filter(s => s.status === 'completed').length
    const confirmedCount = Object.values(confirmStatuses).filter(s => s === 'confirmed').length

    function daysUntil(dateStr: string) {
        const now = new Date(); now.setHours(0, 0, 0, 0)
        const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
        return Math.round((target.getTime() - now.getTime()) / 86400000)
    }

    return (
        <DashboardLayout
            role="Commercial"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={COMMERCIAL_NAV}
            primaryAction={{ label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' }}
        >
            <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msf-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
        .cal-day { min-height:72px; border-radius:10px; padding:6px; cursor:pointer; transition:all 0.15s; border:1.5px solid transparent; }
        .cal-day:hover { background:#f0fdf4; border-color:rgba(0,69,13,0.1); }
        .cal-day.today-cal { border-color:#00450d; background:#f0fdf4; }
        .cal-day.selected-cal { background:#00450d; border-color:#00450d; }
        .view-btn { padding:8px 18px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .view-btn.active { background:#00450d; color:white; }
        .view-btn:not(.active) { background:#f1f5f9; color:#64748b; }
        .confirm-btn { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:none; transition:all 0.2s; }
        .confirm-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .stop-card { border-radius:14px; border:1px solid rgba(0,69,13,0.08); background:white; padding:14px 16px; transition:background 0.15s; }
        .stop-card:hover { background:#f9fbf7; }
        .chip { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; white-space:nowrap; }
        .toast-pill { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#181c22; color:white; padding:10px 20px; border-radius:9999px; font-size:13px; font-weight:500; z-index:1000; display:flex; align-items:center; gap:8px; box-shadow:0 4px 20px rgba(0,0,0,0.2); white-space:nowrap; animation:slideUp 0.3s ease; }
        @keyframes slideUp { from{transform:translateY(12px) translateX(-50%);opacity:0} to{transform:translateY(0) translateX(-50%);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .4s ease .05s both} .a2{animation:fadeUp .4s ease .1s both} .a3{animation:fadeUp .4s ease .15s both} .a4{animation:fadeUp .4s ease .2s both}
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

            {toast && (
                <div className="toast-pill">
                    <span className="msf-fill" style={{ fontSize: 16, color: '#4ade80' }}>check_circle</span>
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="mb-6 a1">
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>
                    Collection Schedule · ClearPath
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <h1 style={{ fontSize: 42, fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif' }}>
                        Your <span style={{ color: '#00450d' }}>Schedule</span>
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {confirmedCount > 0 && (
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 99, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#00450d', fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span className="msf-fill" style={{ fontSize: 13 }}>check_circle</span>{confirmedCount} confirmed
                            </span>
                        )}
                        {profile?.ward && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                <span className="msf" style={{ fontSize: 14, color: '#00450d' }}>location_on</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>{profile.ward}{profile.district && ` · ${profile.district}`}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button className={`view-btn ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>
                                <span className="msf" style={{ fontSize: 14, marginRight: 4 }}>calendar_month</span>Calendar
                            </button>
                            <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>
                                <span className="msf" style={{ fontSize: 14, marginRight: 4 }}>list</span>List
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #00450d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* Cancellation banners */}
                    {upcomingCancellations.length > 0 && (
                        <div className="a1" style={{ marginBottom: 16 }}>
                            {upcomingCancellations.map(s => {
                                const ws = getWasteStyle(s.waste_type, s.custom_waste_type)
                                return (
                                    <div key={s.id} style={{ borderRadius: 14, padding: '14px 18px', background: '#fef2f2', border: '1px solid rgba(186,26,26,0.2)', display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 8 }}>
                                        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(186,26,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="msf-fill" style={{ fontSize: 20, color: '#ba1a1a' }}>cancel</span>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: 13, fontWeight: 700, color: '#ba1a1a', fontFamily: 'Manrope,sans-serif', marginBottom: 3 }}>
                                                Collection Cancelled — {ws.label}
                                            </p>
                                            <p style={{ fontSize: 12, color: '#7f1d1d', margin: 0 }}>
                                                {new Date(s.scheduled_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {formatTime(s.collection_time)}
                                            </p>
                                            {s.cancellation_note && (
                                                <p style={{ fontSize: 12, color: '#991b1b', marginTop: 5, fontStyle: 'italic' }}>"{s.cancellation_note}"</p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Today alert */}
                    {todaySchedules.length > 0 && (
                        <div className="a1" style={{ marginBottom: 16, borderRadius: 14, padding: '14px 18px', background: 'linear-gradient(135deg,#00450d,#1b5e20)', color: 'white', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="msf" style={{ fontSize: 21 }}>notifications_active</span>
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(163,246,156,0.75)', marginBottom: 3, fontFamily: 'Manrope,sans-serif' }}>Collection Today</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {todaySchedules.map(s => {
                                        const ws = getWasteStyle(s.waste_type, s.custom_waste_type)
                                        return <span key={s.id} style={{ background: 'rgba(255,255,255,0.13)', color: 'white', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>{ws.label} · {formatTime(s.collection_time)}</span>
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top stats row */}
                    <div className="a2" style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px', gap: 16, marginBottom: 20 }}>
                        {/* Next collection hero */}
                        <div style={{ background: '#00450d', borderRadius: 20, color: 'white', padding: 28, position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(163,246,156,0.07)' }} />
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(163,246,156,0.7)', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 12 }}>Next collection</p>
                                {nextSchedule ? (
                                    <>
                                        <p style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, marginBottom: 6, fontFamily: 'Manrope,sans-serif' }}>
                                            {(() => { const d = daysUntil(nextSchedule.scheduled_date); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days` })()}
                                        </p>
                                        <p style={{ color: 'rgba(163,246,156,0.75)', fontSize: 13, marginBottom: 16 }}>
                                            {new Date(nextSchedule.scheduled_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                            {(() => {
                                                const ws = getWasteStyle(nextSchedule.waste_type, nextSchedule.custom_waste_type)
                                                return (
                                                    <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
                                                        <span className="msf" style={{ fontSize: 13 }}>{ws.icon}</span>{ws.label} · {formatTime(nextSchedule.collection_time)}
                                                    </span>
                                                )
                                            })()}
                                        </div>
                                        {confirmStatuses[nextSchedule.id] ? (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 99, background: 'rgba(255,255,255,0.12)' }}>
                                                <span className="msf-fill" style={{ fontSize: 14, color: '#a3f69c' }}>{confirmStatuses[nextSchedule.id] === 'confirmed' ? 'check_circle' : 'cancel'}</span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(163,246,156,0.9)', fontFamily: 'Manrope,sans-serif' }}>
                                                    {confirmStatuses[nextSchedule.id] === 'confirmed' ? 'Waste ready confirmed' : 'Unable to hand over'}
                                                </span>
                                            </div>
                                        ) : (
                                            <button onClick={() => confirmHandover(nextSchedule.id, 'confirmed')} disabled={confirmingId === nextSchedule.id}
                                                className="confirm-btn" style={{ background: 'white', color: '#00450d' }}>
                                                <span className="msf" style={{ fontSize: 14 }}>thumb_up</span>I'll have waste ready
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div>
                                        <p style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, fontFamily: 'Manrope,sans-serif' }}>No schedule</p>
                                        <p style={{ color: 'rgba(163,246,156,0.6)', fontSize: 13 }}>Contact CMC to set up collection</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stops stat */}
                        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                <span className="msf" style={{ color: '#00450d', fontSize: 20 }}>delete</span>
                            </div>
                            <div>
                                <p style={{ fontSize: 32, fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{myStops.length}</p>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>Stops</p>
                                <p style={{ fontSize: 11, color: '#00450d', fontWeight: 600, marginTop: 6 }}>{completedStops} collected</p>
                            </div>
                        </div>

                        {/* Upcoming stat */}
                        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                <span className="msf" style={{ color: '#1d4ed8', fontSize: 20 }}>today</span>
                            </div>
                            <div>
                                <p style={{ fontSize: 32, fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{schedules.filter(s => s.status === 'published').length}</p>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>Upcoming</p>
                                {upcomingCancellations.length > 0 && (
                                    <p style={{ fontSize: 11, color: '#ba1a1a', fontWeight: 600, marginTop: 6 }}>{upcomingCancellations.length} cancelled</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Confirmation info banner */}
                    {schedules.filter(s => s.status === 'published').length > 0 && (
                        <div className="a2" style={{ borderRadius: 14, padding: '12px 16px', marginBottom: 20, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="msf" style={{ color: '#00450d', fontSize: 18, flexShrink: 0 }}>info</span>
                            <p style={{ fontSize: 12, color: '#41493e', lineHeight: 1.5, margin: 0 }}>
                                Tap <strong>"I'll have waste ready"</strong> on any upcoming collection to notify your District Engineer. This helps CMC plan the best collection days.
                            </p>
                        </div>
                    )}

                    {/* Calendar view */}
                    {view === 'calendar' && (
                        <div className="a3">
                            <div className="card">
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="msf" style={{ fontSize: 18, color: '#374151' }}>chevron_left</span>
                                    </button>
                                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22' }}>{MONTHS[month]} {year}</h3>
                                    <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="msf" style={{ fontSize: 18, color: '#374151' }}>chevron_right</span>
                                    </button>
                                </div>
                                <div style={{ padding: 16 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
                                        {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', padding: '4px 0' }}>{d}</div>)}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                                        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                                        {Array.from({ length: daysInMonth }).map((_, i) => {
                                            const day = i + 1
                                            const daySchedules = schedulesForDay(day)
                                            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                                            const isSelected = selectedDay === day
                                            return (
                                                <div key={day} className={`cal-day ${isToday ? 'today-cal' : ''} ${isSelected ? 'selected-cal' : ''}`}
                                                    onClick={() => setSelectedDay(isSelected ? null : day)}>
                                                    <p style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isSelected ? 'white' : isToday ? '#00450d' : '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 4 }}>{day}</p>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        {daySchedules.slice(0, 2).map(s => {
                                                            const ws = getWasteStyle(s.waste_type, s.custom_waste_type)
                                                            const cancelled = s.status === 'cancelled'
                                                            return <div key={s.id} style={{ height: 4, borderRadius: 99, background: isSelected ? 'rgba(255,255,255,0.6)' : cancelled ? '#fca5a5' : ws.dot }} />
                                                        })}
                                                        {daySchedules.length > 2 && <p style={{ fontSize: 8, color: isSelected ? 'rgba(255,255,255,0.7)' : '#94a3b8' }}>+{daySchedules.length - 2}</p>}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Selected day */}
                                {selectedDay && schedulesForDay(selectedDay).length > 0 && (
                                    <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#fafbfa' }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 12 }}>{MONTHS[month]} {selectedDay}</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {schedulesForDay(selectedDay).map(s => {
                                                const ws = getWasteStyle(s.waste_type, s.custom_waste_type)
                                                const cs = confirmStatuses[s.id]
                                                const cancelled = s.status === 'cancelled'
                                                return (
                                                    <div key={s.id} style={{ background: 'white', borderRadius: 12, padding: '12px 14px', border: `1px solid ${cancelled ? 'rgba(186,26,26,0.2)' : ws.border}`, opacity: cancelled ? 0.85 : 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: cancelled ? '#fef2f2' : ws.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                <span className="msf" style={{ fontSize: 18, color: cancelled ? '#ba1a1a' : ws.text }}>{cancelled ? 'cancel' : ws.icon}</span>
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                                    <p style={{ fontSize: 13, fontWeight: 700, color: cancelled ? '#94a3b8' : '#181c22', fontFamily: 'Manrope,sans-serif', textDecoration: cancelled ? 'line-through' : 'none', margin: 0 }}>{ws.label}</p>
                                                                    {cancelled && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#fef2f2', color: '#ba1a1a', fontFamily: 'Manrope,sans-serif' }}>CANCELLED</span>}
                                                                </div>
                                                                <p style={{ fontSize: 11, color: '#717a6d' }}>{formatTime(s.collection_time)}{s.frequency ? ` · ${FREQUENCIES[s.frequency] || s.frequency}` : ''}</p>
                                                                {cancelled && s.cancellation_note && <p style={{ fontSize: 11, color: '#ba1a1a', fontStyle: 'italic', marginTop: 3 }}>{s.cancellation_note}</p>}
                                                                {!cancelled && <StreetsDisplay streets={s.streets} ward={profile?.ward || null} />}
                                                            </div>
                                                            {!cancelled && (
                                                                cs ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                                                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: cs === 'confirmed' ? 'rgba(0,69,13,0.08)' : 'rgba(220,38,38,0.08)', color: cs === 'confirmed' ? '#00450d' : '#dc2626', fontFamily: 'Manrope,sans-serif' }}>
                                                                            {cs === 'confirmed' ? '✓ Ready' : '✗ Unable'}
                                                                        </span>
                                                                        <button onClick={() => cancelConfirmation(s.id)} style={{ fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Manrope,sans-serif' }}>Change</button>
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                        <button onClick={() => confirmHandover(s.id, 'confirmed')} disabled={confirmingId === s.id} className="confirm-btn" style={{ background: '#00450d', color: 'white' }}>
                                                                            <span className="msf" style={{ fontSize: 13 }}>thumb_up</span>Ready
                                                                        </button>
                                                                        <button onClick={() => confirmHandover(s.id, 'unable')} disabled={confirmingId === s.id} className="confirm-btn" style={{ background: 'white', color: '#ba1a1a', border: '1.5px solid rgba(186,26,26,0.2)' }}>
                                                                            <span className="msf" style={{ fontSize: 13 }}>cancel</span>Unable
                                                                        </button>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                                {selectedDay && schedulesForDay(selectedDay).length === 0 && (
                                    <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#fafbfa' }}>
                                        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>No collections on {MONTHS[month]} {selectedDay}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* List view */}
                    {view === 'list' && (
                        <div className="a3 card" style={{ marginBottom: 20 }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22' }}>All Upcoming</h3>
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>{schedules.length} collections</span>
                            </div>
                            {schedules.length === 0 ? (
                                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                                    <span className="msf" style={{ fontSize: 36, color: '#d1d5db', display: 'block', marginBottom: 12 }}>event_busy</span>
                                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: '#181c22', marginBottom: 6 }}>No schedules published yet</p>
                                    <p style={{ fontSize: 13, color: '#94a3b8' }}>Your district engineer will publish schedules soon</p>
                                </div>
                            ) : schedules.map(s => {
                                const ws = getWasteStyle(s.waste_type, s.custom_waste_type)
                                const cs = confirmStatuses[s.id]
                                const date = new Date(s.scheduled_date)
                                const isToday = date.toDateString() === today.toDateString()
                                const cancelled = s.status === 'cancelled'
                                const days = daysUntil(s.scheduled_date)
                                return (
                                    <div key={s.id} style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,69,13,0.04)', background: cancelled ? 'rgba(186,26,26,0.02)' : isToday ? 'rgba(0,69,13,0.02)' : undefined, opacity: cancelled ? 0.85 : 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                            <div style={{ width: 44, flexShrink: 0, textAlign: 'center' }}>
                                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: cancelled ? '#ba1a1a' : isToday ? '#00450d' : '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>
                                                    {cancelled ? 'CNCL' : days === 0 ? 'TODAY' : days === 1 ? 'TMR' : date.toLocaleDateString('en-GB', { weekday: 'short' })}
                                                </p>
                                                <p style={{ fontSize: 22, fontWeight: 800, color: cancelled ? '#94a3b8' : isToday ? '#00450d' : '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1.1, margin: 0 }}>{date.getDate()}</p>
                                                <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{date.toLocaleDateString('en-GB', { month: 'short' })}</p>
                                            </div>
                                            <div style={{ width: 1, height: 40, background: cancelled ? 'rgba(186,26,26,0.15)' : '#f0f0f0', flexShrink: 0, marginTop: 4 }} />
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: cancelled ? '#fef2f2' : ws.bg, border: `1px solid ${cancelled ? 'rgba(186,26,26,0.2)' : ws.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span className="msf" style={{ fontSize: 18, color: cancelled ? '#ba1a1a' : ws.text }}>{cancelled ? 'cancel' : ws.icon}</span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                                                    <p style={{ fontSize: 13, fontWeight: 700, color: cancelled ? '#94a3b8' : '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0, textDecoration: cancelled ? 'line-through' : 'none' }}>{ws.label}</p>
                                                    {cancelled && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#fef2f2', color: '#ba1a1a', fontFamily: 'Manrope,sans-serif' }}>CANCELLED</span>}
                                                </div>
                                                <p style={{ fontSize: 11, color: '#717a6d', margin: 0 }}>{formatTime(s.collection_time)}{s.frequency ? ` · ${FREQUENCIES[s.frequency] || s.frequency}` : ''}</p>
                                                {cancelled && s.cancellation_note && <p style={{ fontSize: 11, color: '#ba1a1a', fontStyle: 'italic', marginTop: 3, margin: 0 }}>{s.cancellation_note}</p>}
                                                {!cancelled && <StreetsDisplay streets={s.streets} ward={profile?.ward || null} />}
                                            </div>
                                            {!cancelled && (
                                                cs ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: cs === 'confirmed' ? 'rgba(0,69,13,0.08)' : 'rgba(220,38,38,0.08)', color: cs === 'confirmed' ? '#00450d' : '#dc2626', fontFamily: 'Manrope,sans-serif' }}>
                                                            {cs === 'confirmed' ? '✓ Ready' : '✗ Unable'}
                                                        </span>
                                                        <button onClick={() => cancelConfirmation(s.id)} style={{ fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Manrope,sans-serif' }}>Change</button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                                                        <button onClick={() => confirmHandover(s.id, 'confirmed')} disabled={confirmingId === s.id} className="confirm-btn" style={{ background: '#00450d', color: 'white' }}>
                                                            <span className="msf" style={{ fontSize: 13 }}>thumb_up</span>Ready
                                                        </button>
                                                        <button onClick={() => confirmHandover(s.id, 'unable')} disabled={confirmingId === s.id} className="confirm-btn" style={{ background: 'white', color: '#ba1a1a', border: '1.5px solid rgba(186,26,26,0.2)' }}>
                                                            <span className="msf" style={{ fontSize: 13 }}>cancel</span>Unable
                                                        </button>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* My stops */}
                    <div className="a4 card">
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 3px' }}>Your Stops</h2>
                            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Registered collection points at your premises</p>
                        </div>
                        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {myStops.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                    <span className="msf" style={{ fontSize: 36, color: '#e2e8f0', display: 'block', marginBottom: 12 }}>location_off</span>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: '#181c22', marginBottom: 4 }}>No stops registered</p>
                                    <p style={{ fontSize: 12, color: '#94a3b8' }}>Stops appear after District Engineer approval</p>
                                </div>
                            ) : myStops.map(stop => {
                                const ws = getWasteStyle(stop.waste_type, null)
                                const isCollected = stop.status === 'completed'
                                const isSkipped = stop.status === 'skipped'
                                return (
                                    <div key={stop.id} className="stop-card">
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                            <div style={{ width: 38, height: 38, borderRadius: 10, background: ws.bg, border: `1px solid ${ws.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span className="msf" style={{ fontSize: 18, color: ws.text }}>{ws.icon}</span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', margin: 0 }}>{stop.road_name || stop.address || `Stop #${stop.stop_order}`}</p>
                                                    <span className="chip" style={{ background: ws.bg, color: ws.text }}>{ws.label}</span>
                                                </div>
                                                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                                                    {stop.bin_quantity ? `${stop.bin_quantity}× ` : ''}{stop.bin_size || ''}
                                                    {stop.completed_at && ` · Last ${new Date(stop.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                                                {isCollected && <span className="chip" style={{ background: '#f0fdf4', color: '#00450d' }}>✓ Collected</span>}
                                                {isSkipped && <span className="chip" style={{ background: '#fef2f2', color: '#ba1a1a' }}>✗ {stop.skip_reason?.replace(/_/g, ' ') || 'Skipped'}</span>}
                                                {stop.blockchain_tx && (
                                                    <a href={`https://amoy.polygonscan.com/tx/${stop.blockchain_tx}`} target="_blank" rel="noopener noreferrer"
                                                        className="chip" style={{ background: '#f5f3ff', color: '#7c3aed', textDecoration: 'none' }}>
                                                        Chain ↗
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="msf" style={{ color: '#7c3aed', fontSize: 14 }}>verified</span>
                            <p style={{ fontSize: 11, color: '#717a6d', margin: 0 }}>Verified on Polygon Amoy · CMC EcoLedger 2026</p>
                        </div>
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}