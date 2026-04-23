'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const DE_NAV = [
    { label: 'Home', href: '/dashboard/district-engineer', icon: 'dashboard' },
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
    { label: 'Profile', href: '/dashboard/district-engineer/profile', icon: 'person' },
]

interface ActiveRoute {
    id: string
    route_name: string
    ward: string
    district: string
    vehicle_number: string
    status: string
    shift: string
    date: string
    driver: { full_name: string } | null
    contractor: { full_name: string; organisation_name: string } | null
    stops_total: number
    stops_completed: number
    stops_skipped: number
}

interface VehicleLocation {
    route_id: string
    latitude: number
    longitude: number
    speed_kmh: number
    updated_at: string
    heading: number | null
}

export default function DEFleetTrackerPage() {
    const [profile, setProfile] = useState<any>(null)
    const [routes, setRoutes] = useState<ActiveRoute[]>([])
    const [locations, setLocations] = useState<Record<string, VehicleLocation>>({})
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [mapReady, setMapReady] = useState(false)
    const [mapsError, setMapsError] = useState(false)
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const markersRef = useRef<Record<string, any>>({})
    const infoWindowRef = useRef<any>(null)
    const pollRef = useRef<any>(null)

    const selectedRoute = routes.find(r => r.id === selectedRouteId) || null
    const locatedCount = Object.keys(locations).length

    useEffect(() => {
        loadData()
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [])

    useEffect(() => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) { setMapsError(true); setMapReady(true); return }
        if (typeof window === 'undefined') return
        if ((window as any).google?.maps) { initMap(); return }
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
        script.async = true
        script.onload = () => initMap()
        script.onerror = () => { setMapsError(true); setMapReady(true) }
        document.head.appendChild(script)
    }, [])

    useEffect(() => {
        if (mapReady && Object.keys(locations).length > 0) {
            updateAllMarkers()
        }
    }, [locations, mapReady])

    function initMap() {
        if (!mapRef.current || mapInstanceRef.current) return
        mapInstanceRef.current = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 6.9271, lng: 79.8612 },
            zoom: 13,
            styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
        })
        infoWindowRef.current = new (window as any).google.maps.InfoWindow()
        setMapReady(true)
    }

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        await fetchRoutesAndLocations(p?.district || null)
        setLoading(false)

        // Poll every 20 seconds
        pollRef.current = setInterval(() => fetchLocationsOnly(), 20000)
    }

    async function fetchRoutesAndLocations(district: string | null) {
        const supabase = createClient()
        const today = new Date().toISOString().split('T')[0]

        let query = supabase
            .from('routes')
            .select(`
                id, route_name, ward, district, vehicle_number, status, shift, date,
                driver:driver_id(full_name),
                contractor:contractor_id(full_name, organisation_name)
            `)
            .in('status', ['active', 'pending'])
            .eq('date', today)
            .order('route_name')

        if (district) query = query.eq('district', district)

        const { data: routeData } = await query

        if (!routeData || routeData.length === 0) {
            setRoutes([])
            return
        }

        const routeIds = routeData.map((r: any) => r.id)

        // Get stop counts per route
        const { data: stopCounts } = await supabase
            .from('collection_stops')
            .select('route_id, status')
            .in('route_id', routeIds)

        const countMap: Record<string, { total: number; completed: number; skipped: number }> = {}
            ; (stopCounts || []).forEach((s: any) => {
                if (!countMap[s.route_id]) countMap[s.route_id] = { total: 0, completed: 0, skipped: 0 }
                countMap[s.route_id].total++
                if (s.status === 'completed') countMap[s.route_id].completed++
                if (s.status === 'skipped') countMap[s.route_id].skipped++
            })

        const enriched: ActiveRoute[] = (routeData as any[]).map(r => ({
            ...r,
            stops_total: countMap[r.id]?.total || 0,
            stops_completed: countMap[r.id]?.completed || 0,
            stops_skipped: countMap[r.id]?.skipped || 0,
        }))
        setRoutes(enriched)

        // Get latest vehicle location per route
        const { data: locData } = await supabase
            .from('vehicle_locations')
            .select('*')
            .in('route_id', routeIds)
            .order('updated_at', { ascending: false })

        const locMap: Record<string, VehicleLocation> = {}
            ; (locData || []).forEach((l: any) => {
                if (!locMap[l.route_id]) locMap[l.route_id] = l
            })
        setLocations(locMap)
    }

    async function fetchLocationsOnly() {
        const supabase = createClient()
        const routeIds = routes.map(r => r.id)
        if (routeIds.length === 0) return
        const { data: locData } = await supabase
            .from('vehicle_locations')
            .select('*')
            .in('route_id', routeIds)
            .order('updated_at', { ascending: false })
        const locMap: Record<string, VehicleLocation> = {}
            ; (locData || []).forEach((l: any) => {
                if (!locMap[l.route_id]) locMap[l.route_id] = l
            })
        setLocations(locMap)
    }

    function updateAllMarkers() {
        if (!mapInstanceRef.current) return
        const maps = (window as any).google.maps
        const bounds = new maps.LatLngBounds()
        let hasPoints = false

        routes.forEach(route => {
            const loc = locations[route.id]
            if (!loc) return
            const pos = { lat: loc.latitude, lng: loc.longitude }
            const progress = route.stops_total > 0
                ? Math.round((route.stops_completed / route.stops_total) * 100)
                : 0
            const isSelected = route.id === selectedRouteId

            const color = route.status === 'active' ? '#00450d' : '#d97706'

            if (markersRef.current[route.id]) {
                markersRef.current[route.id].setPosition(pos)
                markersRef.current[route.id].setIcon({
                    path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: isSelected ? 9 : 7,
                    fillColor: color,
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                    rotation: loc.heading || 0,
                })
            } else {
                const marker = new maps.Marker({
                    position: pos,
                    map: mapInstanceRef.current,
                    title: `${route.vehicle_number} — ${route.route_name}`,
                    icon: {
                        path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
                        scale: isSelected ? 9 : 7,
                        fillColor: color,
                        fillOpacity: 1,
                        strokeColor: 'white',
                        strokeWeight: 2,
                        rotation: loc.heading || 0,
                    },
                    zIndex: isSelected ? 999 : 1,
                })
                marker.addListener('click', () => {
                    setSelectedRouteId(route.id)
                    infoWindowRef.current?.setContent(`
                        <div style="font-family:sans-serif;padding:4px 2px;min-width:160px">
                            <p style="font-weight:700;font-size:13px;margin:0 0 3px">${route.vehicle_number}</p>
                            <p style="font-size:11px;color:#666;margin:0 0 2px">${route.route_name}</p>
                            <p style="font-size:11px;color:#666;margin:0 0 4px">${route.driver?.full_name || 'Unassigned'}</p>
                            <p style="font-size:11px;font-weight:600;color:#00450d;margin:0">${progress}% complete</p>
                        </div>
                    `)
                    infoWindowRef.current?.open(mapInstanceRef.current, marker)
                })
                markersRef.current[route.id] = marker
            }
            bounds.extend(pos)
            hasPoints = true
        })

        if (hasPoints && !selectedRouteId) {
            mapInstanceRef.current.fitBounds(bounds, 80)
        } else if (selectedRouteId && locations[selectedRouteId]) {
            const loc = locations[selectedRouteId]
            mapInstanceRef.current.panTo({ lat: loc.latitude, lng: loc.longitude })
            mapInstanceRef.current.setZoom(15)
        }
    }

    function selectRoute(routeId: string) {
        setSelectedRouteId(prev => prev === routeId ? null : routeId)
        if (locations[routeId] && mapInstanceRef.current) {
            const loc = locations[routeId]
            mapInstanceRef.current.panTo({ lat: loc.latitude, lng: loc.longitude })
            mapInstanceRef.current.setZoom(15)
        }
    }

    function lastSeenLabel(updatedAt: string) {
        const diff = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000)
        if (diff < 60) return `${diff}s ago`
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
        return `${Math.floor(diff / 3600)}h ago`
    }

    return (
        <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}>
            <style>{`
                .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
                .card { background:white; border-radius:16px; box-shadow:0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.04); border:1px solid rgba(0,69,13,0.06); overflow:hidden; }
                .route-btn { width:100%; text-align:left; padding:12px 14px; border-radius:12px; border:1.5px solid rgba(0,69,13,0.08); background:white; cursor:pointer; transition:all 0.18s; }
                .route-btn:hover { border-color:rgba(0,69,13,0.3); background:#f9fdf9; }
                .route-btn.sel { border-color:#00450d; background:#f0fdf4; }
                .progress-track { height:5px; background:#f0fdf4; border-radius:99px; overflow:hidden; margin-top:6px; }
                .progress-fill { height:100%; background:#00450d; border-radius:99px; transition:width 0.4s; }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
                .live-dot { width:7px; height:7px; border-radius:50%; background:#16a34a; animation:pulse 2s infinite; flex-shrink:0; }
                @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
                .a1{animation:fadeUp .35s ease both} .a2{animation:fadeUp .35s ease .06s both} .a3{animation:fadeUp .35s ease .12s both}
                @keyframes spin { to{transform:rotate(360deg)} }
            `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 8 }}>
                    District Engineer · Live GPS
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <h1 style={{ fontSize: 38, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: 0 }}>
                        Fleet <span style={{ color: '#1b5e20' }}>Tracker</span>
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#f0fdf4', borderRadius: 99, border: '1px solid rgba(0,69,13,0.1)' }}>
                        <div className="live-dot" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>
                            {locatedCount} of {routes.length} vehicles located
                        </span>
                    </div>
                </div>
            </div>

            {/* Summary stats */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Active routes', value: routes.filter(r => r.status === 'active').length, color: '#00450d', bg: '#f0fdf4', icon: 'route' },
                    { label: 'Vehicles on map', value: locatedCount, color: '#1d4ed8', bg: '#eff6ff', icon: 'gps_fixed' },
                    { label: 'Stops completed', value: routes.reduce((s, r) => s + r.stops_completed, 0), color: '#7c3aed', bg: '#f5f3ff', icon: 'check_circle' },
                ].map(m => (
                    <div key={m.label} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msf" style={{ fontSize: 17, color: m.color }}>{m.icon}</span>
                        </div>
                        <div>
                            <p style={{ fontSize: 21, fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0, lineHeight: 1 }}>{m.value}</p>
                            <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{m.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="a3" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
                {/* Route list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Manrope,sans-serif', marginBottom: 4 }}>
                        Today's routes ({routes.length})
                    </p>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                            <div style={{ width: 24, height: 24, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                        </div>
                    ) : routes.length === 0 ? (
                        <div className="card" style={{ padding: '32px 16px', textAlign: 'center' }}>
                            <span className="msf" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 10 }}>route</span>
                            <p style={{ fontSize: 13, color: '#94a3b8' }}>No active routes today.</p>
                        </div>
                    ) : (
                        routes.map(route => {
                            const loc = locations[route.id]
                            const progress = route.stops_total > 0
                                ? Math.round((route.stops_completed / route.stops_total) * 100)
                                : 0
                            return (
                                <button
                                    key={route.id}
                                    className={`route-btn ${selectedRouteId === route.id ? 'sel' : ''}`}
                                    onClick={() => selectRoute(route.id)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: 12, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {route.vehicle_number}
                                            </p>
                                            <p style={{ fontSize: 11, color: '#717a6d', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {route.route_name}
                                            </p>
                                            <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>
                                                {route.driver?.full_name || 'Unassigned'} · {route.ward}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 700, fontFamily: 'Manrope,sans-serif', background: route.status === 'active' ? '#f0fdf4' : '#fefce8', color: route.status === 'active' ? '#00450d' : '#d97706' }}>
                                                {route.status}
                                            </span>
                                            {loc ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <div className="live-dot" style={{ width: 5, height: 5 }} />
                                                    <span style={{ fontSize: 10, color: '#16a34a' }}>{lastSeenLabel(loc.updated_at)}</span>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: 10, color: '#94a3b8' }}>No GPS</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="progress-track">
                                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                                    </div>
                                    <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                                        {route.stops_completed}/{route.stops_total} stops · {progress}%
                                    </p>
                                </button>
                            )
                        })
                    )}
                </div>

                {/* Map + selected detail */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Map */}
                    <div className="card" style={{ height: 400, position: 'relative', overflow: 'hidden' }}>
                        {mapsError ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                                <span className="msf" style={{ color: '#94a3b8', fontSize: 40 }}>map</span>
                                <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '0 24px' }}>
                                    Google Maps unavailable. Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in Netlify.
                                </p>
                            </div>
                        ) : (
                            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                        )}
                        {/* Map legend */}
                        <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'white', borderRadius: 10, padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', display: 'flex', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00450d' }} />
                                <span style={{ fontSize: 10, color: '#64748b' }}>Active</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#d97706' }} />
                                <span style={{ fontSize: 10, color: '#64748b' }}>Pending</span>
                            </div>
                        </div>
                    </div>

                    {/* Selected route detail */}
                    {selectedRoute && (
                        <div className="card" style={{ padding: '16px 18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div>
                                    <p style={{ fontSize: 15, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 3px' }}>{selectedRoute.route_name}</p>
                                    <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>
                                        {selectedRoute.vehicle_number} · {selectedRoute.ward} · {selectedRoute.shift} shift
                                    </p>
                                </div>
                                {locations[selectedRoute.id] && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <div className="live-dot" />
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Live · {lastSeenLabel(locations[selectedRoute.id].updated_at)}</span>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                                {[
                                    { label: 'Driver', value: selectedRoute.driver?.full_name || 'Unassigned' },
                                    { label: 'Contractor', value: selectedRoute.contractor?.organisation_name || selectedRoute.contractor?.full_name || '—' },
                                    { label: 'Speed', value: locations[selectedRoute.id] ? `${locations[selectedRoute.id].speed_kmh} km/h` : '—' },
                                    { label: 'Progress', value: `${selectedRoute.stops_completed}/${selectedRoute.stops_total} stops` },
                                ].map(item => (
                                    <div key={item.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                                        <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px', fontFamily: 'Manrope,sans-serif' }}>{item.label}</p>
                                        <p style={{ fontSize: 12, fontWeight: 600, color: '#181c22', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                            {selectedRoute.stops_skipped > 0 && (
                                <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="msf" style={{ fontSize: 14, color: '#ba1a1a' }}>warning</span>
                                    <span style={{ fontSize: 12, color: '#ba1a1a', fontWeight: 600 }}>{selectedRoute.stops_skipped} stop{selectedRoute.stops_skipped > 1 ? 's' : ''} skipped on this route</span>
                                </div>
                            )}
                        </div>
                    )}

                    {!selectedRoute && !loading && routes.length > 0 && (
                        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                            <span className="msf" style={{ fontSize: 28, color: '#d1d5db', display: 'block', marginBottom: 8 }}>touch_app</span>
                            <p style={{ fontSize: 13, color: '#94a3b8' }}>Click a vehicle on the map or select a route to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}