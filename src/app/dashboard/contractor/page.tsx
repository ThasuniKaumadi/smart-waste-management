'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import AnnouncementsWidget from '@/components/AnnouncementsWidget'

const CONTRACTOR_NAV = [
  { label: 'Overview', href: '/dashboard/contractor', icon: 'dashboard' },
  { label: 'Routes', href: '/dashboard/contractor/routes', icon: 'route' },
  { label: 'Drivers', href: '/dashboard/contractor/drivers', icon: 'people' },
  { label: 'Breakdowns', href: '/dashboard/contractor/breakdowns', icon: 'car_crash' },
  { label: 'Contracts', href: '/dashboard/contractor/contracts', icon: 'description' },
  { label: 'Fleet', href: '/dashboard/contractor/fleet', icon: 'local_shipping' },
  { label: 'Billing', href: '/dashboard/contractor/billing', icon: 'receipt_long' },
  { label: 'Incidents', href: '/dashboard/contractor/incidents', icon: 'warning' },
  { label: 'Messages', href: '/dashboard/contractor/messages', icon: 'chat' },
  { label: 'Zones', href: '/dashboard/contractor/zones', icon: 'map' },
  { label: 'Staff', href: '/dashboard/contractor/staff', icon: 'badge' },
]

const WASTE_COLORS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  organic: { label: 'Organic Waste', color: '#00450d', bg: 'rgba(0,69,13,0.08)', icon: 'compost' },
  non_recyclable: { label: 'Non-Recyclable', color: '#dc2626', bg: 'rgba(220,38,38,0.08)', icon: 'delete' },
  recyclable: { label: 'Recyclable', color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)', icon: 'recycling' },
  e_waste: { label: 'E-Waste', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', icon: 'computer' },
  bulk: { label: 'Bulk Waste', color: '#d97706', bg: 'rgba(217,119,6,0.08)', icon: 'inventory_2' },
}

