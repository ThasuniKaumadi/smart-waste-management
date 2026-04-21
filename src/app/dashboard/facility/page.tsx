'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'

const FACILITY_NAV = [
  { label: 'Home', href: '/dashboard/facility', icon: 'dashboard' },
  { label: 'New Intake', href: '/dashboard/facility/log', icon: 'add_circle' },
  { label: 'History', href: '/dashboard/facility/history', icon: 'history' },
  { label: 'Analytics', href: '/dashboard/facility/analytics', icon: 'bar_chart' },
  { label: 'Disposal', href: '/dashboard/facility/disposal', icon: 'delete_sweep' },
  { label: 'Profile', href: '/dashboard/facility/profile', icon: 'person' },
]

const QUICK_ACTIONS = [
  { label: 'Log New Intake', desc: 'Record waste received from routes', icon: 'add_circle', href: '/dashboard/facility/log', color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
  { label: 'Intake History', desc: 'Browse all accepted & rejected logs', icon: 'history', href: '/dashboard/facility/history', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  { label: 'Analytics', desc: 'Volume & category charts', icon: 'bar_chart', href: '/dashboard/facility/analytics', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
  { label: 'Confirm Disposal', desc: 'Review pending disposal records', icon: 'fact_check', href: '/dashboard/facility/disposal', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { label: 'Profile', desc: 'Account details & password', icon: 'person', href: '/dashboard/facility/profile', color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
]

const DISPOSAL_TIPS = [
  {
    title: 'Landfill Best Practices',
    subtitle: 'Municipal Solid Waste Guidelines',
    address: 'Karadiyana, Colombo 10',
    tips: ['Compact waste before disposal to maximise capacity', 'Separate hazardous materials before accepting bulk loads'],
    hours: 'Mon–Sat · 6:00 AM – 5:00 PM',
    phone: '+94 11 269 1234',
    color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd', icon: 'delete_sweep',
  },
  {
    title: 'Composting Guidelines',
    subtitle: 'Organic Waste Processing',
    address: 'Wellawatte Composting Hub, Colombo 6',
    tips: ['Maintain carbon-to-nitrogen ratio for optimal decomposition', 'Temperature should reach 55–65°C to kill pathogens'],
    hours: 'Daily · 6:00 AM – 6:00 PM',
    phone: '+94 11 258 9012',
    color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: 'compost',
  },
  {
    title: 'Recycling Standards',
    subtitle: 'Material Recovery Facility',
    address: 'Narahenpita MRF, Colombo 5',
    tips: ['Sort materials before unloading to speed up processing', 'Contaminated loads may be rejected — check condition first'],
    hours: 'Mon–Sat · 7:30 AM – 4:30 PM',
    phone: '+94 11 267 3456',
    color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', icon: 'recycling',
  },
  {
    title: 'Incineration Protocol',
    subtitle: 'Thermal Treatment Facility',
    address: 'Orugodawatte, Colombo 10',
    tips: ['Only accept approved waste streams — no hazardous chemicals', 'Log calorific value for every incoming batch'],
    hours: 'Mon–Fri · 7:00 AM – 4:00 PM',
    phone: '+94 11 243 5678',
    color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'local_fire_department',
  },
  {
    title: 'E-Waste Handling',
    subtitle: 'Electronic Waste Guidelines',
    address: 'Bloemendhal Drop Point, Colombo 13',
    tips: ['Issue receipts for all electronics received', 'Store batteries separately in fire-resistant containers'],
    hours: 'Mon–Fri · 8:00 AM – 4:00 PM',
    phone: '+94 11 243 5678',
    color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'computer',
  },
]

function DisposalTipsSlideshow() {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  function goTo(idx: number) {
    if (animating || idx === current) return
    setAnimating(true); setCurrent(idx)
    setTimeout(() => setAnimating(false), 400)
  }
  function next() { goTo((current + 1) % DISPOSAL_TIPS.length) }
  function prev() { goTo((current - 1 + DISPOSAL_TIPS.length) % DISPOSAL_TIPS.length) }
  function resetTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % DISPOSAL_TIPS.length), 5000)
  }
  useEffect(() => {
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % DISPOSAL_TIPS.length), 5000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const tip = DISPOSAL_TIPS[current]

  return (
    <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(0,69,13,0.05)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(3,105,161,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 16, color: '#0369a1', display: 'inline-block' }}>fact_check</span>
          </div>
          <div>
            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 13, color: '#181c22', lineHeight: 1.2, margin: 0 }}>Disposal Guidelines</p>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>CMC facility operations</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => { prev(); resetTimer() }}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 16, color: '#64748b', display: 'inline-block' }}>chevron_left</span>
          </button>
          <button onClick={() => { next(); resetTimer() }}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 16, color: '#64748b', display: 'inline-block' }}>chevron_right</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 18px', opacity: animating ? 0 : 1, transition: 'opacity 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: tip.bg, border: `1px solid ${tip.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 22, color: tip.color, display: 'inline-block' }}>{tip.icon}</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 2, lineHeight: 1.3 }}>{tip.title}</p>
            <p style={{ fontSize: 11, color: tip.color, fontWeight: 600, margin: 0 }}>{tip.subtitle}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
          <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 14, color: '#94a3b8', display: 'inline-block', marginTop: 1 }}>location_on</span>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.4 }}>{tip.address}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 14, color: '#94a3b8', display: 'inline-block' }}>schedule</span>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{tip.hours}</p>
        </div>

        {/* Tips */}
        {tip.tips.map((t, i) => (
          <div key={i} style={{ borderRadius: 10, padding: '9px 12px', background: '#f8fafc', border: '1px solid #f1f5f9', display: 'flex', gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 14, color: '#f59e0b', display: 'inline-block', flexShrink: 0, marginTop: 1 }}>lightbulb</span>
            <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.5, margin: 0 }}>{t}</p>
          </div>
        ))}

        <a href={`tel:${tip.phone}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: tip.color, fontWeight: 700, textDecoration: 'none', fontFamily: 'Manrope,sans-serif', marginTop: 4 }}>
          <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 14, display: 'inline-block' }}>call</span>
          {tip.phone}
        </a>
      </div>

      {/* Dots */}
      <div style={{ padding: '10px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {DISPOSAL_TIPS.map((_, i) => (
          <button key={i} onClick={() => { goTo(i); resetTimer() }}
            style={{ width: i === current ? 20 : 7, height: 7, borderRadius: 99, border: 'none', cursor: 'pointer', background: i === current ? '#0369a1' : '#e2e8f0', transition: 'all 0.3s ease', padding: 0 }} />
        ))}
      </div>
    </div>
  )
}

