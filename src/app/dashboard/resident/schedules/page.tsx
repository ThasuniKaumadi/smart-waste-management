'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const RESIDENT_NAV = [
  { label: 'Overview', href: '/dashboard/resident', icon: 'dashboard', section: 'Menu' },
  { label: 'Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today', section: 'Menu' },
  { label: 'Track Vehicle', href: '/dashboard/resident/tracking', icon: 'location_on', section: 'Menu' },
  { label: 'Report Issue', href: '/dashboard/resident/report', icon: 'report_problem', section: 'Menu' },
  { label: 'Rate Service', href: '/dashboard/resident/feedback', icon: 'star', section: 'Menu' },
  { label: 'My Profile', href: '/dashboard/resident/profile', icon: 'person', section: 'Menu' },
]

const WASTE_COLORS: Record<string, { label: string; color: string; bg: string; border: string; icon: string; dot: string }> = {
  organic: { label: 'Organic', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: 'compost', dot: '#22c55e' },
  non_recyclable: { label: 'Non-Recyclable', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'delete', dot: '#ef4444' },
  recyclable: { label: 'Recyclable', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: 'recycling', dot: '#3b82f6' },
  e_waste: { label: 'E-Waste', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', icon: 'computer', dot: '#a855f7' },
  bulk: { label: 'Bulk Waste', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'inventory_2', dot: '#f59e0b' },
  other: { label: 'Other', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: 'category', dot: '#94a3b8' },
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const FREQUENCIES: Record<string, string> = {
  daily: 'Daily', twice_weekly: '2× week', weekly: 'Weekly',
  fortnightly: 'Fortnightly', monthly: 'Monthly',
}

interface Schedule {
  id: string; district: string; ward: string; wards: string[]
  waste_type: string; custom_waste_type: string | null
  collection_day: string; collection_time: string
  frequency: string; notes: string; scheduled_date: string
  streets: Record<string, string[]> | null
  status: string; cancellation_note: string | null
}

function getWasteInfo(s: Schedule) {
  const base = WASTE_COLORS[s.waste_type] || WASTE_COLORS.other
  if (s.waste_type === 'other' && s.custom_waste_type) return { ...base, label: s.custom_waste_type }
  return base
}

function StreetsDisplay({ streets, ward }: { streets: Record<string, string[]> | null; ward: string | null }) {
  if (!streets || Object.keys(streets).length === 0) return null
  const relevant = ward ? Object.entries(streets).filter(([w]) => w === ward) : Object.entries(streets)
  if (relevant.length === 0) return null
  return (
    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {relevant.flatMap(([, streetList]) => streetList).map(street => (
        <span key={street} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(0,69,13,0.07)', color: '#00450d', fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>{street}</span>
      ))}
    </div>
  )
}

export default function ResidentSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [confirmStatuses, setConfirmStatuses] = useState<Record<string, 'confirmed' | 'unable'>>({})
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  useEffect(() => { loadData() }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500) }

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    const today = new Date().toISOString().split('T')[0]

    // Fetch published AND cancelled (so residents can see cancellations)
    const { data } = await supabase.from('schedules').select('*')
      .eq('district', p?.district || '')
      .in('status', ['published', 'cancelled'])
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })

    let filtered = data || []
    if (p?.ward && filtered.length > 0) {
      const wardSpecific = filtered.filter((s: Schedule) => (s.wards && s.wards.includes(p.ward)) || (s.ward && s.ward === p.ward))
      const districtWide = filtered.filter((s: Schedule) => !s.wards?.length && !s.ward)
      filtered = wardSpecific.length > 0 ? [...wardSpecific, ...districtWide] : districtWide.length > 0 ? districtWide : filtered
    }
    setSchedules(filtered)

    const { data: confirmations } = await supabase.from('waste_confirmations').select('schedule_id, status').eq('user_id', user.id)
    const statusMap: Record<string, 'confirmed' | 'unable'> = {}
      ; (confirmations || []).forEach((c: any) => { statusMap[c.schedule_id] = c.status })
    setConfirmStatuses(statusMap)
    setLoading(false)
  }

  async function confirmHandover(schedule: Schedule, status: 'confirmed' | 'unable') {
    if (schedule.status === 'cancelled') return
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
      showToast(status === 'confirmed' ? '✓ Confirmed! District engineer notified.' : 'Noted — marked as unable to hand over.')
    }
    setConfirmingId(null)
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayDate = today.getDate(); const todayMonth = today.getMonth(); const todayYear = today.getFullYear()

  function schedulesForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return schedules.filter(s => s.scheduled_date === dateStr)
  }

  const todayDayName = DAYS_FULL[today.getDay()]
  const todaySchedules = schedules.filter(s => s.collection_day === todayDayName && s.status === 'published')
  const nextSchedule = schedules.find(s => s.status === 'published')

  // Cancelled schedules coming up
  const upcomingCancellations = schedules.filter(s => s.status === 'cancelled')

  return (
    <DashboardLayout role="Resident" userName={profile?.full_name || ''} navItems={RESIDENT_NAV}
      primaryAction={{ label: 'Report Issue', href: '/dashboard/resident/report', icon: 'report_problem' }}>
      <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .msf-fill{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
        .cal-day{min-height:72px;border-radius:10px;padding:6px;cursor:pointer;transition:all 0.15s;border:1.5px solid transparent;}
        .cal-day:hover{background:#f0fdf4;border-color:rgba(0,69,13,0.1)}
        .cal-day.today{border-color:#00450d;background:#f0fdf4}
        .cal-day.selected{background:#00450d;border-color:#00450d}
        .view-btn{padding:8px 18px;border-radius:99px;font-size:12px;font-weight:700;font-family:'Manrope',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
        .view-btn.active{background:#00450d;color:white}
        .view-btn:not(.active){background:#f1f5f9;color:#64748b}
        .confirm-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:99px;font-size:11px;font-weight:700;font-family:'Manrope',sans-serif;cursor:pointer;border:none;transition:all 0.2s}
        .toast-msg{animation:slideUp .3s ease}
        @keyframes slideUp{from{transform:translateY(12px) translateX(-50%);opacity:0}to{transform:translateY(0) translateX(-50%);opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .a1{animation:fadeUp .4s ease .04s both}.a2{animation:fadeUp .4s ease .09s both}.a3{animation:fadeUp .4s ease .14s both}
      `}</style>

      {toast && (
        <div className="toast-msg" style={{ position: 'fixed', bottom: 24, left: '50%', background: '#181c22', color: 'white', padding: '10px 20px', borderRadius: 9999, fontSize: 13, fontWeight: 500, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>{toast}</div>
      )}

      {/* Header */}
      <div className="a1" style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>Resident Portal</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 42, fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif' }}>
            Collection <span style={{ color: '#00450d' }}>Schedule</span>
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`view-btn ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}><span className="msf" style={{ fontSize: 14, marginRight: 4 }}>calendar_month</span>Calendar</button>
            <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}><span className="msf" style={{ fontSize: 14, marginRight: 4 }}>list</span>List</button>
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#717a6d', marginTop: 6 }}>{profile?.district || 'CMC District'}{profile?.ward ? ` · Ward ${profile.ward}` : ''}</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Cancellation alert banner */}
          {upcomingCancellations.length > 0 && (
            <div className="a1" style={{ marginBottom: 16 }}>
              {upcomingCancellations.map(s => {
                const wc = getWasteInfo(s)
                return (
                  <div key={s.id} style={{ borderRadius: 14, padding: '14px 18px', background: '#fef2f2', border: '1px solid rgba(186,26,26,0.2)', display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 8 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(186,26,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="msf-fill" style={{ fontSize: 20, color: '#ba1a1a' }}>cancel</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#ba1a1a', fontFamily: 'Manrope,sans-serif', marginBottom: 3 }}>
                        Collection Cancelled — {wc.label}
                      </p>
                      <p style={{ fontSize: 12, color: '#7f1d1d', margin: 0 }}>
                        {new Date(s.scheduled_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {s.collection_time}
                      </p>
                      {s.cancellation_note && (
                        <p style={{ fontSize: 12, color: '#991b1b', marginTop: 5, fontStyle: 'italic' }}>"{s.cancellation_note}"</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Today alert */}
          {todaySchedules.length > 0 && (
            <div className="a1" style={{ marginBottom: 16, borderRadius: 14, padding: '14px 18px', background: 'linear-gradient(135deg,#00450d,#1b5e20)', color: 'white', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="msf" style={{ fontSize: 21 }}>notifications_active</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(163,246,156,0.75)', marginBottom: 3, fontFamily: 'Manrope,sans-serif' }}>Collection Today</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {todaySchedules.map(s => {
                    const wc = getWasteInfo(s)
                    return <span key={s.id} style={{ background: 'rgba(255,255,255,0.13)', color: 'white', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>{wc.label} · {s.collection_time}</span>
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Next collection card */}
          {nextSchedule && (
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, marginBottom: 20, alignItems: 'start' }}>
              <div className="card" style={{ padding: '18px 22px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                {(() => {
                  const wc = getWasteInfo(nextSchedule)
                  const cs = confirmStatuses[nextSchedule.id]
                  return (
                    <>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: wc.bg, border: `1px solid ${wc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="msf" style={{ fontSize: 24, color: wc.color }}>{wc.icon}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 3 }}>Next Collection</p>
                        <p style={{ fontSize: 17, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 2 }}>
                          {new Date(nextSchedule.scheduled_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: wc.color, padding: '2px 8px', borderRadius: 99, background: wc.bg, border: `1px solid ${wc.border}` }}>{wc.label}</span>
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{nextSchedule.collection_time}{nextSchedule.frequency ? ` · ${FREQUENCIES[nextSchedule.frequency] || nextSchedule.frequency}` : ''}</span>
                        </div>
                        <StreetsDisplay streets={nextSchedule.streets} ward={profile?.ward || null} />
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {cs ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 99, background: cs === 'confirmed' ? 'rgba(0,69,13,0.08)' : 'rgba(220,38,38,0.08)' }}>
                            <span className="msf" style={{ fontSize: 14, color: cs === 'confirmed' ? '#00450d' : '#dc2626', fontVariationSettings: "'FILL' 1" }}>{cs === 'confirmed' ? 'check_circle' : 'cancel'}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: cs === 'confirmed' ? '#00450d' : '#dc2626', fontFamily: 'Manrope,sans-serif' }}>{cs === 'confirmed' ? 'Confirmed' : 'Unable'}</span>
                          </div>
                        ) : (
                          <button onClick={() => confirmHandover(nextSchedule, 'confirmed')} disabled={confirmingId === nextSchedule.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 99, background: '#00450d', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif' }}>
                            <span className="msf" style={{ fontSize: 14 }}>thumb_up</span>Ready
                          </button>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
              {/* Waste legend */}
              <div className="card" style={{ padding: '14px 18px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Waste Types</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {Object.entries(WASTE_COLORS).filter(([k]) => k !== 'other').map(([key, wc]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: wc.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{wc.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Calendar view */}
          {view === 'calendar' && (
            <div className="a3">
              <div className="card">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msf" style={{ fontSize: 18, color: '#374151' }}>chevron_left</span>
                  </button>
                  <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22' }}>{MONTHS[month]} {year}</h3>
                  <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msf" style={{ fontSize: 18, color: '#374151' }}>chevron_right</span>
                  </button>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
                    {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', padding: '4px 0' }}>{d}</div>)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const daySchedules = schedulesForDay(day)
                      const isToday = day === todayDate && month === todayMonth && year === todayYear
                      const isSelected = selectedDay === day
                      const hasCancelled = daySchedules.some(s => s.status === 'cancelled')
                      return (
                        <div key={day} className={`cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedDay(isSelected ? null : day)}>
                          <p style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isSelected ? 'white' : isToday ? '#00450d' : '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 4 }}>{day}</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {daySchedules.slice(0, 2).map(s => {
                              const wc = getWasteInfo(s)
                              const cancelled = s.status === 'cancelled'
                              return <div key={s.id} style={{ height: 4, borderRadius: 99, background: isSelected ? 'rgba(255,255,255,0.6)' : cancelled ? '#fca5a5' : wc.dot }} />
                            })}
                            {daySchedules.length > 2 && <p style={{ fontSize: 8, color: isSelected ? 'rgba(255,255,255,0.7)' : '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>+{daySchedules.length - 2}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Selected day detail */}
                {selectedDay && schedulesForDay(selectedDay).length > 0 && (
                  <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#fafbfa' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 12 }}>{MONTHS[month]} {selectedDay}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {schedulesForDay(selectedDay).map(s => {
                        const wc = getWasteInfo(s)
                        const cs = confirmStatuses[s.id]
                        const cancelled = s.status === 'cancelled'
                        return (
                          <div key={s.id} style={{ background: 'white', borderRadius: 12, padding: '12px 14px', border: `1px solid ${cancelled ? 'rgba(186,26,26,0.2)' : wc.border}`, opacity: cancelled ? 0.85 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: cancelled ? '#fef2f2' : wc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="msf" style={{ fontSize: 18, color: cancelled ? '#ba1a1a' : wc.color }}>{cancelled ? 'cancel' : wc.icon}</span>
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: cancelled ? '#94a3b8' : '#181c22', fontFamily: 'Manrope,sans-serif', textDecoration: cancelled ? 'line-through' : 'none' }}>{wc.label}</p>
                                  {cancelled && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#fef2f2', color: '#ba1a1a', fontFamily: 'Manrope,sans-serif' }}>CANCELLED</span>}
                                </div>
                                <p style={{ fontSize: 11, color: '#717a6d' }}>{s.collection_time}{s.frequency ? ` · ${FREQUENCIES[s.frequency] || s.frequency}` : ''}</p>
                                {cancelled && s.cancellation_note && <p style={{ fontSize: 11, color: '#ba1a1a', fontStyle: 'italic', marginTop: 3 }}>{s.cancellation_note}</p>}
                                {!cancelled && <StreetsDisplay streets={s.streets} ward={profile?.ward || null} />}
                              </div>
                              {!cancelled && (
                                cs ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: cs === 'confirmed' ? 'rgba(0,69,13,0.08)' : 'rgba(220,38,38,0.08)', color: cs === 'confirmed' ? '#00450d' : '#dc2626', fontFamily: 'Manrope,sans-serif' }}>
                                    {cs === 'confirmed' ? '✓ Ready' : '✗ Unable'}
                                  </span>
                                ) : (
                                  <button onClick={() => confirmHandover(s, 'confirmed')} disabled={confirmingId === s.id} className="confirm-btn" style={{ background: '#00450d', color: 'white' }}>
                                    <span className="msf" style={{ fontSize: 13 }}>thumb_up</span>Ready
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {selectedDay && schedulesForDay(selectedDay).length === 0 && (
                  <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#fafbfa' }}>
                    <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>No collections on {MONTHS[month]} {selectedDay}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* List view */}
          {view === 'list' && (
            <div className="a3 card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22' }}>All Upcoming</h3>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{schedules.length} collections</span>
              </div>
              {schedules.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <span className="msf" style={{ fontSize: 36, color: '#d1d5db', display: 'block', marginBottom: 12 }}>event_busy</span>
                  <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: '#181c22', marginBottom: 6 }}>No schedules published yet</p>
                  <p style={{ fontSize: 13, color: '#94a3b8' }}>Your district engineer will publish schedules soon</p>
                </div>
              ) : schedules.map(s => {
                const wc = getWasteInfo(s)
                const cs = confirmStatuses[s.id]
                const date = new Date(s.scheduled_date)
                const isToday = date.toDateString() === today.toDateString()
                const cancelled = s.status === 'cancelled'
                return (
                  <div key={s.id} style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,69,13,0.04)', background: cancelled ? 'rgba(186,26,26,0.02)' : isToday ? 'rgba(0,69,13,0.02)' : undefined, opacity: cancelled ? 0.85 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      {/* Date block */}
                      <div style={{ width: 44, flexShrink: 0, textAlign: 'center' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: cancelled ? '#ba1a1a' : isToday ? '#00450d' : '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>
                          {cancelled ? 'CNCL' : isToday ? 'TODAY' : date.toLocaleDateString('en-GB', { weekday: 'short' })}
                        </p>
                        <p style={{ fontSize: 22, fontWeight: 800, color: cancelled ? '#94a3b8' : isToday ? '#00450d' : '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1.1 }}>{date.getDate()}</p>
                        <p style={{ fontSize: 10, color: '#94a3b8' }}>{date.toLocaleDateString('en-GB', { month: 'short' })}</p>
                      </div>
                      <div style={{ width: 1, height: 40, background: cancelled ? 'rgba(186,26,26,0.15)' : '#f0f0f0', flexShrink: 0, marginTop: 4 }} />
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: cancelled ? '#fef2f2' : wc.bg, border: `1px solid ${cancelled ? 'rgba(186,26,26,0.2)' : wc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="msf" style={{ fontSize: 18, color: cancelled ? '#ba1a1a' : wc.color }}>{cancelled ? 'cancel' : wc.icon}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: cancelled ? '#94a3b8' : '#181c22', fontFamily: 'Manrope,sans-serif', textDecoration: cancelled ? 'line-through' : 'none', margin: 0 }}>{wc.label}</p>
                          {cancelled && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#fef2f2', color: '#ba1a1a', fontFamily: 'Manrope,sans-serif' }}>CANCELLED</span>}
                        </div>
                        <p style={{ fontSize: 11, color: '#717a6d' }}>{s.collection_time}{s.frequency ? ` · ${FREQUENCIES[s.frequency] || s.frequency}` : ''}</p>
                        {cancelled && s.cancellation_note && <p style={{ fontSize: 11, color: '#ba1a1a', fontStyle: 'italic', marginTop: 3 }}>{s.cancellation_note}</p>}
                        {!cancelled && <StreetsDisplay streets={s.streets} ward={profile?.ward || null} />}
                      </div>
                      {!cancelled && (
                        cs ? (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: cs === 'confirmed' ? 'rgba(0,69,13,0.08)' : 'rgba(220,38,38,0.08)', color: cs === 'confirmed' ? '#00450d' : '#dc2626', fontFamily: 'Manrope,sans-serif', flexShrink: 0 }}>
                            {cs === 'confirmed' ? '✓ Ready' : '✗ Unable'}
                          </span>
                        ) : (
                          <button onClick={() => confirmHandover(s, 'confirmed')} disabled={confirmingId === s.id}
                            className="confirm-btn" style={{ background: '#00450d', color: 'white', flexShrink: 0 }}>
                            <span className="msf" style={{ fontSize: 13 }}>thumb_up</span>Ready
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}