'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
    { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
    { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
    { label: 'Heatmap', href: '/dashboard/district-engineer/heatmap', icon: 'thermostat' },
    { label: 'Complaints', href: '/dashboard/district-engineer/complaints', icon: 'feedback' },
    { label: 'Waste Reports', href: '/dashboard/district-engineer/waste-reports', icon: 'report' },
    { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
    { label: 'Zones', href: '/dashboard/district-engineer/zones', icon: 'map' },
    { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
    { label: 'Incidents', href: '/dashboard/district-engineer/incidents', icon: 'warning' },
]

interface StopPoint {
    lat: number
    lng: number
    status: string
    skip_reason: string | null
    road_name: string
    route_name: string
    weight: number
}

interface RouteStats {
    route_id: string
    route_name: string
    ward: string
    total: number
    skipped: number
    skip_rate: number
    alerts: number
    heat: 'critical' | 'high' | 'medium' | 'low'
    skip_reasons: Record<string, number>
}

const HEAT_CONFIG = {
    critical: { label: 'Critical', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '#ef4444' },
    high: { label: 'High', color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
    medium: { label: 'Medium', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6' },
    low: { label: 'Low', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e' },
}

function getHeat(skipRate: number, alerts: number): 'critical' | 'high' | 'medium' | 'low' {
    if (skipRate >= 60 || alerts >= 5) return 'critical'
    if (skipRate >= 40 || alerts >= 3) return 'high'
    if (skipRate >= 20 || alerts >= 1) return 'medium'
    return 'low'
}

declare global { interface Window { google: any; initHeatmap: () => void } }

export default function DEHeatmapPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [mapLoaded, setMapLoaded] = useState(false)
    const [mapError, setMapError] = useState(false)
    const [stopPoints, setStopPoints] = useState<StopPoint[]>([])
    const [routeStats, setRouteStats] = useState<RouteStats[]>([])
    const [selected, setSelected] = useState<RouteStats | null>(null)
    const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30')
    const [mapMode, setMapMode] = useState<'skipped' | 'all'>('skipped')
    const [view, setView] = useState<'map' | 'list'>('map')

    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstance = useRef<any>(null)
    const heatLayerRef = useRef<any>(null)
    const markersRef = useRef<any[]>([])

    const loadData = useCallback(async () => {
        setLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const since = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString()

        const { data: routes } = await supabase
            .from('routes').select('id, route_name, district, ward')
            .eq('district', p?.district || '')

        if (!routes || routes.length === 0) { setLoading(false); return }
        const routeIds = routes.map((r: any) => r.id)

        const { data: stops } = await supabase
            .from('collection_stops')
            .select('id, route_id, road_name, address, status, skip_reason, latitude, longitude, updated_at')
            .in('route_id', routeIds)
            .gte('updated_at', since)

        const { data: alerts } = await supabase
            .from('exception_alerts').select('id, route_id, severity, is_resolved')
            .in('route_id', routeIds).gte('created_at', since)

        // Build stop points for heatmap (only those with GPS)
        const points: StopPoint[] = []
            ; (stops || []).forEach((s: any) => {
                if (s.latitude && s.longitude) {
                    const route = routes.find((r: any) => r.id === s.route_id)
                    points.push({
                        lat: s.latitude, lng: s.longitude,
                        status: s.status, skip_reason: s.skip_reason,
                        road_name: s.road_name || s.address || '',
                        route_name: route?.route_name || '',
                        weight: s.status === 'skipped' ? 3 : 1,
                    })
                }
            })
        setStopPoints(points)

        // Build route stats
        const stats: RouteStats[] = routes.map((r: any) => {
            const routeStops = (stops || []).filter((s: any) => s.route_id === r.id)
            const skipped = routeStops.filter((s: any) => s.status === 'skipped')
            const routeAlerts = (alerts || []).filter((a: any) => a.route_id === r.id)
            const skipRate = routeStops.length > 0 ? Math.round((skipped.length / routeStops.length) * 100) : 0
            const skipReasons: Record<string, number> = {}
            skipped.forEach((s: any) => {
                if (s.skip_reason) skipReasons[s.skip_reason] = (skipReasons[s.skip_reason] || 0) + 1
            })
            return {
                route_id: r.id, route_name: r.route_name, ward: r.ward || r.district,
                total: routeStops.length, skipped: skipped.length, skip_rate: skipRate,
                alerts: routeAlerts.length, skip_reasons: skipReasons,
                heat: getHeat(skipRate, routeAlerts.length),
            }
        }).sort((a: RouteStats, b: RouteStats) => b.skip_rate - a.skip_rate)

        setRouteStats(stats)
        setLoading(false)
    }, [dateRange])

    // Load Maps script
    useEffect(() => {
        let mounted = true
        function load() {
            if (window.google?.maps) { if (mounted) setMapLoaded(true); return }
            const existing = document.getElementById('google-maps-heatmap-script')
            if (existing) { existing.addEventListener('load', () => { if (mounted) setMapLoaded(true) }); return }
            window.initHeatmap = () => { if (mounted) setMapLoaded(true) }
            const script = document.createElement('script')
            script.id = 'google-maps-heatmap-script'
            // Include visualization library for heatmap
            script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=visualization&callback=initHeatmap&loading=async`
            script.async = true; script.defer = true
            script.onerror = () => { if (mounted) setMapError(true) }
            document.head.appendChild(script)
        }
        const t = setTimeout(load, 100)
        return () => {
            mounted = false; clearTimeout(t)
            window.initHeatmap = () => { }
            mapInstance.current = null
            heatLayerRef.current = null
            markersRef.current.forEach(m => { try { m.setMap(null) } catch { } })
            markersRef.current = []
            const s = document.getElementById('google-maps-heatmap-script')
            if (s) s.remove()
            try { delete (window as any).google } catch { }
        }
    }, [])

    // Init map
    useEffect(() => {
        if (!mapLoaded || !mapRef.current || mapInstance.current) return
        try {
            mapInstance.current = new window.google.maps.Map(mapRef.current, {
                center: { lat: 6.9271, lng: 79.8612 },
                zoom: 13,
                mapTypeId: 'roadmap',
                styles: [
                    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
                    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
                    { featureType: 'water', stylers: [{ color: '#d4eaf7' }] },
                    { featureType: 'landscape', stylers: [{ color: '#f4f6f3' }] },
                    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
                ],
                mapTypeControl: false, streetViewControl: false, fullscreenControl: true,
            })
        } catch { setMapError(true) }
    }, [mapLoaded])

    // Update heatmap layer when data or mode changes
    useEffect(() => {
        if (!mapInstance.current || !window.google?.maps?.visualization) return

        // Clear existing
        if (heatLayerRef.current) heatLayerRef.current.setMap(null)
        markersRef.current.forEach(m => m.setMap(null))
        markersRef.current = []

        const pts = mapMode === 'skipped'
            ? stopPoints.filter(p => p.status === 'skipped')
            : stopPoints

        if (pts.length === 0) return

        // Build weighted heatmap data
        const heatData = pts.map(p => ({
            location: new window.google.maps.LatLng(p.lat, p.lng),
            weight: p.weight,
        }))

        heatLayerRef.current = new window.google.maps.visualization.HeatmapLayer({
            data: heatData,
            map: mapInstance.current,
            radius: 30,
            opacity: 0.8,
            gradient: [
                'rgba(0, 255, 0, 0)',
                'rgba(0, 255, 0, 0.4)',
                'rgba(255, 255, 0, 0.6)',
                'rgba(255, 165, 0, 0.8)',
                'rgba(255, 0, 0, 1)',
            ],
        })

        // Fit map to points
        const bounds = new window.google.maps.LatLngBounds()
        pts.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }))
        mapInstance.current.fitBounds(bounds, { padding: 60 })

    }, [stopPoints, mapLoaded, mapMode])

    useEffect(() => { loadData() }, [loadData])

    const totalSkipped = routeStats.reduce((s, r) => s + r.skipped, 0)
    const totalStops = routeStats.reduce((s, r) => s + r.total, 0)
    const totalAlerts = routeStats.reduce((s, r) => s + r.alerts, 0)
    const criticalRoutes = routeStats.filter(r => r.heat === 'critical').length
    const overallRate = totalStops > 0 ? Math.round((totalSkipped / totalStops) * 100) : 0
    const gpsPoints = stopPoints.length
    const skippedPoints = stopPoints.filter(p => p.status === 'skipped').length

    return (
        <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}
            primaryAction={{ label: 'View Routes', href: '/dashboard/district-engineer/routes', icon: 'route' }}>
            <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .a1{animation:fadeUp .4s ease .04s both}.a2{animation:fadeUp .4s ease .09s both}.a3{animation:fadeUp .4s ease .14s both}
        .filter-btn{padding:7px 14px;border-radius:99px;font-size:12px;font-weight:700;font-family:'Manrope',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
        .filter-btn.active{background:#00450d;color:white}
        .filter-btn:not(.active){background:#f1f5f9;color:#64748b}
        .route-row{padding:14px 20px;border-bottom:1px solid rgba(0,0,0,0.04);cursor:pointer;transition:background 0.1s;display:flex;align-items:center;gap:12px}
        .route-row:hover{background:#fafaf9}
        .route-row.selected{background:#f0fdf4;border-left:3px solid #00450d}
        .route-row:last-child{border-bottom:none}
        .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;font-family:'Manrope',sans-serif;letter-spacing:0.06em;text-transform:uppercase;border:1px solid transparent}
      `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>District Engineer</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h1 style={{ fontSize: 42, fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif', marginBottom: 4 }}>
                            Problem Route <span style={{ color: '#dc2626' }}>Heatmap</span>
                        </h1>
                        <p style={{ fontSize: 13, color: '#717a6d' }}>{profile?.district || 'CMC District'} · GPS-tracked skip locations</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {(['7', '30', '90'] as const).map(d => (
                            <button key={d} onClick={() => setDateRange(d)} className={`filter-btn ${dateRange === d ? 'active' : ''}`}>{d}d</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats strip */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Overall Skip Rate', value: `${overallRate}%`, icon: 'remove_road', color: overallRate >= 40 ? '#dc2626' : overallRate >= 20 ? '#d97706' : '#15803d', bg: overallRate >= 40 ? '#fef2f2' : overallRate >= 20 ? '#fffbeb' : '#f0fdf4' },
                    { label: 'Stops Skipped', value: totalSkipped, icon: 'cancel', color: '#dc2626', bg: '#fef2f2' },
                    { label: 'Exception Alerts', value: totalAlerts, icon: 'warning', color: '#d97706', bg: '#fffbeb' },
                    { label: 'GPS Points Tracked', value: gpsPoints, icon: 'my_location', color: '#1d4ed8', bg: '#eff6ff' },
                ].map(s => (
                    <div key={s.label} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msf" style={{ fontSize: 18, color: s.color }}>{s.icon}</span>
                        </div>
                        <div>
                            <p style={{ fontSize: 22, fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{s.value}</p>
                            <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="a3" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

                {/* Left — map */}
                <div>
                    <div className="card" style={{ overflow: 'hidden' }}>
                        {/* Map header */}
                        <div style={{ padding: '14px 20px', background: '#00450d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span className="msf" style={{ fontSize: 18, color: 'rgba(163,246,156,0.9)' }}>thermostat</span>
                                <div>
                                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: 'white' }}>Live Heatmap</p>
                                    <p style={{ fontSize: 11, color: 'rgba(163,246,156,0.7)' }}>
                                        {skippedPoints} skipped stops plotted · {gpsPoints} total GPS points
                                    </p>
                                </div>
                            </div>
                            {/* Mode toggle */}
                            <div style={{ display: 'flex', gap: 6 }}>
                                {(['skipped', 'all'] as const).map(m => (
                                    <button key={m} onClick={() => setMapMode(m)}
                                        style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', border: 'none', cursor: 'pointer', background: mapMode === m ? 'white' : 'rgba(255,255,255,0.15)', color: mapMode === m ? '#00450d' : 'white', transition: 'all 0.2s' }}>
                                        {m === 'skipped' ? 'Skips Only' : 'All Stops'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Map */}
                        <div style={{ position: 'relative', height: 480 }}>
                            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

                            {!mapLoaded && !mapError && (
                                <div style={{ position: 'absolute', inset: 0, background: '#f4f6f3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ width: 28, height: 28, border: '2px solid #dc2626', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                                    <p style={{ fontSize: 13, color: '#717a6d', fontFamily: 'Manrope,sans-serif' }}>Loading heatmap...</p>
                                </div>
                            )}

                            {mapError && (
                                <div style={{ position: 'absolute', inset: 0, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
                                    <span className="msf" style={{ fontSize: 36, color: '#dc2626' }}>error</span>
                                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: '#181c22' }}>Map failed to load</p>
                                    <p style={{ fontSize: 12, color: '#717a6d' }}>Check Google Maps API key and ensure Maps JavaScript API + Visualization library are enabled.</p>
                                </div>
                            )}

                            {mapLoaded && !mapError && gpsPoints === 0 && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ background: 'white', borderRadius: 16, padding: '24px 32px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', maxWidth: 300 }}>
                                        <span className="msf" style={{ fontSize: 36, color: '#94a3b8', display: 'block', marginBottom: 12 }}>location_off</span>
                                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', marginBottom: 6 }}>No GPS data yet</p>
                                        <p style={{ fontSize: 12, color: '#717a6d', lineHeight: 1.6 }}>
                                            GPS coordinates are captured when drivers mark stops. Data will appear here as drivers complete routes in the selected period.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Heatmap legend */}
                        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 16, background: '#fafafa', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>INTENSITY</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ height: 8, width: 120, borderRadius: 99, background: 'linear-gradient(90deg, rgba(0,255,0,0.4), rgba(255,255,0,0.6), rgba(255,165,0,0.8), rgba(255,0,0,1))' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                {[['rgba(0,255,0,0.6)', 'Low'], ['rgba(255,255,0,0.8)', 'Medium'], ['rgba(255,0,0,1)', 'High']].map(([c, l]) => (
                                    <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c as string }} />
                                        <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'Manrope,sans-serif' }}>{l}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right — route stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Heat breakdown */}
                    <div className="card" style={{ padding: 18 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 12 }}>Heat by Level</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(Object.entries(HEAT_CONFIG) as [string, typeof HEAT_CONFIG.critical][]).map(([key, cfg]) => {
                                const count = routeStats.filter(r => r.heat === key).length
                                const pct = routeStats.length > 0 ? Math.round((count / routeStats.length) * 100) : 0
                                return (
                                    <div key={key}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot }} />
                                                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{cfg.label}</span>
                                            </div>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, fontFamily: 'Manrope,sans-serif' }}>{count} routes</span>
                                        </div>
                                        <div style={{ height: 4, borderRadius: 99, background: '#f0f0f0', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: cfg.dot, borderRadius: 99, transition: 'width 0.5s ease' }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Route list */}
                    <div className="card">
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22' }}>Routes by Skip Rate</p>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{routeStats.length} routes</span>
                        </div>
                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                                <div style={{ width: 24, height: 24, border: '2px solid #dc2626', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                            </div>
                        ) : routeStats.length === 0 ? (
                            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                                <span className="msf" style={{ fontSize: 28, color: '#22c55e', display: 'block', marginBottom: 8 }}>check_circle</span>
                                <p style={{ fontSize: 13, color: '#94a3b8' }}>No route data for this period</p>
                            </div>
                        ) : routeStats.map(r => {
                            const hc = HEAT_CONFIG[r.heat]
                            const isSelected = selected?.route_id === r.route_id
                            return (
                                <div key={r.route_id}
                                    className={`route-row ${isSelected ? 'selected' : ''}`}
                                    onClick={() => setSelected(isSelected ? null : r)}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: hc.dot, flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>{r.route_name}</p>
                                        <p style={{ fontSize: 11, color: '#94a3b8' }}>{r.ward} · {r.skipped}/{r.total} skipped</p>
                                    </div>
                                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                        <p style={{ fontSize: 16, fontWeight: 900, color: hc.color, fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{r.skip_rate}%</p>
                                        {r.alerts > 0 && <span style={{ fontSize: 9, color: '#d97706', fontFamily: 'Manrope,sans-serif', fontWeight: 700 }}>{r.alerts} alerts</span>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Selected route detail */}
                    {selected && (() => {
                        const hc = HEAT_CONFIG[selected.heat]
                        return (
                            <div className="card" style={{ border: `1.5px solid ${hc.border}` }}>
                                <div style={{ padding: '14px 18px', background: hc.bg, borderBottom: `1px solid ${hc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: hc.color }}>{selected.route_name}</p>
                                        <p style={{ fontSize: 11, color: '#717a6d', marginTop: 2 }}>{selected.ward}</p>
                                    </div>
                                    <button onClick={() => setSelected(null)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                        <span className="msf" style={{ fontSize: 16, color: '#94a3b8' }}>close</span>
                                    </button>
                                </div>
                                <div style={{ padding: 16 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                                        {[
                                            { l: 'Total', v: selected.total, c: '#00450d', bg: '#f0fdf4' },
                                            { l: 'Skipped', v: selected.skipped, c: '#dc2626', bg: '#fef2f2' },
                                            { l: 'Skip Rate', v: `${selected.skip_rate}%`, c: hc.color, bg: hc.bg },
                                            { l: 'Alerts', v: selected.alerts, c: '#d97706', bg: '#fffbeb' },
                                        ].map(s => (
                                            <div key={s.l} style={{ background: s.bg, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                                                <p style={{ fontSize: 18, fontWeight: 900, color: s.c, fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{s.v}</p>
                                                <p style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{s.l}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {Object.keys(selected.skip_reasons).length > 0 && (
                                        <div>
                                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>Skip Reasons</p>
                                            {Object.entries(selected.skip_reasons).sort(([, a], [, b]) => b - a).map(([r, c]) => (
                                                <div key={r} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f5f5f5' }}>
                                                    <span style={{ fontSize: 12, color: '#374151' }}>{r.replace(/_/g, ' ')}</span>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', fontFamily: 'Manrope,sans-serif' }}>{c}×</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <a href="/dashboard/district-engineer/routes"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, background: '#00450d', color: 'white', textDecoration: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', marginTop: 14 }}>
                                        <span className="msf" style={{ fontSize: 15 }}>route</span>View Route
                                    </a>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            </div>
        </DashboardLayout>
    )
}