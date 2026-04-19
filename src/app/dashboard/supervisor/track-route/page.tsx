'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const SUPERVISOR_NAV = [
    { label: 'Overview', href: '/dashboard/supervisor', icon: 'dashboard', section: 'Main' },
    { label: 'Routes', href: '/dashboard/supervisor/routes', icon: 'route', section: 'Operations' },
    { label: 'Drivers', href: '/dashboard/supervisor/drivers', icon: 'people', section: 'Operations' },
    { label: 'Track Route', href: '/dashboard/supervisor/track-route', icon: 'gps_fixed', section: 'Operations' },
    { label: 'Alerts', href: '/dashboard/supervisor/alerts', icon: 'notifications_active', section: 'Operations' },
    { label: 'Complaints', href: '/dashboard/supervisor/complaints', icon: 'feedback', section: 'Operations' },
    { label: 'Compliance', href: '/dashboard/supervisor/schedule-compliance', icon: 'fact_check', section: 'Reports' },
    { label: 'Waste Reports', href: '/dashboard/supervisor/waste-reports', icon: 'report', section: 'Reports' },
    { label: 'Ward Heatmap', href: '/dashboard/supervisor/heatmap', icon: 'map', section: 'Reports' },
    { label: 'Shift Report', href: '/dashboard/supervisor/shift-report', icon: 'picture_as_pdf', section: 'Reports' },
    { label: 'Announcements', href: '/dashboard/supervisor/announcements', icon: 'campaign', section: 'Communications' },
]

interface Route {
    id: string
    route_name: string
    ward: string
    district: string
    vehicle_number: string
    status: string
    shift: string
    date: string
    driver: { full_name: string } | null
}

interface Stop {
    id: string
    road_name: string
    address: string
    stop_order: number
    status: string
    skip_reason: string | null
    is_commercial: boolean
    latitude: number | null
    longitude: number | null
}

interface VehicleLocation {
    route_id: string
    latitude: number
    longitude: number
    speed_kmh: number
    updated_at: string
    heading: number | null
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

    // Init Google Maps
    useEffect(() => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) { setMapsError(true); setMapReady(true); return }
        if (typeof window === 'undefined') return

