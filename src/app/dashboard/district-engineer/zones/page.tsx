'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { DISTRICT_WARD_MAP } from '@/lib/districts'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
    { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
    { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
    { label: 'Heatmap', href: '/dashboard/district-engineer/heatmap', icon: 'thermostat' },
    { label: 'Complaints', href: '/dashboard/district-engineer/complaints', icon: 'feedback' },
    { label: 'Waste Reports', href: '/dashboard/district-engineer/waste-reports', icon: 'report' },
    { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
    { label: 'Zones', href: '/dashboard/district-engineer/zones', icon: 'map' },
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
    contractor?: { full_name: string; organisation_name: string }
}

type Route = {
    id: string
    route_name: string
    ward: string
    district: string
    status: string
    date: string
    shift: string
    driver_id: string
    contractor_id: string
    driver?: { full_name: string }
    contractor?: { full_name: string; organisation_name: string }
}

function zoneStatusStyle(status: string) {
    switch (status) {
        case 'active': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Active' }
        case 'suspended': return { bg: '#fefce8', color: '#92400e', dot: '#d97706', label: 'Suspended' }
        case 'reassigned': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Reassigned' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: status }
    }
}

function routeStatusStyle(status: string) {
    switch (status) {
        case 'active': return { bg: '#f0fdf4', color: '#00450d' }
        case 'completed': return { bg: '#eff6ff', color: '#1d4ed8' }
        case 'pending': return { bg: '#fefce8', color: '#92400e' }
        default: return { bg: '#f8fafc', color: '#64748b' }
    }
}

const EMPTY_ZONE_FORM = {
    contractor_id: '',
    ward: '',
    district: '',
    assigned_date: new Date().toISOString().split('T')[0],
    notes: '',
}

const EMPTY_ROUTE_FORM = {
    route_name: '',
    ward: '',
    district: '',
    driver_id: '',
    contractor_id: '',
    vehicle_number: '',
    shift: 'morning',
    date: new Date().toISOString().split('T')[0],
}

export default function DEZonesPage() {
    const [profile, setProfile] = useState<any>(null)
    const [zones, setZones] = useState<ZoneAssignment[]>([])
    const [routes, setRoutes] = useState<Route[]>([])
    const [contractors, setContractors] = useState<any[]>([])
    const [drivers, setDrivers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'zones' | 'routes'>('zones')
    const [selectedZone, setSelectedZone] = useState<ZoneAssignment | null>(null)
    const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
    const [showZoneForm, setShowZoneForm] = useState(false)
    const [showRouteForm, setShowRouteForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [zoneForm, setZoneForm] = useState(EMPTY_ZONE_FORM)
    const [routeForm, setRouteForm] = useState(EMPTY_ROUTE_FORM)
    const [filterDistrict, setFilterDistrict] = useState('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: zonesData } = await supabase
            .from('zone_assignments')
            .select('*, contractor:profiles!zone_assignments_contractor_id_fkey(full_name, organisation_name)')
            .order('district', { ascending: true })
        setZones(zonesData || [])

        const { data: routesData } = await supabase
            .from('routes')
            .select('*, driver:profiles!routes_driver_id_fkey(full_name), contractor:profiles!routes_contractor_id_fkey(full_name, organisation_name)')
            .order('date', { ascending: false })
            .limit(50)
        setRoutes(routesData || [])

        const { data: contractorsData } = await supabase
            .from('profiles')
            .select('id, full_name, organisation_name')
            .eq('role', 'contractor')
            .eq('is_approved', true)
        setContractors(contractorsData || [])

        const { data: driversData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'driver')
        setDrivers(driversData || [])

        setLoading(false)
    }

    async function createZone() {
        if (!zoneForm.contractor_id || !zoneForm.ward || !zoneForm.district) {
            setErrorMsg('Contractor, ward and district are required.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('zone_assignments').insert({
            contractor_id: zoneForm.contractor_id,
            ward: zoneForm.ward,
            district: zoneForm.district,
            assigned_date: zoneForm.assigned_date,
            notes: zoneForm.notes || null,
            assigned_by: user.id,
            status: 'active',
        })

        if (error) {
            setErrorMsg(error.message.includes('unique') ?
                'This contractor is already assigned to this ward.' :
                'Failed to create assignment: ' + error.message)
        } else {
            setSuccessMsg('Zone assigned successfully.')
            setShowZoneForm(false)
            setZoneForm(EMPTY_ZONE_FORM)
            loadData()
        }
        setSubmitting(false)
    }

    async function createRoute() {
        if (!routeForm.route_name || !routeForm.district) {
            setErrorMsg('Route name and district are required.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('routes').insert({
            route_name: routeForm.route_name,
            ward: routeForm.ward || null,
            district: routeForm.district,
            driver_id: routeForm.driver_id || null,
            contractor_id: routeForm.contractor_id || null,
            vehicle_number: routeForm.vehicle_number || null,
            shift: routeForm.shift,
            date: routeForm.date,
            status: 'pending',
            created_by: user.id,
        })

        if (error) {
            setErrorMsg('Failed to create route: ' + error.message)
        } else {
            setSuccessMsg('Route created successfully.')
            setShowRouteForm(false)
            setRouteForm(EMPTY_ROUTE_FORM)
            loadData()
        }
        setSubmitting(false)
    }

    async function updateZoneStatus(zoneId: string, newStatus: string) {
        const supabase = createClient()
        await supabase.from('zone_assignments').update({ status: newStatus }).eq('id', zoneId)
        setSuccessMsg('Zone status updated.')
        setSelectedZone(null)
        loadData()
    }

    async function updateRouteStatus(routeId: string, newStatus: string) {
        const supabase = createClient()
        await supabase.from('routes').update({ status: newStatus }).eq('id', routeId)
        setSuccessMsg('Route status updated.')
        setSelectedRoute(null)
        loadData()
    }

    const allDistricts = Object.keys(DISTRICT_WARD_MAP)

    const filteredZones = filterDistrict === 'all'
        ? zones : zones.filter(z => z.district === filterDistrict)

    const filteredRoutes = filterDistrict === 'all'
        ? routes : routes.filter(r => r.district === filterDistrict)

    const stats = {
        totalZones: zones.length,
        activeZones: zones.filter(z => z.status === 'active').length,
        totalRoutes: routes.length,
        activeRoutes: routes.filter(r => r.status === 'active').length,
        pendingRoutes: routes.filter(r => r.status === 'pending').length,
    }

    return (
        <DashboardLayout
            role="District Engineer"
            userName={profile?.full_name || ''}
            navItems={DE_NAV}
            primaryAction={{ label: 'New Schedule', href: '/dashboard/district-engineer/schedules/new', icon: 'add' }}
        >
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .tab-btn { padding:10px 20px; border-radius:10px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:none; transition:all 0.2s; }
        .tab-active { background:#00450d; color:white; }
        .tab-inactive { background:transparent; color:#717a6d; }
        .tab-inactive:hover { background:#f0fdf4; color:#00450d; }
        .list-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .list-row:hover { background:#f9fafb; }
        .list-row:last-child { border-bottom:none; }
        .filter-btn { padding:6px 14px; border-radius:8px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:1.5px solid transparent; transition:all 0.2s; }
        .form-input { width:100%; padding:10px 14px; border-radius:10px; border:1.5px solid rgba(0,69,13,0.15); font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:white; color:#181c22; }
        .form-input:focus { border-color:#00450d; }
        .form-label { font-size:12px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.05em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#00450d; color:white; border:none; padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity 0.2s; }
        .btn-primary:hover { opacity:0.88; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1 { animation:staggerIn 0.5s ease 0.05s both; }
        .s2 { animation:staggerIn 0.5s ease 0.10s both; }
        .s3 { animation:staggerIn 0.5s ease 0.15s both; }
        .s4 { animation:staggerIn 0.5s ease 0.20s both; }
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
                            Assign zones to contractors and manage collection routes
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button className="btn-secondary"
                            onClick={() => { setShowZoneForm(true); setErrorMsg('') }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>location_on</span>
                            Assign Zone
                        </button>
                        <button className="btn-primary"
                            onClick={() => { setShowRouteForm(true); setErrorMsg('') }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_road</span>
                            Create Route
                        </button>
                    </div>
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

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 s2">
                        {[
                            { label: 'Total Zones', value: stats.totalZones, color: '#00450d', bg: '#f0fdf4', icon: 'map' },
                            { label: 'Active Zones', value: stats.activeZones, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                            { label: 'Total Routes', value: stats.totalRoutes, color: '#0369a1', bg: '#f0f9ff', icon: 'route' },
                            { label: 'Active Routes', value: stats.activeRoutes, color: '#00450d', bg: '#f0fdf4', icon: 'directions_car' },
                            { label: 'Pending Routes', value: stats.pendingRoutes, color: '#92400e', bg: '#fefce8', icon: 'pending' },
                        ].map(s => (
                            <div key={s.label} className="bento-card p-5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                                    style={{ background: s.bg }}>
                                    <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '18px' }}>{s.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-2xl" style={{ color: '#181c22' }}>{s.value}</p>
                                <p className="text-xs font-bold uppercase mt-1"
                                    style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Tabs + District filter */}
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3 s3">
                        <div className="flex items-center gap-2">
                            <button className={`tab-btn ${activeTab === 'zones' ? 'tab-active' : 'tab-inactive'}`}
                                onClick={() => setActiveTab('zones')}>
                                Zones ({zones.length})
                            </button>
                            <button className={`tab-btn ${activeTab === 'routes' ? 'tab-active' : 'tab-inactive'}`}
                                onClick={() => setActiveTab('routes')}>
                                Routes ({routes.length})
                            </button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase"
                                style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                District:
                            </span>
                            <button className="filter-btn"
                                onClick={() => setFilterDistrict('all')}
                                style={{
                                    background: filterDistrict === 'all' ? '#00450d' : '#f8fafc',
                                    color: filterDistrict === 'all' ? 'white' : '#64748b',
                                    borderColor: filterDistrict === 'all' ? '#00450d' : 'rgba(0,69,13,0.1)',
                                }}>
                                All
                            </button>
                            {allDistricts.map(d => (
                                <button key={d} className="filter-btn"
                                    onClick={() => setFilterDistrict(d)}
                                    style={{
                                        background: filterDistrict === d ? '#00450d' : '#f8fafc',
                                        color: filterDistrict === d ? 'white' : '#64748b',
                                        borderColor: filterDistrict === d ? '#00450d' : 'rgba(0,69,13,0.1)',
                                    }}>
                                    {d.split(' - ')[0]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Zones Tab */}
                    {activeTab === 'zones' && (
                        <div className="bento-card s4">
                            {filteredZones.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>map</span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No zones found</p>
                                    <p className="text-sm mt-1 mb-6" style={{ color: '#94a3b8' }}>
                                        Assign zones to contractors to get started
                                    </p>
                                    <button className="btn-primary" onClick={() => setShowZoneForm(true)}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                        Assign Zone
                                    </button>
                                </div>
                            ) : (
                                filteredZones.map(zone => {
                                    const zs = zoneStatusStyle(zone.status)
                                    const contractorName = zone.contractor?.organisation_name || zone.contractor?.full_name || 'Unknown'
                                    return (
                                        <div key={zone.id} className="list-row" onClick={() => setSelectedZone(zone)}>
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: zs.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: zs.color, fontSize: '20px' }}>
                                                    location_on
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22' }}>{zone.ward}</p>
                                                    <span className="status-badge" style={{ background: zs.bg, color: zs.color }}>
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: zs.dot }} />
                                                        {zs.label}
                                                    </span>
                                                </div>
                                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                                    {contractorName} · {zone.district} · Since {new Date(zone.assigned_date).toLocaleDateString('en-GB')}
                                                </p>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>
                                                chevron_right
                                            </span>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* Routes Tab */}
                    {activeTab === 'routes' && (
                        <div className="bento-card s4">
                            {filteredRoutes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>route</span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No routes found</p>
                                    <p className="text-sm mt-1 mb-6" style={{ color: '#94a3b8' }}>
                                        Create routes to assign to contractors and drivers
                                    </p>
                                    <button className="btn-primary" onClick={() => setShowRouteForm(true)}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_road</span>
                                        Create Route
                                    </button>
                                </div>
                            ) : (
                                filteredRoutes.map(route => {
                                    const rs = routeStatusStyle(route.status)
                                    const contractorName = route.contractor?.organisation_name || route.contractor?.full_name || 'Unassigned'
                                    return (
                                        <div key={route.id} className="list-row" onClick={() => setSelectedRoute(route)}>
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: rs.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: rs.color, fontSize: '20px' }}>
                                                    route
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22' }}>{route.route_name}</p>
                                                    <span className="status-badge" style={{ background: rs.bg, color: rs.color }}>
                                                        {route.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                                    {route.ward ? `${route.ward} · ` : ''}{route.district} · {route.shift} · {new Date(route.date).toLocaleDateString('en-GB')}
                                                </p>
                                                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                                                    {contractorName}{route.driver?.full_name ? ` · Driver: ${route.driver.full_name}` : ''}
                                                </p>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>
                                                chevron_right
                                            </span>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* Zone Detail Modal */}
                    {selectedZone && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            {selectedZone.ward}
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            {selectedZone.district} · {selectedZone.contractor?.organisation_name || selectedZone.contractor?.full_name}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedZone(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[
                                        { label: 'Status', value: selectedZone.status },
                                        { label: 'District', value: selectedZone.district },
                                        { label: 'Assigned Since', value: new Date(selectedZone.assigned_date).toLocaleDateString('en-GB') },
                                        { label: 'Contractor', value: selectedZone.contractor?.organisation_name || selectedZone.contractor?.full_name || 'Unknown' },
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
                                <div className="mb-6">
                                    <p className="text-xs font-bold uppercase mb-3"
                                        style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                        Update Status
                                    </p>
                                    <div className="flex gap-2">
                                        {['active', 'suspended', 'reassigned'].map(s => {
                                            const st = zoneStatusStyle(s)
                                            return (
                                                <button key={s} onClick={() => updateZoneStatus(selectedZone.id, s)}
                                                    style={{ background: st.bg, color: st.color, border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', textTransform: 'capitalize' }}>
                                                    {s}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                <button className="btn-secondary w-full justify-center" onClick={() => setSelectedZone(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Route Detail Modal */}
                    {selectedRoute && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            {selectedRoute.route_name}
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            {selectedRoute.ward && `${selectedRoute.ward} · `}{selectedRoute.district}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedRoute(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[
                                        { label: 'Status', value: selectedRoute.status },
                                        { label: 'Shift', value: selectedRoute.shift },
                                        { label: 'Date', value: new Date(selectedRoute.date).toLocaleDateString('en-GB') },
                                        { label: 'Driver', value: selectedRoute.driver?.full_name || 'Unassigned' },
                                        { label: 'Contractor', value: selectedRoute.contractor?.organisation_name || selectedRoute.contractor?.full_name || 'Unassigned' },
                                        { label: 'Vehicle', value: (selectedRoute as any).vehicle_number || 'N/A' },
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
                                <div className="mb-6">
                                    <p className="text-xs font-bold uppercase mb-3"
                                        style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                        Update Status
                                    </p>
                                    <div className="flex gap-2 flex-wrap">
                                        {['pending', 'active', 'completed'].map(s => {
                                            const rs = routeStatusStyle(s)
                                            return (
                                                <button key={s} onClick={() => updateRouteStatus(selectedRoute.id, s)}
                                                    style={{ background: rs.bg, color: rs.color, border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', textTransform: 'capitalize' }}>
                                                    {s}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                <button className="btn-secondary w-full justify-center" onClick={() => setSelectedRoute(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Assign Zone Modal */}
                    {showZoneForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Assign Zone</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>Assign a ward to a contractor</p>
                                    </div>
                                    <button onClick={() => { setShowZoneForm(false); setErrorMsg('') }}
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
                                        <label className="form-label">Contractor *</label>
                                        <select className="form-input"
                                            value={zoneForm.contractor_id}
                                            onChange={e => setZoneForm(f => ({ ...f, contractor_id: e.target.value }))}>
                                            <option value="">Select contractor...</option>
                                            {contractors.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.organisation_name || c.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">District *</label>
                                        <select className="form-input"
                                            value={zoneForm.district}
                                            onChange={e => setZoneForm(f => ({ ...f, district: e.target.value, ward: '' }))}>
                                            <option value="">Select district...</option>
                                            {Object.keys(DISTRICT_WARD_MAP).map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Ward *</label>
                                        <select className="form-input"
                                            value={zoneForm.ward}
                                            onChange={e => setZoneForm(f => ({ ...f, ward: e.target.value }))}
                                            disabled={!zoneForm.district}>
                                            <option value="">{zoneForm.district ? 'Select ward...' : 'Select district first'}</option>
                                            {(DISTRICT_WARD_MAP[zoneForm.district] || []).map(w => (
                                                <option key={w} value={w}>{w}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Assigned Date</label>
                                        <input type="date" className="form-input"
                                            value={zoneForm.assigned_date}
                                            onChange={e => setZoneForm(f => ({ ...f, assigned_date: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="form-label">Notes</label>
                                        <textarea className="form-input" rows={3}
                                            placeholder="Any notes about this zone assignment..."
                                            value={zoneForm.notes}
                                            onChange={e => setZoneForm(f => ({ ...f, notes: e.target.value }))}
                                            style={{ resize: 'vertical' }} />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setShowZoneForm(false); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={createZone} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                                                Assign Zone
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Create Route Modal */}
                    {showRouteForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Create Route</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>Create and assign a new collection route</p>
                                    </div>
                                    <button onClick={() => { setShowRouteForm(false); setErrorMsg('') }}
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
                                        <label className="form-label">Route Name *</label>
                                        <input className="form-input" placeholder="e.g. Mattakkuliya Morning Route"
                                            value={routeForm.route_name}
                                            onChange={e => setRouteForm(f => ({ ...f, route_name: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="form-label">District *</label>
                                        <select className="form-input"
                                            value={routeForm.district}
                                            onChange={e => setRouteForm(f => ({ ...f, district: e.target.value, ward: '' }))}>
                                            <option value="">Select district...</option>
                                            {Object.keys(DISTRICT_WARD_MAP).map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Ward</label>
                                        <select className="form-input"
                                            value={routeForm.ward}
                                            onChange={e => setRouteForm(f => ({ ...f, ward: e.target.value }))}
                                            disabled={!routeForm.district}>
                                            <option value="">{routeForm.district ? 'Select ward...' : 'Select district first'}</option>
                                            {(DISTRICT_WARD_MAP[routeForm.district] || []).map(w => (
                                                <option key={w} value={w}>{w}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Assign Contractor</label>
                                        <select className="form-input"
                                            value={routeForm.contractor_id}
                                            onChange={e => setRouteForm(f => ({ ...f, contractor_id: e.target.value }))}>
                                            <option value="">Unassigned</option>
                                            {contractors.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.organisation_name || c.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Assign Driver</label>
                                        <select className="form-input"
                                            value={routeForm.driver_id}
                                            onChange={e => setRouteForm(f => ({ ...f, driver_id: e.target.value }))}>
                                            <option value="">Unassigned</option>
                                            {drivers.map(d => (
                                                <option key={d.id} value={d.id}>{d.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="form-label">Shift</label>
                                            <select className="form-input"
                                                value={routeForm.shift}
                                                onChange={e => setRouteForm(f => ({ ...f, shift: e.target.value }))}>
                                                <option value="morning">Morning</option>
                                                <option value="afternoon">Afternoon</option>
                                                <option value="evening">Evening</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">Date</label>
                                            <input type="date" className="form-input"
                                                value={routeForm.date}
                                                onChange={e => setRouteForm(f => ({ ...f, date: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Vehicle No.</label>
                                            <input className="form-input" placeholder="e.g. WP-CAB-1234"
                                                value={routeForm.vehicle_number}
                                                onChange={e => setRouteForm(f => ({ ...f, vehicle_number: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setShowRouteForm(false); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={createRoute} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                                                Create Route
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