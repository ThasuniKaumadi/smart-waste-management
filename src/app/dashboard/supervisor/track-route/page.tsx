'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const SUPERVISOR_NAV = [
    { label: 'Overview', href: '/dashboard/supervisor', icon: 'dashboard', section: 'Menu' },
    { label: 'Schedules', href: '/dashboard/supervisor/schedules', icon: 'calendar_month', section: 'Menu' },
    { label: 'Routes', href: '/dashboard/supervisor/routes', icon: 'route', section: 'Menu' },
    { label: 'Drivers', href: '/dashboard/supervisor/drivers', icon: 'people', section: 'Menu' },
    { label: 'Track Route', href: '/dashboard/supervisor/track-route', icon: 'gps_fixed', section: 'Menu' },
    { label: 'Alerts', href: '/dashboard/supervisor/alerts', icon: 'notifications_active', section: 'Menu' },
    { label: 'Complaints', href: '/dashboard/supervisor/complaints', icon: 'feedback', section: 'Menu' },
    { label: 'Compliance', href: '/dashboard/supervisor/schedule-compliance', icon: 'fact_check', section: 'Menu' },
    { label: 'Waste Reports', href: '/dashboard/supervisor/waste-reports', icon: 'report', section: 'Menu' },
    { label: 'Ward Heatmap', href: '/dashboard/supervisor/heatmap', icon: 'map', section: 'Menu' },
    { label: 'Shift Report', href: '/dashboard/supervisor/shift-report', icon: 'picture_as_pdf', section: 'Menu' },
    { label: 'Announcements', href: '/dashboard/supervisor/announcements', icon: 'campaign', section: 'Menu' },
]

interface Route {
    id: string; route_name: string; ward: string; district: string
    vehicle_number: string; status: string; shift: string; date: string
    driver: { full_name: string } | null
}
interface Stop {
    id: string; road_name: string; address: string; stop_order: number
    status: string; skip_reason: string | null; is_commercial: boolean
    latitude: number | null; longitude: number | null
}
interface VehicleLocation {
    route_id: string; latitude: number; longitude: number
    speed_kmh: number; updated_at: string; heading: number | null
}

