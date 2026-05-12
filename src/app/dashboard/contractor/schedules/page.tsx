'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const CONTRACTOR_NAV = [
  { label: 'Home', href: '/dashboard/contractor', icon: 'dashboard' },
  { label: 'Routes', href: '/dashboard/contractor/routes', icon: 'route' },
  { label: 'Schedules', href: '/dashboard/contractor/schedules', icon: 'calendar_month' },
  { label: 'Fleet', href: '/dashboard/contractor/fleet', icon: 'local_shipping' },
  { label: 'Contracts', href: '/dashboard/contractor/contracts', icon: 'description' },
  { label: 'Breakdowns', href: '/dashboard/contractor/breakdowns', icon: 'car_crash' },
  { label: 'Incidents', href: '/dashboard/contractor/incidents', icon: 'warning' },
  { label: 'Messages', href: '/dashboard/contractor/messages', icon: 'chat' },
  { label: 'Staff', href: '/dashboard/contractor/staff', icon: 'badge' },
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
    // joined route assignment if it exists
    route_id?: string
    assigned_driver_name?: string
    assigned_vehicle?: string
    route_status?: string
}

interface Driver {
    id: string
    full_name: string
}

interface Vehicle {
    id: string
    plate_number: string
    model: string
    status: string
}

interface AssignModal {
    schedule: Schedule
    driverId: string
    vehicleId: string
    saving: boolean
    error: string
}

