'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

const RESIDENT_NAV = [
  { label: 'Home', href: '/dashboard/resident', icon: 'dashboard', section: 'Menu' },
  { label: 'Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today', section: 'Menu' },
  { label: 'Track Vehicle', href: '/dashboard/resident/tracking', icon: 'location_on', section: 'Menu' },
  { label: 'Report Issue', href: '/dashboard/resident/report', icon: 'report_problem', section: 'Menu' },
  { label: 'Feedback', href: '/dashboard/resident/feedback', icon: 'star', section: 'Menu' },
  { label: 'My Profile', href: '/dashboard/resident/profile', icon: 'person', section: 'Menu' },
]

const WASTE_COLORS: Record<string, { label: string; color: string; bg: string; border: string; icon: string; dot: string; gradient: string }> = {
  organic: { label: 'Organic', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: 'compost', dot: '#22c55e', gradient: 'linear-gradient(135deg,#15803d,#22c55e)' },
  non_recyclable: { label: 'Non-Recyclable', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'delete', dot: '#ef4444', gradient: 'linear-gradient(135deg,#dc2626,#f87171)' },
  recyclable: { label: 'Recyclable', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: 'recycling', dot: '#3b82f6', gradient: 'linear-gradient(135deg,#1d4ed8,#60a5fa)' },
  e_waste: { label: 'E-Waste', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', icon: 'computer', dot: '#a855f7', gradient: 'linear-gradient(135deg,#7c3aed,#c084fc)' },
  bulk: { label: 'Bulk Waste', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'inventory_2', dot: '#f59e0b', gradient: 'linear-gradient(135deg,#d97706,#fbbf24)' },
}
const FREQUENCIES: Record<string, string> = {
  daily: 'Daily', twice_weekly: '2× week', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly',
}
const ACTIONS = [
  { label: 'Collection Schedule', desc: 'View upcoming collections', icon: 'calendar_month', href: '/dashboard/resident/schedules', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  { label: 'Track Vehicle', desc: 'Live GPS truck location', icon: 'near_me', href: '/dashboard/resident/tracking', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { label: 'Report Issue', desc: 'Illegal dumping & missed collections', icon: 'report_problem', href: '/dashboard/resident/report', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { label: 'Feedback', desc: 'Help CMC improve', icon: 'star', href: '/dashboard/resident/feedback', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
  { label: 'My Profile', desc: 'Update your details', icon: 'person', href: '/dashboard/resident/profile', color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
]

// Recycling centres near Colombo CMC districts
const RECYCLING_CENTERS = [
  {
    name: 'Orugodawatte Waste Recycling Centre',
    district: 'Colombo North – District 1',
    address: 'Orugodawatte Road, Colombo 10',
    types: ['Paper', 'Plastic', 'Metal'],
    hours: 'Mon–Sat · 7:00 AM – 5:00 PM',
    phone: '+94 11 269 1234',
    tip: 'Largest CMC facility. Accepts bulk recyclables from households.',
    color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: 'recycling',
  },
  {
    name: 'Bloemendhal E-Waste Drop Point',
    district: 'Colombo North – District 2',
    address: 'Bloemendhal Road, Colombo 13',
    types: ['Electronics', 'Batteries', 'Cables'],
    hours: 'Mon–Fri · 8:00 AM – 4:00 PM',
    phone: '+94 11 243 5678',
    tip: 'Bring old phones, laptops and appliances. Staff will issue a receipt.',
    color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', icon: 'computer',
  },
  {
    name: 'Wellawatte Community Composting Hub',
    district: 'Colombo South – District 3',
    address: 'Galle Road, Wellawatte, Colombo 6',
    types: ['Organic', 'Garden Waste', 'Food Scraps'],
    hours: 'Daily · 6:00 AM – 6:00 PM',
    phone: '+94 11 258 9012',
    tip: 'Free compost bags available on collection days for registered residents.',
    color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'compost',
  },
  {
    name: 'Narahenpita Material Recovery Facility',
    district: 'Colombo Central – District 4',
    address: 'Narahenpita Road, Colombo 5',
    types: ['Paper', 'Glass', 'Plastic', 'Metal'],
    hours: 'Mon–Sat · 7:30 AM – 4:30 PM',
    phone: '+94 11 267 3456',
    tip: 'Sort your recyclables before drop-off to speed up processing.',
    color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: 'delete_sweep',
  },
  {
    name: 'Dehiwala Municipal Recycling Point',
    district: 'Dehiwala–Mount Lavinia',
    address: 'Station Road, Dehiwala',
    types: ['Plastic', 'Paper', 'Cardboard'],
    hours: 'Tue, Thu, Sat · 8:00 AM – 1:00 PM',
    phone: '+94 11 271 2222',
    tip: 'Open three days a week only. Call ahead before visiting.',
    color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc', icon: 'store',
  },
]

interface Schedule {
  id: string; waste_type: string; collection_day: string
  collection_time: string; frequency: string; notes: string
  scheduled_date: string; wards: string[]; ward: string
}

function RecyclingSlideshow() {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  function goTo(idx: number) {
    if (animating || idx === current) return
    setAnimating(true)
    setCurrent(idx)
    setTimeout(() => setAnimating(false), 400)
  }

  function next() { goTo((current + 1) % RECYCLING_CENTERS.length) }
  function prev() { goTo((current - 1 + RECYCLING_CENTERS.length) % RECYCLING_CENTERS.length) }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % RECYCLING_CENTERS.length)
    }, 5000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function resetTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % RECYCLING_CENTERS.length)
    }, 5000)
  }

  const center = RECYCLING_CENTERS[current]

  return (
    <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(0,69,13,0.05)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(0,69,13,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 16, color: '#00450d', display: 'inline-block' }}>recycling</span>
          </div>
          <div>
            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 13, color: '#181c22', lineHeight: 1.2, margin: 0 }}>Recycling Centres Nearby</p>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>CMC — Colombo districts</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => { prev(); resetTimer() }}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
            <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 16, color: '#64748b', display: 'inline-block' }}>chevron_left</span>
          </button>
          <button onClick={() => { next(); resetTimer() }}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
            <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 16, color: '#64748b', display: 'inline-block' }}>chevron_right</span>
          </button>
        </div>
      </div>

      {/* Card content */}
      <div style={{ padding: '16px 18px', opacity: animating ? 0 : 1, transition: 'opacity 0.3s ease' }}>
        {/* Top accent + icon */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: center.bg, border: `1px solid ${center.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 22, color: center.color, display: 'inline-block' }}>{center.icon}</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 2, lineHeight: 1.3 }}>{center.name}</p>
            <p style={{ fontSize: 11, color: center.color, fontWeight: 600, margin: 0 }}>{center.district}</p>
          </div>
        </div>

        {/* Address */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
          <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 14, color: '#94a3b8', display: 'inline-block', marginTop: 1 }}>location_on</span>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.4 }}>{center.address}</p>
        </div>

        {/* Hours */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 14, color: '#94a3b8', display: 'inline-block' }}>schedule</span>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{center.hours}</p>
        </div>

        {/* Accepted types */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {center.types.map(t => (
            <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: center.bg, color: center.color, border: `1px solid ${center.border}`, fontFamily: 'Manrope,sans-serif', letterSpacing: '0.04em' }}>
              {t}
            </span>
          ))}
        </div>

        {/* Tip */}
        <div style={{ borderRadius: 10, padding: '9px 12px', background: '#f8fafc', border: '1px solid #f1f5f9', display: 'flex', gap: 8, marginBottom: 12 }}>
          <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 14, color: '#f59e0b', display: 'inline-block', flexShrink: 0, marginTop: 1 }}>lightbulb</span>
          <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.5, margin: 0 }}>{center.tip}</p>
        </div>

        {/* Phone */}
        <a href={`tel:${center.phone}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: center.color, fontWeight: 700, textDecoration: 'none', fontFamily: 'Manrope,sans-serif' }}>
          <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24", fontSize: 14, display: 'inline-block' }}>call</span>
          {center.phone}
        </a>
      </div>

      {/* Dots */}
      <div style={{ padding: '10px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {RECYCLING_CENTERS.map((_, i) => (
          <button key={i} onClick={() => { goTo(i); resetTimer() }}
            style={{ width: i === current ? 20 : 7, height: 7, borderRadius: 99, border: 'none', cursor: 'pointer', background: i === current ? '#00450d' : '#e2e8f0', transition: 'all 0.3s ease', padding: 0 }} />
        ))}
      </div>
    </div>
  )
}

