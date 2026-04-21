'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const ADMIN_NAV = [
  { label: 'Home', href: '/dashboard/admin', icon: 'dashboard' },
  { label: 'Users', href: '/dashboard/admin/users', icon: 'manage_accounts' },
  { label: 'Billing', href: '/dashboard/admin/billing', icon: 'payments' },
  { label: 'Billing Rates', href: '/dashboard/admin/billing-rates', icon: 'tune' },
  { label: 'Blockchain', href: '/dashboard/admin/blockchain', icon: 'link' },
  { label: 'Performance', href: '/dashboard/admin/performance', icon: 'analytics' },
  { label: 'Disposal', href: '/dashboard/admin/disposal', icon: 'delete_sweep' },
  { label: 'Reports', href: '/dashboard/admin/reports', icon: 'rate_review' },
  { label: 'Profile', href: '/dashboard/admin/profile', icon: 'person' },
]

const QUICK_ACTIONS = [
  { label: 'User Management', desc: 'Create and manage staff accounts', icon: 'manage_accounts', href: '/dashboard/admin/users', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  { label: 'Blockchain Logs', desc: 'View on-chain transaction records', icon: 'link', href: '/dashboard/admin/blockchain', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { label: 'Performance', desc: 'Analytics and system-wide charts', icon: 'analytics', href: '/dashboard/admin/performance', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
  { label: 'Billing', desc: 'Commercial invoices and payments', icon: 'payments', href: '/dashboard/admin/billing', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { label: 'Billing Rates', desc: 'Set Tier A/B pricing rules', icon: 'tune', href: '/dashboard/admin/billing-rates', color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
  { label: 'Reports', desc: 'Waste reports and complaints', icon: 'rate_review', href: '/dashboard/admin/reports', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
]

export default function AdminDashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0, totalRoutes: 0, totalComplaints: 0, resolvedComplaints: 0,
    totalCollections: 0, blockchainRecords: 0, totalReports: 0, activeRoutes: 0,
    unresolvedAlerts: 0,
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
      { count: unresolvedAlerts },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('routes').select('*', { count: 'exact', head: true }),
      supabase.from('complaints').select('*', { count: 'exact', head: true }),
      supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }).not('blockchain_tx', 'is', null),
      supabase.from('waste_reports').select('*', { count: 'exact', head: true }),
      supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('exception_alerts').select('*', { count: 'exact', head: true }).eq('is_resolved', false),
    ])

    setStats({
      totalUsers: totalUsers || 0, totalRoutes: totalRoutes || 0,
      totalComplaints: totalComplaints || 0, resolvedComplaints: resolvedComplaints || 0,
      totalCollections: totalCollections || 0, blockchainRecords: blockchainRecords || 0,
      totalReports: totalReports || 0, activeRoutes: activeRoutes || 0,
      unresolvedAlerts: unresolvedAlerts || 0,
    })

    const { data: rolesData } = await supabase.from('profiles').select('role')
    if (rolesData) {
      const counts: Record<string, number> = {}
      rolesData.forEach(r => { if (r.role) counts[r.role] = (counts[r.role] || 0) + 1 })
      setRoleData(Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })))
    }

    const { data: compData } = await supabase.from('complaints').select('complaint_type')
    if (compData) {
      const counts: Record<string, number> = {}
      compData.forEach(c => { if (c.complaint_type) counts[c.complaint_type] = (counts[c.complaint_type] || 0) + 1 })
      setComplaintData(Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })))
    }

    setLoading(false)
  }

  const resolutionRate = stats.totalComplaints > 0 ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100) : 0
  const blockchainRate = stats.totalCollections > 0 ? Math.round((stats.blockchainRecords / stats.totalCollections) * 100) : 0
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const greetingEmoji = hour < 12 ? '🌤️' : hour < 17 ? '☀️' : '🌙'
  const firstName = profile?.full_name?.split(' ')[0] || 'Admin'

  return (
    <DashboardLayout
      role="Admin"
      userName={profile?.full_name || ''}
      navItems={ADMIN_NAV}
      primaryAction={{ label: 'Add User', href: '/dashboard/admin/users', icon: 'person_add' }}
    >
      <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
        .action-card { border-radius:16px; padding:16px; text-decoration:none; display:flex; align-items:flex-start; gap:12px; transition:all 0.2s; border:1.5px solid transparent; }
        .action-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.08); }
        .stat-card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); padding:20px; transition:transform 0.2s ease,box-shadow 0.2s ease; }
        .stat-card:hover { transform:translateY(-3px); box-shadow:0 12px 32px rgba(0,0,0,0.09); }
        .metric-row { display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(0,69,13,0.04); }
        .metric-row:last-child { border-bottom:none; }
        .progress-bar { height:6px; border-radius:99px; background:#f0fdf4; overflow:hidden; }
        .progress-fill { height:100%; border-radius:99px; }
        .hero { background:linear-gradient(135deg,#00450d 0%,#1b5e20 60%,#2e7d32 100%); border-radius:20px; padding:22px 28px; position:relative; overflow:hidden; }
        .hero::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 80% 50%,rgba(255,255,255,0.07) 0%,transparent 60%); pointer-events:none; }
        .hero::after  { content:''; position:absolute; right:-40px; top:-40px; width:200px; height:200px; border-radius:50%; background:rgba(255,255,255,0.04); pointer-events:none; }
        .alert-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both}
        .a3{animation:fadeUp .4s ease .14s both} .a4{animation:fadeUp .4s ease .19s both}
        .a5{animation:fadeUp .4s ease .24s both}
        .live{animation:pulse 2s ease-in-out infinite}
      `}</style>

      {/* ── Greeting ── */}
      <div className="a1" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>
              {greetingEmoji} {greeting}, CMC
            </p>
            <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: '46px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
              Operations <span style={{ color: '#00450d' }}>Pulse</span>
            </h1>
            <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>
              {now.toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              &nbsp;&middot;&nbsp;Colombo Municipal Council
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {stats.unresolvedAlerts > 0 && (
              <Link href="/dashboard/admin/reports" style={{ textDecoration: 'none' }}>
                <span className="alert-pill" style={{ background: '#fef2f2', color: '#dc2626' }}>
                  <span className="msf" style={{ fontSize: 14 }}>warning</span>
                  {stats.unresolvedAlerts} unresolved alert{stats.unresolvedAlerts !== 1 ? 's' : ''}
                </span>
              </Link>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 99, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.12)' }}>
              <div className="live" style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>Live Network Feed</span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'start' }}>

          {/* ── LEFT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* KPI strip */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
              {[
                { icon: 'group', label: 'Total Users', value: stats.totalUsers, color: '#15803d', bg: '#f0fdf4', sub: 'Registered accounts' },
                { icon: 'route', label: 'Total Routes', value: stats.totalRoutes, color: '#1d4ed8', bg: '#eff6ff', sub: `${stats.activeRoutes} active` },
                { icon: 'feedback', label: 'Complaints', value: stats.totalComplaints, color: stats.totalComplaints > 0 ? '#d97706' : '#15803d', bg: stats.totalComplaints > 0 ? '#fffbeb' : '#f0fdf4', sub: `${resolutionRate}% resolved` },
                { icon: 'description', label: 'Active Users', value: stats.totalUsers, color: '#7c3aed', bg: '#faf5ff', sub: 'Active agreements' },
                { icon: 'link', label: 'On-Chain', value: stats.blockchainRecords, color: '#0e7490', bg: '#ecfeff', sub: `${blockchainRate}% verified` },
              ].map(card => (
                <div key={card.label} className="stat-card">
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <span className="msf" style={{ fontSize: 20, color: card.color }}>{card.icon}</span>
                  </div>
                  <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 30, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{card.value}</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#41493e', margin: '0 0 2px', fontFamily: 'Manrope,sans-serif' }}>{card.label}</p>
                  <p style={{ fontSize: 11, color: card.color, margin: 0, fontWeight: 500 }}>{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="a3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* Users by role */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>System Overview</p>
                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: 0 }}>Users by Role</h3>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msf" style={{ color: '#00450d', fontSize: 18 }}>group</span>
                  </div>
                </div>
                {roleData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>No user data yet</div>
                ) : (
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={roleData.slice(0, 6)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'Inter' }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Inter', fontSize: 12 }} />
                        <Bar dataKey="value" fill="#00450d" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Complaint types */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>Resident Feedback</p>
                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: 0 }}>Complaint Types</h3>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msf" style={{ color: '#d97706', fontSize: 18 }}>feedback</span>
                  </div>
                </div>
                {complaintData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>No complaint data yet</div>
                ) : (
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={complaintData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'Inter' }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Inter', fontSize: 12 }} />
                        <Bar dataKey="value" fill="#d97706" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Real-time logistics */}
            <div className="a4 card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="msf" style={{ color: '#1d4ed8', fontSize: 18 }}>local_shipping</span>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>Active Pickup Streams</p>
                  <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: 0 }}>Real-time Logistics</h3>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {[
                  { label: 'Total Collections', value: stats.totalCollections, icon: 'delete_sweep', color: '#15803d', bg: '#f0fdf4' },
                  { label: 'On-Chain Verified', value: stats.blockchainRecords, icon: 'verified', color: '#0e7490', bg: '#ecfeff' },
                  { label: 'Active Routes', value: stats.activeRoutes, icon: 'directions_car', color: '#1d4ed8', bg: '#eff6ff' },
                  { label: 'Waste Reports', value: stats.totalReports, icon: 'photo_camera', color: '#7c3aed', bg: '#faf5ff' },
                ].map(m => (
                  <div key={m.label} style={{ background: m.bg, borderRadius: 14, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      <span className="msf" style={{ fontSize: 17, color: m.color }}>{m.icon}</span>
                    </div>
                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 26, color: '#181c22', margin: 0, lineHeight: 1 }}>{m.value}</p>
                    <p style={{ fontSize: 11, color: m.color, fontWeight: 600, margin: 0 }}>{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="a4">
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Quick Actions</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {QUICK_ACTIONS.map(a => (
                  <Link key={a.href} href={a.href} className="action-card" style={{ background: a.bg, borderColor: a.border }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      <span className="msf" style={{ fontSize: 20, color: a.color }}>{a.icon}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 2 }}>{a.label}</p>
                      <p style={{ fontSize: 10, color: '#717a6d', lineHeight: 1.4 }}>{a.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Blockchain bar */}
            <div className="a5" style={{ borderRadius: 14, padding: '14px 20px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="msf" style={{ color: '#00450d', fontSize: 20 }}>verified</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#00450d', fontFamily: 'Manrope,sans-serif', margin: 0 }}>Blockchain-verified collections</p>
                  <p style={{ fontSize: 11, color: '#717a6d', margin: 0 }}>Every stop logged on Polygon Amoy</p>
                </div>
              </div>
              <Link href="/dashboard/admin/blockchain" style={{ background: '#00450d', color: 'white', padding: '7px 16px', borderRadius: 99, fontWeight: 700, fontSize: 12, textDecoration: 'none', fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>View Logs</Link>
            </div>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Hero stats card */}
            <div className="hero a1">
              <div style={{ position: 'relative', zIndex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(163,246,156,0.75)', fontFamily: 'Manrope,sans-serif', margin: '0 0 16px' }}>System Overview</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { value: stats.totalUsers, label: 'Registered Users', icon: 'group' },
                    { value: stats.totalRoutes, label: 'Total Routes', icon: 'route' },
                    { value: stats.totalComplaints, label: 'Total Complaints', icon: 'feedback' },
                    { value: stats.blockchainRecords, label: 'On-Chain Records', icon: 'link' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="msf" style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)' }}>{s.icon}</span>
                      </div>
                      <div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 22, color: 'white', lineHeight: 1, margin: '0 0 2px' }}>{s.value}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* System Health card */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="msf" style={{ color: '#00450d', fontSize: 18 }}>monitor_heart</span>
                </div>
                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', margin: 0 }}>System Health</h3>
              </div>
              {[
                { label: 'Blockchain Rate', value: blockchainRate, color: '#0e7490' },
                { label: 'Resolution Rate', value: resolutionRate, color: '#15803d' },
                { label: 'System Uptime', value: 99, color: '#1b5e20' },
              ].map(m => (
                <div key={m.label} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#41493e', fontWeight: 500 }}>{m.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.value}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${m.value}%`, background: m.color }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="msf" style={{ color: '#00450d', fontSize: 18 }}>check_circle</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif', margin: 0 }}>All systems operational</p>
                  <p style={{ fontSize: 11, color: '#717a6d', margin: 0 }}>Supabase · Netlify · Polygon</p>
                </div>
              </div>
            </div>

            {/* Blockchain audit card */}
            <div style={{ borderRadius: 16, padding: '20px', background: 'linear-gradient(135deg,#00450d,#1b5e20)', color: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="msf" style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>verified</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope,sans-serif' }}>Blockchain Audit</span>
              </div>
              <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 28, color: 'white', margin: '0 0 4px', lineHeight: 1 }}>{blockchainRate}%</p>
              <p style={{ fontSize: 12, color: 'rgba(163,246,156,0.8)', margin: '0 0 14px' }}>
                {stats.blockchainRecords} collections verified on Polygon Amoy testnet.
              </p>
              <Link href="/dashboard/admin/blockchain" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 10, background: 'rgba(255,255,255,0.12)', color: 'white', textDecoration: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', border: '1px solid rgba(255,255,255,0.15)' }}>
                <span className="msf" style={{ fontSize: 15 }}>link</span>
                View Blockchain Logs
              </Link>
            </div>

          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
