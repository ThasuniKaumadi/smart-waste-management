'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const DRIVER_NAV = [
  { label: 'Overview', href: '/dashboard/driver', icon: 'dashboard' },
  { label: 'My Route', href: '/dashboard/driver/routes', icon: 'route' },
  { label: 'Location', href: '/dashboard/driver/location', icon: 'gps_fixed' },
  { label: 'Incidents', href: '/dashboard/driver/incidents', icon: 'warning' },
  { label: 'Breakdown', href: '/dashboard/driver/breakdown', icon: 'build' },
  { label: 'Fuel Log', href: '/dashboard/driver/fuel-log', icon: 'local_gas_station' },
  { label: 'Disposal', href: '/dashboard/driver/disposal', icon: 'delete_sweep' },
]

const SKIP_REASONS = [
  { value: 'no_waste_out', label: 'No waste put out' },
  { value: 'access_denied', label: 'Access denied' },
  { value: 'wrong_waste_type', label: 'Wrong waste type' },
  { value: 'vehicle_breakdown', label: 'Vehicle breakdown' },
  { value: 'other', label: 'Other' },
]

interface Route {
  id: string
  route_name: string
  ward: string
  shift: string
  status: string
  date: string
  vehicle_number: string | null
  schedule_id: string | null
  contractor_id: string | null
}

interface Stop {
  id: string
  road_name: string
  address: string
  status: string
  stop_order: number
  skip_reason: string | null
  completed_at: string | null
  is_commercial: boolean
  notes: string | null
}

interface Schedule {
  id: string
  waste_type: string
  custom_waste_type: string | null
  collection_time: string
  wards: string[]
  ward: string | null
  streets: Record<string, string[]> | null
  notes: string | null
}

