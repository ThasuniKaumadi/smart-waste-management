'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const RESIDENT_NAV = [
  { label: 'Home', href: '/dashboard/resident', icon: 'dashboard', section: 'Menu' },
  { label: 'Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today', section: 'Menu' },
  { label: 'Track Vehicle', href: '/dashboard/resident/tracking', icon: 'location_on', section: 'Menu' },
  { label: 'Report Issue', href: '/dashboard/resident/report', icon: 'report_problem', section: 'Menu' },
  { label: 'Feedback', href: '/dashboard/resident/feedback', icon: 'star', section: 'Menu' },
  { label: 'My Profile', href: '/dashboard/resident/profile', icon: 'person', section: 'Menu' },
]

interface VehicleLocation {
  driver_id: string
  route_id: string
  latitude: number
  longitude: number
  updated_at: string
}

const COLOMBO_CENTER = { lat: 6.9271, lng: 79.8612 }

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export default function ResidentTrackingPage() {
  const [profile, setProfile] = useState<any>(null)
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [nextSchedule, setNextSchedule] = useState<any>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLocation | null>(null)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: locs } = await supabase.from('vehicle_locations').select('*').gte('updated_at', twoHoursAgo)
    setVehicles(locs || [])

    if (p?.district) {
      const today = new Date().toISOString().split('T')[0]
      const { data: scheds } = await supabase.from('schedules').select('*')
        .eq('district', p.district).eq('published', true)
        .gte('scheduled_date', today).order('scheduled_date', { ascending: true }).limit(1)
      setNextSchedule(scheds?.[0] || null)
    }

    setLoading(false)
  }, [])

  // Load Google Maps script — only when this component is mounted
  useEffect(() => {
    let mounted = true

    function loadScript() {
      if (window.google?.maps) { if (mounted) setMapLoaded(true); return }

      const existing = document.getElementById('google-maps-script')
      if (existing) {
        existing.addEventListener('load', () => { if (mounted) setMapLoaded(true) })
        return
      }

      window.initMap = () => { if (mounted) setMapLoaded(true) }

      const script = document.createElement('script')
      script.id = 'google-maps-script'
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&callback=initMap&loading=async`
      script.async = true
      script.defer = true
      script.onerror = () => { if (mounted) setMapError(true) }
      document.head.appendChild(script)
    }

    const timer = setTimeout(loadScript, 100)

    return () => {
      mounted = false
      clearTimeout(timer)
      window.initMap = () => { }
      mapInstance.current = null
      markersRef.current.forEach(m => { try { m.setMap(null) } catch { } })
      markersRef.current = []
      const s = document.getElementById('google-maps-script')
      if (s) s.remove()
      try { delete (window as any).google } catch { }
    }
  }, [])

  // Init map once script loaded
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstance.current || !document.getElementById('google-maps-script')) return
    try {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: COLOMBO_CENTER,
        zoom: 13,
        mapTypeId: 'roadmap',
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'water', stylers: [{ color: '#d4eaf7' }] },
          { featureType: 'landscape', stylers: [{ color: '#f0f7f0' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#e8f0e8' }] },
          { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c8dcc8' }] },
        ],
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      })
      infoWindowRef.current = new window.google.maps.InfoWindow()
    } catch (e) {
      setMapError(true)
    }
  }, [mapLoaded])

  // Update markers when vehicles change
  useEffect(() => {
    if (!mapInstance.current || !window.google?.maps) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    if (vehicles.length === 0) return

    const bounds = new window.google.maps.LatLngBounds()

    vehicles.forEach((v, i) => {
      const position = { lat: v.latitude, lng: v.longitude }
      bounds.extend(position)

      const marker = new window.google.maps.Marker({
        position,
        map: mapInstance.current,
        title: `Truck ${i + 1}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#00450d',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2,
        },
        label: {
          text: `${i + 1}`,
          color: 'white',
          fontSize: '11px',
          fontWeight: 'bold',
        },
        animation: window.google.maps.Animation.DROP,
      })

      marker.addListener('click', () => {
        const diff = Math.floor((Date.now() - new Date(v.updated_at).getTime()) / 1000)
        const timeStr = diff < 60 ? `${diff}s ago` : diff < 3600 ? `${Math.floor(diff / 60)}m ago` : `${Math.floor(diff / 3600)}h ago`
        infoWindowRef.current.setContent(`
          <div style="font-family:Manrope,sans-serif;padding:8px 4px;min-width:160px">
            <p style="font-weight:800;font-size:14px;color:#181c22;margin:0 0 4px">Truck ${i + 1}</p>
            <p style="font-size:11px;color:#717a6d;margin:0 0 6px;display:flex;align-items:center;gap:4px">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#16a34a"></span>
              Live · Updated ${timeStr}
            </p>
            <p style="font-size:10px;color:#94a3b8;margin:0;font-family:monospace">${v.latitude.toFixed(5)}, ${v.longitude.toFixed(5)}</p>
          </div>
        `)
        infoWindowRef.current.open(mapInstance.current, marker)
        setSelectedVehicle(v)
      })

      markersRef.current.push(marker)
    })

    if (vehicles.length === 1) {
      mapInstance.current.setCenter({ lat: vehicles[0].latitude, lng: vehicles[0].longitude })
      mapInstance.current.setZoom(15)
    } else {
      mapInstance.current.fitBounds(bounds, { padding: 60 })
    }
  }, [vehicles, mapLoaded])

  // Auto-refresh
  useEffect(() => {
    loadData()
    const interval = setInterval(() => {
      loadData()
      setLastRefresh(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const isCollectionDay = nextSchedule?.collection_day === todayName

  return (
    <DashboardLayout role="Resident" userName={profile?.full_name || ''} navItems={RESIDENT_NAV}
      primaryAction={{ label: 'View Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' }}>
      <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .live-dot{animation:pulse 1.5s ease infinite}
        .a1{animation:fadeUp .4s ease .04s both}.a2{animation:fadeUp .4s ease .09s both}.a3{animation:fadeUp .4s ease .14s both}
        .vehicle-row{padding:16px 20px;border-bottom:1px solid rgba(0,69,13,0.04);display:flex;align-items:center;gap:14px;transition:background 0.1s;cursor:pointer}
        .vehicle-row:hover{background:#f0fdf4}
        .vehicle-row.selected{background:#f0fdf4;border-left:3px solid #00450d}
        .vehicle-row:last-child{border-bottom:none}
        .stat-card{background:white;border-radius:16px;padding:16px;border:1.5px solid #f0f0f0;display:flex;align-items:center;gap:12px}
      `}</style>

      {/* Header */}
      <div className="a1" style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>Resident Portal</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 42, fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif', marginBottom: 4 }}>
              Track <span style={{ color: '#00450d' }}>Vehicle</span>
            </h1>
            <p style={{ fontSize: 13, color: '#717a6d' }}>{profile?.district || 'CMC District'} · Live collection truck positions</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 99, background: vehicles.length > 0 ? 'rgba(22,163,74,0.08)' : '#f1f5f9', border: `1px solid ${vehicles.length > 0 ? 'rgba(22,163,74,0.2)' : '#e2e8f0'}` }}>
              <div className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: vehicles.length > 0 ? '#16a34a' : '#94a3b8' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: vehicles.length > 0 ? '#16a34a' : '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>
                {vehicles.length > 0 ? 'LIVE' : 'NO ACTIVE VEHICLES'}
              </span>
            </div>
            <button onClick={() => { loadData(); setLastRefresh(new Date()) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 99, background: 'white', border: '1.5px solid #e5e7eb', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', color: '#374151' }}>
              <span className="msf" style={{ fontSize: 14 }}>refresh</span>Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <div className="stat-card">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: vehicles.length > 0 ? 'rgba(22,163,74,0.08)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="msf" style={{ fontSize: 18, color: vehicles.length > 0 ? '#16a34a' : '#94a3b8' }}>local_shipping</span>
          </div>
          <div>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{vehicles.length}</p>
            <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Active Trucks</p>
          </div>
        </div>
        <div className="stat-card">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: isCollectionDay ? '#f0fdf4' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="msf" style={{ fontSize: 18, color: isCollectionDay ? '#00450d' : '#94a3b8' }}>today</span>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1.2 }}>
              {isCollectionDay ? 'Today' : nextSchedule ? new Date(nextSchedule.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
            </p>
            <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Next Collection</p>
          </div>
        </div>
        <div className="stat-card">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="msf" style={{ fontSize: 18, color: '#00450d' }}>schedule</span>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1.2 }}>{timeAgo(lastRefresh.toISOString())}</p>
            <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Last Updated</p>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="a2 card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#00450d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="msf" style={{ fontSize: 18, color: 'rgba(163,246,156,0.9)' }}>map</span>
            <div>
              <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: 'white' }}>Live Map</p>
              <p style={{ fontSize: 11, color: 'rgba(163,246,156,0.7)' }}>Google Maps · {profile?.district || 'CMC District'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {vehicles.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(163,246,156,0.9)', fontFamily: 'Manrope,sans-serif' }}>
                {vehicles.length} truck{vehicles.length !== 1 ? 's' : ''} on map
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.12)' }}>
              <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'white', fontFamily: 'Manrope,sans-serif' }}>LIVE</span>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', height: 420 }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {!mapLoaded && !mapError && (
            <div style={{ position: 'absolute', inset: 0, background: '#f0f7f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
              <p style={{ fontSize: 13, color: '#717a6d', fontFamily: 'Manrope,sans-serif' }}>Loading map...</p>
            </div>
          )}

          {mapError && (
            <div style={{ position: 'absolute', inset: 0, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
              <span className="msf" style={{ fontSize: 36, color: '#dc2626' }}>error</span>
              <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22' }}>Map failed to load</p>
              <p style={{ fontSize: 12, color: '#717a6d' }}>Check your Google Maps API key and ensure Maps JavaScript API is enabled.</p>
            </div>
          )}

          {mapLoaded && !mapError && vehicles.length === 0 && (
            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'white', borderRadius: 12, padding: '10px 18px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              <span className="msf" style={{ fontSize: 16, color: '#94a3b8' }}>local_shipping</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: 'Manrope,sans-serif' }}>No active trucks right now</span>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle list */}
      <div className="a3">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22' }}>Active Vehicles in Your District</h2>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Updated {timeAgo(lastRefresh.toISOString())}</span>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            </div>
          ) : vehicles.length === 0 ? (
            <div style={{ padding: '32px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  { icon: 'event_available', label: 'Collection Day', value: isCollectionDay ? 'Today' : nextSchedule ? new Date(nextSchedule.scheduled_date).toLocaleDateString('en-GB', { weekday: 'long' }) : 'Check schedule', color: '#00450d', bg: '#f0fdf4' },
                  { icon: 'schedule', label: 'Collection Time', value: nextSchedule?.collection_time || '—', color: '#1d4ed8', bg: '#eff6ff' },
                  { icon: 'local_shipping', label: 'Trucks Active', value: '0 right now', color: '#94a3b8', bg: '#f8fafc' },
                  { icon: 'notifications', label: 'Next Alert', value: isCollectionDay ? 'Today' : 'On collection day', color: '#d97706', bg: '#fffbeb' },
                ].map(item => (
                  <div key={item.label} style={{ background: item.bg, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      <span className="msf" style={{ fontSize: 15, color: item.color }}>{item.icon}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{item.value}</p>
                      <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 600 }}>{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#181c22', marginBottom: 4 }}>No vehicles currently active</p>
                <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                  {isCollectionDay ? 'Today is a collection day — trucks will appear here when drivers start their routes.' : 'Check back on your scheduled collection day.'}
                </p>
              </div>
            </div>
          ) : (
            vehicles.map((v, i) => (
              <div key={v.driver_id}
                className={`vehicle-row ${selectedVehicle?.driver_id === v.driver_id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedVehicle(v)
                  if (mapInstance.current) {
                    mapInstance.current.panTo({ lat: v.latitude, lng: v.longitude })
                    mapInstance.current.setZoom(16)
                    markersRef.current[i]?.fireEvent('click')
                  }
                }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,69,13,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msf" style={{ fontSize: 22, color: '#00450d' }}>local_shipping</span>
                  </div>
                  <div className="live-dot" style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: '#16a34a', border: '2px solid white' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22' }}>Truck {i + 1}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontFamily: 'Manrope,sans-serif' }}>LIVE</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#717a6d', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span className="msf" style={{ fontSize: 13 }}>location_on</span>
                      {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span className="msf" style={{ fontSize: 13 }}>schedule</span>
                      {timeAgo(v.updated_at)}
                    </span>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <a href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 99, background: '#f0fdf4', color: '#00450d', textDecoration: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', border: '1px solid rgba(0,69,13,0.15)' }}>
                    <span className="msf" style={{ fontSize: 14 }}>open_in_new</span>
                    Maps
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 14, padding: '14px 18px', borderRadius: 14, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span className="msf" style={{ fontSize: 16, color: '#00450d', flexShrink: 0, marginTop: 1 }}>info</span>
          <p style={{ fontSize: 12, color: '#41493e', lineHeight: 1.6 }}>
            Vehicles appear when drivers are actively sharing GPS during a collection route. Click any truck in the list to centre the map on it. Tap <strong>Maps</strong> to open in Google Maps. The map auto-refreshes every 30 seconds.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}