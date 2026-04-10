'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import Link from 'next/link'

const CONTRACTOR_NAV = [
    { label: 'Overview', href: '/dashboard/contractor', icon: 'dashboard' },
    { label: 'Routes', href: '/dashboard/contractor/routes', icon: 'route' },
    { label: 'Drivers', href: '/dashboard/contractor/drivers', icon: 'person' },
    { label: 'Schedules', href: '/dashboard/contractor/schedules', icon: 'calendar_month' },
    { label: 'Contracts', href: '/dashboard/contractor/contracts', icon: 'description' },
    { label: 'Fleet', href: '/dashboard/contractor/fleet', icon: 'local_shipping' },
]

const WASTE_STYLE: Record<string, { color: string; bg: string }> = {
    organic: { color: '#00450d', bg: '#f0fdf4' },
    non_recyclable: { color: '#ba1a1a', bg: '#fef2f2' },
    recyclable: { color: '#1d4ed8', bg: '#eff6ff' },
    e_waste: { color: '#7c3aed', bg: '#f5f3ff' },
    bulk: { color: '#d97706', bg: '#fefce8' },
}

interface Schedule {
    id: string
    district: string
    ward: string
    waste_type: string
    collection_day: string
    collection_time: string
    frequency: string
    shift: string
    scheduled_date: string
    notes: string
    published: boolean
    created_at: string
}

