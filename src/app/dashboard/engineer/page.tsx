'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import AnnouncementsWidget from '@/components/AnnouncementsWidget'

const ENGINEER_NAV = [
  { label: 'Overview', href: '/dashboard/engineer', icon: 'dashboard' },
  { label: 'Routes', href: '/dashboard/engineer/routes', icon: 'route' },
  { label: 'Complaints', href: '/dashboard/engineer/complaints', icon: 'feedback' },
  { label: 'Waste Reports', href: '/dashboard/engineer/waste-reports', icon: 'report' },
]

const GRADE_COLORS: Record<string, string> = {
  grade_a: '#00450d',
  grade_b: '#d97706',
  grade_c: '#ba1a1a',
  mixed: '#64748b',
}

const MATERIAL_COLORS = ['#00450d', '#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#1d4ed8', '#7c3aed']

export default function EngineerDashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Overall stats
  const [stats, setStats] = useState({
    totalCollections: 0,
    completedCollections: 0,
    totalComplaints: 0,
    resolvedComplaints: 0,
    totalReports: 0,
    resolvedReports: 0,
  })

  // Recycler data (R48)
  const [recyclerSummary, setRecyclerSummary] = useState<any[]>([])
  const [materialBreakdown, setMaterialBreakdown] = useState<any[]>([])
  const [gradeBreakdown, setGradeBreakdown] = useState<any[]>([])
  const [totalRecyclerRevenue, setTotalRecyclerRevenue] = useState(0)
  const [totalTonnage, setTotalTonnage] = useState(0)

  // Contractor compliance
  const [contractorScores, setContractorScores] = useState<any[]>([])

  // Recent activity
  const [recentIntakes, setRecentIntakes] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    // Overall stats
    const [
      { count: totalCollections },
      { count: completedCollections },
      { count: totalComplaints },
      { count: resolvedComplaints },
      { count: totalReports },
      { count: resolvedReports },
    ] = await Promise.all([
      supabase.from('collection_events').select('*', { count: 'exact', head: true }),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('complaints').select('*', { count: 'exact', head: true }),
      supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
      supabase.from('waste_reports').select('*', { count: 'exact', head: true }),
      supabase.from('waste_reports').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
    ])

    setStats({
      totalCollections: totalCollections || 0,
      completedCollections: completedCollections || 0,
      totalComplaints: totalComplaints || 0,
      resolvedComplaints: resolvedComplaints || 0,
      totalReports: totalReports || 0,
      resolvedReports: resolvedReports || 0,
    })

    // R48 — Recycler intake data
    const { data: intakeLogs } = await supabase
      .from('waste_intake_logs')
      .select('*, operator:operator_id(full_name, organisation_name, role)')
      .eq('is_rejected', false)
      .order('created_at', { ascending: false })

    const logs = intakeLogs || []

    // Total tonnage + revenue
    const tonnage = logs.reduce((sum: number, l: any) => sum + (l.actual_quantity || 0), 0)
    const revenue = logs.reduce((sum: number, l: any) => sum + (l.total_amount || 0), 0)
    setTotalTonnage(tonnage)
    setTotalRecyclerRevenue(revenue)

    // Per-recycler summary
    const recyclerMap: Record<string, any> = {}
    logs.forEach((l: any) => {
      if (l.operator?.role !== 'recycling_partner') return
      const name = l.operator?.organisation_name || l.operator?.full_name || l.operator_id
      if (!recyclerMap[name]) {
        recyclerMap[name] = { name, tonnage: 0, revenue: 0, deliveries: 0, grades: {} }
      }
      recyclerMap[name].tonnage += l.actual_quantity || 0
      recyclerMap[name].revenue += l.total_amount || 0
      recyclerMap[name].deliveries += 1
      if (l.grade) recyclerMap[name].grades[l.grade] = (recyclerMap[name].grades[l.grade] || 0) + 1
    })
    setRecyclerSummary(Object.values(recyclerMap).sort((a: any, b: any) => b.revenue - a.revenue))

    // Material type breakdown
    const matMap: Record<string, number> = {}
    logs.forEach((l: any) => {
      if (!l.material_type) return
      matMap[l.material_type] = (matMap[l.material_type] || 0) + (l.actual_quantity || 0)
    })
    setMaterialBreakdown(Object.entries(matMap).map(([name, value]) => ({ name, value: parseFloat((value as number).toFixed(1)) })).sort((a, b) => b.value - a.value))

    // Grade breakdown
    const gradeMap: Record<string, number> = {}
    logs.forEach((l: any) => {
      if (!l.grade) return
      gradeMap[l.grade] = (gradeMap[l.grade] || 0) + 1
    })
    setGradeBreakdown(Object.entries(gradeMap).map(([name, value]) => ({ name, value })))

    // Contractor compliance from routes
    const { data: routes } = await supabase
      .from('routes')
      .select('*, profiles:contractor_id(full_name, organisation_name)')
      .not('contractor_id', 'is', null)

    const contractorMap: Record<string, any> = {}
      ; (routes || []).forEach((r: any) => {
        const name = r.profiles?.organisation_name || r.profiles?.full_name || r.contractor_id
        if (!contractorMap[name]) contractorMap[name] = { name, total: 0, completed: 0, active: 0 }
        contractorMap[name].total += 1
        if (r.status === 'completed') contractorMap[name].completed += 1
        if (r.status === 'active') contractorMap[name].active += 1
      })
    setContractorScores(
      Object.values(contractorMap).map((c: any) => ({
        ...c,
        score: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
      })).sort((a: any, b: any) => b.score - a.score)
    )

    // Recent intakes
    setRecentIntakes(logs.slice(0, 5))

    setLoading(false)
  }

  const collectionRate = stats.totalCollections > 0
    ? Math.round((stats.completedCollections / stats.totalCollections) * 100) : 0
  const complaintResolutionRate = stats.totalComplaints > 0
    ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100) : 0

  function gradeLabel(grade: string) {
    const map: Record<string, string> = { grade_a: 'Grade A', grade_b: 'Grade B', grade_c: 'Grade C', mixed: 'Mixed' }
    return map[grade] || grade
  }

  return (
    <DashboardLayout
      role="Engineer"
      userName={profile?.full_name || ''}
      navItems={ENGINEER_NAV}
      primaryAction={{ label: 'View Routes', href: '/dashboard/engineer/routes', icon: 'route' }}
    >
      <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
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
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em;
          text-transform: uppercase; white-space: nowrap; flex-shrink: 0;
        }
        .progress-bar { height: 8px; border-radius: 99px; background: #f0fdf4; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 99px; }
        .score-bar { height: 6px; border-radius: 99px; overflow: hidden; background: #f0fdf4; }
        .score-fill { height: 100%; border-radius: 99px; transition: width 0.8s ease; }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.2s both; }
        .s5 { animation: staggerIn 0.5s ease 0.25s both; }
      `}</style>

      {/* Hero */}
      <section className="mb-10 s1">
        <span className="text-xs font-bold uppercase block mb-2"
          style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
          Municipal Engineer · System Intelligence
        </span>
        <h1 className="font-headline font-extrabold tracking-tight"
          style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
          Engineer <span style={{ color: '#1b5e20' }}>Dashboard</span>
        </h1>
        <p className="text-sm mt-2" style={{ color: '#717a6d' }}>
          Cross-district performance · Recycler analytics · Contractor compliance
        </p>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* Row 1 — system overview + KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
            <div className="bento-card-green md:col-span-8 p-8 s2">
              <div className="absolute top-0 right-0 w-56 h-56 rounded-full -mr-20 -mt-20"
                style={{ background: 'rgba(163,246,156,0.06)' }} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <span className="text-xs font-bold uppercase block mb-2"
                      style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                      System-wide Performance
                    </span>
                    <h2 className="font-headline font-extrabold text-3xl tracking-tight">CMC Operations</h2>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '4px' }}>
                      All districts · Real-time metrics
                    </p>
                  </div>
                  <div className="p-3 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>analytics</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Collections', value: stats.totalCollections, icon: 'local_shipping' },
                    { label: 'Completed', value: stats.completedCollections, icon: 'check_circle' },
                    { label: 'Total Tonnage', value: `${totalTonnage.toFixed(0)}kg`, icon: 'scale' },
                    { label: 'Recycler Revenue', value: `LKR ${totalRecyclerRevenue.toLocaleString()}`, icon: 'payments' },
                  ].map(m => (
                    <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <span className="material-symbols-outlined mb-2 block"
                        style={{ color: 'rgba(163,246,156,0.7)', fontSize: '18px' }}>{m.icon}</span>
                      <p className="font-headline font-bold text-xl">{m.value}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bento-card md:col-span-4 p-8 flex flex-col justify-between s2">
              <div>
                <h3 className="font-headline font-bold text-xl mb-6" style={{ color: '#181c22' }}>System Health</h3>
                <div className="space-y-5">
                  {[
                    { label: 'Collection Rate', value: collectionRate, color: '#00450d' },
                    { label: 'Complaint Resolution', value: complaintResolutionRate, color: '#1b5e20' },
                    { label: 'Report Resolution', value: stats.totalReports > 0 ? Math.round((stats.resolvedReports / stats.totalReports) * 100) : 0, color: '#2e7d32' },
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
              <div className="grid grid-cols-2 gap-3 mt-6">
                <Link href="/dashboard/engineer/complaints"
                  className="py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all hover:opacity-90"
                  style={{ background: '#f0fdf4', color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>feedback</span>
                  Complaints
                </Link>
                <Link href="/dashboard/engineer/waste-reports"
                  className="py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all hover:opacity-90"
                  style={{ background: '#f0fdf4', color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>report</span>
                  Reports
                </Link>
              </div>
            </div>
          </div>

          {/* Row 2 — R48 Recycler Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 s3">

            {/* Per-recycler table */}
            <div className="bento-card lg:col-span-7">
              <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                  Recycler Performance
                </h3>
                <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                  Volume received, material grades, and revenue per recycler — R48
                </p>
              </div>
              {recyclerSummary.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>recycling</span>
                  </div>
                  <p className="font-bold text-base mb-1" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>No recycler data yet</p>
                  <p className="text-sm" style={{ color: '#94a3b8' }}>Recycler intake logs will appear here once deliveries are confirmed.</p>
                </div>
              ) : (
                <div>
                  {recyclerSummary.map((r, idx) => (
                    <div key={idx} style={{ padding: '16px 32px', borderBottom: '1px solid rgba(0,69,13,0.04)', display: 'flex', alignItems: 'center', gap: '16px' }}
                      className="hover:bg-slate-50 transition-colors">
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '16px', color: '#00450d' }}>
                          {r.name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif', marginBottom: '4px' }}>
                          {r.name}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: '#94a3b8' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>scale</span>
                            {r.tonnage.toFixed(1)} kg
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>local_shipping</span>
                            {r.deliveries} deliveries
                          </span>
                          {Object.keys(r.grades).length > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {Object.entries(r.grades).map(([grade, count]) => (
                                <span key={grade} style={{
                                  fontSize: '9px', fontWeight: 700, padding: '1px 6px',
                                  borderRadius: '99px', background: `${GRADE_COLORS[grade] || '#64748b'}15`,
                                  color: GRADE_COLORS[grade] || '#64748b',
                                  fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase',
                                }}>
                                  {gradeLabel(grade)}: {count as number}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '15px', fontWeight: 800, color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                          LKR {r.revenue.toLocaleString()}
                        </p>
                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>revenue</p>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '12px 32px', background: '#f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Total
                    </p>
                    <p style={{ fontSize: '15px', fontWeight: 800, color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                      LKR {totalRecyclerRevenue.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Material + Grade breakdown charts */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Material breakdown */}
              <div className="bento-card p-6">
                <h3 className="font-headline font-bold text-base mb-4" style={{ color: '#181c22' }}>
                  Material Breakdown
                </h3>
                {materialBreakdown.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>No material data yet</p>
                ) : (
                  <div style={{ height: '160px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={materialBreakdown} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'Inter' }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(v) => [`${v} kg`, 'Quantity']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {materialBreakdown.map((_, i) => (
                            <Cell key={i} fill={MATERIAL_COLORS[i % MATERIAL_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Grade breakdown */}
              <div className="bento-card p-6">
                <h3 className="font-headline font-bold text-base mb-4" style={{ color: '#181c22' }}>
                  Grade Distribution
                </h3>
                {gradeBreakdown.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>No grade data yet</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {gradeBreakdown.map(g => {
                      const total = gradeBreakdown.reduce((sum, x) => sum + x.value, 0)
                      const pct = total > 0 ? Math.round((g.value / total) * 100) : 0
                      return (
                        <div key={g.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#181c22' }}>{gradeLabel(g.name)}</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: GRADE_COLORS[g.name] || '#64748b' }}>
                              {g.value} ({pct}%)
                            </span>
                          </div>
                          <div className="score-bar">
                            <div className="score-fill" style={{ width: `${pct}%`, background: GRADE_COLORS[g.name] || '#64748b' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 3 — Contractor compliance */}
          <div className="bento-card mb-6 s4">
            <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
              <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Contractor Compliance</h3>
              <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                Route completion rate per contractor — blockchain-backed
              </p>
            </div>
            {contractorScores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                  <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>business</span>
                </div>
                <p className="font-bold text-base mb-1" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>No contractor data yet</p>
                <p className="text-sm" style={{ color: '#94a3b8' }}>Contractor routes will appear here once assigned.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
                {contractorScores.map((c, idx) => (
                  <div key={idx} style={{ padding: '20px 24px', borderRight: idx % 3 !== 2 ? '1px solid rgba(0,69,13,0.04)' : 'none', borderBottom: '1px solid rgba(0,69,13,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{c.name}</p>
                      <span style={{
                        fontSize: '13px', fontWeight: 800, padding: '3px 10px', borderRadius: '99px',
                        background: c.score >= 80 ? '#f0fdf4' : c.score >= 60 ? '#fefce8' : '#fef2f2',
                        color: c.score >= 80 ? '#00450d' : c.score >= 60 ? '#d97706' : '#ba1a1a',
                        fontFamily: 'Manrope, sans-serif',
                      }}>
                        {c.score}%
                      </span>
                    </div>
                    <div className="score-bar mb-3">
                      <div className="score-fill" style={{
                        width: `${c.score}%`,
                        background: c.score >= 80 ? '#00450d' : c.score >= 60 ? '#d97706' : '#ba1a1a',
                      }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#94a3b8' }}>
                      <span>{c.total} routes total</span>
                      <span style={{ color: '#00450d' }}>{c.completed} completed</span>
                      <span style={{ color: '#d97706' }}>{c.active} active</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Row 4 — Recent intakes */}
          <div className="bento-card s5">
            <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
              <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Recent Recycler Deliveries</h3>
            </div>
            {recentIntakes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm" style={{ color: '#94a3b8' }}>No deliveries logged yet.</p>
              </div>
            ) : (
              <div>
                {recentIntakes.map((log, idx) => (
                  <div key={idx} style={{ padding: '16px 32px', borderBottom: '1px solid rgba(0,69,13,0.04)', display: 'flex', alignItems: 'center', gap: '16px' }}
                    className="hover:bg-slate-50 transition-colors">
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>recycling</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif', marginBottom: '2px' }}>
                        {log.operator?.organisation_name || log.operator?.full_name || 'Unknown'}
                      </p>
                      <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {log.material_type || log.waste_type || '—'} · {log.actual_quantity} {log.unit}
                        {log.grade && ` · ${gradeLabel(log.grade)}`}
                        {` · ${log.vehicle_number || '—'}`}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {log.total_amount && (
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                          LKR {log.total_amount.toLocaleString()}
                        </p>
                      )}
                      <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {new Date(log.received_at || log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  )
}