export default function ResidentDashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [complaints, setComplaints] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [confirmStatuses, setConfirmStatuses] = useState<Record<string, 'confirmed' | 'unable'>>({})
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => { loadData() }, [])
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    if (p?.district) {
      const today = new Date().toISOString().split('T')[0]
      const { data: raw } = await supabase.from('schedules').select('*')
        .eq('district', p.district).eq('published', true)
        .gte('scheduled_date', today).order('scheduled_date', { ascending: true })
      let filtered = raw || []
      if (p?.ward && filtered.length > 0) {
        const ws = filtered.filter((s: Schedule) => (s.wards && s.wards.includes(p.ward)) || (s.ward && s.ward === p.ward))
        const dw = filtered.filter((s: Schedule) => !s.wards?.length && !s.ward)
        filtered = ws.length > 0 ? [...ws, ...dw] : dw.length > 0 ? dw : filtered
      }
      setSchedules(filtered)
      if (filtered.length > 0) {
        const { data: confs } = await supabase.from('waste_confirmations').select('schedule_id,status').eq('user_id', user.id)
        const map: Record<string, 'confirmed' | 'unable'> = {}
          ; (confs || []).forEach((c: any) => { map[c.schedule_id] = c.status })
        setConfirmStatuses(map)
      }
    }
    const { data: comp } = await supabase.from('complaints').select('*').eq('submitted_by', user.id).order('created_at', { ascending: false }).limit(3)
    setComplaints(comp || [])
    const { data: rep } = await supabase.from('waste_reports').select('*').eq('submitted_by', user.id).order('created_at', { ascending: false }).limit(3)
    setReports(rep || [])
    setLoading(false)
  }

  async function confirmHandover(schedule: Schedule, status: 'confirmed' | 'unable') {
    setConfirmingId(schedule.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setConfirmingId(null); return }
    if (confirmStatuses[schedule.id]) await supabase.from('waste_confirmations').delete().eq('schedule_id', schedule.id).eq('user_id', user.id)
    const { error } = await supabase.from('waste_confirmations').insert({ schedule_id: schedule.id, user_id: user.id, role: 'resident', district: profile?.district, ward: profile?.ward || null, status })
    if (!error) { setConfirmStatuses(prev => ({ ...prev, [schedule.id]: status })); showToast(status === 'confirmed' ? '✓ Confirmed! District engineer notified.' : 'Noted — marked as unable.') }
    setConfirmingId(null)
  }

  function statusStyle(s: string) {
    if (s === 'resolved') return { bg: '#f0fdf4', color: '#00450d', border: '#bbf7d0' }
    if (s === 'in_progress' || s === 'assigned') return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
    return { bg: '#fefce8', color: '#92400e', border: '#fde68a' }
  }

  function timeGreeting() {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }
  function greetingEmoji() {
    const h = new Date().getHours()
    if (h < 12) return '🌤️'
    if (h < 17) return '☀️'
    return '🌙'
  }

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const todayScheds = schedules.filter(s => s.collection_day === todayName)
  const nextSched = schedules[0]
  const upcoming = schedules.slice(1, 4)
  const firstName = profile?.full_name?.split(' ')[0] || 'Resident'

  return (
    <DashboardLayout role="Resident" userName={profile?.full_name || ''} navItems={RESIDENT_NAV}
      primaryAction={{ label: 'View Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' }}>
      <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
        .action-card{border-radius:16px;padding:16px;text-decoration:none;display:flex;align-items:flex-start;gap:12px;transition:all 0.2s;border:1.5px solid transparent}
        .action-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.08)}
        .confirm-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:99px;font-size:12px;font-weight:700;font-family:'Manrope',sans-serif;cursor:pointer;border:none;transition:all 0.2s}
        .confirm-btn:disabled{opacity:0.6;cursor:not-allowed}
        .activity-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6}
        .activity-row:last-child{border-bottom:none}
        .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;font-family:'Manrope',sans-serif;letter-spacing:0.06em;text-transform:uppercase;border:1px solid transparent}
        .hero{background:linear-gradient(135deg,#00450d 0%,#1b5e20 60%,#2e7d32 100%);border-radius:20px;padding:22px 28px;margin-bottom:24px;position:relative;overflow:hidden}
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
        <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: '46px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
          Welcome, <span style={{ color: '#00450d' }}>{firstName}</span>
        </h1>
        <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>
          {new Date().toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {profile?.district && ` · ${profile.district}`}
          {profile?.ward && ` · Ward ${profile.ward}`}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'start' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Next collection */}
            <div className="a2">
              {nextSched ? (() => {
                const wc = WASTE_COLORS[nextSched.waste_type] || { label: nextSched.waste_type, color: '#00450d', bg: '#f0fdf4', border: '#bbf7d0', icon: 'delete_sweep', dot: '#22c55e', gradient: 'linear-gradient(135deg,#00450d,#1b5e20)' }
                const cs = confirmStatuses[nextSched.id]
                const date = new Date(nextSched.scheduled_date)
                const isToday = date.toDateString() === new Date().toDateString()
                const isTmrw = date.toDateString() === new Date(Date.now() + 86400000).toDateString()
                return (
                  <div className="card" style={{ overflow: 'hidden' }}>
                    <div style={{ height: 5, background: wc.gradient }} />
                    <div style={{ padding: '24px 28px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: wc.bg, border: `1px solid ${wc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="msf" style={{ fontSize: 24, color: wc.color }}>{wc.icon}</span>
                            </div>
                            <div>
                              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>Next Collection</p>
                              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                                {isToday && <span style={{ fontSize: 10, fontWeight: 800, background: '#00450d', color: 'white', padding: '1px 8px', borderRadius: 99, fontFamily: 'Manrope,sans-serif' }}>TODAY</span>}
                                {isTmrw && <span style={{ fontSize: 10, fontWeight: 800, background: '#1d4ed8', color: 'white', padding: '1px 8px', borderRadius: 99, fontFamily: 'Manrope,sans-serif' }}>TOMORROW</span>}
                              </div>
                            </div>
                          </div>
                          <h2 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Manrope,sans-serif', color: '#181c22', lineHeight: 1.1, marginBottom: 10 }}>
                            {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </h2>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: wc.bg, color: wc.color, border: `1px solid ${wc.border}`, fontFamily: 'Manrope,sans-serif' }}>{wc.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, background: '#f4f6f3', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span className="msf" style={{ fontSize: 13 }}>schedule</span>{nextSched.collection_time}
                            </span>
                            {nextSched.frequency && <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, background: '#f4f6f3', color: '#374151' }}>{FREQUENCIES[nextSched.frequency] || nextSched.frequency}</span>}
                          </div>
                          {nextSched.notes && <p style={{ fontSize: 12, color: '#717a6d', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}><span className="msf" style={{ fontSize: 14 }}>info</span>{nextSched.notes}</p>}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="confirm-btn" onClick={() => confirmHandover(nextSched, 'confirmed')} disabled={confirmingId === nextSched.id}
                              style={{ background: cs === 'confirmed' ? '#00450d' : 'white', color: cs === 'confirmed' ? 'white' : '#00450d', border: `1.5px solid ${cs === 'confirmed' ? '#00450d' : 'rgba(0,69,13,0.25)'}` }}>
                              <span className="msf" style={{ fontSize: 15, fontVariationSettings: cs === 'confirmed' ? "'FILL' 1" : "'FILL' 0" }}>thumb_up</span>I'll have my waste ready
                            </button>
                            <button className="confirm-btn" onClick={() => confirmHandover(nextSched, 'unable')} disabled={confirmingId === nextSched.id}
                              style={{ background: cs === 'unable' ? '#dc2626' : 'white', color: cs === 'unable' ? 'white' : '#dc2626', border: `1.5px solid ${cs === 'unable' ? '#dc2626' : 'rgba(220,38,38,0.2)'}` }}>
                              <span className="msf" style={{ fontSize: 15 }}>cancel</span>Unable to hand over
                            </button>
                          </div>
                        </div>
                        <Link href="/dashboard/resident/schedules" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 22px', borderRadius: 16, background: wc.bg, border: `1.5px solid ${wc.border}`, textDecoration: 'none', transition: 'all 0.2s' }}>
                          <span className="msf" style={{ fontSize: 30, color: wc.color }}>calendar_month</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: wc.color, fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>Full Schedule</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })() : (
                <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                  <span className="msf" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 10 }}>event_busy</span>
                  <p style={{ fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 4 }}>No upcoming collections</p>
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>Your district engineer will publish schedules soon</p>
                </div>
              )}
            </div>

            {/* Today alert */}
            {todayScheds.length > 0 && (
              <div className="a2" style={{ borderRadius: 14, padding: '14px 18px', background: 'linear-gradient(135deg,#00450d,#1b5e20)', color: 'white', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="msf" style={{ fontSize: 21 }}>notifications_active</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(163,246,156,0.75)', marginBottom: 3, fontFamily: 'Manrope,sans-serif' }}>Collection Today — Have your waste ready</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {todayScheds.map(s => { const wc = WASTE_COLORS[s.waste_type]; return <span key={s.id} style={{ background: 'rgba(255,255,255,0.13)', color: 'white', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>{wc?.label || s.waste_type} · {s.collection_time}</span> })}
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming strip */}
            {upcoming.length > 0 && (
              <div className="a2">
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Coming Up</p>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${upcoming.length},1fr)`, gap: 10 }}>
                  {upcoming.map(s => {
                    const wc = WASTE_COLORS[s.waste_type] || { label: s.waste_type, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: 'delete_sweep', dot: '#94a3b8', gradient: '' }
                    const date = new Date(s.scheduled_date)
                    const isTmrw = date.toDateString() === new Date(Date.now() + 86400000).toDateString()
                    return (
                      <div key={s.id} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', border: `1px solid ${wc.border}`, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: wc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msf" style={{ fontSize: 16, color: wc.color }}>{wc.icon}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{wc.label}</span>
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 2 }}>{isTmrw ? 'Tomorrow' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                        <p style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 11 }}>schedule</span>{s.collection_time} · {FREQUENCIES[s.frequency] || s.frequency}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="a3">
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Quick Actions</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {ACTIONS.map(a => (
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

            {/* Complaints + Reports */}
            <div className="a4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { title: 'Complaints', items: complaints, emptyIcon: 'check_circle', emptyMsg: 'All clear', emptySub: 'No complaints filed', itemIcon: 'warning', itemBg: '#fef2f2', itemColor: '#dc2626', keyFn: (c: any) => c.complaint_type?.replace(/_/g, ' ') },
                { title: 'My Reports', items: reports, emptyIcon: 'photo_camera', emptyMsg: 'No reports yet', emptySub: 'Report issues in your area', itemIcon: 'report_problem', itemBg: '#faf5ff', itemColor: '#7c3aed', keyFn: (r: any) => r.report_type?.replace(/_/g, ' ') },
              ].map(col => (
                <div key={col.title} className="card">
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 13, color: '#181c22', margin: 0 }}>{col.title}</p>
                    <Link href="/dashboard/resident/report" style={{ fontSize: 11, fontWeight: 700, color: '#00450d', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2, fontFamily: 'Manrope,sans-serif' }}>All <span className="msf" style={{ fontSize: 13 }}>chevron_right</span></Link>
                  </div>
                  <div style={{ padding: '10px 18px' }}>
                    {col.items.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                          <span className="msf" style={{ fontSize: 18, color: '#00450d' }}>{col.emptyIcon}</span>
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#181c22', marginBottom: 2 }}>{col.emptyMsg}</p>
                        <p style={{ fontSize: 11, color: '#94a3b8' }}>{col.emptySub}</p>
                      </div>
                    ) : col.items.map((item: any) => {
                      const ss = statusStyle(item.status)
                      return (
                        <div key={item.id} className="activity-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, background: col.itemBg, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span className="msf" style={{ color: col.itemColor, fontSize: 14 }}>{col.itemIcon}</span>
                            </div>
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 600, color: '#181c22', margin: 0 }}>{col.keyFn(item)}</p>
                              <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                            </div>
                          </div>
                          <span className="badge" style={{ background: ss.bg, color: ss.color, borderColor: ss.border }}>{item.status?.replace('_', ' ')}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
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
              <Link href="/dashboard/resident/tracking" style={{ background: '#00450d', color: 'white', padding: '7px 16px', borderRadius: 99, fontWeight: 700, fontSize: 12, textDecoration: 'none', fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>Track Now</Link>
            </div>
          </div>

          {/* RIGHT sidebar */}
          <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Stats hero */}
            <div className="hero a1">
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { value: schedules.length, label: 'Upcoming Collections', icon: 'calendar_month' },
                    { value: complaints.length + reports.length, label: 'My Reports', icon: 'report_problem' },
                    { value: [...complaints, ...reports].filter((r: any) => r.status === 'resolved').length, label: 'Resolved', icon: 'task_alt' },
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

            {/* Recycling Centre Slideshow */}
            <div className="a1">
              <RecyclingSlideshow />
            </div>

          </div>
        </div>
      )}
    </DashboardLayout>
  )
}