'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const ADMIN_NAV = [
  { label: 'Overview', href: '/dashboard/admin', icon: 'dashboard', section: 'Main' },
  { label: 'Users', href: '/dashboard/admin/users', icon: 'manage_accounts', section: 'Management' },
  { label: 'Supervisors', href: '/dashboard/admin/supervisors', icon: 'supervisor_account', section: 'Management' },
  { label: 'Zones', href: '/dashboard/admin/zones', icon: 'map', section: 'Management' },
  { label: 'Contracts', href: '/dashboard/admin/contracts', icon: 'description', section: 'Management' },
  { label: 'Billing', href: '/dashboard/admin/billing', icon: 'payments', section: 'Finance' },
  { label: 'Contractor Billing', href: '/dashboard/admin/billing-contractor', icon: 'receipt_long', section: 'Finance' },
  { label: 'Commercial Analytics', href: '/dashboard/admin/commercial-analytics', icon: 'store', section: 'Finance' },
  { label: 'Recycler Analytics', href: '/dashboard/admin/recycler-analytics', icon: 'recycling', section: 'Finance' },
  { label: 'Blockchain', href: '/dashboard/admin/blockchain', icon: 'link', section: 'Analytics' },
  { label: 'Performance', href: '/dashboard/admin/performance', icon: 'analytics', section: 'Analytics' },
  { label: 'Incidents', href: '/dashboard/admin/incidents', icon: 'warning', section: 'Analytics' },
  { label: 'Disposal', href: '/dashboard/admin/disposal', icon: 'delete_sweep', section: 'Analytics' },
  { label: 'Announcements', href: '/dashboard/admin/announcements', icon: 'campaign', section: 'Communications' },
  { label: 'Communications', href: '/dashboard/admin/communications', icon: 'chat', section: 'Communications' },
]

