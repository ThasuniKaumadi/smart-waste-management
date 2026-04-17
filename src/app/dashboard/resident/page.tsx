'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

const RESIDENT_NAV = [
  { label: 'Overview', href: '/dashboard/resident', icon: 'dashboard' },
  { label: 'Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' },
  { label: 'Track Vehicle', href: '/dashboard/resident/tracking', icon: 'location_on' },
  { label: 'Report Dumping', href: '/dashboard/resident/report-dumping', icon: 'report_problem' },
  { label: 'Complaints', href: '/dashboard/resident/complaints', icon: 'feedback' },
  { label: 'Rate Service', href: '/dashboard/resident/feedback', icon: 'star' },
]

const WASTE_COLORS: Record<string, { label: string; color: string; bg: string; icon: string; pill: string }> = {
  organic: { label: 'Organic Waste', color: '#00450d', bg: '#f0fdf4', icon: 'compost', pill: '#bbf7d0' },
  non_recyclable: { label: 'Non-Recyclable', color: '#dc2626', bg: '#fef2f2', icon: 'delete', pill: '#fecaca' },
  recyclable: { label: 'Recyclable', color: '#1d4ed8', bg: '#eff6ff', icon: 'recycling', pill: '#bfdbfe' },
  e_waste: { label: 'E-Waste', color: '#7c3aed', bg: '#f5f3ff', icon: 'computer', pill: '#e9d5ff' },
  bulk: { label: 'Bulk Waste', color: '#d97706', bg: '#fffbeb', icon: 'inventory_2', pill: '#fde68a' },
}

const FREQUENCIES: Record<string, string> = {
  daily: 'Daily', twice_weekly: 'Twice a week', weekly: 'Weekly',
}

interface Schedule {
  id: string; district: string; ward: string; wards: string[]
  waste_type: string; collection_day: string; collection_time: string
  frequency: string; notes: string; scheduled_date: string
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

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    if (p?.district) {
      const today = new Date().toISOString().split('T')[0]
      const { data: raw } = await supabase
        .from('schedules').select('*')
        .eq('district', p.district).eq('published', true)
        .gte('scheduled_date', today).order('scheduled_date', { ascending: true })

      let filtered = raw || []
      if (p?.ward && filtered.length > 0) {
        const wardSpecific = filtered.filter(s => (s.wards && s.wards.includes(p.ward)) || (s.ward && s.ward === p.ward))
        const districtWide = filtered.filter(s => !s.wards?.length && !s.ward)
        filtered = wardSpecific.length > 0 ? [...wardSpecific, ...districtWide] : districtWide.length > 0 ? districtWide : filtered
      }
      setSchedules(filtered)

      // Load confirmation statuses
      if (filtered.length > 0) {
        const { data: confirmations } = await supabase
          .from('waste_confirmations').select('schedule_id, status').eq('user_id', user.id)
        const statusMap: Record<string, 'confirmed' | 'unable'> = {}
          ; (confirmations || []).forEach((c: any) => { statusMap[c.schedule_id] = c.status })
        setConfirmStatuses(statusMap)
      }
    }

    const { data: comp } = await supabase
      .from('complaints').select('*').eq('resident_id', user.id)
      .order('created_at', { ascending: false }).limit(3)
    setComplaints(comp || [])

    const { data: rep } = await supabase
      .from('waste_reports').select('*').eq('submitted_by', user.id)
      .order('created_at', { ascending: false }).limit(3)
    setReports(rep || [])