export default function ContractorSchedulesPage() {
    const [profile, setProfile] = useState<any>(null)
    const [schedules, setSchedules] = useState<Schedule[]>([])
    const [loading, setLoading] = useState(true)
    const [filterWard, setFilterWard] = useState('all')
    const [filterWasteType, setFilterWasteType] = useState('all')
    const [wards, setWards] = useState<string[]>([])

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase
            .from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: schedulesData } = await supabase
            .from('schedules')
            .select('*')
            .eq('district', p?.district || '')
            .eq('published', true)
            .order('scheduled_date', { ascending: true })

        const data = schedulesData || []
        setSchedules(data)

        // Extract unique wards
        const uniqueWards = [...new Set(data.map(s => s.ward).filter(Boolean))]
        setWards(uniqueWards)

        setLoading(false)
    }

    const filtered = schedules.filter(s => {
        if (filterWard !== 'all' && s.ward !== filterWard) return false
        if (filterWasteType !== 'all' && s.waste_type !== filterWasteType) return false
        return true
    })

    const today = new Date().toISOString().split('T')[0]
    const upcoming = filtered.filter(s => s.scheduled_date >= today)
    const past = filtered.filter(s => s.scheduled_date < today)

    function getWasteStyle(type: string) {
        return WASTE_STYLE[type] || { color: '#64748b', bg: '#f8fafc' }
    }

    function formatFrequency(f: string) {
        return f?.replace(/_/g, ' ') || '—'
    }

    return (
        <DashboardLayout
            role="Contractor"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={CONTRACTOR_NAV}
            primaryAction={{ label: 'Create Route', href: '/dashboard/contractor/routes', icon: 'add_road' }}
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
        .schedule-row {
          padding: 18px 24px; border-bottom: 1px solid rgba(0,69,13,0.04);
          display: flex; align-items: center; gap: 16px;
          transition: background 0.2s ease;
        }
        .schedule-row:hover { background: #f9f9ff; }
        .schedule-row:last-child { border-bottom: none; }
        .filter-btn {
          padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 700;
          font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s ease;
        }
        .filter-btn.active { background: #00450d; color: white; }
        .filter-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .filter-btn:not(.active):hover { background: #e2e8f0; }
        .badge {
          display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em;
          text-transform: uppercase; white-space: nowrap;
        }
        .create-route-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 16px; border-radius: 99px; font-size: 12px; font-weight: 700;
          font-family: 'Manrope', sans-serif; background: #00450d; color: white;
          text-decoration: none; border: none; cursor: pointer; transition: all 0.2s ease;
          white-space: nowrap; flex-shrink: 0;
        }
        .create-route-btn:hover { background: #1b5e20; box-shadow: 0 4px 12px rgba(0,69,13,0.25); }
        .section-header {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 24px; background: #f9f9ff;
          border-bottom: 1px solid rgba(0,69,13,0.04);
        }
        .section-header-line { flex: 1; height: 1px; background: rgba(0,69,13,0.08); }
        .section-header-label {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.12em; color: #717a6d; font-family: 'Manrope', sans-serif;
          white-space: nowrap;
        }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
      `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    {profile?.organisation_name || 'Contractor'} · Published Schedules
                </span>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="font-headline font-extrabold tracking-tight"
                            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                            Collection <span style={{ color: '#1b5e20' }}>Schedules</span>
                        </h1>
                        <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                            Published by District Engineer · {profile?.district}
                        </p>
                    </div>
                    <Link href="/dashboard/contractor/routes" className="create-route-btn">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_road</span>
                        Create Route from Schedule
                    </Link>
                </div>
            </section>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
                {[
                    { label: 'Total Schedules', value: schedules.length, icon: 'calendar_month', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Upcoming', value: upcoming.length, icon: 'event_upcoming', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Day Shifts', value: schedules.filter(s => s.shift !== 'night').length, icon: 'wb_sunny', color: '#d97706', bg: '#fefce8' },
                    { label: 'Night Shifts', value: schedules.filter(s => s.shift === 'night').length, icon: 'nights_stay', color: '#4338ca', bg: '#eef2ff' },
                ].map(m => (
                    <div key={m.label} className="bento-card p-5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: m.bg }}>
                            <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '18px' }}>{m.icon}</span>
                        </div>
                        <p className="font-headline font-extrabold text-2xl tracking-tight mb-0.5" style={{ color: '#181c22' }}>{m.value}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Notice */}
            <div className="mb-6 p-4 rounded-xl flex items-center gap-3"
                style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>info</span>
                <p style={{ fontSize: '13px', color: '#41493e' }}>
                    These schedules are published by your District Engineer. Create routes that match these schedules and assign drivers to them.
                </p>
            </div>

            {/* Filters */}
            <div className="bento-card s3">
                <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3"
                    style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                    <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                        Published Schedules
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Ward filter */}
                        <button onClick={() => setFilterWard('all')}
                            className={`filter-btn ${filterWard === 'all' ? 'active' : ''}`}>
                            All Wards
                        </button>
                        {wards.map(w => (
                            <button key={w} onClick={() => setFilterWard(w)}
                                className={`filter-btn ${filterWard === w ? 'active' : ''}`}>
                                {w}
                            </button>
                        ))}
                        {/* Waste type filter */}
                        <div style={{ width: '1px', height: '20px', background: 'rgba(0,69,13,0.1)' }} />
                        <select
                            value={filterWasteType}
                            onChange={e => setFilterWasteType(e.target.value)}
                            style={{ padding: '6px 14px', borderRadius: '99px', border: 'none', background: filterWasteType !== 'all' ? '#00450d' : '#f1f5f9', color: filterWasteType !== 'all' ? 'white' : '#64748b', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', cursor: 'pointer', outline: 'none' }}>
                            <option value="all">All Types</option>
                            <option value="organic">Organic</option>
                            <option value="recyclable">Recyclable</option>
                            <option value="non_recyclable">Non-Recyclable</option>
                            <option value="e_waste">E-Waste</option>
                            <option value="bulk">Bulk</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                            style={{ background: '#fefce8' }}>
                            <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: '32px' }}>
                                calendar_month
                            </span>
                        </div>
                        <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>
                            No schedules published yet
                        </p>
                        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                            Your District Engineer hasn't published any schedules for {profile?.district} yet.
                        </p>
                    </div>
                ) : (
                    <div>
                        {/* Upcoming */}
                        {upcoming.length > 0 && (
                            <>
                                <div className="section-header">
                                    <div className="section-header-line" />
                                    <span className="section-header-label">
                                        Upcoming — {upcoming.length} schedule{upcoming.length !== 1 ? 's' : ''}
                                    </span>
                                    <div className="section-header-line" />
                                </div>
                                {upcoming.map(schedule => {
                                    const ws = getWasteStyle(schedule.waste_type)
                                    return (
                                        <div key={schedule.id} className="schedule-row">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: ws.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: ws.color, fontSize: '20px' }}>
                                                    delete_sweep
                                                </span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif', textTransform: 'capitalize' }}>
                                                        {schedule.waste_type?.replace('_', ' ')}
                                                    </p>
                                                    <span className="badge" style={{ background: ws.bg, color: ws.color }}>
                                                        {schedule.waste_type}
                                                    </span>
                                                    {schedule.shift === 'night' && (
                                                        <span className="badge" style={{ background: '#eff6ff', color: '#1e3a8a' }}>
                                                            🌙 Night
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                                                    {schedule.ward && (
                                                        <span className="flex items-center gap-1">
                                                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                                            {schedule.ward}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>
                                                        {schedule.collection_day} at {schedule.collection_time}
                                                    </span>
                                                    {schedule.scheduled_date && (
                                                        <span className="flex items-center gap-1">
                                                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>event</span>
                                                            {new Date(schedule.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>repeat</span>
                                                        {formatFrequency(schedule.frequency)}
                                                    </span>
                                                </div>
                                                {schedule.notes && (
                                                    <p style={{ fontSize: '12px', color: '#717a6d', marginTop: '4px', fontStyle: 'italic' }}>
                                                        📌 {schedule.notes}
                                                    </p>
                                                )}
                                            </div>
                                            <Link
                                                href={`/dashboard/contractor/routes?schedule=${schedule.id}`}
                                                className="create-route-btn">
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add_road</span>
                                                Create Route
                                            </Link>
                                        </div>
                                    )
                                })}
                            </>
                        )}

                        {/* Past */}
                        {past.length > 0 && (
                            <>
                                <div className="section-header">
                                    <div className="section-header-line" />
                                    <span className="section-header-label">
                                        Past — {past.length} schedule{past.length !== 1 ? 's' : ''}
                                    </span>
                                    <div className="section-header-line" />
                                </div>
                                {past.map(schedule => {
                                    const ws = getWasteStyle(schedule.waste_type)
                                    return (
                                        <div key={schedule.id} className="schedule-row" style={{ opacity: 0.6 }}>
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: ws.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: ws.color, fontSize: '20px' }}>
                                                    delete_sweep
                                                </span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif', textTransform: 'capitalize' }}>
                                                        {schedule.waste_type?.replace('_', ' ')}
                                                    </p>
                                                    <span className="badge" style={{ background: '#f1f5f9', color: '#94a3b8' }}>
                                                        Past
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                                                    {schedule.ward && (
                                                        <span>{schedule.ward}</span>
                                                    )}
                                                    <span>{schedule.collection_day} at {schedule.collection_time}</span>
                                                    {schedule.scheduled_date && (
                                                        <span>{new Date(schedule.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}