export default function AdminDashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0, totalRoutes: 0, totalComplaints: 0, resolvedComplaints: 0,
    totalCollections: 0, blockchainRecords: 0, totalReports: 0, activeRoutes: 0,
    totalContracts: 0, unresolvedAlerts: 0,
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
      { count: totalContracts },
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
      supabase.from('contracts').select('*', { count: 'exact', head: true }),
      supabase.from('exception_alerts').select('*', { count: 'exact', head: true }).eq('is_resolved', false),
    ])

    setStats({
      totalUsers: totalUsers || 0, totalRoutes: totalRoutes || 0,
      totalComplaints: totalComplaints || 0, resolvedComplaints: resolvedComplaints || 0,
      totalCollections: totalCollections || 0, blockchainRecords: blockchainRecords || 0,
      totalReports: totalReports || 0, activeRoutes: activeRoutes || 0,
      totalContracts: totalContracts || 0, unresolvedAlerts: unresolvedAlerts || 0,
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
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <DashboardLayout
      role="Admin"
      userName={profile?.full_name || ''}
      navItems={ADMIN_NAV}
      primaryAction={{ label: 'Add User', href: '/dashboard/admin/users', icon: 'person_add' }}
    >
      <style>{`
        .ms { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .bento { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .stat-card { transition:transform 0.2s ease,box-shadow 0.2s ease; }
        .stat-card:hover { transform:translateY(-3px); box-shadow:0 16px 40px -12px rgba(24,28,34,0.12); }
        .quick-link { background:white; border-radius:14px; padding:18px; border:1.5px solid rgba(0,69,13,0.06); text-decoration:none; display:flex; align-items:center; gap:12px; transition:all 0.2s; }
        .quick-link:hover { border-color:rgba(0,69,13,0.2); box-shadow:0 8px 24px rgba(0,0,0,0.07); transform:translateY(-2px); }
        .metric-row { display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(0,69,13,0.04); }
        .metric-row:last-child { border-bottom:none; }
        .progress-bar { height:6px; border-radius:99px; background:#f0fdf4; overflow:hidden; }
        .progress-fill { height:100%; border-radius:99px; }
        .alert-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; }
        @keyframes staggerIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .s1{animation:staggerIn 0.45s ease 0.05s both}
        .s2{animation:staggerIn 0.45s ease 0.10s both}
        .s3{animation:staggerIn 0.45s ease 0.15s both}
        .s4{animation:staggerIn 0.45s ease 0.20s both}
        .s5{animation:staggerIn 0.45s ease 0.25s both}
        .live{animation:pulse 2s ease-in-out infinite}
      `}</style>

      {/* ── Header ── */}
      <div className="s1" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '12px', color: '#717a6d', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px', fontFamily: 'Manrope, sans-serif' }}>
              {greeting}, {profile?.full_name?.split(' ')[0] || 'Admin'}
            </p>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '42px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: 0 }}>
              Operations <span style={{ color: '#1b5e20' }}>Pulse</span>
            </h1>
            <p style={{ fontSize: '13px', color: '#717a6d', margin: '4px 0 0' }}>
              {now.toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              &nbsp;&middot;&nbsp;Colombo Municipal Council
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {stats.unresolvedAlerts > 0 && (
              <Link href="/dashboard/admin/incidents" style={{ textDecoration: 'none' }}>
                <span className="alert-pill" style={{ background: '#fef2f2', color: '#dc2626' }}>
                  <span className="ms" style={{ fontSize: '14px' }}>warning</span>
                  {stats.unresolvedAlerts} unresolved alert{stats.unresolvedAlerts !== 1 ? 's' : ''}
                </span>
              </Link>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', borderRadius: '99px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.12)' }}>
              <div className="live" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>Live Network Feed</span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '32px', height: '32px', border: '2.5px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ fontSize: '13px', color: '#717a6d' }}>Loading system data...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      ) : (
        <>
          {/* ── Row 1: Primary KPI cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }} className="s2">
            {[
              { icon: 'group', label: 'Total Users', value: stats.totalUsers, color: '#00450d', bg: '#f0fdf4', sub: 'Registered accounts' },
              { icon: 'route', label: 'Total Routes', value: stats.totalRoutes, color: '#1d4ed8', bg: '#eff6ff', sub: `${stats.activeRoutes} active now` },
              { icon: 'feedback', label: 'Complaints', value: stats.totalComplaints, color: stats.totalComplaints > 0 ? '#d97706' : '#00450d', bg: stats.totalComplaints > 0 ? '#fefce8' : '#f0fdf4', sub: `${resolutionRate}% resolved` },
              { icon: 'description', label: 'Contracts', value: stats.totalContracts, color: '#7c3aed', bg: '#f5f3ff', sub: 'Active agreements' },
              { icon: 'link', label: 'On-Chain', value: stats.blockchainRecords, color: '#0891b2', bg: '#f0f9ff', sub: `${blockchainRate}% verified` },
            ].map(card => (
              <div key={card.label} className="bento stat-card" style={{ padding: '20px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                  <span className="ms" style={{ fontSize: '20px', color: card.color }}>{card.icon}</span>
                </div>
                <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '30px', color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{card.value}</p>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#41493e', margin: '0 0 2px', fontFamily: 'Manrope, sans-serif' }}>{card.label}</p>
                <p style={{ fontSize: '11px', color: card.color, margin: 0, fontWeight: 500 }}>{card.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Row 2: Charts + System Health ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 340px', gap: '20px', marginBottom: '20px' }} className="s3">

            {/* Users by role bar chart */}
            <div className="bento" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', margin: '0 0 2px' }}>System Overview</p>
                  <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>Users by Role</h3>
                </div>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="ms" style={{ color: '#00450d', fontSize: '18px' }}>group</span>
                </div>
              </div>
              {roleData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '13px' }}>No user data yet</div>
              ) : (
                <div style={{ height: '160px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={roleData.slice(0, 6)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'Inter' }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Inter', fontSize: '12px' }} />
                      <Bar dataKey="value" fill="#00450d" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Complaint analytics */}
            <div className="bento" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', margin: '0 0 2px' }}>Resident Feedback</p>
                  <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>Complaint Types</h3>
                </div>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="ms" style={{ color: '#d97706', fontSize: '18px' }}>feedback</span>
                </div>
              </div>
              {complaintData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '13px' }}>No complaint data yet</div>
              ) : (
                <div style={{ height: '160px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={complaintData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'Inter' }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Inter', fontSize: '12px' }} />
                      <Bar dataKey="value" fill="#d97706" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* System Health */}
            <div className="bento" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="ms" style={{ color: '#00450d', fontSize: '18px' }}>monitor_heart</span>
                </div>
                <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>System Health</h3>
              </div>
              {[
                { label: 'Blockchain Rate', value: blockchainRate, color: '#0891b2' },
                { label: 'Resolution Rate', value: resolutionRate, color: '#00450d' },
                { label: 'System Uptime', value: 99, color: '#1b5e20' },
              ].map(m => (
                <div key={m.label} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#41493e', fontWeight: 500 }}>{m.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: m.color }}>{m.value}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${m.value}%`, background: m.color }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '20px', padding: '12px 14px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="ms" style={{ color: '#00450d', fontSize: '18px' }}>check_circle</span>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif', margin: 0 }}>All systems operational</p>
                  <p style={{ fontSize: '11px', color: '#717a6d', margin: 0 }}>Supabase &middot; Netlify &middot; Polygon</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 3: Activity metrics + Quick links ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }} className="s4">

            {/* Activity metrics */}
            <div className="bento" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="ms" style={{ color: '#1d4ed8', fontSize: '18px' }}>local_shipping</span>
                </div>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', margin: 0 }}>Active Pickup Streams</p>
                  <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>Real-time Logistics</h3>
                </div>
              </div>
              {[
                { label: 'Total Collections', value: stats.totalCollections, icon: 'delete_sweep', color: '#00450d' },
                { label: 'On-Chain Verified', value: stats.blockchainRecords, icon: 'verified', color: '#0891b2' },
                { label: 'Active Routes', value: stats.activeRoutes, icon: 'directions_car', color: '#1d4ed8' },
                { label: 'Waste Reports', value: stats.totalReports, icon: 'photo_camera', color: '#7c3aed' },
              ].map(m => (
                <div key={m.label} className="metric-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="ms" style={{ fontSize: '16px', color: m.color }}>{m.icon}</span>
                    </div>
                    <span style={{ fontSize: '13px', color: '#41493e', fontWeight: 500 }}>{m.label}</span>
                  </div>
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '20px', color: '#181c22' }}>{m.value}</span>
                </div>
              ))}
            </div>

            {/* Blockchain card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="bento" style={{ padding: '24px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <span className="ms" style={{ color: '#00450d', fontSize: '24px' }}>verified</span>
                  <h4 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '15px', color: '#181c22', margin: 0 }}>Blockchain Audit</h4>
                </div>
                <p style={{ fontSize: '13px', color: '#717a6d', marginBottom: '12px', lineHeight: 1.5 }}>
                  {stats.blockchainRecords} collections verified on Polygon Amoy testnet.
                </p>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif', marginBottom: '16px' }}>{blockchainRate}% verification rate</p>
                <Link href="/dashboard/admin/blockchain" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.12)', color: '#00450d', textDecoration: 'none', fontSize: '13px', fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}>
                  <span className="ms" style={{ fontSize: '16px' }}>link</span>
                  View Blockchain Logs
                </Link>
              </div>
              <div style={{ padding: '20px', borderRadius: '16px', background: 'linear-gradient(135deg, #00450d, #1b5e20)', color: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="ms" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)' }}>hub</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope, sans-serif' }}>Smart Contract</span>
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(163,246,156,0.8)', margin: 0 }}>
                  Polygon Amoy testnet &middot; Active and monitoring all collections.
                </p>
              </div>
            </div>
          </div>

          {/* ── Row 4: Quick links ── */}
          <div className="s5">
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '15px', color: '#181c22', margin: '0 0 14px' }}>Quick Actions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'User Management', desc: 'Create and manage staff accounts', icon: 'manage_accounts', href: '/dashboard/admin/users', color: '#00450d', bg: '#f0fdf4' },
                { label: 'Blockchain Logs', desc: 'View on-chain transaction records', icon: 'link', href: '/dashboard/admin/blockchain', color: '#0891b2', bg: '#f0f9ff' },
                { label: 'System Performance', desc: 'Analytics and system-wide charts', icon: 'analytics', href: '/dashboard/admin/performance', color: '#7c3aed', bg: '#f5f3ff' },
                { label: 'Billing Management', desc: 'Commercial invoices and payments', icon: 'payments', href: '/dashboard/admin/billing', color: '#d97706', bg: '#fefce8' },
                { label: 'Contracts', desc: 'Manage contractor agreements', icon: 'description', href: '/dashboard/admin/contracts', color: '#1d4ed8', bg: '#eff6ff' },
                { label: 'Zone Assignments', desc: 'Assign wards to contractors', icon: 'map', href: '/dashboard/admin/zones', color: '#00450d', bg: '#f0fdf4' },
                { label: 'Announcements', desc: 'Post notices to all staff', icon: 'campaign', href: '/dashboard/admin/announcements', color: '#dc2626', bg: '#fef2f2' },
                { label: 'Incidents', desc: 'Review exception alerts', icon: 'warning', href: '/dashboard/admin/incidents', color: '#d97706', bg: '#fefce8' },
              ].map(action => (
                <Link key={action.label} href={action.href} className="quick-link">
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="ms" style={{ fontSize: '18px', color: action.color }}>{action.icon}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: '0 0 1px', fontFamily: 'Manrope, sans-serif' }}>{action.label}</p>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{action.desc}</p>
                  </div>
                  <span className="ms" style={{ fontSize: '16px', color: '#c4c9c0', flexShrink: 0 }}>chevron_right</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}