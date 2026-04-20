'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { getWardsForDistrict } from '@/lib/districts'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
    { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
    { label: 'History', href: '/dashboard/district-engineer/collection-history', icon: 'history' },
    { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
    { label: 'Heatmap', href: '/dashboard/district-engineer/heatmap', icon: 'thermostat' },
    { label: 'Reports', href: '/dashboard/district-engineer/reports', icon: 'report_problem' },
    { label: 'Incidents', href: '/dashboard/district-engineer/incidents', icon: 'warning' },
    { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
    { label: 'Bin Requests', href: '/dashboard/district-engineer/bin-requests', icon: 'delete_outline' },
  { label: 'Compliance', href: '/dashboard/district-engineer/compliance', icon: 'verified' },
  { label: 'Announcements', href: '/dashboard/district-engineer/announcements', icon: 'campaign' },
    { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

const FREQUENCIES = [
    { value: 'once_a_day', label: 'Once a Day' },
    { value: 'twice_a_day', label: 'Twice a Day' },
    { value: 'thrice_a_day', label: 'Thrice a Day' },
    { value: 'four_times_a_day', label: 'Four Times a Day' },
    { value: 'alternate_days', label: 'Alternate Days' },
    { value: 'twice_a_week', label: 'Twice a Week' },
    { value: 'once_a_week', label: 'Once a Week' },
]

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
    pending: { color: '#d97706', bg: '#fefce8' },
    active: { color: '#1d4ed8', bg: '#eff6ff' },
    completed: { color: '#00450d', bg: '#f0fdf4' },
    cancelled: { color: '#ba1a1a', bg: '#fef2f2' },
}

const WASTE_STYLE: Record<string, { color: string; bg: string }> = {
    organic: { color: '#00450d', bg: '#f0fdf4' },
    non_recyclable: { color: '#ba1a1a', bg: '#fef2f2' },
    recyclable: { color: '#1d4ed8', bg: '#eff6ff' },
    e_waste: { color: '#7c3aed', bg: '#f5f3ff' },
    bulk: { color: '#d97706', bg: '#fefce8' },
}

interface Route {
    id: string
    route_name: string
    district: string
    ward: string
    vehicle_number: string
    date: string
    status: string
    shift: string
    waste_type: string
    contractor_id: string
    driver_id: string
    schedule_id: string
    profiles: { full_name: string }
    contractor: { full_name: string; organisation_name: string }
}

interface RouteStop {
    id: string
    road_name: string
    address: string
    stop_order: number
    status: string
    frequency: string
    skip_reason: string
    is_commercial: boolean
    bin_size: string
    waste_type: string
    bin_quantity: number
}

interface Stop {
    road_name: string
    address: string
    is_commercial: boolean
    commercial_id: string
    frequency: string
    bin_size: string
    waste_type: string
    bin_quantity: number
}

export default function DERoutesPage() {
    const [profile, setProfile] = useState<any>(null)
    const [routes, setRoutes] = useState<Route[]>([])
    const [contractors, setContractors] = useState<any[]>([])
    const [commercials, setCommercials] = useState<any[]>([])
    const [schedules, setSchedules] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [filterWard, setFilterWard] = useState('all')
    const [filterShift, setFilterShift] = useState('all')
    const [expandedRoute, setExpandedRoute] = useState<string | null>(null)
    const [routeStops, setRouteStops] = useState<Record<string, RouteStop[]>>({})
    const [loadingStops, setLoadingStops] = useState<string | null>(null)
    const [wards, setWards] = useState<string[]>([])
    const [optimizing, setOptimizing] = useState<string | null>(null)
    const [optimizeResult, setOptimizeResult] = useState<Record<string, string>>({})
    const [stops, setStops] = useState<Stop[]>([{
        road_name: '', address: '', is_commercial: false, commercial_id: '',
        frequency: 'once_a_day', bin_size: '240L', waste_type: 'general', bin_quantity: 1,
    }])
    const [formData, setFormData] = useState({
        route_name: '',
        ward: '',
        contractor_id: '',
        date: new Date().toISOString().split('T')[0],
        shift: 'day',
        schedule_id: '',
    })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const districtWards = getWardsForDistrict(p?.district || '')
        setWards(districtWards)

        const { data: routesData } = await supabase
            .from('routes')
            .select(`*, profiles!driver_id(full_name), contractor:contractor_id(full_name, organisation_name)`)
            .eq('district', p?.district || '')
            .order('date', { ascending: false })
        setRoutes(routesData || [])

        // Only load contractors for this district
        const { data: contractorData } = await supabase
            .from('profiles')
            .select('id, full_name, organisation_name, district')
            .eq('role', 'contractor')
            .eq('district', p?.district || '')
        setContractors(contractorData || [])

        const { data: commercialData } = await supabase
            .from('profiles').select('id, full_name, organisation_name, address')
            .eq('role', 'commercial_establishment').eq('district', p?.district || '')
        setCommercials(commercialData || [])

        const { data: schedulesData } = await supabase
            .from('schedules').select('*')
            .eq('district', p?.district || '').eq('published', true)
            .order('scheduled_date', { ascending: true })
        setSchedules(schedulesData || [])

        setLoading(false)
    }

    const wardSchedules = formData.ward
        ? schedules.filter(s => !s.wards?.length || s.wards.includes(formData.ward) || s.ward === formData.ward)
        : schedules

    function handleScheduleSelect(scheduleId: string) {
        const schedule = schedules.find(s => s.id === scheduleId)
        if (schedule) {
            setFormData(prev => ({
                ...prev,
                schedule_id: scheduleId,
                shift: schedule.shift || 'day',
                date: schedule.scheduled_date || prev.date,
                ward: prev.ward || schedule.ward || '',
            }))
            // Auto-populate streets from schedule.streets for the selected ward
            if (schedule.streets) {
                const ward = formData.ward || schedule.ward
                const scheduleStreets: string[] = ward && schedule.streets[ward]
                    ? schedule.streets[ward]
                    : Object.values(schedule.streets as Record<string, string[]>).flat()
                if (scheduleStreets.length > 0) {
                    setStops(scheduleStreets.map(street => ({
                        road_name: street,
                        address: street,
                        is_commercial: false,
                        commercial_id: '',
                        frequency: 'once_a_day',
                        bin_size: '240L',
                        waste_type: 'general',
                        bin_quantity: 1,
                    })))
                }
            }
        }
    }

    function addStop() {
        setStops([...stops, {
            road_name: '', address: '', is_commercial: false, commercial_id: '',
            frequency: 'once_a_day', bin_size: '240L', waste_type: 'general', bin_quantity: 1,
        }])
    }

    function removeStop(index: number) {
        if (stops.length > 1) setStops(stops.filter((_, i) => i !== index))
    }

    function updateStop(index: number, field: keyof Stop, value: string | boolean | number) {
        const updated = [...stops]
        updated[index] = { ...updated[index], [field]: value }
        if (field === 'is_commercial' && value === false) {
            updated[index].commercial_id = ''
            updated[index].bin_size = '240L'
            updated[index].waste_type = 'general'
            updated[index].bin_quantity = 1
        }
        if (field === 'commercial_id' && typeof value === 'string') {
            const found = commercials.find(c => c.id === value)
            if (found?.address) updated[index].address = found.address
        }
        setStops(updated)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!formData.ward) { setMessage('Please select a ward'); return }
        if (!formData.contractor_id) { setMessage('Please select a contractor'); return }
        const validStops = stops.filter(s => s.road_name.trim() !== '')
        if (validStops.length === 0) { setMessage('Please add at least one street/stop'); return }

        setSaving(true)
        setMessage('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const routeName = formData.route_name.trim() ||
            `${profile?.district?.split(' - ')[0]} · ${formData.ward} · ${formData.shift === 'night' ? 'Night' : 'Day'} · ${new Date(formData.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`

        const { data: routeData, error: routeError } = await supabase
            .from('routes')
            .insert({
                route_name: routeName,
                district: profile?.district,
                ward: formData.ward,
                contractor_id: formData.contractor_id,
                date: formData.date,
                shift: formData.shift,
                schedule_id: formData.schedule_id || null,
                created_by: user?.id,
                status: 'pending',
                // driver and vehicle left null — contractor assigns these
            })
            .select().single()

        if (routeError) { setMessage('Error: ' + routeError.message); setSaving(false); return }

        const stopsToInsert = validStops.map((stop, index) => ({
            route_id: routeData.id,
            address: stop.address || stop.road_name,
            road_name: stop.road_name,
            stop_order: index + 1,
            status: 'pending',
            frequency: stop.frequency,
            is_commercial: stop.is_commercial,
            commercial_id: stop.is_commercial && stop.commercial_id ? stop.commercial_id : null,
            bin_size: stop.is_commercial ? stop.bin_size : null,
            waste_type: stop.is_commercial ? stop.waste_type : null,
            bin_quantity: stop.is_commercial ? stop.bin_quantity : null,
        }))

        const { error: stopsError } = await supabase.from('collection_stops').insert(stopsToInsert)

        if (stopsError) {
            setMessage('Error creating stops: ' + stopsError.message)
        } else {
            setMessage('Route created! The assigned contractor can now staff it with a driver and vehicle.')
            setShowForm(false)
            setFormData({
                route_name: '', ward: '', contractor_id: '',
                date: new Date().toISOString().split('T')[0], shift: 'day', schedule_id: '',
            })
            setStops([{
                road_name: '', address: '', is_commercial: false, commercial_id: '',
                frequency: 'once_a_day', bin_size: '240L', waste_type: 'general', bin_quantity: 1,
            }])
            loadData()
        }
        setSaving(false)
    }

    async function loadRouteStops(routeId: string) {
        if (routeStops[routeId]) {
            setExpandedRoute(expandedRoute === routeId ? null : routeId)
            return
        }
        setLoadingStops(routeId)
        const supabase = createClient()
        const { data } = await supabase
            .from('collection_stops').select('*')
            .eq('route_id', routeId).order('stop_order', { ascending: true })
        setRouteStops(prev => ({ ...prev, [routeId]: data || [] }))
        setExpandedRoute(routeId)
        setLoadingStops(null)
    }

    async function updateRouteStatus(routeId: string, status: string) {
        const supabase = createClient()
        await supabase.from('routes').update({ status }).eq('id', routeId)
        loadData()
    }

    async function optimizeRoute(routeId: string, routeStopList: RouteStop[]) {
        const pendingStops = routeStopList.filter(s => s.status === 'pending')
        if (pendingStops.length < 3) {
            setOptimizeResult(prev => ({ ...prev, [routeId]: 'Need at least 3 pending stops to optimize.' }))
            return
        }
        setOptimizing(routeId)
        setOptimizeResult(prev => ({ ...prev, [routeId]: '' }))
        try {
            const route = routes.find(r => r.id === routeId)
            const locationContext = route?.ward ? `${route.ward}, Colombo, Sri Lanka` : 'Colombo, Sri Lanka'
            const origin = `${pendingStops[0].road_name || pendingStops[0].address}, ${locationContext}`
            const destination = `${pendingStops[pendingStops.length - 1].road_name || pendingStops[pendingStops.length - 1].address}, ${locationContext}`
            const waypoints = pendingStops.slice(1, -1)
                .map(s => encodeURIComponent(`${s.road_name || s.address}, ${locationContext}`))
                .join('|')
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=optimize:true|${waypoints}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&region=lk`
            const res = await fetch(`/api/optimize-route?${new URLSearchParams({ url })}`)
            const data = await res.json()
            if (data.status !== 'OK') {
                setOptimizeResult(prev => ({ ...prev, [routeId]: `Maps API error: ${data.status}` }))
                setOptimizing(null)
                return
            }
            const order: number[] = data.routes[0].waypoint_order
            const middleStops = pendingStops.slice(1, -1)
            const reordered = [pendingStops[0], ...order.map(i => middleStops[i]), pendingStops[pendingStops.length - 1]]
            const supabase = createClient()
            const nonPending = routeStopList.filter(s => s.status !== 'pending')
            const baseOrder = nonPending.length > 0 ? Math.max(...nonPending.map(s => s.stop_order)) : 0
            await Promise.all(reordered.map((stop, index) =>
                supabase.from('collection_stops').update({ stop_order: baseOrder + index + 1 }).eq('id', stop.id)
            ))
            const { data: updated } = await supabase
                .from('collection_stops').select('*')
                .eq('route_id', routeId).order('stop_order', { ascending: true })
            setRouteStops(prev => ({ ...prev, [routeId]: updated || [] }))
            const totalKm = (data.routes[0].legs.reduce((s: number, l: any) => s + l.distance.value, 0) / 1000).toFixed(1)
            setOptimizeResult(prev => ({ ...prev, [routeId]: `✓ Optimized — ${totalKm} km · ${pendingStops.length} stops reordered` }))
        } catch {
            setOptimizeResult(prev => ({ ...prev, [routeId]: 'Optimization failed. Check API key.' }))
        }
        setOptimizing(null)
    }

    const filtered = routes.filter(r => {
        if (filterStatus !== 'all' && r.status !== filterStatus) return false
        if (filterWard !== 'all' && r.ward !== filterWard) return false
        if (filterShift !== 'all' && r.shift !== filterShift) return false
        return true
    })

    const wardCoverage = wards.map(ward => ({
        ward,
        total: routes.filter(r => r.ward === ward).length,
        active: routes.filter(r => r.ward === ward && r.status === 'active').length,
        completed: routes.filter(r => r.ward === ward && r.status === 'completed').length,
        pending: routes.filter(r => r.ward === ward && r.status === 'pending').length,
    }))

    function getStopFrequencyStyle(freq: string) {
        if (freq === 'four_times_a_day') return { color: '#ba1a1a', bg: '#fef2f2' }
        if (freq === 'thrice_a_day') return { color: '#d97706', bg: '#fefce8' }
        if (freq === 'twice_a_day') return { color: '#1d4ed8', bg: '#eff6ff' }
        return { color: '#00450d', bg: '#f0fdf4' }
    }

    const selectedSchedule = schedules.find(s => s.id === formData.schedule_id)

    return (
        <DashboardLayout
            role="District Engineer"
            userName={profile?.full_name || ''}
            navItems={DE_NAV}
            primaryAction={{ label: 'New Route', href: '#', icon: 'add' }}
        >
            <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .bento-card { background: white; border-radius: 16px; box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08); border: 1px solid rgba(0,69,13,0.04); overflow: hidden; }
        .form-field { width: 100%; padding: 11px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 14px; color: #181c22; font-family: 'Inter', sans-serif; background: #fafafa; transition: all 0.2s ease; outline: none; box-sizing: border-box; }
        .form-field:focus { border-color: #00450d; background: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.08); }
        .form-field::placeholder { color: #9ca3af; }
        .select-field { width: 100%; padding: 11px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 14px; color: #181c22; font-family: 'Inter', sans-serif; background: #fafafa; transition: all 0.2s ease; outline: none; cursor: pointer; appearance: none; box-sizing: border-box; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23717a6d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; background-size: 14px; }
        .select-field:focus { border-color: #00450d; background-color: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.08); }
        .field-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #374151; font-family: 'Manrope', sans-serif; margin-bottom: 7px; }
        .submit-btn { background: #00450d; color: white; border: none; border-radius: 10px; padding: 13px 24px; font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 8px; }
        .submit-btn:hover { background: #1b5e20; box-shadow: 0 4px 16px rgba(0,69,13,0.25); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .shift-btn { flex: 1; padding: 10px; border-radius: 10px; border: 1.5px solid #e5e7eb; font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .shift-btn.active-day { border-color: #d97706; background: #fefce8; color: #92400e; }
        .shift-btn.active-night { border-color: #1d4ed8; background: #eff6ff; color: #1e3a8a; }
        .shift-btn:not(.active-day):not(.active-night) { background: white; color: #64748b; }
        .stop-card { background: #f9f9ff; border: 1.5px solid #e5e7eb; border-radius: 12px; padding: 16px; }
        .filter-btn { padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 700; font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s ease; }
        .filter-btn.active { background: #00450d; color: white; }
        .filter-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .filter-btn:not(.active):hover { background: #e2e8f0; }
        .route-row { padding: 18px 24px; border-bottom: 1px solid rgba(0,69,13,0.04); transition: background 0.2s ease; cursor: pointer; }
        .route-row:hover { background: #f9f9ff; }
        .route-row:last-child { border-bottom: none; }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px; font-size: 10px; font-weight: 700; font-family: 'Manrope', sans-serif; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
        .stop-row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid rgba(0,69,13,0.04); font-size: 13px; }
        .stop-row:last-child { border-bottom: none; }
        .ward-card { background: white; border-radius: 14px; padding: 16px 20px; border: 1px solid rgba(0,69,13,0.06); transition: all 0.2s ease; }
        .ward-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.06); transform: translateY(-2px); }
        .action-btn { padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 700; font-family: 'Manrope', sans-serif; cursor: pointer; transition: all 0.2s ease; border: 1.5px solid; white-space: nowrap; }
        .sub-label { display: block; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; font-family: 'Manrope', sans-serif; }
        .optimize-btn { display: flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 700; font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s ease; background: linear-gradient(135deg, #00450d, #1b5e20); color: white; }
        .optimize-btn:hover { box-shadow: 0 4px 12px rgba(0,69,13,0.3); transform: translateY(-1px); }
        .optimize-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .staffing-row { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: rgba(0,69,13,0.03); border-top: 1px solid rgba(0,69,13,0.06); }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.2s both; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .slide-down { animation: slideDown 0.3s ease both; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    District Engineering · Route Management
                </span>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                            District <span style={{ color: '#1b5e20' }}>Routes</span>
                        </h1>
                        <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                            {profile?.district} · Create routes and assign to contractors for staffing
                        </p>
                    </div>
                    <button onClick={() => setShowForm(!showForm)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: showForm ? '#f1f5f9' : '#00450d', color: showForm ? '#64748b' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s ease' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showForm ? 'close' : 'add'}</span>
                        {showForm ? 'Cancel' : 'New Route'}
                    </button>
                </div>
            </section>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
                {[
                    { label: 'Total Routes', value: routes.length, icon: 'route', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Active', value: routes.filter(r => r.status === 'active').length, icon: 'directions_car', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Pending', value: routes.filter(r => r.status === 'pending').length, icon: 'schedule', color: '#d97706', bg: '#fefce8' },
                    { label: 'Completed', value: routes.filter(r => r.status === 'completed').length, icon: 'check_circle', color: '#16a34a', bg: '#f0fdf4' },
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

            {message && (
                <div className="mb-6 flex items-center gap-3 p-4 rounded-xl text-sm"
                    style={{ background: message.startsWith('Error') || message.startsWith('Please') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${message.startsWith('Error') || message.startsWith('Please') ? 'rgba(186,26,26,0.2)' : 'rgba(0,69,13,0.15)'}`, color: message.startsWith('Error') || message.startsWith('Please') ? '#ba1a1a' : '#00450d' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        {message.startsWith('Error') || message.startsWith('Please') ? 'error' : 'check_circle'}
                    </span>
                    {message}
                </div>
            )}

            {/* CREATE FORM */}
            {showForm && (
                <div className="bento-card mb-8 slide-down">
                    <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Create New Route</h3>
                        <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                            District: <strong style={{ color: '#00450d' }}>{profile?.district}</strong>
                            {' · '}Driver and vehicle will be assigned by the contractor
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

                            {/* Ward */}
                            <div>
                                <label className="field-label">Ward *</label>
                                <select className="select-field" value={formData.ward}
                                    onChange={e => setFormData({ ...formData, ward: e.target.value, schedule_id: '' })} required>
                                    <option value="">Select ward</option>
                                    {wards.map(w => <option key={w} value={w}>{w}</option>)}
                                </select>
                            </div>

                            {/* Shift */}
                            <div>
                                <label className="field-label">Shift *</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, shift: 'day' }))}
                                        className={`shift-btn ${formData.shift === 'day' ? 'active-day' : ''}`}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>wb_sunny</span>Day
                                    </button>
                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, shift: 'night' }))}
                                        className={`shift-btn ${formData.shift === 'night' ? 'active-night' : ''}`}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>nights_stay</span>Night
                                    </button>
                                </div>
                            </div>

                            {/* Schedule link */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="field-label">
                                    Link to Published Schedule
                                    <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '6px' }}>
                                        (Auto-fills date, shift and streets)
                                    </span>
                                </label>
                                {wardSchedules.length === 0 ? (
                                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#fefce8', border: '1px solid rgba(217,119,6,0.2)', fontSize: '13px', color: '#92400e' }}>
                                        ⚠ No published schedules for {formData.ward || 'this ward'} yet.
                                    </div>
                                ) : (
                                    <select className="select-field" value={formData.schedule_id}
                                        onChange={e => handleScheduleSelect(e.target.value)}>
                                        <option value="">— No schedule linked —</option>
                                        {wardSchedules.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.waste_type?.replace('_', ' ')} · {s.collection_day} {s.collection_time}
                                                {s.scheduled_date ? ` · ${new Date(s.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                                                {s.shift === 'night' ? ' · Night' : ''}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                {selectedSchedule && (
                                    <div style={{ marginTop: '8px', padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '16px' }}>link</span>
                                        <span style={{ fontSize: '12px', color: '#00450d' }}>
                                            Linked: <strong>{selectedSchedule.waste_type?.replace('_', ' ')} — {selectedSchedule.collection_day}</strong>
                                            {selectedSchedule.streets && Object.keys(selectedSchedule.streets).length > 0 &&
                                                <span style={{ marginLeft: '8px', color: '#717a6d' }}>· Streets auto-populated from schedule</span>
                                            }
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Contractor — filtered to this district only */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="field-label">Assign to Contractor *</label>
                                {contractors.length === 0 ? (
                                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#fef2f2', border: '1px solid rgba(186,26,26,0.2)', fontSize: '13px', color: '#ba1a1a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>warning</span>
                                        No contractors registered for {profile?.district}. Add a contractor account with this district first.
                                    </div>
                                ) : (
                                    <select className="select-field" value={formData.contractor_id}
                                        onChange={e => setFormData({ ...formData, contractor_id: e.target.value })} required>
                                        <option value="">Select contractor</option>
                                        {contractors.map(c => (
                                            <option key={c.id} value={c.id}>{c.organisation_name || c.full_name}</option>
                                        ))}
                                    </select>
                                )}
                                {formData.contractor_id && (
                                    <p style={{ fontSize: '11px', color: '#00450d', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>info</span>
                                        The contractor will assign a driver and vehicle to this route from their fleet.
                                    </p>
                                )}
                            </div>

                            {/* Date */}
                            <div>
                                <label className="field-label">Date *</label>
                                <input type="date" className="form-field"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                            </div>

                            {/* Route name */}
                            <div>
                                <label className="field-label">
                                    Route Name
                                    <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '6px' }}>(Auto-generated if empty)</span>
                                </label>
                                <input type="text" className="form-field"
                                    placeholder={`e.g. ${formData.ward || 'Mattakkuliya'} Morning Route`}
                                    value={formData.route_name}
                                    onChange={e => setFormData({ ...formData, route_name: e.target.value })} />
                            </div>
                        </div>

                        {/* Collection Streets / Stops */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div>
                                    <label className="field-label" style={{ margin: 0 }}>Streets / Collection Points *</label>
                                    <p style={{ fontSize: '12px', color: '#717a6d', marginTop: '4px' }}>
                                        These are the streets the driver will cover on this route
                                    </p>
                                </div>
                                <button type="button" onClick={addStop}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '99px', border: '1.5px solid rgba(0,69,13,0.2)', background: 'white', color: '#00450d', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', cursor: 'pointer' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                                    Add Street
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {stops.map((stop, index) => (
                                    <div key={index} className="stop-card">
                                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '10px', alignItems: 'start' }}>
                                            <div>
                                                <label className="sub-label">Street Name *</label>
                                                <input type="text" className="form-field" placeholder="e.g. Kotahena Street"
                                                    value={stop.road_name}
                                                    onChange={e => updateStop(index, 'road_name', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="sub-label">Frequency</label>
                                                <select className="select-field" value={stop.frequency}
                                                    onChange={e => updateStop(index, 'frequency', e.target.value)}>
                                                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="sub-label">Type</label>
                                                <button type="button"
                                                    onClick={() => updateStop(index, 'is_commercial', !stop.is_commercial)}
                                                    style={{ width: '100%', padding: '10px 8px', borderRadius: '10px', border: `1.5px solid ${stop.is_commercial ? 'rgba(217,119,6,0.3)' : '#e5e7eb'}`, background: stop.is_commercial ? '#fefce8' : 'white', color: stop.is_commercial ? '#92400e' : '#64748b', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                                                    {stop.is_commercial ? '🏢 Commercial' : '🏠 Residential'}
                                                </button>
                                            </div>
                                            <div style={{ paddingTop: '22px' }}>
                                                {stops.length > 1 && (
                                                    <button type="button" onClick={() => removeStop(index)}
                                                        style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1.5px solid rgba(186,26,26,0.2)', background: '#fef2f2', color: '#ba1a1a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {stop.is_commercial && (
                                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                <div>
                                                    <label className="sub-label">Commercial Establishment</label>
                                                    <select className="select-field" value={stop.commercial_id}
                                                        onChange={e => updateStop(index, 'commercial_id', e.target.value)}>
                                                        <option value="">Select establishment</option>
                                                        {commercials.map(c => (
                                                            <option key={c.id} value={c.id}>{c.organisation_name || c.full_name} — {c.address}</option>
                                                        ))}
                                                    </select>
                                                    {stop.commercial_id
                                                        ? <p style={{ fontSize: '11px', color: '#00450d', marginTop: '4px' }}>✓ Billing auto-generated on collection</p>
                                                        : <p style={{ fontSize: '11px', color: '#d97706', marginTop: '4px' }}>⚠ Select an establishment to enable billing</p>}
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                                    <div>
                                                        <label className="sub-label">Bin Size</label>
                                                        <select className="select-field" value={stop.bin_size}
                                                            onChange={e => updateStop(index, 'bin_size', e.target.value)}>
                                                            <option value="120L">120L</option>
                                                            <option value="240L">240L</option>
                                                            <option value="660L">660L</option>
                                                            <option value="1100L">1100L</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="sub-label">Waste Type</label>
                                                        <select className="select-field" value={stop.waste_type}
                                                            onChange={e => updateStop(index, 'waste_type', e.target.value)}>
                                                            <option value="general">General</option>
                                                            <option value="recyclable">Recyclable</option>
                                                            <option value="organic">Organic</option>
                                                            <option value="hazardous">Hazardous</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="sub-label">Bin Quantity</label>
                                                        <input type="number" min={1} max={999} className="form-field"
                                                            value={stop.bin_quantity}
                                                            onChange={e => updateStop(index, 'bin_quantity', Number(e.target.value))} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button type="submit" disabled={saving} className="submit-btn">
                                {saving ? (
                                    <><svg style={{ width: '16px', height: '16px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24"><circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating Route...</>
                                ) : (
                                    <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_road</span>Create Route</>
                                )}
                            </button>
                            <button type="button" onClick={() => setShowForm(false)}
                                style={{ padding: '13px 24px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: '#64748b' }}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Ward coverage */}
            {wardCoverage.length > 0 && (
                <div className="mb-8 s3">
                    <h3 className="font-headline font-bold text-lg mb-4" style={{ color: '#181c22' }}>Ward Coverage</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                        {wardCoverage.map(w => (
                            <div key={w.ward} className="ward-card"
                                onClick={() => setFilterWard(filterWard === w.ward ? 'all' : w.ward)}
                                style={{ cursor: 'pointer', borderColor: filterWard === w.ward ? '#00450d' : 'rgba(0,69,13,0.06)', background: filterWard === w.ward ? '#f0fdf4' : 'white' }}>
                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>{w.ward}</p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {w.active > 0 && <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{w.active} active</span>}
                                    {w.pending > 0 && <span className="badge" style={{ background: '#fefce8', color: '#d97706' }}>{w.pending} pending</span>}
                                    {w.completed > 0 && <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>{w.completed} done</span>}
                                    {w.total === 0 && <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>No routes</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Route list */}
            <div className="bento-card s4">
                <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                    <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>All Routes</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {['all', 'active', 'pending', 'completed'].map(f => (
                            <button key={f} onClick={() => setFilterStatus(f)} className={`filter-btn ${filterStatus === f ? 'active' : ''}`}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                        <div style={{ width: '1px', height: '20px', background: 'rgba(0,69,13,0.1)' }} />
                        {['all', 'day', 'night'].map(f => (
                            <button key={f} onClick={() => setFilterShift(f)} className={`filter-btn ${filterShift === f ? 'active' : ''}`}>
                                {f === 'day' ? '☀️ Day' : f === 'night' ? '🌙 Night' : 'All Shifts'}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>route</span>
                        </div>
                        <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No routes found</p>
                        <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px' }}>Create the first collection route for {profile?.district}</p>
                        <button onClick={() => setShowForm(true)} className="submit-btn" style={{ width: 'auto' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>New Route
                        </button>
                    </div>
                ) : (
                    <div>
                        {filtered.map(route => {
                            const ss = STATUS_STYLE[route.status] || STATUS_STYLE.pending
                            const ws = route.waste_type ? (WASTE_STYLE[route.waste_type] || { color: '#64748b', bg: '#f8fafc' }) : null
                            const isExpanded = expandedRoute === route.id
                            const currentStops = routeStops[route.id] || []
                            const isStaffed = !!route.driver_id && !!route.vehicle_number

                            return (
                                <div key={route.id}>
                                    <div className="route-row" onClick={() => loadRouteStops(route.id)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: ss.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span className="material-symbols-outlined" style={{ color: ss.color, fontSize: '20px' }}>
                                                    {route.status === 'completed' ? 'check_circle' : route.status === 'active' ? 'directions_car' : route.status === 'cancelled' ? 'cancel' : 'schedule'}
                                                </span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{route.route_name}</p>
                                                    <span className="badge" style={{ background: ss.bg, color: ss.color }}>{route.status}</span>
                                                    {ws && <span className="badge" style={{ background: ws.bg, color: ws.color }}>{route.waste_type?.replace('_', ' ')}</span>}
                                                    {route.shift === 'night' && <span className="badge" style={{ background: '#eff6ff', color: '#1e3a8a' }}>🌙 Night</span>}
                                                    {/* Staffing status */}
                                                    <span className="badge" style={{ background: isStaffed ? '#f0fdf4' : '#fef2f2', color: isStaffed ? '#00450d' : '#ba1a1a' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>{isStaffed ? 'check_circle' : 'warning'}</span>
                                                        {isStaffed ? 'Staffed' : 'Awaiting assignment'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: '#94a3b8' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                                        {route.ward || route.district}
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>business</span>
                                                        {route.contractor?.organisation_name || route.contractor?.full_name || 'No contractor'}
                                                    </span>
                                                    {route.profiles?.full_name && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>person</span>
                                                            {route.profiles.full_name}
                                                        </span>
                                                    )}
                                                    {route.vehicle_number && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>directions_car</span>
                                                            {route.vehicle_number}
                                                        </span>
                                                    )}
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>
                                                        {new Date(route.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                                {route.status === 'pending' && isStaffed && (
                                                    <button onClick={() => updateRouteStatus(route.id, 'active')}
                                                        className="action-btn"
                                                        style={{ borderColor: 'rgba(29,78,216,0.2)', color: '#1d4ed8', background: 'white' }}>
                                                        Activate
                                                    </button>
                                                )}
                                                {route.status === 'active' && (
                                                    <button onClick={() => updateRouteStatus(route.id, 'completed')}
                                                        className="action-btn"
                                                        style={{ borderColor: 'rgba(0,69,13,0.2)', color: '#00450d', background: 'white' }}>
                                                        Complete
                                                    </button>
                                                )}
                                            </div>

                                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '20px', flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                                expand_more
                                            </span>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="slide-down" style={{ background: '#f9fdf9', borderBottom: '1px solid rgba(0,69,13,0.04)' }}>
                                            {loadingStops === route.id ? (
                                                <div style={{ padding: '20px', textAlign: 'center' }}>
                                                    <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                                                </div>
                                            ) : currentStops.length === 0 ? (
                                                <div style={{ padding: '16px 24px', fontSize: '13px', color: '#94a3b8' }}>No streets/stops added yet</div>
                                            ) : (
                                                <div>
                                                    <div style={{ padding: '12px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                                        <p style={{ fontSize: '11px', fontWeight: 700, color: '#717a6d', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                                            {currentStops.length} streets
                                                        </p>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                            <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#94a3b8' }}>
                                                                <span style={{ color: '#00450d' }}>✓ {currentStops.filter(s => s.status === 'completed').length} done</span>
                                                                <span style={{ color: '#dc2626' }}>✗ {currentStops.filter(s => s.status === 'skipped').length} skipped</span>
                                                                <span style={{ color: '#d97706' }}>○ {currentStops.filter(s => s.status === 'pending').length} pending</span>
                                                            </div>
                                                            {currentStops.filter(s => s.status === 'pending').length >= 3 && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    {optimizeResult[route.id] && (
                                                                        <span style={{ fontSize: '11px', fontWeight: 600, color: optimizeResult[route.id].startsWith('✓') ? '#00450d' : '#dc2626', fontFamily: 'Manrope, sans-serif' }}>
                                                                            {optimizeResult[route.id]}
                                                                        </span>
                                                                    )}
                                                                    <button className="optimize-btn" disabled={optimizing === route.id}
                                                                        onClick={e => { e.stopPropagation(); optimizeRoute(route.id, currentStops) }}>
                                                                        {optimizing === route.id
                                                                            ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Optimizing...</>
                                                                            : <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_fix_high</span>AI Optimize Order</>}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {currentStops.map(stop => {
                                                        const fs = getStopFrequencyStyle(stop.frequency)
                                                        return (
                                                            <div key={stop.id} className="stop-row">
                                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, background: stop.status === 'completed' ? '#f0fdf4' : stop.status === 'skipped' ? '#fef2f2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: stop.status === 'completed' ? '#00450d' : stop.status === 'skipped' ? '#ba1a1a' : '#94a3b8' }}>
                                                                        {stop.status === 'completed' ? 'check' : stop.status === 'skipped' ? 'close' : 'radio_button_unchecked'}
                                                                    </span>
                                                                </div>
                                                                <div style={{ flex: 1 }}>
                                                                    <p style={{ margin: 0, fontWeight: 600, color: '#181c22', fontSize: '13px' }}>{stop.road_name || stop.address}</p>
                                                                    {stop.skip_reason && (
                                                                        <p style={{ margin: 0, fontSize: '11px', color: '#ba1a1a', marginTop: '2px' }}>Skipped: {stop.skip_reason.replace(/_/g, ' ')}</p>
                                                                    )}
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                    <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>#{stop.stop_order}</span>
                                                                    {stop.frequency && <span className="badge" style={{ background: fs.bg, color: fs.color }}>{stop.frequency.replace(/_/g, ' ')}</span>}
                                                                    {stop.is_commercial && <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Commercial</span>}
                                                                    {stop.is_commercial && stop.bin_quantity > 0 && <span className="badge" style={{ background: '#fefce8', color: '#92400e' }}>{stop.bin_quantity} × {stop.bin_size}</span>}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
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