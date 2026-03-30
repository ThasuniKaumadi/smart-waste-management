'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const ADMIN_NAV = [
  { label: 'Overview', href: '/dashboard/admin', icon: 'dashboard' },
  { label: 'Users', href: '/dashboard/admin/users', icon: 'manage_accounts' },
  { label: 'Blockchain', href: '/dashboard/admin/blockchain', icon: 'link' },
  { label: 'Performance', href: '/dashboard/admin/performance', icon: 'analytics' },
]

export default function AdminDashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRoutes: 0,
    totalComplaints: 0,
    resolvedComplaints: 0,
    totalCollections: 0,
    blockchainRecords: 0,
    totalReports: 0,
    activeRoutes: 0,
  })
  const [roleData, setRoleData] = useState<any[]>([])
  const [complaintData, setComplaintData] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    const [
      { count: totalUsers },
      { count: totalRoutes },
      { count: totalComplaints },
      { count: resolvedComplaints },
      { count: totalCollections },
      { count: blockchainRecords },
      { count: totalReports },
      { count: activeRoutes },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('routes').select('*', { count: 'exact', head: true }),
      supabase.from('complaints').select('*', { count: 'exact', head: true }),
      supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }).not('blockchain_tx', 'is', null),
      supabase.from('waste_reports').select('*', { count: 'exact', head: true }),
      supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ])

    setStats({
      totalUsers: totalUsers || 0,
      totalRoutes: totalRoutes || 0,
      totalComplaints: totalComplaints || 0,
      resolvedComplaints: resolvedComplaints || 0,
      totalCollections: totalCollections || 0,
      blockchainRecords: blockchainRecords || 0,
      totalReports: totalReports || 0,
      activeRoutes: activeRoutes || 0,
    })

    const { data: rolesData } = await supabase.from('profiles').select('role')
    if (rolesData) {
      const counts: Record<string, number> = {}
      rolesData.forEach(r => { if (r.role) counts[r.role] = (counts[r.role] || 0) + 1 })
      setRoleData(Object.entries(counts).map(([name, value]) => ({ name: name.replace('_', ' '), value })))
    }

    const { data: compData } = await supabase.from('complaints').select('complaint_type')
    if (compData) {
      const counts: Record<string, number> = {}
      compData.forEach(c => { if (c.complaint_type) counts[c.complaint_type] = (counts[c.complaint_type] || 0) + 1 })
      setComplaintData(Object.entries(counts).map(([name, value]) => ({ name: name.replace('_', ' '), value })))
    }

    setLoading(false)
  }

  const resolutionRate = stats.totalComplaints > 0
    ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100) : 0

  const blockchainRate = stats.totalCollections > 0
    ? Math.round((stats.blockchainRecords / stats.totalCollections) * 100) : 0

  const COLORS = ['#00450d', '#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#66bb6a']

  const QUICK_LINKS = [
    { label: 'User Management', desc: 'Create and manage staff accounts', icon: 'manage_accounts', href: '/dashboard/admin/users', color: '#00450d' },
    { label: 'Blockchain Logs', desc: 'View on-chain transaction records', icon: 'link', href: '/dashboard/admin/blockchain', color: '#1b5e20' },
    { label: 'Performance', desc: 'System-wide analytics and charts', icon: 'analytics', href: '/dashboard/admin/performance', color: '#2e7d32' },
  ]

  return (
    <DashboardLayout
      role="Admin"
      userName={profile?.full_name || ''}
      navItems={ADMIN_NAV}
      primaryAction={{ label: 'Add User', href: '/dashboard/admin/users', icon: 'person_add' }}
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
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
          border: 1px solid rgba(0,69,13,0.04);
          transition: all 0.4s cubic-bezier(0.05,0.7,0.1,1.0);
          overflow: hidden;
        }
        .bento-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 50px -15px rgba(24,28,34,0.12);
        }
        .bento-card-green {
          background: #00450d;
          border-radius: 16px;
          color: white;
          transition: all 0.4s cubic-bezier(0.05,0.7,0.1,1.0);
          overflow: hidden;
          position: relative;
        }
        .bento-card-green:hover { transform: translateY(-4px); }

        .quick-link {
          background: white;
          border-radius: 16px;
          padding: 24px;
          border: 1px solid rgba(0,69,13,0.06);
          transition: all 0.35s cubic-bezier(0.05,0.7,0.1,1.0);
          text-decoration: none;
          display: block;
        }
        .quick-link:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -15px rgba(0,69,13,0.12);
          border-color: rgba(0,69,13,0.15);
        }

        .progress-bar {
          height: 6px;
          border-radius: 99px;
          background: #f0fdf4;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          border-radius: 99px;
          background: #00450d;
        }

        .log-item {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 16px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          transition: all 0.2s ease;
        }
        .log-item:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

        @keyframes staggerIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.2s both; }
        .s5 { animation: staggerIn 0.5s ease 0.25s both; }
      `}</style>

      {/* Hero header */}
      <section className="mb-10 s1" style={{ paddingLeft: '0' }}>
        <span className="font-label text-xs font-bold uppercase mb-2 block"
          style={{ letterSpacing: '0.2em', color: '#717a6d' }}>
          Enterprise Command Centre
        </span>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="font-headline font-extrabold tracking-tight"
            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
            Operations <span style={{ color: '#1b5e20' }}>Pulse</span>
          </h1>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: '#f0fdf4' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#16a34a' }} />
            <span className="text-sm font-medium" style={{ color: '#14532d', fontFamily: 'Inter, sans-serif' }}>
              Live Network Feed
            </span>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
              style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#717a6d' }}>Loading system data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* BENTO GRID — row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">

            {/* Large card — Collections */}
            <div className="bento-card md:col-span-8 p-8 s2">
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full -mr-16 -mt-16"
                style={{ background: 'rgba(0,69,13,0.03)' }} />
              <div className="flex items-start justify-between mb-8">
                <div>
                  <span className="font-label text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d' }}>Active Pickup Streams</span>
                  <h2 className="font-headline font-bold text-2xl" style={{ color: '#181c22' }}>
                    Real-time Logistics
                  </h2>
                </div>
                <div className="p-3 rounded-full" style={{ background: '#f0fdf4' }}>
                  <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>
                    local_shipping
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'Total Collections', value: stats.totalCollections.toLocaleString(), color: '#181c22' },
                  { label: 'On-Chain Verified', value: stats.blockchainRecords, color: '#00450d' },
                  { label: 'Active Routes', value: stats.activeRoutes, color: '#1b5e20' },
                ].map(m => (
                  <div key={m.label} className="p-4 rounded-xl" style={{ background: '#f8fafc' }}>
                    <p className="font-label text-xs font-bold uppercase mb-1"
                      style={{ letterSpacing: '0.15em', color: '#94a3b8' }}>{m.label}</p>
                    <p className="font-headline text-2xl font-bold" style={{ color: m.color }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Mini bar chart */}
              <div style={{ height: '120px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={roleData.slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter' }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#00450d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Fleet health narrow */}
            <div className="bento-card md:col-span-4 p-8 flex flex-col justify-between s2">
              <div>
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>System Health</h2>
                  <span className="material-symbols-outlined" style={{ color: '#717a6d', fontSize: '20px' }}>
                    monitor_heart
                  </span>
                </div>
                <div className="space-y-5">
                  {[
                    { label: 'Blockchain Rate', value: blockchainRate, color: '#00450d' },
                    { label: 'Resolution Rate', value: resolutionRate, color: '#1b5e20' },
                    { label: 'System Uptime', value: 99, color: '#2e7d32' },
                  ].map(m => (
                    <div key={m.label} className="group">
                      <div className="flex justify-between text-sm mb-2">
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

              <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(0,69,13,0.08)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: '#f0fdf4' }}>
                    <span className="text-lg">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                      All systems operational
                    </p>
                    <p className="text-xs" style={{ color: '#717a6d' }}>Supabase · Netlify · Polygon</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BENTO GRID — row 2: 4 metric cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 s3">

            {/* Green feature card */}
            <div className="bento-card-green p-8">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-12 -mt-12"
                style={{ background: 'rgba(163,246,156,0.08)' }} />
              <span className="material-symbols-outlined mb-4 block" style={{ color: '#a3f69c', fontSize: '28px' }}>eco</span>
              <p className="font-label text-xs font-bold uppercase mb-2"
                style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)' }}>Total Users</p>
              <p className="font-headline font-extrabold tracking-tighter mb-1" style={{ fontSize: '40px' }}>
                {stats.totalUsers}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Registered accounts</p>
            </div>

            <div className="bento-card p-8">
              <span className="material-symbols-outlined mb-4 block" style={{ color: '#00450d', fontSize: '24px' }}>
                route
              </span>
              <p className="font-label text-xs font-bold uppercase mb-2"
                style={{ letterSpacing: '0.15em', color: '#94a3b8' }}>Total Routes</p>
              <p className="font-headline font-extrabold text-4xl tracking-tighter" style={{ color: '#181c22' }}>
                {stats.totalRoutes}
              </p>
              <p className="text-xs mt-2 flex items-center gap-1" style={{ color: '#00450d' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>trending_up</span>
                {stats.activeRoutes} active now
              </p>
            </div>

            <div className="bento-card p-8">
              <span className="material-symbols-outlined mb-4 block" style={{ color: '#ba1a1a', fontSize: '24px' }}>
                report
              </span>
              <p className="font-label text-xs font-bold uppercase mb-2"
                style={{ letterSpacing: '0.15em', color: '#94a3b8' }}>Complaints</p>
              <p className="font-headline font-extrabold text-4xl tracking-tighter" style={{ color: '#181c22' }}>
                {stats.totalComplaints}
              </p>
              <p className="text-xs mt-2 font-bold" style={{ color: '#00450d' }}>
                {resolutionRate}% resolved
              </p>
            </div>

            <div className="bento-card p-8">
              <span className="material-symbols-outlined mb-4 block" style={{ color: '#00450d', fontSize: '24px' }}>
                photo_camera
              </span>
              <p className="font-label text-xs font-bold uppercase mb-2"
                style={{ letterSpacing: '0.15em', color: '#94a3b8' }}>Waste Reports</p>
              <p className="font-headline font-extrabold text-4xl tracking-tighter" style={{ color: '#181c22' }}>
                {stats.totalReports}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00450d' }} />
                <span className="text-xs" style={{ color: '#717a6d' }}>Geo-tagged</span>
              </div>
            </div>
          </div>

          {/* BENTO GRID — row 3: chart + quick actions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 s4">

            {/* Complaint type chart */}
            <div className="bento-card lg:col-span-8 p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                    Directory Analytics
                  </h3>
                  <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                    Performance distribution across all registered entities
                  </p>
                </div>
                <button className="px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider"
                  style={{ background: '#f1f5f9', color: '#41493e', fontFamily: 'Manrope, sans-serif' }}>
                  View Full Report
                </button>
              </div>

              {complaintData.length === 0 ? (
                <div className="h-48 flex items-center justify-center" style={{ color: '#94a3b8' }}>
                  <p className="text-sm">No complaint data yet</p>
                </div>
              ) : (
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={complaintData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter' }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#1b5e20" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Smart summary card */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bento-card p-8 flex-1">
                <span className="material-symbols-outlined mb-4 block" style={{ color: '#00450d', fontSize: '28px' }}>
                  verified
                </span>
                <h4 className="font-headline font-bold text-lg mb-2" style={{ color: '#181c22' }}>
                  Blockchain Audit
                </h4>
                <p className="text-sm mb-4" style={{ color: '#717a6d' }}>
                  {stats.blockchainRecords} collections verified on Polygon Amoy testnet.
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold text-xs"
                    style={{ borderColor: '#f0fdf4', borderTopColor: '#00450d', color: '#00450d', fontFamily: 'Manrope' }}>
                    {blockchainRate}%
                  </div>
                  <span className="text-xs font-medium" style={{ color: '#717a6d' }}>
                    Verification rate for current cycle
                  </span>
                </div>
              </div>

              <div className="p-8 rounded-2xl relative overflow-hidden"
                style={{ background: '#00450d', color: 'white' }}>
                <div className="absolute -bottom-4 -right-4 text-9xl" style={{ opacity: 0.05 }}>⛓</div>
                <h4 className="font-headline font-bold text-lg mb-3">Smart Contract</h4>
                <p className="text-sm mb-4" style={{ color: 'rgba(163,246,156,0.7)' }}>
                  Polygon Amoy testnet · Contract active and monitoring all collections.
                </p>
                <Link href="/dashboard/admin/blockchain"
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-center block transition-all"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.15)' }}>
                  View Blockchain Logs
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Activity Log */}
          <div className="s5" style={{ background: 'rgba(240,253,244,0.5)', borderRadius: '16px', padding: '32px', marginBottom: '24px' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline font-bold text-2xl tracking-tight" style={{ color: '#181c22' }}>
                Recent Intelligence Log
              </h2>
              <Link href="/dashboard/admin/blockchain"
                className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-70 transition-opacity"
                style={{ color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                Full Log
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>database</span>
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { time: 'Live', text: `${stats.totalUsers} registered users across 10 roles`, tag: 'Users', color: '#00450d' },
                { time: 'Live', text: `${stats.blockchainRecords} collection events verified on Polygon Amoy`, tag: 'Blockchain', color: '#1b5e20' },
                { time: 'Live', text: `${stats.totalReports} crowdsourced waste reports with geo-location`, tag: 'Reports', color: '#2e7d32' },
              ].map((item, i) => (
                <div key={i} className="log-item">
                  <span className="text-xs font-bold w-10 flex-shrink-0"
                    style={{ color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>{item.time}</span>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <p className="text-sm font-medium flex-1" style={{ color: '#181c22' }}>{item.text}</p>
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight flex-shrink-0"
                    style={{ background: '#f0fdf4', color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                    {item.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="s5">
            <h3 className="font-headline font-bold text-base mb-4" style={{ color: '#181c22' }}>
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {QUICK_LINKS.map(link => (
                <Link key={link.href} href={link.href} className="quick-link">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: `${link.color}12` }}>
                    <span className="material-symbols-outlined" style={{ color: link.color, fontSize: '22px' }}>
                      {link.icon}
                    </span>
                  </div>
                  <p className="font-bold text-sm mb-1" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                    {link.label}
                  </p>
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