export default function SupervisorTrackRoutePage() {
    const [profile, setProfile] = useState<any>(null)
    const [routes, setRoutes] = useState<Route[]>([])
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
    const [stops, setStops] = useState<Stop[]>([])
    const [vehicleLocation, setVehicleLocation] = useState<VehicleLocation | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadingRoute, setLoadingRoute] = useState(false)
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const markersRef = useRef<any[]>([])
    const vehicleMarkerRef = useRef<any>(null)
    const intervalRef = useRef<any>(null)
    const [mapReady, setMapReady] = useState(false)
    const [mapsError, setMapsError] = useState(false)

    const selectedRoute = routes.find(r => r.id === selectedRouteId)
    const completedStops = stops.filter(s => s.status === 'completed').length
    const skippedStops = stops.filter(s => s.status === 'skipped').length
    const progressPct = stops.length > 0 ? Math.round(((completedStops + skippedStops) / stops.length) * 100) : 0

    useEffect(() => {
        loadRoutes()
        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }, [])

    useEffect(() => {
        if (!mapReady || !selectedRouteId) return
        loadRouteDetails(selectedRouteId)
    }, [selectedRouteId, mapReady])

    useEffect(() => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) { setMapsError(true); setMapReady(true); return }
        if (typeof window === 'undefined') return
        if ((window as any).google?.maps) { initMap(); return }
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`
        script.async = true; script.defer = true
        script.onload = () => initMap()
        script.onerror = () => { setMapsError(true); setMapReady(true) }
        document.head.appendChild(script)
    }, [])

    function initMap() {
        if (!mapRef.current || mapInstanceRef.current) return
        mapInstanceRef.current = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 6.9271, lng: 79.8612 }, zoom: 13,
            styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
            mapTypeControl: false, fullscreenControl: false, streetViewControl: false,
        })
        setMapReady(true)
    }

    async function loadRoutes() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const wards: string[] = p?.assigned_wards || []
        let query = supabase.from('routes').select(`*, driver:driver_id(full_name)`)
            .in('status', ['active', 'pending']).order('date', { ascending: false })
        if (wards.length > 0) query = query.in('ward', wards)
        const { data } = await query
        setRoutes(data || [])
        setLoading(false)
    }

    async function loadRouteDetails(routeId: string) {
        setLoadingRoute(true)
        const supabase = createClient()
        const { data: stopsData } = await supabase.from('collection_stops').select('*')
            .eq('route_id', routeId).order('stop_order', { ascending: true })
        setStops(stopsData || [])
        const { data: locData } = await supabase.from('vehicle_locations').select('*')
            .eq('route_id', routeId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
        setVehicleLocation(locData)
        if (!mapsError && mapInstanceRef.current) updateMapMarkers(stopsData || [], locData)
        setLoadingRoute(false)
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = setInterval(async () => {
            const { data: newLoc } = await supabase.from('vehicle_locations').select('*')
                .eq('route_id', routeId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
            if (newLoc) {
                setVehicleLocation(newLoc)
                if (mapInstanceRef.current && vehicleMarkerRef.current)
                    vehicleMarkerRef.current.setPosition({ lat: newLoc.latitude, lng: newLoc.longitude })
            }
        }, 15000)
    }

    function updateMapMarkers(stopList: Stop[], vehicleLoc: VehicleLocation | null) {
        if (!mapInstanceRef.current) return
        const maps = (window as any).google.maps
        markersRef.current.forEach(m => m.setMap(null)); markersRef.current = []
        if (vehicleMarkerRef.current) vehicleMarkerRef.current.setMap(null)
        const bounds = new maps.LatLngBounds()
        stopList.forEach((stop, i) => {
            if (!stop.latitude || !stop.longitude) return
            const pos = { lat: stop.latitude, lng: stop.longitude }
            const color = stop.status === 'completed' ? '#00450d' : stop.status === 'skipped' ? '#ba1a1a' : '#d97706'
            const marker = new maps.Marker({
                position: pos, map: mapInstanceRef.current, title: stop.road_name || stop.address,
                icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: color, fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 },
                label: { text: `${i + 1}`, color: 'white', fontSize: '10px', fontWeight: 'bold' },
            })
            markersRef.current.push(marker); bounds.extend(pos)
        })
        if (vehicleLoc) {
            const pos = { lat: vehicleLoc.latitude, lng: vehicleLoc.longitude }
            vehicleMarkerRef.current = new maps.Marker({
                position: pos, map: mapInstanceRef.current, title: 'Collection Vehicle',
                icon: { url: 'https://maps.google.com/mapfiles/kml/shapes/cabs.png', scaledSize: new maps.Size(32, 32) },
                zIndex: 999,
            })
            bounds.extend(pos)
        }
        if (!bounds.isEmpty()) mapInstanceRef.current.fitBounds(bounds, 60)
    }

    return (
        <DashboardLayout role="Supervisor" userName={profile?.full_name || ''} navItems={SUPERVISOR_NAV}>
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.08em; text-transform:uppercase; white-space:nowrap; }
        .route-btn { width:100%; text-align:left; padding:14px 16px; border-radius:12px; border:1.5px solid rgba(0,69,13,0.08); background:white; cursor:pointer; transition:all 0.2s; }
        .route-btn:hover { border-color:#00450d; background:#f9fdf9; }
        .route-btn.selected { border-color:#00450d; background:#f0fdf4; }
        .stop-row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid rgba(0,69,13,0.04); }
        .stop-row:last-child { border-bottom:none; }
        .progress-bar { height:6px; background:#f1f5f9; border-radius:99px; overflow:hidden; }
        .progress-fill { height:100%; background:#00450d; border-radius:99px; transition:width 0.4s ease; }
        @keyframes staggerIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .s1{animation:staggerIn 0.5s ease 0.05s both} .s2{animation:staggerIn 0.5s ease 0.10s both} .s3{animation:staggerIn 0.5s ease 0.15s both}
        .live-dot { width:8px; height:8px; border-radius:50%; background:#16a34a; animation:pulse 2s infinite; }
      `}</style>

            {/* Header */}
            <section style={{ marginBottom: '32px' }} className="s1">
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 8px' }}>
                    Supervisor · Live Tracking
                </p>
                <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: '46px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 6px' }}>
                    Track <span style={{ color: '#1b5e20' }}>Route</span>
                </h1>
                <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>
                    Select an active route to monitor live GPS progress
                </p>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }} className="s2">
                {/* Route selector */}
                <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontFamily: 'Manrope,sans-serif' }}>
                        Active Routes ({routes.length})
                    </p>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
                            <div style={{ width: '24px', height: '24px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                    ) : routes.length === 0 ? (
                        <div className="bento-card" style={{ padding: '24px', textAlign: 'center' }}>
                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '32px', display: 'block', marginBottom: '8px' }}>route</span>
                            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>No active routes in your assigned wards.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {routes.map(route => (
                                <button key={route.id} onClick={() => setSelectedRouteId(route.id)} className={`route-btn ${selectedRouteId === route.id ? 'selected' : ''}`}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                        <div>
                                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 4px' }}>{route.route_name}</p>
                                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 2px' }}>{route.ward} · {route.vehicle_number}</p>
                                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{route.driver?.full_name || 'Unassigned'}</p>
                                        </div>
                                        <span className="badge" style={{ background: route.status === 'active' ? '#f0fdf4' : '#fefce8', color: route.status === 'active' ? '#00450d' : '#d97706', flexShrink: 0 }}>
                                            {route.status}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Map + details */}
                <div className="s3">
                    {!selectedRouteId ? (
                        <div className="bento-card" style={{ height: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '48px', display: 'block', marginBottom: '12px' }}>gps_fixed</span>
                            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Select a route to view live tracking</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Route stats */}
                            {selectedRoute && (
                                <div className="bento-card" style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <div>
                                            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '15px', color: '#181c22', margin: '0 0 4px' }}>{selectedRoute.route_name}</p>
                                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{selectedRoute.ward} · {selectedRoute.vehicle_number} · {selectedRoute.driver?.full_name}</p>
                                        </div>
                                        {vehicleLocation && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div className="live-dot" />
                                                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>Live</span>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '13px' }}>
                                        <span style={{ color: '#00450d' }}>✓ {completedStops} done</span>
                                        <span style={{ color: '#ba1a1a' }}>✗ {skippedStops} skipped</span>
                                        <span style={{ color: '#d97706' }}>○ {stops.length - completedStops - skippedStops} pending</span>
                                    </div>
                                    <div className="progress-bar" style={{ marginBottom: '4px' }}>
                                        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                                    </div>
                                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{progressPct}% complete</p>
                                </div>
                            )}

                            {/* Map */}
                            <div className="bento-card" style={{ height: '340px', position: 'relative', overflow: 'hidden' }}>
                                {mapsError ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '40px' }}>map</span>
                                        <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '0 24px' }}>
                                            Google Maps unavailable. Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in environment variables.
                                        </p>
                                    </div>
                                ) : (
                                    <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                                )}
                                {loadingRoute && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: '32px', height: '32px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    </div>
                                )}
                            </div>

                            {/* Vehicle location */}
                            {vehicleLocation && (
                                <div className="bento-card" style={{ padding: '16px 20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: 0 }}>Vehicle Location</p>
                                        <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                                            Updated {new Date(vehicleLocation.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: '#717a6d' }}>
                                        <span>{vehicleLocation.latitude.toFixed(5)}, {vehicleLocation.longitude.toFixed(5)}</span>
                                        {vehicleLocation.speed_kmh > 0 && <span>{vehicleLocation.speed_kmh} km/h</span>}
                                    </div>
                                </div>
                            )}

                            {/* Stop list */}
                            {stops.length > 0 && (
                                <div className="bento-card" style={{ padding: '20px' }}>
                                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '14px', color: '#181c22', margin: '0 0 12px' }}>
                                        Stop Progress ({stops.length} stops)
                                    </p>
                                    {stops.map(stop => (
                                        <div key={stop.id} className="stop-row">
                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, background: stop.status === 'completed' ? '#f0fdf4' : stop.status === 'skipped' ? '#fef2f2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: stop.status === 'completed' ? '#00450d' : stop.status === 'skipped' ? '#ba1a1a' : '#94a3b8' }}>
                                                    {stop.status === 'completed' ? 'check' : stop.status === 'skipped' ? 'close' : 'radio_button_unchecked'}
                                                </span>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#181c22', fontSize: '13px' }}>{stop.road_name || stop.address}</p>
                                                {stop.skip_reason && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#ba1a1a' }}>Skipped: {stop.skip_reason.replace(/_/g, ' ')}</p>}
                                            </div>
                                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>#{stop.stop_order}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}