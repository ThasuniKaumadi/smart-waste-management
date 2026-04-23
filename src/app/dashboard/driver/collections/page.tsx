'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

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

interface StopRecord {
    id: string
    road_name: string
    address: string
    status: string
    stop_order: number
    skip_reason: string | null
    completed_at: string | null
    is_commercial: boolean
    notes: string | null
    bin_count: number | null
    route_id: string
    routeName?: string
    routeDate?: string
    ward?: string
}

const SKIP_LABEL: Record<string, string> = {
    no_waste_out: 'No waste put out',
    access_denied: 'Access denied',
    wrong_waste_type: 'Wrong waste type',
    vehicle_breakdown: 'Vehicle breakdown',
    other: 'Other',
}

export default function DriverCollectionsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [stops, setStops] = useState<StopRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'completed' | 'skipped'>('all')
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Get all routes for this driver
        const { data: routes } = await supabase
            .from('routes')
            .select('id, route_name, date, ward')
            .eq('driver_id', user.id)
            .order('date', { ascending: false })

        if (!routes || routes.length === 0) { setLoading(false); return }

        const routeMap: Record<string, { route_name: string; date: string; ward: string }> = {}
        routes.forEach(r => { routeMap[r.id] = { route_name: r.route_name, date: r.date, ward: r.ward } })

        const routeIds = routes.map(r => r.id)

        const { data: stopsData } = await supabase
            .from('collection_stops')
            .select('*')
            .in('route_id', routeIds)
            .in('status', ['completed', 'skipped'])
            .order('completed_at', { ascending: false })

        const enriched = (stopsData || []).map(s => ({
            ...s,
            routeName: routeMap[s.route_id]?.route_name || 'Unknown Route',
            routeDate: routeMap[s.route_id]?.date || '',
            ward: routeMap[s.route_id]?.ward || '',
        }))

        setStops(enriched)
        setLoading(false)
    }

    const filtered = stops.filter(s => {
        if (filter !== 'all' && s.status !== filter) return false
        if (search) {
            const q = search.toLowerCase()
            return (
                (s.road_name || s.address || '').toLowerCase().includes(q) ||
                (s.routeName || '').toLowerCase().includes(q) ||
                (s.ward || '').toLowerCase().includes(q)
            )
        }
        return true
    })

    const completedCount = stops.filter(s => s.status === 'completed').length
    const skippedCount = stops.filter(s => s.status === 'skipped').length
    const binsCollected = stops.filter(s => s.status === 'completed' && s.bin_count).reduce((sum, s) => sum + (s.bin_count || 0), 0)

    return (
        <DashboardLayout role="Driver" userName={profile?.full_name || ''} navItems={DRIVER_NAV}>
            <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msf-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:16px; box-shadow:0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.04); border:1px solid rgba(0,69,13,0.06); }
        .stop-row { padding:14px 18px; border-bottom:1px solid rgba(0,69,13,0.05); display:flex; align-items:flex-start; gap:12px; }
        .stop-row:last-child { border-bottom:none; }
        .filter-btn { padding:7px 16px; border-radius:99px; border:1.5px solid rgba(0,69,13,0.15); background:white; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.15s; color:#717a6d; }
        .filter-btn.active { background:#00450d; color:white; border-color:#00450d; }
        .search-input { width:100%; padding:10px 14px 10px 38px; border:1.5px solid rgba(0,69,13,0.12); border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; outline:none; background:#fafbfa; color:#181c22; transition:border 0.2s; box-sizing:border-box; }
        .search-input:focus { border-color:#00450d; background:white; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .35s ease both} .a2{animation:fadeUp .35s ease .06s both} .a3{animation:fadeUp .35s ease .12s both}
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 8 }}>Driver · History</p>
                <h1 style={{ fontSize: 38, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: 0 }}>
                    My <span style={{ color: '#1b5e20' }}>Collections</span>
                </h1>
            </div>

            {/* Stats */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Completed', value: completedCount, icon: 'check_circle', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Skipped', value: skippedCount, icon: 'cancel', color: '#ba1a1a', bg: '#fef2f2' },
                    { label: 'Bins Logged', value: binsCollected, icon: 'delete', color: '#1d4ed8', bg: '#eff6ff' },
                ].map(m => (
                    <div key={m.label} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msf-fill" style={{ fontSize: 18, color: m.color }}>{m.icon}</span>
                        </div>
                        <div>
                            <p style={{ fontSize: 22, fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0, lineHeight: 1 }}>{m.value}</p>
                            <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{m.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters + Search */}
            <div className="a3" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <span className="msf" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#94a3b8' }}>search</span>
                    <input className="search-input" placeholder="Search by street, route, ward…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {(['all', 'completed', 'skipped'] as const).map(f => (
                    <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="a3 card">
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>Stop History</h3>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{filtered.length} stops</span>
                </div>

                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <div style={{ width: 26, height: 26, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                        <span className="msf" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 12 }}>inventory_2</span>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', marginBottom: 4 }}>No collections yet</p>
                        <p style={{ fontSize: 13, color: '#94a3b8' }}>Completed and skipped stops will appear here.</p>
                    </div>
                ) : filtered.map(stop => {
                    const isDone = stop.status === 'completed'
                    return (
                        <div key={stop.id} className="stop-row">
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: isDone ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                                <span className="msf-fill" style={{ fontSize: 15, color: isDone ? '#00450d' : '#ba1a1a' }}>{isDone ? 'check_circle' : 'cancel'}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                    <div>
                                        <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 3px' }}>
                                            {stop.road_name || stop.address}
                                        </p>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                            <span style={{ fontSize: 11, color: '#717a6d' }}>{stop.routeName}</span>
                                            {stop.ward && <span style={{ fontSize: 10, color: '#94a3b8' }}>· {stop.ward}</span>}
                                            {stop.is_commercial && (
                                                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontFamily: 'Manrope,sans-serif' }}>Commercial</span>
                                            )}
                                            {stop.bin_count && (
                                                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: '#f0fdf4', color: '#00450d', fontWeight: 700, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <span className="msf" style={{ fontSize: 11 }}>delete</span>{stop.bin_count} bins
                                                </span>
                                            )}
                                            {!isDone && stop.skip_reason && (
                                                <span style={{ fontSize: 11, color: '#ba1a1a', fontStyle: 'italic' }}>
                                                    {SKIP_LABEL[stop.skip_reason] || stop.skip_reason}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        {stop.routeDate && (
                                            <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', margin: 0 }}>
                                                {new Date(stop.routeDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </p>
                                        )}
                                        {stop.completed_at && (
                                            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                                                {new Date(stop.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </DashboardLayout>
    )
}
