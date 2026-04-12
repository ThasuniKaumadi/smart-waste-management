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

type Driver = {
    id: string
    full_name: string
    phone: string
    district: string
    created_at: string
}

type Availability = {
    id: string
    driver_id: string
    date: string
    status: string
    shift: string
    notes: string
}

type LeaveRequest = {
    id: string
    driver_id: string
    leave_type: string
    start_date: string
    end_date: string
    reason: string
    status: string
    admin_notes: string
    created_at: string
    driver?: { full_name: string }
}

type Assignment = {
    id: string
    driver_id: string
    vehicle_id: string
    route_id: string
    shift: string
    assigned_date: string
    status: string
    driver?: { full_name: string }
    vehicle?: { plate_number: string; type: string }
    route?: { route_name: string; ward: string }
}

function availabilityStyle(status: string) {
    switch (status) {
        case 'available': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Available' }
        case 'on_route': return { bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8', label: 'On Route' }
        case 'off_duty': return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: 'Off Duty' }
        case 'on_leave': return { bg: '#fefce8', color: '#92400e', dot: '#d97706', label: 'On Leave' }
        case 'sick': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Sick' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: status }
    }
}

function leaveStatusStyle(status: string) {
    switch (status) {
        case 'pending': return { bg: '#fefce8', color: '#92400e' }
        case 'approved': return { bg: '#f0fdf4', color: '#00450d' }
        case 'rejected': return { bg: '#fef2f2', color: '#ba1a1a' }
        default: return { bg: '#f8fafc', color: '#64748b' }
    }
}

const EMPTY_LEAVE_FORM = {
    driver_id: '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
}

const EMPTY_ASSIGNMENT_FORM = {
    driver_id: '',
    vehicle_id: '',
    route_id: '',
    shift: 'morning',
    assigned_date: new Date().toISOString().split('T')[0],
}

