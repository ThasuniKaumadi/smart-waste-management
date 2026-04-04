'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ROLE_DASHBOARDS } from '@/lib/types'

interface Profile {
  id: string
  full_name: string
  role: string
  district: string
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
  name: string
  district: string
  status: string
  driver_id: string | null
  total_stops: number
}

interface CollectionEvent {
  id: string
  status: string
  collected_at: string | null
}

export default function SupervisorDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [stats, setStats] = useState({
    activeRoutes: 0,
    unresolvedAlerts: 0,
    completedToday: 0,
    driversOnDuty: 0,
  })
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!prof || prof.role !== 'supervisor') {
        router.push(prof?.role ? ROLE_DASHBOARDS[prof.role as keyof typeof ROLE_DASHBOARDS] : '/login')
        return
      }
      setProfile(prof)

      // Fetch unresolved alerts (most recent 5)
      const { data: alertData } = await supabase
        .from('exception_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(5)

      // Fetch all alerts count
      const { count: unresolvedCount } = await supabase
        .from('exception_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false)

      // Fetch routes
      const { data: routeData } = await supabase
        .from('routes')
        .select('id, name, district, status, driver_id, collection_stops(count)')
        .order('created_at', { ascending: false })
        .limit(6)

      // Fetch today's completed collections
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count: completedCount } = await supabase
        .from('collection_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('collected_at', today.toISOString())

      setAlerts(alertData || [])
      setRoutes(
        (routeData || []).map((r: any) => ({
          ...r,
          total_stops: r.collection_stops?.[0]?.count ?? 0,
        }))
      )
      setStats({
        activeRoutes: (routeData || []).filter((r: any) => r.status === 'active').length,
        unresolvedAlerts: unresolvedCount || 0,
        completedToday: completedCount || 0,
        driversOnDuty: (routeData || []).filter((r: any) => r.driver_id).length,
      })

      setLoading(false)
    }
    init()
  }, [router])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function resolveAlert(alertId: string) {
    const supabase = createClient()
    await supabase
      .from('exception_alerts')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', alertId)
    setAlerts(prev => prev.filter(a => a.id !== alertId))
    setStats(prev => ({ ...prev, unresolvedAlerts: Math.max(0, prev.unresolvedAlerts - 1) }))
  }

  const severityColor: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  }

  const severityBg: Record<string, string> = {
    critical: 'rgba(239,68,68,0.08)',
    high: 'rgba(249,115,22,0.08)',
    medium: 'rgba(234,179,8,0.08)',
    low: 'rgba(34,197,94,0.08)',
  }

  const alertTypeLabel: Record<string, string> = {
    stop_skipped: 'Stop Skipped',
    all_stops_skipped: 'All Stops Skipped',
    vehicle_breakdown: 'Vehicle Breakdown',
    route_not_started: 'Route Not Started',
  }

  const routeStatusColor: Record<string, { bg: string; text: string; dot: string }> = {
    active: { bg: 'rgba(0,69,13,0.08)', text: '#00450d', dot: '#00450d' },
    completed: { bg: 'rgba(59,130,246,0.08)', text: '#2563eb', dot: '#3b82f6' },
    planned: { bg: 'rgba(107,114,128,0.08)', text: '#6b7280', dot: '#9ca3af' },
    suspended: { bg: 'rgba(239,68,68,0.08)', text: '#dc2626', dot: '#ef4444' },
  }

  const timeGreeting = () => {
    const h = currentTime.getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

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
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .stat-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.09); }
        .nav-link { transition: color 0.2s, background 0.2s; }
        .nav-link:hover { background: rgba(0,69,13,0.07); color: #00450d; }
        .alert-row { transition: background 0.15s; }
        .alert-row:hover { background: rgba(0,0,0,0.02); }
        .resolve-btn { transition: background 0.15s, transform 0.1s; cursor: pointer; }
        .resolve-btn:hover { background: rgba(0,69,13,0.12); }
        .resolve-btn:active { transform: scale(0.97); }
        .route-card { transition: transform 0.2s, box-shadow 0.2s; }
        .route-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .action-card { transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; }
        .action-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
        .logout-btn:hover { background: rgba(239,68,68,0.08); color: #dc2626; }
        .logout-btn { transition: background 0.2s, color 0.2s; }
      `}</style>

      {/* Top Nav */}
      <nav style={{
        background: 'white',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        padding: '0 32px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
      }}>
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
            { icon: 'home', label: 'Overview', href: '/dashboard/supervisor' },
            { icon: 'notifications', label: 'Alerts', href: '/dashboard/supervisor/alerts', badge: stats.unresolvedAlerts },
            { icon: 'route', label: 'Routes', href: '/dashboard/supervisor/routes' },
            { icon: 'assignment', label: 'Reports', href: '/dashboard/supervisor/reports' },
          ].map(item => (
            <Link key={item.label} href={item.href}
              className="nav-link"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                borderRadius: '8px', textDecoration: 'none', color: '#41493e',
                fontSize: '13px', fontWeight: 500, position: 'relative',
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{item.icon}</span>
              <span className="hidden md:inline">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span style={{
                  position: 'absolute', top: '2px', right: '6px',
                  background: '#ef4444', color: 'white', borderRadius: '9999px',
                  fontSize: '9px', fontWeight: 700, minWidth: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                }}>{item.badge}</span>
              ) : null}
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: 0 }}>{profile?.full_name}</p>
            <p style={{ fontSize: '11px', color: '#717a6d', margin: 0 }}>{profile?.district || 'All Districts'}</p>
          </div>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #00450d, #1b5e20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '14px', fontWeight: 700,
          }}>
            {profile?.full_name?.charAt(0) || 'S'}
          </div>
          <button
            onClick={handleLogout}
            className="logout-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '6px 10px', borderRadius: '8px', border: 'none',
              background: 'transparent', cursor: 'pointer', color: '#717a6d', fontSize: '12px',
            }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '12px', color: '#717a6d', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>
            {timeGreeting()}, {profile?.full_name?.split(' ')[0]}
          </p>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '28px', fontWeight: 800, color: '#181c22', margin: 0, letterSpacing: '-0.02em' }}>
            Supervisor Overview
          </h1>
          <p style={{ fontSize: '13px', color: '#717a6d', margin: '4px 0 0' }}>
            {currentTime.toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}
            {currentTime.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Stat Cards — Bento Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            {
              icon: 'route', label: 'Active Routes', value: stats.activeRoutes,
              color: '#00450d', bg: 'rgba(0,69,13,0.06)', sub: 'In progress today',
            },
            {
              icon: 'warning', label: 'Unresolved Alerts', value: stats.unresolvedAlerts,
              color: stats.unresolvedAlerts > 0 ? '#dc2626' : '#00450d',
              bg: stats.unresolvedAlerts > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(0,69,13,0.06)',
              sub: 'Require attention',
            },
            {
              icon: 'check_circle', label: 'Completed Today', value: stats.completedToday,
              color: '#2563eb', bg: 'rgba(37,99,235,0.06)', sub: 'Collection stops',
            },
            {
              icon: 'person_pin_circle', label: 'Drivers on Duty', value: stats.driversOnDuty,
              color: '#7c3aed', bg: 'rgba(124,58,237,0.06)', sub: 'Assigned to routes',
            },
          ].map(card => (
            <div key={card.label} className="stat-card" style={{
              background: 'white', borderRadius: '16px', padding: '20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: card.color }}>{card.icon}</span>
                </div>
              </div>
              <p style={{ fontSize: '32px', fontFamily: 'Manrope, sans-serif', fontWeight: 800, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{card.value}</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#41493e', margin: '0 0 2px' }}>{card.label}</p>
              <p style={{ fontSize: '11px', color: '#717a6d', margin: 0 }}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Main Two-Column Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', marginBottom: '20px' }}>

          {/* Live Alerts Panel */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stats.unresolvedAlerts > 0 ? '#ef4444' : '#22c55e', boxShadow: stats.unresolvedAlerts > 0 ? '0 0 0 3px rgba(239,68,68,0.2)' : '0 0 0 3px rgba(34,197,94,0.2)' }} />
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>
                  Live Exception Alerts
                </h2>
              </div>
              <Link href="/dashboard/supervisor/alerts" style={{
                fontSize: '12px', color: '#00450d', fontWeight: 600, textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                View all
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
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
                {alerts.map(alert => (
                  <div key={alert.id} className="alert-row" style={{
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    padding: '12px', borderRadius: '10px', gap: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, marginTop: '1px',
                        background: severityBg[alert.severity] || 'rgba(0,0,0,0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: severityColor[alert.severity] || '#717a6d' }}>
                          {alert.alert_type === 'vehicle_breakdown' ? 'car_crash' :
                            alert.alert_type === 'route_not_started' ? 'schedule' : 'warning'}
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#181c22' }}>
                            {alertTypeLabel[alert.alert_type] || alert.alert_type}
                          </span>
                          <span style={{
                            fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px',
                            background: severityBg[alert.severity], color: severityColor[alert.severity],
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                          }}>{alert.severity}</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#717a6d', margin: '0 0 3px', lineHeight: 1.4 }}>{alert.message}</p>
                        <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>
                          {new Date(alert.created_at).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {new Date(alert.created_at).toLocaleDateString('en-LK', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="resolve-btn"
                      style={{
                        flexShrink: 0, border: 'none', background: 'rgba(0,69,13,0.06)',
                        borderRadius: '6px', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '3px',
                        fontSize: '11px', fontWeight: 600, color: '#00450d',
                      }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span>
                      Resolve
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
              <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: '0 0 16px' }}>
                Quick Actions
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { icon: 'notifications_active', label: 'Manage Alerts', sub: 'Review & resolve exceptions', href: '/dashboard/supervisor/alerts', color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
                  { icon: 'map', label: 'Live Route Map', sub: 'Track driver locations', href: '/dashboard/supervisor/routes', color: '#2563eb', bg: 'rgba(37,99,235,0.06)' },
                  { icon: 'content_paste', label: 'Waste Reports', sub: 'Review crowdsourced reports', href: '/dashboard/supervisor/waste-reports', color: '#7c3aed', bg: 'rgba(124,58,237,0.06)' },
                  { icon: 'summarize', label: 'Daily Summary', sub: 'View collection performance', href: '/dashboard/supervisor/summary', color: '#00450d', bg: 'rgba(0,69,13,0.06)' },
                ].map(action => (
                  <Link key={action.label} href={action.href} style={{ textDecoration: 'none' }}>
                    <div className="action-card" style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)',
                    }}>
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

            {/* System Status */}
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

        {/* Route Overview */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>
              Route Overview
            </h2>
            <Link href="/dashboard/supervisor/routes" style={{ fontSize: '12px', color: '#00450d', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View all routes
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
            </Link>
          </div>

          {routes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#717a6d', fontSize: '13px' }}>
              No routes found
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {routes.map(route => {
                const sc = routeStatusColor[route.status] || routeStatusColor.planned
                return (
                  <div key={route.id} className="route-card" style={{
                    border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px', padding: '16px',
                    background: '#fafaf9',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '9999px',
                        background: sc.bg, color: sc.text, textTransform: 'uppercase', letterSpacing: '0.06em',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                        {route.status}
                      </span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#c4c9c0' }}>route</span>
                    </div>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22', margin: '0 0 3px' }}>{route.name}</p>
                    <p style={{ fontSize: '11px', color: '#717a6d', margin: '0 0 10px' }}>{route.district}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#9ca3af' }}>location_on</span>
                        <span style={{ fontSize: '11px', color: '#717a6d' }}>{route.total_stops} stops</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '13px', color: route.driver_id ? '#22c55e' : '#9ca3af' }}>person</span>
                        <span style={{ fontSize: '11px', color: route.driver_id ? '#22c55e' : '#9ca3af' }}>
                          {route.driver_id ? 'Driver assigned' : 'No driver'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}