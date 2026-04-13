'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

const DRIVER_NAV = [
  { label: 'Overview', href: '/dashboard/driver', icon: 'dashboard' },
  { label: 'My Routes', href: '/dashboard/driver/routes', icon: 'route' },
  { label: 'Fuel Log', href: '/dashboard/driver/fuel-log', icon: 'local_gas_station' },
  { label: 'Breakdown', href: '/dashboard/driver/breakdown', icon: 'car_crash' },
  { label: 'Disposal', href: '/dashboard/driver/disposal', icon: 'delete_sweep' },
]

export default function DriverDashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRoutes: 0, activeRoutes: 0, completedRoutes: 0,
    totalCollections: 0, completedCollections: 0, skippedCollections: 0,
    totalFuelLogs: 0, totalBreakdowns: 0,
  })
  const [todayRoutes, setTodayRoutes] = useState<any[]>([])
  const [recentCollections, setRecentCollections] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    const [
      { count: totalRoutes },
      { count: activeRoutes },
      { count: completedRoutes },
      { count: totalCollections },
      { count: completedCollections },
      { count: skippedCollections },
      { count: totalFuelLogs },
      { count: totalBreakdowns },
    ] = await Promise.all([
      supabase.from('routes').select('*', { count: 'exact', head: true }).eq('driver_id', user.id),
      supabase.from('routes').select('*', { count: 'exact', head: true }).eq('driver_id', user.id).eq('status', 'active'),
      supabase.from('routes').select('*', { count: 'exact', head: true }).eq('driver_id', user.id).eq('status', 'completed'),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }).eq('driver_id', user.id),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }).eq('driver_id', user.id).eq('status', 'completed'),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }).eq('driver_id', user.id).eq('status', 'skipped'),
      supabase.from('fuel_logs').select('*', { count: 'exact', head: true }).eq('driver_id', user.id),
      supabase.from('breakdown_reports').select('*', { count: 'exact', head: true }).eq('driver_id', user.id),
    ])

    setStats({
      totalRoutes: totalRoutes || 0, activeRoutes: activeRoutes || 0, completedRoutes: completedRoutes || 0,
      totalCollections: totalCollections || 0, completedCollections: completedCollections || 0,
      skippedCollections: skippedCollections || 0, totalFuelLogs: totalFuelLogs || 0, totalBreakdowns: totalBreakdowns || 0,
    })

    const today = new Date().toISOString().split('T')[0]
    const { data: routes } = await supabase
      .from('routes').select('*').eq('driver_id', user.id)
      .gte('created_at', today).order('created_at', { ascending: false }).limit(3)
    setTodayRoutes(routes || [])

    const { data: collections } = await supabase
      .from('collection_events').select('*, collection_stops(address, is_commercial)')
      .eq('driver_id', user.id).order('created_at', { ascending: false }).limit(4)
    setRecentCollections(collections || [])

    setLoading(false)
  }

  const completionRate = stats.totalCollections > 0
    ? Math.round((stats.completedCollections / stats.totalCollections) * 100) : 0

  function routeStatusStyle(status: string) {
    if (status === 'active') return { background: '#f0fdf4', color: '#00450d' }
    if (status === 'completed') return { background: '#eff6ff', color: '#1d4ed8' }
    if (status === 'pending') return { background: '#fefce8', color: '#92400e' }
    return { background: '#f8fafc', color: '#64748b' }
  }

  function collectionStatusStyle(status: string) {
    if (status === 'completed') return { background: '#f0fdf4', color: '#00450d' }
    if (status === 'skipped') return { background: '#fef2f2', color: '#ba1a1a' }
    return { background: '#f8fafc', color: '#64748b' }
  }

  const QUICK_LINKS = [
    { label: 'My Routes', desc: 'View and manage your assigned collection routes', icon: 'route', href: '/dashboard/driver/routes', color: '#00450d' },
    { label: 'Log Fuel', desc: 'Record fuel refill data and costs', icon: 'local_gas_station', href: '/dashboard/driver/fuel-log', color: '#1b5e20' },
    { label: 'Report Breakdown', desc: 'Submit a vehicle breakdown report', icon: 'car_crash', href: '/dashboard/driver/breakdown', color: '#ba1a1a' },
  ]

  return (
    <DashboardLayout
      role="Driver"
      userName={profile?.full_name || ''}
      navItems={DRIVER_NAV}
      primaryAction={{ label: 'My Routes', href: '/dashboard/driver/routes', icon: 'route' }}
    >
      <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .font-label    { font-family: 'Manrope', sans-serif; }
        .bento-card {
          background: white; border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
          border: 1px solid rgba(0,69,13,0.04);
          transition: all 0.4s cubic-bezier(0.05,0.7,0.1,1.0); overflow: hidden;
        }
        .bento-card:hover { transform: translateY(-4px); box-shadow: 0 20px 50px -15px rgba(24,28,34,0.12); }
        .bento-card-green {
          background: #00450d; border-radius: 16px; color: white;
          transition: all 0.4s cubic-bezier(0.05,0.7,0.1,1.0); overflow: hidden; position: relative;
        }
        .bento-card-green:hover { transform: translateY(-4px); }
        .quick-link {
          background: white; border-radius: 16px; padding: 24px;
          border: 1px solid rgba(0,69,13,0.06);
          transition: all 0.35s cubic-bezier(0.05,0.7,0.1,1.0); text-decoration: none; display: block;
        }
        .quick-link:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -15px rgba(0,69,13,0.12); border-color: rgba(0,69,13,0.15); }
        .status-badge {
          display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 99px;
          font-size: 10px; font-weight: 700; font-family: 'Manrope', sans-serif;
          letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; flex-shrink: 0;
        }
        .progress-bar { height: 6px; border-radius: 99px; background: #f0fdf4; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 99px; }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.10s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.20s both; }
        .s5 { animation: staggerIn 0.5s ease 0.25s both; }
      `}</style>

      {/* Hero */}
      <section className="mb-10 s1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="font-headline font-extrabold tracking-tight"
            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
            Route <span style={{ color: '#1b5e20' }}>Intelligence</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: '#f0fdf4' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#16a34a' }} />
              <span className="text-sm font-medium" style={{ color: '#14532d', fontFamily: 'Inter, sans-serif' }}>
                {stats.activeRoutes > 0 ? `${stats.activeRoutes} Active Route${stats.activeRoutes > 1 ? 's' : ''}` : 'No Active Routes'}
              </span>
            </div>
            <Link href="/dashboard/driver/routes"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80"
              style={{ background: '#1b5e20', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>route</span>
              View Routes
            </Link>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
              style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#717a6d' }}>Loading route data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Row 1 — green featured card + performance */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">

            <div className="bento-card-green md:col-span-8 p-8 s2">
              <div className="absolute top-0 right-0 w-56 h-56 rounded-full -mr-20 -mt-20"
                style={{ background: 'rgba(163,246,156,0.06)' }} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <span className="font-label text-xs font-bold uppercase block mb-2"
                      style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)' }}>Fleet Status</span>
                    <h2 className="font-headline font-extrabold text-3xl tracking-tight">
                      {profile?.full_name?.split(' ')[0] || 'Driver'}&apos;s Dashboard
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '4px' }}>
                      {profile?.district || 'CMC District'} · Collection Operations
                    </p>
                  </div>
                  <div className="p-3 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>local_shipping</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Routes', value: stats.totalRoutes, icon: 'route' },
                    { label: 'Completed', value: stats.completedCollections, icon: 'check_circle' },
                    { label: 'Skipped', value: stats.skippedCollections, icon: 'cancel' },
                    { label: 'Fuel Logs', value: stats.totalFuelLogs, icon: 'local_gas_station' },
                  ].map(m => (
                    <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <span className="material-symbols-outlined mb-2 block"
                        style={{ color: 'rgba(163,246,156,0.7)', fontSize: '18px' }}>{m.icon}</span>
                      <p className="font-headline font-bold text-2xl">{m.value}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bento-card md:col-span-4 p-8 flex flex-col justify-between s2">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Performance</h2>
                  <span className="material-symbols-outlined" style={{ color: '#717a6d', fontSize: '20px' }}>insights</span>
                </div>
                <div className="flex flex-col items-center mb-6">
                  <div className="relative w-32 h-32 mb-3">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#f0fdf4" strokeWidth="8" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#00450d" strokeWidth="8"
                        strokeLinecap="round" strokeDasharray={`${completionRate * 2.51} 251`} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-headline font-extrabold text-2xl" style={{ color: '#181c22' }}>{completionRate}%</span>
                      <span className="text-xs" style={{ color: '#717a6d' }}>completion</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Collections Done', value: stats.completedCollections, total: stats.totalCollections, color: '#00450d' },
                    { label: 'Routes Completed', value: stats.completedRoutes, total: stats.totalRoutes, color: '#1b5e20' },
                  ].map(m => (
                    <div key={m.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: '#717a6d' }}>{m.label}</span>
                        <span className="font-bold" style={{ color: m.color }}>{m.value}/{m.total}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill"
                          style={{ width: `${m.total > 0 ? Math.round((m.value / m.total) * 100) : 0}%`, background: m.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 — 4 stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 s3">
            {[
              { label: 'Total Routes', value: stats.totalRoutes, sub: `${stats.activeRoutes} active`, icon: 'route', color: '#00450d' },
              { label: 'Collections', value: stats.totalCollections, sub: `${completionRate}% complete`, icon: 'delete_sweep', color: '#1b5e20' },
              { label: 'Fuel Logs', value: stats.totalFuelLogs, sub: 'Recorded refills', icon: 'local_gas_station', color: '#2e7d32' },
              { label: 'Breakdowns', value: stats.totalBreakdowns, sub: 'Reports filed', icon: 'car_crash', color: '#ba1a1a' },
            ].map(m => (
              <div key={m.label} className="bento-card p-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${m.color}12` }}>
                  <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '20px' }}>{m.icon}</span>
                </div>
                <p className="font-headline font-extrabold text-3xl tracking-tight mb-1" style={{ color: '#181c22' }}>{m.value}</p>
                <p className="font-label text-xs font-bold uppercase mb-1" style={{ letterSpacing: '0.12em', color: '#94a3b8' }}>{m.label}</p>
                <p className="text-xs font-semibold" style={{ color: m.color }}>{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Row 3 — today's routes + recent collections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 s4">

            <div className="bento-card p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Today&apos;s Routes</h3>
                <Link href="/dashboard/driver/routes"
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:opacity-70 transition-opacity"
                  style={{ color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                  All Routes
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                </Link>
              </div>
              {todayRoutes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>route</span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#181c22' }}>No routes today</p>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Check back later for assignments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayRoutes.map(r => (
                    <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: '#f8fafc' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f0fdf4' }}>
                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>route</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#181c22' }}>
                          {r.route_name || `Route ${r.id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>
                          {r.district} · {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="status-badge" style={routeStatusStyle(r.status)}>{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/dashboard/driver/routes"
                style={{ background: '#00450d', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 700 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>route</span>
                Go to Routes
              </Link>
            </div>

            <div className="bento-card p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Recent Collections</h3>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: '#f0fdf4' }}>
                  <span className="text-xs font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                    {completionRate}% done
                  </span>
                </div>
              </div>
              {recentCollections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>delete_sweep</span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#181c22' }}>No collections yet</p>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Start your route to log collections</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentCollections.map(c => (
                    <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: '#f8fafc' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: c.status === 'completed' ? '#f0fdf4' : '#fef2f2' }}>
                        <span className="material-symbols-outlined"
                          style={{ color: c.status === 'completed' ? '#00450d' : '#ba1a1a', fontSize: '18px' }}>
                          {c.status === 'completed' ? 'check_circle' : 'cancel'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#181c22' }}>
                          {c.collection_stops?.address || 'Collection Stop'}
                          {c.collection_stops?.is_commercial && (
                            <span className="ml-2 text-xs font-bold" style={{ color: '#1d4ed8' }}>Commercial</span>
                          )}
                        </p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>{new Date(c.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="status-badge" style={collectionStatusStyle(c.status)}>{c.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 4 — quick actions */}
          <div className="s5">
            <h3 className="font-headline font-bold text-base mb-4" style={{ color: '#181c22' }}>Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {QUICK_LINKS.map(link => (
                <Link key={link.href} href={link.href} className="quick-link">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: `${link.color}12` }}>
                    <span className="material-symbols-outlined" style={{ color: link.color, fontSize: '22px' }}>{link.icon}</span>
                  </div>
                  <p className="font-bold text-sm mb-1" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{link.label}</p>
                  <p className="text-xs" style={{ color: '#717a6d' }}>{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Blockchain bar */}
          <div className="mt-6 p-6 rounded-2xl flex items-center justify-between s5"
            style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.08)' }}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>verified</span>
              <div>
                <p className="text-sm font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                  Blockchain-verified collections
                </p>
                <p className="text-xs" style={{ color: '#717a6d' }}>
                  Every collection stop is logged on Polygon Amoy
                </p>
              </div>
            </div>
            <Link href="/dashboard/driver/routes"
              className="px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90 whitespace-nowrap"
              style={{ background: '#00450d', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
              Start Route
            </Link>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}