'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const CONTRACTOR_NAV = [
    { label: 'Overview', href: '/dashboard/contractor', icon: 'dashboard' },
    { label: 'Routes', href: '/dashboard/contractor/routes', icon: 'route' },
    { label: 'Drivers', href: '/dashboard/contractor/drivers', icon: 'people' },
    { label: 'Breakdowns', href: '/dashboard/contractor/breakdowns', icon: 'car_crash' },
    { label: 'Contracts', href: '/dashboard/contractor/contracts', icon: 'description' },
    { label: 'Fleet', href: '/dashboard/contractor/fleet', icon: 'local_shipping' },
    { label: 'Billing', href: '/dashboard/contractor/billing', icon: 'receipt_long' },
    { label: 'Incidents', href: '/dashboard/contractor/incidents', icon: 'warning' },
    { label: 'Messages', href: '/dashboard/contractor/messages', icon: 'chat' },
    { label: 'Zones', href: '/dashboard/contractor/zones', icon: 'map' },
    { label: 'Staff', href: '/dashboard/contractor/staff', icon: 'badge' },
]

type Vehicle = {
    id: string
    contractor_id: string
    plate_number: string
    type: string
    capacity_tons: number
    make: string
    model: string
    year: number
    status: string
    assigned_driver_id: string
    last_service_date: string
    next_service_date: string
    insurance_expiry: string
    notes: string
    created_at: string
    driver?: { full_name: string }
}

type Maintenance = {
    id: string
    vehicle_id: string
    maintenance_type: string
    description: string
    cost: number
    service_provider: string
    date: string
    next_due_date: string
    status: string
    notes: string
    created_at: string
}

type FuelLog = {
    id: string
    driver_id: string
    vehicle_number: string
    fuel_amount: number
    fuel_cost: number
    odometer_reading: number
    fuel_station: string
    date: string
    notes: string
    driver?: { full_name: string }
}

function vehicleStatusStyle(status: string) {
    switch (status) {
        case 'active': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Active' }
        case 'under_maintenance': return { bg: '#fefce8', color: '#92400e', dot: '#d97706', label: 'Under Maintenance' }
        case 'out_of_service': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Out of Service' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: status }
    }
}

function maintenanceStatusStyle(status: string) {
    switch (status) {
        case 'scheduled': return { bg: '#f0f9ff', color: '#0369a1' }
        case 'in_progress': return { bg: '#fefce8', color: '#92400e' }
        case 'completed': return { bg: '#f0fdf4', color: '#00450d' }
        case 'cancelled': return { bg: '#f8fafc', color: '#64748b' }
        default: return { bg: '#f8fafc', color: '#64748b' }
    }
}

function vehicleTypeIcon(type: string) {
    switch (type) {
        case 'compactor': return 'delete_sweep'
        case 'truck': return 'local_shipping'
        case 'tipper': return 'rv_hookup'
        case 'van': return 'airport_shuttle'
        default: return 'directions_car'
    }
}

