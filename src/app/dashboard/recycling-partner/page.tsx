'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const RECYCLER_NAV = [
  { label: 'Home', href: '/dashboard/recycling-partner', icon: 'dashboard' },
  { label: 'New Intake', href: '/dashboard/recycling-partner/log', icon: 'add_circle' },
  { label: 'History', href: '/dashboard/recycling-partner/history', icon: 'history' },
  { label: 'Analytics', href: '/dashboard/recycling-partner/analytics', icon: 'bar_chart' },
  { label: 'Disposal', href: '/dashboard/recycling-partner/disposal', icon: 'delete_sweep' },
  { label: 'Profile', href: '/dashboard/recycling-partner/profile', icon: 'person' },
]

const QUICK_ACTIONS = [
  { label: 'Log New Intake', desc: 'Record waste received from routes', icon: 'add_circle', href: '/dashboard/intake/log', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  { label: 'Intake History', desc: 'Browse accepted & rejected logs', icon: 'history', href: '/dashboard/intake/history', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { label: 'Analytics', desc: 'Material volume & revenue charts', icon: 'bar_chart', href: '/dashboard/intake/analytics', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
  { label: 'Profile', desc: 'Account details & password', icon: 'person', href: '/dashboard/recycling-partner/profile', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
]

const MATERIAL_COLORS: Record<string, string> = {
  plastic: '#1d4ed8', paper: '#d97706', glass: '#0891b2',
  metal: '#64748b', 'e-waste': '#7c3aed', organic: '#15803d',
  mixed: '#9a3412', other: '#94a3b8',
}

export default function RecyclerDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ awaitingIntake: 0, totalIntakes: 0, totalWeight: 0, pendingPayments: 0, thisMonthWeight: 0, thisMonthRevenue: 0, totalRejections: 0, chainVerified: 0 })
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [materialData, setMaterialData] = useState<any[]>([])
  const [recentIntakes, setRecentIntakes] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!p || p.role !== 'recycling_partner') { router.push('/login'); return }
    setProfile(p)

    const { data: intakes } = await supabase
      .from('waste_intake_logs').select('*')
      .eq('operator_id', user.id).eq('operator_type', 'recycling_partner')
      .order('received_at', { ascending: false })
    const logs = intakes || []
    const accepted = logs.filter((l: any) => !l.is_rejected)

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const thisMonth = accepted.filter((l: any) => (l.received_at || l.created_at) >= monthStart)

    // Monthly chart
    const monthMap: Record<string, { label: string; weight: number; revenue: number }> = {}
    accepted.forEach((l: any) => {
      const d = new Date(l.received_at || l.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const lbl = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
      if (!monthMap[key]) monthMap[key] = { label: lbl, weight: 0, revenue: 0 }
      monthMap[key].weight += l.actual_quantity || 0
      monthMap[key].revenue += l.total_amount || 0
    })
    const sortedMonths = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([, v]) => ({ name: v.label, weight: +v.weight.toFixed(1), revenue: Math.round(v.revenue) }))

    // Material chart
    const matMap: Record<string, number> = {}
    accepted.forEach((l: any) => { const m = l.material_type || 'other'; matMap[m] = (matMap[m] || 0) + (l.actual_quantity || 0) })
    const matChart = Object.entries(matMap).sort(([, a], [, b]) => b - a).slice(0, 6)
      .map(([name, value]) => ({ name, value: +value.toFixed(1) }))

    setStats({
      awaitingIntake: 0,
      totalIntakes: accepted.length,
      totalWeight: accepted.reduce((s: number, l: any) => s + (l.actual_quantity || 0), 0),
      pendingPayments: accepted.filter((l: any) => l.payment_status === 'pending').length,
      thisMonthWeight: thisMonth.reduce((s: number, l: any) => s + (l.actual_quantity || 0), 0),
      thisMonthRevenue: thisMonth.reduce((s: number, l: any) => s + (l.total_amount || 0), 0),
      totalRejections: logs.filter((l: any) => l.is_rejected).length,
      chainVerified: accepted.filter((l: any) => l.tx_hash).length,
    })
    setMonthlyData(sortedMonths)
    setMaterialData(matChart)
    setRecentIntakes(logs.slice(0, 5))
    setLoading(false)
  }

  const chainRate = stats.totalIntakes > 0 ? Math.round((stats.chainVerified / stats.totalIntakes) * 100) : 0
  const acceptRate = (stats.totalIntakes + stats.totalRejections) > 0 ? Math.round((stats.totalIntakes / (stats.totalIntakes + stats.totalRejections)) * 100) : 0
  const payRate = stats.totalIntakes > 0 ? Math.round(((stats.totalIntakes - stats.pendingPayments) / stats.totalIntakes) * 100) : 0

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const emoji = hour < 12 ? '🌤️' : hour < 17 ? '☀️' : '🌙'

  return (
    <DashboardLayout role="Recycling Partner" userName={profile?.full_name || ''} navItems={RECYCLER_NAV}
      primaryAction={{ label: 'New Intake', href: '/dashboard/intake/log', icon: 'add' }}>
      <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1;}
        .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden;}
        .action-card{border-radius:16px;padding:16px;text-decoration:none;display:flex;align-items:flex-start;gap:12px;transition:all 0.2s;border:1.5px solid transparent;}
        .action-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.08);}
        .stat-card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);padding:20px;transition:transform 0.2s,box-shadow 0.2s;}
        .stat-card:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,0.09);}
        .progress-bar{height:6px;border-radius:99px;background:#f0fdf4;overflow:hidden;}
        .progress-fill{height:100%;border-radius:99px;}
        .hero{background:linear-gradient(135deg,#15803d 0%,#166534 60%,#14532d 100%);border-radius:20px;padding:22px 28px;position:relative;overflow:hidden;}
        .hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 80% 50%,rgba(255,255,255,0.07) 0%,transparent 60%);pointer-events:none;}
        .hero::after{content:'';position:absolute;right:-40px;top:-40px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.04);pointer-events:none;}
        .intake-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(0,69,13,0.05);}
        .intake-row:last-child{border-bottom:none;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .a1{animation:fadeUp .4s ease .04s both}.a2{animation:fadeUp .4s ease .09s both}
        .a3{animation:fadeUp .4s ease .14s both}.a4{animation:fadeUp .4s ease .19s both}
        .a5{animation:fadeUp .4s ease .24s both}
        .live{animation:pulse 2s ease-in-out infinite}
      `}</style>

      {/* Greeting */}
      <div className="a1" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>{emoji} {greeting}, Recycling Partner</p>
            <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
              Materials <span style={{ color: '#15803d' }}>Intake Hub</span>
            </h1>
            <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>
              {now.toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              &nbsp;·&nbsp;{profile?.organisation_name || profile?.full_name}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {stats.awaitingIntake > 0 && (
              <Link href="/dashboard/intake/log" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 99, background: '#fffbeb', color: '#d97706', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif' }}>
                <span className="msf" style={{ fontSize: 14 }}>local_shipping</span>{stats.awaitingIntake} awaiting intake
              </Link>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 99, background: '#f0fdf4', border: '1px solid rgba(21,128,61,0.2)' }}>
              <div className="live" style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d', fontFamily: 'Manrope,sans-serif' }}>Live Intake Feed</span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 28, height: 28, border: '2px solid #15803d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* KPI strip */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
              {[
                { icon: 'inventory', label: 'Total Intakes', value: stats.totalIntakes, color: '#15803d', bg: '#f0fdf4', sub: `${acceptRate}% accept rate` },
                { icon: 'scale', label: 'Total Weight', value: `${stats.totalWeight.toFixed(0)}kg`, color: '#1d4ed8', bg: '#eff6ff', sub: 'All time' },
                { icon: 'payments', label: 'This Month', value: `LKR ${Math.round(stats.thisMonthRevenue / 1000)}k`, color: '#7c3aed', bg: '#faf5ff', sub: `${stats.thisMonthWeight.toFixed(0)}kg received` },
                { icon: 'pending', label: 'Pending Pay', value: stats.pendingPayments, color: '#d97706', bg: '#fffbeb', sub: 'Awaiting settlement' },
                { icon: 'verified', label: 'On-Chain', value: stats.chainVerified, color: '#0e7490', bg: '#ecfeff', sub: `${chainRate}% verified` },
              ].map(card => (
                <div key={card.label} className="stat-card">
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <span className="msf" style={{ fontSize: 20, color: card.color }}>{card.icon}</span>
                  </div>
                  <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 28, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{card.value}</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#41493e', margin: '0 0 2px', fontFamily: 'Manrope,sans-serif' }}>{card.label}</p>
                  <p style={{ fontSize: 11, color: card.color, margin: 0, fontWeight: 500 }}>{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="a3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>Last 6 Months</p>
                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: 0 }}>Volume Received (kg)</h3>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msf" style={{ color: '#15803d', fontSize: 18 }}>scale</span>
                  </div>
                </div>
                {monthlyData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>No intake data yet</div>
                ) : (
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'Inter' }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Inter', fontSize: 12 }} />
                        <Bar dataKey="weight" name="kg" fill="#15803d" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>By Material Type</p>
                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: 0 }}>Material Breakdown</h3>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msf" style={{ color: '#7c3aed', fontSize: 18 }}>recycling</span>
                  </div>
                </div>
                {materialData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>No material data yet</div>
                ) : (
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={materialData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'Inter' }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Inter', fontSize: 12 }} />
                        <Bar dataKey="value" name="kg" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Recent intakes */}
            <div className="a4 card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="msf" style={{ color: '#1d4ed8', fontSize: 18 }}>history</span>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>Latest Activity</p>
                  <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: 0 }}>Recent Intakes</h3>
                </div>
                <Link href="/dashboard/intake/history" style={{ marginLeft: 'auto', fontSize: 12, color: '#15803d', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                  View all <span className="msf" style={{ fontSize: 14 }}>arrow_forward</span>
                </Link>
              </div>
              {recentIntakes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>No intakes yet</div>
              ) : recentIntakes.map((log: any) => {
                const matColor = MATERIAL_COLORS[log.material_type?.toLowerCase()] || '#94a3b8'
                return (
                  <div key={log.id} className="intake-row">
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: log.is_rejected ? '#fef2f2' : `${matColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="msf" style={{ fontSize: 16, color: log.is_rejected ? '#ba1a1a' : matColor }}>{log.is_rejected ? 'cancel' : 'recycling'}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#181c22', margin: '0 0 2px', fontFamily: 'Manrope,sans-serif', textTransform: 'capitalize' }}>{log.material_type || log.waste_type || 'General waste'}</p>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                        {new Date(log.received_at || log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {log.vehicle_number && ` · ${log.vehicle_number}`}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {log.is_rejected ? (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#fef2f2', color: '#ba1a1a', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rejected</span>
                      ) : (
                        <>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#15803d', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>{log.actual_quantity} {log.unit}</p>
                          {log.tx_hash && (
                            <a href={`https://amoy.polygonscan.com/tx/${log.tx_hash}`} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 10, color: '#0e7490', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                              <span className="msf" style={{ fontSize: 11 }}>verified</span>on-chain
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick actions */}
            <div className="a4">
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Quick Actions</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
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
            <div className="a5" style={{ borderRadius: 14, padding: '14px 20px', background: '#f0fdf4', border: '1px solid rgba(21,128,61,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="msf" style={{ color: '#15803d', fontSize: 20 }}>verified</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#15803d', fontFamily: 'Manrope,sans-serif', margin: 0 }}>Blockchain-verified deliveries</p>
                  <p style={{ fontSize: 11, color: '#717a6d', margin: 0 }}>Every intake logged on Polygon Amoy</p>
                </div>
              </div>
              <Link href="/dashboard/intake/history" style={{ background: '#15803d', color: 'white', padding: '7px 16px', borderRadius: 99, fontWeight: 700, fontSize: 12, textDecoration: 'none', fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>View History</Link>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div className="hero a1">
              <div style={{ position: 'relative', zIndex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(163,246,156,0.75)', fontFamily: 'Manrope,sans-serif', margin: '0 0 16px' }}>Partner Overview</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { value: stats.totalIntakes, label: 'Total Intakes', icon: 'inventory' },
                    { value: `${stats.totalWeight.toFixed(0)}kg`, label: 'Total Weight', icon: 'scale' },
                    { value: stats.totalRejections, label: 'Rejections', icon: 'cancel' },
                    { value: `LKR ${Math.round(stats.thisMonthRevenue / 1000)}k`, label: 'This Month Rev', icon: 'payments' },
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

            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="msf" style={{ color: '#15803d', fontSize: 18 }}>monitor_heart</span>
                </div>
                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', margin: 0 }}>Performance</h3>
              </div>
              {[
                { label: 'Acceptance Rate', value: acceptRate, color: '#15803d' },
                { label: 'Chain Verified', value: chainRate, color: '#0e7490' },
                { label: 'Payment Rate', value: payRate, color: '#7c3aed' },
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
                <span className="msf" style={{ color: '#15803d', fontSize: 18 }}>check_circle</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#15803d', fontFamily: 'Manrope,sans-serif', margin: 0 }}>Blockchain active</p>
                  <p style={{ fontSize: 11, color: '#717a6d', margin: 0 }}>Polygon Amoy · Supabase</p>
                </div>
              </div>
            </div>

            <div style={{ borderRadius: 16, padding: 20, background: 'linear-gradient(135deg,#15803d,#166534)', color: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="msf" style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>verified</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope,sans-serif' }}>Chain Audit</span>
              </div>
              <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 28, color: 'white', margin: '0 0 4px', lineHeight: 1 }}>{chainRate}%</p>
              <p style={{ fontSize: 12, color: 'rgba(163,246,156,0.8)', margin: '0 0 14px' }}>{stats.chainVerified} deliveries verified on Polygon Amoy testnet.</p>
              <Link href="/dashboard/intake/history" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 9, borderRadius: 10, background: 'rgba(255,255,255,0.12)', color: 'white', textDecoration: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', border: '1px solid rgba(255,255,255,0.15)' }}>
                <span className="msf" style={{ fontSize: 15 }}>history</span>View All Intakes
              </Link>
            </div>

          </div>
        </div>
      )}
    </DashboardLayout>
  )
}