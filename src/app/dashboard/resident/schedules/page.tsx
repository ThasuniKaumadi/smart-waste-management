'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const RESIDENT_NAV = [
  { label: 'Overview', href: '/dashboard/resident', icon: 'dashboard' },
  { label: 'Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' },
  { label: 'Track Vehicle', href: '/dashboard/resident/tracking', icon: 'location_on' },
  { label: 'Report Issue', href: '/dashboard/resident/report-dumping', icon: 'report_problem' },
  { label: 'Complaints', href: '/dashboard/resident/complaints', icon: 'feedback' },
  { label: 'Rate Service', href: '/dashboard/resident/feedback', icon: 'star' },
  { label: 'My Profile', desc: 'Update your details', icon: 'person', href: '/dashboard/resident/profile', color: '#7c3aed', bg: 'rgba(124,58,237,0.07)' },
]

const WASTE_COLORS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  organic: { label: 'Organic Waste', color: '#00450d', bg: 'rgba(0,69,13,0.08)', icon: 'compost' },
  non_recyclable: { label: 'Non-Recyclable', color: '#dc2626', bg: 'rgba(220,38,38,0.08)', icon: 'delete' },
  recyclable: { label: 'Recyclable', color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)', icon: 'recycling' },
  e_waste: { label: 'E-Waste', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', icon: 'computer' },
  bulk: { label: 'Bulk Waste', color: '#d97706', bg: 'rgba(217,119,6,0.08)', icon: 'inventory_2' },
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const FREQUENCIES: Record<string, string> = {
  daily: 'Daily', twice_weekly: 'Twice a week', weekly: 'Once a week',
}

interface Schedule {
  id: string; district: string; ward: string; wards: string[]
  waste_type: string; collection_day: string; collection_time: string
  frequency: string; notes: string; scheduled_date: string
}

export default function ResidentSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [view, setView] = useState<'upcoming' | 'weekly'>('upcoming')
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

    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('schedules').select('*')
      .eq('district', p?.district || '').eq('published', true)
      .gte('scheduled_date', today).order('scheduled_date', { ascending: true })

    let filtered = data || []
    if (p?.ward && filtered.length > 0) {
      const wardSpecific = filtered.filter(s => (s.wards && s.wards.includes(p.ward)) || (s.ward && s.ward === p.ward))
      const districtWide = filtered.filter(s => !s.wards?.length && !s.ward)
      filtered = wardSpecific.length > 0 ? [...wardSpecific, ...districtWide] : districtWide.length > 0 ? districtWide : filtered
    }
    setSchedules(filtered)

    // Load existing confirmations for this user
    const { data: confirmations } = await supabase
      .from('waste_confirmations').select('schedule_id, status').eq('user_id', user.id)
    const statusMap: Record<string, 'confirmed' | 'unable'> = {}
      ; (confirmations || []).forEach((c: any) => { statusMap[c.schedule_id] = c.status })
    setConfirmStatuses(statusMap)

    setLoading(false)
  }

  async function confirmHandover(schedule: Schedule, status: 'confirmed' | 'unable') {
    if (confirmStatuses[schedule.id]) return
    setConfirmingId(schedule.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('waste_confirmations').insert({
      schedule_id: schedule.id,
      user_id: user.id,
      role: 'resident',
      district: profile?.district,
      ward: profile?.ward || null,
      status,
    })

    if (!error) {
      setConfirmStatuses(prev => ({ ...prev, [schedule.id]: status }))
      showToast(status === 'confirmed' ? '✓ Confirmed! Your district engineer has been notified.' : 'Noted — marked as unable to hand over.')
    }
    setConfirmingId(null)
  }

  async function cancelConfirmation(scheduleId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('waste_confirmations').delete().eq('schedule_id', scheduleId).eq('user_id', user.id)
    setConfirmStatuses(prev => { const next = { ...prev }; delete next[scheduleId]; return next })
    showToast('Confirmation cancelled.')
  }

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const todaySchedules = schedules.filter(s => s.collection_day === todayName)
  const nextSchedule = schedules[0]

  function ConfirmButton({ schedule }: { schedule: Schedule }) {
    const status = confirmStatuses[schedule.id]
    const isConfirmed = status === 'confirmed'
    const isUnable = status === 'unable'
    const loading = confirmingId === schedule.id
    return (
      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,69,13,0.06)' }}>
        {status ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '99px', background: isConfirmed ? 'rgba(0,69,13,0.08)' : 'rgba(186,26,26,0.08)', flex: 1 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: isConfirmed ? '#00450d' : '#ba1a1a', fontVariationSettings: "'FILL' 1" }}>
                {isConfirmed ? 'check_circle' : 'cancel'}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: isConfirmed ? '#00450d' : '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}>
                {isConfirmed ? 'Waste handover confirmed' : 'Marked as unable to hand over'}
              </span>
            </div>
            <button onClick={() => cancelConfirmation(schedule.id)}
              style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontFamily: 'Manrope, sans-serif' }}>
              Change
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => confirmHandover(schedule, 'confirmed')} disabled={!!loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '99px', background: '#00450d', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', opacity: loading ? 0.6 : 1 }}>
              {loading ? <div style={{ width: '12px', height: '12px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>thumb_up</span>}
              I'll have my waste ready
            </button>
            <button onClick={() => confirmHandover(schedule, 'unable')} disabled={!!loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '99px', background: 'white', color: '#ba1a1a', border: '1.5px solid rgba(186,26,26,0.2)', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', opacity: loading ? 0.6 : 1 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cancel</span>
              Unable to hand over
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <DashboardLayout role="Resident" userName={profile?.full_name || ''} navItems={RESIDENT_NAV}
      primaryAction={{ label: 'Report Issue', href: '/dashboard/resident/report-dumping', icon: 'report_problem' }}>
      <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; transition:all 0.3s; }
        .bento-card-green { background:#00450d; border-radius:16px; color:white; overflow:hidden; position:relative; }
        .schedule-card { background:white; border-radius:14px; padding:18px 20px; border:1px solid rgba(0,0,0,0.05); box-shadow:0 1px 4px rgba(0,0,0,0.04); transition:transform 0.15s,box-shadow 0.15s; }
        .schedule-card:hover { transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,0,0,0.08); }
        .view-btn { padding:8px 18px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .view-btn.active { background:#00450d; color:white; }
        .view-btn:not(.active) { background:#f1f5f9; color:#64748b; }
        .toast { animation:slideUp 0.3s ease; }
        @keyframes slideUp { from { transform:translateY(12px) translateX(-50%); opacity:0; } to { transform:translateY(0) translateX(-50%); opacity:1; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1{animation:staggerIn 0.5s ease 0.05s both} .s2{animation:staggerIn 0.5s ease 0.10s both} .s3{animation:staggerIn 0.5s ease 0.15s both}
      `}</style>

      {toast && (
        <div className="toast" style={{ position: 'fixed', bottom: '24px', left: '50%', background: '#181c22', color: 'white', padding: '10px 20px', borderRadius: '9999px', fontSize: '13px', fontWeight: 500, zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      <section className="mb-10 s1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>Resident Portal</span>
            <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
              Collection <span style={{ color: '#1b5e20' }}>Schedule</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
              {profile?.district || 'CMC District'}{profile?.ward ? ` · Ward: ${profile.ward}` : ''}
              {Object.keys(confirmStatuses).length > 0 && <span style={{ marginLeft: '8px', color: '#00450d', fontWeight: 600 }}>· {Object.values(confirmStatuses).filter(s => s === 'confirmed').length} confirmed, {Object.values(confirmStatuses).filter(s => s === 'unable').length} unable</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`view-btn ${view === 'upcoming' ? 'active' : ''}`} onClick={() => setView('upcoming')}>Upcoming</button>
            <button className={`view-btn ${view === 'weekly' ? 'active' : ''}`} onClick={() => setView('weekly')}>By Day</button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
        </div>
      ) : schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center s2">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>calendar_month</span>
          </div>
          <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No schedules published yet</p>
          <p className="text-sm" style={{ color: '#94a3b8' }}>Your district engineer will publish schedules soon</p>
        </div>
      ) : (
        <>
          {/* Info banner about confirmations */}
          <div className="s2 mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px', flexShrink: 0 }}>info</span>
            <p className="text-sm" style={{ color: '#41493e' }}>
              Tap <strong>"I'll have my waste ready"</strong> on any collection to confirm handover. Your district engineer uses this to plan the best collection days.
            </p>
          </div>

          {/* Today's collections banner */}
          {todaySchedules.length > 0 && (
            <div className="s2 mb-6" style={{ background: 'linear-gradient(135deg,#00450d,#1b5e20)', borderRadius: '16px', padding: '20px 24px', color: 'white', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>today</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(163,246,156,0.7)', margin: '0 0 4px', fontFamily: 'Manrope, sans-serif' }}>Today's Collections</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {todaySchedules.map(s => (
                    <span key={s.id} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '4px 12px', borderRadius: '99px', fontSize: '13px', fontWeight: 600, fontFamily: 'Manrope, sans-serif' }}>
                      {WASTE_COLORS[s.waste_type]?.label || s.waste_type} at {s.collection_time}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Next upcoming highlight */}
          {nextSchedule && view === 'upcoming' && (
            <div className="bento-card-green p-8 mb-6 s2">
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full -mr-16 -mt-16" style={{ background: 'rgba(163,246,156,0.06)' }} />
              <div className="relative z-10">
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', display: 'block', marginBottom: '12px', fontFamily: 'Manrope, sans-serif' }}>Next Scheduled Collection</span>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: '32px', letterSpacing: '-0.02em', marginBottom: '8px', lineHeight: 1.1 }}>
                  {new Date(nextSchedule.scheduled_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
                <p style={{ color: 'rgba(163,246,156,0.8)', fontSize: '14px', marginBottom: '16px' }}>
                  {WASTE_COLORS[nextSchedule.waste_type]?.label || nextSchedule.waste_type} · {nextSchedule.collection_day} at {nextSchedule.collection_time} · {FREQUENCIES[nextSchedule.frequency]}
                </p>
                {nextSchedule.notes && (
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>info</span>{nextSchedule.notes}
                  </p>
                )}
                {/* Confirm button on hero */}
                <div style={{ marginTop: '20px' }}>
                  {confirmStatuses[nextSchedule.id] ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '99px', background: 'rgba(255,255,255,0.15)', color: 'rgba(163,246,156,0.9)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>{confirmStatuses[nextSchedule.id] === 'confirmed' ? 'check_circle' : 'cancel'}</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}>{confirmStatuses[nextSchedule.id] === 'confirmed' ? 'Waste handover confirmed' : 'Unable to hand over'}</span>
                    </div>
                  ) : (
                    <button onClick={() => confirmHandover(nextSchedule, 'confirmed')} disabled={confirmingId === nextSchedule.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '99px', background: 'white', color: '#00450d', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', opacity: confirmingId === nextSchedule.id ? 0.7 : 1 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>thumb_up</span>
                      I'll have my waste ready
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming list */}
          {view === 'upcoming' && (
            <div className="s3">
              <h3 className="font-headline font-bold text-base mb-4" style={{ color: '#181c22' }}>All Upcoming ({schedules.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {schedules.map(s => {
                  const wc = WASTE_COLORS[s.waste_type] || { label: s.waste_type, color: '#64748b', bg: 'rgba(100,116,139,0.08)', icon: 'delete_sweep' }
                  const scheduleWards = s.wards?.length > 0 ? s.wards : s.ward ? [s.ward] : []
                  return (
                    <div key={s.id} className="schedule-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: wc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '22px', color: wc.color }}>{wc.icon}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#181c22' }}>{wc.label}</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: wc.bg, color: wc.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{FREQUENCIES[s.frequency]}</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#717a6d' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>event</span>
                              {new Date(s.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>schedule</span>
                              {s.collection_day} at {s.collection_time}
                            </span>
                            {scheduleWards.length > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                {scheduleWards.join(', ')}
                              </span>
                            )}
                          </div>
                          {s.notes && <p style={{ fontSize: '12px', color: '#717a6d', marginTop: '4px', fontStyle: 'italic' }}>{s.notes}</p>}
                        </div>
                      </div>
                      <ConfirmButton schedule={s} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* By day view */}
          {view === 'weekly' && (
            <div className="s3">
              <h3 className="font-headline font-bold text-base mb-4" style={{ color: '#181c22' }}>Schedule by Day</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {DAYS.map(day => {
                  const daySchedules = schedules.filter(s => s.collection_day === day)
                  if (daySchedules.length === 0) return null
                  return (
                    <div key={day} className="bento-card">
                      <div style={{ padding: '14px 20px', background: day === todayName ? 'rgba(0,69,13,0.04)' : 'white', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '15px', color: day === todayName ? '#00450d' : '#181c22' }}>{day}</span>
                        {day === todayName && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: 'rgba(0,69,13,0.1)', color: '#00450d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today</span>}
                      </div>
                      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {daySchedules.map(s => {
                          const wc = WASTE_COLORS[s.waste_type] || { label: s.waste_type, color: '#64748b', bg: 'rgba(100,116,139,0.08)', icon: 'delete_sweep' }
                          const confirmStatus = confirmStatuses[s.id]
                          return (
                            <div key={s.id} style={{ padding: '12px 14px', borderRadius: '10px', background: '#f9fbf9', border: confirmStatus ? `1px solid ${confirmStatus === 'confirmed' ? 'rgba(0,69,13,0.15)' : 'rgba(186,26,26,0.15)'}` : '1px solid transparent' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: confirmStatus ? '8px' : '0' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: wc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: wc.color }}>{wc.icon}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#181c22' }}>{wc.label}</span>
                                  <div style={{ fontSize: '11px', color: '#717a6d', display: 'flex', gap: '8px', marginTop: '2px' }}>
                                    <span>{s.collection_time}</span><span>·</span><span>{FREQUENCIES[s.frequency]}</span>
                                    {s.notes && <><span>·</span><span>{s.notes}</span></>}
                                  </div>
                                </div>
                                {confirmStatus ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: confirmStatus === 'confirmed' ? '#00450d' : '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>{confirmStatus === 'confirmed' ? 'check_circle' : 'cancel'}</span>
                                    {confirmStatus === 'confirmed' ? 'Confirmed' : 'Unable'}
                                  </span>
                                ) : (
                                  <button onClick={() => confirmHandover(s, 'confirmed')} disabled={confirmingId === s.id}
                                    style={{ fontSize: '11px', fontWeight: 700, padding: '5px 10px', borderRadius: '99px', background: '#00450d', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', flexShrink: 0, opacity: confirmingId === s.id ? 0.6 : 1 }}>
                                    Confirm
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}