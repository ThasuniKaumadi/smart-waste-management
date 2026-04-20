'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ROLE_DASHBOARDS } from '@/lib/types'
import DashboardLayout from '@/components/DashboardLayout'
import AnnouncementsWidget from '@/components/AnnouncementsWidget'

const SUPERVISOR_NAV = [
  { label: 'Overview', href: '/dashboard/supervisor', icon: 'dashboard', section: 'Menu' },
  { label: 'Schedules', href: '/dashboard/supervisor/schedules', icon: 'calendar_month', section: 'Menu' },
  { label: 'Routes', href: '/dashboard/supervisor/routes', icon: 'route', section: 'Menu' },
  { label: 'Drivers', href: '/dashboard/supervisor/drivers', icon: 'people', section: 'Menu' },
  { label: 'Track Route', href: '/dashboard/supervisor/track-route', icon: 'gps_fixed', section: 'Menu' },
  { label: 'Alerts', href: '/dashboard/supervisor/alerts', icon: 'notifications_active', section: 'Menu' },
  { label: 'Complaints', href: '/dashboard/supervisor/complaints', icon: 'feedback', section: 'Menu' },
  { label: 'Compliance', href: '/dashboard/supervisor/schedule-compliance', icon: 'fact_check', section: 'Menu' },
  { label: 'Waste Reports', href: '/dashboard/supervisor/waste-reports', icon: 'report', section: 'Menu' },
  { label: 'Ward Heatmap', href: '/dashboard/supervisor/heatmap', icon: 'map', section: 'Menu' },
  { label: 'Shift Report', href: '/dashboard/supervisor/shift-report', icon: 'picture_as_pdf', section: 'Menu' },
  { label: 'Announcements', href: '/dashboard/supervisor/announcements', icon: 'campaign', section: 'Menu' },
]

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
  const [vehicleLocations, setVehicleLocations] = useState<Record<string, any>>({})
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

  useEffect(() => {
    if (activeTab === 'monitor') loadVehicleLocations()
  }, [activeTab, routes])

  async function loadVehicleLocations() {
    const supabase = createClient()
    const activeIds = routes.filter((r: RouteItem) => r.status === 'active').map((r: RouteItem) => r.id)
    if (activeIds.length === 0) return
    const { data } = await supabase
      .from('vehicle_locations')
      .select('route_id, latitude, longitude, speed_kmh, updated_at')
      .in('route_id', activeIds)
      .order('updated_at', { ascending: false })
    if (!data) return
    const map: Record<string, any> = {}
    data.forEach((loc: any) => { if (!map[loc.route_id]) map[loc.route_id] = loc })
    setVehicleLocations(map)
  }

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'exception_alerts' }, (payload: any) => {
        const newAlert = payload.new as AlertItem
        setAlerts((prev: AlertItem[]) => [newAlert, ...prev.slice(0, 7)])
        setStats((prev: any) => ({ ...prev, unresolvedAlerts: prev.unresolvedAlerts + 1 }))
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
      .select(`id, route_name, district, status, driver_id, ward, shift, profiles:driver_id(full_name), collection_stops(id, status)`)
      .eq('district', prof?.district || '')
      .order('created_at', { ascending: false })
      .limit(12)
    if (wards.length > 0) routeQuery = routeQuery.in('ward', wards)
    const { data: routeData } = await routeQuery

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: completedCount } = await supabase
      .from('collection_events').select('*', { count: 'exact', head: true })
      .eq('status', 'completed').gte('collected_at', today.toISOString())

    let scheduleQuery = supabase
      .from('schedules').select('*')
      .eq('published', true).eq('district', prof?.district || '')
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true }).limit(5)
    if (wards.length > 0) scheduleQuery = scheduleQuery.overlaps('wards', wards)
    const { data: scheduleData } = await scheduleQuery

    setAlerts(alertData || [])
    setSchedules(scheduleData || [])

    const enrichedRoutes: RouteItem[] = (routeData || []).map((r: any) => {
      const stops = r.collection_stops || []
      const completedStops = stops.filter((s: any) => s.status === 'completed').length
      const skippedStops = stops.filter((s: any) => s.status === 'skipped').length
      const routeAlerts = (alertData || []).filter((a: any) => a.route_id === r.id).length
      return {
        id: r.id,
        route_name: r.route_name || `Route ${r.id.slice(0, 6)}`,
        name: r.route_name || `Route ${r.id.slice(0, 6)}`,
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
      activeRoutes: enrichedRoutes.filter((r: RouteItem) => r.status === 'active').length,
      unresolvedAlerts: unresolvedCount || 0,
      completedToday: completedCount || 0,
      driversOnDuty: enrichedRoutes.filter((r: RouteItem) => r.driver_id && r.status === 'active').length,
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
      .update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq('id', alertId)
    setAlerts((prev: AlertItem[]) => prev.filter((a: AlertItem) => a.id !== alertId))
    setStats((prev: any) => ({ ...prev, unresolvedAlerts: Math.max(0, prev.unresolvedAlerts - 1) }))
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
    organic: '#00450d', non_recyclable: '#ba1a1a', recyclable: '#1d4ed8',
    e_waste: '#7c3aed', bulk: '#d97706',
  }

  function timeGreeting() {
    const h = currentTime.getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  function getGreetingEmoji() {
    const h = currentTime.getHours()
    if (h < 12) return '🌤️'
    if (h < 17) return '☀️'
    return '🌙'
  }

  const assignedWards = profile?.assigned_wards || []
  const activeRoutes = routes.filter((r: RouteItem) => r.status === 'active')
  const allRoutes = routes

  const dayRoutes = routes.filter((r: RouteItem) => r.shift === 'day' || !r.shift)
  const nightRoutes = routes.filter((r: RouteItem) => r.shift === 'night')
  const shiftSummary = [
    {
      label: 'Morning Shift', icon: 'wb_sunny', color: '#d97706', bg: '#fefce8',
      routes: dayRoutes.length,
      active: dayRoutes.filter((r: RouteItem) => r.status === 'active').length,
      completed: dayRoutes.filter((r: RouteItem) => r.status === 'completed').length,
      alerts: dayRoutes.reduce((s: number, r: RouteItem) => s + (r.alert_count || 0), 0),
      stops: dayRoutes.reduce((s: number, r: RouteItem) => s + r.completed_stops, 0),
    },
    {
      label: 'Evening Shift', icon: 'nights_stay', color: '#4338ca', bg: '#eef2ff',
      routes: nightRoutes.length,
      active: nightRoutes.filter((r: RouteItem) => r.status === 'active').length,
      completed: nightRoutes.filter((r: RouteItem) => r.status === 'completed').length,
      alerts: nightRoutes.reduce((s: number, r: RouteItem) => s + (r.alert_count || 0), 0),
      stops: nightRoutes.reduce((s: number, r: RouteItem) => s + r.completed_stops, 0),
    },
  ]

  return (
    <DashboardLayout
      role="Supervisor"
      userName={profile?.full_name || ''}
      navItems={SUPERVISOR_NAV}
    >
      <style>{`
        .ms2 {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        /* ── Hero greeting ── */
        .hero-section {
          background: linear-gradient(135deg, #00450d 0%, #1b5e20 60%, #2e7d32 100%);
          border-radius: 20px;
          padding: 22px 28px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }
        .hero-section::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 80% 50%, rgba(255,255,255,0.07) 0%, transparent 60%);
          pointer-events: none;
        }
        .hero-section::after {
          content: '';
          position: absolute; right: -40px; top: -40px;
          width: 220px; height: 220px;
          border-radius: 50%;
          background: rgba(255,255,255,0.04);
          pointer-events: none;
        }
        .hero-greeting {
          font-family: 'Manrope', sans-serif;
          font-size: 13px; font-weight: 600;
          color: rgba(255,255,255,0.65);
          letter-spacing: 0.08em; text-transform: uppercase;
          margin: 0 0 6px;
        }
        .hero-name {
          font-family: 'Manrope', sans-serif;
          font-size: 38px; font-weight: 800;
          color: white; line-height: 1.1;
          margin: 0 0 8px;
        }
        .hero-meta {
          font-size: 13px; color: rgba(255,255,255,0.6);
          margin: 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        }
        .hero-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,0.35); }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 99px; padding: 5px 14px;
          font-size: 12px; font-weight: 700; color: white;
          font-family: 'Manrope', sans-serif;
        }
        .hero-stats {
          display: flex; gap: 24px; margin-top: 24px; flex-wrap: wrap;
        }
        .hero-stat {
          display: flex; flex-direction: column; gap: 2px;
        }
        .hero-stat-value {
          font-family: 'Manrope', sans-serif;
          font-size: 26px; font-weight: 800; color: white; line-height: 1;
        }
        .hero-stat-label {
          font-size: 11px; color: rgba(255,255,255,0.55);
          font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
        }
        .hero-divider {
          width: 1px; background: rgba(255,255,255,0.15); margin: 4px 0;
        }
        /* ── Cards ── */
        .stat-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.09); }
        .alert-row { transition: background 0.15s; border-radius: 10px; }
        .alert-row:hover { background: rgba(0,0,0,0.02); }
        .resolve-btn { transition: background 0.15s; cursor: pointer; }
        .resolve-btn:hover { background: rgba(0,69,13,0.12) !important; }
        .route-monitor-card {
          background: white; border-radius: 14px;
          border: 1.5px solid rgba(0,69,13,0.06); padding: 20px;
          transition: all 0.2s ease;
        }
        .route-monitor-card:hover { border-color: rgba(0,69,13,0.15); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .route-monitor-card.active-route { border-color: rgba(0,69,13,0.2); }
        .route-monitor-card.alert-route  { border-color: rgba(239,68,68,0.25); background: #fffafa; }
        .action-card { transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; }
        .action-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
        .ward-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 12px; background: rgba(0,69,13,0.08); color: #00450d;
          border-radius: 99px; font-size: 12px; font-weight: 700; font-family: 'Manrope', sans-serif;
        }
        .tab-btn {
          padding: 8px 18px; border-radius: 99px; font-size: 13px;
          font-weight: 700; font-family: 'Manrope', sans-serif;
          border: none; cursor: pointer; transition: all 0.2s;
        }
        .tab-active   { background: #00450d; color: white; }
        .tab-inactive { background: white; color: #717a6d; border: 1px solid rgba(0,0,0,0.08); }
        .tab-inactive:hover { background: #f0fdf4; color: #00450d; }
        .progress-track { height: 6px; border-radius: 99px; background: #f0fdf4; overflow: hidden; }
        .progress-fill  { height: 100%; border-radius: 99px; transition: width 0.8s ease; }
        .schedule-row { padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.04); }
        .schedule-row:last-child { border-bottom: none; }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .live-dot { animation: pulse 2s ease-in-out infinite; }
        .fade-up { animation: fadeUp 0.5s ease both; }
        .fu1 { animation-delay: 0.05s; }
        .fu2 { animation-delay: 0.12s; }
        .fu3 { animation-delay: 0.19s; }
        .fu4 { animation-delay: 0.26s; }
      `}</style>

      {/* ── GREETING ── */}
      <div className="fade-up fu1" style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>
          {getGreetingEmoji()} {timeGreeting()}
        </p>
        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '46px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
          Welcome, <span style={{ color: '#00450d' }}>{profile?.full_name?.split(' ')[0] || 'Supervisor'}</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>
            {currentTime.toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {profile?.district && ` · ${profile.district}`}
            {assignedWards.length > 0 && ` · ${assignedWards.join(', ')}`}
          </p>
          <button onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(0,69,13,0.2)', background: 'white', color: '#00450d', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', cursor: 'pointer' }}>
            <span className="ms2" style={{ fontSize: '16px', animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>refresh</span>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── STATS HERO ── */}
      <div className="hero-section fade-up fu1">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-stats">
            {[
              { value: stats.activeRoutes, label: 'Active Routes' },
              { value: stats.driversOnDuty, label: 'Drivers on Duty' },
              { value: stats.unresolvedAlerts, label: 'Open Alerts' },
              { value: stats.completedToday, label: 'Stops Done Today' },
            ].map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'stretch', gap: '24px' }}>
                {i > 0 && <div className="hero-divider" />}
                <div className="hero-stat">
                  <span className="hero-stat-value">{s.value}</span>
                  <span className="hero-stat-label">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }} className="fade-up fu2">
        <button onClick={() => setActiveTab('overview')} className={`tab-btn ${activeTab === 'overview' ? 'tab-active' : 'tab-inactive'}`}>
          <span className="ms2" style={{ fontSize: '15px', marginRight: '4px' }}>dashboard</span>
          Overview
        </button>
        <button onClick={() => setActiveTab('monitor')} className={`tab-btn ${activeTab === 'monitor' ? 'tab-active' : 'tab-inactive'}`}>
          <span className="ms2" style={{ fontSize: '15px', marginRight: '4px' }}>radar</span>
          Live Monitor
          {stats.activeRoutes > 0 && (
            <span style={{ marginLeft: '6px', background: activeTab === 'monitor' ? 'rgba(255,255,255,0.3)' : '#00450d', color: 'white', borderRadius: '99px', fontSize: '10px', fontWeight: 700, padding: '1px 6px' }}>
              {stats.activeRoutes}
            </span>
          )}
        </button>
      </div>

      <AnnouncementsWidget role="supervisor" district={profile?.district} compact />

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="fade-up fu3">
          {/* Shift Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {shiftSummary.map(shift => (
              <div key={shift.label} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: shift.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="ms2" style={{ fontSize: '20px', color: shift.color }}>{shift.icon}</span>
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
                      <span style={{ fontSize: '11px', color: '#717a6d' }}>Route completion rate</span>
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

          {/* Wards + Schedules */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Assigned wards */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,69,13,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="ms2" style={{ fontSize: '20px', color: '#00450d' }}>map</span>
                </div>
                <div>
                  <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '15px', color: '#181c22', margin: 0 }}>My Assigned Wards</h2>
                  <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>{profile?.district || 'All Districts'}</p>
                </div>
              </div>
              {assignedWards.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', background: '#f4f6f3', borderRadius: '12px' }}>
                  <span className="ms2" style={{ fontSize: '32px', color: '#00450d', display: 'block', marginBottom: '8px' }}>public</span>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#181c22', margin: '0 0 4px' }}>All wards</p>
                  <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>You supervise the entire district</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                    {assignedWards.map((ward: string) => (
                      <span key={ward} className="ward-pill">
                        <span className="ms2" style={{ fontSize: '13px' }}>location_on</span>
                        {ward}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: '12px', color: '#717a6d', padding: '10px 14px', background: '#f4f6f3', borderRadius: '8px', margin: 0 }}>
                    Responsible for {assignedWards.length} ward{assignedWards.length > 1 ? 's' : ''} in this district.
                  </p>
                </>
              )}
            </div>

            {/* Upcoming schedules */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '15px', color: '#181c22', margin: 0 }}>Upcoming Schedules</h2>
                <Link href="/dashboard/supervisor/schedules" style={{ fontSize: '12px', color: '#00450d', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  View all <span className="ms2" style={{ fontSize: '14px' }}>arrow_forward</span>
                </Link>
              </div>
              {schedules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', background: '#f4f6f3', borderRadius: '12px' }}>
                  <span className="ms2" style={{ fontSize: '32px', color: '#c4c9c0', display: 'block', marginBottom: '8px' }}>calendar_today</span>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#41493e', margin: '0 0 4px' }}>No schedules yet</p>
                  <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>Your DE will assign schedules</p>
                </div>
              ) : (
                <div>
                  {schedules.map((schedule: ScheduleItem) => {
                    const color = wasteTypeColor[schedule.waste_type] || '#64748b'
                    const scheduleWards = schedule.wards?.length > 0 ? schedule.wards : schedule.ward ? [schedule.ward] : []
                    return (
                      <div key={schedule.id} className="schedule-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="ms2" style={{ fontSize: '16px', color }}>delete_sweep</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: '0 0 2px', textTransform: 'capitalize' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px' }}>
            {/* Live alerts */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="live-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: stats.unresolvedAlerts > 0 ? '#ef4444' : '#22c55e', boxShadow: stats.unresolvedAlerts > 0 ? '0 0 0 3px rgba(239,68,68,0.2)' : '0 0 0 3px rgba(34,197,94,0.2)' }} />
                  <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '15px', color: '#181c22', margin: 0 }}>Live Exception Alerts</h2>
                </div>
                <Link href="/dashboard/supervisor/alerts" style={{ fontSize: '12px', color: '#00450d', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  View all <span className="ms2" style={{ fontSize: '14px' }}>arrow_forward</span>
                </Link>
              </div>
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <span className="ms2" style={{ fontSize: '40px', color: '#22c55e', display: 'block', marginBottom: '12px' }}>check_circle</span>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#41493e', margin: '0 0 4px' }}>All clear</p>
                  <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>No unresolved alerts right now</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {alerts.slice(0, 5).map((alert: AlertItem) => (
                    <div key={alert.id} className="alert-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, marginTop: '1px', background: severityBg[alert.severity] || 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="ms2" style={{ fontSize: '16px', color: severityColor[alert.severity] || '#717a6d' }}>
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
                        <span className="ms2" style={{ fontSize: '13px' }}>check</span>
                        Resolve
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions + system status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '15px', color: '#181c22', margin: '0 0 14px' }}>Quick Actions</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { icon: 'notifications_active', label: 'Manage Alerts', sub: 'Review & resolve exceptions', href: '/dashboard/supervisor/alerts', color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
                    { icon: 'route', label: 'View Routes', sub: 'Monitor collection routes', href: '/dashboard/supervisor/routes', color: '#1d4ed8', bg: 'rgba(29,78,216,0.06)' },
                    { icon: 'map', label: 'Ward Heatmap', sub: 'Performance by ward', href: '/dashboard/supervisor/heatmap', color: '#00450d', bg: 'rgba(0,69,13,0.06)' },
                    { icon: 'fact_check', label: 'Compliance', sub: 'Schedule compliance view', href: '/dashboard/supervisor/schedule-compliance', color: '#7c3aed', bg: 'rgba(124,58,237,0.06)' },
                    { icon: 'picture_as_pdf', label: 'Shift Report', sub: 'Export daily PDF report', href: '/dashboard/supervisor/shift-report', color: '#d97706', bg: 'rgba(217,119,6,0.06)' },
                  ].map(action => (
                    <Link key={action.label} href={action.href} style={{ textDecoration: 'none' }}>
                      <div className="action-card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="ms2" style={{ fontSize: '17px', color: action.color }}>{action.icon}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#181c22', margin: 0 }}>{action.label}</p>
                          <p style={{ fontSize: '11px', color: '#717a6d', margin: 0 }}>{action.sub}</p>
                        </div>
                        <span className="ms2" style={{ fontSize: '16px', color: '#c4c9c0' }}>chevron_right</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* System status */}
              <div style={{ background: 'linear-gradient(135deg, #00450d, #1b5e20)', borderRadius: '16px', padding: '20px', color: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span className="ms2" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)' }}>verified</span>
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
        </div>
      )}

      {/* ── LIVE MONITOR TAB ── */}
      {activeTab === 'monitor' && (
        <div className="fade-up fu3">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="live-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)' }} />
              <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '18px', color: '#181c22', margin: 0 }}>
                Live Route Monitor — {allRoutes.length} Routes
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
              <span style={{ padding: '4px 10px', borderRadius: '99px', background: 'rgba(0,69,13,0.08)', color: '#00450d', fontWeight: 700 }}>{activeRoutes.length} active</span>
              <span style={{ padding: '4px 10px', borderRadius: '99px', background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontWeight: 700 }}>{alerts.length} alerts</span>
            </div>
          </div>

          {alerts.filter((a: AlertItem) => a.severity === 'critical' || a.severity === 'high').length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span className="ms2" style={{ color: '#dc2626', fontSize: '22px', flexShrink: 0 }}>emergency</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#ba1a1a', fontFamily: 'Manrope, sans-serif', margin: '0 0 2px' }}>
                  {alerts.filter((a: AlertItem) => a.severity === 'critical' || a.severity === 'high').length} high-priority alert{alerts.filter((a: AlertItem) => a.severity === 'critical' || a.severity === 'high').length > 1 ? 's' : ''} require immediate attention
                </p>
                <p style={{ fontSize: '12px', color: '#dc2626', margin: 0 }}>
                  {alerts.filter((a: AlertItem) => a.severity === 'critical' || a.severity === 'high').map((a: AlertItem) => a.message).join(' · ')}
                </p>
              </div>
              <Link href="/dashboard/supervisor/alerts" style={{ padding: '8px 14px', borderRadius: '8px', background: '#ba1a1a', color: 'white', textDecoration: 'none', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', flexShrink: 0 }}>
                Manage Alerts
              </Link>
            </div>
          )}

          {allRoutes.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '16px', padding: '60px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <span className="ms2" style={{ fontSize: '48px', color: '#c4c9c0', display: 'block', marginBottom: '16px' }}>route</span>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#41493e', margin: '0 0 8px' }}>No routes to monitor</p>
              <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>Routes assigned to drivers will appear here in real-time</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {allRoutes.map((route: RouteItem) => {
                const sc = routeStatusColor[route.status] || routeStatusColor.planned
                const completionPct = route.total_stops > 0 ? Math.round((route.completed_stops / route.total_stops) * 100) : 0
                const routeAlerts = alerts.filter((a: AlertItem) => a.route_id === route.id)
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
                              <span className="ms2" style={{ fontSize: '12px' }}>warning</span>
                              {routeAlerts.length} alert{routeAlerts.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>{route.district}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '10px 12px', borderRadius: '10px', background: route.driver_id ? 'rgba(0,69,13,0.05)' : '#f8fafc' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: route.driver_id ? '#00450d' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="ms2" style={{ fontSize: '16px', color: route.driver_id ? 'white' : '#9ca3af' }}>person</span>
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

                    {isActive && vehicleLocations[route.id] && (
                      <div style={{ marginBottom: '14px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(0,69,13,0.04)', border: '1px solid rgba(0,69,13,0.08)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="live-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '11px', fontWeight: 600, color: '#00450d', margin: '0 0 1px' }}>
                            {vehicleLocations[route.id].latitude.toFixed(4)}, {vehicleLocations[route.id].longitude.toFixed(4)}
                            {vehicleLocations[route.id].speed_kmh > 0 && ` · ${vehicleLocations[route.id].speed_kmh} km/h`}
                          </p>
                          <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>
                            Updated {new Date(vehicleLocations[route.id].updated_at).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className="ms2" style={{ fontSize: '14px', color: '#00450d' }}>gps_fixed</span>
                      </div>
                    )}
                    {isActive && !vehicleLocations[route.id] && (
                      <div style={{ marginBottom: '14px', padding: '8px 12px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="ms2" style={{ fontSize: '14px', color: '#94a3b8' }}>gps_off</span>
                        <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>No GPS signal yet</p>
                      </div>
                    )}

                    {route.total_stops > 0 && (
                      <div style={{ marginBottom: hasAlerts ? '14px' : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', color: '#717a6d' }}>Collection Progress</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: completionPct >= 80 ? '#00450d' : completionPct >= 50 ? '#d97706' : '#64748b' }}>{completionPct}%</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${completionPct}%`, background: completionPct >= 80 ? '#00450d' : completionPct >= 50 ? '#d97706' : '#94a3b8' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px', color: '#94a3b8' }}>
                          <span style={{ color: '#00450d', fontWeight: 600 }}>✓ {route.completed_stops} done</span>
                          {route.skipped_stops > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ {route.skipped_stops} skipped</span>}
                          <span>◌ {route.total_stops} total</span>
                        </div>
                      </div>
                    )}

                    {hasAlerts && (
                      <div style={{ borderTop: '1px solid rgba(239,68,68,0.1)', paddingTop: '12px' }}>
                        {routeAlerts.slice(0, 2).map((a: AlertItem) => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', background: 'rgba(239,68,68,0.05)', marginBottom: '4px' }}>
                            <span className="ms2" style={{ fontSize: '14px', color: severityColor[a.severity] || '#dc2626', flexShrink: 0 }}>
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
    </DashboardLayout>
  )
}