export default function FacilityDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pendingRecords, setPendingRecords] = useState<any[]>([])
  const [recentIntakes, setRecentIntakes] = useState<any[]>([])
  const [confirmedToday, setConfirmedToday] = useState<any[]>([])
  const [stats, setStats] = useState({ totalIntakes: 0, totalWeight: 0, pendingDisposal: 0, chainVerified: 0 })
  const [toast, setToast] = useState('')

  useEffect(() => { loadData() }, [])
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!p || p.role !== 'facility_operator') { router.push('/login'); return }
    setProfile(p)

    const [
      { data: intakeLogs },
      { data: disposalData },
    ] = await Promise.all([
      supabase.from('waste_intake_logs').select('*').eq('operator_id', user.id).order('received_at', { ascending: false }).limit(20),
      supabase.from('disposal_records').select('*').order('created_at', { ascending: false }).limit(20),
    ])

    const logs = intakeLogs || []
    const accepted = logs.filter((l: any) => !l.is_rejected)
    const disposal = disposalData || []

    const today = new Date().toDateString()
    const todayConfirmed = disposal.filter((r: any) => r.status === 'confirmed' && new Date(r.created_at).toDateString() === today)
    const pending = disposal.filter((r: any) => r.status === 'pending')
    const recent = logs.slice(0, 5)

    setStats({
      totalIntakes: accepted.length,
      totalWeight: accepted.reduce((s: number, l: any) => s + (l.actual_quantity || 0), 0),
      pendingDisposal: pending.length,
      chainVerified: accepted.filter((l: any) => l.tx_hash).length,
    })
    setPendingRecords(pending.slice(0, 3))
    setRecentIntakes(recent)
    setConfirmedToday(todayConfirmed.slice(0, 3))
    setLoading(false)
  }

  function timeGreeting() {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }
  function greetingEmoji() {
    const h = new Date().getHours()
    return h < 12 ? '🌤️' : h < 17 ? '☀️' : '🌙'
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Operator'

  function statusStyle(s: string) {
    if (s === 'confirmed') return { bg: '#f0fdf4', color: '#00450d', border: '#bbf7d0' }
    if (s === 'flagged') return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
    return { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' }
  }

  return (
    <DashboardLayout role="Facility Operator" userName={profile?.full_name || ''} navItems={FACILITY_NAV}
      primaryAction={{ label: 'New Intake', href: '/dashboard/facility/log', icon: 'add' }}>
      <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
        .action-card{border-radius:16px;padding:16px;text-decoration:none;display:flex;align-items:flex-start;gap:12px;transition:all 0.2s;border:1.5px solid transparent}
        .action-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.08)}
        .activity-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6}
        .activity-row:last-child{border-bottom:none}
        .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;font-family:'Manrope',sans-serif;letter-spacing:0.06em;text-transform:uppercase;border:1px solid transparent}
        .hero{background:linear-gradient(135deg,#0369a1 0%,#0284c7 60%,#0ea5e9 100%);border-radius:20px;padding:22px 28px;margin-bottom:0;position:relative;overflow:hidden}
        .hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 80% 50%,rgba(255,255,255,0.07) 0%,transparent 60%);pointer-events:none}
        .hero::after{content:'';position:absolute;right:-40px;top:-40px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.04);pointer-events:none}
        .toast-msg{animation:slideUp .3s ease}
        @keyframes slideUp{from{transform:translateY(12px) translateX(-50%);opacity:0}to{transform:translateY(0) translateX(-50%);opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .a1{animation:fadeUp .4s ease .04s both}.a2{animation:fadeUp .4s ease .09s both}
        .a3{animation:fadeUp .4s ease .14s both}.a4{animation:fadeUp .4s ease .19s both}.a5{animation:fadeUp .4s ease .24s both}
      `}</style>

      {toast && (
        <div className="toast-msg" style={{ position: 'fixed', bottom: 24, left: '50%', background: '#181c22', color: 'white', padding: '10px 20px', borderRadius: 9999, fontSize: 13, fontWeight: 500, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>{toast}</div>
      )}

      {/* Greeting */}
      <div className="a1" style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>
          {greetingEmoji()} {timeGreeting()}
        </p>
        <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
          Welcome, <span style={{ color: '#0369a1' }}>{firstName}</span>
        </h1>
        <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>
          {new Date().toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {profile?.district && ` · ${profile.district}`}
          {profile?.organisation_name && ` · ${profile.organisation_name}`}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 28, height: 28, border: '2px solid #0369a1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'start' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Pending disposal card — mirrors resident's "Next Collection" card */}
            <div className="a2">
              {pendingRecords.length > 0 ? (
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ height: 5, background: 'linear-gradient(135deg,#0369a1,#0ea5e9)' }} />
                  <div style={{ padding: '24px 28px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 14, background: '#f0f9ff', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="msf" style={{ fontSize: 24, color: '#0369a1' }}>pending</span>
                          </div>
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>Action Required</p>
                            <span style={{ fontSize: 10, fontWeight: 800, background: '#0369a1', color: 'white', padding: '1px 8px', borderRadius: 99, fontFamily: 'Manrope,sans-serif', marginTop: 3, display: 'inline-block' }}>
                              {stats.pendingDisposal} PENDING
                            </span>
                          </div>
                        </div>
                        <h2 style={{ fontSize: 26, fontWeight: 900, fontFamily: 'Manrope,sans-serif', color: '#181c22', lineHeight: 1.1, marginBottom: 10 }}>
                          Disposal records awaiting your confirmation
                        </h2>
                        <p style={{ fontSize: 13, color: '#717a6d', marginBottom: 16 }}>
                          Review and confirm waste received at your facility to keep records accurate.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                          {pendingRecords.map((r: any) => (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                              <span className="msf" style={{ fontSize: 16, color: '#0369a1' }}>delete_sweep</span>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: '#181c22', margin: 0 }}>{r.facility_name || 'Unknown facility'}</p>
                                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{r.waste_category} · {r.collected_tonnage}T · {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#f0f9ff', color: '#0369a1', fontFamily: 'Manrope,sans-serif' }}>PENDING</span>
                            </div>
                          ))}
                        </div>
                        <Link href="/dashboard/facility/disposal"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 99, background: '#0369a1', color: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                          <span className="msf" style={{ fontSize: 16 }}>fact_check</span>
                          Confirm All Pending
                        </Link>
                      </div>
                      <Link href="/dashboard/facility/disposal"
                        style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 22px', borderRadius: 16, background: '#f0f9ff', border: '1.5px solid #bae6fd', textDecoration: 'none', transition: 'all 0.2s' }}>
                        <span className="msf" style={{ fontSize: 30, color: '#0369a1' }}>fact_check</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>Disposal Hub</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                  <span className="msf" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 10 }}>check_circle</span>
                  <p style={{ fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 4 }}>All disposals confirmed</p>
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>No pending records — you're all caught up</p>
                </div>
              )}
            </div>

            {/* Alert banner when pending */}
            {stats.pendingDisposal > 0 && (
              <div className="a2" style={{ borderRadius: 14, padding: '14px 18px', background: 'linear-gradient(135deg,#0369a1,#0284c7)', color: 'white', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="msf" style={{ fontSize: 21 }}>notifications_active</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(186,230,253,0.8)', marginBottom: 3, fontFamily: 'Manrope,sans-serif' }}>
                    {stats.pendingDisposal} Disposal Record{stats.pendingDisposal !== 1 ? 's' : ''} Awaiting Confirmation
                  </p>
                  <p style={{ fontSize: 13, color: 'white', margin: 0, fontFamily: 'Manrope,sans-serif', fontWeight: 600 }}>
                    Review incoming waste and confirm quantities to maintain accurate CMC records.
                  </p>
                </div>
                <Link href="/dashboard/facility/disposal"
                  style={{ flexShrink: 0, background: 'rgba(255,255,255,0.15)', color: 'white', padding: '7px 14px', borderRadius: 99, fontWeight: 700, fontSize: 12, textDecoration: 'none', fontFamily: 'Manrope,sans-serif', border: '1px solid rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>
                  Review Now
                </Link>
              </div>
            )}

            {/* Today confirmed strip */}
            {confirmedToday.length > 0 && (
              <div className="a2">
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Confirmed Today</p>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(confirmedToday.length, 3)},1fr)`, gap: 10 }}>
                  {confirmedToday.map((r: any) => (
                    <div key={r.id} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', border: '1px solid #bbf7d0', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="msf" style={{ fontSize: 16, color: '#15803d' }}>check_circle</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{r.facility_name || 'Facility'}</span>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 2 }}>{r.collected_tonnage}T</p>
                      <p style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span className="msf" style={{ fontSize: 11 }}>schedule</span>
                        {new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="a3">
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

            {/* Recent intakes + confirmed records */}
            <div className="a4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                {
                  title: 'Recent Intakes', items: recentIntakes,
                  emptyIcon: 'inventory', emptyMsg: 'No intakes yet', emptySub: 'Log your first intake',
                  itemIcon: 'recycling', itemBg: '#f0f9ff', itemColor: '#0369a1',
                  keyFn: (l: any) => `${l.material_type || l.waste_type || 'General'} · ${l.actual_quantity} ${l.unit}`,
                  statusFn: (l: any) => l.is_rejected ? { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' } : { bg: '#f0fdf4', color: '#00450d', border: '#bbf7d0' },
                  statusLabelFn: (l: any) => l.is_rejected ? 'Rejected' : 'Accepted',
                  href: '/dashboard/facility/history',
                },
                {
                  title: 'Disposal Records', items: pendingRecords,
                  emptyIcon: 'fact_check', emptyMsg: 'All confirmed', emptySub: 'No pending records',
                  itemIcon: 'delete_sweep', itemBg: '#fffbeb', itemColor: '#d97706',
                  keyFn: (r: any) => `${r.facility_name || 'Unknown'} · ${r.collected_tonnage}T`,
                  statusFn: (r: any) => statusStyle(r.status),
                  statusLabelFn: (r: any) => r.status,
                  href: '/dashboard/facility/disposal',
                },
              ].map(col => (
                <div key={col.title} className="card">
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 13, color: '#181c22', margin: 0 }}>{col.title}</p>
                    <Link href={col.href} style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2, fontFamily: 'Manrope,sans-serif' }}>
                      All <span className="msf" style={{ fontSize: 13 }}>chevron_right</span>
                    </Link>
                  </div>
                  <div style={{ padding: '10px 18px' }}>
                    {col.items.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                          <span className="msf" style={{ fontSize: 18, color: '#0369a1' }}>{col.emptyIcon}</span>
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#181c22', marginBottom: 2 }}>{col.emptyMsg}</p>
                        <p style={{ fontSize: 11, color: '#94a3b8' }}>{col.emptySub}</p>
                      </div>
                    ) : col.items.map((item: any) => {
                      const ss = col.statusFn(item)
                      return (
                        <div key={item.id} className="activity-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, background: col.itemBg, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span className="msf" style={{ color: col.itemColor, fontSize: 14 }}>{col.itemIcon}</span>
                            </div>
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 600, color: '#181c22', margin: 0 }}>{col.keyFn(item)}</p>
                              <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{new Date(item.received_at || item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                            </div>
                          </div>
                          <span className="badge" style={{ background: ss.bg, color: ss.color, borderColor: ss.border }}>{col.statusLabelFn(item)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Blockchain bar */}
            <div className="a5" style={{ borderRadius: 14, padding: '14px 20px', background: '#f0f9ff', border: '1px solid rgba(3,105,161,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="msf" style={{ color: '#0369a1', fontSize: 20 }}>verified</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#0369a1', fontFamily: 'Manrope,sans-serif', margin: 0 }}>Blockchain-verified intakes</p>
                  <p style={{ fontSize: 11, color: '#717a6d', margin: 0 }}>Every intake logged on Polygon Amoy · {stats.chainVerified} verified</p>
                </div>
              </div>
              <Link href="/dashboard/facility/history" style={{ background: '#0369a1', color: 'white', padding: '7px 16px', borderRadius: 99, fontWeight: 700, fontSize: 12, textDecoration: 'none', fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>View History</Link>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Stats hero */}
            <div className="hero a1">
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { value: stats.totalIntakes, label: 'Total Intakes', icon: 'inventory' },
                    { value: `${stats.totalWeight.toFixed(0)}kg`, label: 'Total Weight', icon: 'scale' },
                    { value: stats.pendingDisposal, label: 'Pending Disposal', icon: 'pending' },
                    { value: stats.chainVerified, label: 'Chain Verified', icon: 'verified' },
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

            {/* Disposal tips slideshow */}
            <div className="a1">
              <DisposalTipsSlideshow />
            </div>

          </div>
        </div>
      )}
    </DashboardLayout>
  )
}