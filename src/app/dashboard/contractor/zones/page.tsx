'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const CONTRACTOR_NAV = [
  { label: 'Overview', href: '/dashboard/contractor', icon: 'dashboard' },
  { label: 'Routes', href: '/dashboard/contractor/routes', icon: 'route' },
  { label: 'Schedules', href: '/dashboard/contractor/schedules', icon: 'calendar_month' },
  { label: 'Fleet', href: '/dashboard/contractor/fleet', icon: 'local_shipping' },
  { label: 'Contracts', href: '/dashboard/contractor/contracts', icon: 'description' },
  { label: 'Incidents', href: '/dashboard/contractor/incidents', icon: 'warning' },
  { label: 'Messages', href: '/dashboard/contractor/messages', icon: 'chat' },
  { label: 'Zones', href: '/dashboard/contractor/zones', icon: 'map' },
  { label: 'Staff', href: '/dashboard/contractor/staff', icon: 'badge' },
]

type ZoneAssignment = {
    id: string
    contractor_id: string
    ward: string
    district: string
    assigned_date: string
    status: string
    notes: string
    created_at: string
}

type RouteSchedule = {
    id: string
    route_id: string
    contractor_id: string
    ward: string
    district: string
    day_of_week: string
    estimated_start_time: string
    estimated_duration_minutes: number
    waste_type: string
    status: string
    route?: { route_name: string; ward: string; district: string; status: string }
}

type CollectionStop = {
    id: string
    route_id: string
    address: string
    latitude: number
    longitude: number
    stop_order: number
    status: string
    bin_count: number
    road_name: string
}

type Route = {
    id: string
    route_name: string
    ward: string
    district: string
    status: string
    date: string
    shift: string
}

function zoneStatusStyle(status: string) {
    switch (status) {
        case 'active': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Active' }
        case 'suspended': return { bg: '#fefce8', color: '#92400e', dot: '#d97706', label: 'Suspended' }
        case 'reassigned': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Reassigned' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: status }
    }
}