    setLoading(false)
  }

  async function confirmHandover(schedule: Schedule, status: 'confirmed' | 'unable') {
    // Allow switching by deleting existing first
    if (confirmStatuses[schedule.id]) {
      const supabase2 = createClient()
      const { data: { user: u2 } } = await supabase2.auth.getUser()
      if (u2) await supabase2.from('waste_confirmations').delete().eq('schedule_id', schedule.id).eq('user_id', u2.id)
    }
    setConfirmingId(schedule.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setConfirmingId(null); return }
    const { error } = await supabase.from('waste_confirmations').insert({
      schedule_id: schedule.id, user_id: user.id, role: 'resident',
      district: profile?.district, ward: profile?.ward || null, status,
    })
    if (!error) {
      setConfirmStatuses(prev => ({ ...prev, [schedule.id]: status }))
      showToast(status === 'confirmed' ? '✓ Confirmed! District engineer notified.' : 'Noted — marked as unable to hand over.')
    }
    setConfirmingId(null)
  }

  async function cancelConfirmation(scheduleId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('waste_confirmations').delete().eq('schedule_id', scheduleId).eq('user_id', user.id)
    setConfirmStatuses(prev => { const next = { ...prev }; delete next[scheduleId]; return next })
    showToast('Response cleared.')
  }

  function statusStyle(s: string): React.CSSProperties {
    if (s === 'resolved') return { background: 'rgba(0,69,13,0.08)', color: '#00450d' }
    if (s === 'in_progress') return { background: 'rgba(37,99,235,0.08)', color: '#1d4ed8' }
    return { background: 'rgba(180,83,9,0.08)', color: '#b45309' }
  }

  function formatRelativeDate(d: string) {
    const date = new Date(d)
    const today = new Date()
    const tmrw = new Date(); tmrw.setDate(today.getDate() + 1)
    if (date.toDateString() === today.toDateString()) return { label: 'Today', isToday: true, isTmrw: false }
    if (date.toDateString() === tmrw.toDateString()) return { label: 'Tomorrow', isToday: false, isTmrw: true }
    return { label: null, isToday: false, isTmrw: false }
  }

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const todayScheds = schedules.filter(s => s.collection_day === todayName)
  const nextSched = schedules[0]
  const upcoming = schedules.slice(0, 6)
  const restScheds = schedules.slice(1, 4)

  return (
    <DashboardLayout
      role="Resident"
      userName={profile?.full_name || ''}
      navItems={RESIDENT_NAV}
      primaryAction={{ label: 'View Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' }}
    >
      <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:16px; box-shadow:0 8px 32px -8px rgba(24,28,34,0.08); border:1px solid rgba(0,0,0,0.05); overflow:hidden; }
        .secondary-action { display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:12px; border:1px solid rgba(0,69,13,0.07); background:white; text-decoration:none; transition:all 0.25s ease; }
        .secondary-action:hover { background:#f9fafb; border-color:rgba(0,69,13,0.15); transform:translateY(-1px); }
        .activity-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; transition:background 0.1s; }
        .activity-row + .activity-row { border-top:1px solid #f3f4f6; }
        .status-pill { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; padding:3px 9px; border-radius:99px; font-family:'Manrope',sans-serif; white-space:nowrap; flex-shrink:0; }
        .sched-row { display:flex; align-items:flex-start; gap:12px; padding:12px 18px; transition:background 0.15s; }
        .sched-row:hover { background:#f9fafb; }
        .sched-row + .sched-row { border-top:1px solid #f3f4f6; }
        .outer-grid { display:grid; grid-template-columns:1fr 296px; gap:24px; align-items:start; }
        @media(max-width:960px){ .outer-grid{ grid-template-columns:1fr !important; } }
        .mini-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        @media(max-width:640px){ .mini-grid{ grid-template-columns:1fr; } }
        .confirm-btn { display:inline-flex; align-items:center; gap:5px; padding:7px 14px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:none; transition:all 0.2s; }
        .confirm-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .toast { animation:slideUp 0.3s ease; }
        @keyframes slideUp { from { transform:translateY(12px) translateX(-50%); opacity:0; } to { transform:translateY(0) translateX(-50%); opacity:1; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeUp{ from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .s1{animation:fadeUp .4s ease .04s both} .s2{animation:fadeUp .4s ease .09s both}
        .s3{animation:fadeUp .4s ease .14s both} .s4{animation:fadeUp .4s ease .19s both}
        .s5{animation:fadeUp .4s ease .24s both}
      `}</style>

      {toast && (
        <div className="toast" style={{ position: 'fixed', bottom: '24px', left: '50%', background: '#181c22', color: 'white', padding: '10px 20px', borderRadius: '9999px', fontSize: '13px', fontWeight: 500, zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      <div className="s1" style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 40, fontWeight: 900, fontFamily: 'Manrope,sans-serif', color: '#181c22', lineHeight: 1.1, marginBottom: 6 }}>
          Welcome, <span style={{ color: '#1b5e20' }}>{profile?.full_name?.split(' ')[0] || 'Resident'}</span>
        </h1>
        <p style={{ fontSize: 13, color: '#717a6d', fontFamily: 'Inter,sans-serif' }}>
          {profile?.district || 'CMC District'}{profile?.ward ? ` · Ward ${profile.ward}` : ''}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 30, height: 30, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      ) : (
        <div className="outer-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

            {/* ① HERO — Next collection */}
            <div className="s1">
              {nextSched ? (() => {
                const wc = WASTE_COLORS[nextSched.waste_type] || { label: nextSched.waste_type, color: '#00450d', bg: '#f0fdf4', icon: 'delete_sweep', pill: '#bbf7d0' }
                const rel = formatRelativeDate(nextSched.scheduled_date)
                const confirmStatus = confirmStatuses[nextSched.id]
                return (
                  <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(0,69,13,0.1)' }}>
                    <div style={{ height: 5, background: `linear-gradient(90deg, ${wc.color}, #1b5e20)` }} />
                    <div style={{ padding: '28px 32px', background: 'white' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: wc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 22, color: wc.color }}>{wc.icon}</span>
                            </div>
                            <div>
                              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>Next Collection</p>
                              {rel.isToday && <span style={{ fontSize: 10, fontWeight: 700, background: '#00450d', color: 'white', padding: '1px 8px', borderRadius: 99, fontFamily: 'Manrope,sans-serif' }}>TODAY</span>}
                              {rel.isTmrw && <span style={{ fontSize: 10, fontWeight: 700, background: '#1d4ed8', color: 'white', padding: '1px 8px', borderRadius: 99, fontFamily: 'Manrope,sans-serif' }}>TOMORROW</span>}
                            </div>
                          </div>
                          <h2 style={{ fontSize: 34, fontWeight: 900, fontFamily: 'Manrope,sans-serif', color: '#181c22', lineHeight: 1.1, marginBottom: 10 }}>
                            {new Date(nextSched.scheduled_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </h2>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, padding: '5px 14px', borderRadius: 99, background: wc.bg, color: wc.color, fontFamily: 'Manrope,sans-serif' }}>{wc.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, padding: '5px 14px', borderRadius: 99, background: '#f4f6f3', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>{nextSched.collection_time}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, padding: '5px 14px', borderRadius: 99, background: '#f4f6f3', color: '#374151' }}>{FREQUENCIES[nextSched.frequency] || nextSched.frequency}</span>
                          </div>
                          {nextSched.notes && <p style={{ marginBottom: 16, fontSize: 12, color: '#717a6d', display: 'flex', alignItems: 'center', gap: 5 }}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>{nextSched.notes}</p>}

                          {/* ── CONFIRM BUTTONS ── */}
                          {confirmStatus ? (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button className="confirm-btn" onClick={() => confirmStatus === 'confirmed' ? cancelConfirmation(nextSched.id) : confirmHandover(nextSched, 'confirmed')}
                                style={{ background: confirmStatus === 'confirmed' ? '#00450d' : 'white', color: confirmStatus === 'confirmed' ? 'white' : '#00450d', border: '1.5px solid rgba(0,69,13,0.3)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: confirmStatus === 'confirmed' ? "'FILL' 1" : "'FILL' 0" }}>thumb_up</span>
                                I'll have my waste ready
                              </button>
                              <button className="confirm-btn" onClick={() => confirmStatus === 'unable' ? cancelConfirmation(nextSched.id) : confirmHandover(nextSched, 'unable')}
                                style={{ background: confirmStatus === 'unable' ? '#ba1a1a' : 'white', color: confirmStatus === 'unable' ? 'white' : '#ba1a1a', border: '1.5px solid rgba(186,26,26,0.2)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: confirmStatus === 'unable' ? "'FILL' 1" : "'FILL' 0" }}>cancel</span>
                                Unable to hand over
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button className="confirm-btn" onClick={() => confirmHandover(nextSched, 'confirmed')} disabled={confirmingId === nextSched.id}
                                style={{ background: '#00450d', color: 'white' }}>
                                {confirmingId === nextSched.id
                                  ? <div style={{ width: 12, height: 12, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                  : <span className="material-symbols-outlined" style={{ fontSize: 14 }}>thumb_up</span>}
                                I'll have my waste ready
                              </button>
                              <button className="confirm-btn" onClick={() => confirmHandover(nextSched, 'unable')} disabled={confirmingId === nextSched.id}
                                style={{ background: 'white', color: '#ba1a1a', border: '1.5px solid rgba(186,26,26,0.2)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
                                Unable to hand over
                              </button>
                            </div>
                          )}
                        </div>

                        {/* CTA */}
                        <Link href="/dashboard/resident/schedules" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px 22px', borderRadius: 14, background: wc.bg, border: `1px solid ${wc.pill}`, textDecoration: 'none' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 28, color: wc.color }}>calendar_month</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: wc.color, fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>Full Schedule</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })() : (
                <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#d1d5db' }}>event_busy</span>
                  <p style={{ fontWeight: 600, color: '#181c22', marginTop: 10, fontFamily: 'Manrope,sans-serif' }}>No upcoming collections scheduled</p>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Your district engineer will publish schedules soon</p>
                </div>
              )}
            </div>

            {/* ② Upcoming mini cards */}
            {restScheds.length > 0 && (
              <div className="s2">
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Coming Up</p>
                <div className="mini-grid">
                  {restScheds.map(s => {
                    const wc = WASTE_COLORS[s.waste_type] || { label: s.waste_type, color: '#64748b', bg: '#f8fafc', icon: 'delete_sweep', pill: '#e2e8f0' }
                    const rel = formatRelativeDate(s.scheduled_date)
                    return (
                      <div key={s.id} style={{ background: 'white', borderRadius: 14, padding: '16px 18px', border: '1px solid #f0f0f0', boxShadow: '0 2px 12px -4px rgba(0,0,0,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: wc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 17, color: wc.color }}>{wc.icon}</span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{wc.label}</span>
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 2 }}>
                          {rel.label || new Date(s.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                        <p style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>schedule</span>
                          {s.collection_time} · {FREQUENCIES[s.frequency] || s.frequency}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ③ Today alert */}
            {todayScheds.length > 0 && (
              <div className="s3" style={{ borderRadius: 14, padding: '14px 18px', background: 'linear-gradient(135deg,#00450d,#1b5e20)', color: 'white', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 21 }}>notifications_active</span>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(163,246,156,0.75)', marginBottom: 3, fontFamily: 'Manrope,sans-serif' }}>Reminder — Collection Today</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {todayScheds.map(s => {
                      const wc = WASTE_COLORS[s.waste_type]
                      return (
                        <span key={s.id} style={{ background: 'rgba(255,255,255,0.13)', color: 'white', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>
                          {wc?.label || s.waste_type} · {s.collection_time}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ④ Actions */}
            <div className="s3">
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Actions</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Track Vehicle', desc: 'Live GPS location', icon: 'near_me', href: '/dashboard/resident/tracking', color: '#1d4ed8', bg: 'rgba(29,78,216,0.07)' },
                  { label: 'File Complaint', desc: 'Submit a formal grievance', icon: 'feedback', href: '/dashboard/resident/complaints', color: '#b45309', bg: 'rgba(180,83,9,0.07)' },
                  { label: 'Report Dumping', desc: 'Report illegal dumping', icon: 'report', href: '/dashboard/resident/report-dumping', color: '#64748b', bg: 'rgba(100,116,139,0.07)' },
                  { label: 'View Schedule', desc: 'Full collection calendar', icon: 'calendar_month', href: '/dashboard/resident/schedules', color: '#00450d', bg: 'rgba(0,69,13,0.07)' },
                ].map(a => (
                  <Link key={a.href} href={a.href} className="secondary-action">
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: a.color }}>{a.icon}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{a.label}</p>
                      <p style={{ fontSize: 11, color: '#94a3b8' }}>{a.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* ⑤ Complaints & Reports */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="s4">
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22' }}>Complaints</p>
                  <Link href="/dashboard/resident/complaints" style={{ fontSize: 11, fontWeight: 700, color: '#00450d', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 1, fontFamily: 'Manrope,sans-serif' }}>
                    All <span className="material-symbols-outlined" style={{ fontSize: 13 }}>chevron_right</span>
                  </Link>
                </div>
                {complaints.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#d1d5db' }}>check_circle</span>
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>None filed</p>
                  </div>
                ) : complaints.map(c => (
                  <div key={c.id} className="activity-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 30, height: 30, background: 'rgba(180,83,9,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ color: '#b45309', fontSize: 15 }}>warning</span>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#181c22' }}>{c.complaint_type?.replace(/_/g, ' ')}</p>
                        <p style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                      </div>
                    </div>
                    <span className="status-pill" style={statusStyle(c.status)}>{c.status?.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22' }}>My Reports</p>
                  <Link href="/dashboard/resident/report-dumping" style={{ fontSize: 11, fontWeight: 700, color: '#00450d', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 1, fontFamily: 'Manrope,sans-serif' }}>
                    All <span className="material-symbols-outlined" style={{ fontSize: 13 }}>chevron_right</span>
                  </Link>
                </div>
                {reports.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#d1d5db' }}>photo_camera</span>
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>No reports submitted</p>
                  </div>
                ) : reports.map(r => (
                  <div key={r.id} className="activity-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 30, height: 30, background: 'rgba(124,58,237,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ color: '#7c3aed', fontSize: 15 }}>recycling</span>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#181c22' }}>{r.report_type?.replace(/_/g, ' ')}</p>
                        <p style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{r.latitude ? ' · GPS' : ''}</p>
                      </div>
                    </div>
                    <span className="status-pill" style={statusStyle(r.status)}>{r.status?.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ⑥ Blockchain bar */}
            <div className="s5" style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: 20 }}>verified</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>Blockchain-verified collections</p>
                  <p style={{ fontSize: 11, color: '#717a6d' }}>Every stop logged on Polygon Amoy</p>
                </div>
              </div>
              <Link href="/dashboard/resident/tracking" style={{ background: '#00450d', color: 'white', padding: '7px 16px', borderRadius: 99, fontWeight: 700, fontSize: 12, textDecoration: 'none', fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>
                Track Now
              </Link>
            </div>

          </div>

          {/* RIGHT — schedule sidebar */}
          <div style={{ position: 'sticky', top: 24 }} className="s1">
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(0,69,13,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: 16 }}>calendar_month</span>
                  </div>
                  <div>
                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 13, color: '#181c22', lineHeight: 1.2 }}>Upcoming Collections</p>
                    <p style={{ fontSize: 10, color: '#94a3b8' }}>{profile?.district}{profile?.ward ? ` · ${profile.ward}` : ''}</p>
                  </div>
                </div>
                <Link href="/dashboard/resident/schedules" style={{ fontSize: 11, fontWeight: 700, color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 1 }}>
                  All <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
                </Link>
              </div>
              {schedules.length === 0 ? (
                <div style={{ padding: '28px 18px', textAlign: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 30, color: '#d1d5db' }}>event_busy</span>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>No schedules published yet</p>
                </div>
              ) : (
                <div>
                  {upcoming.map(s => {
                    const wc = WASTE_COLORS[s.waste_type] || { label: s.waste_type, color: '#64748b', bg: '#f8fafc', icon: 'delete_sweep', pill: '#e2e8f0' }
                    const rel = formatRelativeDate(s.scheduled_date)
                    const date = new Date(s.scheduled_date)
                    const cs = confirmStatuses[s.id]
                    return (
                      <div key={s.id} className="sched-row" style={{ background: rel.isToday ? 'rgba(0,69,13,0.025)' : undefined }}>
                        <div style={{ flexShrink: 0, width: 44, textAlign: 'center', paddingTop: 2 }}>
                          {rel.label ? (
                            <>
                              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: rel.isToday ? '#00450d' : '#64748b', fontFamily: 'Manrope,sans-serif' }}>{rel.label}</p>
                              {rel.isToday && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00450d', margin: '3px auto 0' }} />}
                            </>
                          ) : (
                            <>
                              <p style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', fontFamily: 'Manrope,sans-serif' }}>{date.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                              <p style={{ fontSize: 20, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1.1 }}>{date.getDate()}</p>
                              <p style={{ fontSize: 9, color: '#94a3b8' }}>{date.toLocaleDateString('en-GB', { month: 'short' })}</p>
                            </>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                            <div style={{ width: 20, height: 20, borderRadius: 5, background: wc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 11, color: wc.color }}>{wc.icon}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wc.label}</span>
                          </div>
                          <p style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>schedule</span>
                            {s.collection_time}<span style={{ color: '#d1d5db' }}>·</span>{FREQUENCIES[s.frequency] || s.frequency}
                          </p>
                          {/* Confirmation status in sidebar */}
                          {cs && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4, fontFamily: 'Manrope,sans-serif', background: cs === 'confirmed' ? 'rgba(0,69,13,0.08)' : 'rgba(186,26,26,0.08)', color: cs === 'confirmed' ? '#00450d' : '#ba1a1a' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 10, fontVariationSettings: "'FILL' 1" }}>{cs === 'confirmed' ? 'check_circle' : 'cancel'}</span>
                              {cs === 'confirmed' ? 'Confirmed' : 'Unable'}
                            </span>
                          )}
                          {rel.isToday && !cs && (
                            <span style={{ fontSize: 9, fontWeight: 700, background: '#00450d', color: 'white', padding: '1px 7px', borderRadius: 99, display: 'inline-block', marginTop: 4, fontFamily: 'Manrope,sans-serif' }}>TODAY</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ padding: '11px 18px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
                <Link href="/dashboard/resident/schedules" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope,sans-serif' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_month</span>
                  View full schedule
                </Link>
              </div>
            </div>
          </div>

        </div>
      )}
    </DashboardLayout>
  )
}