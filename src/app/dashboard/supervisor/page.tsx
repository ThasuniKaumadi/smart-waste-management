'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ROLE_DASHBOARDS } from '@/lib/types'
import AnnouncementsWidget from '@/components/AnnouncementsWidget'

interface Profile {
  id: string
  full_name: string
  role: string
  district: string
  assigned_wards: string[]
}

interface AlertItem {
  id: string
  alert_type: string
  severity: string
  message: string
  created_at: string
  resolved: boolean
  driver_id: string
  route_id: string
}

interface RouteItem {
  id: string
  route_name: string
  name: string
  district: string
  status: string
  driver_id: string | null
  total_stops: number
  completed_stops: number
  skipped_stops: number
  driver_name?: string
  alert_count?: number
  shift?: string
}

interface ScheduleItem {
  id: string
  waste_type: string
  collection_day: string
  collection_time: string
  scheduled_date: string
  wards: string[]
  ward: string
  published: boolean
}

export default function SupervisorDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [stats, setStats] = useState({
    activeRoutes: 0, unresolvedAlerts: 0, completedToday: 0, driversOnDuty: 0,
  })
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'overview' | 'monitor'>('overview')
  const [refreshing, setRefreshing] = useState(false)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    init()
    return () => {
      const supabase = createClient()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [router])

  async function init() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || prof.role !== 'supervisor') {
      router.push(prof?.role ? ROLE_DASHBOARDS[prof.role as keyof typeof ROLE_DASHBOARDS] : '/login')
      return
    }
    setProfile(prof)
    await loadData(user.id, prof)
    setLoading(false)

    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase
      .channel('supervisor-dashboard-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'exception_alerts',
      }, (payload) => {
        const newAlert = payload.new as AlertItem
        setAlerts(prev => [newAlert, ...prev.slice(0, 7)])
        setStats(prev => ({ ...prev, unresolvedAlerts: prev.unresolvedAlerts + 1 }))
      })
      .subscribe()
  }

  async function loadData(userId: string, prof: any) {
    const supabase = createClient()
    const wards: string[] = prof?.assigned_wards || []

    const { data: alertData } = await supabase
      .from('exception_alerts').select('*')
      .eq('is_resolved', false).order('created_at', { ascending: false }).limit(8)

    const { count: unresolvedCount } = await supabase
      .from('exception_alerts').select('*', { count: 'exact', head: true }).eq('is_resolved', false)

    let routeQuery = supabase
      .from('routes')
      .select(`
        id, route_name, district, status, driver_id, ward, shift,
        profiles:driver_id(full_name),
        collection_stops(id, status)
      `)
      .eq('district', prof?.district || '')
      .order('created_at', { ascending: false })
      .limit(12)
    if (wards.length > 0) {
      routeQuery = routeQuery.in('ward', wards)
    }
    const { data: routeData } = await routeQuery

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: completedCount } = await supabase
      .from('collection_events').select('*', { count: 'exact', head: true })
      .eq('status', 'completed').gte('collected_at', today.toISOString())

    let scheduleQuery = supabase
      .from('schedules').select('*')
      .eq('published', true)
      .eq('district', prof?.district || '')
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true })
      .limit(5)
    if (wards.length > 0) {
      scheduleQuery = scheduleQuery.overlaps('wards', wards)
    }
    const { data: scheduleData } = await scheduleQuery

    setAlerts(alertData || [])
    setSchedules(scheduleData || [])

    const enrichedRoutes: RouteItem[] = (routeData || []).map((r: any) => {
      const stops = r.collection_stops || []
      const completedStops = stops.filter((s: any) => s.status === 'completed').length
      const skippedStops = stops.filter((s: any) => s.status === 'skipped').length
      const routeAlerts = (alertData || []).filter(a => a.route_id === r.id).length
      return {
        id: r.id,
        route_name: r.route_name || r.name || `Route ${r.id.slice(0, 6)}`,
        name: r.route_name || r.name || `Route ${r.id.slice(0, 6)}`,
        district: r.district,
        status: r.status,
        driver_id: r.driver_id,
        driver_name: (r.profiles as any)?.full_name || null,
        total_stops: stops.length,
        completed_stops: completedStops,
        skipped_stops: skippedStops,
        alert_count: routeAlerts,
        shift: r.shift || null,
      }
    })

    setRoutes(enrichedRoutes)
    setStats({
      activeRoutes: enrichedRoutes.filter(r => r.status === 'active').length,
      unresolvedAlerts: unresolvedCount || 0,
      completedToday: completedCount || 0,
      driversOnDuty: enrichedRoutes.filter(r => r.driver_id && r.status === 'active').length,
    })
  }

  async function refresh() {
    setRefreshing(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user && profile) await loadData(user.id, profile)
    setRefreshing(false)
  }

  async function resolveAlert(alertId: string) {
    const supabase = createClient()
    await supabase.from('exception_alerts')
      .update({ is_resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', alertId)
    setAlerts(prev => prev.filter(a => a.id !== alertId))
    setStats(prev => ({ ...prev, unresolvedAlerts: Math.max(0, prev.unresolvedAlerts - 1) }))
  }

  const severityColor: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e',
  }
  const severityBg: Record<string, string> = {
    critical: 'rgba(239,68,68,0.08)', high: 'rgba(249,115,22,0.08)',
    medium: 'rgba(234,179,8,0.08)', low: 'rgba(34,197,94,0.08)',
  }
  const routeStatusColor: Record<string, { bg: string; text: string; dot: string }> = {
    active: { bg: 'rgba(0,69,13,0.08)', text: '#00450d', dot: '#00450d' },
    completed: { bg: 'rgba(59,130,246,0.08)', text: '#2563eb', dot: '#3b82f6' },
    planned: { bg: 'rgba(107,114,128,0.08)', text: '#6b7280', dot: '#9ca3af' },
    suspended: { bg: 'rgba(239,68,68,0.08)', text: '#dc2626', dot: '#ef4444' },
  }
  const wasteTypeColor: Record<string, string> = {
    organic: '#00450d', non_recyclable: '#ba1a1a', recyclable: '#1d4ed8', e_waste: '#7c3aed', bulk: '#d97706',
  }

  const timeGreeting = () => {
    const h = currentTime.getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const assignedWards = profile?.assigned_wards || []
  const activeRoutes = routes.filter(r => r.status === 'active')
  const allRoutes = routes

  const dayRoutes = routes.filter(r => r.shift === 'day' || !r.shift)
  const nightRoutes = routes.filter(r => r.shift === 'night')
  const shiftSummary = [
    {
      label: 'Morning Shift', icon: 'wb_sunny', color: '#d97706', bg: '#fefce8',
      routes: dayRoutes.length,
      active: dayRoutes.filter(r => r.status === 'active').length,
      completed: dayRoutes.filter(r => r.status === 'completed').length,
      alerts: dayRoutes.reduce((s, r) => s + (r.alert_count || 0), 0),
      stops: dayRoutes.reduce((s, r) => s + r.completed_stops, 0),
    },
    {
      label: 'Evening Shift', icon: 'nights_stay', color: '#4338ca', bg: '#eef2ff',
      routes: nightRoutes.length,
      active: nightRoutes.filter(r => r.status === 'active').length,
      completed: nightRoutes.filter(r => r.status === 'completed').length,
      alerts: nightRoutes.reduce((s, r) => s + (r.alert_count || 0), 0),
      stops: nightRoutes.reduce((s, r) => s + r.completed_stops, 0),
    },
  ]

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f3' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', border: '2.5px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ fontSize: '13px', color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>Loading supervisor dashboard...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f3', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Manrope:wght@400;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .stat-card { transition:transform 0.2s ease,box-shadow 0.2s ease; }
        .stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.09); }
        .nav-link { transition:color 0.2s,background 0.2s; }
        .nav-link:hover { background:rgba(0,69,13,0.07); color:#00450d; }
        .alert-row { transition:background 0.15s; }
        .alert-row:hover { background:rgba(0,0,0,0.02); }
        .resolve-btn { transition:background 0.15s,transform 0.1s; cursor:pointer; }
        .resolve-btn:hover { background:rgba(0,69,13,0.12); }
        .route-monitor-card { background:white; border-radius:14px; border:1.5px solid rgba(0,69,13,0.06); padding:20px; transition:all 0.2s ease; }
        .route-monitor-card:hover { border-color:rgba(0,69,13,0.15); box-shadow:0 4px 16px rgba(0,0,0,0.08); }
        .route-monitor-card.active-route { border-color:rgba(0,69,13,0.2); }
        .route-monitor-card.alert-route { border-color:rgba(239,68,68,0.25); background:#fffafa; }
        .action-card { transition:transform 0.2s,box-shadow 0.2s; cursor:pointer; }
        .action-card:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.1); }
        .ward-pill { display:inline-flex; align-items:center; gap:4px; padding:4px 12px; background:rgba(0,69,13,0.08); color:#00450d; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; }
        .tab-btn { padding:8px 18px; border-radius:99px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .tab-active { background:#00450d; color:white; }
        .tab-inactive { background:white; color:#717a6d; border:1px solid rgba(0,0,0,0.08); }
        .tab-inactive:hover { background:#f0fdf4; color:#00450d; }
        .progress-track { height:6px; border-radius:99px; background:#f0fdf4; overflow:hidden; }
        .progress-fill { height:100%; border-radius:99px; transition:width 0.8s ease; }
        .schedule-row { padding:12px 16px; border-bottom:1px solid rgba(0,0,0,0.04); transition:background 0.15s; }
        .schedule-row:last-child { border-bottom:none; }
        .logout-btn:hover { background:rgba(239,68,68,0.08); color:#dc2626; }
        .logout-btn { transition:background 0.2s,color 0.2s; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        .live-dot { animation: pulse 2s ease-in-out infinite; }
      `}</style>

      {/* Nav */}
      <nav style={{ background: 'white', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#00450d' }}>eco</span>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '16px', color: '#00450d', letterSpacing: '-0.02em' }}>EcoLedger</span>
          </div>
          <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.1)' }} />
          <span style={{ fontSize: '12px', color: '#717a6d', fontWeight: 500 }}>Field Supervisor</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[
            { icon: 'home', label: 'Overview', href: '/dashboard/supervisor', badge: 0 },
            { icon: 'notifications', label: 'Alerts', href: '/dashboard/supervisor/alerts', badge: stats.unresolvedAlerts },
            { icon: 'route', label: 'Routes', href: '/dashboard/supervisor/routes', badge: 0 },
            { icon: 'assignment', label: 'Reports', href: '/dashboard/supervisor/waste-reports', badge: 0 },
          ].map(item => (
            <Link key={item.label} href={item.href} className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', textDecoration: 'none', color: '#41493e', fontSize: '13px', fontWeight: 500, position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ position: 'absolute', top: '2px', right: '6px', background: '#ef4444', color: 'white', borderRadius: '9999px', fontSize: '9px', fontWeight: 700, minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: 0 }}>{profile?.full_name}</p>
            <p style={{ fontSize: '11px', color: '#717a6d', margin: 0 }}>{profile?.district || 'All Districts'}</p>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #00450d, #1b5e20)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '14px', fontWeight: 700 }}>
            {profile?.full_name?.charAt(0) || 'S'}
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '12px', color: '#717a6d', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>
              {timeGreeting()}, {profile?.full_name?.split(' ')[0]}
            </p>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '28px', fontWeight: 800, color: '#181c22', margin: 0 }}>
              Supervisor Overview
            </h1>
            <p style={{ fontSize: '13px', color: '#717a6d', margin: '4px 0 0' }}>
              {currentTime.toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(0,69,13,0.2)', background: 'white', color: '#00450d', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', cursor: 'pointer' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>refresh</span>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setActiveTab('overview')} className={`tab-btn ${activeTab === 'overview' ? 'tab-active' : 'tab-inactive'}`}>Overview</button>
              <button onClick={() => setActiveTab('monitor')} className={`tab-btn ${activeTab === 'monitor' ? 'tab-active' : 'tab-inactive'}`} style={{ position: 'relative' }}>
                Live Monitor
                {stats.activeRoutes > 0 && (
                  <span style={{ marginLeft: '6px', background: activeTab === 'monitor' ? 'rgba(255,255,255,0.3)' : '#00450d', color: 'white', borderRadius: '99px', fontSize: '10px', fontWeight: 700, padding: '1px 6px' }}>
                    {stats.activeRoutes}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <AnnouncementsWidget role="supervisor" district={profile?.district} compact />

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { icon: 'route', label: 'Active Routes', value: stats.activeRoutes, color: '#00450d', bg: 'rgba(0,69,13,0.06)', sub: 'In progress today' },
            { icon: 'warning', label: 'Unresolved Alerts', value: stats.unresolvedAlerts, color: stats.unresolvedAlerts > 0 ? '#dc2626' : '#00450d', bg: stats.unresolvedAlerts > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(0,69,13,0.06)', sub: 'Require attention' },
            { icon: 'check_circle', label: 'Completed Today', value: stats.completedToday, color: '#2563eb', bg: 'rgba(37,99,235,0.06)', sub: 'Collection stops' },
            { icon: 'person_pin_circle', label: 'Drivers on Duty', value: stats.driversOnDuty, color: '#7c3aed', bg: 'rgba(124,58,237,0.06)', sub: 'Assigned to routes' },
          ].map(card => (
            <div key={card.label} className="stat-card" style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: card.color }}>{card.icon}</span>
              </div>
              <p style={{ fontSize: '32px', fontFamily: 'Manrope, sans-serif', fontWeight: 800, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{card.value}</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#41493e', margin: '0 0 2px' }}>{card.label}</p>
              <p style={{ fontSize: '11px', color: '#717a6d', margin: 0 }}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Shift Summary */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {shiftSummary.map(shift => (
              <div key={shift.label} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: shift.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: shift.color }}>{shift.icon}</span>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', color: '#181c22', margin: 0 }}>{shift.label}</p>
                      <p style={{ fontSize: '11px', color: '#717a6d', margin: 0 }}>{shift.routes} route{shift.routes !== 1 ? 's' : ''} today</p>
                    </div>
                  </div>
                  {shift.alerts > 0 && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px', background: '#fef2f2', color: '#dc2626', fontFamily: 'Manrope, sans-serif' }}>
                      {shift.alerts} alert{shift.alerts !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[
                    { label: 'Active', value: shift.active, color: '#1d4ed8' },
                    { label: 'Completed', value: shift.completed, color: '#00450d' },
                    { label: 'Stops done', value: shift.stops, color: '#7c3aed' },
                    { label: 'Alerts', value: shift.alerts, color: shift.alerts > 0 ? '#dc2626' : '#94a3b8' },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', textAlign: 'center' }}>
                      <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '20px', color: m.color, margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                      <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</p>
                    </div>
                  ))}
                </div>
                {shift.routes > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#717a6d' }}>Completion rate</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#00450d' }}>
                        {Math.round((shift.completed / shift.routes) * 100)}%
                      </span>
                    </div>
                    <div style={{ height: '5px', background: '#f0fdf4', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '99px', background: shift.color, width: `${Math.round((shift.completed / shift.routes) * 100)}%`, transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,69,13,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00450d' }}>map</span>
                  </div>
                  <div>
                    <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>My Assigned Wards</h2>
                    <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>{profile?.district || 'All Districts'}</p>
                  </div>
                </div>
                {assignedWards.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', background: '#f4f6f3', borderRadius: '12px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#00450d', display: 'block', marginBottom: '8px' }}>public</span>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#181c22', margin: '0 0 4px' }}>All wards</p>
                    <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>You supervise the entire district</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                      {assignedWards.map(ward => (
                        <span key={ward} className="ward-pill">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                          {ward}
                        </span>
                      ))}
                    </div>
                    <p style={{ fontSize: '12px', color: '#717a6d', padding: '10px 14px', background: '#f4f6f3', borderRadius: '8px' }}>
                      You are responsible for {assignedWards.length} ward{assignedWards.length > 1 ? 's' : ''} in this district.
                    </p>
                  </>
                )}
              </div>

              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: '0 0 20px' }}>My Upcoming Schedules</h2>
                {schedules.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', background: '#f4f6f3', borderRadius: '12px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#c4c9c0', display: 'block', marginBottom: '8px' }}>calendar_today</span>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#41493e', margin: '0 0 4px' }}>No schedules assigned</p>
                    <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>The DE will assign schedules to you</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {schedules.map(schedule => {
                      const color = wasteTypeColor[schedule.waste_type] || '#64748b'
                      const scheduleWards = schedule.wards?.length > 0 ? schedule.wards : schedule.ward ? [schedule.ward] : []
                      return (
                        <div key={schedule.id} className="schedule-row" style={{ borderRadius: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '16px', color }}>delete_sweep</span>
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: '0 0 2px' }}>
                                {schedule.waste_type?.replace(/_/g, ' ')} collection
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', color: '#717a6d' }}>
                                  {new Date(schedule.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {schedule.collection_time}
                                </span>
                                {scheduleWards.length > 0 && (
                                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '99px', background: 'rgba(0,69,13,0.07)', color: '#00450d' }}>
                                    {scheduleWards.length === 1 ? scheduleWards[0] : `${scheduleWards.length} wards`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Alerts + Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', marginBottom: '20px' }}>
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="live-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: stats.unresolvedAlerts > 0 ? '#ef4444' : '#22c55e', boxShadow: stats.unresolvedAlerts > 0 ? '0 0 0 3px rgba(239,68,68,0.2)' : '0 0 0 3px rgba(34,197,94,0.2)' }} />
                    <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>Live Exception Alerts</h2>
                  </div>
                  <Link href="/dashboard/supervisor/alerts" style={{ fontSize: '12px', color: '#00450d', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    View all <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                  </Link>
                </div>
                {alerts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#22c55e', display: 'block', marginBottom: '12px' }}>check_circle</span>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#41493e', margin: '0 0 4px' }}>All clear</p>
                    <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>No unresolved alerts right now</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {alerts.slice(0, 5).map(alert => (
                      <div key={alert.id} className="alert-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px', borderRadius: '10px', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, marginTop: '1px', background: severityBg[alert.severity] || 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: severityColor[alert.severity] || '#717a6d' }}>
                              {alert.alert_type === 'breakdown' ? 'car_crash' : alert.alert_type === 'skip' ? 'do_not_disturb_on' : 'warning'}
                            </span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#181c22', textTransform: 'capitalize' }}>{alert.alert_type?.replace('_', ' ') || 'Alert'}</span>
                              <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', background: severityBg[alert.severity], color: severityColor[alert.severity], textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {alert.severity}
                              </span>
                            </div>
                            <p style={{ fontSize: '12px', color: '#717a6d', margin: '0 0 3px', lineHeight: 1.4 }}>{alert.message}</p>
                            <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>
                              {new Date(alert.created_at).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => resolveAlert(alert.id)} className="resolve-btn" style={{ flexShrink: 0, border: 'none', background: 'rgba(0,69,13,0.06)', borderRadius: '6px', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#00450d' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span>
                          Resolve
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
                  <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: '0 0 16px' }}>Quick Actions</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { icon: 'notifications_active', label: 'Manage Alerts', sub: 'Review & resolve exceptions', href: '/dashboard/supervisor/alerts', color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
                      { icon: 'route', label: 'View Routes', sub: 'Monitor collection routes', href: '/dashboard/supervisor/routes', color: '#1d4ed8', bg: 'rgba(29,78,216,0.06)' },
                      { icon: 'feedback', label: 'Complaints', sub: 'Resident complaints in district', href: '/dashboard/supervisor/complaints', color: '#d97706', bg: 'rgba(217,119,6,0.06)' },
                      { icon: 'content_paste', label: 'Waste Reports', sub: 'Review crowdsourced reports', href: '/dashboard/supervisor/waste-reports', color: '#7c3aed', bg: 'rgba(124,58,237,0.06)' },
                    ].map(action => (
                      <Link key={action.label} href={action.href} style={{ textDecoration: 'none' }}>
                        <div className="action-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: action.color }}>{action.icon}</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: 0 }}>{action.label}</p>
                            <p style={{ fontSize: '11px', color: '#717a6d', margin: 0 }}>{action.sub}</p>
                          </div>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#c4c9c0' }}>chevron_right</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #00450d, #1b5e20)', borderRadius: '16px', padding: '20px', color: 'white' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)' }}>verified</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>System Status</span>
                  </div>
                  {[
                    { label: 'Blockchain Network', status: 'Online' },
                    { label: 'GPS Tracking', status: 'Active' },
                    { label: 'Supabase DB', status: 'Healthy' },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>{s.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80' }} />
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#4ade80' }}>{s.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* LIVE MONITOR TAB */}
        {activeTab === 'monitor' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="live-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)' }} />
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '18px', color: '#181c22', margin: 0 }}>
                  Live Route Monitor — {allRoutes.length} Routes
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#717a6d' }}>
                <span style={{ padding: '4px 10px', borderRadius: '99px', background: 'rgba(0,69,13,0.08)', color: '#00450d', fontWeight: 700 }}>{activeRoutes.length} active</span>
                <span style={{ padding: '4px 10px', borderRadius: '99px', background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontWeight: 700 }}>{alerts.length} alerts</span>
              </div>
            </div>

            {alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: '22px', flexShrink: 0 }}>emergency</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#ba1a1a', fontFamily: 'Manrope, sans-serif', margin: '0 0 2px' }}>
                    {alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length} high-priority alert{alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length > 1 ? 's' : ''} require immediate attention
                  </p>
                  <p style={{ fontSize: '12px', color: '#dc2626', margin: 0 }}>
                    {alerts.filter(a => a.severity === 'critical' || a.severity === 'high').map(a => a.message).join(' · ')}
                  </p>
                </div>
                <Link href="/dashboard/supervisor/alerts" style={{ padding: '8px 14px', borderRadius: '8px', background: '#ba1a1a', color: 'white', textDecoration: 'none', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', flexShrink: 0 }}>
                  Manage Alerts
                </Link>
              </div>
            )}

            {allRoutes.length === 0 ? (
              <div style={{ background: 'white', borderRadius: '16px', padding: '60px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#c4c9c0', display: 'block', marginBottom: '16px' }}>route</span>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#41493e', margin: '0 0 8px' }}>No routes to monitor</p>
                <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>Routes assigned to drivers will appear here in real-time</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                {allRoutes.map(route => {
                  const sc = routeStatusColor[route.status] || routeStatusColor.planned
                  const completionPct = route.total_stops > 0 ? Math.round((route.completed_stops / route.total_stops) * 100) : 0
                  const routeAlerts = alerts.filter(a => a.route_id === route.id)
                  const hasAlerts = routeAlerts.length > 0
                  const isActive = route.status === 'active'
                  return (
                    <div key={route.id} className={`route-monitor-card ${isActive ? 'active-route' : ''} ${hasAlerts ? 'alert-route' : ''}`}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', margin: 0, fontFamily: 'Manrope, sans-serif' }}>{route.route_name}</p>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: sc.bg, color: sc.text, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                              {route.status}
                            </span>
                            {hasAlerts && (
                              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: 'rgba(239,68,68,0.1)', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>warning</span>
                                {routeAlerts.length} alert{routeAlerts.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>{route.district}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '10px 12px', borderRadius: '10px', background: route.driver_id ? 'rgba(0,69,13,0.05)' : '#f8fafc' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: route.driver_id ? '#00450d' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: route.driver_id ? 'white' : '#9ca3af' }}>person</span>
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: route.driver_id ? '#181c22' : '#9ca3af', margin: 0 }}>{route.driver_name || 'No driver assigned'}</p>
                          {route.driver_id && isActive && (
                            <p style={{ fontSize: '11px', color: '#00450d', margin: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                              On duty
                            </p>
                          )}
                        </div>
                      </div>
                      {route.total_stops > 0 && (
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '12px', color: '#717a6d' }}>Collection Progress</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: completionPct >= 80 ? '#00450d' : completionPct >= 50 ? '#d97706' : '#64748b' }}>{completionPct}%</span>
                          </div>
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${completionPct}%`, background: completionPct >= 80 ? '#00450d' : completionPct >= 50 ? '#d97706' : '#94a3b8' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px', color: '#94a3b8' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#00450d', fontWeight: 600 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check_circle</span>
                              {route.completed_stops} done
                            </span>
                            {route.skipped_stops > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#dc2626', fontWeight: 600 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>cancel</span>
                                {route.skipped_stops} skipped
                              </span>
                            )}
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>location_on</span>
                              {route.total_stops} total
                            </span>
                          </div>
                        </div>
                      )}
                      {hasAlerts && (
                        <div style={{ borderTop: '1px solid rgba(239,68,68,0.1)', paddingTop: '12px' }}>
                          {routeAlerts.slice(0, 2).map(a => (
                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', background: 'rgba(239,68,68,0.05)', marginBottom: '4px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: severityColor[a.severity] || '#dc2626', flexShrink: 0 }}>
                                {a.alert_type === 'breakdown' ? 'car_crash' : 'warning'}
                              </span>
                              <p style={{ fontSize: '11px', color: '#dc2626', margin: 0, flex: 1, lineHeight: 1.3 }}>{a.message}</p>
                              <button onClick={() => resolveAlert(a.id)} style={{ border: 'none', color: '#00450d', fontSize: '10px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,69,13,0.08)' }}>
                                Resolve
                              </button>
                            </div>
                          ))}
                          {routeAlerts.length > 2 && (
                            <Link href="/dashboard/supervisor/alerts" style={{ fontSize: '11px', color: '#00450d', fontWeight: 600, textDecoration: 'none' }}>
                              +{routeAlerts.length - 2} more alerts →
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}