function dayColor(day: string) {
    const colors: Record<string, { bg: string; color: string }> = {
        monday: { bg: '#f0f9ff', color: '#0369a1' },
        tuesday: { bg: '#f0fdf4', color: '#00450d' },
        wednesday: { bg: '#fefce8', color: '#92400e' },
        thursday: { bg: '#fff7ed', color: '#c2410c' },
        friday: { bg: '#f5f3ff', color: '#7c3aed' },
        saturday: { bg: '#fdf4ff', color: '#a21caf' },
        sunday: { bg: '#fef2f2', color: '#ba1a1a' },
    }
    return colors[day] || { bg: '#f8fafc', color: '#64748b' }
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function ContractorZonesPage() {
    const [profile, setProfile] = useState<any>(null)
    const [zones, setZones] = useState<ZoneAssignment[]>([])
    const [schedules, setSchedules] = useState<RouteSchedule[]>([])
    const [routes, setRoutes] = useState<Route[]>([])
    const [selectedZone, setSelectedZone] = useState<ZoneAssignment | null>(null)
    const [zoneStops, setZoneStops] = useState<CollectionStop[]>([])
    const [zoneRoutes, setZoneRoutes] = useState<Route[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'zones' | 'schedules' | 'stops'>('zones')
    const [showScheduleForm, setShowScheduleForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [scheduleForm, setScheduleForm] = useState({
        route_id: '',
        day_of_week: 'monday',
        estimated_start_time: '07:00',
        estimated_duration_minutes: '120',
        waste_type: 'general',
    })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: zonesData } = await supabase
            .from('zone_assignments')
            .select('*')
            .eq('contractor_id', user.id)
            .order('ward', { ascending: true })
        setZones(zonesData || [])

        const { data: schedulesData } = await supabase
            .from('route_schedules')
            .select('*, route:routes!route_schedules_route_id_fkey(route_name, ward, district, status)')
            .eq('contractor_id', user.id)
            .order('day_of_week', { ascending: true })
        setSchedules(schedulesData || [])

        const { data: routesData } = await supabase
            .from('routes')
            .select('*')
            .eq('contractor_id', user.id)
            .order('route_name', { ascending: true })
        setRoutes(routesData || [])

        setLoading(false)
    }

    async function loadZoneDetails(zone: ZoneAssignment) {
        const supabase = createClient()

        // Get routes for this zone
        const { data: routesData } = await supabase
            .from('routes')
            .select('*')
            .eq('contractor_id', zone.contractor_id)
            .eq('ward', zone.ward)
        setZoneRoutes(routesData || [])

        // Get collection stops for these routes
        if (routesData && routesData.length > 0) {
            const routeIds = routesData.map(r => r.id)
            const { data: stopsData } = await supabase
                .from('collection_stops')
                .select('*')
                .in('route_id', routeIds)
                .order('stop_order', { ascending: true })
            setZoneStops(stopsData || [])
        } else {
            setZoneStops([])
        }

        setSelectedZone(zone)
    }

    async function addRouteSchedule() {
        if (!scheduleForm.route_id || !scheduleForm.day_of_week) {
            setErrorMsg('Route and day of week are required.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const selectedRoute = routes.find(r => r.id === scheduleForm.route_id)

        const { error } = await supabase.from('route_schedules').insert({
            route_id: scheduleForm.route_id,
            contractor_id: user.id,
            ward: selectedRoute?.ward || null,
            district: selectedRoute?.district || null,
            day_of_week: scheduleForm.day_of_week,
            estimated_start_time: scheduleForm.estimated_start_time,
            estimated_duration_minutes: parseInt(scheduleForm.estimated_duration_minutes) || null,
            waste_type: scheduleForm.waste_type,
            status: 'active',
        })

        if (error) {
            setErrorMsg('Failed to add schedule: ' + error.message)
        } else {
            setSuccessMsg('Route schedule added successfully.')
            setShowScheduleForm(false)
            setScheduleForm({
                route_id: '',
                day_of_week: 'monday',
                estimated_start_time: '07:00',
                estimated_duration_minutes: '120',
                waste_type: 'general',
            })
            loadData()
        }
        setSubmitting(false)
    }

    async function deleteSchedule(scheduleId: string) {
        if (!confirm('Remove this schedule?')) return
        const supabase = createClient()
        await supabase.from('route_schedules').delete().eq('id', scheduleId)
        setSuccessMsg('Schedule removed.')
        loadData()
    }

    // Group schedules by day
    const schedulesByDay = DAYS.reduce((acc, day) => {
        acc[day] = schedules.filter(s => s.day_of_week === day)
        return acc
    }, {} as Record<string, RouteSchedule[]>)

    const stats = {
        totalZones: zones.length,
        activeZones: zones.filter(z => z.status === 'active').length,
        totalRoutes: routes.length,
        totalStops: zoneStops.length,
        totalSchedules: schedules.length,
    }

    // Group zones by district
    const zonesByDistrict = zones.reduce((acc, zone) => {
        if (!acc[zone.district]) acc[zone.district] = []
        acc[zone.district].push(zone)
        return acc
    }, {} as Record<string, ZoneAssignment[]>)

    return (
        <DashboardLayout
            role="Contractor"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={CONTRACTOR_NAV}
            primaryAction={{ label: 'Add Schedule', href: '#', icon: 'add' }}
        >
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .bento-card-green { background:#00450d; border-radius:16px; color:white; overflow:hidden; position:relative; }
        .status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .tab-btn { padding:10px 20px; border-radius:10px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:none; transition:all 0.2s; }
        .tab-active { background:#00450d; color:white; }
        .tab-inactive { background:transparent; color:#717a6d; }
        .tab-inactive:hover { background:#f0fdf4; color:#00450d; }
        .zone-card { background:white; border-radius:16px; border:1.5px solid rgba(0,69,13,0.06); padding:24px; cursor:pointer; transition:all 0.3s cubic-bezier(0.05,0.7,0.1,1.0); }
        .zone-card:hover { transform:translateY(-4px); box-shadow:0 20px 40px -15px rgba(0,69,13,0.12); border-color:rgba(0,69,13,0.15); }
        .stop-row { padding:12px 20px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:12px; }
        .stop-row:last-child { border-bottom:none; }
        .form-input { width:100%; padding:10px 14px; border-radius:10px; border:1.5px solid rgba(0,69,13,0.15); font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:white; color:#181c22; }
        .form-input:focus { border-color:#00450d; }
        .form-label { font-size:12px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.05em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#00450d; color:white; border:none; padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity 0.2s; }
        .btn-primary:hover { opacity:0.88; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
        .day-col { flex:1; min-width:0; }
        .schedule-item { padding:10px 12px; border-radius:10px; margin-bottom:6px; cursor:pointer; transition:all 0.15s; }
        .schedule-item:hover { opacity:0.85; }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1 { animation:staggerIn 0.5s ease 0.05s both; }
        .s2 { animation:staggerIn 0.5s ease 0.10s both; }
        .s3 { animation:staggerIn 0.5s ease 0.15s both; }
        .s4 { animation:staggerIn 0.5s ease 0.20s both; }
        .s5 { animation:staggerIn 0.5s ease 0.25s both; }
      `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="font-headline font-extrabold tracking-tight"
                            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                            Zone & Route <span style={{ color: '#1b5e20' }}>Assignment</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            View assigned zones, routes and collection schedules
                        </p>
                    </div>
                    <button className="btn-primary"
                        onClick={() => { setShowScheduleForm(true); setErrorMsg('') }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                        Add Schedule
                    </button>
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {successMsg && (
                        <div className="mb-6 p-4 rounded-xl flex items-center gap-3"
                            style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>check_circle</span>
                            <p className="text-sm font-medium" style={{ color: '#00450d' }}>{successMsg}</p>
                            <button onClick={() => setSuccessMsg('')} className="ml-auto"
                                style={{ color: '#00450d', background: 'none', border: 'none', cursor: 'pointer' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                            </button>
                        </div>
                    )}

                    {/* Hero stats */}
                    <div className="bento-card-green p-8 mb-6 s2">
                        <div className="absolute top-0 right-0 w-56 h-56 rounded-full -mr-20 -mt-20"
                            style={{ background: 'rgba(163,246,156,0.06)' }} />
                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-8">
                                <div>
                                    <span className="text-xs font-bold uppercase block mb-2"
                                        style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                                        Coverage Overview
                                    </span>
                                    <h2 className="font-headline font-extrabold text-3xl tracking-tight">
                                        {stats.activeZones} Active Zones
                                    </h2>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '4px' }}>
                                        Assigned by Colombo Municipal Council
                                    </p>
                                </div>
                                <div className="p-3 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>map</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Zones', value: stats.totalZones, icon: 'location_on' },
                                    { label: 'Routes', value: stats.totalRoutes, icon: 'route' },
                                    { label: 'Schedules', value: stats.totalSchedules, icon: 'calendar_month' },
                                    { label: 'Districts', value: Object.keys(zonesByDistrict).length, icon: 'corporate_fare' },
                                ].map(m => (
                                    <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                        <span className="material-symbols-outlined mb-2 block"
                                            style={{ color: 'rgba(163,246,156,0.7)', fontSize: '18px' }}>{m.icon}</span>
                                        <p className="font-headline font-bold text-2xl">{m.value}</p>
                                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-2 mb-6 s3">
                        {(['zones', 'schedules', 'stops'] as const).map(tab => (
                            <button key={tab} className={`tab-btn ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`}
                                onClick={() => setActiveTab(tab)}>
                                {tab === 'zones' ? `Zones (${zones.length})` :
                                    tab === 'schedules' ? `Weekly Schedule (${schedules.length})` :
                                        `Routes (${routes.length})`}
                            </button>
                        ))}
                    </div>

                    {/* Zones Tab */}
                    {activeTab === 'zones' && (
                        <div className="s4">
                            {zones.length === 0 ? (
                                <div className="bento-card p-16 flex flex-col items-center justify-center text-center">
                                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '40px' }}>map</span>
                                    </div>
                                    <h2 className="font-headline font-bold text-xl mb-2" style={{ color: '#181c22' }}>
                                        No zones assigned
                                    </h2>
                                    <p className="text-sm" style={{ color: '#717a6d' }}>
                                        Contact CMC admin to get zones assigned to your contract
                                    </p>
                                </div>
                            ) : (
                                Object.entries(zonesByDistrict).map(([district, districtZones]) => (
                                    <div key={district} className="mb-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                                style={{ background: '#f0fdf4' }}>
                                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '16px' }}>
                                                    corporate_fare
                                                </span>
                                            </div>
                                            <h3 className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>
                                                {district}
                                            </h3>
                                            <span className="text-sm" style={{ color: '#94a3b8' }}>
                                                {districtZones.length} ward{districtZones.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {districtZones.map(zone => {
                                                const zs = zoneStatusStyle(zone.status)
                                                const zoneRouteCount = routes.filter(r => r.ward === zone.ward).length
                                                const zoneScheduleCount = schedules.filter(s => s.ward === zone.ward).length
                                                return (
                                                    <div key={zone.id} className="zone-card" onClick={() => loadZoneDetails(zone)}>
                                                        <div className="flex items-start justify-between mb-4">
                                                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                                                style={{ background: zs.bg }}>
                                                                <span className="material-symbols-outlined" style={{ color: zs.color, fontSize: '24px' }}>
                                                                    location_on
                                                                </span>
                                                            </div>
                                                            <span className="status-badge" style={{ background: zs.bg, color: zs.color }}>
                                                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: zs.dot }} />
                                                                {zs.label}
                                                            </span>
                                                        </div>
                                                        <h3 className="font-headline font-bold text-xl mb-1" style={{ color: '#181c22' }}>
                                                            {zone.ward}
                                                        </h3>
                                                        <p className="text-sm mb-4" style={{ color: '#717a6d' }}>{zone.district}</p>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {[
                                                                { label: 'Routes', value: zoneRouteCount, icon: 'route' },
                                                                { label: 'Schedules', value: zoneScheduleCount, icon: 'calendar_month' },
                                                            ].map(m => (
                                                                <div key={m.label} className="p-3 rounded-xl text-center"
                                                                    style={{ background: '#f8fafc' }}>
                                                                    <span className="material-symbols-outlined mb-1 block"
                                                                        style={{ color: '#00450d', fontSize: '16px' }}>{m.icon}</span>
                                                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>{m.value}</p>
                                                                    <p className="text-xs" style={{ color: '#94a3b8' }}>{m.label}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-4 pt-4 flex items-center justify-between"
                                                            style={{ borderTop: '1px solid rgba(0,69,13,0.06)' }}>
                                                            <p className="text-xs" style={{ color: '#94a3b8' }}>
                                                                Since {new Date(zone.assigned_date).toLocaleDateString('en-GB')}
                                                            </p>
                                                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '16px' }}>
                                                                chevron_right
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Schedules Tab — Weekly Calendar View */}
                    {activeTab === 'schedules' && (
                        <div className="s4">
                            <div className="bento-card mb-4">
                                <div className="px-6 py-5 flex items-center justify-between"
                                    style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                    <h3 className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>
                                        Weekly Collection Schedule
                                    </h3>
                                    <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}
                                        onClick={() => { setShowScheduleForm(true); setErrorMsg('') }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                                        Add Schedule
                                    </button>
                                </div>

                                {schedules.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                            style={{ background: '#f0fdf4' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>
                                                calendar_month
                                            </span>
                                        </div>
                                        <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>
                                            No schedules yet
                                        </p>
                                        <p className="text-sm mt-1 mb-6" style={{ color: '#94a3b8' }}>
                                            Add route schedules to plan your weekly collections
                                        </p>
                                        <button className="btn-primary" onClick={() => setShowScheduleForm(true)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                            Add Schedule
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-6">
                                        <div className="grid grid-cols-7 gap-3">
                                            {DAYS.map(day => {
                                                const dc = dayColor(day)
                                                const daySchedules = schedulesByDay[day] || []
                                                return (
                                                    <div key={day} className="day-col">
                                                        <div className="text-center mb-3 p-2 rounded-xl"
                                                            style={{ background: dc.bg }}>
                                                            <p className="text-xs font-bold uppercase"
                                                                style={{ color: dc.color, letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                                                {day.slice(0, 3)}
                                                            </p>
                                                        </div>
                                                        {daySchedules.length === 0 ? (
                                                            <div className="p-3 rounded-xl text-center"
                                                                style={{ background: '#f8fafc', border: '1px dashed rgba(0,69,13,0.1)' }}>
                                                                <p className="text-xs" style={{ color: '#94a3b8' }}>No routes</p>
                                                            </div>
                                                        ) : (
                                                            daySchedules.map(s => (
                                                                <div key={s.id} className="schedule-item"
                                                                    style={{ background: dc.bg, border: `1px solid ${dc.color}20` }}>
                                                                    <p className="text-xs font-bold truncate" style={{ color: dc.color }}>
                                                                        {s.route?.route_name || s.ward || 'Route'}
                                                                    </p>
                                                                    <p className="text-xs mt-1" style={{ color: dc.color, opacity: 0.7 }}>
                                                                        {s.estimated_start_time || 'N/A'}
                                                                    </p>
                                                                    <p className="text-xs mt-0.5" style={{ color: dc.color, opacity: 0.7 }}>
                                                                        {s.waste_type}
                                                                    </p>
                                                                    <button
                                                                        onClick={() => deleteSchedule(s.id)}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: dc.color, opacity: 0.5, marginTop: '4px', padding: 0, fontSize: '10px', fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>
                                                                        remove
                                                                    </button>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Routes/Stops Tab */}
                    {activeTab === 'stops' && (
                        <div className="s4">
                            {routes.length === 0 ? (
                                <div className="bento-card p-16 flex flex-col items-center justify-center text-center">
                                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '40px' }}>route</span>
                                    </div>
                                    <h2 className="font-headline font-bold text-xl mb-2" style={{ color: '#181c22' }}>No routes yet</h2>
                                    <p className="text-sm" style={{ color: '#717a6d' }}>
                                        Create routes to start tracking collection stops
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {routes.map(route => {
                                        const routeStops = zoneStops.filter(s => s.route_id === route.id)
                                        const completedStops = routeStops.filter(s => s.status === 'completed').length
                                        return (
                                            <div key={route.id} className="bento-card">
                                                <div className="px-6 py-5 flex items-center justify-between"
                                                    style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                                    <div>
                                                        <h3 className="font-headline font-bold text-base" style={{ color: '#181c22' }}>
                                                            {route.route_name}
                                                        </h3>
                                                        <p className="text-xs mt-0.5" style={{ color: '#717a6d' }}>
                                                            {route.ward} · {route.district} · {route.shift}
                                                        </p>
                                                    </div>
                                                    <span className="status-badge"
                                                        style={{
                                                            background: route.status === 'completed' ? '#f0fdf4' : route.status === 'active' ? '#f0fdf4' : '#fefce8',
                                                            color: route.status === 'completed' ? '#00450d' : route.status === 'active' ? '#00450d' : '#92400e'
                                                        }}>
                                                        {route.status}
                                                    </span>
                                                </div>
                                                <div className="p-4">
                                                    {routeStops.length === 0 ? (
                                                        <button
                                                            onClick={async () => {
                                                                const supabase = createClient()
                                                                const { data } = await supabase
                                                                    .from('collection_stops')
                                                                    .select('*')
                                                                    .eq('route_id', route.id)
                                                                    .order('stop_order')
                                                                setZoneStops(prev => [...prev.filter(s => s.route_id !== route.id), ...(data || [])])
                                                            }}
                                                            style={{ width: '100%', padding: '10px', borderRadius: '10px', background: '#f8fafc', border: '1px dashed rgba(0,69,13,0.1)', cursor: 'pointer', color: '#94a3b8', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                                                            Click to load stops
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center justify-between mb-3">
                                                                <p className="text-xs font-bold uppercase"
                                                                    style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                                                    {routeStops.length} stops · {completedStops} completed
                                                                </p>
                                                                <div className="flex-1 mx-3 h-1.5 rounded-full" style={{ background: '#f0fdf4' }}>
                                                                    <div className="h-full rounded-full" style={{
                                                                        width: routeStops.length > 0 ? `${(completedStops / routeStops.length) * 100}%` : '0%',
                                                                        background: '#00450d'
                                                                    }} />
                                                                </div>
                                                            </div>
                                                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                                {routeStops.map(stop => (
                                                                    <div key={stop.id} className="stop-row">
                                                                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                                                                            style={{ background: stop.status === 'completed' ? '#f0fdf4' : '#f8fafc', color: stop.status === 'completed' ? '#00450d' : '#94a3b8' }}>
                                                                            {stop.stop_order}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-xs font-medium truncate" style={{ color: '#181c22' }}>
                                                                                {stop.road_name || stop.address}
                                                                            </p>
                                                                            {stop.bin_count && (
                                                                                <p className="text-xs" style={{ color: '#94a3b8' }}>
                                                                                    {stop.bin_count} bins
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                        <span className="material-symbols-outlined"
                                                                            style={{ color: stop.status === 'completed' ? '#16a34a' : '#94a3b8', fontSize: '16px' }}>
                                                                            {stop.status === 'completed' ? 'check_circle' : 'radio_button_unchecked'}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Zone Detail Modal */}
                    {selectedZone && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            {selectedZone.ward}
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>{selectedZone.district}</p>
                                    </div>
                                    <button onClick={() => setSelectedZone(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[
                                        { label: 'Status', value: selectedZone.status },
                                        { label: 'Assigned Since', value: new Date(selectedZone.assigned_date).toLocaleDateString('en-GB') },
                                        { label: 'Routes in Zone', value: zoneRoutes.length.toString() },
                                        { label: 'Collection Stops', value: zoneStops.length.toString() },
                                    ].map(item => (
                                        <div key={item.label} className="p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                                            <p className="text-xs font-bold uppercase mb-1"
                                                style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                                {item.label}
                                            </p>
                                            <p className="text-sm font-semibold capitalize" style={{ color: '#181c22' }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {zoneRoutes.length > 0 && (
                                    <div className="mb-6">
                                        <p className="text-xs font-bold uppercase mb-3"
                                            style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                            Routes in this zone
                                        </p>
                                        <div className="space-y-2">
                                            {zoneRoutes.map(r => (
                                                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl"
                                                    style={{ background: '#f8fafc' }}>
                                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>route</span>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium" style={{ color: '#181c22' }}>{r.route_name}</p>
                                                        <p className="text-xs" style={{ color: '#94a3b8' }}>{r.shift} · {new Date(r.date).toLocaleDateString('en-GB')}</p>
                                                    </div>
                                                    <span className="status-badge" style={{ background: '#f0fdf4', color: '#00450d', fontSize: '10px', padding: '2px 8px' }}>
                                                        {r.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedZone.notes && (
                                    <div className="p-4 rounded-xl mb-6" style={{ background: '#f8fafc' }}>
                                        <p className="text-xs font-bold uppercase mb-1"
                                            style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>Notes</p>
                                        <p className="text-sm" style={{ color: '#4b5563' }}>{selectedZone.notes}</p>
                                    </div>
                                )}

                                <button className="btn-secondary w-full justify-center" onClick={() => setSelectedZone(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Add Schedule Modal */}
                    {showScheduleForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Add Route Schedule</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>Assign a route to a day of the week</p>
                                    </div>
                                    <button onClick={() => { setShowScheduleForm(false); setErrorMsg('') }}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                {errorMsg && (
                                    <div className="mb-4 p-3 rounded-xl flex items-center gap-2"
                                        style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '16px' }}>error</span>
                                        <p className="text-xs font-medium" style={{ color: '#ba1a1a' }}>{errorMsg}</p>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <label className="form-label">Route *</label>
                                        <select className="form-input"
                                            value={scheduleForm.route_id}
                                            onChange={e => setScheduleForm(f => ({ ...f, route_id: e.target.value }))}>
                                            <option value="">Select route...</option>
                                            {routes.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    {r.route_name} — {r.ward}, {r.district}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Day of Week *</label>
                                            <select className="form-input"
                                                value={scheduleForm.day_of_week}
                                                onChange={e => setScheduleForm(f => ({ ...f, day_of_week: e.target.value }))}>
                                                {DAYS.map(d => (
                                                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">Start Time</label>
                                            <input type="time" className="form-input"
                                                value={scheduleForm.estimated_start_time}
                                                onChange={e => setScheduleForm(f => ({ ...f, estimated_start_time: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Duration (mins)</label>
                                            <input type="number" className="form-input" placeholder="e.g. 120"
                                                value={scheduleForm.estimated_duration_minutes}
                                                onChange={e => setScheduleForm(f => ({ ...f, estimated_duration_minutes: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Waste Type</label>
                                            <select className="form-input"
                                                value={scheduleForm.waste_type}
                                                onChange={e => setScheduleForm(f => ({ ...f, waste_type: e.target.value }))}>
                                                <option value="general">General</option>
                                                <option value="organic">Organic</option>
                                                <option value="recyclable">Recyclable</option>
                                                <option value="bulk">Bulk</option>
                                                <option value="e_waste">E-Waste</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setShowScheduleForm(false); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={addRouteSchedule} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                                                Add Schedule
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}
