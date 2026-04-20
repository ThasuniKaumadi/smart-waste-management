'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import Link from 'next/link'

const DE_NAV = [
  { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
  { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
  { label: 'History', href: '/dashboard/district-engineer/collection-history', icon: 'history' },
  { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
  { label: 'Heatmap', href: '/dashboard/district-engineer/heatmap', icon: 'thermostat' },
  { label: 'Reports', href: '/dashboard/district-engineer/reports', icon: 'report_problem' },
  { label: 'Incidents', href: '/dashboard/district-engineer/incidents', icon: 'warning' },
  { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
  { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getFirstName(fullName: string) {
  return fullName?.split(' ')[0] || fullName
}

interface Stats {
  totalCollections: number
  completedCollections: number
  activeRoutes: number
  openComplaints: number
  pendingWasteReports: number
  publishedSchedules: number
  totalRoutes: number
  resolvedComplaints: number
  collectionRate: number
  resolutionRate: number
  blockchainVerified: number
}

interface RecentComplaint {
  id: string
  complaint_type: string
  description: string
  status: string
  created_at: string
  reporter_name: string
}

interface RecentWasteReport {
  id: string
  report_type: string
  description: string
  status: string
  created_at: string
  location_address: string
}

export default function DEOverviewPage() {
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState<Stats>({
    totalCollections: 0, completedCollections: 0, activeRoutes: 0,
    openComplaints: 0, pendingWasteReports: 0, publishedSchedules: 0,
    totalRoutes: 0, resolvedComplaints: 0, collectionRate: 0,
    resolutionRate: 0, blockchainVerified: 0,
  })
  const [recentComplaints, setRecentComplaints] = useState<RecentComplaint[]>([])
  const [recentReports, setRecentReports] = useState<RecentWasteReport[]>([])
  const [loading, setLoading] = useState(true)
  const [now] = useState(new Date())

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    const district = p?.district || ''

    const [
      schedulesRes, routesRes, stopsRes,
      complaintsRes, wasteReportsRes, blockchainRes,
    ] = await Promise.all([
      supabase.from('schedules').select('id, status').eq('district', district),
      supabase.from('routes').select('id, status').eq('district', district),
      supabase.from('collection_stops').select('id, status').in('route_id',
        (await supabase.from('routes').select('id').eq('district', district)).data?.map((r: any) => r.id) || []
      ),
      supabase.from('complaints').select('*, profiles!submitted_by(full_name)').eq('district', district).order('created_at', { ascending: false }).limit(5),
      supabase.from('waste_reports').select('*').eq('district', district).order('created_at', { ascending: false }).limit(5),
      supabase.from('collection_stops').select('id').not('blockchain_tx', 'is', null),
    ])

    const schedules = schedulesRes.data || []
    const routes = routesRes.data || []
    const stops = stopsRes.data || []
    const complaints = complaintsRes.data || []
    const wasteReports = wasteReportsRes.data || []

    const publishedSchedules = schedules.filter((s: any) => s.status === 'published').length
    const activeRoutes = routes.filter((r: any) => r.status === 'active').length
    const totalStops = stops.length
    const completedStops = stops.filter((s: any) => s.status === 'completed').length
    const openComplaints = complaints.filter((c: any) => c.status !== 'resolved').length
    const resolvedComplaints = complaints.filter((c: any) => c.status === 'resolved').length
    const pendingReports = wasteReports.filter((r: any) => r.status !== 'resolved').length
    const collectionRate = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0
    const totalComplaints = complaints.length
    const resolutionRate = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0

    setStats({
      totalCollections: totalStops, completedCollections: completedStops,
      activeRoutes, openComplaints, pendingWasteReports: pendingReports,
      publishedSchedules, totalRoutes: routes.length,
      resolvedComplaints, collectionRate, resolutionRate,
      blockchainVerified: blockchainRes.data?.length || 0,
    })

    setRecentComplaints(complaints.slice(0, 4).map((c: any) => ({
      id: c.id, complaint_type: c.complaint_type, description: c.description,
      status: c.status, created_at: c.created_at,
      reporter_name: c.profiles?.full_name || 'Unknown',
    })))

    setRecentReports(wasteReports.slice(0, 3).map((r: any) => ({
      id: r.id, report_type: r.report_type, description: r.description,
      status: r.status, created_at: r.created_at,
      location_address: r.location_address,
    })))

    setLoading(false)
  }

  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const COMPLAINT_ICONS: Record<string, string> = {
    missed_collection: 'delete', delayed_collection: 'schedule',
    illegal_dumping: 'delete_forever', bin_damage: 'broken_image',
    noise_complaint: 'volume_up', other: 'feedback',
  }

  const REPORT_ICONS: Record<string, string> = {
    illegal_dumping: 'delete_forever', missed_collection: 'delete',
    blocked_drainage: 'water_damage', overflowing_bin: 'delete_sweep', other: 'report',
  }

  const statusStyle = (status: string) => {
    if (status === 'resolved') return { color: '#00450d', bg: '#f0fdf4' }
    if (status === 'in_progress' || status === 'assigned') return { color: '#1d4ed8', bg: '#eff6ff' }
    return { color: '#d97706', bg: '#fefce8' }
  }

  return (
    <DashboardLayout role="District Engineer" userName={profile?.full_name || ''}
      navItems={DE_NAV}
      primaryAction={{ label: 'New Schedule', href: '/dashboard/district-engineer/schedules', icon: 'add' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600&display=swap');
        .msym { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msym-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }

        /* Cards */
        .g-card { background:white; border-radius:20px; border:1px solid rgba(0,69,13,0.07); box-shadow:0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04); overflow:hidden; }
        .g-card-hover { transition:transform 0.2s, box-shadow 0.2s; }
        .g-card-hover:hover { transform:translateY(-2px); box-shadow:0 4px 20px rgba(0,69,13,0.1); }

        /* Hero banner */
        .hero-banner { background:linear-gradient(135deg, #00450d 0%, #1a5c20 50%, #0d3d0a 100%); border-radius:24px; padding:36px 40px; position:relative; overflow:hidden; }
        .hero-banner::before { content:''; position:absolute; top:-60px; right:-60px; width:280px; height:280px; background:rgba(163,246,156,0.06); border-radius:50%; }
        .hero-banner::after { content:''; position:absolute; bottom:-40px; right:120px; width:180px; height:180px; background:rgba(255,255,255,0.03); border-radius:50%; }

        /* Stat cards */
        .stat-card { padding:22px 24px; display:flex; flex-direction:column; gap:0; }
        .stat-num { font-family:'Manrope',sans-serif; font-weight:900; font-size:36px; line-height:1; color:#181c22; letter-spacing:-0.02em; }
        .stat-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:#94a3b8; font-family:'Manrope',sans-serif; margin-top:5px; }
        .stat-sub { font-size:12px; color:#717a6d; font-weight:500; margin-top:3px; }

        /* Health bars */
        .health-row { display:flex; align-items:center; gap:14px; padding:12px 0; border-bottom:1px solid rgba(0,69,13,0.05); }
        .health-row:last-child { border-bottom:none; }
        .health-bar-track { flex:1; height:6px; background:#f0f4f0; border-radius:99px; overflow:hidden; }
        .health-bar-fill { height:100%; border-radius:99px; transition:width 0.8s cubic-bezier(0.34,1.56,0.64,1); }

        /* Quick action cards */
        .qa-card { padding:22px 20px; cursor:pointer; transition:all 0.2s; text-decoration:none; display:block; border-top:3px solid transparent; }
        .qa-card:hover { background:#f9fdf9; border-top-color:#00450d; }

        /* Activity rows */
        .activity-row { padding:12px 20px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:flex-start; gap:12px; transition:background 0.15s; }
        .activity-row:hover { background:#fafdf9; }
        .activity-row:last-child { border-bottom:none; }

        /* Badge */
        .badge { display:inline-flex; align-items:center; gap:3px; padding:3px 9px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }

        /* Animations */
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .45s ease .04s both}
        .a2{animation:fadeUp .45s ease .1s both}
        .a3{animation:fadeUp .45s ease .16s both}
        .a4{animation:fadeUp .45s ease .22s both}
        .a5{animation:fadeUp .45s ease .28s both}
        .a6{animation:fadeUp .45s ease .34s both}
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes countUp { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        .count-anim { animation:countUp .5s cubic-bezier(0.34,1.56,0.64,1) both; }
      `}</style>

      {/* ── Greeting (above banner) ── */}
      <div className="a1" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>
          {dateStr}
        </p>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          {getGreeting()}, {getFirstName(profile?.full_name || 'Engineer')}
        </h1>
        <p style={{ fontSize: 13, color: '#717a6d', margin: 0, fontWeight: 500 }}>
          {profile?.district} · District Engineering Console
        </p>
      </div>

      {/* ── Hero banner ── */}
      <div className="hero-banner a2" style={{ marginBottom: 24 }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(163,246,156,0.75)', fontFamily: 'Manrope,sans-serif', margin: '0 0 4px' }}>
                District Operations
              </p>
              <p style={{ fontSize: 14, color: 'rgba(163,246,156,0.55)', margin: 0, fontWeight: 500 }}>
                Real-time logistics overview
              </p>
            </div>

            {/* Live status pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a3f69c', boxShadow: '0 0 0 3px rgba(163,246,156,0.3)' }} />
              <span style={{ fontSize: 13, color: 'white', fontWeight: 700, fontFamily: 'Manrope,sans-serif' }}>Live · {profile?.district}</span>
            </div>
          </div>

          {/* Quick stats row inside hero */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 28 }}>
            {[
              { label: 'Total Collections', value: stats.totalCollections, icon: 'local_shipping' },
              { label: 'Completed', value: stats.completedCollections, icon: 'check_circle' },
              { label: 'Active Routes', value: stats.activeRoutes, icon: 'route' },
              { label: 'Open Complaints', value: stats.openComplaints, icon: 'feedback' },
            ].map(m => (
              <div key={m.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="msym" style={{ fontSize: 16, color: 'rgba(163,246,156,0.7)', display: 'block', marginBottom: 6 }}>{m.icon}</span>
                <p style={{ fontSize: 28, fontWeight: 900, color: 'white', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px', lineHeight: 1 }} className="count-anim">{m.value}</p>
                <p style={{ fontSize: 10, color: 'rgba(163,246,156,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 20 }}>

        {/* Left: stat cards 2×2 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="a2">
            {/* Schedules card */}
            <Link href="/dashboard/district-engineer/schedules" style={{ textDecoration: 'none' }}>
              <div className="g-card g-card-hover stat-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msym-fill" style={{ color: '#00450d', fontSize: 20 }}>calendar_month</span>
                  </div>
                  <span className="msym" style={{ color: '#d1d5db', fontSize: 18 }}>arrow_forward</span>
                </div>
                <p className="stat-num">{stats.publishedSchedules}</p>
                <p className="stat-label">Published Schedules</p>
                <p className="stat-sub">{stats.publishedSchedules === 1 ? '1 active collection' : `${stats.publishedSchedules} active collections`}</p>
              </div>
            </Link>

            {/* Routes card */}
            <Link href="/dashboard/district-engineer/routes" style={{ textDecoration: 'none' }}>
              <div className="g-card g-card-hover stat-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msym" style={{ color: '#1d4ed8', fontSize: 20 }}>route</span>
                  </div>
                  <span className="msym" style={{ color: '#d1d5db', fontSize: 18 }}>arrow_forward</span>
                </div>
                <p className="stat-num">{stats.totalRoutes}</p>
                <p className="stat-label">Total Routes</p>
                <p className="stat-sub">{stats.activeRoutes} currently active</p>
              </div>
            </Link>

            {/* Complaints card */}
            <Link href="/dashboard/district-engineer/reports" style={{ textDecoration: 'none' }}>
              <div className="g-card g-card-hover stat-card" style={{ borderTop: stats.openComplaints > 0 ? '3px solid #d97706' : '3px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: stats.openComplaints > 0 ? '#fefce8' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msym" style={{ color: stats.openComplaints > 0 ? '#d97706' : '#00450d', fontSize: 20 }}>feedback</span>
                  </div>
                  {stats.openComplaints > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: '#fefce8', color: '#d97706', fontFamily: 'Manrope,sans-serif' }}>
                      {stats.openComplaints} open
                    </span>
                  )}
                </div>
                <p className="stat-num">{stats.openComplaints}</p>
                <p className="stat-label">Open Complaints</p>
                <p className="stat-sub">{stats.resolvedComplaints} resolved</p>
              </div>
            </Link>

            {/* Waste reports card */}
            <Link href="/dashboard/district-engineer/reports" style={{ textDecoration: 'none' }}>
              <div className="g-card g-card-hover stat-card" style={{ borderTop: stats.pendingWasteReports > 0 ? '3px solid #ba1a1a' : '3px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: stats.pendingWasteReports > 0 ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msym" style={{ color: stats.pendingWasteReports > 0 ? '#ba1a1a' : '#00450d', fontSize: 20 }}>report</span>
                  </div>
                  {stats.pendingWasteReports > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: '#fef2f2', color: '#ba1a1a', fontFamily: 'Manrope,sans-serif' }}>
                      Attention
                    </span>
                  )}
                </div>
                <p className="stat-num">{stats.pendingWasteReports}</p>
                <p className="stat-label">Waste Reports</p>
                <p className="stat-sub">Pending field action</p>
              </div>
            </Link>
          </div>

          {/* Quick actions */}
          <div className="g-card a3" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
              <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>Quick Actions</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
              {[
                { label: 'Create Schedule', sub: 'Plan collection', icon: 'add_circle', color: '#00450d', bg: '#f0fdf4', href: '/dashboard/district-engineer/schedules' },
                { label: 'Manage Routes', sub: 'View & oversee', icon: 'route', color: '#1d4ed8', bg: '#eff6ff', href: '/dashboard/district-engineer/routes' },
                { label: 'Complaints', sub: 'Review & resolve', icon: 'feedback', color: '#d97706', bg: '#fefce8', href: '/dashboard/district-engineer/reports' },
                { label: 'Waste Reports', sub: 'Field incidents', icon: 'report', color: '#ba1a1a', bg: '#fef2f2', href: '/dashboard/district-engineer/reports' },
              ].map((qa, i) => (
                <Link key={qa.label} href={qa.href} className="qa-card"
                  style={{ borderRight: i < 3 ? '1px solid rgba(0,69,13,0.06)' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: qa.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <span className="msym" style={{ color: qa.color, fontSize: 18 }}>{qa.icon}</span>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 3px' }}>{qa.label}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{qa.sub}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right: District health */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="g-card a2">
            <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>District Health</h3>
              <Link href="/dashboard/district-engineer/performance" style={{ fontSize: 11, color: '#00450d', textDecoration: 'none', fontWeight: 700, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 3 }}>
                Full Report <span className="msym" style={{ fontSize: 14 }}>arrow_forward</span>
              </Link>
            </div>
            <div style={{ padding: '8px 20px 16px' }}>
              {[
                { label: 'Collection Rate', value: stats.collectionRate, color: stats.collectionRate >= 80 ? '#00450d' : stats.collectionRate >= 60 ? '#d97706' : '#ba1a1a' },
                { label: 'Resolution Rate', value: stats.resolutionRate, color: stats.resolutionRate >= 70 ? '#00450d' : stats.resolutionRate >= 40 ? '#d97706' : '#ba1a1a' },
                { label: 'Schedules Published', value: stats.publishedSchedules > 0 ? 100 : 0, color: '#00450d' },
              ].map(h => (
                <div key={h.label} className="health-row">
                  <div style={{ minWidth: 120 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: 0 }}>{h.label}</p>
                  </div>
                  <div className="health-bar-track">
                    <div className="health-bar-fill" style={{ width: `${h.value}%`, background: h.color }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: h.color, fontFamily: 'Manrope,sans-serif', minWidth: 40, textAlign: 'right' }}>{h.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Blockchain stat */}
          <div className="g-card a3" style={{ padding: '18px 20px', background: 'linear-gradient(135deg, #0a1628 0%, #0d2137 100%)', border: '1px solid rgba(99,179,237,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(99,179,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="msym-fill" style={{ color: '#63b3ed', fontSize: 20 }}>verified</span>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(163,220,255,0.7)', fontFamily: 'Manrope,sans-serif', margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10 }}>Blockchain</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#63b3ed', margin: 0 }}>Polygon Amoy Testnet</p>
              </div>
            </div>
            <p style={{ fontSize: 32, fontWeight: 900, color: 'white', fontFamily: 'Manrope,sans-serif', margin: '0 0 4px', lineHeight: 1 }}>{stats.blockchainVerified}</p>
            <p style={{ fontSize: 11, color: 'rgba(163,220,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Manrope,sans-serif', margin: 0 }}>Collections on-chain</p>
            <p style={{ fontSize: 11, color: 'rgba(163,220,255,0.35)', marginTop: 8 }}>{profile?.district} · CMC EcoLedger 2026</p>
          </div>

          {/* District Tonnage */}
          <div className="g-card a4" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>District Tonnage</h3>
              <Link href="/dashboard/district-engineer/disposal" style={{ fontSize: 11, color: '#00450d', textDecoration: 'none', fontWeight: 700, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 3 }}>
                Full Report <span className="msym" style={{ fontSize: 14 }}>arrow_forward</span>
              </Link>
            </div>
            {[
              { label: 'Collections completed', value: stats.completedCollections, icon: 'check_circle', sub: 'verified on-chain', color: '#00450d', bg: '#f0fdf4' },
              { label: 'Complaints resolved', value: stats.resolvedComplaints, icon: 'task_alt', sub: `of ${stats.openComplaints + stats.resolvedComplaints} total`, color: '#1d4ed8', bg: '#eff6ff' },
              { label: 'Pending waste reports', value: stats.pendingWasteReports, icon: 'report_problem', sub: 'require attention', color: stats.pendingWasteReports > 0 ? '#d97706' : '#00450d', bg: stats.pendingWasteReports > 0 ? '#fefce8' : '#f0fdf4' },
            ].map(t => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(0,69,13,0.05)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="msym-fill" style={{ color: t.color, fontSize: 16 }}>{t.icon}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 1px' }}>{t.label}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{t.sub}</p>
                </div>
                <p style={{ fontSize: 20, fontWeight: 900, color: t.color, fontFamily: 'Manrope,sans-serif', margin: 0, lineHeight: 1 }}>{t.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="a5">

        {/* Recent complaints */}
        <div className="g-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>Recent Complaints</h3>
            <Link href="/dashboard/district-engineer/reports" style={{ fontSize: 11, color: '#00450d', textDecoration: 'none', fontWeight: 700, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 3 }}>
              All <span className="msym" style={{ fontSize: 14 }}>arrow_forward</span>
            </Link>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ width: 24, height: 24, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
            </div>
          ) : recentComplaints.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <span className="msym-fill" style={{ fontSize: 32, color: '#d1fae5', display: 'block', marginBottom: 8 }}>check_circle</span>
              <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>No complaints</p>
              <p style={{ fontSize: 11, color: '#d1d5db' }}>District is all clear</p>
            </div>
          ) : recentComplaints.map(c => {
            const ss = statusStyle(c.status)
            const icon = COMPLAINT_ICONS[c.complaint_type] || 'feedback'
            return (
              <div key={c.id} className="activity-row">
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="msym" style={{ color: '#d97706', fontSize: 16 }}>{icon}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0, textTransform: 'capitalize' }}>
                      {c.complaint_type.replace(/_/g, ' ')}
                    </p>
                    <span className="badge" style={{ background: ss.bg, color: ss.color }}>{c.status.replace('_', ' ')}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#717a6d', margin: 0 }}>
                    {c.reporter_name} · {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            )
          })}
          {recentComplaints.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(0,69,13,0.05)', background: '#fafdf9' }}>
              <Link href="/dashboard/district-engineer/reports"
                style={{ fontSize: 12, color: '#00450d', textDecoration: 'none', fontWeight: 700, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="msym" style={{ fontSize: 15 }}>manage_accounts</span>
                Manage Complaints
              </Link>
            </div>
          )}
        </div>

        {/* Recent waste reports */}
        <div className="g-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>Recent Waste Reports</h3>
            <Link href="/dashboard/district-engineer/reports" style={{ fontSize: 11, color: '#00450d', textDecoration: 'none', fontWeight: 700, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 3 }}>
              All <span className="msym" style={{ fontSize: 14 }}>arrow_forward</span>
            </Link>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ width: 24, height: 24, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
            </div>
          ) : recentReports.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <span className="msym-fill" style={{ fontSize: 32, color: '#d1fae5', display: 'block', marginBottom: 8 }}>eco</span>
              <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>No waste reports</p>
              <p style={{ fontSize: 11, color: '#d1d5db' }}>All clear in your district</p>
            </div>
          ) : recentReports.map(r => {
            const ss = statusStyle(r.status)
            const icon = REPORT_ICONS[r.report_type] || 'report'
            return (
              <div key={r.id} className="activity-row">
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="msym" style={{ color: '#ba1a1a', fontSize: 16 }}>{icon}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0, textTransform: 'capitalize' }}>
                      {r.report_type.replace(/_/g, ' ')}
                    </p>
                    <span className="badge" style={{ background: ss.bg, color: ss.color }}>{r.status}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#717a6d', margin: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span className="msym" style={{ fontSize: 11 }}>location_on</span>
                    {r.location_address || 'No location'} · {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            )
          })}
          {recentReports.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(0,69,13,0.05)', background: '#fafdf9' }}>
              <Link href="/dashboard/district-engineer/reports"
                style={{ fontSize: 12, color: '#00450d', textDecoration: 'none', fontWeight: 700, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="msym" style={{ fontSize: 15 }}>map</span>
                View All Reports
              </Link>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}