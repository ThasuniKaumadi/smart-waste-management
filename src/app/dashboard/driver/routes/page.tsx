'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { logCollectionOnChain } from '@/lib/blockchain'
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api'

const DRIVER_NAV = [
  { label: 'Overview', href: '/dashboard/driver', icon: 'dashboard' },
  { label: 'My Routes', href: '/dashboard/driver/routes', icon: 'route' },
  { label: 'Collections', href: '/dashboard/driver/collections', icon: 'local_shipping' },
  { label: 'Disposal', href: '/dashboard/driver/disposal', icon: 'delete_sweep' },
  { label: 'Fuel Log', href: '/dashboard/driver/fuel-log', icon: 'local_gas_station' },
  { label: 'Breakdown', href: '/dashboard/driver/breakdown', icon: 'car_crash' },
  { label: 'Incidents', href: '/dashboard/driver/incidents', icon: 'warning' },
  { label: 'Location', href: '/dashboard/driver/location', icon: 'location_on' },
]

const SKIP_REASONS = [
  { value: 'no_waste_out', label: 'No waste put out' },
  { value: 'access_denied', label: 'Access denied' },
  { value: 'wrong_waste_type', label: 'Wrong waste type' },
  { value: 'vehicle_breakdown', label: 'Vehicle breakdown' },
  { value: 'other', label: 'Other' },
]

const MAP_CONTAINER_STYLE = { width: '100%', height: '400px', borderRadius: '0 0 16px 16px' }
const DEFAULT_CENTER = { lat: 6.9271, lng: 79.8612 }

function stopMarkerIcon(status: string, idx: number) {
  const color = status === 'completed' ? '#00450d' : status === 'skipped' ? '#ba1a1a' : '#1d4ed8'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24S32 26 32 16C32 7.163 24.837 0 16 0z" fill="${color}"/><circle cx="16" cy="16" r="10" fill="white"/><text x="16" y="21" text-anchor="middle" font-size="11" font-weight="800" font-family="Manrope,sans-serif" fill="${color}">${idx + 1}</text></svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 32, height: 40 } as google.maps.Size,
    anchor: { x: 16, y: 40 } as google.maps.Point,
  }
}

interface Route {
  id: string; route_name: string; ward: string; shift: string; status: string
  date: string; vehicle_number: string | null; schedule_id: string | null; contractor_id: string | null
}
interface Stop {
  id: string; road_name: string; address: string; status: string; stop_order: number
  skip_reason: string | null; completed_at: string | null; is_commercial: boolean
  notes: string | null; bin_count: number | null; blockchain_tx?: string | null
  latitude: number | null; longitude: number | null
}
interface Schedule {
  id: string; waste_type: string; custom_waste_type: string | null; collection_time: string
  wards: string[]; ward: string | null; streets: Record<string, string[]> | null; notes: string | null
}

function openNavigation(stop: Stop) {
  if (stop.latitude && stop.longitude) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}&travelmode=driving`, '_blank')
  } else if (stop.address || stop.road_name) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address || stop.road_name)}&travelmode=driving`, '_blank')
  }
}

