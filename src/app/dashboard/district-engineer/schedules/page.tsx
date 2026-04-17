'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { getWardsForDistrict } from '@/lib/districts'
import { sendNotification } from '@/lib/notify'

const DE_NAV = [
  { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
  { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
  { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
  { label: 'Complaints', href: '/dashboard/district-engineer/complaints', icon: 'feedback' },
  { label: 'Waste Reports', href: '/dashboard/district-engineer/waste-reports', icon: 'report' },
  { label: 'Incidents', href: '/dashboard/district-engineer/incidents', icon: 'warning' },
  { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
  { label: 'Zones', href: '/dashboard/district-engineer/zones', icon: 'map' },
  { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

const WASTE_TYPES = [
  { value: 'organic', label: 'Organic Waste', color: '#00450d', bg: '#f0fdf4' },
  { value: 'non_recyclable', label: 'Non-Recyclable', color: '#ba1a1a', bg: '#fef2f2' },
  { value: 'recyclable', label: 'Recyclable', color: '#1d4ed8', bg: '#eff6ff' },
  { value: 'e_waste', label: 'E-Waste', color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'bulk', label: 'Bulk Waste', color: '#d97706', bg: '#fefce8' },
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_weekly', label: 'Twice a Week' },
  { value: 'weekly', label: 'Once a Week' },
]

interface Schedule {
  id: string; district: string; ward: string; wards: string[]
  waste_type: string; collection_day: string; collection_time: string
  frequency: string; notes: string; published: boolean
  scheduled_date: string; created_at: string; supervisor_id: string | null
}

interface Supervisor {
  id: string; full_name: string; district: string; assigned_wards: string[]
}

function WardMultiSelect({ selected, onChange, wards }: {
  selected: string[]; onChange: (wards: string[]) => void; wards: string[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const filtered = wards.filter(w => w.toLowerCase().includes(query.toLowerCase()))

  function toggle(ward: string) {
    onChange(selected.includes(ward) ? selected.filter(w => w !== ward) : [...selected, ward])
  }

  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => setOpen(!open)} style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', color: '#181c22', fontFamily: 'Inter, sans-serif', background: '#fafafa', cursor: 'pointer', minHeight: '44px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', boxSizing: 'border-box' }}>
        {selected.length === 0
          ? <span style={{ color: '#9ca3af' }}>Select wards (all wards if empty)</span>
          : selected.map(w => (
            <span key={w} style={{ background: '#f0fdf4', color: '#00450d', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'Manrope, sans-serif' }}>
              {w}
              <span onClick={e => { e.stopPropagation(); toggle(w) }} style={{ cursor: 'pointer', opacity: 0.6 }}>×</span>
            </span>
          ))}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid rgba(0,69,13,0.1)', borderRadius: '12px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: '220px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
            <input type="text" placeholder="Search wards..." value={query} onChange={e => setQuery(e.target.value)} onClick={e => e.stopPropagation()} style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0
              ? <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No wards found</div>
              : filtered.map(ward => (
                <div key={ward} onClick={() => toggle(ward)} style={{ padding: '9px 14px', fontSize: '13px', fontFamily: 'Inter, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: selected.includes(ward) ? '#f0fdf4' : 'white', color: selected.includes(ward) ? '#00450d' : '#181c22' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${selected.includes(ward) ? '#00450d' : '#e5e7eb'}`, background: selected.includes(ward) ? '#00450d' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selected.includes(ward) && <svg style={{ width: '9px', height: '9px' }} fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  {ward}
                </div>
              ))}
          </div>
          {selected.length > 0 && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#717a6d' }}>{selected.length} selected</span>
              <button onClick={e => { e.stopPropagation(); onChange([]) }} style={{ fontSize: '12px', color: '#ba1a1a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DESchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterWasteType, setFilterWasteType] = useState('all')
  const [wards, setWards] = useState<string[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [selectedWards, setSelectedWards] = useState<string[]>([])
  const [confirmationCounts, setConfirmationCounts] = useState<Record<string, number>>({})
  const [formData, setFormData] = useState({
    waste_type: '', collection_day: '', collection_time: '08:00',
    frequency: 'weekly', scheduled_date: '', notes: '', supervisor_id: '',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    if (p?.district) {
      setWards(getWardsForDistrict(p.district))
      const { data: supData } = await supabase.from('profiles').select('id, full_name, district, assigned_wards').eq('role', 'supervisor').eq('district', p.district)
      setSupervisors(supData || [])
    }

    const { data: schedulesData } = await supabase
      .from('schedules').select('*')
      .eq('district', p?.district || '')
      .order('created_at', { ascending: false })
    setSchedules(schedulesData || [])

    // Load confirmation counts per schedule — R5 waste handover
    if (schedulesData && schedulesData.length > 0) {
      const { data: confirmData } = await supabase
        .from('waste_confirmations')
        .select('schedule_id')
        .in('schedule_id', schedulesData.map((s: any) => s.id))
      const counts: Record<string, number> = {}
        ; (confirmData || []).forEach((c: any) => {
          counts[c.schedule_id] = (counts[c.schedule_id] || 0) + 1
        })
      setConfirmationCounts(counts)
    }

    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.waste_type) { setMessage('Please select a waste type'); return }
    if (!formData.collection_day) { setMessage('Please select a collection day'); return }
    if (!formData.scheduled_date) { setMessage('Please select a scheduled date'); return }
    setSaving(true); setMessage('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('schedules').insert({
      district: profile?.district,
      wards: selectedWards.length > 0 ? selectedWards : null,
      ward: selectedWards.length === 1 ? selectedWards[0] : null,
      waste_type: formData.waste_type, collection_day: formData.collection_day,
      collection_time: formData.collection_time, frequency: formData.frequency,
      scheduled_date: formData.scheduled_date, notes: formData.notes,
      supervisor_id: formData.supervisor_id || null, created_by: user?.id,
      published: false, status: 'draft',
    })
    if (error) { setMessage('Error: ' + error.message) }
    else {
      setMessage('Schedule created successfully!')
      setShowForm(false); setSelectedWards([])
      setFormData({ waste_type: '', collection_day: '', collection_time: '08:00', frequency: 'weekly', scheduled_date: '', notes: '', supervisor_id: '' })
      loadData()
    }
    setSaving(false)
  }

  async function togglePublish(schedule: Schedule) {
    const supabase = createClient()
    const publishing = !schedule.published
    await supabase.from('schedules').update({ published: publishing, status: publishing ? 'published' : 'draft' }).eq('id', schedule.id)

    if (publishing) {
      const wasteLabel = WASTE_TYPES.find(w => w.value === schedule.waste_type)?.label || schedule.waste_type
      const dateStr = new Date(schedule.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const wardStr = schedule.wards?.length > 0 ? schedule.wards.join(', ') : schedule.ward || profile?.district
      await sendNotification({
        roles: ['resident', 'supervisor', 'contractor'],
        title: `📅 New Collection Schedule — ${wasteLabel}`,
        body: `${wasteLabel} collection on ${schedule.collection_day} ${dateStr} at ${schedule.collection_time}. Area: ${wardStr}`,
        type: 'schedule_published', url: '/dashboard/resident/schedules',
      })
      if (schedule.supervisor_id) {
        await sendNotification({
          user_ids: [schedule.supervisor_id],
          title: `📋 Schedule Assigned to You`,
          body: `You have been assigned to supervise ${wasteLabel} collection on ${schedule.collection_day} ${dateStr}.`,
          type: 'schedule_assigned', url: '/dashboard/supervisor',
        })
      }
    }
    loadData()
  }

  async function deleteSchedule(id: string) {
    if (!confirm('Are you sure?')) return
    const supabase = createClient()
    await supabase.from('schedules').delete().eq('id', id)
    loadData()
  }

  const filtered = schedules.filter(s => {
    if (filterStatus === 'published' && !s.published) return false
    if (filterStatus === 'draft' && s.published) return false
    if (filterWasteType !== 'all' && s.waste_type !== filterWasteType) return false
    return true
  })

  const publishedCount = schedules.filter(s => s.published).length
  const draftCount = schedules.filter(s => !s.published).length
  const totalConfirmations = Object.values(confirmationCounts).reduce((a, b) => a + b, 0)

  function getWasteStyle(value: string) {
    return WASTE_TYPES.find(w => w.value === value) || { label: value, color: '#64748b', bg: '#f8fafc' }
  }

  function getSupervisorName(id: string | null) {
    if (!id) return null
    return supervisors.find(s => s.id === id)?.full_name || null
  }

  return (
    <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV} primaryAction={{ label: 'New Schedule', href: '#', icon: 'add' }}>
      <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .form-field { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafafa; transition:all 0.2s ease; outline:none; box-sizing:border-box; }
        .form-field:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .select-field { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafafa; transition:all 0.2s ease; outline:none; cursor:pointer; appearance:none; box-sizing:border-box; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23717a6d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; background-size:14px; }
        .select-field:focus { border-color:#00450d; background-color:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .filter-btn { padding:6px 16px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s ease; }
        .filter-btn.active { background:#00450d; color:white; }
        .filter-btn:not(.active) { background:#f1f5f9; color:#64748b; }
        .filter-btn:not(.active):hover { background:#e2e8f0; }
        .schedule-row { padding:20px 24px; border-bottom:1px solid rgba(0,69,13,0.04); transition:background 0.2s ease; display:flex; align-items:center; gap:16px; }
        .schedule-row:hover { background:#f9f9ff; }
        .schedule-row:last-child { border-bottom:none; }
        .action-btn { padding:7px 14px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.2s ease; border:1.5px solid; white-space:nowrap; }
        .publish-btn { border-color:rgba(0,69,13,0.2); color:#00450d; background:white; }
        .publish-btn:hover { background:#00450d; color:white; }
        .unpublish-btn { border-color:rgba(217,119,6,0.2); color:#d97706; background:white; }
        .unpublish-btn:hover { background:#d97706; color:white; }
        .delete-btn { border-color:rgba(186,26,26,0.2); color:#ba1a1a; background:white; }
        .delete-btn:hover { background:#ba1a1a; color:white; }
        .submit-btn { background:#00450d; color:white; border:none; border-radius:10px; padding:13px 24px; font-family:'Manrope',sans-serif; font-weight:700; font-size:14px; cursor:pointer; transition:all 0.2s ease; display:flex; align-items:center; gap:8px; }
        .submit-btn:hover { background:#1b5e20; box-shadow:0 4px 16px rgba(0,69,13,0.25); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .field-label { display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#374151; font-family:'Manrope',sans-serif; margin-bottom:7px; }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1{animation:staggerIn 0.5s ease 0.05s both} .s2{animation:staggerIn 0.5s ease 0.1s both} .s3{animation:staggerIn 0.5s ease 0.15s both}
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .slide-down { animation:slideDown 0.3s ease both; }
      `}</style>

      <section className="mb-10 s1">
        <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>District Engineering · Schedule Management</span>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
              Collection <span style={{ color: '#1b5e20' }}>Schedules</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
              {profile?.district || 'Your District'} · Managing waste collection timetables
            </p>
          </div>
          <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: showForm ? '#f1f5f9' : '#00450d', color: showForm ? '#64748b' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s ease' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showForm ? 'close' : 'add'}</span>
            {showForm ? 'Cancel' : 'New Schedule'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
        {[
          { label: 'Total Schedules', value: schedules.length, icon: 'calendar_month', color: '#00450d', bg: '#f0fdf4' },
          { label: 'Published', value: publishedCount, icon: 'check_circle', color: '#1b5e20', bg: '#f0fdf4' },
          { label: 'Drafts', value: draftCount, icon: 'edit_note', color: '#d97706', bg: '#fefce8' },
          { label: 'Confirmations', value: totalConfirmations, icon: 'thumb_up', color: '#1d4ed8', bg: '#eff6ff' },
        ].map(m => (
          <div key={m.label} className="bento-card p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: m.bg }}>
              <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '18px' }}>{m.icon}</span>
            </div>
            <p className="font-headline font-extrabold text-2xl tracking-tight mb-0.5" style={{ color: '#181c22' }}>{m.value}</p>
            <p className="text-xs font-bold uppercase" style={{ letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>{m.label}</p>
          </div>
        ))}
      </div>

      {message && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl text-sm s2"
          style={{ background: message.startsWith('Error') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${message.startsWith('Error') ? 'rgba(186,26,26,0.2)' : 'rgba(0,69,13,0.15)'}`, color: message.startsWith('Error') ? '#ba1a1a' : '#00450d' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
          {message}
        </div>
      )}

      {showForm && (
        <div className="bento-card mb-8 s2 slide-down">
          <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Create New Schedule</h3>
            <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
              District: <span style={{ fontWeight: 700, color: '#00450d' }}>{profile?.district}</span>
              {selectedWards.length > 0 && <> · Wards: <span style={{ fontWeight: 700, color: '#00450d' }}>{selectedWards.join(', ')}</span></>}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="field-label">Wards <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — leave blank for entire district)</span></label>
                <WardMultiSelect selected={selectedWards} onChange={setSelectedWards} wards={wards} />
              </div>
              <div className="md:col-span-2">
                <label className="field-label">Assign Supervisor <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                {supervisors.length === 0 ? (
                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#fefce8', border: '1px solid rgba(217,119,6,0.2)', fontSize: '13px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>warning</span>
                    No supervisors found in {profile?.district}.
                  </div>
                ) : (
                  <select className="select-field" value={formData.supervisor_id} onChange={e => setFormData({ ...formData, supervisor_id: e.target.value })}>
                    <option value="">— No supervisor assigned —</option>
                    {supervisors.map(s => <option key={s.id} value={s.id}>{s.full_name}{s.assigned_wards?.length > 0 ? ` (${s.assigned_wards.join(', ')})` : ' (all wards)'}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="field-label">Waste Type *</label>
                <select className="select-field" value={formData.waste_type} onChange={e => setFormData({ ...formData, waste_type: e.target.value })} required>
                  <option value="">Select waste type</option>
                  {WASTE_TYPES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Scheduled Date *</label>
                <input type="date" className="form-field" value={formData.scheduled_date} min={new Date().toISOString().split('T')[0]} onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })} required />
              </div>
              <div>
                <label className="field-label">Collection Day *</label>
                <select className="select-field" value={formData.collection_day} onChange={e => setFormData({ ...formData, collection_day: e.target.value })} required>
                  <option value="">Select day</option>
                  {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Collection Time *</label>
                <input type="time" className="form-field" value={formData.collection_time} onChange={e => setFormData({ ...formData, collection_time: e.target.value })} required />
              </div>
              <div>
                <label className="field-label">Frequency *</label>
                <select className="select-field" value={formData.frequency} onChange={e => setFormData({ ...formData, frequency: e.target.value })}>
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="field-label">Notes for Residents (Optional)</label>
                <input type="text" className="form-field" placeholder="Any additional information..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl mt-5" style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
              <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>info</span>
              <p className="text-sm" style={{ color: '#41493e' }}>
                {selectedWards.length > 0 ? <>Visible to residents in wards: <strong style={{ color: '#00450d' }}>{selectedWards.join(', ')}</strong></> : <>Visible to <strong style={{ color: '#00450d' }}>all residents</strong> in {profile?.district}</>}
                {formData.supervisor_id && supervisors.find(s => s.id === formData.supervisor_id) && <> · Supervisor: <strong style={{ color: '#00450d' }}>{supervisors.find(s => s.id === formData.supervisor_id)?.full_name}</strong></>}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button type="submit" disabled={saving} className="submit-btn">
                {saving ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</> : <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_circle</span>Create Schedule</>}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '13px 24px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: '#64748b' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bento-card s3">
        <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
          <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>All Schedules</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {['all', 'published', 'draft'].map(f => (
              <button key={f} onClick={() => setFilterStatus(f)} className={`filter-btn ${filterStatus === f ? 'active' : ''}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
            ))}
            <div style={{ width: '1px', height: '20px', background: 'rgba(0,69,13,0.1)' }} />
            <select className="filter-btn" style={{ appearance: 'none', paddingRight: '12px', background: filterWasteType !== 'all' ? '#00450d' : '#f1f5f9', color: filterWasteType !== 'all' ? 'white' : '#64748b', border: 'none', cursor: 'pointer' }} value={filterWasteType} onChange={e => setFilterWasteType(e.target.value)}>
              <option value="all">All Types</option>
              {WASTE_TYPES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
              <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>calendar_month</span>
            </div>
            <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No schedules found</p>
            <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>Create your first collection schedule</p>
            <button onClick={() => setShowForm(true)} className="submit-btn" style={{ width: 'auto' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>New Schedule</button>
          </div>
        ) : (
          <div>
            {filtered.map(schedule => {
              const waste = getWasteStyle(schedule.waste_type)
              const supName = getSupervisorName(schedule.supervisor_id)
              const scheduleWards = schedule.wards?.length > 0 ? schedule.wards : schedule.ward ? [schedule.ward] : []
              const confirmCount = confirmationCounts[schedule.id] || 0
              return (
                <div key={schedule.id} className="schedule-row">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: waste.bg }}>
                    <span className="material-symbols-outlined" style={{ color: waste.color, fontSize: '18px' }}>delete_sweep</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-sm font-bold" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{waste.label}</p>
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: '99px', background: schedule.published ? '#f0fdf4' : '#fefce8', color: schedule.published ? '#00450d' : '#d97706', fontFamily: 'Manrope, sans-serif' }}>
                        {schedule.published ? '✓ Published' : 'Draft'}
                      </span>
                      {supName && <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: '99px', background: 'rgba(124,58,237,0.08)', color: '#7c3aed', fontFamily: 'Manrope, sans-serif' }}>{supName}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: '#94a3b8' }}>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>{schedule.collection_day} at {schedule.collection_time}</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>event</span>{new Date(schedule.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {scheduleWards.length > 0 ? <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>{scheduleWards.join(', ')}</span> : <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>map</span>All wards</span>}
                      {schedule.notes && <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>info</span>{schedule.notes}</span>}
                    </div>
                  </div>
                  {/* Confirmation count badge */}
                  {confirmCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '99px', background: 'rgba(29,78,216,0.08)', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#1d4ed8', fontVariationSettings: "'FILL' 1" }}>thumb_up</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', fontFamily: 'Manrope, sans-serif' }}>{confirmCount} confirmed</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => togglePublish(schedule)} className={`action-btn ${schedule.published ? 'unpublish-btn' : 'publish-btn'}`}>{schedule.published ? 'Unpublish' : 'Publish'}</button>
                    <button onClick={() => deleteSchedule(schedule.id)} className="action-btn delete-btn">Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="px-8 py-4 flex items-center gap-3" style={{ borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff' }}>
          <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>notifications_active</span>
          <p className="text-xs" style={{ color: '#717a6d' }}>
            Publishing a schedule sends a push notification to all residents, supervisors and contractors in <strong>{profile?.district}</strong>.
            Residents can confirm waste handover — counts appear as blue badges.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}