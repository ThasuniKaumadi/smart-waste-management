'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { logCollectionOnChain } from '@/lib/blockchain'
import { createExceptionAlert } from '@/lib/alerts'

const SKIP_REASONS = [
  { value: 'wrong_waste_type', label: 'Wrong waste type for today' },
  { value: 'access_denied', label: 'Access denied / locked gate' },
  { value: 'vehicle_breakdown', label: 'Vehicle breakdown' },
  { value: 'no_waste_out', label: 'No waste put out' },
  { value: 'other', label: 'Other reason' },
]

interface Stop {
  id: string
  address: string
  road_name: string
  frequency: string
  stop_order: number
  status: string
  skip_reason: string
  bin_count: number
  blockchain_tx: string
  is_commercial: boolean
  commercial_id: string | null
  bin_size: string | null
  waste_type: string | null
  bin_quantity: number | null
}

interface Route {
  id: string
  route_name: string
  district: string
  ward: string
  vehicle_number: string
  date: string
  status: string
  waste_type: string
  shift: string
}

export default function DriverRoutesPage() {
  const router = useRouter()
  const [routes, setRoutes] = useState<Route[]>([])
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [stops, setStops] = useState<Stop[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [updatingStop, setUpdatingStop] = useState<string | null>(null)
  const [selectedSkipReason, setSelectedSkipReason] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'chain'>('success')
  const [binCounts, setBinCounts] = useState<Record<string, number>>({})
  const [dispatchingRoute, setDispatchingRoute] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  function showToast(msg: string, type: 'success' | 'error' | 'chain' = 'success') {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 4000)
  }

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!profileData || profileData.role !== 'driver') { router.push('/login'); return }
    setProfile(profileData)
    const { data: routesData } = await supabase
      .from('routes').select('*')
      .eq('driver_id', user.id)
      .in('status', ['pending', 'active'])
      .order('date', { ascending: true })
    setRoutes(routesData || [])
    setLoading(false)
  }

  async function loadStops(route: Route) {
    setSelectedRoute(route)
    const supabase = createClient()
    const { data: stopsData } = await supabase
      .from('collection_stops').select('*')
      .eq('route_id', route.id).order('stop_order', { ascending: true })
    const stops = stopsData || []
    setStops(stops)
    // Pre-fill binCounts with scheduled bin_quantity for commercial stops
    const prefilled: Record<string, number> = {}
    stops.forEach(s => {
      if (s.is_commercial && s.bin_quantity) prefilled[s.id] = s.bin_quantity
    })
    setBinCounts(prefilled)
    const routeDate = new Date(route.date)
    const hoursPast = (Date.now() - routeDate.getTime()) / (1000 * 60 * 60)
    if (route.status === 'pending' && hoursPast > 2) {
      await createExceptionAlert({
        type: 'route_not_started', title: 'Route Not Started On Time',
        message: `Route "${route.route_name}" in ${route.district} has not been started.`,
        severity: 'high', route_id: route.id, driver_id: profile?.id,
      })
    }
  }

  async function handleDispatch(e: React.MouseEvent, route: Route) {
    e.stopPropagation()
    setDispatchingRoute(route.id)
    try {
      const res = await fetch('/api/handoff/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route_id: route.id, driver_id: profile?.id,
          waste_type: route.waste_type || 'General', estimated_quantity: 0,
        }),
      })
      const data = await res.json()
      if (data.handoff) alert(`📦 Handoff Code: ${data.handoff.handoff_code}\n\nShare this 6-digit code with the facility operator.\nExpires in 30 minutes.`)
      else alert('Failed to generate handoff code.')
    } catch { alert('Something went wrong.') }
    setDispatchingRoute(null)
  }

  async function markStop(stop: Stop, status: 'completed' | 'skipped') {
    if (status === 'skipped' && !selectedSkipReason[stop.id]) {
      showToast('Please select a skip reason first', 'error'); return
    }
    setUpdatingStop(stop.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const bins = binCounts[stop.id] || 0
    const updateData: any = { status, completed_at: new Date().toISOString(), bin_count: bins }
    if (status === 'skipped') updateData.skip_reason = selectedSkipReason[stop.id]
    const { error } = await supabase.from('collection_stops').update(updateData).eq('id', stop.id)
    if (!error) {
      const txHash = await logCollectionOnChain(selectedRoute?.id || '', user?.id || '', status)
      const { data: eventData } = await supabase.from('collection_events').insert({
        route_id: selectedRoute?.id, driver_id: user?.id,
        address: stop.road_name || stop.address,
        status, skip_reason: status === 'skipped' ? selectedSkipReason[stop.id] : null,
        blockchain_tx: txHash,
      }).select().single()
      if (txHash) await supabase.from('collection_stops').update({ blockchain_tx: txHash }).eq('id', stop.id)
      if (status === 'completed' && stop.is_commercial && stop.commercial_id) {
        try {
          await fetch('/api/payhere/create-order', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collection_event_id: eventData?.id,
              commercial_id: stop.commercial_id,
              bin_count: bins,
              bin_size: stop.bin_size,
              waste_type: stop.waste_type,
            }),
          })
        } catch (err) { console.error('Billing trigger failed:', err) }
      }
      if (status === 'skipped') {
        const skipReason = selectedSkipReason[stop.id]
        const skipLabel = SKIP_REASONS.find(r => r.value === skipReason)?.label || skipReason
        const severity = skipReason === 'vehicle_breakdown' ? 'critical' : skipReason === 'access_denied' ? 'high' : 'medium'
        await createExceptionAlert({
          type: 'stop_skipped', title: 'Collection Stop Skipped',
          message: `Stop ${stop.stop_order} — "${stop.road_name || stop.address}" skipped. Reason: ${skipLabel}.`,
          severity, route_id: selectedRoute?.id, driver_id: user?.id, collection_event_id: eventData?.id,
        })
        const updatedStops = stops.map(s => s.id === stop.id ? { ...s, status: 'skipped' } : s)
        if (updatedStops.every(s => s.status === 'skipped')) {
          await createExceptionAlert({
            type: 'all_stops_skipped', title: 'All Stops Skipped',
            message: `All stops on "${selectedRoute?.route_name}" skipped.`,
            severity: 'critical', route_id: selectedRoute?.id, driver_id: user?.id,
          })
        }
        if (skipReason === 'vehicle_breakdown') {
          await createExceptionAlert({
            type: 'breakdown_reported', title: 'Vehicle Breakdown Indicated',
            message: `Breakdown at stop ${stop.stop_order} on route "${selectedRoute?.route_name}". Vehicle: ${selectedRoute?.vehicle_number}.`,
            severity: 'critical', route_id: selectedRoute?.id, driver_id: user?.id, collection_event_id: eventData?.id,
          })
        }
      }
      if (selectedRoute) loadStops(selectedRoute)
      if (txHash) showToast(`Logged on blockchain · TX: ${txHash.slice(0, 16)}...`, 'chain')
      else if (status === 'completed') showToast(stop.is_commercial && stop.commercial_id ? 'Completed · Invoice generated' : 'Stop marked as completed')
      else showToast('Stop skipped · Supervisor notified')
    }
    setUpdatingStop(null)
  }

  const completedCount = stops.filter(s => s.status === 'completed').length
  const skippedCount = stops.filter(s => s.status === 'skipped').length
  const pendingCount = stops.filter(s => s.status === 'pending').length
  const progress = stops.length > 0 ? Math.round(((completedCount + skippedCount) / stops.length) * 100) : 0

  function getFrequencyStyle(freq: string) {
    if (freq === 'four_times_a_day') return { color: '#ba1a1a', bg: 'rgba(186,26,26,0.08)' }
    if (freq === 'thrice_a_day') return { color: '#d97706', bg: 'rgba(217,119,6,0.08)' }
    if (freq === 'twice_a_day') return { color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)' }
    return null
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f3', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Manrope:wght@400;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .nav-link { transition:color 0.2s,background 0.2s; text-decoration:none; }
        .nav-link:hover { background:rgba(0,69,13,0.07); color:#00450d; }
        .route-card { transition:transform 0.18s,box-shadow 0.18s; cursor:pointer; }
        .route-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.09); }
        .stop-card { transition:box-shadow 0.15s; }
        .stop-card:hover { box-shadow:0 4px 16px rgba(0,0,0,0.07); }
        .done-btn { flex:1; background:linear-gradient(135deg,#00450d,#1b5e20); color:white; border:none; border-radius:8px; padding:9px 12px; font-family:'Manrope',sans-serif; font-weight:700; font-size:12px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:4px; box-shadow:0 2px 8px rgba(0,69,13,0.2); }
        .done-btn:hover:not(:disabled) { box-shadow:0 4px 14px rgba(0,69,13,0.3); transform:translateY(-1px); }
        .done-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .skip-btn { flex:1; background:rgba(220,38,38,0.07); color:#dc2626; border:1.5px solid rgba(220,38,38,0.18); border-radius:8px; padding:9px 12px; font-family:'Manrope',sans-serif; font-weight:700; font-size:12px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:4px; }
        .skip-btn:hover:not(:disabled) { background:rgba(220,38,38,0.12); }
        .skip-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .dispatch-btn { background:rgba(124,58,237,0.07); color:#7c3aed; border:1.5px solid rgba(124,58,237,0.18); border-radius:8px; padding:7px 12px; font-family:'Manrope',sans-serif; font-weight:700; font-size:12px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:4px; }
        .dispatch-btn:hover:not(:disabled) { background:rgba(124,58,237,0.12); }
        .dispatch-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .start-btn { background:#00450d; color:white; border:none; border-radius:8px; padding:8px 16px; font-family:'Manrope',sans-serif; font-weight:700; font-size:12px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:5px; }
        .start-btn:hover { background:#1b5e20; box-shadow:0 3px 10px rgba(0,69,13,0.25); }
        .back-btn { background:rgba(0,0,0,0.05); color:#717a6d; border:none; border-radius:8px; padding:7px 12px; font-family:'Manrope',sans-serif; font-weight:600; font-size:12px; cursor:pointer; transition:background 0.2s; display:inline-flex; align-items:center; gap:4px; }
        .back-btn:hover { background:rgba(0,0,0,0.09); }
        .skip-select { width:100%; border:1.5px solid #e4ede4; border-radius:8px; padding:8px 28px 8px 10px; font-size:12px; color:#41493e; font-family:'Inter',sans-serif; outline:none; background:#f9fbf9; cursor:pointer; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2341493e'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 8px center; background-size:12px; }
        .skip-select:focus { border-color:#00450d; background-color:white; }
        .bin-input { width:64px; border:1.5px solid #c8dbc8; border-radius:8px; padding:7px 10px; font-size:13px; font-weight:700; text-align:center; color:#00450d; outline:none; background:white; font-family:'Manrope',sans-serif; }
        .bin-input:focus { border-color:#00450d; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .toast { animation:slideUp 0.3s ease; }
        @keyframes slideUp { from { transform:translateY(12px) translateX(-50%); opacity:0; } to { transform:translateY(0) translateX(-50%); opacity:1; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        .progress-bar { height:6px; background:#e4ede4; border-radius:3px; overflow:hidden; }
        .progress-fill { height:100%; background:linear-gradient(90deg,#00450d,#43a047); border-radius:3px; transition:width 0.5s ease; }
        .freq-badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .bin-panel { background:rgba(0,69,13,0.04); border:1px solid rgba(0,69,13,0.1); border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:8px; }
        .bin-badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; white-space:nowrap; }
      `}</style>

      {toast && (
        <div className="toast" style={{ position: 'fixed', bottom: '24px', left: '50%', background: toastType === 'error' ? '#dc2626' : toastType === 'chain' ? '#1d4ed8' : '#181c22', color: 'white', padding: '10px 20px', borderRadius: '9999px', fontSize: '13px', fontWeight: 500, zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: toastType === 'error' ? '#fca5a5' : toastType === 'chain' ? '#93c5fd' : '#4ade80' }}>
            {toastType === 'error' ? 'error' : toastType === 'chain' ? 'link' : 'check_circle'}
          </span>
          {toast}
        </div>
      )}

      {/* Nav */}
      <nav style={{ background: 'white', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link href="/dashboard/driver" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#00450d' }}>eco</span>
            <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '16px', color: '#00450d', letterSpacing: '-0.02em' }}>EcoLedger</span>
          </Link>
          <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.1)' }} />
          <Link href="/dashboard/driver" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px', color: '#717a6d', fontSize: '13px', fontWeight: 500 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
            Driver Dashboard
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: 0 }}>{profile?.full_name}</p>
            <p style={{ fontSize: '11px', color: '#717a6d', margin: 0 }}>Driver</p>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg,#00450d,#1b5e20)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: 700 }}>
            {profile?.full_name?.charAt(0) || 'D'}
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ROUTE LIST */}
        {!selectedRoute ? (
          <>
            <div style={{ marginBottom: '28px' }}>
              <p style={{ fontSize: '11px', color: '#717a6d', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>Driver Tools</p>
              <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: '26px', fontWeight: 800, color: '#181c22', margin: 0, letterSpacing: '-0.02em' }}>My Routes</h1>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#717a6d', fontSize: '13px' }}>
                <div style={{ width: '28px', height: '28px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
                Loading routes...
              </div>
            ) : routes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '44px', color: '#c4c9c0', display: 'block', marginBottom: '12px' }}>route</span>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#41493e', margin: '0 0 4px' }}>No active routes assigned</p>
                <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>Your contractor will assign routes to you</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {routes.map(route => {
                  const isActive = route.status === 'active'
                  const isNight = route.shift === 'night'
                  return (
                    <div key={route.id} className="route-card" onClick={() => loadStops(route)}
                      style={{ background: 'white', borderRadius: '16px', padding: '20px 24px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '13px', flexShrink: 0, background: isNight ? 'rgba(29,78,216,0.07)' : 'rgba(0,69,13,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '24px', color: isNight ? '#1d4ed8' : '#00450d' }}>
                          {isNight ? 'nights_stay' : 'wb_sunny'}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{route.route_name}</span>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: isActive ? 'rgba(0,69,13,0.08)' : 'rgba(180,83,9,0.08)', color: isActive ? '#00450d' : '#b45309', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {route.status}
                          </span>
                          {isNight && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(29,78,216,0.08)', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🌙 Night</span>}
                          {route.waste_type && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(0,69,13,0.06)', color: '#00450d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{route.waste_type.replace('_', ' ')}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                          {[
                            { icon: 'location_on', text: route.ward ? `${route.ward} · ${route.district}` : route.district },
                            { icon: 'directions_car', text: route.vehicle_number },
                            { icon: 'calendar_today', text: new Date(route.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                            { icon: isNight ? 'nights_stay' : 'wb_sunny', text: isNight ? 'Night Shift' : 'Day Shift' },
                          ].map(m => (
                            <span key={m.icon} style={{ fontSize: '12px', color: '#717a6d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{m.icon}</span>
                              {m.text}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button className="dispatch-btn" disabled={dispatchingRoute === route.id} onClick={e => handleDispatch(e, route)}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>inventory_2</span>
                          {dispatchingRoute === route.id ? '...' : 'Dispatch'}
                        </button>
                        <button className="start-btn" onClick={e => { e.stopPropagation(); loadStops(route) }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>play_arrow</span>
                          Start
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (

          /* STOPS VIEW */
          <>
            <div style={{ marginBottom: '24px' }}>
              <button className="back-btn" style={{ marginBottom: '12px' }} onClick={() => setSelectedRoute(null)}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                All Routes
              </button>
              <h2 style={{ fontFamily: 'Manrope,sans-serif', fontSize: '22px', fontWeight: 800, color: '#181c22', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                {selectedRoute.route_name}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#717a6d' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                  {selectedRoute.ward ? `${selectedRoute.ward} · ${selectedRoute.district}` : selectedRoute.district}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>directions_car</span>
                  {selectedRoute.vehicle_number}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{selectedRoute.shift === 'night' ? 'nights_stay' : 'wb_sunny'}</span>
                  {selectedRoute.shift === 'night' ? 'Night Shift' : 'Day Shift'}
                </span>
                {selectedRoute.waste_type && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>delete_sweep</span>
                    {selectedRoute.waste_type.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>

            {/* Progress card */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '20px 24px', marginBottom: '20px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#41493e', fontFamily: 'Manrope,sans-serif' }}>Route Progress</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>{progress}%</span>
              </div>
              <div className="progress-bar" style={{ marginBottom: '16px' }}>
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                {[
                  { label: 'Completed', value: completedCount, color: '#00450d', bg: 'rgba(0,69,13,0.07)' },
                  { label: 'Skipped', value: skippedCount, color: '#dc2626', bg: 'rgba(220,38,38,0.07)' },
                  { label: 'Remaining', value: pendingCount, color: '#b45309', bg: 'rgba(180,83,9,0.07)' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '12px', borderRadius: '10px', background: s.bg }}>
                    <p style={{ fontSize: '24px', fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: s.color, margin: '0 0 2px', lineHeight: 1 }}>{s.value}</p>
                    <p style={{ fontSize: '11px', color: s.color, fontWeight: 600, margin: 0, opacity: 0.8 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stops */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stops.map(stop => {
                const freqStyle = getFrequencyStyle(stop.frequency)
                return (
                  <div key={stop.id} className="stop-card" style={{ background: 'white', borderRadius: '14px', padding: '16px 20px', border: `1px solid ${stop.status === 'completed' ? 'rgba(0,69,13,0.12)' : stop.status === 'skipped' ? 'rgba(220,38,38,0.12)' : 'rgba(0,0,0,0.05)'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>

                      {/* Stop number / status icon */}
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: stop.status === 'completed' ? 'rgba(0,69,13,0.1)' : stop.status === 'skipped' ? 'rgba(220,38,38,0.1)' : '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope,sans-serif', color: stop.status === 'completed' ? '#00450d' : stop.status === 'skipped' ? '#dc2626' : '#717a6d' }}>
                        {stop.status === 'completed'
                          ? <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                          : stop.status === 'skipped'
                            ? <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                            : stop.stop_order}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Road name + badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#181c22' }}>
                            {stop.road_name || stop.address}
                          </span>
                          {freqStyle && (
                            <span className="freq-badge" style={{ background: freqStyle.bg, color: freqStyle.color }}>
                              {stop.frequency.replace(/_/g, ' ')}
                            </span>
                          )}
                          {stop.is_commercial && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(37,99,235,0.08)', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Commercial</span>
                          )}
                          {stop.status === 'completed' && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(0,69,13,0.08)', color: '#00450d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Completed</span>
                          )}
                          {stop.status === 'skipped' && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(220,38,38,0.08)', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skipped</span>
                          )}
                          {stop.status === 'completed' && stop.is_commercial && stop.commercial_id && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(124,58,237,0.08)', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invoiced</span>
                          )}
                        </div>

                        {/* Address if different from road name */}
                        {stop.road_name && stop.address && stop.road_name !== stop.address && (
                          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>location_on</span>
                            {stop.address}
                          </p>
                        )}

                        {/* Completed commercial — show what was collected */}
                        {stop.status === 'completed' && stop.is_commercial && (stop.bin_count > 0 || stop.bin_size) && (
                          <p style={{ fontSize: '12px', color: '#00450d', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>delete_sweep</span>
                            Collected: {stop.bin_count} × {stop.bin_size || 'bin'}{stop.waste_type ? ` · ${stop.waste_type}` : ''}
                          </p>
                        )}

                        {stop.skip_reason && (
                          <p style={{ fontSize: '12px', color: '#dc2626', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>info</span>
                            {SKIP_REASONS.find(r => r.value === stop.skip_reason)?.label}
                          </p>
                        )}
                        {stop.blockchain_tx && (
                          <p style={{ fontSize: '11px', color: '#2563eb', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>link</span>
                            {stop.blockchain_tx.slice(0, 22)}...
                          </p>
                        )}

                        {/* Pending stop actions */}
                        {stop.status === 'pending' && (
                          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                            {/* Commercial bin panel */}
                            {stop.is_commercial && (
                              <div className="bin-panel">
                                {/* Scheduled bin details from DE */}
                                {(stop.bin_size || stop.waste_type || stop.bin_quantity) && (
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', color: '#717a6d', fontWeight: 600, whiteSpace: 'nowrap' }}>Scheduled:</span>
                                    {stop.bin_quantity != null && (
                                      <span className="bin-badge" style={{ background: '#fefce8', color: '#92400e' }}>
                                        {stop.bin_quantity} × {stop.bin_size || '—'}
                                      </span>
                                    )}
                                    {stop.waste_type && (
                                      <span className="bin-badge" style={{ background: '#f0fdf4', color: '#00450d' }}>
                                        {stop.waste_type}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {/* Actual count input */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', color: '#41493e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    Actual bins collected:
                                  </span>
                                  <input
                                    type="number" min="0" max="999"
                                    className="bin-input"
                                    value={binCounts[stop.id] ?? (stop.bin_quantity ?? '')}
                                    onChange={e => setBinCounts({ ...binCounts, [stop.id]: parseInt(e.target.value) || 0 })}
                                    placeholder="0"
                                  />
                                  {stop.bin_size && (
                                    <span style={{ fontSize: '11px', color: '#717a6d' }}>× {stop.bin_size}</span>
                                  )}
                                </div>
                                {!stop.commercial_id && (
                                  <span style={{ fontSize: '11px', color: '#f97316', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>warning</span>
                                    No billing linked — collection recorded only
                                  </span>
                                )}
                              </div>
                            )}

                            <select className="skip-select"
                              value={selectedSkipReason[stop.id] || ''}
                              onChange={e => setSelectedSkipReason({ ...selectedSkipReason, [stop.id]: e.target.value })}>
                              <option value="">Skip reason (select if skipping)</option>
                              {SKIP_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="done-btn" onClick={() => markStop(stop, 'completed')} disabled={updatingStop === stop.id}>
                                {updatingStop === stop.id
                                  ? <svg style={{ width: '14px', height: '14px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24"><circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                  : <><span className="material-symbols-outlined" style={{ fontSize: '15px' }}>check</span>Done</>}
                              </button>
                              <button className="skip-btn" onClick={() => markStop(stop, 'skipped')} disabled={updatingStop === stop.id}>
                                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>Skip
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}