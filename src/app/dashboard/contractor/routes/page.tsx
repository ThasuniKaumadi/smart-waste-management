'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const CONTRACTOR_NAV = [
  { label: 'Overview', href: '/dashboard/contractor', icon: 'dashboard' },
  { label: 'Routes', href: '/dashboard/contractor/routes', icon: 'route' },
  { label: 'Drivers', href: '/dashboard/contractor/drivers', icon: 'people' },
  { label: 'Breakdowns', href: '/dashboard/contractor/breakdowns', icon: 'car_crash' },
  { label: 'Contracts', href: '/dashboard/contractor/contracts', icon: 'description' },
  { label: 'Fleet', href: '/dashboard/contractor/fleet', icon: 'local_shipping' },
  { label: 'Billing', href: '/dashboard/contractor/billing', icon: 'receipt_long' },
]

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending: { color: '#d97706', bg: '#fefce8' },
  active: { color: '#1d4ed8', bg: '#eff6ff' },
  completed: { color: '#00450d', bg: '#f0fdf4' },
  cancelled: { color: '#ba1a1a', bg: '#fef2f2' },
}

interface Route {
  id: string
  route_name: string
  district: string
  ward: string
  vehicle_number: string
  date: string
  status: string
  shift: string
  waste_type: string
  driver_id: string
  schedule_id: string
  profiles: { full_name: string }
}

interface RouteStop {
  id: string
  road_name: string
  address: string
  stop_order: number
  status: string
  frequency: string
  skip_reason: string
  is_commercial: boolean
}