        if ((window as any).google?.maps) { initMap(); return }

        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`
        script.async = true
        script.defer = true
        script.onload = () => initMap()
        script.onerror = () => { setMapsError(true); setMapReady(true) }
        document.head.appendChild(script)
    }, [])

    function initMap() {
        if (!mapRef.current || mapInstanceRef.current) return
        mapInstanceRef.current = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 6.9271, lng: 79.8612 }, // Colombo
            zoom: 13,
            styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
        })
        setMapReady(true)
    }

    async function loadRoutes() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Load routes for supervisor's assigned wards
        const wards: string[] = p?.assigned_wards || []
        let query = supabase
            .from('routes')
            .select(`*, driver:driver_id(full_name)`)
            .in('status', ['active', 'pending'])
            .order('date', { ascending: false })

        if (wards.length > 0) {
            query = query.in('ward', wards)
        }

        const { data } = await query
        setRoutes(data || [])
        setLoading(false)
    }

    async function loadRouteDetails(routeId: string) {
        setLoadingRoute(true)
        const supabase = createClient()

        const { data: stopsData } = await supabase
            .from('collection_stops')
            .select('*')
            .eq('route_id', routeId)
            .order('stop_order', { ascending: true })
        setStops(stopsData || [])

        const { data: locData } = await supabase
            .from('vehicle_locations')
            .select('*')
            .eq('route_id', routeId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        setVehicleLocation(locData)

        if (!mapsError && mapInstanceRef.current) {
            updateMapMarkers(stopsData || [], locData)
        }

        setLoadingRoute(false)

        // Poll every 15 seconds for live location updates
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = setInterval(async () => {
            const { data: newLoc } = await supabase
                .from('vehicle_locations')
                .select('*')
                .eq('route_id', routeId)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (newLoc) {
                setVehicleLocation(newLoc)
                if (mapInstanceRef.current && vehicleMarkerRef.current) {
                    vehicleMarkerRef.current.setPosition({ lat: newLoc.latitude, lng: newLoc.longitude })
                }
            }
        }, 15000)
    }

    function updateMapMarkers(stopList: Stop[], vehicleLoc: VehicleLocation | null) {
        if (!mapInstanceRef.current) return
        const maps = (window as any).google.maps

        // Clear old markers
        markersRef.current.forEach(m => m.setMap(null))
        markersRef.current = []
        if (vehicleMarkerRef.current) vehicleMarkerRef.current.setMap(null)

        const bounds = new maps.LatLngBounds()

        // Stop markers
        stopList.forEach((stop, i) => {
            if (!stop.latitude || !stop.longitude) return
            const pos = { lat: stop.latitude, lng: stop.longitude }
            const color = stop.status === 'completed' ? '#00450d' : stop.status === 'skipped' ? '#ba1a1a' : '#d97706'
            const marker = new maps.Marker({
                position: pos,
                map: mapInstanceRef.current,
                title: stop.road_name || stop.address,
                icon: {
                    path: maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: color,
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                },
                label: { text: `${i + 1}`, color: 'white', fontSize: '10px', fontWeight: 'bold' },
            })
            markersRef.current.push(marker)
            bounds.extend(pos)
        })

        // Vehicle marker
        if (vehicleLoc) {
            const pos = { lat: vehicleLoc.latitude, lng: vehicleLoc.longitude }
            vehicleMarkerRef.current = new maps.Marker({
                position: pos,
                map: mapInstanceRef.current,
                title: 'Collection Vehicle',
                icon: {
                    url: 'https://maps.google.com/mapfiles/kml/shapes/cabs.png',
                    scaledSize: new maps.Size(32, 32),
                },
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
                .font-headline { font-family:'Manrope',sans-serif; }
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
                .s1{animation:staggerIn 0.5s ease 0.05s both}
                .s2{animation:staggerIn 0.5s ease 0.10s both}
                .s3{animation:staggerIn 0.5s ease 0.15s both}
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
                .live-dot { width:8px; height:8px; border-radius:50%; background:#16a34a; animation:pulse 2s infinite; }
            `}</style>

            {/* Hero */}
            <section className="mb-8 s1">
                <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '40px', color: '#181c22', lineHeight: 1.1 }}>
                    Track <span style={{ color: '#1b5e20' }}>Route</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: '#717a6d' }}>Select an active route to monitor live GPS progress</p>
            </section>

            <div className="grid md:grid-cols-3 gap-6 s2">
                {/* Route selector panel */}
                <div className="md:col-span-1">
                    <h3 className="font-headline font-bold text-sm mb-3" style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Active Routes ({routes.length})
                    </h3>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                        </div>
                    ) : routes.length === 0 ? (
                        <div className="bento-card p-6 text-center">
                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '32px', display: 'block', marginBottom: '8px' }}>route</span>
                            <p style={{ fontSize: '13px', color: '#94a3b8' }}>No active routes in your assigned wards.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {routes.map(route => (
                                <button
                                    key={route.id}
                                    onClick={() => setSelectedRouteId(route.id)}
                                    className={`route-btn ${selectedRouteId === route.id ? 'selected' : ''}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: '4px' }}>{route.route_name}</p>
                                            <p style={{ fontSize: '11px', color: '#94a3b8' }}>{route.ward} · {route.vehicle_number}</p>
                                            <p style={{ fontSize: '11px', color: '#94a3b8' }}>{route.driver?.full_name || 'Unassigned'}</p>
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
                <div className="md:col-span-2 s3">
                    {!selectedRouteId ? (
                        <div className="bento-card flex flex-col items-center justify-center" style={{ height: '480px' }}>
                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '48px', display: 'block', marginBottom: '12px' }}>gps_fixed</span>
                            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Select a route to view live tracking</p>
                        </div>
                    ) : (
                        <div>
                            {/* Route stats */}
                            {selectedRoute && (
                                <div className="bento-card mb-4 p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="font-headline font-bold text-base" style={{ color: '#181c22' }}>{selectedRoute.route_name}</p>
                                            <p style={{ fontSize: '12px', color: '#94a3b8' }}>{selectedRoute.ward} · {selectedRoute.vehicle_number} · {selectedRoute.driver?.full_name}</p>
                                        </div>
                                        {vehicleLocation && (
                                            <div className="flex items-center gap-2">
                                                <div className="live-dot" />
                                                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>Live</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-4 mb-3 text-sm">
                                        <span style={{ color: '#00450d' }}>✓ {completedStops} done</span>
                                        <span style={{ color: '#ba1a1a' }}>✗ {skippedStops} skipped</span>
                                        <span style={{ color: '#d97706' }}>○ {stops.length - completedStops - skippedStops} pending</span>
                                    </div>
                                    <div className="progress-bar mb-1">
                                        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                                    </div>
                                    <p style={{ fontSize: '11px', color: '#94a3b8' }}>{progressPct}% complete</p>
                                </div>
                            )}

                            {/* Map */}
                            <div className="bento-card mb-4" style={{ height: '340px', position: 'relative', overflow: 'hidden' }}>
                                {mapsError ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '40px' }}>map</span>
                                        <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '0 24px' }}>
                                            Google Maps unavailable. Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in Netlify env vars.
                                        </p>
                                    </div>
                                ) : (
                                    <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                                )}
                                {loadingRoute && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                                    </div>
                                )}
                            </div>

                            {/* Vehicle location info */}
                            {vehicleLocation && (
                                <div className="bento-card mb-4 p-4">
                                    <div className="flex items-center justify-between">
                                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22' }}>Vehicle Location</p>
                                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                                            Updated {new Date(vehicleLocation.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="flex gap-4 mt-2 text-sm" style={{ color: '#717a6d' }}>
                                        <span>{vehicleLocation.latitude.toFixed(5)}, {vehicleLocation.longitude.toFixed(5)}</span>
                                        {vehicleLocation.speed_kmh > 0 && <span>{vehicleLocation.speed_kmh} km/h</span>}
                                    </div>
                                </div>
                            )}

                            {/* Stop list */}
                            {stops.length > 0 && (
                                <div className="bento-card p-5">
                                    <p className="font-headline font-bold text-sm mb-3" style={{ color: '#181c22' }}>
                                        Stop Progress ({stops.length} stops)
                                    </p>
                                    {stops.map(stop => (
                                        <div key={stop.id} className="stop-row">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: stop.status === 'completed' ? '#f0fdf4' : stop.status === 'skipped' ? '#fef2f2' : '#f1f5f9' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: stop.status === 'completed' ? '#00450d' : stop.status === 'skipped' ? '#ba1a1a' : '#94a3b8' }}>
                                                    {stop.status === 'completed' ? 'check' : stop.status === 'skipped' ? 'close' : 'radio_button_unchecked'}
                                                </span>
                                            </div>
                                            <div className="flex-1">
                                                <p style={{ fontSize: '13px', color: '#181c22', fontWeight: 500 }}>{stop.road_name || stop.address}</p>
                                                {stop.skip_reason && <p style={{ fontSize: '11px', color: '#ba1a1a' }}>Skipped: {stop.skip_reason.replace(/_/g, ' ')}</p>}
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