export default function ContractorStaffPage() {
    const [profile, setProfile] = useState<any>(null)
    const [drivers, setDrivers] = useState<Driver[]>([])
    const [availability, setAvailability] = useState<Availability[]>([])
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [vehicles, setVehicles] = useState<any[]>([])
    const [routes, setRoutes] = useState<any[]>([])
    const [districtSupervisors, setDistrictSupervisors] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'overview' | 'availability' | 'leave' | 'assignments' | 'supervisors'>('overview')
    const [showLeaveForm, setShowLeaveForm] = useState(false)
    const [showAssignmentForm, setShowAssignmentForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [leaveForm, setLeaveForm] = useState(EMPTY_LEAVE_FORM)
    const [assignmentForm, setAssignmentForm] = useState(EMPTY_ASSIGNMENT_FORM)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Load drivers
        const { data: driversData } = await supabase
            .from('profiles')
            .select('id, full_name, phone, district, created_at')
            .eq('role', 'driver')
        setDrivers(driversData || [])

        // Load today's availability
        const today = new Date().toISOString().split('T')[0]
        const { data: availData } = await supabase
            .from('driver_availability')
            .select('*')
            .eq('contractor_id', user.id)
            .eq('date', today)
        setAvailability(availData || [])

        // Load leave requests
        const { data: leaveData } = await supabase
            .from('leave_requests')
            .select('*, driver:profiles!leave_requests_driver_id_fkey(full_name)')
            .eq('contractor_id', user.id)
            .order('created_at', { ascending: false })
        setLeaveRequests(leaveData || [])

        // Load assignments
        const { data: assignData } = await supabase
            .from('driver_assignments')
            .select('*, driver:profiles!driver_assignments_driver_id_fkey(full_name), vehicle:vehicles!driver_assignments_vehicle_id_fkey(plate_number, type), route:routes!driver_assignments_route_id_fkey(route_name, ward)')
            .eq('contractor_id', user.id)
            .order('assigned_date', { ascending: false })
            .limit(20)
        setAssignments(assignData || [])

        // Load vehicles and routes for forms
        const { data: vehiclesData } = await supabase
            .from('vehicles')
            .select('id, plate_number, type')
            .eq('contractor_id', user.id)
            .eq('status', 'active')
        setVehicles(vehiclesData || [])

        const { data: routesData } = await supabase
            .from('routes')
            .select('id, route_name, ward, district')
            .eq('contractor_id', user.id)
        setRoutes(routesData || [])

        // Load supervisors in contractor's district only
        if (p?.district) {
            const { data: supervisorsData } = await supabase
                .from('profiles')
                .select('id, full_name, district, assigned_wards, supervisor_phone')
                .eq('role', 'supervisor')
                .eq('district', p.district)
            setDistrictSupervisors(supervisorsData || [])
        }

        setLoading(false)
    }

    async function updateAvailability(driverId: string, newStatus: string) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const today = new Date().toISOString().split('T')[0]
        const existing = availability.find(a => a.driver_id === driverId)

        if (existing) {
            await supabase.from('driver_availability')
                .update({ status: newStatus })
                .eq('id', existing.id)
        } else {
            await supabase.from('driver_availability').insert({
                driver_id: driverId,
                contractor_id: user.id,
                date: today,
                status: newStatus,
                shift: 'morning',
            })
        }
        setSuccessMsg('Availability updated.')
        loadData()
    }

    async function submitLeaveRequest() {
        if (!leaveForm.driver_id || !leaveForm.start_date || !leaveForm.end_date) {
            setErrorMsg('Driver, start date and end date are required.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('leave_requests').insert({
            driver_id: leaveForm.driver_id,
            contractor_id: user.id,
            leave_type: leaveForm.leave_type,
            start_date: leaveForm.start_date,
            end_date: leaveForm.end_date,
            reason: leaveForm.reason || null,
            status: 'pending',
        })

        if (error) {
            setErrorMsg('Failed to submit leave request: ' + error.message)
        } else {
            setSuccessMsg('Leave request submitted.')
            setShowLeaveForm(false)
            setLeaveForm(EMPTY_LEAVE_FORM)
            loadData()
        }
        setSubmitting(false)
    }

    async function createAssignment() {
        if (!assignmentForm.driver_id || !assignmentForm.assigned_date) {
            setErrorMsg('Driver and date are required.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('driver_assignments').insert({
            driver_id: assignmentForm.driver_id,
            contractor_id: user.id,
            vehicle_id: assignmentForm.vehicle_id || null,
            route_id: assignmentForm.route_id || null,
            shift: assignmentForm.shift,
            assigned_date: assignmentForm.assigned_date,
            status: 'active',
        })

        if (error) {
            setErrorMsg(error.message.includes('unique') ?
                'This driver already has an assignment on this date.' :
                'Failed to create assignment: ' + error.message)
        } else {
            setSuccessMsg('Driver assignment created.')
            setShowAssignmentForm(false)
            setAssignmentForm(EMPTY_ASSIGNMENT_FORM)
            loadData()
        }
        setSubmitting(false)
    }

    async function reviewLeave(leaveId: string, newStatus: string) {
        const supabase = createClient()
        await supabase.from('leave_requests')
            .update({ status: newStatus, reviewed_at: new Date().toISOString() })
            .eq('id', leaveId)

        if (newStatus === 'approved') {
            const leave = leaveRequests.find(l => l.id === leaveId)
            if (leave) {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    await supabase.from('driver_availability').upsert({
                        driver_id: leave.driver_id,
                        contractor_id: user.id,
                        date: leave.start_date,
                        status: 'on_leave',
                        shift: 'morning',
                    }, { onConflict: 'driver_id,date' })
                }
            }
        }
        setSuccessMsg(`Leave request ${newStatus}.`)
        loadData()
    }

    const today = new Date().toISOString().split('T')[0]
    const stats = {
        totalDrivers: drivers.length,
        available: availability.filter(a => a.status === 'available').length,
        onRoute: availability.filter(a => a.status === 'on_route').length,
        onLeave: availability.filter(a => a.status === 'on_leave').length,
        pendingLeave: leaveRequests.filter(l => l.status === 'pending').length,
    }

    return (
        <DashboardLayout
            role="Contractor"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={CONTRACTOR_NAV}
            primaryAction={{ label: 'New Route', href: '/dashboard/contractor/routes/new', icon: 'add' }}
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
        .driver-card { background:white; border-radius:16px; border:1.5px solid rgba(0,69,13,0.06); padding:20px; transition:all 0.3s; }
        .driver-card:hover { box-shadow:0 8px 24px -8px rgba(0,69,13,0.12); border-color:rgba(0,69,13,0.12); }
        .list-row { padding:14px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; transition:background 0.15s; }
        .list-row:hover { background:#f9fafb; }
        .list-row:last-child { border-bottom:none; }
        .form-input { width:100%; padding:10px 14px; border-radius:10px; border:1.5px solid rgba(0,69,13,0.15); font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:white; color:#181c22; }
        .form-input:focus { border-color:#00450d; }
        .form-label { font-size:12px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.05em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#00450d; color:white; border:none; padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity 0.2s; }
        .btn-primary:hover { opacity:0.88; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
        .btn-danger { background:#fef2f2; color:#ba1a1a; border:1.5px solid rgba(186,26,26,0.15); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; }
        .btn-danger:hover { background:#ffdad6; }
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
                            Staff <span style={{ color: '#1b5e20' }}>Management</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Manage drivers, availability, assignments and district supervisors
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button className="btn-secondary"
                            onClick={() => { setShowLeaveForm(true); setErrorMsg('') }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>event_busy</span>
                            Log Leave
                        </button>
                        <button className="btn-primary"
                            onClick={() => { setShowAssignmentForm(true); setErrorMsg('') }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>assignment_ind</span>
                            Assign Driver
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
                            { label: 'Total Drivers', value: stats.totalDrivers, color: '#00450d', bg: '#f0fdf4', icon: 'badge' },
                            { label: 'Available', value: stats.available, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                            { label: 'On Route', value: stats.onRoute, color: '#0369a1', bg: '#f0f9ff', icon: 'directions_car' },
                            { label: 'On Leave', value: stats.onLeave, color: '#92400e', bg: '#fefce8', icon: 'event_busy' },
                            { label: 'Pending Leave', value: stats.pendingLeave, color: '#ba1a1a', bg: '#fef2f2', icon: 'pending' },
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

                    {/* Tabs */}
                    <div className="flex items-center gap-2 mb-6 s3 flex-wrap">
                        {(['overview', 'availability', 'leave', 'assignments', 'supervisors'] as const).map(tab => (
                            <button key={tab} className={`tab-btn ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`}
                                onClick={() => setActiveTab(tab)}>
                                {tab === 'overview' ? `Drivers (${drivers.length})` :
                                    tab === 'availability' ? "Today's Status" :
                                        tab === 'leave' ? `Leave (${leaveRequests.length})` :
                                            tab === 'assignments' ? `Assignments (${assignments.length})` :
                                                `Supervisors (${districtSupervisors.length})`}
                            </button>
                        ))}
                    </div>

                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="s4">
                            {drivers.length === 0 ? (
                                <div className="bento-card p-16 flex flex-col items-center justify-center text-center">
                                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '40px' }}>badge</span>
                                    </div>
                                    <h2 className="font-headline font-bold text-xl mb-2" style={{ color: '#181c22' }}>No drivers found</h2>
                                    <p className="text-sm" style={{ color: '#717a6d' }}>
                                        Drivers registered in the system will appear here
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {drivers.map(driver => {
                                        const driverAvail = availability.find(a => a.driver_id === driver.id)
                                        const as = availabilityStyle(driverAvail?.status || 'off_duty')
                                        const driverAssignment = assignments.find(a =>
                                            a.driver_id === driver.id && a.assigned_date === today)
                                        return (
                                            <div key={driver.id} className="driver-card">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                                        style={{ background: as.bg }}>
                                                        <span className="material-symbols-outlined" style={{ color: as.color, fontSize: '24px' }}>
                                                            person
                                                        </span>
                                                    </div>
                                                    <span className="status-badge" style={{ background: as.bg, color: as.color }}>
                                                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: as.dot }} />
                                                        {as.label}
                                                    </span>
                                                </div>
                                                <h3 className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>
                                                    {driver.full_name}
                                                </h3>
                                                <p className="text-xs mb-4" style={{ color: '#717a6d' }}>
                                                    {driver.district || 'No district'}{driver.phone ? ` · ${driver.phone}` : ''}
                                                </p>
                                                {driverAssignment && (
                                                    <div className="p-3 rounded-xl mb-4" style={{ background: '#f0fdf4' }}>
                                                        <p className="text-xs font-bold" style={{ color: '#00450d' }}>
                                                            {driverAssignment.route?.route_name || 'Route assigned'} · {driverAssignment.shift}
                                                        </p>
                                                        {driverAssignment.vehicle && (
                                                            <p className="text-xs mt-0.5" style={{ color: '#717a6d' }}>
                                                                {driverAssignment.vehicle.plate_number}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex gap-2 flex-wrap">
                                                    {['available', 'on_route', 'off_duty', 'on_leave'].map(s => {
                                                        const st = availabilityStyle(s)
                                                        return (
                                                            <button key={s}
                                                                onClick={() => updateAvailability(driver.id, s)}
                                                                style={{
                                                                    background: driverAvail?.status === s ? st.bg : '#f8fafc',
                                                                    color: driverAvail?.status === s ? st.color : '#94a3b8',
                                                                    border: `1.5px solid ${driverAvail?.status === s ? st.color + '40' : 'rgba(0,69,13,0.06)'}`,
                                                                    padding: '4px 10px', borderRadius: '8px', fontSize: '11px',
                                                                    fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                                                                }}>
                                                                {st.label}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Availability Tab */}
                    {activeTab === 'availability' && (
                        <div className="bento-card s4">
                            <div className="px-6 py-5 flex items-center justify-between"
                                style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <div>
                                    <h3 className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>
                                        Today's Driver Status
                                    </h3>
                                    <p className="text-xs mt-0.5" style={{ color: '#717a6d' }}>
                                        {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            {drivers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <span className="material-symbols-outlined mb-3" style={{ color: '#94a3b8', fontSize: '32px' }}>people</span>
                                    <p className="text-sm font-medium" style={{ color: '#181c22' }}>No drivers found</p>
                                </div>
                            ) : (
                                drivers.map(driver => {
                                    const driverAvail = availability.find(a => a.driver_id === driver.id)
                                    const as = availabilityStyle(driverAvail?.status || 'off_duty')
                                    return (
                                        <div key={driver.id} className="list-row">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: as.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: as.color, fontSize: '20px' }}>
                                                    person
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold" style={{ color: '#181c22' }}>{driver.full_name}</p>
                                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                                    {driverAvail?.shift || 'No shift'} · {driver.district || 'No district'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="status-badge" style={{ background: as.bg, color: as.color }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: as.dot }} />
                                                    {as.label}
                                                </span>
                                                <select
                                                    className="form-input"
                                                    style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                                                    value={driverAvail?.status || 'off_duty'}
                                                    onChange={e => updateAvailability(driver.id, e.target.value)}>
                                                    <option value="available">Available</option>
                                                    <option value="on_route">On Route</option>
                                                    <option value="off_duty">Off Duty</option>
                                                    <option value="on_leave">On Leave</option>
                                                    <option value="sick">Sick</option>
                                                </select>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* Leave Tab */}
                    {activeTab === 'leave' && (
                        <div className="s4">
                            <div className="flex justify-end mb-4">
                                <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}
                                    onClick={() => { setShowLeaveForm(true); setErrorMsg('') }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                                    Log Leave
                                </button>
                            </div>
                            <div className="bento-card">
                                {leaveRequests.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                            style={{ background: '#f0fdf4' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>
                                                event_available
                                            </span>
                                        </div>
                                        <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No leave requests</p>
                                        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Driver leave requests will appear here</p>
                                    </div>
                                ) : (
                                    leaveRequests.map(leave => {
                                        const ls = leaveStatusStyle(leave.status)
                                        const days = Math.ceil(
                                            (new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime())
                                            / (1000 * 60 * 60 * 24)) + 1
                                        return (
                                            <div key={leave.id} className="list-row">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                    style={{ background: ls.bg }}>
                                                    <span className="material-symbols-outlined" style={{ color: ls.color, fontSize: '20px' }}>
                                                        event_busy
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="text-sm font-bold" style={{ color: '#181c22' }}>
                                                            {leave.driver?.full_name || 'Unknown Driver'}
                                                        </p>
                                                        <span className="status-badge" style={{ background: ls.bg, color: ls.color }}>
                                                            {leave.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs" style={{ color: '#717a6d' }}>
                                                        {leave.leave_type.replace('_', ' ')} · {new Date(leave.start_date).toLocaleDateString('en-GB')} – {new Date(leave.end_date).toLocaleDateString('en-GB')} · {days} day{days !== 1 ? 's' : ''}
                                                    </p>
                                                    {leave.reason && (
                                                        <p className="text-xs mt-0.5 truncate" style={{ color: '#94a3b8' }}>{leave.reason}</p>
                                                    )}
                                                </div>
                                                {leave.status === 'pending' && (
                                                    <div className="flex gap-2 flex-shrink-0">
                                                        <button onClick={() => reviewLeave(leave.id, 'rejected')}
                                                            style={{ background: '#fef2f2', color: '#ba1a1a', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                                                            Reject
                                                        </button>
                                                        <button onClick={() => reviewLeave(leave.id, 'approved')}
                                                            style={{ background: '#f0fdf4', color: '#00450d', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                                                            Approve
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Assignments Tab */}
                    {activeTab === 'assignments' && (
                        <div className="s4">
                            <div className="flex justify-end mb-4">
                                <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}
                                    onClick={() => { setShowAssignmentForm(true); setErrorMsg('') }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                                    Assign Driver
                                </button>
                            </div>
                            <div className="bento-card">
                                {assignments.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                            style={{ background: '#f0fdf4' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>
                                                assignment_ind
                                            </span>
                                        </div>
                                        <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No assignments yet</p>
                                        <p className="text-sm mt-1 mb-6" style={{ color: '#94a3b8' }}>
                                            Assign drivers to routes and vehicles
                                        </p>
                                        <button className="btn-primary" onClick={() => setShowAssignmentForm(true)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                            Assign Driver
                                        </button>
                                    </div>
                                ) : (
                                    assignments.map(a => (
                                        <div key={a.id} className="list-row">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: '#f0fdf4' }}>
                                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>
                                                    assignment_ind
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold" style={{ color: '#181c22' }}>
                                                    {a.driver?.full_name || 'Unknown'}
                                                </p>
                                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                                    {a.route?.route_name || 'No route'} · {a.vehicle?.plate_number || 'No vehicle'} · {a.shift} · {new Date(a.assigned_date).toLocaleDateString('en-GB')}
                                                </p>
                                            </div>
                                            <span className="status-badge"
                                                style={{ background: a.status === 'active' ? '#f0fdf4' : '#f8fafc', color: a.status === 'active' ? '#00450d' : '#64748b' }}>
                                                {a.status}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Supervisors Tab */}
                    {activeTab === 'supervisors' && (
                        <div className="s4">
                            <div className="mb-4 p-4 rounded-xl flex items-center gap-3"
                                style={{ background: '#f0f9ff', border: '1px solid rgba(3,105,161,0.15)' }}>
                                <span className="material-symbols-outlined" style={{ color: '#0369a1', fontSize: '20px' }}>info</span>
                                <p className="text-sm" style={{ color: '#0369a1', fontFamily: 'Inter, sans-serif' }}>
                                    Showing CMC supervisors assigned to <strong>{profile?.district || 'your district'}</strong> only.
                                </p>
                            </div>
                            <div className="bento-card">
                                {districtSupervisors.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                            style={{ background: '#f0fdf4' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>
                                                supervisor_account
                                            </span>
                                        </div>
                                        <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>
                                            No supervisors in your district
                                        </p>
                                        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                                            Contact CMC admin to assign supervisors to {profile?.district}
                                        </p>
                                    </div>
                                ) : (
                                    districtSupervisors.map(sup => (
                                        <div key={sup.id} className="list-row">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: '#f0fdf4' }}>
                                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>
                                                    supervisor_account
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold" style={{ color: '#181c22' }}>{sup.full_name}</p>
                                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                                    {sup.district}{sup.supervisor_phone ? ` · ${sup.supervisor_phone}` : ''}
                                                </p>
                                                {sup.assigned_wards && sup.assigned_wards.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {sup.assigned_wards.map((w: string) => (
                                                            <span key={w} className="px-2 py-0.5 rounded-lg text-xs"
                                                                style={{ background: '#f0fdf4', color: '#00450d' }}>{w}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-shrink-0">
                                                {sup.assigned_wards && sup.assigned_wards.length > 0 ? (
                                                    <span className="status-badge" style={{ background: '#f0fdf4', color: '#00450d' }}>
                                                        {sup.assigned_wards.length} ward{sup.assigned_wards.length !== 1 ? 's' : ''}
                                                    </span>
                                                ) : (
                                                    <span className="status-badge" style={{ background: '#fefce8', color: '#92400e' }}>
                                                        Unassigned
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Leave Form Modal */}
                    {showLeaveForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Log Leave Request</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>Submit a leave request for a driver</p>
                                    </div>
                                    <button onClick={() => { setShowLeaveForm(false); setErrorMsg('') }}
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
                                        <label className="form-label">Driver *</label>
                                        <select className="form-input"
                                            value={leaveForm.driver_id}
                                            onChange={e => setLeaveForm(f => ({ ...f, driver_id: e.target.value }))}>
                                            <option value="">Select driver...</option>
                                            {drivers.map(d => (
                                                <option key={d.id} value={d.id}>{d.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Leave Type</label>
                                        <select className="form-input"
                                            value={leaveForm.leave_type}
                                            onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}>
                                            <option value="annual">Annual Leave</option>
                                            <option value="sick">Sick Leave</option>
                                            <option value="emergency">Emergency Leave</option>
                                            <option value="unpaid">Unpaid Leave</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Start Date *</label>
                                            <input type="date" className="form-input"
                                                value={leaveForm.start_date}
                                                onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">End Date *</label>
                                            <input type="date" className="form-input"
                                                value={leaveForm.end_date}
                                                onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">Reason</label>
                                        <textarea className="form-input" rows={3}
                                            placeholder="Reason for leave..."
                                            value={leaveForm.reason}
                                            onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                                            style={{ resize: 'vertical' }} />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setShowLeaveForm(false); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={submitLeaveRequest} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                                                Submit
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Assignment Form Modal */}
                    {showAssignmentForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Assign Driver</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>Assign a driver to a route and vehicle</p>
                                    </div>
                                    <button onClick={() => { setShowAssignmentForm(false); setErrorMsg('') }}
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
                                        <label className="form-label">Driver *</label>
                                        <select className="form-input"
                                            value={assignmentForm.driver_id}
                                            onChange={e => setAssignmentForm(f => ({ ...f, driver_id: e.target.value }))}>
                                            <option value="">Select driver...</option>
                                            {drivers.map(d => (
                                                <option key={d.id} value={d.id}>{d.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Route</label>
                                        <select className="form-input"
                                            value={assignmentForm.route_id}
                                            onChange={e => setAssignmentForm(f => ({ ...f, route_id: e.target.value }))}>
                                            <option value="">No route</option>
                                            {routes.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    {r.route_name} — {r.ward || r.district}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Vehicle</label>
                                        <select className="form-input"
                                            value={assignmentForm.vehicle_id}
                                            onChange={e => setAssignmentForm(f => ({ ...f, vehicle_id: e.target.value }))}>
                                            <option value="">No vehicle</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>
                                                    {v.plate_number} — {v.type}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Shift</label>
                                            <select className="form-input"
                                                value={assignmentForm.shift}
                                                onChange={e => setAssignmentForm(f => ({ ...f, shift: e.target.value }))}>
                                                <option value="morning">Morning</option>
                                                <option value="afternoon">Afternoon</option>
                                                <option value="evening">Evening</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">Date *</label>
                                            <input type="date" className="form-input"
                                                value={assignmentForm.assigned_date}
                                                onChange={e => setAssignmentForm(f => ({ ...f, assigned_date: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setShowAssignmentForm(false); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={createAssignment} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                                                Assign
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