export default function ContractorDashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRoutes: 0, activeRoutes: 0, completedRoutes: 0, totalDrivers: 0,
    totalCollections: 0, completedCollections: 0, skippedCollections: 0,
    totalBreakdowns: 0, openBreakdowns: 0,
  })
  const [recentRoutes, setRecentRoutes] = useState<any[]>([])
  const [recentBreakdowns, setRecentBreakdowns] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    const [
      { count: totalRoutes }, { count: activeRoutes }, { count: completedRoutes },
      { count: totalDrivers }, { count: totalCollections }, { count: completedCollections },
      { count: skippedCollections }, { count: totalBreakdowns }, { count: openBreakdowns },
    ] = await Promise.all([
      supabase.from('routes').select('*', { count: 'exact', head: true }).eq('contractor_id', user.id),
      supabase.from('routes').select('*', { count: 'exact', head: true }).eq('contractor_id', user.id).eq('status', 'active'),
      supabase.from('routes').select('*', { count: 'exact', head: true }).eq('contractor_id', user.id).eq('status', 'completed'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'driver'),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }).eq('status', 'skipped'),
      supabase.from('breakdown_reports').select('*', { count: 'exact', head: true }),
      supabase.from('breakdown_reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    ])

    setStats({
      totalRoutes: totalRoutes || 0, activeRoutes: activeRoutes || 0, completedRoutes: completedRoutes || 0,
      totalDrivers: totalDrivers || 0, totalCollections: totalCollections || 0,
      completedCollections: completedCollections || 0, skippedCollections: skippedCollections || 0,
      totalBreakdowns: totalBreakdowns || 0, openBreakdowns: openBreakdowns || 0,
    })

    const { data: routes } = await supabase
      .from('routes').select('*').eq('contractor_id', user.id)
      .order('created_at', { ascending: false }).limit(4)
    setRecentRoutes(routes || [])

    const { data: breakdowns } = await supabase
      .from('breakdown_reports').select('*')
      .order('created_at', { ascending: false }).limit(4)
    setRecentBreakdowns(breakdowns || [])

    // Load published schedules for contractor's district
    if (p?.district) {
      const today = new Date().toISOString().split('T')[0]
      const { data: schedulesData } = await supabase
        .from('schedules').select('*')
        .eq('district', p.district)
        .eq('published', true)
        .gte('scheduled_date', today)
        .order('scheduled_date', { ascending: true })
        .limit(5)
      setSchedules(schedulesData || [])
    }

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

  const QUICK_LINKS = [
    { label: 'Create Route', desc: 'Plan and assign a new collection route', icon: 'add_road', href: '/dashboard/contractor/routes/new', color: '#00450d' },
    { label: 'Manage Routes', desc: 'View and monitor all active routes', icon: 'route', href: '/dashboard/contractor/routes', color: '#1b5e20' },
    { label: 'View Drivers', desc: 'Monitor driver assignments and status', icon: 'people', href: '/dashboard/contractor/drivers', color: '#2e7d32' },
    { label: 'Breakdowns', desc: 'Review vehicle breakdown reports', icon: 'car_crash', href: '/dashboard/contractor/breakdowns', color: '#ba1a1a' },
  ]

  return (
    <DashboardLayout
      role="Contractor"
      userName={profile?.full_name || profile?.organisation_name || ''}
      navItems={CONTRACTOR_NAV}
      primaryAction={{ label: 'New Route', href: '/dashboard/contractor/routes/new', icon: 'add' }}
    >
      <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); transition:all 0.4s cubic-bezier(0.05,0.7,0.1,1.0); overflow:hidden; }
        .bento-card:hover { transform:translateY(-4px); box-shadow:0 20px 50px -15px rgba(24,28,34,0.12); }
        .bento-card-green { background:#00450d; border-radius:16px; color:white; transition:all 0.4s cubic-bezier(0.05,0.7,0.1,1.0); overflow:hidden; position:relative; }
        .bento-card-green:hover { transform:translateY(-4px); }
        .quick-link { background:white; border-radius:16px; padding:24px; border:1px solid rgba(0,69,13,0.06); transition:all 0.35s cubic-bezier(0.05,0.7,0.1,1.0); text-decoration:none; display:block; }
        .quick-link:hover { transform:translateY(-4px); box-shadow:0 20px 40px -15px rgba(0,69,13,0.12); border-color:rgba(0,69,13,0.15); }
        .status-badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.08em; text-transform:uppercase; white-space:nowrap; flex-shrink:0; }
        .progress-bar { height:6px; border-radius:99px; background:#f0fdf4; overflow:hidden; }
        .progress-fill { height:100%; border-radius:99px; }
        .schedule-row { padding:14px 20px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:14px; transition:background 0.15s; }
        .schedule-row:hover { background:#f9f9ff; }
        .schedule-row:last-child { border-bottom:none; }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1 { animation:staggerIn 0.5s ease 0.05s both; }
        .s2 { animation:staggerIn 0.5s ease 0.10s both; }
        .s3 { animation:staggerIn 0.5s ease 0.15s both; }
        .s4 { animation:staggerIn 0.5s ease 0.20s both; }
        .s5 { animation:staggerIn 0.5s ease 0.25s both; }
        .s6 { animation:staggerIn 0.5s ease 0.30s both; }
      `}</style>

      {/* Hero */}
      <section className="mb-10 s1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="font-headline font-extrabold tracking-tight"
            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
            Fleet <span style={{ color: '#1b5e20' }}>Command</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: '#f0fdf4' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#16a34a' }} />
              <span className="text-sm font-medium" style={{ color: '#14532d', fontFamily: 'Inter, sans-serif' }}>
                {stats.activeRoutes} Active Route{stats.activeRoutes !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* Row 1 — green card + performance */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
            <div className="bento-card-green md:col-span-8 p-8 s2">
              <div className="absolute top-0 right-0 w-56 h-56 rounded-full -mr-20 -mt-20" style={{ background: 'rgba(163,246,156,0.06)' }} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>Logistics Overview</span>
                    <h2 className="font-headline font-extrabold text-3xl tracking-tight">Fleet Operations</h2>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '4px' }}>Real-time collection management</p>
                  </div>
                  <div className="p-3 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>local_shipping</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Routes', value: stats.totalRoutes, icon: 'route' },
                    { label: 'Collections', value: stats.completedCollections, icon: 'check_circle' },
                    { label: 'Drivers', value: stats.totalDrivers, icon: 'people' },
                    { label: 'Breakdowns', value: stats.openBreakdowns, icon: 'car_crash' },
                  ].map(m => (
                    <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <span className="material-symbols-outlined mb-2 block" style={{ color: 'rgba(163,246,156,0.7)', fontSize: '18px' }}>{m.icon}</span>
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
                  <div className="relative w-28 h-28 mb-3">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#f0fdf4" strokeWidth="8" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#00450d" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${completionRate * 2.51} 251`} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-headline font-extrabold text-xl" style={{ color: '#181c22' }}>{completionRate}%</span>
                      <span className="text-xs" style={{ color: '#717a6d' }}>done</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Completed', value: stats.completedCollections, total: stats.totalCollections, color: '#00450d' },
                    { label: 'Routes Done', value: stats.completedRoutes, total: stats.totalRoutes, color: '#1b5e20' },
                  ].map(m => (
                    <div key={m.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: '#717a6d' }}>{m.label}</span>
                        <span className="font-bold" style={{ color: m.color }}>{m.value}/{m.total}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${m.total > 0 ? Math.round((m.value / m.total) * 100) : 0}%`, background: m.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <AnnouncementsWidget role="contractor" district={profile?.district} compact />
          {/* Row 2 — 4 stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 s3">
            {[
              { label: 'Total Routes', value: stats.totalRoutes, sub: `${stats.activeRoutes} active`, icon: 'route', color: '#00450d' },
              { label: 'Collections', value: stats.totalCollections, sub: `${completionRate}% complete`, icon: 'delete_sweep', color: '#1b5e20' },
              { label: 'Skipped', value: stats.skippedCollections, sub: 'Missed stops', icon: 'cancel', color: '#ba1a1a' },
              { label: 'Breakdowns', value: stats.totalBreakdowns, sub: `${stats.openBreakdowns} open`, icon: 'car_crash', color: '#92400e' },
            ].map(m => (
              <div key={m.label} className="bento-card p-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${m.color}12` }}>
                  <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '20px' }}>{m.icon}</span>
                </div>
                <p className="font-headline font-extrabold text-3xl tracking-tight mb-1" style={{ color: '#181c22' }}>{m.value}</p>
                <p className="text-xs font-bold uppercase mb-1" style={{ letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>{m.label}</p>
                <p className="text-xs font-semibold" style={{ color: m.color }}>{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Row 3 — Collection Schedules */}
          <div className="bento-card mb-6 s4">
            <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
              <div>
                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Upcoming Collection Schedules</h3>
                <p className="text-xs mt-1" style={{ color: '#717a6d' }}>{profile?.district || 'Your district'}</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: '#f0fdf4' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#16a34a' }} />
                <span className="text-xs font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                  {schedules.length} upcoming
                </span>
              </div>
            </div>

            {schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                  <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>calendar_month</span>
                </div>
                <p className="text-sm font-medium" style={{ color: '#181c22' }}>No schedules published yet</p>
                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>The district engineer will publish schedules for your district</p>
              </div>
            ) : (
              <div>
                {schedules.map(s => {
                  const wc = WASTE_COLORS[s.waste_type] || { label: s.waste_type, color: '#64748b', bg: 'rgba(100,116,139,0.08)', icon: 'delete_sweep' }
                  const scheduleWards = s.wards?.length > 0 ? s.wards : s.ward ? [s.ward] : []
                  return (
                    <div key={s.id} className="schedule-row">
                      <div style={{ width: '40px', height: '40px', borderRadius: '11px', flexShrink: 0, background: wc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: wc.color }}>{wc.icon}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#181c22' }}>{wc.label}</span>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: wc.bg, color: wc.color, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Manrope, sans-serif' }}>
                            {s.frequency?.replace('_', ' ')}
                          </span>
                          {scheduleWards.length > 0 && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: 'rgba(0,69,13,0.07)', color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                              {scheduleWards.length === 1 ? scheduleWards[0] : `${scheduleWards.length} wards`}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px', color: '#717a6d' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>event</span>
                            {new Date(s.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>schedule</span>
                            {s.collection_day} at {s.collection_time}
                          </span>
                          {s.notes && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>info</span>
                              {s.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Row 4 — Recent routes + breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 s5">
            <div className="bento-card p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Recent Routes</h3>
                <Link href="/dashboard/contractor/routes" className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:opacity-70" style={{ color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                  All <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                </Link>
              </div>
              {recentRoutes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>route</span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#181c22' }}>No routes yet</p>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Create your first route</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentRoutes.map(r => (
                    <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: '#f8fafc' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f0fdf4' }}>
                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>route</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#181c22' }}>
                          {r.route_name || `Route ${r.id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>{r.district} · {new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="status-badge" style={routeStatusStyle(r.status)}>{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/dashboard/contractor/routes/new" style={{ background: '#00450d', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 700 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                New Route
              </Link>
            </div>

            <div className="bento-card p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Breakdown Alerts</h3>
                <Link href="/dashboard/contractor/breakdowns" className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:opacity-70" style={{ color: '#ba1a1a', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                  All <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                </Link>
              </div>
              {recentBreakdowns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>check_circle</span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#181c22' }}>No breakdowns reported</p>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Fleet is running smoothly</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentBreakdowns.map(b => (
                    <div key={b.id} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: '#fef2f2' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#ffdad6' }}>
                        <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '18px' }}>car_crash</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#181c22' }}>
                          {b.description?.slice(0, 40) || 'Breakdown reported'}
                        </p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>{new Date(b.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="status-badge" style={{ background: '#ffdad6', color: '#ba1a1a' }}>{b.status || 'open'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 5 — Quick actions */}
          <div className="s6">
            <h3 className="font-headline font-bold text-base mb-4" style={{ color: '#181c22' }}>Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {QUICK_LINKS.map(link => (
                <Link key={link.href} href={link.href} className="quick-link">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${link.color}12` }}>
                    <span className="material-symbols-outlined" style={{ color: link.color, fontSize: '22px' }}>{link.icon}</span>
                  </div>
                  <p className="font-bold text-sm mb-1" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{link.label}</p>
                  <p className="text-xs" style={{ color: '#717a6d' }}>{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}