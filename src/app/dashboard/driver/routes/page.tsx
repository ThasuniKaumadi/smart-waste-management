'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { logCollectionOnChain } from '@/lib/blockchain'
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api'

const DRIVER_NAV = [
  { label: 'Home', href: '/dashboard/driver', icon: 'dashboard' },
  { label: 'My Routes', href: '/dashboard/driver/routes', icon: 'route' },
  { label: 'Collections', href: '/dashboard/driver/collections', icon: 'local_shipping' },
  { label: 'Disposal', href: '/dashboard/driver/disposal', icon: 'delete_sweep' },
  { label: 'Fuel Log', href: '/dashboard/driver/fuel-log', icon: 'local_gas_station' },
  { label: 'Breakdown', href: '/dashboard/driver/breakdown', icon: 'car_crash' },
  { label: 'Incidents', href: '/dashboard/driver/incidents', icon: 'warning' },
  { label: 'Location', href: '/dashboard/driver/location', icon: 'location_on' },
]

interface Route {
  id: string; route_name: string; ward: string; shift: string; status: string
  date: string; vehicle_number: string | null; schedule_id: string | null
  contractor_id: string | null; district: string | null
}
interface Schedule {
  id: string; waste_type: string; custom_waste_type: string | null
  collection_time: string; wards: string[]; ward: string | null
  streets: Record<string, string[]> | null; notes: string | null
}

