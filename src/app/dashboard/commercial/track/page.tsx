'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const COMMERCIAL_NAV = [
    { label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' },
    { label: 'Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_month' },
    { label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' },
    { label: 'Bins', href: '/dashboard/commercial/bins', icon: 'delete' },
    { label: 'Collection History', href: '/dashboard/commercial/collection-history', icon: 'history' },
    { label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' },
    { label: 'Complaints', href: '/dashboard/commercial/complaints', icon: 'feedback' },
    { label: 'Rate Service', href: '/dashboard/commercial/feedback', icon: 'star' },
]

declare global {
    interface Window { google: any; initMap: () => void }
}

export default function CommercialTrackPage() {
    const [profile, setProfile] = useState<any>(null)
    const [routes, setRoutes] = useState<any[]>([])
    const [selectedRoute, setSelectedRoute] = useState<any>(null)
    const [vehicleLocation, setVehicleLocation] = useState<any>(null)
    const [collectionStops, setCollectionStops] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [mapLoaded, setMapLoaded] = useState(false)
    const [mapError, setMapError] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [eta, setEta] = useState<string | null>(null)

    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const vehicleMarkerRef = useRef<any>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const scriptRef = useRef(false)
    const mapTimerRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        loadData()
        // Timeout map loading after 8s to avoid infinite spinner
        mapTimerRef.current = setTimeout(() => {
            if (!mapLoaded) setMapError(true)
        }, 8000)
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (mapTimerRef.current) clearTimeout(mapTimerRef.current)
        }
    }, [])

    async function loadData() {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }
            const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            setProfile(p)
            if (!p) { setLoading(false); return }

            const today = new Date().toISOString().split('T')[0]
            const { data: routeData } = await supabase
                .from('routes').select('*').eq('ward', p.ward).eq('date', today)
                .in('status', ['active', 'in_progress']).order('created_at', { ascending: false })

            setRoutes(routeData ?? [])
            if (routeData && routeData.length > 0) await selectRoute(routeData[0], user.id, p)
        } catch (err: any) {
            console.error('Load error:', err)
        } finally {
            setLoading(false)
        }
    }

    async function selectRoute(route: any, userId?: string, profileData?: any) {
        setSelectedRoute(route)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const uid = userId || user?.id

        const { data: loc } = await supabase.from('vehicle_locations').select('*')
            .eq('route_id', route.id).order('updated_at', { ascending: false }).limit(1).maybeSingle()
        setVehicleLocation(loc)
        if (loc) setLastUpdated(new Date(loc.updated_at))

        const { data: stops } = await supabase.from('collection_stops').select('*')
            .eq('route_id', route.id).eq('commercial_id', uid).eq('is_commercial', true)
        setCollectionStops(stops ?? [])

        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = setInterval(async () => {
            const { data: fresh } = await supabase.from('vehicle_locations').select('*')
                .eq('route_id', route.id).order('updated_at', { ascending: false }).limit(1).maybeSingle()
            if (fresh) {
                setVehicleLocation(fresh)
                setLastUpdated(new Date(fresh.updated_at))
                updateVehicleMarker(fresh)
                computeEta(fresh, stops ?? [])
            }
        }, 10000)
    }

    function computeEta(loc: any, stops: any[]) {
        const myStop = stops.find(s => s.status !== 'completed' && s.status !== 'skipped')
        if (!myStop?.latitude || !myStop?.longitude) { setEta(null); return }
        const R = 6371
        const dLat = (myStop.latitude - loc.latitude) * Math.PI / 180
        const dLon = (myStop.longitude - loc.longitude) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(loc.latitude * Math.PI / 180) * Math.cos(myStop.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const speed = loc.speed > 1 ? loc.speed : 20
        const mins = Math.round((dist / speed) * 60)
        setEta(mins <= 1 ? 'Arriving now' : mins < 60 ? `~${mins} min` : `~${Math.round(mins / 60)}h`)
    }

    function updateVehicleMarker(loc: any) {
        if (!mapInstanceRef.current || !loc) return
        const pos = { lat: loc.latitude, lng: loc.longitude }
        if (vehicleMarkerRef.current) {
            vehicleMarkerRef.current.setPosition(pos)
            vehicleMarkerRef.current.setIcon({ ...vehicleMarkerRef.current.getIcon(), rotation: loc.heading || 0 })
        } else createVehicleMarker(loc)
    }

    function createVehicleMarker(loc: any) {
        vehicleMarkerRef.current = new window.google.maps.Marker({
            position: { lat: loc.latitude, lng: loc.longitude },
            map: mapInstanceRef.current,
            title: 'Collection Vehicle',
            icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 7, fillColor: '#00450d', fillOpacity: 1, strokeColor: 'white', strokeWeight: 2, rotation: loc.heading || 0 },
        })
    }

    const initMap = useCallback((loc: any, stops: any[]) => {
        if (!mapRef.current || !window.google) return
        const center = loc ? { lat: loc.latitude, lng: loc.longitude }
            : stops.length > 0 && stops[0].latitude ? { lat: stops[0].latitude, lng: stops[0].longitude }
                : { lat: 6.9271, lng: 79.8612 }

        const map = new window.google.maps.Map(mapRef.current, {
            zoom: 15, center,
            mapTypeControl: false, fullscreenControl: true, streetViewControl: false,
            zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
            styles: [
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] },
                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
                { featureType: 'water', stylers: [{ color: '#c8e6f5' }] },
                { featureType: 'landscape', stylers: [{ color: '#f9f9f9' }] },
            ],
        })
        mapInstanceRef.current = map
        if (loc) createVehicleMarker(loc)

        stops.forEach(stop => {
            if (!stop.latitude || !stop.longitude) return
            const isCompleted = stop.status === 'completed'
            new window.google.maps.Marker({
                position: { lat: stop.latitude, lng: stop.longitude },
                map,
                title: stop.road_name || stop.address || 'Your stop',
                icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: isCompleted ? '#16a34a' : '#f59e0b', fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 },
            })
        })
        setMapLoaded(true)
        if (mapTimerRef.current) clearTimeout(mapTimerRef.current)
    }, [])

    useEffect(() => {
        if (scriptRef.current) return
        scriptRef.current = true
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) { setMapError(true); return }
        window.initMap = () => initMap(vehicleLocation, collectionStops)
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`
        script.async = true; script.defer = true
        script.onerror = () => setMapError(true)
        document.head.appendChild(script)
    }, [])

    useEffect(() => {
        if (window.google && mapRef.current && (vehicleLocation || collectionStops.length > 0)) {
            initMap(vehicleLocation, collectionStops)
        }
    }, [vehicleLocation, collectionStops, initMap])

    const myNextStop = collectionStops.find(s => s.status !== 'completed' && s.status !== 'skipped')
    const completedStops = collectionStops.filter(s => s.status === 'completed').length
    const isCollectionDay = routes.length > 0

    function fTime(d: Date | null) {
        if (!d) return '—'
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <DashboardLayout
            role="Commercial"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={COMMERCIAL_NAV}
            primaryAction={{ label: 'Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_month' }}
        >
            <style>{`
                .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
                .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
                .pulse-dot { width:8px; height:8px; border-radius:50%; background:#16a34a; animation:pls 2s infinite; }
                .pulse-dot.off { background:#94a3b8; animation:none; }
                @keyframes pls { 0%{box-shadow:0 0 0 0 rgba(22,163,74,0.4)} 70%{box-shadow:0 0 0 8px rgba(22,163,74,0)} 100%{box-shadow:0 0 0 0 rgba(22,163,74,0)} }
                .stop-item { display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid rgba(0,69,13,0.05); }
                .stop-item:last-child { border-bottom:none; }
                .chip { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; border:1px solid transparent; }
                .route-btn { width:100%; display:flex; align-items:center; gap:12px; padding:12px 20px; background:white; border:none; cursor:pointer; text-align:left; transition:background 0.15s; border-bottom:1px solid rgba(0,69,13,0.05); }
                .route-btn:hover { background:#f0fdf4; }
                .route-btn:last-child { border-bottom:none; }
                .map-container { position:relative; border-radius:0; overflow:hidden; }
                .map-overlay { position:absolute; top:16px; left:16px; z-index:10; }
                .map-legend { position:absolute; bottom:16px; left:16px; z-index:10; background:white; border-radius:12px; padding:10px 14px; box-shadow:0 2px 12px rgba(0,0,0,0.12); display:flex; align-items:center; gap:16px; }
                @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
                .a1{animation:fadeUp 0.4s ease 0.05s both}
                .a2{animation:fadeUp 0.4s ease 0.1s both}
                .a3{animation:fadeUp 0.4s ease 0.15s both}
            `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Live Tracking · ClearPath
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif' }}>
                        Track <span style={{ color: '#00450d' }}>Vehicle</span>
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className={`pulse-dot ${vehicleLocation ? '' : 'off'}`} />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: vehicleLocation ? '#00450d' : '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>
                            {vehicleLocation ? `Live · ${fTime(lastUpdated)}` : isCollectionDay ? 'No vehicle signal' : 'No collection today'}
                        </span>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #00450d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* No collection today */}
                    {!isCollectionDay && (
                        <div className="a1" style={{ borderRadius: '20px', padding: '40px', background: 'white', border: '1px solid rgba(0,69,13,0.06)', marginBottom: '20px', textAlign: 'center' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <span className="msf" style={{ fontSize: '32px', color: '#cbd5e1' }}>directions_bus</span>
                            </div>
                            <p style={{ fontSize: '17px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: '8px' }}>No active collection today</p>
                            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px', maxWidth: '360px', margin: '0 auto 20px' }}>
                                No routes are active in your ward right now. Check your schedule to see upcoming collection days.
                            </p>
                            <a href="/dashboard/commercial/schedule"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '99px', background: '#00450d', color: 'white', textDecoration: 'none', fontSize: '13px', fontWeight: 700, fontFamily: 'Manrope,sans-serif' }}>
                                <span className="msf" style={{ fontSize: '16px' }}>calendar_month</span>
                                View schedule
                            </a>
                        </div>
                    )}

                    {/* ETA banner — when vehicle is live */}
                    {vehicleLocation && (
                        <div className="a2" style={{ borderRadius: '20px', background: '#00450d', color: 'white', padding: '24px 28px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(163,246,156,0.07)' }} />
                            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="msf" style={{ fontSize: '28px' }}>local_shipping</span>
                            </div>
                            <div style={{ flex: 1, zIndex: 1 }}>
                                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(163,246,156,0.7)', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Vehicle en route
                                </p>
                                <p style={{ fontSize: '26px', fontWeight: 900, fontFamily: 'Manrope,sans-serif', lineHeight: 1, marginBottom: '4px' }}>
                                    {eta ?? 'Calculating ETA...'}
                                </p>
                                <p style={{ fontSize: '13px', color: 'rgba(163,246,156,0.75)' }}>
                                    {myNextStop ? `Heading to ${myNextStop.road_name || myNextStop.address || 'your stop'}`
                                        : completedStops > 0 ? 'Your stop has been collected today'
                                            : 'Vehicle is active in your ward'}
                                </p>
                            </div>
                            {selectedRoute && (
                                <div style={{ textAlign: 'right', zIndex: 1, flexShrink: 0 }}>
                                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: 'Manrope,sans-serif' }}>
                                        {selectedRoute.vehicle_number || 'Vehicle'}
                                    </p>
                                    <p style={{ fontSize: '11px', color: 'rgba(163,246,156,0.6)' }}>
                                        {selectedRoute.shift && `${selectedRoute.shift} shift`}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Main layout: map + sidebar */}
                    <div className="a2" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', marginBottom: '20px' }}>

                        {/* Map — hero */}
                        <div className="card map-container" style={{ height: '520px' }}>
                            <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#f1f5f9' }}>
                                {!mapLoaded && !mapError && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #00450d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                                        <p style={{ fontSize: '13px', color: '#94a3b8' }}>Loading map...</p>
                                    </div>
                                )}
                                {mapError && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', padding: '24px', textAlign: 'center' }}>
                                        <span className="msf" style={{ fontSize: '48px', color: '#e2e8f0' }}>map</span>
                                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>Map unavailable</p>
                                        <p style={{ fontSize: '12px', color: '#94a3b8' }}>Check your Google Maps API key in .env.local</p>
                                    </div>
                                )}
                            </div>

                            {/* Map legend */}
                            {mapLoaded && (
                                <div className="map-legend">
                                    {[
                                        { color: '#00450d', label: 'Vehicle' },
                                        { color: '#f59e0b', label: 'Pending' },
                                        { color: '#16a34a', label: 'Collected' },
                                    ].map(item => (
                                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, border: '1.5px solid white', boxShadow: `0 0 0 1px ${item.color}` }} />
                                            <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'Manrope,sans-serif', fontWeight: 600 }}>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Sidebar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Vehicle status */}
                            <div className="card" style={{ padding: '20px' }}>
                                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '12px' }}>
                                    Vehicle Status
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {[
                                        { label: 'Status', value: vehicleLocation ? 'Active' : 'No signal', color: vehicleLocation ? '#00450d' : '#94a3b8' },
                                        { label: 'Speed', value: vehicleLocation ? (vehicleLocation.speed > 0.5 ? `${Math.round(vehicleLocation.speed)} km/h` : 'Stationary') : '—', color: '#181c22' },
                                        { label: 'Updated', value: lastUpdated ? fTime(lastUpdated) : '—', color: '#181c22' },
                                        { label: 'Routes today', value: `${routes.length}`, color: '#181c22' },
                                    ].map(item => (
                                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{item.label}</span>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: item.color, fontFamily: 'Manrope,sans-serif' }}>{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Your stops progress */}
                            <div className="card" style={{ padding: '20px', flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase' }}>
                                        Your Stops
                                    </p>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>
                                        {completedStops}/{collectionStops.length}
                                    </span>
                                </div>

                                {collectionStops.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                        <span className="msf" style={{ fontSize: '28px', color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>location_off</span>
                                        <p style={{ fontSize: '12px', color: '#94a3b8' }}>No stops on today's route</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Progress bar */}
                                        <div style={{ height: '4px', borderRadius: '99px', background: '#f0f0f0', marginBottom: '14px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: '99px', background: '#00450d', width: `${collectionStops.length > 0 ? (completedStops / collectionStops.length) * 100 : 0}%`, transition: 'width 0.5s ease' }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {collectionStops.map((stop, i) => {
                                                const isCompleted = stop.status === 'completed'
                                                const isSkipped = stop.status === 'skipped'
                                                const isNext = !isCompleted && !isSkipped && collectionStops.slice(0, i).every(s => s.status === 'completed')
                                                return (
                                                    <div key={stop.id} className="stop-item">
                                                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCompleted ? '#f0fdf4' : isSkipped ? '#fef2f2' : isNext ? '#fffbeb' : '#f8fafc', border: `1px solid ${isCompleted ? '#bbf7d0' : isSkipped ? '#fecaca' : isNext ? '#fde68a' : '#e2e8f0'}` }}>
                                                            <span className="msf" style={{ fontSize: '14px', color: isCompleted ? '#00450d' : isSkipped ? '#ba1a1a' : isNext ? '#d97706' : '#cbd5e1' }}>
                                                                {isCompleted ? 'check_circle' : isSkipped ? 'cancel' : isNext ? 'pending' : 'radio_button_unchecked'}
                                                            </span>
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#181c22', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {stop.road_name || stop.address || `Stop ${i + 1}`}
                                                            </p>
                                                            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>
                                                                {stop.waste_type || 'General'}{stop.bin_size ? ` · ${stop.bin_size}` : ''}
                                                            </p>
                                                        </div>
                                                        {isNext && <span className="chip" style={{ background: '#fffbeb', color: '#d97706', borderColor: '#fde68a', flexShrink: 0 }}>Next</span>}
                                                        {isCompleted && stop.blockchain_tx && (
                                                            <a href={`https://amoy.polygonscan.com/tx/${stop.blockchain_tx}`} target="_blank" rel="noopener noreferrer"
                                                                className="chip" style={{ background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe', textDecoration: 'none', flexShrink: 0 }}>
                                                                ↗
                                                            </a>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Route selector — only if multiple routes */}
                    {routes.length > 1 && (
                        <div className="card a3">
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>Active Routes Today</p>
                            </div>
                            {routes.map(route => (
                                <button key={route.id} className="route-btn" onClick={() => selectRoute(route)}
                                    style={{ background: selectedRoute?.id === route.id ? '#f0fdf4' : 'white' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: selectedRoute?.id === route.id ? '#00450d' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="msf" style={{ fontSize: '16px', color: selectedRoute?.id === route.id ? 'white' : '#00450d' }}>route</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22' }}>{route.route_name || 'Unnamed route'}</p>
                                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                            {route.vehicle_number && `${route.vehicle_number} · `}{route.shift && `${route.shift} shift`}
                                        </p>
                                    </div>
                                    {selectedRoute?.id === route.id && (
                                        <span className="chip" style={{ background: '#f0fdf4', color: '#00450d', borderColor: '#bbf7d0' }}>Tracking</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Footer note */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '12px 0' }}>
                        <span className="msf" style={{ color: '#7c3aed', fontSize: '14px' }}>verified</span>
                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>Collections verified on Polygon Amoy · Location updates every 10 seconds · CMC EcoLedger 2026</p>
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}