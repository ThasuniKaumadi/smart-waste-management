'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const DE_NAV = [
  { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
  { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
  { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
  { label: 'Complaints', href: '/dashboard/district-engineer/complaints', icon: 'feedback' },
  { label: 'Waste Reports', href: '/dashboard/district-engineer/waste-reports', icon: 'report' },
  { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
  { label: 'Zones', href: '/dashboard/district-engineer/zones', icon: 'map' },
  { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

const COLORS = ['#00450d', '#1b5e20', '#2e7d32', '#388e3c', '#43a047']

export default function DistrictEngineerDashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalSchedules: 0,
    publishedSchedules: 0,
    totalRoutes: 0,
    activeRoutes: 0,
    totalComplaints: 0,
    openComplaints: 0,
    resolvedComplaints: 0,
    totalReports: 0,
    pendingReports: 0,
    totalCollections: 0,
    completedCollections: 0,
    skippedCollections: 0,
  })
  const [complaintData, setComplaintData] = useState<any[]>([])
  const [recentComplaints, setRecentComplaints] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    const district = p?.district

    const results = await Promise.all([
      supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('district', district),
      supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('district', district).eq('status', 'published'),
      supabase.from('routes').select('*', { count: 'exact', head: true }).eq('district', district),
      supabase.from('routes').select('*', { count: 'exact', head: true }).eq('district', district).eq('status', 'active'),
      supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('district', district),
      supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('district', district).eq('status', 'open'),
      supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('district', district).eq('status', 'resolved'),
      supabase.from('waste_reports').select('*', { count: 'exact', head: true }).eq('district', district),
      supabase.from('waste_reports').select('*', { count: 'exact', head: true }).eq('district', district).eq('status', 'pending'),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }).eq('status', 'skipped'),
    ])

    setStats({
      totalSchedules: results[0].count || 0,
      publishedSchedules: results[1].count || 0,
      totalRoutes: results[2].count || 0,
      activeRoutes: results[3].count || 0,
      totalComplaints: results[4].count || 0,
      openComplaints: results[5].count || 0,
      resolvedComplaints: results[6].count || 0,
      totalReports: results[7].count || 0,
      pendingReports: results[8].count || 0,
      totalCollections: results[9].count || 0,
      completedCollections: results[10].count || 0,
      skippedCollections: results[11].count || 0,
    })

    const { data: compData } = await supabase
      .from('complaints').select('complaint_type').eq('district', district)
    if (compData) {
      const counts: Record<string, number> = {}
      compData.forEach(c => { if (c.complaint_type) counts[c.complaint_type] = (counts[c.complaint_type] || 0) + 1 })
      setComplaintData(Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })))
    }

    const { data: recent } = await supabase
      .from('complaints').select('*').eq('district', district)
      .order('created_at', { ascending: false }).limit(4)
    setRecentComplaints(recent || [])

    setLoading(false)
  }

  const resolutionRate = stats.totalComplaints > 0
    ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100) : 0
  const completionRate = stats.totalCollections > 0
    ? Math.round((stats.completedCollections / stats.totalCollections) * 100) : 0

  function statusStyle(status: string) {
    if (status === 'resolved') return { background: '#f0fdf4', color: '#00450d' }
    if (status === 'open') return { background: '#fef2f2', color: '#ba1a1a' }
    if (status === 'in_progress') return { background: '#eff6ff', color: '#1d4ed8' }
    return { background: '#f8fafc', color: '#64748b' }
  }

  const QUICK_LINKS = [
    { label: 'Create Schedule', desc: 'Plan waste collection for your district', icon: 'add_circle', href: '/dashboard/district-engineer/schedules/new', color: '#00450d' },
    { label: 'Manage Routes', desc: 'View and oversee collection routes', icon: 'route', href: '/dashboard/district-engineer/routes', color: '#1b5e20' },
    { label: 'Complaints', desc: 'Review and resolve resident complaints', icon: 'feedback', href: '/dashboard/district-engineer/complaints', color: '#2e7d32' },
    { label: 'Waste Reports', desc: 'Review crowdsourced waste incidents', icon: 'report', href: '/dashboard/district-engineer/waste-reports', color: '#388e3c' },
  ]

  return (
    <DashboardLayout
      role="District Engineer"
      userName={profile?.full_name || ''}
      navItems={DE_NAV}
      primaryAction={{ label: 'New Schedule', href: '/dashboard/district-engineer/schedules/new', icon: 'add' }}
    >
      <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .font-label { font-family: 'Manrope', sans-serif; }
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
          display: inline-flex; align-items: center; padding: 3px 10px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em; text-transform: uppercase;
        }
        .progress-bar { height: 6px; border-radius: 99px; background: #f0fdf4; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 99px; }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.2s both; }
        .s5 { animation: staggerIn 0.5s ease 0.25s both; }
        .s6 { animation: staggerIn 0.5s ease 0.3s both; }
      `}</style>

      {/* Hero */}
      <section className="mb-10 s1">
        <span className="font-label text-xs font-bold uppercase block mb-2"
          style={{ letterSpacing: '0.2em', color: '#717a6d' }}>
          District Engineering Console · ClearPath
        </span>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="font-headline font-extrabold tracking-tight"
            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
            District <span style={{ color: '#1b5e20' }}>Intelligence</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: '#f0fdf4' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#16a34a' }} />
              <span className="text-sm font-medium" style={{ color: '#14532d', fontFamily: 'Inter, sans-serif' }}>
                {profile?.district || 'Your District'}
              </span>
            </div>
            <Link href="/dashboard/district-engineer/performance"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80"
              style={{ background: '#1b5e20', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>analytics</span>
              Full Report
            </Link>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
              style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#717a6d' }}>Loading district data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Row 1 — large overview + health */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
            <div className="bento-card-green md:col-span-8 p-8 s2">
              <div className="absolute top-0 right-0 w-56 h-56 rounded-full -mr-20 -mt-20"
                style={{ background: 'rgba(163,246,156,0.06)' }} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <span className="font-label text-xs font-bold uppercase block mb-2"
                      style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)' }}>
                      Active Pickup Streams
                    </span>
                    <h2 className="font-headline font-extrabold text-3xl tracking-tight">District Operations</h2>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '4px' }}>
                      Real-time logistics for {profile?.district || 'your district'}
                    </p>
                  </div>
                  <div className="p-3 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>engineering</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Collections', value: stats.totalCollections, icon: 'local_shipping' },
                    { label: 'Completed', value: stats.completedCollections, icon: 'check_circle' },
                    { label: 'Active Routes', value: stats.activeRoutes, icon: 'route' },
                    { label: 'Open Complaints', value: stats.openComplaints, icon: 'feedback' },
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
                  <h2 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>District Health</h2>
                  <span className="material-symbols-outlined" style={{ color: '#717a6d', fontSize: '20px' }}>monitor_heart</span>
                </div>
                <div className="space-y-5">
                  {[
                    { label: 'Collection Rate', value: completionRate, color: '#00450d' },
                    { label: 'Resolution Rate', value: resolutionRate, color: '#1b5e20' },
                    { label: 'Schedule Published', value: stats.totalSchedules > 0 ? Math.round((stats.publishedSchedules / stats.totalSchedules) * 100) : 0, color: '#2e7d32' },
                  ].map(m => (
                    <div key={m.label}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium" style={{ color: '#181c22' }}>{m.label}</span>
                        <span className="font-bold" style={{ color: m.color }}>{m.value}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${m.value}%`, background: m.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Link href="/dashboard/district-engineer/performance"
                className="mt-6 w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: '#f0fdf4', color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                View Full Performance
              </Link>
            </div>
          </div>

          {/* Row 2 — 4 metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 s3">
            {[
              { label: 'Schedules', value: stats.totalSchedules, sub: `${stats.publishedSchedules} published`, icon: 'calendar_month', color: '#00450d' },
              { label: 'Routes', value: stats.totalRoutes, sub: `${stats.activeRoutes} active`, icon: 'route', color: '#1b5e20' },
              { label: 'Complaints', value: stats.totalComplaints, sub: `${stats.openComplaints} open`, icon: 'feedback', color: '#ba1a1a' },
              { label: 'Waste Reports', value: stats.totalReports, sub: `${stats.pendingReports} pending`, icon: 'report', color: '#2e7d32' },
            ].map((m, i) => (
              <div key={m.label} className="bento-card p-6" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${m.color}12` }}>
                  <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '20px' }}>{m.icon}</span>
                </div>
                <p className="font-headline font-extrabold text-3xl tracking-tight mb-1" style={{ color: '#181c22' }}>{m.value}</p>
                <p className="font-label text-xs font-bold uppercase mb-1" style={{ letterSpacing: '0.12em', color: '#94a3b8' }}>{m.label}</p>
                <p className="text-xs" style={{ color: m.color, fontWeight: 600 }}>{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Row 3 — chart + recent complaints */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 s4">
            <div className="bento-card lg:col-span-7 p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Complaint Analytics</h3>
                  <p className="text-sm mt-1" style={{ color: '#717a6d' }}>Distribution by type in {profile?.district || 'your district'}</p>
                </div>
                <Link href="/dashboard/district-engineer/complaints"
                  className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-80"
                  style={{ background: '#f1f5f9', color: '#41493e', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                  View All
                </Link>
              </div>
              {complaintData.length === 0 ? (
                <div className="h-48 flex items-center justify-center flex-col gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>check_circle</span>
                  </div>
                  <p className="text-sm" style={{ color: '#94a3b8' }}>No complaints in your district yet</p>
                </div>
              ) : (
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={complaintData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter' }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="value" fill="#1b5e20" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bento-card lg:col-span-5 p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Recent Complaints</h3>
                <Link href="/dashboard/district-engineer/complaints"
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:opacity-70 transition-opacity"
                  style={{ color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                  All <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                </Link>
              </div>
              {recentComplaints.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>check_circle</span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#181c22' }}>No complaints</p>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>District is all clear</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentComplaints.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f0fdf4' }}>
                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '16px' }}>feedback</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#181c22' }}>
                          {c.complaint_type?.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>{new Date(c.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="status-badge" style={statusStyle(c.status)}>{c.status?.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/dashboard/district-engineer/complaints"
                className="mt-4 w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: '#00450d', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif', display: 'flex', marginTop: '16px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>feedback</span>
                Manage Complaints
              </Link>
            </div>
          </div>

          {/* Row 4 — quick actions */}
          <div className="s5">
            <h3 className="font-headline font-bold text-base mb-4" style={{ color: '#181c22' }}>Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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

          {/* Row 5 — District Tonnage summary */}
          <div className="bento-card mt-6 mb-6 s6">
            <div className="px-8 py-6 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
              <div>
                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>District Tonnage</h3>
                <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                  Waste collection and report resolution overview for {profile?.district}
                </p>
              </div>
              <Link href="/dashboard/district-engineer/disposal"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80"
                style={{ background: '#f0fdf4', color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
                Full Disposal Report
              </Link>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Collections Completed', value: stats.completedCollections, icon: 'check_circle', color: '#00450d', sub: 'verified on-chain' },
                  { label: 'Complaints Resolved', value: stats.resolvedComplaints, icon: 'task_alt', color: '#1b5e20', sub: `of ${stats.totalComplaints} total` },
                  { label: 'Pending Waste Reports', value: stats.pendingReports, icon: 'pending', color: stats.pendingReports > 0 ? '#d97706' : '#00450d', sub: 'require attention' },
                ].map(m => (
                  <div key={m.label} style={{ padding: '20px', borderRadius: '12px', background: '#f9fafb', border: '1px solid rgba(0,69,13,0.04)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${m.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '22px' }}>{m.icon}</span>
                    </div>
                    <div>
                      <p className="font-headline font-extrabold text-2xl" style={{ color: '#181c22' }}>{m.value}</p>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</p>
                      <p style={{ fontSize: '11px', color: m.color, fontWeight: 600 }}>{m.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Intelligence log bar */}
          <div className="p-6 rounded-2xl flex items-center justify-between s6"
            style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.08)' }}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>verified</span>
              <div>
                <p className="text-sm font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                  Blockchain-verified collections active
                </p>
                <p className="text-xs" style={{ color: '#717a6d' }}>
                  {stats.completedCollections} collections logged on Polygon Amoy · {profile?.district || 'Your District'} · CMC 2026
                </p>
              </div>
            </div>
            <Link href="/dashboard/district-engineer/performance"
              className="px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90 whitespace-nowrap"
              style={{ background: '#00450d', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
              View Analytics
            </Link>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}