export default function ContractorSchedulesPage() {
    const [profile, setProfile] = useState<any>(null)
    const [schedules, setSchedules] = useState<Schedule[]>([])
    const [drivers, setDrivers] = useState<Driver[]>([])
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [loading, setLoading] = useState(true)
    const [filterWard, setFilterWard] = useState('all')
    const [filterWasteType, setFilterWasteType] = useState('all')
    const [wards, setWards] = useState<string[]>([])
    const [modal, setModal] = useState<AssignModal | null>(null)
    const [successId, setSuccessId] = useState<string | null>(null)
    const [userId, setUserId] = useState<string>('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Load schedules for this contractor's district
        const { data: schedulesData } = await supabase
            .from('schedules')
            .select('*')
            .eq('district', p?.district || '')
            .eq('published', true)
            .order('scheduled_date', { ascending: true })

        // Load existing routes keyed by schedule_id to show assignment status
        const { data: routesData } = await supabase
            .from('routes')
            .select('id, schedule_id, status, vehicle_number, driver_id, profiles!driver_id(full_name)')
            .eq('contractor_id', user.id)

        const routeBySchedule: Record<string, any> = {}
        for (const r of routesData || []) {
            if (r.schedule_id) routeBySchedule[r.schedule_id] = r
        }

        const enriched = (schedulesData || []).map(s => {
            const r = routeBySchedule[s.id]
            return {
                ...s,
                route_id: r?.id,
                assigned_driver_name: (r?.profiles as any)?.full_name || null,
                assigned_vehicle: r?.vehicle_number || null,
                route_status: r?.status || null,
            }
        })

        setSchedules(enriched)
        setWards([...new Set(enriched.map((s: any) => s.ward).filter(Boolean))])

        // Load contractor's drivers (staff with role driver)
        const { data: driversData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'driver')
            .order('full_name')
        setDrivers(driversData || [])

        // Load contractor's vehicles
        const { data: vehiclesData } = await supabase
            .from('vehicles')
            .select('id, plate_number, model, status')
            .eq('contractor_id', user.id)
            .in('status', ['active', 'available'])
            .order('plate_number')
        setVehicles(vehiclesData || [])

        setLoading(false)
    }

    function openAssign(schedule: Schedule) {
        setModal({
            schedule,
            driverId: '',
            vehicleId: '',
            saving: false,
            error: '',
        })
    }

    async function saveAssignment() {
        if (!modal) return
        if (!modal.driverId) { setModal(m => m ? { ...m, error: 'Please select a driver.' } : m); return }
        if (!modal.vehicleId) { setModal(m => m ? { ...m, error: 'Please select a vehicle.' } : m); return }

        setModal(m => m ? { ...m, saving: true, error: '' } : m)
        const supabase = createClient()

        const vehicle = vehicles.find(v => v.id === modal.vehicleId)
        const s = modal.schedule

        // Upsert a route linked to this schedule
        const routePayload = {
            schedule_id: s.id,
            contractor_id: userId,
            driver_id: modal.driverId,
            vehicle_number: vehicle?.plate_number || '',
            district: s.district,
            ward: s.ward,
            waste_type: s.waste_type,
            shift: s.shift,
            date: s.scheduled_date,
            status: 'pending',
            route_name: `${s.ward || s.district} – ${s.waste_type?.replace('_', ' ')} (${s.collection_day})`,
        }

        let error: any = null

        if (s.route_id) {
            // Update existing route
            const res = await supabase
                .from('routes')
                .update({ driver_id: modal.driverId, vehicle_number: vehicle?.plate_number || '' })
                .eq('id', s.route_id)
            error = res.error
        } else {
            // Insert new route
            const res = await supabase.from('routes').insert(routePayload)
            error = res.error
        }

        if (error) {
            setModal(m => m ? { ...m, saving: false, error: error.message } : m)
            return
        }

        setModal(null)
        setSuccessId(s.id)
        setTimeout(() => setSuccessId(null), 3000)
        loadData()
    }

    const filtered = schedules.filter(s => {
        if (filterWard !== 'all' && s.ward !== filterWard) return false
        if (filterWasteType !== 'all' && s.waste_type !== filterWasteType) return false
        return true
    })

    const today = new Date().toISOString().split('T')[0]
    const upcoming = filtered.filter(s => !s.scheduled_date || s.scheduled_date >= today)
    const past = filtered.filter(s => s.scheduled_date && s.scheduled_date < today)

    function getWasteStyle(type: string) {
        return WASTE_STYLE[type] || { color: '#64748b', bg: '#f8fafc' }
    }

    function ScheduleRow({ schedule, dimmed = false }: { schedule: Schedule; dimmed?: boolean }) {
        const ws = getWasteStyle(schedule.waste_type)
        const isAssigned = !!(schedule.assigned_driver_name && schedule.assigned_vehicle)
        const isSuccess = successId === schedule.id

        return (
            <div className="schedule-row" style={{ opacity: dimmed ? 0.55 : 1 }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: ws.bg }}>
                    <span className="material-symbols-outlined" style={{ color: ws.color, fontSize: '20px' }}>
                        delete_sweep
                    </span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif', textTransform: 'capitalize', margin: 0 }}>
                            {schedule.waste_type?.replace(/_/g, ' ')}
                        </p>
                        <span className="badge" style={{ background: ws.bg, color: ws.color }}>
                            {schedule.waste_type?.toUpperCase()}
                        </span>
                        {schedule.shift === 'night' && (
                            <span className="badge" style={{ background: '#eff6ff', color: '#1e3a8a' }}>🌙 Night</span>
                        )}
                        {dimmed && (
                            <span className="badge" style={{ background: '#f1f5f9', color: '#94a3b8' }}>Past</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                        {schedule.ward && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                {schedule.ward}
                            </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>
                            {schedule.collection_day} at {schedule.collection_time}
                        </span>
                        {schedule.scheduled_date && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>event</span>
                                {new Date(schedule.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>repeat</span>
                            {schedule.frequency?.replace(/_/g, ' ') || '—'}
                        </span>
                    </div>

                    {/* Assignment status chip */}
                    {isAssigned && (
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '99px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)', fontSize: '11px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>person_check</span>
                                {schedule.assigned_driver_name}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '99px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)', fontSize: '11px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>local_shipping</span>
                                {schedule.assigned_vehicle}
                            </span>
                        </div>
                    )}

                    {schedule.notes && (
                        <p style={{ fontSize: '12px', color: '#717a6d', marginTop: '4px', fontStyle: 'italic' }}>
                            📌 {schedule.notes}
                        </p>
                    )}
                </div>

                {/* Action button */}
                {!dimmed && (
                    isSuccess ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '99px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.2)', fontSize: '12px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                            Assigned!
                        </div>
                    ) : (
                        <button onClick={() => openAssign(schedule)} className="assign-btn">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                {isAssigned ? 'edit' : 'person_add'}
                            </span>
                            {isAssigned ? 'Reassign' : 'Assign'}
                        </button>
                    )
                )}
            </div>
        )
    }

    return (
        <DashboardLayout
            role="Contractor"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={CONTRACTOR_NAV}
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
          display: flex; align-items: flex-start; gap: 16px;
          transition: background 0.2s ease;
        }
        .schedule-row:hover { background: #f9fdf9; }
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
        .assign-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 99px; font-size: 12px; font-weight: 700;
          font-family: 'Manrope', sans-serif; background: #00450d; color: white;
          border: none; cursor: pointer; transition: all 0.2s ease;
          white-space: nowrap; flex-shrink: 0;
        }
        .assign-btn:hover { background: #1b5e20; box-shadow: 0 4px 12px rgba(0,69,13,0.25); }
        .section-header {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 24px; background: #f9fdf9;
          border-bottom: 1px solid rgba(0,69,13,0.04);
        }
        .section-header-line { flex: 1; height: 1px; background: rgba(0,69,13,0.08); }
        .section-header-label {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.12em; color: #717a6d; font-family: 'Manrope, sans-serif';
          white-space: nowrap;
        }
        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 999;
          background: rgba(0,0,0,0.4); backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
          animation: fadeIn 0.2s ease both;
        }
        .modal-box {
          background: white; border-radius: 24px; width: 100%; max-width: 480px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.2);
          animation: slideUp 0.25s ease both;
        }
        .modal-field {
          width: 100%; padding: 10px 14px; border-radius: 10px;
          border: 1.5px solid rgba(0,69,13,0.15); font-size: 13px;
          font-family: 'Manrope', sans-serif; background: #fafafa;
          color: #181c22; outline: none; transition: border-color 0.2s;
          appearance: none; cursor: pointer;
        }
        .modal-field:focus { border-color: #00450d; background: white; }
        .modal-label {
          display: block; font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.1em; color: #717a6d; margin-bottom: 6px;
          font-family: 'Manrope', sans-serif;
        }
        .btn-primary {
          padding: 11px 24px; border-radius: 99px; font-size: 13px; font-weight: 700;
          font-family: 'Manrope', sans-serif; background: #00450d; color: white;
          border: none; cursor: pointer; transition: all 0.2s ease;
          display: inline-flex; align-items: center; gap: 6px;
        }
        .btn-primary:hover:not(:disabled) { background: #1b5e20; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-ghost {
          padding: 11px 20px; border-radius: 99px; font-size: 13px; font-weight: 700;
          font-family: 'Manrope', sans-serif; background: transparent; color: #717a6d;
          border: 1.5px solid rgba(0,0,0,0.1); cursor: pointer; transition: all 0.2s ease;
        }
        .btn-ghost:hover { background: #f1f5f9; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
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
                <h1 className="font-headline font-extrabold tracking-tight"
                    style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Collection <span style={{ color: '#1b5e20' }}>Schedules</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                    Published by District Engineer · {profile?.district}
                </p>
            </section>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
                {[
                    { label: 'Total Schedules', value: schedules.length, icon: 'calendar_month', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Upcoming', value: upcoming.length, icon: 'event_upcoming', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Assigned', value: schedules.filter(s => s.assigned_driver_name).length, icon: 'person_check', color: '#16a34a', bg: '#f0fdf4' },
                    { label: 'Unassigned', value: schedules.filter(s => !s.assigned_driver_name && (!s.scheduled_date || s.scheduled_date >= today)).length, icon: 'person_off', color: '#d97706', bg: '#fefce8' },
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
                    These schedules are published by your District Engineer. Assign a driver and vehicle to each schedule to fulfil the collection.
                </p>
            </div>

            {/* Schedule list */}
            <div className="bento-card s3">
                <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3"
                    style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                    <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Published Schedules</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setFilterWard('all')} className={`filter-btn ${filterWard === 'all' ? 'active' : ''}`}>All Wards</button>
                        {wards.map(w => (
                            <button key={w} onClick={() => setFilterWard(w)} className={`filter-btn ${filterWard === w ? 'active' : ''}`}>{w}</button>
                        ))}
                        <div style={{ width: '1px', height: '20px', background: 'rgba(0,69,13,0.1)' }} />
                        <select value={filterWasteType} onChange={e => setFilterWasteType(e.target.value)}
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
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#fefce8' }}>
                            <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: '32px' }}>calendar_month</span>
                        </div>
                        <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No schedules published yet</p>
                        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                            Your District Engineer hasn't published any schedules for {profile?.district} yet.
                        </p>
                    </div>
                ) : (
                    <div>
                        {upcoming.length > 0 && (
                            <>
                                <div className="section-header">
                                    <div className="section-header-line" />
                                    <span className="section-header-label">Upcoming — {upcoming.length} schedule{upcoming.length !== 1 ? 's' : ''}</span>
                                    <div className="section-header-line" />
                                </div>
                                {upcoming.map(s => <ScheduleRow key={s.id} schedule={s} />)}
                            </>
                        )}
                        {past.length > 0 && (
                            <>
                                <div className="section-header">
                                    <div className="section-header-line" />
                                    <span className="section-header-label">Past — {past.length} schedule{past.length !== 1 ? 's' : ''}</span>
                                    <div className="section-header-line" />
                                </div>
                                {past.map(s => <ScheduleRow key={s.id} schedule={s} dimmed />)}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Assign Modal ─────────────────────────────────────── */}
            {modal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
                    <div className="modal-box">
                        {/* Header */}
                        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(0,69,13,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>person_add</span>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                            {modal.schedule.assigned_driver_name ? 'Reassign' : 'Assign'} Driver & Vehicle
                                        </p>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#717a6d' }}>
                                            {modal.schedule.ward || modal.schedule.district} · {modal.schedule.waste_type?.replace(/_/g, ' ')} · {modal.schedule.collection_day}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setModal(null)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '8px', color: '#94a3b8', display: 'flex' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                                </button>
                            </div>
                        </div>

                        {/* Current assignment (if any) */}
                        {modal.schedule.assigned_driver_name && (
                            <div style={{ margin: '16px 28px 0', padding: '10px 14px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)', fontSize: '12px', color: '#00450d', fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                                Currently assigned: <strong>{modal.schedule.assigned_driver_name}</strong> · <strong>{modal.schedule.assigned_vehicle}</strong>
                            </div>
                        )}

                        {/* Fields */}
                        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label className="modal-label">Driver</label>
                                {drivers.length === 0 ? (
                                    <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', border: '1.5px solid rgba(186,26,26,0.15)', fontSize: '13px', color: '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}>
                                        No drivers found. Add drivers via the Staff page first.
                                    </div>
                                ) : (
                                    <select className="modal-field"
                                        value={modal.driverId}
                                        onChange={e => setModal(m => m ? { ...m, driverId: e.target.value } : m)}>
                                        <option value="">— Select a driver —</option>
                                        {drivers.map(d => (
                                            <option key={d.id} value={d.id}>{d.full_name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div>
                                <label className="modal-label">Vehicle</label>
                                {vehicles.length === 0 ? (
                                    <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', border: '1.5px solid rgba(186,26,26,0.15)', fontSize: '13px', color: '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}>
                                        No active vehicles found. Add vehicles via the Fleet page first.
                                    </div>
                                ) : (
                                    <select className="modal-field"
                                        value={modal.vehicleId}
                                        onChange={e => setModal(m => m ? { ...m, vehicleId: e.target.value } : m)}>
                                        <option value="">— Select a vehicle —</option>
                                        {vehicles.map(v => (
                                            <option key={v.id} value={v.id}>{v.plate_number} · {v.model}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {modal.error && (
                                <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', border: '1.5px solid rgba(186,26,26,0.15)', fontSize: '13px', color: '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}>
                                    {modal.error}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '0 28px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                            <button className="btn-primary" onClick={saveAssignment} disabled={modal.saving || drivers.length === 0 || vehicles.length === 0}>
                                {modal.saving ? (
                                    <>
                                        <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                        Saving…
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                                        Confirm Assignment
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </DashboardLayout>
    )
}

