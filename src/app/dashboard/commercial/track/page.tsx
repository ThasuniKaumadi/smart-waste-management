'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const COMMERCIAL_NAV = [
    { label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' },
    { label: 'Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_month' },
    { label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' },
    { label: 'Complaints', href: '/dashboard/commercial/complaints', icon: 'feedback' },
    { label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' },
    { label: 'Bins', href: '/dashboard/commercial/bins', icon: 'delete' },
    { label: 'Collection History', href: '/dashboard/commercial/collection-history', icon: 'history' },
]

declare global {
    interface Window {
        google: any
        initMap: () => void
    }
}

export default function CommercialTrackPage() {
    const [profile, setProfile] = useState<any>(null)
    const [routes, setRoutes] = useState<any[]>([])
    const [selectedRoute, setSelectedRoute] = useState<any>(null)
    const [vehicleLocation, setVehicleLocation] = useState<any>(null)
    const [collectionStops, setCollectionStops] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [mapLoaded, setMapLoaded] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [eta, setEta] = useState<string | null>(null)

    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const vehicleMarkerRef = useRef<any>(null)
    const myStopMarkerRef = useRef<any>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const scriptRef = useRef(false)

    useEffect(() => {
        loadData()
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [])

    async function loadData() {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data: p } = await supabase
                .from('profiles').select('*').eq('id', user.id).single()
            setProfile(p)
            if (!p) { setLoading(false); return }

            // Get today's active routes in user's ward
            const today = new Date().toISOString().split('T')[0]
            const { data: routeData } = await supabase
                .from('routes')
                .select('*')
                .eq('ward', p.ward)
                .eq('date', today)
                .in('status', ['active', 'in_progress'])
                .order('created_at', { ascending: false })

            setRoutes(routeData ?? [])

            // Auto-select first route
            if (routeData && routeData.length > 0) {
                await selectRoute(routeData[0], user.id, p)
            }
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
        const prof = profileData || profile

        // Fetch vehicle location for this route
        const { data: loc } = await supabase
            .from('vehicle_locations')
            .select('*')
            .eq('route_id', route.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        setVehicleLocation(loc)
        if (loc) setLastUpdated(new Date(loc.updated_at))

        // Fetch commercial stops for this route belonging to this user
        const { data: stops } = await supabase
            .from('collection_stops')
            .select('*')
            .eq('route_id', route.id)
            .eq('commercial_id', uid)
            .eq('is_commercial', true)

        setCollectionStops(stops ?? [])

        // Start polling for location updates
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = setInterval(async () => {
            const { data: fresh } = await supabase
                .from('vehicle_locations')
                .select('*')
                .eq('route_id', route.id)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (fresh) {
                setVehicleLocation(fresh)
                setLastUpdated(new Date(fresh.updated_at))
                updateVehicleMarker(fresh)
                computeEta(fresh, stops ?? [])
            }
        }, 10000) // poll every 10 seconds
    }

    function computeEta(loc: any, stops: any[]) {
        const myStop = stops.find(s => s.status !== 'completed' && s.status !== 'skipped')
        if (!myStop || !myStop.latitude || !myStop.longitude) { setEta(null); return }

        // Haversine distance estimate
        const R = 6371
        const dLat = (myStop.latitude - loc.latitude) * Math.PI / 180
        const dLon = (myStop.longitude - loc.longitude) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(loc.latitude * Math.PI / 180) *
            Math.cos(myStop.latitude * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const speed = loc.speed && loc.speed > 1 ? loc.speed : 20 // km/h fallback
        const minutes = Math.round((dist / speed) * 60)
        setEta(minutes <= 1 ? 'Arriving now' : minutes < 60 ? `~${minutes} min away` : `~${Math.round(minutes / 60)}h away`)
    }

    function updateVehicleMarker(loc: any) {
        if (!mapInstanceRef.current || !loc) return
        const pos = { lat: loc.latitude, lng: loc.longitude }
        if (vehicleMarkerRef.current) {
            vehicleMarkerRef.current.setPosition(pos)
        } else {
            vehicleMarkerRef.current = new window.google.maps.Marker({
                position: pos,
                map: mapInstanceRef.current,
                title: 'Collection Vehicle',
                icon: {
                    path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 6,
                    fillColor: '#00450d',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                    rotation: loc.heading || 0,
                },
            })
        }
    }

    const initMap = useCallback((loc: any, stops: any[]) => {
        if (!mapRef.current || !window.google) return

        const center = loc
            ? { lat: loc.latitude, lng: loc.longitude }
            : stops.length > 0 && stops[0].latitude
                ? { lat: stops[0].latitude, lng: stops[0].longitude }
                : { lat: 6.9271, lng: 79.8612 } // Colombo default

        const map = new window.google.maps.Map(mapRef.current, {
            zoom: 15,
            center,
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            styles: [
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            ],
        })
        mapInstanceRef.current = map

        // Vehicle marker
        if (loc) {
            vehicleMarkerRef.current = new window.google.maps.Marker({
                position: { lat: loc.latitude, lng: loc.longitude },
                map,
                title: 'Collection Vehicle',
                icon: {
                    path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 6,
                    fillColor: '#00450d',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                    rotation: loc.heading || 0,
                },
            })
        }

        // My stop markers
        stops.forEach((stop, i) => {
            if (!stop.latitude || !stop.longitude) return
            const isCompleted = stop.status === 'completed'
            new window.google.maps.Marker({
                position: { lat: stop.latitude, lng: stop.longitude },
                map,
                title: stop.road_name || stop.address || `Your stop`,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: isCompleted ? '#16a34a' : '#f59e0b',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                },
                label: {
                    text: isCompleted ? '✓' : '●',
                    color: 'white',
                    fontSize: '10px',
                },
            })
        })

        setMapLoaded(true)
    }, [])

    // Load Google Maps script
    useEffect(() => {
        if (scriptRef.current) return
        scriptRef.current = true

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) {
            console.error('Google Maps API key not found')
            return
        }

        window.initMap = () => {
            initMap(vehicleLocation, collectionStops)
        }

        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`
        script.async = true
        script.defer = true
        document.head.appendChild(script)
    }, [])

    // Re-init map when data loads
    useEffect(() => {
        if (window.google && mapRef.current && (vehicleLocation || collectionStops.length > 0)) {
            initMap(vehicleLocation, collectionStops)
        }
    }, [vehicleLocation, collectionStops, initMap])

    function formatTime(date: Date | null) {
        if (!date) return '—'
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }

    function formatSpeed(speed: number | null) {
        if (!speed || speed < 0.5) return 'Stationary'
        return `${Math.round(speed)} km/h`
    }

    const myNextStop = collectionStops.find(s => s.status !== 'completed' && s.status !== 'skipped')
    const completedStops = collectionStops.filter(s => s.status === 'completed').length
    const isCollectionDay = routes.length > 0

    return (
        <DashboardLayout
            role="Commercial"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={COMMERCIAL_NAV}
            primaryAction={{ label: 'View Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_month' }}
        >
            <style>{`
                .material-symbols-outlined {
                    font-family: 'Material Symbols Outlined';
                    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                    display: inline-block; vertical-align: middle; line-height: 1;
                }
                .font-headline { font-family: 'Manrope', sans-serif; }
                .bento-card {
                    background: white; border-radius: 16px;
                    box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
                    border: 1px solid rgba(0,69,13,0.04); overflow: hidden;
                }
                .bento-card-green {
                    background: #00450d; border-radius: 16px; color: white;
                    overflow: hidden; position: relative;
                }
                .stat-row {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 12px 0; border-bottom: 1px solid rgba(0,69,13,0.05);
                }
                .stat-row:last-child { border-bottom: none; }
                .pulse {
                    width: 8px; height: 8px; border-radius: 50%;
                    background: #16a34a;
                    box-shadow: 0 0 0 0 rgba(22,163,74,0.4);
                    animation: pulse 2s infinite;
                }
                .pulse.offline { background: #94a3b8; box-shadow: none; animation: none; }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(22,163,74,0.4); }
                    70% { box-shadow: 0 0 0 8px rgba(22,163,74,0); }
                    100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); }
                }
                .stop-row {
                    padding: 14px 24px; display: flex; align-items: center; gap: 14px;
                    border-bottom: 1px solid rgba(0,69,13,0.05);
                }
                .stop-row:last-child { border-bottom: none; }
                @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
                .s1 { animation: staggerIn 0.5s ease 0.05s both; }
                .s2 { animation: staggerIn 0.5s ease 0.1s both; }
                .s3 { animation: staggerIn 0.5s ease 0.15s both; }
                .s4 { animation: staggerIn 0.5s ease 0.2s both; }
            `}</style>

            {/* Header */}
            <section className="mb-8 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    Live Tracking · ClearPath
                </span>
                <h1 className="font-headline font-extrabold tracking-tight"
                    style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Track <span style={{ color: '#1b5e20' }}>Vehicle</span>
                </h1>
                {profile?.ward && (
                    <p className="text-sm mt-2" style={{ color: '#717a6d' }}>
                        Ward: {profile.ward}
                        {profile.district && ` · District: ${profile.district}`}
                    </p>
                )}
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {/* No collection today banner */}
                    {!isCollectionDay && (
                        <div className="rounded-2xl p-6 mb-6 flex items-start gap-4 s1"
                            style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <span className="material-symbols-outlined mt-0.5" style={{ color: '#94a3b8', fontSize: '24px' }}>
                                event_busy
                            </span>
                            <div>
                                <p className="font-bold text-sm mb-1" style={{ color: '#475569', fontFamily: 'Manrope, sans-serif' }}>
                                    No active collection today
                                </p>
                                <p className="text-sm" style={{ color: '#94a3b8' }}>
                                    There are no active routes in your ward right now. Check your schedule for upcoming collection days.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ETA hero card — only when vehicle is active */}
                    {vehicleLocation && (
                        <div className="bento-card-green p-8 mb-6 s2">
                            <div className="absolute top-0 right-0 w-48 h-48 rounded-full -mr-16 -mt-16"
                                style={{ background: 'rgba(163,246,156,0.06)' }} />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="pulse" />
                                    <span className="text-xs font-bold uppercase"
                                        style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.7)', fontFamily: 'Manrope, sans-serif' }}>
                                        Live · Updated {formatTime(lastUpdated)}
                                    </span>
                                </div>
                                <h2 className="font-headline font-extrabold tracking-tight mb-2"
                                    style={{ fontSize: '36px', lineHeight: 1.1 }}>
                                    {eta ?? 'Calculating...'}
                                </h2>
                                <p style={{ color: 'rgba(163,246,156,0.7)', fontSize: '14px' }}>
                                    {myNextStop
                                        ? `Vehicle en route to ${myNextStop.road_name || myNextStop.address || 'your stop'}`
                                        : completedStops > 0
                                            ? 'Your stop has been collected today'
                                            : 'Vehicle is active in your ward'}
                                </p>
                                {selectedRoute && (
                                    <p style={{ color: 'rgba(163,246,156,0.5)', fontSize: '12px', marginTop: '8px' }}>
                                        {selectedRoute.route_name || 'Active route'}
                                        {selectedRoute.vehicle_number && ` · ${selectedRoute.vehicle_number}`}
                                        {selectedRoute.shift && ` · ${selectedRoute.shift} shift`}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 s2">
                        <div className="bento-card p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`pulse ${vehicleLocation ? '' : 'offline'}`} />
                                <span className="text-xs font-bold uppercase"
                                    style={{ letterSpacing: '0.15em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                    Vehicle Status
                                </span>
                            </div>
                            <p className="font-headline font-extrabold text-2xl" style={{ color: '#181c22' }}>
                                {vehicleLocation ? 'Active' : 'No signal'}
                            </p>
                            <p className="text-xs mt-1 font-semibold" style={{ color: '#00450d' }}>
                                {vehicleLocation ? formatSpeed(vehicleLocation.speed) : 'Not tracking'}
                            </p>
                        </div>

                        <div className="bento-card p-6">
                            <span className="material-symbols-outlined mb-3 block"
                                style={{ color: '#00450d', fontSize: '26px' }}>delete</span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Your Stops
                            </p>
                            <p className="font-headline font-extrabold text-2xl" style={{ color: '#181c22' }}>
                                {completedStops} / {collectionStops.length}
                            </p>
                            <p className="text-xs mt-1 font-semibold" style={{ color: '#00450d' }}>
                                {collectionStops.length === 0 ? 'No stops on this route'
                                    : completedStops === collectionStops.length ? 'All collected today'
                                        : `${collectionStops.length - completedStops} remaining`}
                            </p>
                        </div>

                        <div className="bento-card p-6">
                            <span className="material-symbols-outlined mb-3 block"
                                style={{ color: '#00450d', fontSize: '26px' }}>route</span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Active Routes
                            </p>
                            <p className="font-headline font-extrabold text-2xl" style={{ color: '#181c22' }}>
                                {routes.length}
                            </p>
                            <p className="text-xs mt-1 font-semibold" style={{ color: '#00450d' }}>
                                in your ward today
                            </p>
                        </div>
                    </div>

                    {/* Route selector — only if multiple routes */}
                    {routes.length > 1 && (
                        <div className="bento-card mb-6 s3">
                            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <p className="font-headline font-bold text-base" style={{ color: '#181c22' }}>
                                    Active Routes Today
                                </p>
                            </div>
                            <div className="divide-y" style={{ borderColor: 'rgba(0,69,13,0.04)' }}>
                                {routes.map(route => (
                                    <button
                                        key={route.id}
                                        onClick={() => selectRoute(route)}
                                        className="w-full text-left px-6 py-4 flex items-center gap-4 transition-colors hover:bg-slate-50"
                                        style={selectedRoute?.id === route.id ? { background: '#f0fdf4' } : {}}
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ background: selectedRoute?.id === route.id ? '#00450d' : '#f0fdf4' }}>
                                            <span className="material-symbols-outlined"
                                                style={{ fontSize: '16px', color: selectedRoute?.id === route.id ? 'white' : '#00450d' }}>
                                                route
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold" style={{ color: '#181c22' }}>
                                                {route.route_name || 'Unnamed route'}
                                            </p>
                                            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                                                {route.vehicle_number && `${route.vehicle_number} · `}
                                                {route.shift && `${route.shift} shift · `}
                                                {route.status}
                                            </p>
                                        </div>
                                        {selectedRoute?.id === route.id && (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full"
                                                style={{ background: '#f0fdf4', color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                                Tracking
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Map */}
                    <div className="bento-card mb-6 s3">
                        <div className="px-8 py-6 flex items-center justify-between"
                            style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <div>
                                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                    Live Map
                                </h3>
                                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                                    {vehicleLocation
                                        ? `Vehicle location · Refreshes every 10 seconds`
                                        : 'Showing your collection stops'}
                                </p>
                            </div>
                            {vehicleLocation && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: '#f0fdf4' }}>
                                    <div className="pulse" style={{ width: '6px', height: '6px' }} />
                                    <span className="text-xs font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                        Live
                                    </span>
                                </div>
                            )}
                        </div>
                        <div
                            ref={mapRef}
                            style={{ width: '100%', height: '420px', background: '#f1f5f9' }}
                        >
                            {!mapLoaded && (
                                <div className="flex flex-col items-center justify-center h-full gap-3">
                                    <div className="w-8 h-8 border-2 rounded-full animate-spin"
                                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                                    <p className="text-sm" style={{ color: '#94a3b8' }}>Loading map...</p>
                                </div>
                            )}
                        </div>
                        <div className="px-8 py-3 flex items-center gap-6"
                            style={{ borderTop: '1px solid rgba(0,69,13,0.06)', background: '#fafaf9' }}>
                            <div className="flex items-center gap-2">
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#00450d', border: '2px solid white', boxShadow: '0 0 0 1px #00450d' }} />
                                <span className="text-xs" style={{ color: '#717a6d' }}>Collection vehicle</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b', border: '2px solid white', boxShadow: '0 0 0 1px #f59e0b' }} />
                                <span className="text-xs" style={{ color: '#717a6d' }}>Your stop (pending)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#16a34a', border: '2px solid white', boxShadow: '0 0 0 1px #16a34a' }} />
                                <span className="text-xs" style={{ color: '#717a6d' }}>Your stop (collected)</span>
                            </div>
                        </div>
                    </div>

                    {/* My stops detail */}
                    {collectionStops.length > 0 && (
                        <div className="bento-card s4">
                            <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                    Your Stops Today
                                </h3>
                                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                                    {completedStops} of {collectionStops.length} collected
                                </p>
                            </div>
                            <div>
                                {collectionStops.map((stop, i) => {
                                    const isCompleted = stop.status === 'completed'
                                    const isSkipped = stop.status === 'skipped'
                                    const isNext = !isCompleted && !isSkipped &&
                                        collectionStops.slice(0, i).every(s => s.status === 'completed')
                                    return (
                                        <div key={stop.id} className="stop-row">
                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{
                                                    background: isCompleted ? '#f0fdf4' : isSkipped ? '#fef2f2' : isNext ? '#fffbeb' : '#f8fafc',
                                                    border: `1px solid ${isCompleted ? '#bbf7d0' : isSkipped ? '#fecaca' : isNext ? '#fde68a' : '#e2e8f0'}`
                                                }}>
                                                <span className="material-symbols-outlined" style={{
                                                    fontSize: '18px',
                                                    color: isCompleted ? '#00450d' : isSkipped ? '#ba1a1a' : isNext ? '#d97706' : '#94a3b8'
                                                }}>
                                                    {isCompleted ? 'check_circle' : isSkipped ? 'cancel' : isNext ? 'pending' : 'radio_button_unchecked'}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold" style={{ color: '#181c22' }}>
                                                        {stop.road_name || stop.address || `Stop ${i + 1}`}
                                                    </p>
                                                    {isNext && (
                                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                                            style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', fontFamily: 'Manrope, sans-serif' }}>
                                                            Next
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                                                    {stop.bin_quantity && `${stop.bin_quantity}× `}
                                                    {stop.bin_size && `${stop.bin_size} · `}
                                                    {stop.waste_type && `${stop.waste_type}`}
                                                    {stop.completed_at && ` · Collected at ${new Date(stop.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                                                    {isSkipped && stop.skip_reason && ` · ${stop.skip_reason}`}
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0">
                                                {isCompleted && (
                                                    <span className="text-xs font-bold px-2 py-1 rounded-full"
                                                        style={{ background: '#f0fdf4', color: '#00450d', border: '1px solid #bbf7d0', fontFamily: 'Manrope, sans-serif' }}>
                                                        Collected
                                                    </span>
                                                )}
                                                {isSkipped && (
                                                    <span className="text-xs font-bold px-2 py-1 rounded-full"
                                                        style={{ background: '#fef2f2', color: '#ba1a1a', border: '1px solid #fecaca', fontFamily: 'Manrope, sans-serif' }}>
                                                        Skipped
                                                    </span>
                                                )}
                                                {stop.blockchain_tx && (
                                                    <a
                                                        href={`https://amoy.polygonscan.com/tx/${stop.blockchain_tx}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="ml-2 text-xs font-bold px-2 py-1 rounded-full"
                                                        style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', fontFamily: 'Manrope, sans-serif', textDecoration: 'none' }}
                                                    >
                                                        Chain ↗
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="px-8 py-4 flex items-center gap-3"
                                style={{ borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff' }}>
                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>verified</span>
                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                    Collections verified on Polygon Amoy · Refreshing every 10 seconds · CMC EcoLedger 2026
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}