export default function DriverRoutesPage() {
  const [profile, setProfile] = useState<any>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [dispatching, setDispatching] = useState(false)
  const [handoffCode, setHandoffCode] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [blockchainTx, setBlockchainTx] = useState<string | null>(null)
  const [streetStatuses, setStreetStatuses] = useState<Record<string, 'pending' | 'collected' | 'skipped'>>({})
  const [noteModal, setNoteModal] = useState<string | null>(null) // street name
  const [noteText, setNoteText] = useState('')
  const [streetNotes, setStreetNotes] = useState<Record<string, string>>({})
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const [mapCenter, setMapCenter] = useState({ lat: 6.9271, lng: 79.8612 })
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  })

  useEffect(() => { loadData() }, [])

  // Broadcast location every 30s when active
  useEffect(() => {
    if (!route || route.status !== 'active') {
      if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null }
      return
    }
    async function broadcastLocation() {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('vehicle_locations').upsert({
          driver_id: user.id, route_id: route!.id,
          latitude: pos.coords.latitude, longitude: pos.coords.longitude,
          district: profile?.district || null, ward: profile?.ward || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'driver_id' })
      }, () => { })
    }
    broadcastLocation()
    locationIntervalRef.current = setInterval(broadcastLocation, 30000)
    return () => { if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null } }
  }, [route?.status, profile])

  // Clear location when completed
  useEffect(() => {
    if (route?.status === 'completed') {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) supabase.from('vehicle_locations').delete().eq('driver_id', user.id)
      })
    }
  }, [route?.status])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500) }

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    const today = new Date().toISOString().split('T')[0]

    // Try driver_assignments first
    const { data: assignment } = await supabase
      .from('driver_assignments').select('route_id').eq('driver_id', user.id)
      .gte('assigned_date', today).order('assigned_date', { ascending: true }).limit(1).maybeSingle()

    let routeData: Route | null = null
    if (assignment?.route_id) {
      const { data: r } = await supabase.from('routes').select('*').eq('id', assignment.route_id).single()
      routeData = r
    } else {
      const { data: rows } = await supabase.from('routes').select('*').eq('driver_id', user.id)
        .gte('date', today).order('date', { ascending: true }).limit(1)
      routeData = rows?.[0] || null
    }

    if (!routeData) { setLoading(false); return }
    setRoute(routeData)

    if (routeData.schedule_id) {
      const { data: s } = await supabase.from('schedules').select('*').eq('id', routeData.schedule_id).single()
      setSchedule(s)
    }
    setLoading(false)
  }

  function getStreets(): string[] {
    if (!schedule?.streets) return []
    const ward = route?.ward
    if (ward && schedule.streets[ward]) return schedule.streets[ward]
    return Object.values(schedule.streets).flat()
  }

  const streets = getStreets()
  const collectedCount = Object.values(streetStatuses).filter(s => s === 'collected').length
  const skippedCount = Object.values(streetStatuses).filter(s => s === 'skipped').length
  const pendingCount = streets.length - collectedCount - skippedCount
  const allDone = streets.length > 0 && pendingCount === 0
  const progress = streets.length > 0 ? Math.round((collectedCount / streets.length) * 100) : 0

  const wasteLabel = schedule?.waste_type === 'other' && schedule?.custom_waste_type
    ? schedule.custom_waste_type
    : schedule?.waste_type?.replace('_', ' ') || 'Mixed waste'

  const isActive = route?.status === 'active'
  const isPending = route?.status === 'pending'
  const isCompleted = route?.status === 'completed'

  async function startRoute() {
    if (!route) return
    setStarting(true)
    const supabase = createClient()
    await supabase.from('routes').update({ status: 'active' }).eq('id', route.id)
    setRoute(prev => prev ? { ...prev, status: 'active' } : prev)
    showToast('Route started! Begin collections along your streets.')
    setStarting(false)
  }

  function markStreet(street: string, status: 'collected' | 'skipped') {
    setStreetStatuses(prev => ({ ...prev, [street]: status }))
    if (status === 'collected') showToast(`✓ ${street} marked as collected`)
    else showToast(`Skipped: ${street}`)
  }

  async function dispatchRoute() {
    if (!route) return
    setDispatching(true)
    try {
      // Log to blockchain
      const tx = await logCollectionOnChain(route.id, profile?.id || '', 'completed')
      if (tx) {
        setBlockchainTx(tx)
        const supabase = createClient()
        // Save a single collection_stop record as the route-level log
        await supabase.from('collection_stops').insert({
          route_id: route.id,
          address: route.route_name,
          road_name: route.route_name,
          stop_order: 1,
          status: 'completed',
          completed_at: new Date().toISOString(),
          blockchain_tx: tx,
          bin_count: collectedCount,
        })
      }

      // Generate handoff code
      const res = await fetch('/api/handoff/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_id: route.id, driver_id: profile?.id }),
      })
      const data = await res.json()
      if (res.ok && data.code) {
        setHandoffCode(data.code)
        const supabase = createClient()
        await supabase.from('routes').update({ status: 'completed' }).eq('id', route.id)
        setRoute(prev => prev ? { ...prev, status: 'completed' } : prev)
        showToast(tx ? 'Route dispatched & recorded on blockchain ✓' : 'Route dispatched!')
      } else {
        showToast('Error creating handoff code')
      }
    } catch { showToast('Error dispatching route') }
    setDispatching(false)
  }

  return (
    <DashboardLayout role="Driver" userName={profile?.full_name || ''} navItems={DRIVER_NAV}>
      <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .msf-fill{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .card{background:white;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.04);border:1px solid rgba(0,69,13,0.06);overflow:hidden}
        .street-row{padding:14px 18px;border-bottom:1px solid rgba(0,69,13,0.05);display:flex;align-items:center;gap:12px;transition:background 0.15s}
        .street-row:last-child{border-bottom:none}
        .street-row.collected{background:rgba(0,69,13,0.02)}
        .street-row.skipped{background:rgba(186,26,26,0.02);opacity:0.75}
        .btn-done{display:flex;align-items:center;gap:5px;padding:7px 14px;border-radius:99px;background:#00450d;color:white;border:none;cursor:pointer;font-size:11px;font-weight:700;font-family:'Manrope',sans-serif;transition:all 0.2s;white-space:nowrap}
        .btn-done:hover{background:#1b5e20}
        .btn-skip{display:flex;align-items:center;gap:5px;padding:7px 12px;border-radius:99px;background:white;color:#ba1a1a;border:1.5px solid rgba(186,26,26,0.2);cursor:pointer;font-size:11px;font-weight:700;font-family:'Manrope',sans-serif;transition:all 0.2s;white-space:nowrap}
        .btn-skip:hover{background:#fef2f2}
        .btn-nav{display:flex;align-items:center;gap:5px;padding:7px 12px;border-radius:99px;background:#eff6ff;color:#1d4ed8;border:1.5px solid rgba(29,78,216,0.15);cursor:pointer;font-size:11px;font-weight:700;font-family:'Manrope',sans-serif;transition:all 0.2s;white-space:nowrap}
        .btn-nav:hover{background:#dbeafe}
        .btn-undo{display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:99px;background:#f1f5f9;color:#64748b;border:none;cursor:pointer;font-size:10px;font-weight:700;font-family:'Manrope',sans-serif;transition:all 0.2s}
        .btn-undo:hover{background:#e2e8f0}
        .start-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:18px;border-radius:16px;background:#00450d;color:white;border:none;cursor:pointer;font-family:'Manrope',sans-serif;font-weight:800;font-size:17px;transition:all 0.2s;box-shadow:0 4px 20px rgba(0,69,13,0.3)}
        .start-btn:hover{background:#1b5e20;transform:translateY(-1px)}
        .start-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .dispatch-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;border-radius:12px;background:#00450d;color:white;border:none;cursor:pointer;font-family:'Manrope',sans-serif;font-weight:700;font-size:15px;transition:all 0.2s}
        .dispatch-btn:hover{background:#1b5e20;box-shadow:0 4px 16px rgba(0,69,13,0.25)}
        .dispatch-btn:disabled{opacity:0.6;cursor:not-allowed}
        .toast-pill{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#181c22;color:white;padding:10px 20px;border-radius:9999px;font-size:13px;font-weight:500;z-index:1000;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.2);white-space:nowrap;animation:slideUp .3s ease}
        @keyframes slideUp{from{transform:translateY(12px) translateX(-50%);opacity:0}to{transform:translateY(0) translateX(-50%);opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .a1{animation:fadeUp .4s ease .04s both}.a2{animation:fadeUp .4s ease .09s both}.a3{animation:fadeUp .4s ease .14s both}.a4{animation:fadeUp .4s ease .19s both}
        @keyframes spin{to{transform:rotate(360deg)}}
        .modal-input{width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:'Inter',sans-serif;outline:none;box-sizing:border-box;color:#181c22;transition:border 0.2s}
        .modal-input:focus{border-color:#00450d;box-shadow:0 0 0 3px rgba(0,69,13,0.07)}
      `}</style>

      {toast && (
        <div className="toast-pill">
          <span className="msf-fill" style={{ fontSize: 15, color: '#4ade80' }}>check_circle</span>{toast}
        </div>
      )}

      {/* Note modal */}
      {noteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setNoteModal(null)}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 380, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: '0 0 3px' }}>Add Note</h3>
              <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>{noteModal}</p>
            </div>
            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <textarea className="modal-input" rows={3} placeholder="e.g. Access blocked, bins overflowing…"
                value={noteText} onChange={e => setNoteText(e.target.value)}
                style={{ resize: 'none', lineHeight: 1.5 }} autoFocus />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setStreetNotes(prev => ({ ...prev, [noteModal]: noteText })); setNoteModal(null) }}
                  style={{ flex: 2, padding: 12, borderRadius: 10, background: '#00450d', color: 'white', border: 'none', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  Save Note
                </button>
                <button onClick={() => setNoteModal(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#64748b' }}>Cancel</button>
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
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(163,246,156,0.7)', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: 0 }}>
                  {new Date(route.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <span style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', background: isActive ? 'rgba(163,246,156,0.2)' : isCompleted ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)', color: isActive ? '#a3f69c' : 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {isActive ? '● Active' : isCompleted ? '✓ Completed' : '○ Not Started'}
                </span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, fontFamily: 'Manrope,sans-serif', margin: '0 0 12px' }}>{route.route_name}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: streets.length > 0 ? 16 : 0 }}>
                {route.ward && <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}><span className="msf" style={{ fontSize: 14 }}>location_on</span>{route.ward}</span>}
                {schedule && <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5, textTransform: 'capitalize' }}><span className="msf" style={{ fontSize: 14 }}>delete</span>{wasteLabel}</span>}
                {schedule?.collection_time && <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}><span className="msf" style={{ fontSize: 14 }}>schedule</span>{schedule.collection_time}</span>}
                {route.shift && <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>{route.shift === 'night' ? '🌙' : '☀️'} {route.shift}</span>}
                {route.vehicle_number && <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}><span className="msf" style={{ fontSize: 14 }}>local_shipping</span>{route.vehicle_number}</span>}
              </div>
              {streets.length > 0 && isActive && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: 'rgba(163,246,156,0.8)', fontWeight: 600 }}>{collectedCount} / {streets.length} streets collected</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{progress}%</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, background: '#a3f69c', width: `${progress}%`, transition: 'width 0.5s ease' }} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Manual start button — always show when active too */}
          {(isPending || isActive) && !handoffCode && (
            <div className="a2" style={{ marginBottom: 20 }}>
              {isPending && (
                <button onClick={startRoute} disabled={starting} className="start-btn">
                  {starting
                    ? <><div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Starting…</>
                    : <><span className="msf" style={{ fontSize: 22 }}>play_arrow</span>Start Route</>}
                </button>
              )}
              {isActive && (
                <div style={{ padding: '12px 16px', borderRadius: 12, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="msf-fill" style={{ fontSize: 18, color: '#00450d' }}>play_circle</span>
                  <p style={{ fontSize: 13, color: '#00450d', fontWeight: 600, fontFamily: 'Manrope,sans-serif', margin: 0 }}>Route is active — mark streets as collected</p>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          {streets.length > 0 && (
            <div className="a3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Pending', value: pendingCount, color: '#d97706', bg: '#fefce8', icon: 'radio_button_unchecked' },
                { label: 'Collected', value: collectedCount, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                { label: 'Skipped', value: skippedCount, color: '#ba1a1a', bg: '#fef2f2', icon: 'cancel' },
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
          )}

          {/* In-app Map */}
          {isLoaded && streets.length > 0 && (
            <div className="a3 card" style={{ marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="msf" style={{ fontSize: 16, color: '#00450d' }}>map</span>
                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', margin: 0 }}>Route Map</h3>
                <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>Tap a pin to navigate</span>
              </div>
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '340px' }}
                center={mapCenter}
                zoom={14}
              >
                {streets.map((street, idx) => {
                  const status = streetStatuses[street] || 'pending'
                  return (
                    <Marker
                      key={street}
                      position={mapCenter} // fallback — replace with real coords if available
                      label={{ text: String(idx + 1), color: 'white', fontWeight: 'bold', fontSize: '11px' }}
                      title={street}
                      icon={{
                        path: (window as any).google.maps.SymbolPath.CIRCLE,
                        scale: 13,
                        fillColor: status === 'collected' ? '#00450d' : status === 'skipped' ? '#ba1a1a' : '#1565c0',
                        fillOpacity: 1,
                        strokeColor: 'white',
                        strokeWeight: 2,
                      }}
                      onClick={() => setSelectedMarker(street)}
                    >
                      {selectedMarker === street && (
                        <InfoWindow onCloseClick={() => setSelectedMarker(null)}>
                          <div style={{ fontFamily: 'Manrope,sans-serif', minWidth: 160 }}>
                            <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>Stop {idx + 1}</p>
                            <p style={{ fontSize: 12, color: '#555', margin: '0 0 8px' }}>{street}</p>
                            {status === 'pending' && isActive && (
                              <button
                                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(street + ', ' + (route?.ward || '') + ', Colombo, Sri Lanka')}&travelmode=driving`, '_blank')}
                                style={{ padding: '5px 12px', background: '#1565c0', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                Navigate Here
                              </button>
                            )}
                          </div>
                        </InfoWindow>
                      )}
                    </Marker>
                  )
                })}
              </GoogleMap>
            </div>
          )}

          {/* Streets list */}
          <div className="a4 card" style={{ marginBottom: 20 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="msf" style={{ fontSize: 16, color: '#00450d' }}>fork_right</span>
                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', margin: 0 }}>Collection Streets</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {streets.length > 0 && <span style={{ fontSize: 12, color: '#94a3b8' }}>{streets.length} streets</span>}
                {isPending && streets.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', background: '#fefce8', padding: '2px 8px', borderRadius: 99, fontFamily: 'Manrope,sans-serif' }}>Start route to begin</span>}
              </div>
            </div>

            {streets.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <span className="msf" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 10 }}>fork_right</span>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 6 }}>No streets listed in schedule</p>
                <p style={{ fontSize: 13, color: '#94a3b8' }}>Collect along your assigned ward and dispatch when done.</p>
                {isActive && !handoffCode && (
                  <button onClick={dispatchRoute} disabled={dispatching} className="dispatch-btn" style={{ marginTop: 20, maxWidth: 320, margin: '20px auto 0' }}>
                    {dispatching
                      ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Dispatching…</>
                      : <><span className="msf" style={{ fontSize: 18 }}>local_shipping</span>Dispatch to Facility</>}
                  </button>
                )}
              </div>
            ) : (
              streets.map((street, idx) => {
                const status = streetStatuses[street] || 'pending'
                const isDone = status === 'collected'
                const isSkipped = status === 'skipped'
                const note = streetNotes[street]

                return (
                  <div key={street} className={`street-row ${isDone ? 'collected' : ''} ${isSkipped ? 'skipped' : ''}`}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isDone ? '#f0fdf4' : isSkipped ? '#fef2f2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isDone
                        ? <span className="msf-fill" style={{ fontSize: 15, color: '#00450d' }}>check_circle</span>
                        : isSkipped
                          ? <span className="msf-fill" style={{ fontSize: 15, color: '#ba1a1a' }}>cancel</span>
                          : <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', fontFamily: 'Manrope,sans-serif' }}>{idx + 1}</span>}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: isDone || isSkipped ? '#94a3b8' : '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 3px', textDecoration: isSkipped ? 'line-through' : 'none' }}>
                        {street}
                      </p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {isDone && <span style={{ fontSize: 11, color: '#00450d', fontWeight: 600 }}>✓ Collected</span>}
                        {isSkipped && <span style={{ fontSize: 11, color: '#ba1a1a', fontStyle: 'italic' }}>Skipped</span>}
                        {note && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: '#fefce8', color: '#92400e', fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>📝 {note}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {/* Navigate */}
                      {!isDone && !isSkipped && (
                        <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(street + ', ' + (route.ward || '') + ', Colombo, Sri Lanka')}&travelmode=driving`, '_blank')}
                          className="btn-nav" title="Open Google Maps">
                          <span className="msf" style={{ fontSize: 13 }}>navigation</span>Nav
                        </button>
                      )}

                      {/* Active — mark collected / skip */}
                      {isActive && !isDone && !isSkipped && (
                        <>
                          <button onClick={() => markStreet(street, 'collected')} className="btn-done">
                            <span className="msf" style={{ fontSize: 13 }}>check</span>Done
                          </button>
                          <button onClick={() => markStreet(street, 'skipped')} className="btn-skip">
                            <span className="msf" style={{ fontSize: 13 }}>close</span>Skip
                          </button>
                        </>
                      )}

                      {/* Undo */}
                      {isActive && (isDone || isSkipped) && (
                        <button onClick={() => setStreetStatuses(prev => { const n = { ...prev }; delete n[street]; return n })} className="btn-undo">
                          <span className="msf" style={{ fontSize: 12 }}>undo</span>Undo
                        </button>
                      )}

                      {/* Note */}
                      {isActive && (
                        <button onClick={() => { setNoteModal(street); setNoteText(streetNotes[street] || '') }}
                          style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #e5e7eb', background: note ? '#fefce8' : 'white', color: note ? '#d97706' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Add note">
                          <span className="msf" style={{ fontSize: 14 }}>edit_note</span>
                        </button>
                      )}

                      {isPending && (
                        <span className="msf" style={{ fontSize: 16, color: '#d1d5db' }}>lock</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Dispatch button — show when active and all streets done (or no streets) */}
          {isActive && streets.length > 0 && allDone && !handoffCode && (
            <div className="a4" style={{ marginBottom: 20 }}>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="msf-fill" style={{ fontSize: 18, color: '#00450d' }}>check_circle</span>
                <p style={{ fontSize: 13, color: '#00450d', fontWeight: 600, fontFamily: 'Manrope,sans-serif', margin: 0 }}>
                  All {streets.length} streets completed — ready to dispatch!
                </p>
              </div>
              <button onClick={dispatchRoute} disabled={dispatching} className="dispatch-btn">
                {dispatching
                  ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Dispatching…</>
                  : <><span className="msf" style={{ fontSize: 18 }}>local_shipping</span>Dispatch to Facility</>}
              </button>
              <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>Collection will be recorded on the Polygon Amoy blockchain</p>
            </div>
          )}

          {/* Handoff code */}
          {handoffCode && (
            <div className="a4 card" style={{ padding: 28, textAlign: 'center', marginBottom: 20 }}>
              <span className="msf-fill" style={{ fontSize: 36, color: '#00450d', display: 'block', marginBottom: 12 }}>check_circle</span>
              <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', marginBottom: 6 }}>Route Dispatched!</p>
              <p style={{ fontSize: 13, color: '#717a6d', marginBottom: 20 }}>Share this code with the facility operator</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                {handoffCode.split('').map((digit, i) => (
                  <div key={i} style={{ width: 48, height: 60, borderRadius: 12, background: '#f0fdf4', border: '2px solid rgba(0,69,13,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>{digit}</div>
                ))}
              </div>
              {blockchainTx && (
                <a href={`https://amoy.polygonscan.com/tx/${blockchainTx}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7c3aed', fontWeight: 700, fontFamily: 'Manrope,sans-serif', textDecoration: 'none', padding: '6px 14px', borderRadius: 99, background: '#faf5ff', border: '1px solid rgba(124,58,237,0.15)' }}>
                  <span className="msf" style={{ fontSize: 14 }}>link</span>View on Blockchain ↗
                </a>
              )}
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12 }}>Handoff code for this route delivery</p>
            </div>
          )}

          {/* Blockchain info bar */}
          {isActive && !handoffCode && (
            <div style={{ padding: '12px 16px', borderRadius: 12, background: '#f5f3ff', border: '1px solid rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="msf" style={{ fontSize: 18, color: '#7c3aed', flexShrink: 0 }}>verified</span>
              <p style={{ fontSize: 12, color: '#6d28d9', margin: 0 }}>
                Route completion will be recorded on <strong>Polygon Amoy</strong> blockchain when dispatched.
              </p>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}