export default function DriverRoutesPage() {
  const [profile, setProfile] = useState<any>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [stops, setStops] = useState<Stop[]>([])
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [updatingStop, setUpdatingStop] = useState<string | null>(null)
  const [skipModal, setSkipModal] = useState<Stop | null>(null)
  const [skipReason, setSkipReason] = useState('')
  const [skipNote, setSkipNote] = useState('')
  const [binModal, setBinModal] = useState<Stop | null>(null)
  const [binCount, setBinCount] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [handoffCode, setHandoffCode] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null)
  const [pendingGeocode, setPendingGeocode] = useState<Stop[]>([])

  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  })

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!mapRef || !mapsLoaded) return
    const withCoords = stops.filter(s => s.latitude && s.longitude)
    if (withCoords.length === 0) return
    if (withCoords.length === 1) {
      mapRef.setCenter({ lat: withCoords[0].latitude!, lng: withCoords[0].longitude! })
      mapRef.setZoom(15); return
    }
    const bounds = new google.maps.LatLngBounds()
    withCoords.forEach(s => bounds.extend({ lat: s.latitude!, lng: s.longitude! }))
    mapRef.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 })
  }, [mapRef, stops, mapsLoaded])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500) }

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    const today = new Date().toISOString().split('T')[0]

    const { data: assignment } = await supabase
      .from('driver_assignments').select('route_id').eq('driver_id', user.id)
      .gte('assigned_date', today).order('assigned_date', { ascending: true }).limit(1).single()

    let routeData: Route | null = null
    if (assignment?.route_id) {
      const { data: r } = await supabase.from('routes').select('*').eq('id', assignment.route_id).single()
      routeData = r
    } else {
      const { data: r } = await supabase.from('routes').select('*').eq('driver_id', user.id)
        .gte('date', today).order('date', { ascending: true }).limit(1).single()
      routeData = r
    }

    if (!routeData) { setLoading(false); return }
    setRoute(routeData)

    const { data: stopsData } = await supabase
      .from('collection_stops').select('*').eq('route_id', routeData.id)
      .order('stop_order', { ascending: true })

    const loadedStops: Stop[] = stopsData || []
    setStops(loadedStops)

    if (routeData.schedule_id) {
      const { data: s } = await supabase.from('schedules').select('*').eq('id', routeData.schedule_id).single()
      setSchedule(s)
    }
    setLoading(false)

    // Queue stops missing coordinates for geocoding after Maps JS API loads
    const missing = loadedStops.filter(s => !s.latitude || !s.longitude)
    if (missing.length > 0) {
      setPendingGeocode(missing)
    }
  }

  // Run geocoding once Maps JS API is ready (uses Geocoder class, works with referrer-restricted keys)
  useEffect(() => {
    if (!mapsLoaded || pendingGeocode.length === 0) return
    const supabase = createClient()
    geocodeStops(pendingGeocode, supabase)
    setPendingGeocode([])
  }, [mapsLoaded, pendingGeocode])

  async function geocodeStops(missing: Stop[], supabase: any) {
    // Uses Maps JS API Geocoder — works with HTTP referrer-restricted keys
    const geocoder = new google.maps.Geocoder()
    const updated: Stop[] = []

    for (const stop of missing) {
      const query = [stop.road_name, stop.address, 'Colombo, Sri Lanka'].filter(Boolean).join(', ')
      try {
        const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode({ address: query }, (res, status) => {
            if (status === 'OK' && res) resolve(res)
            else reject(status)
          })
        })
        if (results[0]) {
          const lat = results[0].geometry.location.lat()
          const lng = results[0].geometry.location.lng()
          await supabase.from('collection_stops')
            .update({ latitude: lat, longitude: lng })
            .eq('id', stop.id)
          updated.push({ ...stop, latitude: lat, longitude: lng })
        }
      } catch { /* skip stop if geocoding fails */ }
    }

    if (updated.length > 0) {
      setStops(prev => prev.map(s => {
        const geo = updated.find(u => u.id === s.id)
        return geo ? { ...s, latitude: geo.latitude, longitude: geo.longitude } : s
      }))
    }
  }

  async function startRoute() {
    if (!route) return
    setStarting(true)
    const supabase = createClient()
    await supabase.from('routes').update({ status: 'active' }).eq('id', route.id)
    setRoute(prev => prev ? { ...prev, status: 'active' } : prev)
    showToast('Route started! Navigate to your first stop.')
    setStarting(false)
  }

  async function confirmCompleted() {
    if (!binModal) return
    setUpdatingStop(binModal.id)
    const supabase = createClient()
    await supabase.from('collection_stops').update({
      status: 'completed', completed_at: new Date().toISOString(),
      bin_count: binCount ? parseInt(binCount) : null,
    }).eq('id', binModal.id)
    setStops(prev => prev.map(s => s.id === binModal.id
      ? { ...s, status: 'completed', completed_at: new Date().toISOString(), bin_count: binCount ? parseInt(binCount) : null } : s))
    try {
      const tx = await logCollectionOnChain(route?.id || binModal.id, profile?.id || '', 'completed')
      if (tx) {
        await supabase.from('collection_stops').update({ blockchain_tx: tx }).eq('id', binModal.id)
        setStops(prev => prev.map(s => s.id === binModal.id ? { ...s, blockchain_tx: tx } : s))
        showToast('Collected & recorded on blockchain ✓')
      } else { showToast('Stop marked as collected') }
    } catch { showToast('Stop marked as collected') }
    setBinModal(null); setBinCount(''); setUpdatingStop(null)
  }

  async function markSkipped(stop: Stop) {
    if (!skipReason) return
    setUpdatingStop(stop.id)
    const supabase = createClient()
    await supabase.from('collection_stops').update({
      status: 'skipped', skip_reason: skipReason, notes: skipNote || null,
    }).eq('id', stop.id)
    setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'skipped', skip_reason: skipReason } : s))
    setSkipModal(null); setSkipReason(''); setSkipNote('')
    showToast('Stop marked as skipped'); setUpdatingStop(null)
  }

  async function dispatchRoute() {
    if (!route) return
    setDispatching(true)
    try {
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
        showToast('Route dispatched! Share your handoff code with the facility.')
      }
    } catch { showToast('Error dispatching route') }
    setDispatching(false)
  }

  const completed = stops.filter(s => s.status === 'completed').length
  const skipped = stops.filter(s => s.status === 'skipped').length
  const pending = stops.filter(s => s.status === 'pending').length
  const progress = stops.length > 0 ? Math.round((completed / stops.length) * 100) : 0
  const stopsWithCoords = stops.filter(s => s.latitude && s.longitude)
  const polylinePath = stopsWithCoords.map(s => ({ lat: s.latitude!, lng: s.longitude! }))
  const nextStop = stops.find(s => s.status === 'pending')

  const scheduleStreets: string[] = []
  if (schedule?.streets && route?.ward) {
    const ws = schedule.streets[route.ward]; if (ws) scheduleStreets.push(...ws)
  } else if (schedule?.streets) {
    Object.values(schedule.streets).forEach(s => scheduleStreets.push(...s))
  }
  const wasteLabel = schedule?.waste_type === 'other' && schedule?.custom_waste_type
    ? schedule.custom_waste_type : schedule?.waste_type?.replace('_', ' ') || 'Mixed waste'

  const isActive = route?.status === 'active'
  const isPending = route?.status === 'pending'
  const isCompleted = route?.status === 'completed'

  return (
    <DashboardLayout role="Driver" userName={profile?.full_name || ''} navItems={DRIVER_NAV}>
      <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .msf-fill{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .card{background:white;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.04);border:1px solid rgba(0,69,13,0.06);overflow:hidden}
        .stop-row{padding:14px 18px;border-bottom:1px solid rgba(0,69,13,0.05);display:flex;align-items:center;gap:12px;transition:background 0.15s;cursor:pointer}
        .stop-row:last-child{border-bottom:none}
        .stop-row:hover{background:#fafafa}
        .stop-row.completed{background:rgba(0,69,13,0.02)}
        .stop-row.skipped{background:rgba(186,26,26,0.02);opacity:0.7}
        .stop-row.highlighted{background:#eff6ff!important;border-left:3px solid #1d4ed8}
        .btn-done{display:flex;align-items:center;gap:5px;padding:7px 14px;border-radius:99px;background:#00450d;color:white;border:none;cursor:pointer;font-size:11px;font-weight:700;font-family:'Manrope',sans-serif;transition:all 0.2s;white-space:nowrap}
        .btn-done:hover{background:#1b5e20}
        .btn-done:disabled{opacity:0.6;cursor:not-allowed}
        .btn-skip{display:flex;align-items:center;gap:5px;padding:7px 12px;border-radius:99px;background:white;color:#ba1a1a;border:1.5px solid rgba(186,26,26,0.2);cursor:pointer;font-size:11px;font-weight:700;font-family:'Manrope',sans-serif;transition:all 0.2s;white-space:nowrap}
        .btn-skip:hover{background:#fef2f2}
        .btn-nav{display:flex;align-items:center;gap:5px;padding:7px 12px;border-radius:99px;background:#eff6ff;color:#1d4ed8;border:1.5px solid rgba(29,78,216,0.15);cursor:pointer;font-size:11px;font-weight:700;font-family:'Manrope',sans-serif;transition:all 0.2s;white-space:nowrap}
        .btn-nav:hover{background:#dbeafe}
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
        .dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex-shrink:0}
      `}</style>

      {toast && (
        <div className="toast-pill">
          <span className="msf-fill" style={{ fontSize: 15, color: '#4ade80' }}>check_circle</span>{toast}
        </div>
      )}

      {/* Bin modal */}
      {binModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setBinModal(null)}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 380, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: '0 0 3px' }}>Mark as Collected</h3>
              <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>{binModal.road_name || binModal.address}</p>
            </div>
            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>
                  Bins Collected <span style={{ color: '#d1d5db', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
                </label>
                <input type="number" min="0" placeholder="e.g. 3" value={binCount} onChange={e => setBinCount(e.target.value)} className="modal-input" autoFocus />
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="msf" style={{ fontSize: 15, color: '#00450d' }}>link</span>
                <p style={{ fontSize: 11, color: '#41493e', margin: 0 }}>This collection will be recorded on the Polygon Amoy blockchain.</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={confirmCompleted} disabled={!!updatingStop}
                  style={{ flex: 2, padding: 12, borderRadius: 10, background: '#00450d', color: 'white', border: 'none', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: updatingStop ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {updatingStop ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Recording…</> : 'Confirm Collection'}
                </button>
                <button onClick={() => setBinModal(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#64748b' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skip modal */}
      {skipModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => { setSkipModal(null); setSkipReason(''); setSkipNote('') }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 420, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
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
              <textarea value={skipNote} onChange={e => setSkipNote(e.target.value)} rows={2} placeholder="Additional note — optional"
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontFamily: 'Inter,sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', color: '#181c22', background: '#fafafa' }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => markSkipped(skipModal)} disabled={!skipReason || !!updatingStop}
                  style={{ flex: 2, padding: 12, borderRadius: 10, background: skipReason ? '#ba1a1a' : '#e5e7eb', color: 'white', border: 'none', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: skipReason ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                  Confirm Skip
                </button>
                <button onClick={() => { setSkipModal(null); setSkipReason(''); setSkipNote('') }} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#64748b' }}>Cancel</button>
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
          {/* Route summary */}
          <div className="a2" style={{ background: '#00450d', borderRadius: 20, padding: 24, color: 'white', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(163,246,156,0.07)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(163,246,156,0.7)', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: 0 }}>
                  {new Date(route.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <span style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', background: isActive ? 'rgba(163,246,156,0.2)' : isCompleted ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)', color: isActive ? '#a3f69c' : 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {isActive ? '● Active' : isCompleted ? '✓ Completed' : '○ Not Started'}
                </span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, fontFamily: 'Manrope,sans-serif', margin: '0 0 12px' }}>{route.route_name}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {route.ward && <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}><span className="msf" style={{ fontSize: 14 }}>location_on</span>{route.ward}</span>}
                {schedule && <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5, textTransform: 'capitalize' }}><span className="msf" style={{ fontSize: 14 }}>delete</span>{wasteLabel}</span>}
                {schedule?.collection_time && <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}><span className="msf" style={{ fontSize: 14 }}>schedule</span>{schedule.collection_time}</span>}
                {route.shift && <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>{route.shift === 'night' ? '🌙' : '☀️'} {route.shift}</span>}
                {route.vehicle_number && <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}><span className="msf" style={{ fontSize: 14 }}>local_shipping</span>{route.vehicle_number}</span>}
              </div>
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

          {/* Start banner */}
          {isPending && (
            <div className="a2" style={{ marginBottom: 20, padding: 20, borderRadius: 16, background: '#fefce8', border: '1.5px solid rgba(217,119,6,0.2)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="msf" style={{ fontSize: 22, color: '#d97706' }}>play_circle</span>
                </div>
                <div>
                  <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#92400e', margin: '0 0 2px' }}>Route not started yet</p>
                  <p style={{ fontSize: 12, color: '#b45309', margin: 0 }}>Tap below when you are ready to begin collections</p>
                </div>
              </div>
              <button onClick={startRoute} disabled={starting} className="start-btn">
                {starting ? <><div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Starting…</> : <><span className="msf" style={{ fontSize: 22 }}>play_arrow</span>Start Route</>}
              </button>
            </div>
          )}

          {/* ── IN-APP MAP ── */}
          {stopsWithCoords.length > 0 && (
            <div className="a2 card" style={{ marginBottom: 20 }}>
              {/* Map toolbar */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="msf" style={{ fontSize: 18, color: '#00450d' }}>map</span>
                  <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', margin: 0 }}>Route Map</h3>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>· tap a pin for details</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {[['#1d4ed8', 'Pending'], ['#00450d', 'Done'], ['#ba1a1a', 'Skipped']].map(([c, l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="dot" style={{ background: c }} />
                      <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'Manrope,sans-serif' }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next stop quick-nav */}
              {isActive && nextStop && (nextStop.latitude || nextStop.address || nextStop.road_name) && (
                <div style={{ padding: '10px 16px', background: '#eff6ff', borderBottom: '1px solid rgba(29,78,216,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span className="msf" style={{ fontSize: 16, color: '#1d4ed8', flexShrink: 0 }}>navigation</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#93c5fd', fontFamily: 'Manrope,sans-serif', margin: 0 }}>Next Stop</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', fontFamily: 'Manrope,sans-serif', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {nextStop.road_name || nextStop.address}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => openNavigation(nextStop)} className="btn-nav" style={{ flexShrink: 0 }}>
                    <span className="msf" style={{ fontSize: 13 }}>open_in_new</span>Navigate
                  </button>
                </div>
              )}

              {/* Map */}
              {mapsLoaded ? (
                <GoogleMap
                  mapContainerStyle={MAP_CONTAINER_STYLE}
                  center={DEFAULT_CENTER}
                  zoom={13}
                  onLoad={map => setMapRef(map)}
                  options={{
                    streetViewControl: false, mapTypeControl: false,
                    fullscreenControl: true, zoomControl: true,
                    styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
                  }}
                >
                  {polylinePath.length > 1 && (
                    <Polyline path={polylinePath} options={{ strokeColor: '#1d4ed8', strokeOpacity: 0.55, strokeWeight: 3, geodesic: true }} />
                  )}
                  {stops.map((stop, idx) => {
                    if (!stop.latitude || !stop.longitude) return null
                    return (
                      <Marker key={stop.id}
                        position={{ lat: stop.latitude, lng: stop.longitude }}
                        icon={stopMarkerIcon(stop.status, idx)}
                        onClick={() => setSelectedStop(selectedStop?.id === stop.id ? null : stop)}
                        title={stop.road_name || stop.address}
                      />
                    )
                  })}
                  {selectedStop && selectedStop.latitude && selectedStop.longitude && (
                    <InfoWindow position={{ lat: selectedStop.latitude, lng: selectedStop.longitude }} onCloseClick={() => setSelectedStop(null)}>
                      <div style={{ fontFamily: 'Manrope,sans-serif', minWidth: 190, padding: 4 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: '#181c22', margin: '0 0 4px' }}>{selectedStop.road_name || selectedStop.address}</p>
                        <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 8px' }}>
                          Status: <strong style={{ color: selectedStop.status === 'completed' ? '#00450d' : selectedStop.status === 'skipped' ? '#ba1a1a' : '#1d4ed8' }}>{selectedStop.status}</strong>
                        </p>
                        {selectedStop.is_commercial && <p style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', margin: '0 0 6px' }}>🏢 Commercial</p>}
                        {selectedStop.bin_count != null && <p style={{ fontSize: 11, color: '#00450d', margin: '0 0 6px' }}>🗑 {selectedStop.bin_count} bins collected</p>}
                        {isActive && selectedStop.status === 'pending' && (
                          <button onClick={() => { openNavigation(selectedStop); setSelectedStop(null) }}
                            style={{ width: '100%', padding: '8px 0', borderRadius: 8, background: '#1d4ed8', color: 'white', border: 'none', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            <span style={{ fontFamily: 'Material Symbols Outlined', fontSize: 13 }}>navigation</span>Navigate Here
                          </button>
                        )}
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              ) : (
                <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                  <div style={{ width: 24, height: 24, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="a3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
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
          <div className="a4 card" style={{ marginBottom: 20 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', margin: 0 }}>Collection Stops</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{stops.length} stops</span>
                {isPending && <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', background: '#fefce8', padding: '2px 8px', borderRadius: 99, fontFamily: 'Manrope,sans-serif' }}>Start route to begin</span>}
              </div>
            </div>

            {stops.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <span className="msf" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 10 }}>pin_drop</span>
                <p style={{ fontSize: 14, color: '#94a3b8' }}>No stops added to this route yet.</p>
              </div>
            ) : stops.map((stop, idx) => {
              const isDone = stop.status === 'completed'
              const isSkipped = stop.status === 'skipped'
              const hasLocation = !!(stop.latitude && stop.longitude) || !!(stop.address || stop.road_name)
              const isHighlighted = selectedStop?.id === stop.id

              return (
                <div key={stop.id}
                  className={`stop-row ${isDone ? 'completed' : ''} ${isSkipped ? 'skipped' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                  onClick={() => {
                    if (stop.latitude && stop.longitude && mapRef) {
                      setSelectedStop(isHighlighted ? null : stop)
                      if (!isHighlighted) {
                        mapRef.panTo({ lat: stop.latitude, lng: stop.longitude })
                        mapRef.setZoom(16)
                        // Scroll map into view
                        document.querySelector('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                    }
                  }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: isDone ? '#f0fdf4' : isSkipped ? '#fef2f2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isDone ? <span className="msf-fill" style={{ fontSize: 15, color: '#00450d' }}>check_circle</span>
                      : isSkipped ? <span className="msf-fill" style={{ fontSize: 15, color: '#ba1a1a' }}>cancel</span>
                        : <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', fontFamily: 'Manrope,sans-serif' }}>{idx + 1}</span>}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: isDone || isSkipped ? '#94a3b8' : '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 3px', textDecoration: isSkipped ? 'line-through' : 'none' }}>
                      {stop.road_name || stop.address}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {stop.is_commercial && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontFamily: 'Manrope,sans-serif' }}>Commercial</span>}
                      {isDone && stop.completed_at && <span style={{ fontSize: 11, color: '#00450d', fontWeight: 600 }}>✓ {new Date(stop.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                      {isDone && stop.bin_count != null && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: '#f0fdf4', color: '#00450d', fontWeight: 700, fontFamily: 'Manrope,sans-serif' }}>{stop.bin_count} bins</span>}
                      {isDone && stop.blockchain_tx && (
                        <a href={`https://amoy.polygonscan.com/tx/${stop.blockchain_tx}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: '#faf5ff', color: '#7c3aed', fontWeight: 700, fontFamily: 'Manrope,sans-serif', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span className="msf" style={{ fontSize: 11 }}>link</span>Chain ↗
                        </a>
                      )}
                      {isSkipped && stop.skip_reason && <span style={{ fontSize: 11, color: '#ba1a1a', fontStyle: 'italic' }}>{SKIP_REASONS.find(r => r.value === stop.skip_reason)?.label || stop.skip_reason}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    {hasLocation && !isDone && !isSkipped && (
                      <button onClick={() => openNavigation(stop)} className="btn-nav" title="Open Google Maps directions">
                        <span className="msf" style={{ fontSize: 13 }}>navigation</span>Nav
                      </button>
                    )}
                    {isActive && !isDone && !isSkipped && (
                      <>
                        <button onClick={() => { setBinModal(stop); setBinCount('') }} disabled={updatingStop === stop.id} className="btn-done">
                          <span className="msf" style={{ fontSize: 13 }}>check</span>Done
                        </button>
                        <button onClick={() => setSkipModal(stop)} disabled={!!updatingStop} className="btn-skip">
                          <span className="msf" style={{ fontSize: 13 }}>close</span>Skip
                        </button>
                      </>
                    )}
                    {isPending && !isDone && !isSkipped && (
                      <span className="msf" style={{ fontSize: 16, color: '#d1d5db' }}>lock</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Dispatch */}
          {isActive && pending === 0 && stops.length > 0 && !handoffCode && (
            <div className="a4">
              <button onClick={dispatchRoute} disabled={dispatching} className="dispatch-btn">
                {dispatching ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Dispatching…</> : <><span className="msf" style={{ fontSize: 18 }}>local_shipping</span>Dispatch to Facility</>}
              </button>
              <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>All stops done — dispatch to generate your handoff code</p>
            </div>
          )}

          {/* Handoff code */}
          {handoffCode && (
            <div className="a4 card" style={{ padding: 28, textAlign: 'center' }}>
              <span className="msf-fill" style={{ fontSize: 36, color: '#00450d', display: 'block', marginBottom: 12 }}>check_circle</span>
              <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', marginBottom: 6 }}>Route Dispatched!</p>
              <p style={{ fontSize: 13, color: '#717a6d', marginBottom: 20 }}>Share this code with the facility operator</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                {handoffCode.split('').map((digit, i) => (
                  <div key={i} style={{ width: 48, height: 60, borderRadius: 12, background: '#f0fdf4', border: '2px solid rgba(0,69,13,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>{digit}</div>
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