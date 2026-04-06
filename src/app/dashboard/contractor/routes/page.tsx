'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { getWardsForDistrict } from '@/lib/districts'

const CONTRACTOR_NAV = [
  { label: 'Overview', href: '/dashboard/contractor', icon: 'dashboard' },
  { label: 'Routes', href: '/dashboard/contractor/routes', icon: 'route' },
  { label: 'Drivers', href: '/dashboard/contractor/drivers', icon: 'person' },
  { label: 'Schedules', href: '/dashboard/contractor/schedules', icon: 'calendar_month' },
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

interface Route {
  id: string
  route_name: string
  district: string
  ward: string
  vehicle_number: string
  date: string
  status: string
  shift: string
  driver_id: string
  schedule_id: string
  profiles: { full_name: string }
}

interface Driver {
  id: string
  full_name: string
  contractor_id: string
}

interface Stop {
  road_name: string
  address: string
  is_commercial: boolean
  commercial_id: string
  frequency: string
}

interface Schedule {
  id: string
  waste_type: string
  collection_day: string
  collection_time: string
  frequency: string
  shift: string
  ward: string
  scheduled_date: string
}

interface CommercialEstablishment {
  id: string
  full_name: string
  organisation_name: string | null
  district: string
  address: string
}

interface WardSupervisor {
  id: string
  supervisor_id: string
  supervisor_phone: string
  is_primary: boolean
  profiles: { full_name: string }
}

export default function ContractorRoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [commercials, setCommercials] = useState<CommercialEstablishment[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [wardSupervisors, setWardSupervisors] = useState<WardSupervisor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [wards, setWards] = useState<string[]>([])
  const [stops, setStops] = useState<Stop[]>([{
    road_name: '', address: '', is_commercial: false, commercial_id: '', frequency: 'once_a_day'
  }])
  const [formData, setFormData] = useState({
    route_name: '',
    district: '',
    ward: '',
    driver_id: '',
    vehicle_number: '',
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

    // Set district from profile and load wards
    if (p?.district) {
      setFormData(prev => ({ ...prev, district: p.district }))
      setWards(getWardsForDistrict(p.district))
    }

    const { data: routesData } = await supabase
      .from('routes')
      .select('*, profiles(full_name)')
      .eq('contractor_id', user.id)
      .order('date', { ascending: false })
    setRoutes(routesData || [])

    // Only drivers assigned to this contractor
    const { data: driversData } = await supabase
      .from('profiles')
      .select('id, full_name, contractor_id')
      .eq('role', 'driver')
      .eq('contractor_id', user.id)
    setDrivers(driversData || [])

    const { data: commercialData } = await supabase
      .from('profiles')
      .select('id, full_name, organisation_name, district, address')
      .eq('role', 'commercial_establishment')
      .eq('district', p?.district || '')
    setCommercials(commercialData || [])

    // Published schedules for contractor's district
    const { data: schedulesData } = await supabase
      .from('schedules')
      .select('*')
      .eq('district', p?.district || '')
      .eq('published', true)
      .order('scheduled_date', { ascending: true })
    setSchedules(schedulesData || [])

    setLoading(false)
  }

  async function loadWardSupervisors(ward: string, district: string) {
    if (!ward || !district) { setWardSupervisors([]); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('ward_supervisors')
      .select('*, profiles!supervisor_id(full_name)')
      .eq('ward', ward)
      .eq('district', district)
    setWardSupervisors(data || [])
  }

  function handleWardChange(ward: string) {
    setFormData(prev => ({ ...prev, ward, schedule_id: '' }))
    loadWardSupervisors(ward, formData.district)
  }

  function handleScheduleSelect(scheduleId: string) {
    const schedule = schedules.find(s => s.id === scheduleId)
    if (schedule) {
      setFormData(prev => ({
        ...prev,
        schedule_id: scheduleId,
        shift: schedule.shift || 'day',
        date: schedule.scheduled_date || prev.date,
        ward: schedule.ward || prev.ward,
      }))
      if (schedule.ward) loadWardSupervisors(schedule.ward, formData.district)
    }
  }

  function addStop() {
    setStops([...stops, { road_name: '', address: '', is_commercial: false, commercial_id: '', frequency: 'once_a_day' }])
  }

  function removeStop(index: number) {
    if (stops.length > 1) setStops(stops.filter((_, i) => i !== index))
  }

  function updateStop(index: number, field: keyof Stop, value: string | boolean) {
    const updated = [...stops]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'is_commercial' && value === false) updated[index].commercial_id = ''
    if (field === 'commercial_id' && typeof value === 'string') {
      const found = commercials.find(c => c.id === value)
      if (found?.address) updated[index].address = found.address
    }
    setStops(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.ward) { setMessage('Please select a ward'); return }
    if (!formData.driver_id) { setMessage('Please assign a driver'); return }
    if (!formData.vehicle_number) { setMessage('Please enter vehicle number'); return }

    const validStops = stops.filter(s => s.road_name.trim() !== '')
    if (validStops.length === 0) { setMessage('Please add at least one road/stop'); return }

    setSaving(true)
    setMessage('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Auto-generate route name if empty
    const routeName = formData.route_name.trim() ||
      `${formData.district.split(' - ')[0]} · ${formData.ward} · ${formData.shift === 'night' ? 'Night' : 'Day'} · ${new Date(formData.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`

    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .insert({
        route_name: routeName,
        district: formData.district,
        ward: formData.ward,
        driver_id: formData.driver_id,
        vehicle_number: formData.vehicle_number,
        date: formData.date,
        shift: formData.shift,
        schedule_id: formData.schedule_id || null,
        contractor_id: user?.id,
        status: 'pending',
      })
      .select()
      .single()

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
    }))

    const { error: stopsError } = await supabase.from('collection_stops').insert(stopsToInsert)

    if (stopsError) {
      setMessage('Error creating stops: ' + stopsError.message)
    } else {
      setMessage('Route created successfully!')
      setShowForm(false)
      setFormData({
        route_name: '', district: profile?.district || '', ward: '',
        driver_id: '', vehicle_number: '',
        date: new Date().toISOString().split('T')[0],
        shift: 'day', schedule_id: '',
      })
      setStops([{ road_name: '', address: '', is_commercial: false, commercial_id: '', frequency: 'once_a_day' }])
      setWardSupervisors([])
      loadData()
    }
    setSaving(false)
  }

  async function updateRouteStatus(routeId: string, status: string) {
    const supabase = createClient()
    await supabase.from('routes').update({ status }).eq('id', routeId)
    loadData()
  }

  const selectedSchedule = schedules.find(s => s.id === formData.schedule_id)
  const wardSchedules = formData.ward
    ? schedules.filter(s => !s.ward || s.ward === formData.ward)
    : schedules

  return (
    <DashboardLayout
      role="Contractor"
      userName={profile?.full_name || profile?.organisation_name || ''}
      navItems={CONTRACTOR_NAV}
      primaryAction={{ label: 'New Route', href: '#', icon: 'add' }}
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
        .form-field {
          width: 100%; padding: 11px 14px;
          border: 1.5px solid #e5e7eb; border-radius: 10px;
          font-size: 14px; color: #181c22; font-family: 'Inter', sans-serif;
          background: #fafafa; transition: all 0.2s ease; outline: none; box-sizing: border-box;
        }
        .form-field:focus { border-color: #00450d; background: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.08); }
        .form-field::placeholder { color: #9ca3af; }
        .select-field {
          width: 100%; padding: 11px 14px;
          border: 1.5px solid #e5e7eb; border-radius: 10px;
          font-size: 14px; color: #181c22; font-family: 'Inter', sans-serif;
          background: #fafafa; transition: all 0.2s ease; outline: none;
          cursor: pointer; appearance: none; box-sizing: border-box;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23717a6d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center; background-size: 14px;
        }
        .select-field:focus { border-color: #00450d; background-color: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.08); }
        .field-label {
          display: block; font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.1em; color: #374151; font-family: 'Manrope', sans-serif; margin-bottom: 7px;
        }
        .submit-btn {
          background: #00450d; color: white; border: none; border-radius: 10px; padding: 13px 24px;
          font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 14px;
          cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 8px;
        }
        .submit-btn:hover { background: #1b5e20; box-shadow: 0 4px 16px rgba(0,69,13,0.25); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .stop-card {
          background: #f9f9ff; border: 1.5px solid #e5e7eb; border-radius: 12px; padding: 16px;
          transition: border-color 0.2s ease;
        }
        .stop-card:hover { border-color: rgba(0,69,13,0.2); }
        .shift-btn {
          flex: 1; padding: 10px; border-radius: 10px; border: 1.5px solid #e5e7eb;
          font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 13px;
          cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center;
          justify-content: center; gap: 6px;
        }
        .shift-btn.active-day { border-color: #d97706; background: #fefce8; color: #92400e; }
        .shift-btn.active-night { border-color: #1d4ed8; background: #eff6ff; color: #1e3a8a; }
        .shift-btn:not(.active-day):not(.active-night) { background: white; color: #64748b; }
        .route-row {
          padding: 20px 24px; border-bottom: 1px solid rgba(0,69,13,0.04);
          display: flex; align-items: center; gap: 16px; transition: background 0.2s ease;
        }
        .route-row:hover { background: #f9f9ff; }
        .route-row:last-child { border-bottom: none; }
        .status-badge {
          display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em; text-transform: uppercase;
        }
        .action-btn {
          padding: 7px 16px; border-radius: 99px; font-size: 12px; font-weight: 700;
          font-family: 'Manrope', sans-serif; cursor: pointer; transition: all 0.2s ease;
          border: 1.5px solid; white-space: nowrap;
        }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .slide-down { animation: slideDown 0.3s ease both; }
      `}</style>

      {/* Hero */}
      <section className="mb-10 s1">
        <span className="text-xs font-bold uppercase block mb-2"
          style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
          {profile?.organisation_name || 'Contractor'} · Route Management
        </span>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="font-headline font-extrabold tracking-tight"
            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
            Collection <span style={{ color: '#1b5e20' }}>Routes</span>
          </h1>
          <button onClick={() => setShowForm(!showForm)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: showForm ? '#f1f5f9' : '#00450d', color: showForm ? '#64748b' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s ease' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {showForm ? 'close' : 'add'}
            </span>
            {showForm ? 'Cancel' : 'New Route'}
          </button>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
        {[
          { label: 'Total Routes', value: routes.length, icon: 'route', color: '#00450d', bg: '#f0fdf4' },
          { label: 'Active', value: routes.filter(r => r.status === 'active').length, icon: 'directions_car', color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Pending', value: routes.filter(r => r.status === 'pending').length, icon: 'pending', color: '#d97706', bg: '#fefce8' },
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

      {/* Message */}
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
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

              {/* Ward */}
              <div>
                <label className="field-label">Ward *</label>
                <select className="select-field" value={formData.ward}
                  onChange={e => handleWardChange(e.target.value)} required>
                  <option value="">Select ward</option>
                  {wards.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>

              {/* Shift */}
              <div>
                <label className="field-label">Shift *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button"
                    onClick={() => setFormData(prev => ({ ...prev, shift: 'day' }))}
                    className={`shift-btn ${formData.shift === 'day' ? 'active-day' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>wb_sunny</span>
                    Day
                  </button>
                  <button type="button"
                    onClick={() => setFormData(prev => ({ ...prev, shift: 'night' }))}
                    className={`shift-btn ${formData.shift === 'night' ? 'active-night' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>nights_stay</span>
                    Night
                  </button>
                </div>
              </div>

              {/* Link to published schedule */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">
                  Link to Published Schedule
                  <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '6px' }}>(Optional — auto-fills date and waste type)</span>
                </label>
                {wardSchedules.length === 0 ? (
                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#fefce8', border: '1px solid rgba(217,119,6,0.2)', fontSize: '13px', color: '#92400e' }}>
                    ⚠ No published schedules for {formData.ward || 'this ward'} yet. DE needs to publish a schedule first.
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
                      Linked to schedule: <strong>{selectedSchedule.waste_type?.replace('_', ' ')} — {selectedSchedule.collection_day}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Driver */}
              <div>
                <label className="field-label">Assign Driver *</label>
                {drivers.length === 0 ? (
                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#fefce8', border: '1px solid rgba(217,119,6,0.2)', fontSize: '13px', color: '#92400e' }}>
                    ⚠ No drivers assigned to your company. Add drivers first.
                  </div>
                ) : (
                  <select className="select-field" value={formData.driver_id}
                    onChange={e => setFormData({ ...formData, driver_id: e.target.value })} required>
                    <option value="">Select driver</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                )}
              </div>

              {/* Vehicle */}
              <div>
                <label className="field-label">Vehicle Number *</label>
                <input type="text" className="form-field" placeholder="e.g. WP CAB 1234"
                  value={formData.vehicle_number}
                  onChange={e => setFormData({ ...formData, vehicle_number: e.target.value })} required />
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
                <input type="text" className="form-field" placeholder="e.g. Mattakkuliya Morning Route"
                  value={formData.route_name}
                  onChange={e => setFormData({ ...formData, route_name: e.target.value })} />
              </div>
            </div>

            {/* Ward supervisor info */}
            {wardSupervisors.length > 0 && (
              <div style={{ marginBottom: '20px', padding: '16px', background: '#ecfeff', border: '1px solid rgba(8,145,178,0.2)', borderRadius: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#0891b2', fontFamily: 'Manrope, sans-serif', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Ward Supervisor{wardSupervisors.length > 1 ? 's' : ''} — {formData.ward}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {wardSupervisors.map(ws => (
                    <div key={ws.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: 'white', fontSize: '12px', fontWeight: 700 }}>
                          {(ws.profiles as any)?.full_name?.charAt(0) || 'S'}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: 0 }}>
                          {(ws.profiles as any)?.full_name}
                          {ws.is_primary && <span style={{ marginLeft: '4px', fontSize: '10px', color: '#0891b2' }}>(Primary)</span>}
                        </p>
                        {ws.supervisor_phone && (
                          <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{ws.supervisor_phone}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collection Stops — Roads */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label className="field-label" style={{ margin: 0 }}>
                  Collection Roads / Stops *
                </label>
                <button type="button" onClick={addStop}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '99px', border: '1.5px solid rgba(0,69,13,0.2)', background: 'white', color: '#00450d', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                  Add Road
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stops.map((stop, index) => (
                  <div key={index} className="stop-card">
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '10px', alignItems: 'start' }}>

                      {/* Road name */}
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px', fontFamily: 'Manrope, sans-serif' }}>
                          Road Name *
                        </label>
                        <input type="text" className="form-field" placeholder="e.g. Kotahena Street"
                          value={stop.road_name}
                          onChange={e => updateStop(index, 'road_name', e.target.value)} />
                      </div>

                      {/* Frequency */}
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px', fontFamily: 'Manrope, sans-serif' }}>
                          Frequency
                        </label>
                        <select className="select-field" value={stop.frequency}
                          onChange={e => updateStop(index, 'frequency', e.target.value)}>
                          {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>

                      {/* Type toggle */}
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px', fontFamily: 'Manrope, sans-serif' }}>
                          Type
                        </label>
                        <button type="button"
                          onClick={() => updateStop(index, 'is_commercial', !stop.is_commercial)}
                          style={{ width: '100%', padding: '10px 8px', borderRadius: '10px', border: `1.5px solid ${stop.is_commercial ? 'rgba(217,119,6,0.3)' : '#e5e7eb'}`, background: stop.is_commercial ? '#fefce8' : 'white', color: stop.is_commercial ? '#92400e' : '#64748b', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                          {stop.is_commercial ? '🏢 Commercial' : '🏠 Residential'}
                        </button>
                      </div>

                      {/* Remove */}
                      <div style={{ paddingTop: '22px' }}>
                        {stops.length > 1 && (
                          <button type="button" onClick={() => removeStop(index)}
                            style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1.5px solid rgba(186,26,26,0.2)', background: '#fef2f2', color: '#ba1a1a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Commercial picker */}
                    {stop.is_commercial && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px', fontFamily: 'Manrope, sans-serif' }}>
                          Commercial Establishment
                        </label>
                        <select className="select-field" value={stop.commercial_id}
                          onChange={e => updateStop(index, 'commercial_id', e.target.value)}>
                          <option value="">Select establishment</option>
                          {commercials.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.organisation_name || c.full_name} — {c.address}
                            </option>
                          ))}
                        </select>
                        {stop.commercial_id ? (
                          <p style={{ fontSize: '11px', color: '#00450d', marginTop: '4px' }}>
                            ✓ Billing auto-generated on collection
                          </p>
                        ) : (
                          <p style={{ fontSize: '11px', color: '#d97706', marginTop: '4px' }}>
                            ⚠ Select an establishment to enable billing
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button type="submit" disabled={saving} className="submit-btn">
                {saving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating Route...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_road</span>
                    Create Route
                  </>
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

      {/* ROUTE LIST */}
      <div className="bento-card s3">
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
          <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>All Routes</h3>
          <p className="text-sm mt-1" style={{ color: '#717a6d' }}>{profile?.district}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
          </div>
        ) : routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
              <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>route</span>
            </div>
            <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No routes yet</p>
            <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px' }}>
              Create your first collection route
            </p>
            <button onClick={() => setShowForm(true)} className="submit-btn" style={{ width: 'auto' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              New Route
            </button>
          </div>
        ) : (
          <div>
            {routes.map(route => {
              const ss = STATUS_STYLE[route.status] || STATUS_STYLE.pending
              return (
                <div key={route.id} className="route-row">
                  {/* Status indicator */}
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: ss.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: ss.color, fontSize: '20px' }}>
                      {route.status === 'completed' ? 'check_circle' :
                        route.status === 'active' ? 'directions_car' :
                          route.status === 'cancelled' ? 'cancel' : 'schedule'}
                    </span>
                  </div>

                  {/* Route info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                        {route.route_name}
                      </p>
                      <span className="status-badge" style={{ background: ss.bg, color: ss.color }}>
                        {route.status}
                      </span>
                      {route.shift === 'night' && (
                        <span className="status-badge" style={{ background: '#eff6ff', color: '#1e3a8a' }}>
                          🌙 Night
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                        {route.ward || route.district}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>person</span>
                        {route.profiles?.full_name || 'Unassigned'}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>local_shipping</span>
                        {route.vehicle_number}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>
                        {new Date(route.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {route.status === 'pending' && (
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}