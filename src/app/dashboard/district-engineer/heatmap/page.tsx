'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
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
]

// Colombo ward coordinates
const WARD_COORDS: Record<string, { lat: number; lng: number }> = {
    // District 1 - Colombo North
    'Mattakkuliya': { lat: 6.9720, lng: 79.8755 },
    'Modara': { lat: 6.9680, lng: 79.8720 },
    'Kotahena': { lat: 6.9560, lng: 79.8640 },
    'Grandpass': { lat: 6.9480, lng: 79.8680 },
    'Maligawatta': { lat: 6.9440, lng: 79.8600 },
    'Aluthkade': { lat: 6.9390, lng: 79.8580 },
    // District 2 - Colombo Central
    'Pettah': { lat: 6.9350, lng: 79.8516 },
    'Fort': { lat: 6.9344, lng: 79.8428 },
    'Slave Island': { lat: 6.9230, lng: 79.8480 },
    'Kollupitiya': { lat: 6.9100, lng: 79.8490 },
    // District 3 - Colombo South
    'Bambalapitiya': { lat: 6.8980, lng: 79.8530 },
    'Wellawatta': { lat: 6.8830, lng: 79.8610 },
    'Dehiwala': { lat: 6.8670, lng: 79.8640 },
    'Borella': { lat: 6.9200, lng: 79.8760 },
    // District 4 - Colombo East  
    'Cinnamon Gardens': { lat: 6.9060, lng: 79.8630 },
    'Thurstan': { lat: 6.9150, lng: 79.8640 },
    'Narahenpita': { lat: 6.9010, lng: 79.8760 },
    'Kirulapone': { lat: 6.8890, lng: 79.8780 },
    'Havelock Town': { lat: 6.8970, lng: 79.8650 },
    // Fallback - Colombo city center
    'Default': { lat: 6.9271, lng: 79.8612 },
}

function getWardCoords(ward: string): { lat: number; lng: number } {
    if (WARD_COORDS[ward]) return WARD_COORDS[ward]
    // Fuzzy match
    const key = Object.keys(WARD_COORDS).find(k => ward.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(ward.toLowerCase()))
    return key ? WARD_COORDS[key] : WARD_COORDS['Default']
}

interface RouteData {
    id: string
    route_name: string
    ward: string
    shift: string
    status: string
    date: string
    driver_name: string | null
    vehicle_number: string | null
    contractor_name: string | null
    total_stops: number
    completed_stops: number
    skipped_stops: number
    schedule_waste_type: string | null
    schedule_time: string | null
}

declare global {
    interface Window {
        google: any
        initMap: () => void
    }
}

