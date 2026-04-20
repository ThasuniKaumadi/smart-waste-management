'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const DRIVER_NAV = [
  { label: 'Overview', href: '/dashboard/driver', icon: 'dashboard' },
  { label: 'My Route', href: '/dashboard/driver/routes', icon: 'route' },
  { label: 'Collections', href: '/dashboard/driver/collections', icon: 'inventory_2' },
  { label: 'Location', href: '/dashboard/driver/location', icon: 'gps_fixed' },
  { label: 'Incidents', href: '/dashboard/driver/incidents', icon: 'warning' },
  { label: 'Breakdown', href: '/dashboard/driver/breakdown', icon: 'build' },
  { label: 'Fuel Log', href: '/dashboard/driver/fuel-log', icon: 'local_gas_station' },
  { label: 'Disposal', href: '/dashboard/driver/disposal', icon: 'delete_sweep' },
]

export default function DriverLocationPage() {
  const [profile, setProfile] = useState<any>(null)
  const [activeRoute, setActiveRoute] = useState<any>(null)
  const [tracking, setTracking] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number; speed: number | null } | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [updateCount, setUpdateCount] = useState(0)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok')
  const watchIdRef = useRef<number | null>(null)
  const userIdRef = useRef<string | null>(null)
  const lastMonitorCallRef = useRef<number>(0)
  const tickRef = useRef<any>(null)

  useEffect(() => {
    loadData()
    // Tick every second to update "X seconds ago"
    tickRef.current = setInterval(() => setLastUpdated(d => d ? new Date(d.getTime()) : d), 1000)
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  function showMessage(msg: string, type: 'ok' | 'err' = 'ok') {
    setMessage(msg); setMessageType(type)
    setTimeout(() => setMessage(''), 4000)
  }

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    userIdRef.current = user.id
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    const today = new Date().toISOString().split('T')[0]
    const { data: routes } = await supabase
      .from('routes').select('*')
      .eq('driver_id', user.id)
      .in('status', ['active', 'pending'])
      .gte('date', today)
      .order('date', { ascending: true }).limit(1)
    setActiveRoute(routes?.[0] || null)
  }

  async function pushLocation(lat: number, lng: number, speed: number | null) {
    const supabase = createClient()
    const userId = userIdRef.current
    if (!userId || !activeRoute) return
    setCoords({ lat, lng, speed })
    setLastUpdated(new Date())
    setUpdateCount(c => c + 1)
    await supabase.from('vehicle_locations').upsert({
      driver_id: userId,
      route_id: activeRoute.id,
      latitude: lat,
      longitude: lng,
      speed_kmh: speed ? Math.round(speed * 3.6) : 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'driver_id' })
    // Call alert monitor at most once every 2 minutes
    const now = Date.now()
    if (now - lastMonitorCallRef.current > 120000) {
      lastMonitorCallRef.current = now
      fetch('/api/alerts/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_id: activeRoute.id, driver_id: userId, latitude: lat, longitude: lng }),
      }).catch(() => { })
    }
  }

  function startTracking() {
    if (!navigator.geolocation) { showMessage('Geolocation not supported by your browser.', 'err'); return }
    if (!activeRoute) { showMessage('No active route. Your contractor needs to assign one first.', 'err'); return }
    const id = navigator.geolocation.watchPosition(
      pos => { pushLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.speed) },
      err => showMessage('GPS error: ' + err.message, 'err'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
    watchIdRef.current = id
    setTracking(true)
    showMessage('Location sharing started — supervisors can now see your vehicle.')
  }

  function stopTracking() {
    if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    setTracking(false)
    showMessage('Location sharing stopped.')
  }

  const timeSinceUpdate = lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000) : null

  return (
    <DashboardLayout role="Driver" userName={profile?.full_name || ''} navItems={DRIVER_NAV}>
      <style>{`
                .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
                .msf-fill{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
                .card{background:white;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.04);border:1px solid rgba(0,69,13,0.06)}
                @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
                .a1{animation:fadeUp .35s ease both}.a2{animation:fadeUp .35s ease .06s both}.a3{animation:fadeUp .35s ease .12s both}
                @keyframes pdot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.7}}
                .live-dot{width:12px;height:12px;border-radius:50%;background:#16a34a;animation:pdot 1.4s ease-in-out infinite}
                .btn-start{width:100%;padding:14px;border-radius:12px;background:#00450d;color:white;border:none;font-family:'Manrope',sans-serif;font-weight:700;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s}
                .btn-start:hover{background:#1b5e20;box-shadow:0 4px 16px rgba(0,69,13,.25)}
                .btn-start:disabled{opacity:.5;cursor:not-allowed}
                .btn-stop{width:100%;padding:14px;border-radius:12px;background:#fef2f2;color:#ba1a1a;border:1.5px solid rgba(186,26,26,.2);font-family:'Manrope',sans-serif;font-weight:700;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s}
                .btn-stop:hover{background:#fee2e2}
                .sc{background:#f8fafc;border-radius:10px;padding:10px 14px}
            `}</style>

      <div className="a1" style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 8 }}>Driver · GPS</p>
        <h1 style={{ fontSize: 38, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: 0 }}>
          Location <span style={{ color: '#1b5e20' }}>Sharing</span>
        </h1>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 13, fontWeight: 500, background: messageType === 'ok' ? '#f0fdf4' : '#fef2f2', color: messageType === 'ok' ? '#00450d' : '#ba1a1a', border: `1px solid ${messageType === 'ok' ? 'rgba(0,69,13,.12)' : 'rgba(186,26,26,.12)'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="msf-fill" style={{ fontSize: 15 }}>{messageType === 'ok' ? 'check_circle' : 'error'}</span>
          {message}
        </div>
      )}

      <div className="a2 card" style={{ padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {tracking ? <div className="live-dot" /> : <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#d1d5db' }} />}
            <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: tracking ? '#00450d' : '#64748b' }}>
              {tracking ? 'Broadcasting live' : 'Not sharing'}
            </span>
          </div>
          {tracking && updateCount > 0 && <span style={{ fontSize: 11, color: '#94a3b8' }}>{updateCount} update{updateCount !== 1 ? 's' : ''} sent</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Coordinates', value: coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : '—', mono: true },
            { label: 'Speed', value: coords?.speed != null ? `${Math.round(coords.speed * 3.6)} km/h` : '—' },
            { label: 'Last update', value: timeSinceUpdate !== null ? `${timeSinceUpdate}s ago` : '—' },
            { label: 'Route', value: activeRoute?.route_name || 'None assigned' },
          ].map(item => (
            <div key={item.label} className="sc">
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Manrope,sans-serif', margin: '0 0 4px' }}>{item.label}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#181c22', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: item.mono ? 'monospace' : 'inherit' }}>{item.value}</p>
            </div>
          ))}
        </div>

        {tracking
          ? <button className="btn-stop" onClick={stopTracking}><span className="msf" style={{ fontSize: 18 }}>gps_off</span>Stop sharing location</button>
          : <button className="btn-start" onClick={startTracking} disabled={!activeRoute}><span className="msf" style={{ fontSize: 18 }}>gps_fixed</span>{activeRoute ? 'Start sharing location' : 'No active route assigned'}</button>
        }
      </div>

      <div className="a3 card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Active route</p>
        {activeRoute ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="msf" style={{ fontSize: 18, color: '#00450d' }}>local_shipping</span>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>{activeRoute.route_name}</p>
              <p style={{ fontSize: 11, color: '#717a6d', margin: 0 }}>{activeRoute.ward} · {activeRoute.vehicle_number} · {activeRoute.shift} shift</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8' }}>
            <span className="msf" style={{ fontSize: 18 }}>info</span>
            <span style={{ fontSize: 13 }}>No active route. Your contractor or District Engineer needs to assign one.</span>
          </div>
        )}
      </div>

      <div className="a3" style={{ padding: '14px 16px', background: '#f0fdf4', borderRadius: 12, border: '1px solid rgba(0,69,13,.1)' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>How location sharing works</p>
        {['Your GPS coordinates update every 5 seconds while sharing', 'Supervisors and District Engineers see your vehicle live on the map', 'Residents can track when your truck is approaching their area', 'Automatic alerts fire if your vehicle appears stationary or off-route', 'Always stop sharing when your route is complete'].map(t => (
          <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 5 }}>
            <span className="msf-fill" style={{ fontSize: 12, color: '#00450d', marginTop: 2 }}>check_circle</span>
            <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{t}</span>
          </div>
        ))}
      </div>
    </DashboardLayout>
  )
}