function daysUntil(dateStr: string) {
    if (!dateStr) return null
    const today = new Date()
    const target = new Date(dateStr)
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getOdometerFlag(vehicle: Vehicle, fuelLogs: FuelLog[]) {
    const SERVICE_INTERVAL_KM = 5000
    const vehicleLogs = fuelLogs
        .filter(l => l.vehicle_number === vehicle.plate_number && l.odometer_reading)
        .sort((a, b) => b.odometer_reading - a.odometer_reading)

    if (vehicleLogs.length === 0) return { needsService: false, reason: null, kmSinceLast: null }

    const latestOdometer = vehicleLogs[0].odometer_reading
    let lastServiceOdometer: number | null = null
    if (vehicle.last_service_date) {
        const serviceDate = new Date(vehicle.last_service_date).getTime()
        const logsBeforeService = vehicleLogs.filter(l => new Date(l.date).getTime() <= serviceDate + 86400000)
        if (logsBeforeService.length > 0) lastServiceOdometer = logsBeforeService[0].odometer_reading
    }

    if (lastServiceOdometer === null) return { needsService: false, reason: null, kmSinceLast: null }

    const kmSinceLast = latestOdometer - lastServiceOdometer
    if (kmSinceLast >= SERVICE_INTERVAL_KM) {
        return { needsService: true, reason: `${kmSinceLast.toLocaleString()} km since last service`, kmSinceLast }
    }
    if (kmSinceLast >= SERVICE_INTERVAL_KM * 0.8) {
        return { needsService: false, reason: `${kmSinceLast.toLocaleString()} km — approaching service interval`, kmSinceLast }
    }
    return { needsService: false, reason: null, kmSinceLast }
}

const EMPTY_VEHICLE_FORM = {
    plate_number: '', type: 'truck', capacity_tons: '', make: '', model: '',
    year: new Date().getFullYear().toString(), status: 'active', assigned_driver_id: '',
    last_service_date: '', next_service_date: '', insurance_expiry: '', notes: '',
}

const EMPTY_MAINTENANCE_FORM = {
    vehicle_id: '', maintenance_type: 'routine_service', description: '', cost: '',
    service_provider: '', date: new Date().toISOString().split('T')[0],
    next_due_date: '', status: 'scheduled', notes: '',
}

export default function ContractorFleetPage() {
    const [profile, setProfile] = useState<any>(null)
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [maintenance, setMaintenance] = useState<Maintenance[]>([])
    const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([])
    const [drivers, setDrivers] = useState<any[]>([])
    const [breakdownReports, setBreakdownReports] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'vehicles' | 'maintenance' | 'fuel' | 'performance'>('vehicles')
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
    const [showVehicleForm, setShowVehicleForm] = useState(false)
    const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
    const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE_FORM)
    const [maintenanceForm, setMaintenanceForm] = useState(EMPTY_MAINTENANCE_FORM)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: vehiclesData } = await supabase
            .from('vehicles')
            .select('*, driver:profiles!vehicles_assigned_driver_id_fkey(full_name)')
            .eq('contractor_id', user.id)
            .order('created_at', { ascending: false })
        setVehicles(vehiclesData || [])

        const { data: maintenanceData } = await supabase
            .from('vehicle_maintenance')
            .select('*')
            .eq('contractor_id', user.id)
            .order('date', { ascending: false })
        setMaintenance(maintenanceData || [])

        const { data: fuelData } = await supabase
            .from('fuel_logs')
            .select('*, driver:profiles!fuel_logs_driver_id_fkey(full_name)')
            .eq('contractor_id', user.id)
            .order('date', { ascending: false })
            .limit(50)
        setFuelLogs(fuelData || [])

        const { data: driversData } = await supabase
            .from('profiles').select('id, full_name').eq('role', 'driver')
        setDrivers(driversData || [])

        const { data: breakdowns } = await supabase
            .from('breakdown_reports').select('*').order('created_at', { ascending: false })
        setBreakdownReports(breakdowns || [])

        setLoading(false)
    }

    async function saveVehicle() {
        if (!vehicleForm.plate_number || !vehicleForm.type) { setErrorMsg('Plate number and type are required.'); return }
        setSubmitting(true); setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const payload = {
            contractor_id: user.id,
            plate_number: vehicleForm.plate_number.toUpperCase(),
            type: vehicleForm.type,
            capacity_tons: vehicleForm.capacity_tons ? parseFloat(vehicleForm.capacity_tons) : null,
            make: vehicleForm.make || null, model: vehicleForm.model || null,
            year: vehicleForm.year ? parseInt(vehicleForm.year) : null,
            status: vehicleForm.status,
            assigned_driver_id: vehicleForm.assigned_driver_id || null,
            last_service_date: vehicleForm.last_service_date || null,
            next_service_date: vehicleForm.next_service_date || null,
            insurance_expiry: vehicleForm.insurance_expiry || null,
            notes: vehicleForm.notes || null,
        }

        let error
        if (editingVehicle) {
            const res = await supabase.from('vehicles').update(payload).eq('id', editingVehicle.id)
            error = res.error
        } else {
            const res = await supabase.from('vehicles').insert(payload)
            error = res.error
        }

        if (error) { setErrorMsg('Failed to save vehicle: ' + error.message) }
        else {
            setSuccessMsg(editingVehicle ? 'Vehicle updated successfully.' : 'Vehicle added successfully.')
            setShowVehicleForm(false); setEditingVehicle(null); setVehicleForm(EMPTY_VEHICLE_FORM); loadData()
        }
        setSubmitting(false)
    }

    async function deleteVehicle(vehicleId: string) {
        if (!confirm('Are you sure you want to remove this vehicle?')) return
        const supabase = createClient()
        const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId)
        if (!error) { setSuccessMsg('Vehicle removed.'); setSelectedVehicle(null); loadData() }
    }

    async function saveMaintenance() {
        if (!maintenanceForm.vehicle_id || !maintenanceForm.date) { setErrorMsg('Vehicle and date are required.'); return }
        setSubmitting(true); setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('vehicle_maintenance').insert({
            vehicle_id: maintenanceForm.vehicle_id, contractor_id: user.id,
            maintenance_type: maintenanceForm.maintenance_type,
            description: maintenanceForm.description || null,
            cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : null,
            service_provider: maintenanceForm.service_provider || null,
            date: maintenanceForm.date, next_due_date: maintenanceForm.next_due_date || null,
            status: maintenanceForm.status, notes: maintenanceForm.notes || null,
        })

        if (error) { setErrorMsg('Failed to save: ' + error.message) }
        else {
            if (maintenanceForm.status === 'in_progress') {
                const supabase2 = createClient()
                await supabase2.from('vehicles').update({ status: 'under_maintenance' }).eq('id', maintenanceForm.vehicle_id)
            }
            setSuccessMsg('Maintenance record added.'); setShowMaintenanceForm(false)
            setMaintenanceForm(EMPTY_MAINTENANCE_FORM); loadData()
        }
        setSubmitting(false)
    }

    async function updateMaintenanceStatus(id: string, newStatus: string, vehicleId: string) {
        const supabase = createClient()
        await supabase.from('vehicle_maintenance').update({ status: newStatus }).eq('id', id)
        if (newStatus === 'completed') await supabase.from('vehicles').update({ status: 'active' }).eq('id', vehicleId)
        loadData()
    }

    function openEditVehicle(v: Vehicle) {
        setEditingVehicle(v)
        setVehicleForm({
            plate_number: v.plate_number, type: v.type,
            capacity_tons: v.capacity_tons?.toString() || '',
            make: v.make || '', model: v.model || '', year: v.year?.toString() || '',
            status: v.status, assigned_driver_id: v.assigned_driver_id || '',
            last_service_date: v.last_service_date || '', next_service_date: v.next_service_date || '',
            insurance_expiry: v.insurance_expiry || '', notes: v.notes || '',
        })
        setShowVehicleForm(true); setSelectedVehicle(null)
    }

    const stats = {
        total: vehicles.length,
        active: vehicles.filter(v => v.status === 'active').length,
        underMaintenance: vehicles.filter(v => v.status === 'under_maintenance').length,
        outOfService: vehicles.filter(v => v.status === 'out_of_service').length,
        scheduledMaintenance: maintenance.filter(m => m.status === 'scheduled').length,
        totalFuelCost: fuelLogs.reduce((sum, f) => sum + (f.fuel_cost || 0), 0),
    }

    const attentionVehicles = vehicles.filter(v => {
        const serviceDays = daysUntil(v.next_service_date)
        const insuranceDays = daysUntil(v.insurance_expiry)
        const odomFlag = getOdometerFlag(v, fuelLogs)
        return (serviceDays !== null && serviceDays <= 30) ||
            (insuranceDays !== null && insuranceDays <= 30) ||
            v.status === 'under_maintenance' ||
            odomFlag.needsService
    })

    return (
        <DashboardLayout
            role="Contractor"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={CONTRACTOR_NAV}
            primaryAction={{ label: 'Add Vehicle', href: '#', icon: 'add' }}
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
        .vehicle-card { background:white; border-radius:16px; border:1.5px solid rgba(0,69,13,0.06); padding:24px; cursor:pointer; transition:all 0.3s cubic-bezier(0.05,0.7,0.1,1.0); }
        .vehicle-card:hover { transform:translateY(-4px); box-shadow:0 20px 40px -15px rgba(0,69,13,0.12); border-color:rgba(0,69,13,0.15); }
        .table-row { padding:14px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; transition:background 0.15s; }
        .table-row:hover { background:#f9fafb; }
        .table-row:last-child { border-bottom:none; }
        .form-input { width:100%; padding:10px 14px; border-radius:10px; border:1.5px solid rgba(0,69,13,0.15); font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:white; color:#181c22; }
        .form-input:focus { border-color:#00450d; }
        .form-label { font-size:12px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.05em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#00450d; color:white; border:none; padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity 0.2s; }
        .btn-primary:hover { opacity:0.88; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
        .btn-danger { background:#fef2f2; color:#ba1a1a; border:1.5px solid rgba(186,26,26,0.15); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-danger:hover { background:#ffdad6; }
        .attention-row { padding:12px 20px; border-bottom:1px solid rgba(217,119,6,0.08); display:flex; align-items:center; gap:12px; }
        .attention-row:last-child { border-bottom:none; }
        .perf-bar { height:8px; border-radius:99px; background:#f0fdf4; overflow:hidden; }
        .perf-fill { height:100%; border-radius:99px; transition:width 0.8s ease; }
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
                            Fleet <span style={{ color: '#1b5e20' }}>Management</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Manage vehicles, maintenance, fuel records and performance
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button className="btn-secondary" onClick={() => { setShowMaintenanceForm(true); setErrorMsg('') }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>build</span>
                            Log Maintenance
                        </button>
                        <button className="btn-primary" onClick={() => { setShowVehicleForm(true); setEditingVehicle(null); setVehicleForm(EMPTY_VEHICLE_FORM); setErrorMsg('') }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                            Add Vehicle
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

                    {/* Row 1 — Green hero + attention */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6 s2">
                        <div className="bento-card-green md:col-span-7 p-8">
                            <div className="absolute top-0 right-0 w-56 h-56 rounded-full -mr-20 -mt-20"
                                style={{ background: 'rgba(163,246,156,0.06)' }} />
                            <div className="relative z-10">
                                <div className="flex items-start justify-between mb-8">
                                    <div>
                                        <span className="text-xs font-bold uppercase block mb-2"
                                            style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                                            Fleet Overview
                                        </span>
                                        <h2 className="font-headline font-extrabold text-3xl tracking-tight">Vehicle Fleet</h2>
                                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '4px' }}>
                                            {stats.active} of {stats.total} vehicles operational
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>local_shipping</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Total', value: stats.total, icon: 'directions_car' },
                                        { label: 'Active', value: stats.active, icon: 'check_circle' },
                                        { label: 'In Maintenance', value: stats.underMaintenance, icon: 'build' },
                                        { label: 'Out of Service', value: stats.outOfService, icon: 'cancel' },
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

                        <div className="bento-card md:col-span-5">
                            <div className="px-6 py-5 flex items-center justify-between"
                                style={{ borderBottom: '1px solid rgba(217,119,6,0.1)' }}>
                                <div>
                                    <h3 className="font-headline font-bold text-base" style={{ color: '#181c22' }}>Needs Attention</h3>
                                    <p className="text-xs mt-0.5" style={{ color: '#717a6d' }}>Service due or issues detected</p>
                                </div>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#fefce8' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: '18px' }}>warning</span>
                                </div>
                            </div>
                            {attentionVehicles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <span className="material-symbols-outlined mb-2" style={{ color: '#00450d', fontSize: '32px' }}>check_circle</span>
                                    <p className="text-sm font-medium" style={{ color: '#181c22' }}>All vehicles OK</p>
                                    <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>No immediate attention needed</p>
                                </div>
                            ) : (
                                attentionVehicles.map(v => {
                                    const serviceDays = daysUntil(v.next_service_date)
                                    const insuranceDays = daysUntil(v.insurance_expiry)
                                    const vs = vehicleStatusStyle(v.status)
                                    return (
                                        <div key={v.id} className="attention-row">
                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: vs.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: vs.color, fontSize: '18px' }}>{vehicleTypeIcon(v.type)}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold" style={{ color: '#181c22' }}>{v.plate_number}</p>
                                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                                    {v.status === 'under_maintenance' ? 'Currently under maintenance' :
                                                        serviceDays !== null && serviceDays <= 30 ? `Service due in ${serviceDays} days` :
                                                            insuranceDays !== null && insuranceDays <= 30 ? `Insurance expires in ${insuranceDays} days` : ''}
                                                </p>
                                            </div>
                                            <span className="status-badge" style={{ background: vs.bg, color: vs.color }}>{vs.label}</span>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 s3">
                        {[
                            { label: 'Scheduled Maintenance', value: stats.scheduledMaintenance, icon: 'event', color: '#0369a1', bg: '#f0f9ff' },
                            { label: 'Total Fuel Cost', value: `LKR ${stats.totalFuelCost.toLocaleString()}`, icon: 'local_gas_station', color: '#00450d', bg: '#f0fdf4' },
                            { label: 'Fuel Records', value: fuelLogs.length, icon: 'receipt_long', color: '#7c3aed', bg: '#f5f3ff' },
                            { label: 'Maintenance Records', value: maintenance.length, icon: 'build_circle', color: '#d97706', bg: '#fefce8' },
                        ].map(s => (
                            <div key={s.label} className="bento-card p-5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
                                    <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '18px' }}>{s.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-xl" style={{ color: '#181c22' }}>{s.value}</p>
                                <p className="text-xs font-bold uppercase mt-1"
                                    style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-2 mb-6 s4" style={{ flexWrap: 'wrap' }}>
                        {(['vehicles', 'maintenance', 'fuel', 'performance'] as const).map(tab => (
                            <button key={tab} className={`tab-btn ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`}
                                onClick={() => setActiveTab(tab)}>
                                {tab === 'vehicles' ? `Vehicles (${vehicles.length})` :
                                    tab === 'maintenance' ? `Maintenance (${maintenance.length})` :
                                        tab === 'fuel' ? `Fuel Logs (${fuelLogs.length})` :
                                            'Performance'}
                            </button>
                        ))}
                    </div>

                    {/* VEHICLES TAB */}
                    {activeTab === 'vehicles' && (
                        <div className="s5">
                            {vehicles.length === 0 ? (
                                <div className="bento-card p-16 flex flex-col items-center justify-center text-center">
                                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6" style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '40px' }}>local_shipping</span>
                                    </div>
                                    <h2 className="font-headline font-bold text-xl mb-2" style={{ color: '#181c22' }}>No vehicles yet</h2>
                                    <p className="text-sm mb-6" style={{ color: '#717a6d' }}>Add your first vehicle to start tracking your fleet</p>
                                    <button className="btn-primary" onClick={() => setShowVehicleForm(true)}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                        Add Vehicle
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {vehicles.map(v => {
                                        const vs = vehicleStatusStyle(v.status)
                                        const serviceDays = daysUntil(v.next_service_date)
                                        const insuranceDays = daysUntil(v.insurance_expiry)
                                        return (
                                            <div key={v.id} className="vehicle-card" onClick={() => setSelectedVehicle(v)}>
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: vs.bg }}>
                                                        <span className="material-symbols-outlined" style={{ color: vs.color, fontSize: '24px' }}>{vehicleTypeIcon(v.type)}</span>
                                                    </div>
                                                    <span className="status-badge" style={{ background: vs.bg, color: vs.color }}>
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: vs.dot }} />
                                                        {vs.label}
                                                    </span>
                                                </div>
                                                <h3 className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>{v.plate_number}</h3>
                                                <p className="text-sm mb-4" style={{ color: '#717a6d' }}>{v.year} {v.make} {v.model} · {v.capacity_tons}T</p>
                                                <div className="space-y-2">
                                                    {v.driver && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '14px' }}>person</span>
                                                            <span className="text-xs" style={{ color: '#64748b' }}>{v.driver.full_name}</span>
                                                        </div>
                                                    )}
                                                    {serviceDays !== null && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined" style={{ color: serviceDays <= 30 ? '#d97706' : '#94a3b8', fontSize: '14px' }}>build</span>
                                                            <span className="text-xs" style={{ color: serviceDays <= 30 ? '#d97706' : '#64748b' }}>
                                                                {serviceDays <= 0 ? 'Service overdue' : `Service in ${serviceDays} days`}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {insuranceDays !== null && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined" style={{ color: insuranceDays <= 30 ? '#ba1a1a' : '#94a3b8', fontSize: '14px' }}>shield</span>
                                                            <span className="text-xs" style={{ color: insuranceDays <= 30 ? '#ba1a1a' : '#64748b' }}>
                                                                {insuranceDays <= 0 ? 'Insurance expired' : `Insurance expires in ${insuranceDays} days`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(0,69,13,0.06)' }}>
                                                    <span className="text-xs font-medium px-2 py-1 rounded-lg capitalize" style={{ background: '#f8fafc', color: '#64748b' }}>{v.type}</span>
                                                    <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '16px' }}>chevron_right</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* MAINTENANCE TAB */}
                    {activeTab === 'maintenance' && (
                        <div className="bento-card s5">
                            <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <h3 className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>Maintenance Records</h3>
                                <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}
                                    onClick={() => { setShowMaintenanceForm(true); setErrorMsg('') }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                                    Log Maintenance
                                </button>
                            </div>
                            {maintenance.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>build</span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No maintenance records</p>
                                    <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Log your first maintenance record</p>
                                </div>
                            ) : (
                                maintenance.map(m => {
                                    const ms = maintenanceStatusStyle(m.status)
                                    const vehicle = vehicles.find(v => v.id === m.vehicle_id)
                                    return (
                                        <div key={m.id} className="table-row">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ms.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: ms.color, fontSize: '20px' }}>build</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22' }}>
                                                        {m.maintenance_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                    </p>
                                                    <span className="status-badge" style={{ background: ms.bg, color: ms.color }}>{m.status.replace('_', ' ')}</span>
                                                </div>
                                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                                    {vehicle?.plate_number || 'Unknown'} · {m.service_provider || 'No provider'} · {new Date(m.date).toLocaleDateString('en-GB')}
                                                </p>
                                                {m.description && <p className="text-xs mt-1 truncate" style={{ color: '#94a3b8' }}>{m.description}</p>}
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                {m.cost && <p className="text-sm font-bold" style={{ color: '#00450d' }}>LKR {m.cost.toLocaleString()}</p>}
                                                {m.status === 'in_progress' && vehicle && (
                                                    <button onClick={() => updateMaintenanceStatus(m.id, 'completed', vehicle.id)}
                                                        className="mt-1 text-xs font-bold px-2 py-1 rounded-lg"
                                                        style={{ background: '#f0fdf4', color: '#00450d', border: 'none', cursor: 'pointer' }}>
                                                        Mark Complete
                                                    </button>
                                                )}
                                                {m.status === 'scheduled' && vehicle && (
                                                    <button onClick={() => updateMaintenanceStatus(m.id, 'in_progress', vehicle.id)}
                                                        className="mt-1 text-xs font-bold px-2 py-1 rounded-lg"
                                                        style={{ background: '#fefce8', color: '#92400e', border: 'none', cursor: 'pointer' }}>
                                                        Start
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* FUEL TAB */}
                    {activeTab === 'fuel' && (
                        <div className="bento-card s5">
                            <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <div>
                                    <h3 className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>Fuel Logs</h3>
                                    <p className="text-xs mt-0.5" style={{ color: '#717a6d' }}>Total: LKR {stats.totalFuelCost.toLocaleString()}</p>
                                </div>
                            </div>
                            {fuelLogs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>local_gas_station</span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No fuel logs</p>
                                    <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Fuel logs recorded by drivers will appear here</p>
                                </div>
                            ) : (
                                fuelLogs.map(f => (
                                    <div key={f.id} className="table-row">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f0fdf4' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>local_gas_station</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold" style={{ color: '#181c22' }}>{f.vehicle_number || 'Unknown Vehicle'}</p>
                                            <p className="text-xs" style={{ color: '#717a6d' }}>
                                                {f.driver?.full_name || 'Unknown Driver'} · {f.fuel_station || 'Unknown Station'} · {new Date(f.date).toLocaleDateString('en-GB')}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-sm font-bold" style={{ color: '#00450d' }}>LKR {f.fuel_cost.toLocaleString()}</p>
                                            <p className="text-xs" style={{ color: '#94a3b8' }}>{f.fuel_amount}L</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* PERFORMANCE TAB — R49 */}
                    {activeTab === 'performance' && (
                        <div className="s5">
                            {/* Fleet summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                {[
                                    { label: 'Fleet Operational Rate', value: stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0, icon: 'directions_car', color: '#00450d', suffix: '%' },
                                    { label: 'Total Fuel Spend', value: `LKR ${stats.totalFuelCost.toLocaleString()}`, icon: 'local_gas_station', color: '#1d4ed8', suffix: '' },
                                    { label: 'Total Maintenance Cost', value: `LKR ${maintenance.reduce((s, m) => s + (m.cost || 0), 0).toLocaleString()}`, icon: 'build', color: '#d97706', suffix: '' },
                                ].map(m => (
                                    <div key={m.label} className="bento-card p-6">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${m.color}12` }}>
                                            <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '20px' }}>{m.icon}</span>
                                        </div>
                                        <p className="font-headline font-extrabold text-2xl mb-1" style={{ color: '#181c22' }}>{m.value}{m.suffix}</p>
                                        <p className="text-xs font-bold uppercase" style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>{m.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Per-vehicle performance */}
                            <div className="bento-card">
                                <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                    <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Per-Vehicle Performance</h3>
                                    <p className="text-sm mt-1" style={{ color: '#717a6d' }}>Fuel consumption, maintenance cost and breakdown history per vehicle</p>
                                </div>
                                {vehicles.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>analytics</span>
                                        </div>
                                        <p className="font-bold text-base mb-1" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>No vehicles registered</p>
                                        <p className="text-sm" style={{ color: '#94a3b8' }}>Add vehicles to see performance data.</p>
                                    </div>
                                ) : (
                                    vehicles.map((v, idx) => {
                                        const vehicleFuel = fuelLogs.filter(f => f.vehicle_number === v.plate_number)
                                        const vehicleBreakdowns = breakdownReports.filter(b => b.vehicle_number === v.plate_number)
                                        const vehicleMaintenance = maintenance.filter(m => m.vehicle_id === v.id)
                                        const fuelCost = vehicleFuel.reduce((sum, f) => sum + (f.fuel_cost || 0), 0)
                                        const fuelLitres = vehicleFuel.reduce((sum, f) => sum + (f.fuel_amount || 0), 0)
                                        const maintenanceCost = vehicleMaintenance.reduce((sum, m) => sum + (m.cost || 0), 0)
                                        const vs = vehicleStatusStyle(v.status)
                                        const maxFuel = Math.max(...vehicles.map(vv => fuelLogs.filter(f => f.vehicle_number === vv.plate_number).reduce((s, f) => s + (f.fuel_cost || 0), 0)), 1)

                                        return (
                                            <div key={v.id} style={{ padding: '20px 24px', borderBottom: idx < vehicles.length - 1 ? '1px solid rgba(0,69,13,0.04)' : 'none' }}
                                                className="hover:bg-slate-50 transition-colors">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
                                                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: vs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <span className="material-symbols-outlined" style={{ color: vs.color, fontSize: '22px' }}>{vehicleTypeIcon(v.type)}</span>
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                            <p style={{ fontSize: '15px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{v.plate_number}</p>
                                                            <span className="status-badge" style={{ background: vs.bg, color: vs.color }}>
                                                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: vs.dot, display: 'inline-block' }} />
                                                                {vs.label}
                                                            </span>
                                                            {v.driver && (
                                                                <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>person</span>
                                                                    {v.driver.full_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                                                            {v.year} {v.make} {v.model} · {v.capacity_tons}T
                                                        </p>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                                                    {[
                                                        { label: 'Fuel Cost', value: `LKR ${fuelCost.toLocaleString()}`, sub: `${fuelLitres.toFixed(0)}L total`, icon: 'local_gas_station', color: '#1d4ed8' },
                                                        { label: 'Maintenance Cost', value: `LKR ${maintenanceCost.toLocaleString()}`, sub: `${vehicleMaintenance.length} records`, icon: 'build', color: '#d97706' },
                                                        { label: 'Breakdowns', value: vehicleBreakdowns.length, sub: `${vehicleBreakdowns.filter(b => b.status === 'reported').length} open`, icon: 'car_crash', color: vehicleBreakdowns.length > 0 ? '#ba1a1a' : '#00450d' },
                                                    ].map(stat => (
                                                        <div key={stat.label} style={{ padding: '12px', borderRadius: '10px', background: '#f9fafb', border: '1px solid rgba(0,69,13,0.04)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                                <span className="material-symbols-outlined" style={{ color: stat.color, fontSize: '14px' }}>{stat.icon}</span>
                                                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</span>
                                                            </div>
                                                            <p style={{ fontSize: '14px', fontWeight: 800, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{stat.value}</p>
                                                            <p style={{ fontSize: '11px', color: '#94a3b8' }}>{stat.sub}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Fuel cost bar relative to fleet */}
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Fuel spend vs fleet max</span>
                                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8' }}>{Math.round((fuelCost / maxFuel) * 100)}%</span>
                                                    </div>
                                                    <div className="perf-bar">
                                                        <div className="perf-fill" style={{ width: `${Math.round((fuelCost / maxFuel) * 100)}%`, background: '#1d4ed8' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Vehicle Detail Modal */}
                    {selectedVehicle && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>{selectedVehicle.plate_number}</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</p>
                                    </div>
                                    <button onClick={() => setSelectedVehicle(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[
                                        { label: 'Type', value: selectedVehicle.type },
                                        { label: 'Capacity', value: `${selectedVehicle.capacity_tons}T` },
                                        { label: 'Status', value: selectedVehicle.status.replace('_', ' ') },
                                        { label: 'Assigned Driver', value: selectedVehicle.driver?.full_name || 'Unassigned' },
                                        { label: 'Last Service', value: selectedVehicle.last_service_date ? new Date(selectedVehicle.last_service_date).toLocaleDateString('en-GB') : 'N/A' },
                                        { label: 'Next Service', value: selectedVehicle.next_service_date ? new Date(selectedVehicle.next_service_date).toLocaleDateString('en-GB') : 'N/A' },
                                        { label: 'Insurance Expiry', value: selectedVehicle.insurance_expiry ? new Date(selectedVehicle.insurance_expiry).toLocaleDateString('en-GB') : 'N/A' },
                                    ].map(item => (
                                        <div key={item.label} className="p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                                            <p className="text-xs font-bold uppercase mb-1" style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>{item.label}</p>
                                            <p className="text-sm font-semibold capitalize" style={{ color: '#181c22' }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                {selectedVehicle.notes && (
                                    <div className="p-4 rounded-xl mb-6" style={{ background: '#f8fafc' }}>
                                        <p className="text-xs font-bold uppercase mb-1" style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>Notes</p>
                                        <p className="text-sm" style={{ color: '#4b5563' }}>{selectedVehicle.notes}</p>
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button className="btn-danger flex-1 justify-center" onClick={() => deleteVehicle(selectedVehicle.id)}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>Remove
                                    </button>
                                    <button className="btn-secondary flex-1 justify-center" onClick={() => openEditVehicle(selectedVehicle)}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>Edit
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Add/Edit Vehicle Modal */}
                    {showVehicleForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-2xl bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            {editingVehicle ? 'Update vehicle details' : 'Register a new vehicle to your fleet'}
                                        </p>
                                    </div>
                                    <button onClick={() => { setShowVehicleForm(false); setEditingVehicle(null); setErrorMsg('') }}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>
                                {errorMsg && (
                                    <div className="mb-4 p-3 rounded-xl flex items-center gap-2" style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '16px' }}>error</span>
                                        <p className="text-xs font-medium" style={{ color: '#ba1a1a' }}>{errorMsg}</p>
                                    </div>
                                )}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Plate Number *</label>
                                            <input className="form-input" placeholder="e.g. WP-CAB-1234" value={vehicleForm.plate_number} onChange={e => setVehicleForm(f => ({ ...f, plate_number: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Vehicle Type *</label>
                                            <select className="form-input" value={vehicleForm.type} onChange={e => setVehicleForm(f => ({ ...f, type: e.target.value }))}>
                                                <option value="truck">Truck</option>
                                                <option value="compactor">Compactor</option>
                                                <option value="tipper">Tipper</option>
                                                <option value="van">Van</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div><label className="form-label">Make</label><input className="form-input" placeholder="e.g. Isuzu" value={vehicleForm.make} onChange={e => setVehicleForm(f => ({ ...f, make: e.target.value }))} /></div>
                                        <div><label className="form-label">Model</label><input className="form-input" placeholder="e.g. NQR" value={vehicleForm.model} onChange={e => setVehicleForm(f => ({ ...f, model: e.target.value }))} /></div>
                                        <div><label className="form-label">Year</label><input type="number" className="form-input" value={vehicleForm.year} onChange={e => setVehicleForm(f => ({ ...f, year: e.target.value }))} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="form-label">Capacity (Tons)</label><input type="number" className="form-input" placeholder="e.g. 8" value={vehicleForm.capacity_tons} onChange={e => setVehicleForm(f => ({ ...f, capacity_tons: e.target.value }))} /></div>
                                        <div>
                                            <label className="form-label">Status</label>
                                            <select className="form-input" value={vehicleForm.status} onChange={e => setVehicleForm(f => ({ ...f, status: e.target.value }))}>
                                                <option value="active">Active</option>
                                                <option value="under_maintenance">Under Maintenance</option>
                                                <option value="out_of_service">Out of Service</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">Assigned Driver</label>
                                        <select className="form-input" value={vehicleForm.assigned_driver_id} onChange={e => setVehicleForm(f => ({ ...f, assigned_driver_id: e.target.value }))}>
                                            <option value="">Unassigned</option>
                                            {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div><label className="form-label">Last Service</label><input type="date" className="form-input" value={vehicleForm.last_service_date} onChange={e => setVehicleForm(f => ({ ...f, last_service_date: e.target.value }))} /></div>
                                        <div><label className="form-label">Next Service</label><input type="date" className="form-input" value={vehicleForm.next_service_date} onChange={e => setVehicleForm(f => ({ ...f, next_service_date: e.target.value }))} /></div>
                                        <div><label className="form-label">Insurance Expiry</label><input type="date" className="form-input" value={vehicleForm.insurance_expiry} onChange={e => setVehicleForm(f => ({ ...f, insurance_expiry: e.target.value }))} /></div>
                                    </div>
                                    <div><label className="form-label">Notes</label><textarea className="form-input" rows={3} placeholder="Any additional notes..." value={vehicleForm.notes} onChange={e => setVehicleForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} /></div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center" onClick={() => { setShowVehicleForm(false); setEditingVehicle(null); setErrorMsg('') }}>Cancel</button>
                                    <button className="btn-primary flex-1 justify-center" onClick={saveVehicle} disabled={submitting}>
                                        {submitting ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'white', borderTopColor: 'transparent' }} /> : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>{editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Add Maintenance Modal */}
                    {showMaintenanceForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Log Maintenance</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>Record a maintenance event for a vehicle</p>
                                    </div>
                                    <button onClick={() => { setShowMaintenanceForm(false); setErrorMsg('') }}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>
                                {errorMsg && (
                                    <div className="mb-4 p-3 rounded-xl flex items-center gap-2" style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '16px' }}>error</span>
                                        <p className="text-xs font-medium" style={{ color: '#ba1a1a' }}>{errorMsg}</p>
                                    </div>
                                )}
                                <div className="space-y-4">
                                    <div>
                                        <label className="form-label">Vehicle *</label>
                                        <select className="form-input" value={maintenanceForm.vehicle_id} onChange={e => setMaintenanceForm(f => ({ ...f, vehicle_id: e.target.value }))}>
                                            <option value="">Select vehicle...</option>
                                            {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Maintenance Type</label>
                                            <select className="form-input" value={maintenanceForm.maintenance_type} onChange={e => setMaintenanceForm(f => ({ ...f, maintenance_type: e.target.value }))}>
                                                <option value="routine_service">Routine Service</option>
                                                <option value="tyre_replacement">Tyre Replacement</option>
                                                <option value="brake_service">Brake Service</option>
                                                <option value="engine_repair">Engine Repair</option>
                                                <option value="body_repair">Body Repair</option>
                                                <option value="electrical">Electrical</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">Status</label>
                                            <select className="form-input" value={maintenanceForm.status} onChange={e => setMaintenanceForm(f => ({ ...f, status: e.target.value }))}>
                                                <option value="scheduled">Scheduled</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div><label className="form-label">Description</label><textarea className="form-input" rows={3} placeholder="Describe the maintenance work..." value={maintenanceForm.description} onChange={e => setMaintenanceForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="form-label">Cost (LKR)</label><input type="number" className="form-input" placeholder="e.g. 12000" value={maintenanceForm.cost} onChange={e => setMaintenanceForm(f => ({ ...f, cost: e.target.value }))} /></div>
                                        <div><label className="form-label">Service Provider</label><input className="form-input" placeholder="e.g. Colombo Auto Services" value={maintenanceForm.service_provider} onChange={e => setMaintenanceForm(f => ({ ...f, service_provider: e.target.value }))} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="form-label">Date *</label><input type="date" className="form-input" value={maintenanceForm.date} onChange={e => setMaintenanceForm(f => ({ ...f, date: e.target.value }))} /></div>
                                        <div><label className="form-label">Next Due Date</label><input type="date" className="form-input" value={maintenanceForm.next_due_date} onChange={e => setMaintenanceForm(f => ({ ...f, next_due_date: e.target.value }))} /></div>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center" onClick={() => { setShowMaintenanceForm(false); setErrorMsg('') }}>Cancel</button>
                                    <button className="btn-primary flex-1 justify-center" onClick={saveMaintenance} disabled={submitting}>
                                        {submitting ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'white', borderTopColor: 'transparent' }} /> : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>Save Record</>}
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