export default function DECollectionMapPage() {
    const [profile, setProfile] = useState<any>(null)
    const [routes, setRoutes] = useState<RouteData[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null)
    const [mapLoaded, setMapLoaded] = useState(false)
    const [lastRefresh, setLastRefresh] = useState(new Date())
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const markersRef = useRef<any[]>([])
    const infoWindowRef = useRef<any>(null)

    useEffect(() => { loadData() }, [])

    // Auto-refresh every 60 seconds
    useEffect(() => {
        const interval = setInterval(() => { loadData(); setLastRefresh(new Date()) }, 60000)
        return () => clearInterval(interval)
    }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const today = new Date().toISOString().split('T')[0]

        // Get today's routes for this district
        const { data: routesData } = await supabase
            .from('routes')
            .select(`
        id, route_name, ward, shift, status, date, vehicle_number,
        driver:profiles!driver_id(full_name),
        contractor:profiles!contractor_id(full_name, organisation_name),
        collection_stops(id, status),
        schedule:schedules!schedule_id(waste_type, custom_waste_type, collection_time)
      `)
            .eq('district', p?.district || '')
            .gte('date', today)
            .order('date', { ascending: true })

        const mapped: RouteData[] = (routesData || []).map((r: any) => {
            const stops = r.collection_stops || []
            return {
                id: r.id,
                route_name: r.route_name,
                ward: r.ward || 'Unknown',
                shift: r.shift,
                status: r.status,
                date: r.date,
                driver_name: r.driver?.full_name || null,
                vehicle_number: r.vehicle_number || null,
                contractor_name: r.contractor?.organisation_name || r.contractor?.full_name || null,
                total_stops: stops.length,
                completed_stops: stops.filter((s: any) => s.status === 'completed').length,
                skipped_stops: stops.filter((s: any) => s.status === 'skipped').length,
                schedule_waste_type: r.schedule?.custom_waste_type || r.schedule?.waste_type || null,
                schedule_time: r.schedule?.collection_time || null,
            }
        })
        setRoutes(mapped)
        setLoading(false)

        // Update map markers if map is loaded
        if (mapInstanceRef.current) updateMarkers(mapped)
    }

    // Load Google Maps
    useEffect(() => {
        if (window.google?.maps) { setMapLoaded(true); return }
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) { console.warn('Google Maps API key not found'); return }

        window.initMap = () => setMapLoaded(true)
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap&libraries=marker`
        script.async = true
        script.defer = true
        document.head.appendChild(script)
        return () => { document.head.removeChild(script); (window as any).initMap = undefined }
    }, [])

    // Init map once loaded
    useEffect(() => {
        if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return
        const center = profile?.district?.includes('District 1') ? { lat: 6.9550, lng: 79.8700 }
            : profile?.district?.includes('District 2') ? { lat: 6.9300, lng: 79.8500 }
                : profile?.district?.includes('District 3') ? { lat: 6.8900, lng: 79.8580 }
                    : { lat: 6.9271, lng: 79.8612 }

        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
            center, zoom: 13,
            styles: [
                { featureType: 'all', elementType: 'geometry', stylers: [{ saturation: -20 }] },
                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
                { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e8f4f8' }] },
                { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e8f5e9' }] },
                { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            ],
            mapTypeControl: false, streetViewControl: false,
            fullscreenControl: true, zoomControl: true,
        })
        infoWindowRef.current = new window.google.maps.InfoWindow()
        if (routes.length > 0) updateMarkers(routes)
    }, [mapLoaded, profile])

    function getMarkerColor(route: RouteData): string {
        if (route.status === 'completed') return '#00450d'
        if (!route.driver_name || !route.vehicle_number) return '#ba1a1a'
        const progress = route.total_stops > 0 ? route.completed_stops / route.total_stops : 0
        if (progress > 0) return '#1d4ed8'
        return '#d97706'
    }

    function getStatusLabel(route: RouteData): string {
        if (route.status === 'completed') return 'Completed'
        if (!route.driver_name) return 'Unassigned'
        const progress = route.total_stops > 0 ? route.completed_stops / route.total_stops : 0
        if (progress > 0) return 'In Progress'
        return 'Pending'
    }

    function updateMarkers(routeList: RouteData[]) {
        // Clear existing markers
        markersRef.current.forEach(m => m.setMap(null))
        markersRef.current = []
        if (!mapInstanceRef.current || !window.google?.maps) return

        routeList.forEach(route => {
            const coords = getWardCoords(route.ward)
            const color = getMarkerColor(route)
            const progress = route.total_stops > 0 ? Math.round((route.completed_stops / route.total_stops) * 100) : 0

            // Custom SVG marker
            const svgMarker = {
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 3,
                scale: route.status === 'completed' ? 10 : 13,
            }

            const marker = new window.google.maps.Marker({
                position: coords,
                map: mapInstanceRef.current,
                icon: svgMarker,
                title: route.route_name,
                zIndex: route.status === 'completed' ? 1 : 10,
            })

            // Info window content
            const wasteLabel = route.schedule_waste_type?.replace('_', ' ') || 'Mixed'
            const infoContent = `
        <div style="font-family:'Manrope',sans-serif;padding:4px;min-width:220px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
            <strong style="font-size:14px;color:#181c22">${route.route_name}</strong>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
            <div style="background:#f8fafc;border-radius:8px;padding:8px">
              <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin:0 0 2px">Status</p>
              <p style="font-size:12px;font-weight:700;color:${color};margin:0">${getStatusLabel(route)}</p>
            </div>
            <div style="background:#f8fafc;border-radius:8px;padding:8px">
              <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin:0 0 2px">Progress</p>
              <p style="font-size:12px;font-weight:700;color:#181c22;margin:0">${route.completed_stops}/${route.total_stops} stops</p>
            </div>
          </div>
          ${route.driver_name ? `<p style="font-size:11px;color:#64748b;margin:0 0 3px">👤 ${route.driver_name}</p>` : '<p style="font-size:11px;color:#ba1a1a;margin:0 0 3px">⚠ No driver assigned</p>'}
          ${route.vehicle_number ? `<p style="font-size:11px;color:#64748b;margin:0 0 3px">🚛 ${route.vehicle_number}</p>` : ''}
          <p style="font-size:11px;color:#64748b;margin:0 0 3px">📍 ${route.ward}</p>
          <p style="font-size:11px;color:#64748b;margin:0">♻ ${wasteLabel}${route.schedule_time ? ' · ' + route.schedule_time : ''}</p>
          ${route.total_stops > 0 ? `
            <div style="margin-top:10px">
              <div style="height:5px;background:#f0f0f0;border-radius:99px;overflow:hidden">
                <div style="height:100%;width:${progress}%;background:${color};border-radius:99px"></div>
              </div>
              <p style="font-size:10px;color:#94a3b8;margin:4px 0 0;text-align:right">${progress}% complete</p>
            </div>` : ''}
        </div>
      `

            marker.addListener('click', () => {
                infoWindowRef.current.setContent(infoContent)
                infoWindowRef.current.open(mapInstanceRef.current, marker)
                setSelectedRoute(route)
            })

            markersRef.current.push(marker)
        })
    }

    // Update markers when routes change
    useEffect(() => {
        if (mapInstanceRef.current && routes.length > 0) updateMarkers(routes)
    }, [routes])

    const activeRoutes = routes.filter(r => r.status !== 'completed')
    const completedRoutes = routes.filter(r => r.status === 'completed')
    const unassigned = routes.filter(r => !r.driver_name || !r.vehicle_number)
    const inProgress = routes.filter(r => r.completed_stops > 0 && r.status !== 'completed')

    return (
        <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}>
            <style>{`
        .msym { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msym-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:16px; border:1px solid rgba(0,69,13,0.07); box-shadow:0 1px 3px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.04); overflow:hidden; }
        .route-row { padding:12px 16px; border-bottom:1px solid rgba(0,69,13,0.05); cursor:pointer; transition:background 0.15s; display:flex; align-items:center; gap:10px; }
        .route-row:hover { background:#f9fdf9; }
        .route-row.selected { background:#f0fdf4; }
        .route-row:last-child { border-bottom:none; }
        .badge { display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.04em; text-transform:uppercase; white-space:nowrap; }
        .progress-track { height:4px; background:#f1f5f9; border-radius:99px; overflow:hidden; flex:1; }
        .progress-fill { height:100%; border-radius:99px; transition:width 0.5s ease; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .1s both} .a3{animation:fadeUp .4s ease .16s both}
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>
                    District Engineering
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <h1 style={{ fontSize: 38, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: 0, letterSpacing: '-0.02em' }}>
                        Collection <span style={{ color: '#1b5e20' }}>Tracking</span>
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.12)' }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00450d', animation: 'pulse 2s infinite' }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>
                                Live · {new Date(lastRefresh).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <button onClick={() => { loadData(); setLastRefresh(new Date()) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, background: 'white', border: '1.5px solid rgba(0,69,13,0.15)', color: '#00450d', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer' }}>
                            <span className="msym" style={{ fontSize: 15 }}>refresh</span>Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats row */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Total Routes', value: routes.length, color: '#00450d', bg: '#f0fdf4', icon: 'route' },
                    { label: 'In Progress', value: inProgress.length, color: '#1d4ed8', bg: '#eff6ff', icon: 'directions_car' },
                    { label: 'Unassigned', value: unassigned.length, color: '#d97706', bg: '#fefce8', icon: 'warning' },
                    { label: 'Completed', value: completedRoutes.length, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                ].map(m => (
                    <div key={m.label} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msym-fill" style={{ color: m.color, fontSize: 17 }}>{m.icon}</span>
                        </div>
                        <div>
                            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 24, color: '#181c22', margin: 0, lineHeight: 1 }}>{m.value}</p>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0, marginTop: 3 }}>{m.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Map + sidebar */}
            <div className="a3" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>

                {/* Map */}
                <div className="card" style={{ overflow: 'hidden' }}>
                    {/* Map legend */}
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: '#fafdf9' }}>
                        {[
                            { color: '#1d4ed8', label: 'In Progress' },
                            { color: '#d97706', label: 'Pending' },
                            { color: '#ba1a1a', label: 'Unassigned' },
                            { color: '#00450d', label: 'Completed' },
                        ].map(l => (
                            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, border: '2px solid white', boxShadow: `0 0 0 1px ${l.color}` }} />
                                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{l.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Google Map */}
                    {!mapLoaded ? (
                        <div style={{ height: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: 12 }}>
                            <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                            <p style={{ fontSize: 13, color: '#94a3b8' }}>Loading map…</p>
                        </div>
                    ) : (
                        <div ref={mapRef} style={{ height: 520 }} />
                    )}

                    {routes.length === 0 && !loading && (
                        <div style={{ padding: '20px', background: 'rgba(255,255,255,0.9)', textAlign: 'center', borderTop: '1px solid rgba(0,69,13,0.06)' }}>
                            <p style={{ fontSize: 13, color: '#94a3b8' }}>No routes scheduled for today in {profile?.district}</p>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="card">
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>
                            Today's Routes
                        </h3>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{routes.length} total</span>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                            <div style={{ width: 22, height: 22, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                        </div>
                    ) : routes.length === 0 ? (
                        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                            <span className="msym" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 8 }}>route</span>
                            <p style={{ fontSize: 13, color: '#94a3b8' }}>No routes today</p>
                        </div>
                    ) : (
                        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                            {routes.map(route => {
                                const color = getMarkerColor(route)
                                const statusLabel = getStatusLabel(route)
                                const progress = route.total_stops > 0 ? Math.round((route.completed_stops / route.total_stops) * 100) : 0
                                const isSelected = selectedRoute?.id === route.id

                                return (
                                    <div key={route.id} className={`route-row ${isSelected ? 'selected' : ''}`}
                                        onClick={() => {
                                            setSelectedRoute(route)
                                            // Pan map to route's ward
                                            if (mapInstanceRef.current) {
                                                const coords = getWardCoords(route.ward)
                                                mapInstanceRef.current.panTo(coords)
                                                mapInstanceRef.current.setZoom(15)
                                                // Open marker info window
                                                const marker = markersRef.current[routes.indexOf(route)]
                                                if (marker && infoWindowRef.current) {
                                                    window.google.maps.event.trigger(marker, 'click')
                                                }
                                            }
                                        }}>
                                        {/* Status dot */}
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 0 2px white, 0 0 0 3px ${color}` }} />

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                                                    {route.route_name}
                                                </p>
                                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: color + '15', color: color, fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                                                    {statusLabel}
                                                </span>
                                            </div>

                                            <p style={{ fontSize: 11, color: '#717a6d', margin: '0 0 5px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span className="msym" style={{ fontSize: 12 }}>location_on</span>
                                                {route.ward}
                                                {route.schedule_time && <> · {route.schedule_time}</>}
                                            </p>

                                            {/* Progress bar */}
                                            {route.total_stops > 0 && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div className="progress-track">
                                                        <div className="progress-fill" style={{ width: `${progress}%`, background: color }} />
                                                    </div>
                                                    <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>{progress}%</span>
                                                </div>
                                            )}

                                            {/* Driver / vehicle */}
                                            <div style={{ marginTop: 4, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                                {route.driver_name
                                                    ? <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}><span className="msym" style={{ fontSize: 10 }}>person</span>{route.driver_name.split(' ')[0]}</span>
                                                    : <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>No driver</span>
                                                }
                                                {route.vehicle_number && (
                                                    <span className="badge" style={{ background: '#f8fafc', color: '#64748b' }}><span className="msym" style={{ fontSize: 10 }}>local_shipping</span>{route.vehicle_number}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Selected route detail */}
                    {selectedRoute && (
                        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9fdf9' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>Selected Route</p>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 6 }}>{selectedRoute.route_name}</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {[
                                    { label: 'Completed', value: selectedRoute.completed_stops, color: '#00450d' },
                                    { label: 'Skipped', value: selectedRoute.skipped_stops, color: '#ba1a1a' },
                                    { label: 'Remaining', value: selectedRoute.total_stops - selectedRoute.completed_stops - selectedRoute.skipped_stops, color: '#d97706' },
                                    { label: 'Total', value: selectedRoute.total_stops, color: '#374151' },
                                ].map(s => (
                                    <div key={s.label} style={{ background: 'white', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(0,69,13,0.07)' }}>
                                        <p style={{ fontSize: 18, fontWeight: 900, color: s.color, fontFamily: 'Manrope,sans-serif', margin: 0, lineHeight: 1 }}>{s.value}</p>
                                        <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Manrope,sans-serif', margin: '3px 0 0' }}>{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}