export default function ContractorRoutesPage() {
  const [profile, setProfile] = useState<any>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterShift, setFilterShift] = useState('all')
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null)
  const [routeStops, setRouteStops] = useState<Record<string, RouteStop[]>>({})
  const [loadingStops, setLoadingStops] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    const { data: routesData } = await supabase
      .from('routes')
      .select('*, profiles!driver_id(full_name)')
      .eq('contractor_id', user.id)
      .order('date', { ascending: false })
    setRoutes(routesData || [])
    setLoading(false)
  }

  async function loadRouteStops(routeId: string) {
    if (routeStops[routeId]) {
      setExpandedRoute(expandedRoute === routeId ? null : routeId)
      return
    }
    setLoadingStops(routeId)
    const supabase = createClient()
    const { data } = await supabase
      .from('collection_stops')
      .select('*')
      .eq('route_id', routeId)
      .order('stop_order', { ascending: true })
    setRouteStops(prev => ({ ...prev, [routeId]: data || [] }))
    setExpandedRoute(routeId)
    setLoadingStops(null)
  }

  const filtered = routes.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (filterShift !== 'all' && r.shift !== filterShift) return false
    return true
  })

  function getStopFrequencyStyle(freq: string) {
    if (freq === 'four_times_a_day') return { color: '#ba1a1a', bg: '#fef2f2' }
    if (freq === 'thrice_a_day') return { color: '#d97706', bg: '#fefce8' }
    if (freq === 'twice_a_day') return { color: '#1d4ed8', bg: '#eff6ff' }
    return { color: '#00450d', bg: '#f0fdf4' }
  }

  // Ward coverage from routes
  const wards = [...new Set(routes.map(r => r.ward).filter(Boolean))]
  const wardCoverage = wards.map(ward => ({
    ward,
    total: routes.filter(r => r.ward === ward).length,
    active: routes.filter(r => r.ward === ward && r.status === 'active').length,
    completed: routes.filter(r => r.ward === ward && r.status === 'completed').length,
    pending: routes.filter(r => r.ward === ward && r.status === 'pending').length,
  }))

  return (
    <DashboardLayout
      role="Contractor"
      userName={profile?.organisation_name || profile?.full_name || ''}
      navItems={CONTRACTOR_NAV}
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
        .filter-btn {
          padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 700;
          font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s ease;
        }
        .filter-btn.active { background: #00450d; color: white; }
        .filter-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .filter-btn:not(.active):hover { background: #e2e8f0; }
        .route-row {
          padding: 18px 24px; border-bottom: 1px solid rgba(0,69,13,0.04);
          transition: background 0.2s ease; cursor: pointer;
        }
        .route-row:hover { background: #f9f9ff; }
        .route-row:last-child { border-bottom: none; }
        .badge {
          display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em;
          text-transform: uppercase; white-space: nowrap;
        }
        .stop-row {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 16px; border-bottom: 1px solid rgba(0,69,13,0.04);
          font-size: 13px;
        }
        .stop-row:last-child { border-bottom: none; }
        .ward-card {
          background: white; border-radius: 14px; padding: 16px 20px;
          border: 1px solid rgba(0,69,13,0.06); transition: all 0.2s ease;
        }
        .ward-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.06); transform: translateY(-2px); }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.2s both; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .slide-down { animation: slideDown 0.3s ease both; }
      `}</style>

      {/* Hero */}
      <section className="mb-10 s1">
        <span className="text-xs font-bold uppercase block mb-2"
          style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
          {profile?.organisation_name || 'Contractor'} · Route Overview
        </span>
        <h1 className="font-headline font-extrabold tracking-tight"
          style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
          Collection <span style={{ color: '#1b5e20' }}>Routes</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
          Routes assigned to your company by the District Engineer · {profile?.district}
        </p>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
        {[
          { label: 'Total Routes', value: routes.length, icon: 'route', color: '#00450d', bg: '#f0fdf4' },
          { label: 'Active', value: routes.filter(r => r.status === 'active').length, icon: 'directions_car', color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Pending', value: routes.filter(r => r.status === 'pending').length, icon: 'schedule', color: '#d97706', bg: '#fefce8' },
          { label: 'Completed', value: routes.filter(r => r.status === 'completed').length, icon: 'check_circle', color: '#16a34a', bg: '#f0fdf4' },
        ].map(m => (
          <div key={m.label} className="bento-card p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: m.bg }}>
              <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '18px' }}>{m.icon}</span>
            </div>
            <p className="font-headline font-extrabold text-2xl tracking-tight mb-0.5" style={{ color: '#181c22' }}>{m.value}</p>
            <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* Info notice */}
      <div className="mb-6 p-4 rounded-xl flex items-center gap-3"
        style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>info</span>
        <p style={{ fontSize: '13px', color: '#41493e' }}>
          Routes are created and managed by your District Engineer. Contact your DE to request changes or new routes.
        </p>
      </div>

      {/* Ward coverage */}
      {wardCoverage.length > 0 && (
        <div className="mb-8 s3">
          <h3 className="font-headline font-bold text-lg mb-4" style={{ color: '#181c22' }}>Ward Coverage</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {wardCoverage.map(w => (
              <div key={w.ward} className="ward-card">
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>{w.ward}</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {w.active > 0 && <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{w.active} active</span>}
                  {w.pending > 0 && <span className="badge" style={{ background: '#fefce8', color: '#d97706' }}>{w.pending} pending</span>}
                  {w.completed > 0 && <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>{w.completed} done</span>}
                  {w.total === 0 && <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>No routes</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route list */}
      <div className="bento-card s4">
        <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3"
          style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
          <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>All Routes</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {['all', 'active', 'pending', 'completed'].map(f => (
              <button key={f} onClick={() => setFilterStatus(f)}
                className={`filter-btn ${filterStatus === f ? 'active' : ''}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <div style={{ width: '1px', height: '20px', background: 'rgba(0,69,13,0.1)' }} />
            {['all', 'day', 'night'].map(f => (
              <button key={f} onClick={() => setFilterShift(f)}
                className={`filter-btn ${filterShift === f ? 'active' : ''}`}>
                {f === 'day' ? '☀️ Day' : f === 'night' ? '🌙 Night' : 'All Shifts'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
              <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>route</span>
            </div>
            <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No routes assigned yet</p>
            <p style={{ fontSize: '14px', color: '#94a3b8' }}>
              Your District Engineer will assign routes to your company
            </p>
          </div>
        ) : (
          <div>
            {filtered.map(route => {
              const ss = STATUS_STYLE[route.status] || STATUS_STYLE.pending
              const isExpanded = expandedRoute === route.id
              const stops = routeStops[route.id] || []

              return (
                <div key={route.id}>
                  <div className="route-row" onClick={() => loadRouteStops(route.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

                      {/* Status icon */}
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: ss.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ color: ss.color, fontSize: '20px' }}>
                          {route.status === 'completed' ? 'check_circle' :
                            route.status === 'active' ? 'directions_car' :
                              route.status === 'cancelled' ? 'cancel' : 'schedule'}
                        </span>
                      </div>

                      {/* Route info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                            {route.route_name}
                          </p>
                          <span className="badge" style={{ background: ss.bg, color: ss.color }}>{route.status}</span>
                          {route.shift === 'night' && (
                            <span className="badge" style={{ background: '#eff6ff', color: '#1e3a8a' }}>🌙 Night</span>
                          )}
                          {route.waste_type && (
                            <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>
                              {route.waste_type.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: '#94a3b8' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                            {route.ward || route.district}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>person</span>
                            {route.profiles?.full_name || 'Unassigned'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>directions_car</span>
                            {route.vehicle_number}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>
                            {new Date(route.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      {/* Expand indicator */}
                      <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '20px', flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Expanded stops */}
                  {isExpanded && (
                    <div className="slide-down" style={{ background: '#f9fdf9', borderBottom: '1px solid rgba(0,69,13,0.04)' }}>
                      {loadingStops === route.id ? (
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto"
                            style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                        </div>
                      ) : stops.length === 0 ? (
                        <div style={{ padding: '16px 24px', fontSize: '13px', color: '#94a3b8' }}>
                          No stops added yet
                        </div>
                      ) : (
                        <div>
                          <div style={{ padding: '10px 24px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: '#717a6d', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                              {stops.length} roads/stops
                            </p>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                              <span style={{ color: '#00450d' }}>✓ {stops.filter(s => s.status === 'completed').length} done</span>
                              <span style={{ color: '#dc2626' }}>✗ {stops.filter(s => s.status === 'skipped').length} skipped</span>
                              <span style={{ color: '#d97706' }}>○ {stops.filter(s => s.status === 'pending').length} pending</span>
                            </div>
                          </div>
                          {stops.map(stop => {
                            const fs = getStopFrequencyStyle(stop.frequency)
                            return (
                              <div key={stop.id} className="stop-row">
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, background: stop.status === 'completed' ? '#f0fdf4' : stop.status === 'skipped' ? '#fef2f2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: stop.status === 'completed' ? '#00450d' : stop.status === 'skipped' ? '#ba1a1a' : '#94a3b8' }}>
                                    {stop.status === 'completed' ? 'check' : stop.status === 'skipped' ? 'close' : 'radio_button_unchecked'}
                                  </span>
                                </div>
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: 0, fontWeight: 600, color: '#181c22', fontSize: '13px' }}>
                                    {stop.road_name || stop.address}
                                  </p>
                                  {stop.skip_reason && (
                                    <p style={{ margin: 0, fontSize: '11px', color: '#ba1a1a', marginTop: '2px' }}>
                                      Skipped: {stop.skip_reason.replace(/_/g, ' ')}
                                    </p>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                  {stop.frequency && (
                                    <span className="badge" style={{ background: fs.bg, color: fs.color }}>
                                      {stop.frequency.replace(/_/g, ' ')}
                                    </span>
                                  )}
                                  {stop.is_commercial && (
                                    <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Commercial</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="px-8 py-4 flex items-center gap-3"
          style={{ borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff' }}>
          <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '16px' }}>info</span>
          <p className="text-xs" style={{ color: '#717a6d' }}>
            Showing {filtered.length} of {routes.length} routes
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}