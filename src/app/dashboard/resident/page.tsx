'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

const RESIDENT_NAV = [
  { label: 'Overview', href: '/dashboard/resident', icon: 'dashboard' },
  { label: 'Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' },
  { label: 'Track Vehicle', href: '/dashboard/resident/tracking', icon: 'location_on' },
  { label: 'Report Issue', href: '/dashboard/resident/report', icon: 'report_problem' },
  { label: 'Rate Service', href: '/dashboard/resident/feedback', icon: 'star' },
  { label: 'My Profile', href: '/dashboard/resident/profile', icon: 'person' },
]

const WASTE_COLORS: Record<string, { label: string; color: string; bg: string; border: string; icon: string; dot: string; gradient: string }> = {
  organic: { label: 'Organic', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: 'compost', dot: '#22c55e', gradient: 'linear-gradient(135deg,#15803d,#22c55e)' },
  non_recyclable: { label: 'Non-Recyclable', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'delete', dot: '#ef4444', gradient: 'linear-gradient(135deg,#dc2626,#f87171)' },
  recyclable: { label: 'Recyclable', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: 'recycling', dot: '#3b82f6', gradient: 'linear-gradient(135deg,#1d4ed8,#60a5fa)' },
  e_waste: { label: 'E-Waste', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', icon: 'computer', dot: '#a855f7', gradient: 'linear-gradient(135deg,#7c3aed,#c084fc)' },
  bulk: { label: 'Bulk Waste', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'inventory_2', dot: '#f59e0b', gradient: 'linear-gradient(135deg,#d97706,#fbbf24)' },
}

const FREQUENCIES: Record<string, string> = {
  daily: 'Daily', twice_weekly: '2× week', weekly: 'Weekly',
}

const ACTIONS = [
  { label: 'Collection Schedule', desc: 'View upcoming collections', icon: 'calendar_month', href: '/dashboard/resident/schedules', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  { label: 'Track Vehicle', desc: 'Live GPS truck location', icon: 'near_me', href: '/dashboard/resident/tracking', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { label: 'Report Issue', desc: 'Illegal dumping & missed collections', icon: 'report_problem', href: '/dashboard/resident/report', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { label: 'Report Issue', href: '/dashboard/resident/report', icon: 'report_problem' },
  { label: 'Rate Service', desc: 'Help CMC improve', icon: 'star', href: '/dashboard/resident/feedback', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
  { label: 'My Profile', desc: 'Update your details', icon: 'person', href: '/dashboard/resident/profile', color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
]

interface Schedule {
  id: string; waste_type: string; collection_day: string
  collection_time: string; frequency: string; notes: string; scheduled_date: string
  wards: string[]; ward: string
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
    setToast(msg); setTimeout(() => setToast(''), 3000)
  }

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
        const wardSpecific = filtered.filter((s: Schedule) => (s.wards && s.wards.includes(p.ward)) || (s.ward && s.ward === p.ward))
        const districtWide = filtered.filter((s: Schedule) => !s.wards?.length && !s.ward)
        filtered = wardSpecific.length > 0 ? [...wardSpecific, ...districtWide] : districtWide.length > 0 ? districtWide : filtered
      }
      setSchedules(filtered)
      if (filtered.length > 0) {
        const { data: confirmations } = await supabase.from('waste_confirmations').select('schedule_id, status').eq('user_id', user.id)
        const statusMap: Record<string, 'confirmed' | 'unable'> = {}
          ; (confirmations || []).forEach((c: any) => { statusMap[c.schedule_id] = c.status })
        setConfirmStatuses(statusMap)
      }
    }

    const { data: comp } = await supabase.from('complaints').select('*')
      .eq('submitted_by', user.id).order('created_at', { ascending: false }).limit(3)
    setComplaints(comp || [])

    const { data: rep } = await supabase.from('waste_reports').select('*')
      .eq('submitted_by', user.id).order('created_at', { ascending: false }).limit(3)
    setReports(rep || [])

    setLoading(false)
  }

  async function confirmHandover(schedule: Schedule, status: 'confirmed' | 'unable') {
    setConfirmingId(schedule.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setConfirmingId(null); return }
    if (confirmStatuses[schedule.id]) {
      await supabase.from('waste_confirmations').delete().eq('schedule_id', schedule.id).eq('user_id', user.id)
    }
    const { error } = await supabase.from('waste_confirmations').insert({
      schedule_id: schedule.id, user_id: user.id, role: 'resident',
      district: profile?.district, ward: profile?.ward || null, status,
    })
    if (!error) {
      setConfirmStatuses(prev => ({ ...prev, [schedule.id]: status }))
      showToast(status === 'confirmed' ? '✓ Confirmed! District engineer notified.' : 'Noted — marked as unable.')
    }
    setConfirmingId(null)
  }

  function statusStyle(s: string) {
    if (s === 'resolved') return { bg: '#f0fdf4', color: '#00450d', border: '#bbf7d0' }
    if (s === 'in_progress') return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
    if (s === 'assigned') return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
    return { bg: '#fefce8', color: '#92400e', border: '#fde68a' }
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
        .action-card{border-radius:16px;padding:18px;text-decoration:none;display:flex;align-items:flex-start;gap:12px;transition:all 0.2s;border:1.5px solid transparent}
        .action-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.08)}
        .confirm-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:99px;font-size:12px;font-weight:700;font-family:'Manrope',sans-serif;cursor:pointer;border:none;transition:all 0.2s}
        .confirm-btn:disabled{opacity:0.6;cursor:not-allowed}
        .activity-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6}
        .activity-row:last-child{border-bottom:none}
        .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;font-family:'Manrope',sans-serif;letter-spacing:0.06em;text-transform:uppercase;border:1px solid transparent}
        .toast-msg{animation:slideUp .3s ease}
        @keyframes slideUp{from{transform:translateY(12px) translateX(-50%);opacity:0}to{transform:translateY(0) translateX(-50%);opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .a1{animation:fadeUp .4s ease .04s both}.a2{animation:fadeUp .4s ease .09s both}
        .a3{animation:fadeUp .4s ease .14s both}.a4{animation:fadeUp .4s ease .19s both}
        .a5{animation:fadeUp .4s ease .24s both}
      `}</style>

      {toast && (
        <div className="toast-msg" style={{ position: 'fixed', bottom: 24, left: '50%', background: '#181c22', color: 'white', padding: '10px 20px', borderRadius: 9999, fontSize: 13, fontWeight: 500, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="a1" style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>Resident Portal</p>
        <h1 style={{ fontSize: 42, fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif', marginBottom: 4 }}>
          Welcome, <span style={{ color: '#00450d' }}>{firstName}</span>
        </h1>
        <p style={{ fontSize: 13, color: '#717a6d' }}>
          {profile?.district || 'CMC District'}{profile?.ward ? ` · Ward ${profile.ward}` : ''}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Hero — Next collection */}
            <div className="a1">
              {nextSched ? (() => {
                const wc = WASTE_COLORS[nextSched.waste_type] || { label: nextSched.waste_type, color: '#00450d', bg: '#f0fdf4', border: '#bbf7d0', icon: 'delete_sweep', dot: '#22c55e', gradient: 'linear-gradient(135deg,#00450d,#1b5e20)' }
                const cs = confirmStatuses[nextSched.id]
                const date = new Date(nextSched.scheduled_date)
                const isToday = date.toDateString() === new Date().toDateString()
                const isTmrw = date.toDateString() === new Date(Date.now() + 86400000).toDateString()
                return (
                  <div className="card" style={{ overflow: 'hidden' }}>
                    {/* Color bar */}
                    <div style={{ height: 5, background: wc.gradient }} />
                    <div style={{ padding: '24px 28px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: wc.bg, border: `1px solid ${wc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="msf" style={{ fontSize: 24, color: wc.color }}>{wc.icon}</span>
                            </div>
                            <div>
                              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>Next Collection</p>
                              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                                {isToday && <span style={{ fontSize: 10, fontWeight: 800, background: '#00450d', color: 'white', padding: '1px 8px', borderRadius: 99, fontFamily: 'Manrope,sans-serif' }}>TODAY</span>}
                                {isTmrw && <span style={{ fontSize: 10, fontWeight: 800, background: '#1d4ed8', color: 'white', padding: '1px 8px', borderRadius: 99, fontFamily: 'Manrope,sans-serif' }}>TOMORROW</span>}
                              </div>
                            </div>
                          </div>
                          <h2 style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Manrope,sans-serif', color: '#181c22', lineHeight: 1.1, marginBottom: 10 }}>
                            {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </h2>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: wc.bg, color: wc.color, border: `1px solid ${wc.border}`, fontFamily: 'Manrope,sans-serif' }}>{wc.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, background: '#f4f6f3', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span className="msf" style={{ fontSize: 13 }}>schedule</span>{nextSched.collection_time}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, background: '#f4f6f3', color: '#374151' }}>{FREQUENCIES[nextSched.frequency] || nextSched.frequency}</span>
                          </div>
                          {nextSched.notes && <p style={{ fontSize: 12, color: '#717a6d', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}><span className="msf" style={{ fontSize: 14 }}>info</span>{nextSched.notes}</p>}

                          {/* Confirm buttons */}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="confirm-btn" onClick={() => confirmHandover(nextSched, 'confirmed')} disabled={confirmingId === nextSched.id}
                              style={{ background: cs === 'confirmed' ? '#00450d' : 'white', color: cs === 'confirmed' ? 'white' : '#00450d', border: `1.5px solid ${cs === 'confirmed' ? '#00450d' : 'rgba(0,69,13,0.25)'}` }}>
                              <span className="msf" style={{ fontSize: 15, fontVariationSettings: cs === 'confirmed' ? "'FILL' 1" : "'FILL' 0" }}>thumb_up</span>
                              I'll have my waste ready
                            </button>
                            <button className="confirm-btn" onClick={() => confirmHandover(nextSched, 'unable')} disabled={confirmingId === nextSched.id}
                              style={{ background: cs === 'unable' ? '#dc2626' : 'white', color: cs === 'unable' ? 'white' : '#dc2626', border: `1.5px solid ${cs === 'unable' ? '#dc2626' : 'rgba(220,38,38,0.2)'}` }}>
                              <span className="msf" style={{ fontSize: 15 }}>cancel</span>
                              Unable to hand over
                            </button>
                          </div>
                        </div>

                        {/* Full schedule CTA */}
                        <Link href="/dashboard/resident/schedules"
                          style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 22px', borderRadius: 16, background: wc.bg, border: `1.5px solid ${wc.border}`, textDecoration: 'none', transition: 'all 0.2s' }}>
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
                    {todayScheds.map(s => {
                      const wc = WASTE_COLORS[s.waste_type]
                      return <span key={s.id} style={{ background: 'rgba(255,255,255,0.13)', color: 'white', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>{wc?.label || s.waste_type} · {s.collection_time}</span>
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming mini strip */}
            {upcoming.length > 0 && (
              <div className="a2">
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Coming Up</p>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${upcoming.length}, 1fr)`, gap: 10 }}>
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
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 2 }}>
                          {isTmrw ? 'Tomorrow' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                        <p style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span className="msf" style={{ fontSize: 11 }}>schedule</span>
                          {s.collection_time} · {FREQUENCIES[s.frequency] || s.frequency}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Actions grid */}
            <div className="a3">
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Quick Actions</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {ACTIONS.map(a => (
                  <Link key={a.href} href={a.href} className="action-card"
                    style={{ background: a.bg, borderColor: a.border }}>
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
            <div className="a4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Complaints */}
              <div className="card">
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 13, color: '#181c22' }}>Complaints</p>
                  <Link href="/dashboard/resident/report" style={{ fontSize: 11, fontWeight: 700, color: '#00450d', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2, fontFamily: 'Manrope,sans-serif' }}>
                    All <span className="msf" style={{ fontSize: 13 }}>chevron_right</span>
                  </Link>
                </div>
                <div style={{ padding: '10px 18px' }}>
                  {complaints.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                        <span className="msf" style={{ fontSize: 18, color: '#00450d' }}>check_circle</span>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#181c22', marginBottom: 2 }}>All clear</p>
                      <p style={{ fontSize: 11, color: '#94a3b8' }}>No complaints filed</p>
                    </div>
                  ) : complaints.map(c => {
                    const ss = statusStyle(c.status)
                    return (
                      <div key={c.id} className="activity-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, background: '#fef2f2', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msf" style={{ color: '#dc2626', fontSize: 14 }}>warning</span>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#181c22' }}>{c.complaint_type?.replace(/_/g, ' ')}</p>
                            <p style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                          </div>
                        </div>
                        <span className="badge" style={{ background: ss.bg, color: ss.color, borderColor: ss.border }}>{c.status?.replace('_', ' ')}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Reports */}
              <div className="card">
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 13, color: '#181c22' }}>My Reports</p>
                  <Link href="/dashboard/resident/report" style={{ fontSize: 11, fontWeight: 700, color: '#00450d', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2, fontFamily: 'Manrope,sans-serif' }}>
                    All <span className="msf" style={{ fontSize: 13 }}>chevron_right</span>
                  </Link>
                </div>
                <div style={{ padding: '10px 18px' }}>
                  {reports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                        <span className="msf" style={{ fontSize: 18, color: '#00450d' }}>photo_camera</span>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#181c22', marginBottom: 2 }}>No reports yet</p>
                      <p style={{ fontSize: 11, color: '#94a3b8' }}>Report issues in your area</p>
                    </div>
                  ) : reports.map(r => {
                    const ss = statusStyle(r.status)
                    return (
                      <div key={r.id} className="activity-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, background: '#faf5ff', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msf" style={{ color: '#7c3aed', fontSize: 14 }}>report_problem</span>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#181c22' }}>{r.report_type?.replace(/_/g, ' ')}</p>
                            <p style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{r.latitude ? ' · GPS' : ''}</p>
                          </div>
                        </div>
                        <span className="badge" style={{ background: ss.bg, color: ss.color, borderColor: ss.border }}>{r.status}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Blockchain bar */}
            <div className="a5" style={{ borderRadius: 14, padding: '14px 20px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="msf" style={{ color: '#00450d', fontSize: 20 }}>verified</span>
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

          {/* RIGHT COLUMN — sticky schedule sidebar */}
          <div style={{ position: 'sticky', top: 24 }}>
            <div className="card a1">
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(0,69,13,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msf" style={{ color: '#00450d', fontSize: 16 }}>calendar_month</span>
                  </div>
                  <div>
                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 13, color: '#181c22', lineHeight: 1.2 }}>Upcoming Collections</p>
                    <p style={{ fontSize: 10, color: '#94a3b8' }}>{profile?.district}{profile?.ward ? ` · ${profile.ward}` : ''}</p>
                  </div>
                </div>
                <Link href="/dashboard/resident/schedules" style={{ fontSize: 11, fontWeight: 700, color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 1 }}>
                  All <span className="msf" style={{ fontSize: 13 }}>open_in_new</span>
                </Link>
              </div>

              {schedules.length === 0 ? (
                <div style={{ padding: '28px 18px', textAlign: 'center' }}>
                  <span className="msf" style={{ fontSize: 30, color: '#d1d5db', display: 'block', marginBottom: 8 }}>event_busy</span>
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>No schedules published yet</p>
                </div>
              ) : (
                <div>
                  {schedules.slice(0, 6).map(s => {
                    const wc = WASTE_COLORS[s.waste_type] || { label: s.waste_type, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: 'delete_sweep', dot: '#94a3b8', gradient: '' }
                    const date = new Date(s.scheduled_date)
                    const isToday = date.toDateString() === new Date().toDateString()
                    const isTmrw = date.toDateString() === new Date(Date.now() + 86400000).toDateString()
                    const cs = confirmStatuses[s.id]
                    return (
                      <div key={s.id} style={{ padding: '12px 18px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: 12, background: isToday ? 'rgba(0,69,13,0.02)' : undefined }}>
                        <div style={{ flexShrink: 0, width: 42, textAlign: 'center' }}>
                          {isToday || isTmrw ? (
                            <>
                              <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: isToday ? '#00450d' : '#1d4ed8', fontFamily: 'Manrope,sans-serif' }}>{isToday ? 'Today' : 'Tmrw'}</p>
                              {isToday && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00450d', margin: '3px auto 0' }} />}
                            </>
                          ) : (
                            <>
                              <p style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', fontFamily: 'Manrope,sans-serif' }}>{date.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                              <p style={{ fontSize: 20, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1.1 }}>{date.getDate()}</p>
                              <p style={{ fontSize: 9, color: '#94a3b8' }}>{date.toLocaleDateString('en-GB', { month: 'short' })}</p>
                            </>
                          )}
                        </div>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: wc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="msf" style={{ fontSize: 13, color: wc.color }}>{wc.icon}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wc.label}</p>
                          <p style={{ fontSize: 10, color: '#94a3b8' }}>{s.collection_time} · {FREQUENCIES[s.frequency] || s.frequency}</p>
                          {cs && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 2, marginTop: 2, fontFamily: 'Manrope,sans-serif', background: cs === 'confirmed' ? 'rgba(0,69,13,0.08)' : 'rgba(220,38,38,0.08)', color: cs === 'confirmed' ? '#00450d' : '#dc2626' }}>
                              {cs === 'confirmed' ? '✓ Ready' : '✗ Unable'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ padding: '11px 18px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
                <Link href="/dashboard/resident/schedules" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope,sans-serif' }}>
                  <span className="msf" style={{ fontSize: 14 }}>calendar_month</span>
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