export default function DriverRoutesPage() {
  const [profile, setProfile] = useState<any>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [stops, setStops] = useState<Stop[]>([])
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStop, setUpdatingStop] = useState<string | null>(null)
  const [skipModal, setSkipModal] = useState<Stop | null>(null)
  const [skipReason, setSkipReason] = useState('')
  const [skipNote, setSkipNote] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [handoffCode, setHandoffCode] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => { loadData() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    const today = new Date().toISOString().split('T')[0]

    // Find today's assigned route for this driver
    const { data: routeData } = await supabase
      .from('routes')
      .select('*')
      .eq('driver_id', user.id)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(1)
      .single()

    if (!routeData) { setLoading(false); return }
    setRoute(routeData)

    // Load stops for this route
    const { data: stopsData } = await supabase
      .from('collection_stops')
      .select('*')
      .eq('route_id', routeData.id)
      .order('stop_order', { ascending: true })
    setStops(stopsData || [])

    // Load linked schedule for ward + streets info
    if (routeData.schedule_id) {
      const { data: schedData } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', routeData.schedule_id)
        .single()
      setSchedule(schedData)
    }

    setLoading(false)
  }

  async function markCompleted(stop: Stop) {
    setUpdatingStop(stop.id)
    const supabase = createClient()
    await supabase.from('collection_stops').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', stop.id)
    setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'completed', completed_at: new Date().toISOString() } : s))
    showToast('Stop marked as collected')
    setUpdatingStop(null)
  }

  async function markSkipped(stop: Stop) {
    if (!skipReason) return
    setUpdatingStop(stop.id)
    const supabase = createClient()
    await supabase.from('collection_stops').update({
      status: 'skipped',
      skip_reason: skipReason,
      notes: skipNote || null,
    }).eq('id', stop.id)
    setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'skipped', skip_reason: skipReason } : s))
    setSkipModal(null); setSkipReason(''); setSkipNote('')
    showToast('Stop marked as skipped')
    setUpdatingStop(null)
  }

  async function dispatchRoute() {
    if (!route) return
    setDispatching(true)
    try {
      const res = await fetch('/api/handoff/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_id: route.id, driver_id: profile?.id }),
      })
      const data = await res.json()
      if (res.ok && data.code) {
        setHandoffCode(data.code)
        const supabase = createClient()
        await supabase.from('routes').update({ status: 'completed' }).eq('id', route.id)
        setRoute(prev => prev ? { ...prev, status: 'completed' } : prev)
        showToast('Route dispatched! Share your handoff code with the facility.')
      }
    } catch { showToast('Error dispatching route') }
    setDispatching(false)
  }

  const completed = stops.filter(s => s.status === 'completed').length
  const skipped = stops.filter(s => s.status === 'skipped').length
  const pending = stops.filter(s => s.status === 'pending').length
  const progress = stops.length > 0 ? Math.round((completed / stops.length) * 100) : 0

  // Streets from schedule for driver's ward
  const scheduleStreets: string[] = []
  if (schedule?.streets && route?.ward) {
    const wardStreets = schedule.streets[route.ward]
    if (wardStreets) scheduleStreets.push(...wardStreets)
  } else if (schedule?.streets) {
    Object.values(schedule.streets).forEach(s => scheduleStreets.push(...s))
  }

  const wasteLabel = schedule?.waste_type === 'other' && schedule?.custom_waste_type
    ? schedule.custom_waste_type
    : schedule?.waste_type?.replace('_', ' ') || 'Mixed waste'

  return (
    <DashboardLayout role="Driver" userName={profile?.full_name || ''} navItems={DRIVER_NAV}>
      <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msf-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:16px; box-shadow:0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.04); border:1px solid rgba(0,69,13,0.06); overflow:hidden; }
        .stop-row { padding:14px 18px; border-bottom:1px solid rgba(0,69,13,0.05); display:flex; align-items:center; gap:12px; transition:background 0.15s; }
        .stop-row:last-child { border-bottom:none; }
        .stop-row.completed { background:rgba(0,69,13,0.02); }
        .stop-row.skipped { background:rgba(186,26,26,0.02); opacity:0.7; }
        .btn-done { display:flex; align-items:center; gap:5px; padding:7px 14px; border-radius:99px; background:#00450d; color:white; border:none; cursor:pointer; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; transition:all 0.2s; white-space:nowrap; }
        .btn-done:hover { background:#1b5e20; }
        .btn-done:disabled { opacity:0.6; cursor:not-allowed; }
        .btn-skip { display:flex; align-items:center; gap:5px; padding:7px 12px; border-radius:99px; background:white; color:#ba1a1a; border:1.5px solid rgba(186,26,26,0.2); cursor:pointer; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; transition:all 0.2s; white-space:nowrap; }
        .btn-skip:hover { background:#fef2f2; }
        .badge { display:inline-flex; align-items:center; gap:3px; padding:3px 9px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; white-space:nowrap; }
        .progress-track { height:8px; background:#f0fdf4; border-radius:99px; overflow:hidden; }
        .progress-fill { height:100%; border-radius:99px; background:#00450d; transition:width 0.5s ease; }
        .street-chip { display:inline-flex; align-items:center; padding:3px 10px; border-radius:6px; font-size:11px; font-weight:600; font-family:'Manrope',sans-serif; background:rgba(0,69,13,0.07); color:#00450d; }
        .dispatch-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:14px; border-radius:12px; background:#00450d; color:white; border:none; cursor:pointer; font-family:'Manrope',sans-serif; font-weight:700; font-size:15px; transition:all 0.2s; }
        .dispatch-btn:hover { background:#1b5e20; box-shadow:0 4px 16px rgba(0,69,13,0.25); }
        .dispatch-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .toast-pill { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#181c22; color:white; padding:10px 20px; border-radius:9999px; font-size:13px; font-weight:500; z-index:1000; display:flex; align-items:center; gap:8px; box-shadow:0 4px 20px rgba(0,0,0,0.2); white-space:nowrap; animation:slideUp .3s ease; }
        @keyframes slideUp { from{transform:translateY(12px) translateX(-50%);opacity:0} to{transform:translateY(0) translateX(-50%);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both} .a3{animation:fadeUp .4s ease .14s both}
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      {toast && (
        <div className="toast-pill">
          <span className="msf-fill" style={{ fontSize: 15, color: '#4ade80' }}>check_circle</span>
          {toast}
        </div>
      )}

      {/* Skip modal */}
      {skipModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { setSkipModal(null); setSkipReason(''); setSkipNote('') }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 420, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: '0 0 3px' }}>Skip Stop</h3>
              <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>{skipModal.road_name || skipModal.address}</p>
            </div>
            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>Reason *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SKIP_REASONS.map(r => (
                    <button key={r.value} type="button" onClick={() => setSkipReason(r.value)}
                      style={{ padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${skipReason === r.value ? '#ba1a1a' : '#e5e7eb'}`, background: skipReason === r.value ? '#fef2f2' : 'white', color: skipReason === r.value ? '#ba1a1a' : '#374151', fontSize: 13, fontFamily: 'Manrope,sans-serif', fontWeight: skipReason === r.value ? 700 : 400, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>Note <span style={{ color: '#d1d5db', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span></label>
                <textarea value={skipNote} onChange={e => setSkipNote(e.target.value)} rows={2} placeholder="Any additional detail…"
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontFamily: 'Inter,sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', color: '#181c22', background: '#fafafa' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => markSkipped(skipModal)} disabled={!skipReason || !!updatingStop}
                  style={{ flex: 2, padding: 12, borderRadius: 10, background: skipReason ? '#ba1a1a' : '#e5e7eb', color: 'white', border: 'none', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: skipReason ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                  Confirm Skip
                </button>
                <button onClick={() => { setSkipModal(null); setSkipReason(''); setSkipNote('') }}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#64748b' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="a1" style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 8 }}>Driver · Route</p>
        <h1 style={{ fontSize: 42, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: 0 }}>
          My <span style={{ color: '#1b5e20' }}>Route</span>
        </h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      ) : !route ? (
        <div className="card a2" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <span className="msf" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 12 }}>route</span>
          <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 17, color: '#181c22', marginBottom: 6 }}>No route assigned today</p>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>Your contractor will assign you a route. Check back soon.</p>
        </div>
      ) : (
        <>
          {/* Route summary card */}
          <div className="a2" style={{ background: '#00450d', borderRadius: 20, padding: 24, color: 'white', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(163,246,156,0.07)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(163,246,156,0.7)', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 8 }}>
                {new Date(route.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h2 style={{ fontSize: 24, fontWeight: 900, fontFamily: 'Manrope,sans-serif', margin: '0 0 12px' }}>{route.route_name}</h2>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {route.ward && (
                  <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="msf" style={{ fontSize: 14 }}>location_on</span>{route.ward}
                  </span>
                )}
                {schedule && (
                  <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5, textTransform: 'capitalize' }}>
                    <span className="msf" style={{ fontSize: 14 }}>delete</span>{wasteLabel}
                  </span>
                )}
                {schedule?.collection_time && (
                  <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="msf" style={{ fontSize: 14 }}>schedule</span>{schedule.collection_time}
                  </span>
                )}
                {route.shift && (
                  <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>
                    {route.shift === 'night' ? '🌙' : '☀️'} {route.shift}
                  </span>
                )}
                {route.vehicle_number && (
                  <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="msf" style={{ fontSize: 14 }}>local_shipping</span>{route.vehicle_number}
                  </span>
                )}
              </div>

              {/* Streets from schedule */}
              {scheduleStreets.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(163,246,156,0.7)', fontFamily: 'Manrope,sans-serif', marginBottom: 6 }}>Streets to cover</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {scheduleStreets.map(street => (
                      <span key={street} style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>{street}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: 'rgba(163,246,156,0.8)', fontWeight: 600 }}>{completed} / {stops.length} stops completed</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{progress}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: '#a3f69c', width: `${progress}%`, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Pending', value: pending, color: '#d97706', bg: '#fefce8', icon: 'radio_button_unchecked' },
              { label: 'Completed', value: completed, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
              { label: 'Skipped', value: skipped, color: '#ba1a1a', bg: '#fef2f2', icon: 'cancel' },
            ].map(m => (
              <div key={m.label} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="msf-fill" style={{ color: m.color, fontSize: 15 }}>{m.icon}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 20, fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0, lineHeight: 1 }}>{m.value}</p>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{m.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stops list */}
          <div className="a3 card" style={{ marginBottom: 20 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', margin: 0 }}>Collection Stops</h3>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{stops.length} stops</span>
            </div>

            {stops.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <span className="msf" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 10 }}>pin_drop</span>
                <p style={{ fontSize: 14, color: '#94a3b8' }}>No stops added to this route yet.</p>
              </div>
            ) : stops.map((stop, idx) => {
              const isDone = stop.status === 'completed'
              const isSkipped = stop.status === 'skipped'
              return (
                <div key={stop.id} className={`stop-row ${isDone ? 'completed' : ''} ${isSkipped ? 'skipped' : ''}`}>
                  {/* Stop number */}
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: isDone ? '#f0fdf4' : isSkipped ? '#fef2f2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isDone
                      ? <span className="msf-fill" style={{ fontSize: 15, color: '#00450d' }}>check_circle</span>
                      : isSkipped
                        ? <span className="msf-fill" style={{ fontSize: 15, color: '#ba1a1a' }}>cancel</span>
                        : <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', fontFamily: 'Manrope,sans-serif' }}>{idx + 1}</span>
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: isDone || isSkipped ? '#94a3b8' : '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 3px', textDecoration: isSkipped ? 'line-through' : 'none' }}>
                      {stop.road_name || stop.address}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {stop.is_commercial && (
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontFamily: 'Manrope,sans-serif' }}>Commercial</span>
                      )}
                      {isDone && stop.completed_at && (
                        <span style={{ fontSize: 11, color: '#00450d', fontWeight: 600 }}>
                          ✓ {new Date(stop.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {isSkipped && stop.skip_reason && (
                        <span style={{ fontSize: 11, color: '#ba1a1a', fontStyle: 'italic' }}>
                          {SKIP_REASONS.find(r => r.value === stop.skip_reason)?.label || stop.skip_reason}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!isDone && !isSkipped && route.status !== 'completed' && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => markCompleted(stop)} disabled={updatingStop === stop.id} className="btn-done">
                        <span className="msf" style={{ fontSize: 13 }}>check</span>Done
                      </button>
                      <button onClick={() => setSkipModal(stop)} disabled={!!updatingStop} className="btn-skip">
                        <span className="msf" style={{ fontSize: 13 }}>close</span>Skip
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Dispatch button */}
          {route.status !== 'completed' && pending === 0 && stops.length > 0 && !handoffCode && (
            <div className="a3">
              <button onClick={dispatchRoute} disabled={dispatching} className="dispatch-btn">
                {dispatching
                  ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Dispatching…</>
                  : <><span className="msf" style={{ fontSize: 18 }}>local_shipping</span>Dispatch to Facility</>}
              </button>
              <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>All stops done — dispatch to generate your handoff code</p>
            </div>
          )}

          {/* Handoff code display */}
          {handoffCode && (
            <div className="a3 card" style={{ padding: 28, textAlign: 'center' }}>
              <span className="msf-fill" style={{ fontSize: 36, color: '#00450d', display: 'block', marginBottom: 12 }}>check_circle</span>
              <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', marginBottom: 6 }}>Route Dispatched!</p>
              <p style={{ fontSize: 13, color: '#717a6d', marginBottom: 20 }}>Share this code with the facility operator</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                {handoffCode.split('').map((digit, i) => (
                  <div key={i} style={{ width: 48, height: 60, borderRadius: 12, background: '#f0fdf4', border: '2px solid rgba(0,69,13,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>
                    {digit}
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8' }}>Handoff code for this route delivery</p>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}