'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

const COMMERCIAL_NAV = [
  { label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' },
  { label: 'Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_month' },
  { label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' },
  { label: 'Bins', href: '/dashboard/commercial/bins', icon: 'delete' },
  { label: 'Collection History', href: '/dashboard/commercial/collection-history', icon: 'history' },
  { label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' },
  { label: 'Rate Service', href: '/dashboard/commercial/feedback', icon: 'star' },
  { label: 'Profile', href: '/dashboard/commercial/profile', icon: 'manage_accounts' },
]

const TODAY = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default function CommercialDashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [nextSchedule, setNextSchedule] = useState<any>(null)
  const [recentComplaints, setRecentComplaints] = useState<any[]>([])
  const [billingSummary, setBillingSummary] = useState<any>(null)
  const [recentCollection, setRecentCollection] = useState<any>(null)
  const [stats, setStats] = useState({
    totalComplaints: 0,
    pendingBills: 0,
    totalBins: 0,
    complianceRate: 100,
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    const today = new Date().toISOString().split('T')[0]

    const [schedulesRes, complaintsRes, billingRes, collectionsRes, pendingBillsRes] = await Promise.all([
      p?.district ? supabase.from('schedules').select('*')
        .eq('district', p.district).eq('published', true)
        .gte('scheduled_date', today)
        .order('scheduled_date', { ascending: true }).limit(1) : { data: [] },
      supabase.from('complaints').select('*')
        .eq('submitted_by', user.id)
        .order('created_at', { ascending: false }).limit(3),
      supabase.from('commercial_billing_summary').select('*')
        .eq('commercial_id', user.id).maybeSingle(),
      supabase.from('collection_stops').select('*')
        .eq('commercial_id', user.id).eq('is_commercial', true)
        .order('completed_at', { ascending: false }).limit(1),
      supabase.from('invoices').select('*', { count: 'exact', head: true })
        .eq('commercial_id', user.id).in('status', ['pending', 'unpaid', 'overdue']),
    ])

    if (schedulesRes.data && schedulesRes.data.length > 0) setNextSchedule(schedulesRes.data[0])
    setRecentComplaints(complaintsRes.data || [])
    setBillingSummary(billingRes.data)
    if (collectionsRes.data && collectionsRes.data.length > 0) setRecentCollection(collectionsRes.data[0])

    // Complaint count
    const { count: totalComplaints } = await supabase
      .from('complaints').select('*', { count: 'exact', head: true })
      .eq('submitted_by', user.id)

    // Bins
    const { data: bins } = await supabase.from('collection_stops').select('bin_quantity, bin_count, status')
      .eq('commercial_id', user.id).eq('is_commercial', true)
    const totalBins = (bins || []).reduce((s, b) => s + (b.bin_quantity || b.bin_count || 1), 0)
    const completed = (bins || []).filter(b => b.status === 'completed').length
    const complianceRate = bins && bins.length > 0 ? Math.round((completed / bins.length) * 100) : 100

    setStats({
      totalComplaints: totalComplaints || 0,
      pendingBills: pendingBillsRes.count || 0,
      totalBins,
      complianceRate,
    })

    setLoading(false)
  }

  function statusColor(status: string) {
    if (status === 'resolved') return { bg: '#f0fdf4', color: '#00450d' }
    if (status === 'in_progress') return { bg: '#eff6ff', color: '#1d4ed8' }
    return { bg: '#fefce8', color: '#92400e' }
  }

  function statusLabel(status: string) {
    if (status === 'resolved') return 'Resolved'
    if (status === 'in_progress') return 'In Progress'
    return 'Submitted'
  }

  const orgName = profile?.organisation_name || profile?.full_name || 'Business'
  const firstName = orgName.split(' ')[0]

  return (
    <DashboardLayout
      role="Commercial"
      userName={orgName}
      navItems={COMMERCIAL_NAV}
      primaryAction={{ label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' }}
    >
      <style>{`
                .material-symbols-outlined {
                    font-family: 'Material Symbols Outlined';
                    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                    display: inline-block; vertical-align: middle; line-height: 1;
                }
                .card {
                    background: white; border-radius: 20px;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
                    border: 1px solid rgba(0,69,13,0.05); overflow: hidden;
                }
                .card-green {
                    background: #00450d; border-radius: 20px; color: white;
                    overflow: hidden; position: relative;
                }
                .card-dark {
                    background: #181c22; border-radius: 20px; color: white;
                    overflow: hidden; position: relative;
                }
                .card-sage {
                    background: #f0fdf4; border-radius: 20px;
                    border: 1px solid rgba(0,69,13,0.08); overflow: hidden;
                }
                .action-tile {
                    border-radius: 16px; padding: 20px;
                    border: 1.5px solid rgba(0,69,13,0.08);
                    background: white; text-decoration: none; display: block;
                    transition: all 0.2s ease;
                }
                .action-tile:hover {
                    border-color: #00450d;
                    background: #f0fdf4;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0,69,13,0.1);
                }
                .stat-pill {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 5px 12px; border-radius: 99px;
                    font-size: 11px; font-weight: 700;
                    font-family: 'Manrope', sans-serif;
                }
                .complaint-chip {
                    padding: 12px 16px; border-radius: 12px;
                    background: #f8fafc; border: 1px solid rgba(0,0,0,0.04);
                    display: flex; align-items: center; gap: 12px;
                    transition: background 0.15s;
                }
                .complaint-chip:hover { background: #f0fdf4; }
                .badge {
                    font-size: 10px; font-weight: 700; padding: 3px 10px;
                    border-radius: 99px; font-family: 'Manrope', sans-serif;
                    letter-spacing: 0.06em; text-transform: uppercase;
                    white-space: nowrap;
                }
                .progress-bar {
                    height: 6px; border-radius: 99px; background: rgba(255,255,255,0.15); overflow: hidden;
                }
                .progress-fill {
                    height: 100%; border-radius: 99px; background: #a3f69c;
                    transition: width 1s ease;
                }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .a1 { animation: fadeUp 0.5s ease 0.05s both; }
                .a2 { animation: fadeUp 0.5s ease 0.1s both; }
                .a3 { animation: fadeUp 0.5s ease 0.15s both; }
                .a4 { animation: fadeUp 0.5s ease 0.2s both; }
                .a5 { animation: fadeUp 0.5s ease 0.25s both; }
            `}</style>

      {/* Header */}
      <div className="mb-8 a1">
        <p className="text-xs font-bold uppercase mb-1"
          style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
          Commercial Portal · ClearPath
        </p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope, sans-serif' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},{' '}
            <span style={{ color: '#00450d' }}>{firstName}</span>
          </h1>
          <p className="text-sm" style={{ color: '#94a3b8' }}>{TODAY}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* Row 1 — Hero bento */}
          <div className="grid gap-5 mb-5 a2" style={{ gridTemplateColumns: '1fr 1fr 280px' }}>

            {/* Next collection — green hero */}
            <div className="card-green p-7">
              <div className="absolute -top-6 -right-6 w-36 h-36 rounded-full"
                style={{ background: 'rgba(163,246,156,0.07)' }} />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-5">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'rgba(163,246,156,0.8)' }}>calendar_month</span>
                  <span className="text-xs font-bold uppercase" style={{ letterSpacing: '0.15em', color: 'rgba(163,246,156,0.7)', fontFamily: 'Manrope, sans-serif' }}>
                    Next Collection
                  </span>
                </div>
                <p style={{ fontSize: '22px', fontWeight: 800, lineHeight: 1.2, marginBottom: '8px', fontFamily: 'Manrope, sans-serif' }}>
                  {nextSchedule
                    ? new Date(nextSchedule.scheduled_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                    : 'No upcoming schedule'}
                </p>
                {nextSchedule && (
                  <p style={{ color: 'rgba(163,246,156,0.7)', fontSize: '13px' }}>
                    {nextSchedule.waste_type?.charAt(0).toUpperCase() + nextSchedule.waste_type?.slice(1)} · {nextSchedule.collection_time || 'Morning'}
                  </p>
                )}
                <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'Manrope, sans-serif' }}>Compliance rate</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#a3f69c', fontFamily: 'Manrope, sans-serif' }}>{stats.complianceRate}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${stats.complianceRate}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Billing snapshot */}
            <div className="card-dark p-7">
              <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full"
                style={{ background: 'rgba(255,255,255,0.03)' }} />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-5">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)' }}>payments</span>
                  <span className="text-xs font-bold uppercase" style={{ letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)', fontFamily: 'Manrope, sans-serif' }}>
                    Billing
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px', fontFamily: 'Manrope, sans-serif' }}>Outstanding</p>
                <p style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1, marginBottom: '6px', fontFamily: 'Manrope, sans-serif' }}>
                  {stats.pendingBills > 0 ? `${stats.pendingBills} invoice${stats.pendingBills > 1 ? 's' : ''}` : 'All clear'}
                </p>
                <p style={{ fontSize: '13px', color: stats.pendingBills > 0 ? '#fcd34d' : 'rgba(163,246,156,0.8)' }}>
                  {stats.pendingBills > 0 ? 'Payment due — action needed' : 'No outstanding invoices'}
                </p>
                <Link href="/dashboard/commercial/billing"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '20px', padding: '8px 16px', borderRadius: '99px', background: 'rgba(255,255,255,0.1)', color: 'white', textDecoration: 'none', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', transition: 'background 0.15s' }}>
                  View invoices
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Business profile — tall card */}
            <div className="card p-6 flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '22px' }}>store</span>
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                    {profile?.organisation_name || 'Your Business'}
                  </p>
                  <p style={{ fontSize: '11px', color: '#94a3b8' }}>Commercial account</p>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { icon: 'location_on', label: profile?.district || '—', sub: 'District' },
                  { icon: 'map', label: profile?.ward || '—', sub: 'Ward' },
                  { icon: 'phone', label: profile?.phone || '—', sub: 'Phone' },
                  { icon: 'receipt_long', label: profile?.billing_cycle === 'quarterly' ? 'Quarterly' : 'Monthly', sub: 'Billing cycle' },
                ].map(item => (
                  <div key={item.sub} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#00450d', flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', lineHeight: 1.2 }}>{item.label}</p>
                      <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(0,69,13,0.07)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a' }} />
                <span style={{ fontSize: '11px', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>CMC verified · Active</span>
              </div>
            </div>
          </div>

          {/* Row 2 — 4 stat pills */}
          <div className="grid grid-cols-4 gap-4 mb-5 a3">
            {[
              { icon: 'delete', label: 'Registered Bins', value: stats.totalBins, href: '/dashboard/commercial/bins', color: '#00450d', bg: '#f0fdf4' },
              { icon: 'history', label: 'Collections', value: billingSummary?.total_stops_completed ?? '—', href: '/dashboard/commercial/collection-history', color: '#1d4ed8', bg: '#eff6ff' },
              { icon: 'feedback', label: 'Complaints', value: stats.totalComplaints, href: '/dashboard/commercial/report', color: '#92400e', bg: '#fefce8' },
              { icon: 'verified', label: 'Compliance', value: `${stats.complianceRate}%`, href: '/dashboard/commercial/collection-history', color: '#0e7490', bg: '#ecfeff' },
            ].map(stat => (
              <Link key={stat.label} href={stat.href} style={{ textDecoration: 'none' }}>
                <div className="card p-5" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: stat.color }}>{stat.icon}</span>
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#e2e8f0' }}>arrow_forward</span>
                  </div>
                  <p style={{ fontSize: '26px', fontWeight: 900, color: '#181c22', fontFamily: 'Manrope, sans-serif', lineHeight: 1 }}>{stat.value}</p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>{stat.label}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Row 3 — Recent collection + complaints + quick actions */}
          <div className="grid gap-5 a4" style={{ gridTemplateColumns: '1fr 1fr' }}>

            {/* Recent activity */}
            <div className="card">
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>Recent Collection</h3>
                <Link href="/dashboard/commercial/collection-history"
                  style={{ fontSize: '11px', fontWeight: 700, color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  View all <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>chevron_right</span>
                </Link>
              </div>
              <div style={{ padding: '20px 24px' }}>
                {recentCollection ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '22px' }}>
                        {recentCollection.status === 'completed' ? 'check_circle' : 'cancel'}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#181c22', marginBottom: '4px' }}>
                        {recentCollection.bin_quantity || recentCollection.bin_count || 1}× {recentCollection.bin_size || 'Standard'} {recentCollection.waste_type || 'collection'}
                      </p>
                      <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {recentCollection.road_name || recentCollection.address || 'Your premises'}
                        {recentCollection.completed_at && ` · ${new Date(recentCollection.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                      </p>
                      <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                        <span className="stat-pill" style={{ background: recentCollection.status === 'completed' ? '#f0fdf4' : '#fef2f2', color: recentCollection.status === 'completed' ? '#00450d' : '#ba1a1a' }}>
                          {recentCollection.status === 'completed' ? 'Collected' : 'Rejected'}
                        </span>
                        {recentCollection.blockchain_tx && (
                          <a href={`https://amoy.polygonscan.com/tx/${recentCollection.blockchain_tx}`}
                            target="_blank" rel="noopener noreferrer"
                            className="stat-pill"
                            style={{ background: '#f5f3ff', color: '#7c3aed', textDecoration: 'none' }}>
                            Chain ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>history</span>
                    <p style={{ fontSize: '13px', color: '#94a3b8' }}>No collections yet</p>
                  </div>
                )}
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#fafaf9' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#717a6d' }}>Total bins registered</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>{stats.totalBins} bins</span>
                </div>
              </div>
            </div>

            {/* Complaints + quick actions stacked */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Complaints */}
              <div className="card" style={{ flex: 1 }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>Recent Complaints</h3>
                  <Link href="/dashboard/commercial/report"
                    style={{ fontSize: '11px', fontWeight: 700, color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    View all <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>chevron_right</span>
                  </Link>
                </div>
                <div style={{ padding: '16px 24px' }}>
                  {recentComplaints.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>check_circle</span>
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22' }}>No complaints filed</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>All clear for your business</p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {recentComplaints.map(c => {
                        const sc = statusColor(c.status)
                        return (
                          <div key={c.id} className="complaint-chip">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#94a3b8', flexShrink: 0 }}>feedback</span>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#181c22', flex: 1, minWidth: 0 }} className="truncate">
                              {c.complaint_type?.replace(/_/g, ' ') || 'General complaint'}
                            </p>
                            <span className="badge" style={{ background: sc.bg, color: sc.color }}>
                              {statusLabel(c.status)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Schedule', icon: 'calendar_month', href: '/dashboard/commercial/schedule', desc: 'View pickups' },
                  { label: 'Track', icon: 'location_on', href: '/dashboard/commercial/track', desc: 'Live vehicle' },
                  { label: 'Billing', icon: 'payments', href: '/dashboard/commercial/billing', desc: 'Pay invoices' },
                  { label: 'Complaint', icon: 'feedback', href: '/dashboard/commercial/report', desc: 'File issue' },
                ].map(action => (
                  <Link key={action.label} href={action.href} className="action-tile">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00450d', display: 'block', marginBottom: '6px' }}>{action.icon}</span>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{action.label}</p>
                    <p style={{ fontSize: '10px', color: '#94a3b8' }}>{action.desc}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}