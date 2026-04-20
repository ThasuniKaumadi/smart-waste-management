'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { getWardsForDistrict } from '@/lib/districts'
import { sendNotification } from '@/lib/notify'

const DE_NAV = [
  { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
  { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
  { label: 'History', href: '/dashboard/district-engineer/collection-history', icon: 'history' },
  { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
  { label: 'Heatmap', href: '/dashboard/district-engineer/heatmap', icon: 'thermostat' },
  { label: 'Reports', href: '/dashboard/district-engineer/reports', icon: 'report_problem' },
  { label: 'Incidents', href: '/dashboard/district-engineer/incidents', icon: 'warning' },
  { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
  { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

const WASTE_TYPES = [
  { value: 'organic', label: 'Organic Waste', color: '#00450d', bg: '#f0fdf4', icon: 'compost' },
  { value: 'non_recyclable', label: 'Non-Recyclable', color: '#ba1a1a', bg: '#fef2f2', icon: 'delete' },
  { value: 'recyclable', label: 'Recyclable', color: '#1d4ed8', bg: '#eff6ff', icon: 'recycling' },
  { value: 'e_waste', label: 'E-Waste', color: '#7c3aed', bg: '#f5f3ff', icon: 'computer' },
  { value: 'bulk', label: 'Bulk Waste', color: '#d97706', bg: '#fefce8', icon: 'inventory_2' },
  { value: 'other', label: 'Other', color: '#64748b', bg: '#f8fafc', icon: 'category' },
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_weekly', label: 'Twice a Week' },
  { value: 'weekly', label: 'Once a Week' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
]

interface Schedule {
  id: string; district: string; ward: string; wards: string[]
  waste_type: string; custom_waste_type: string | null
  collection_day: string; collection_time: string
  frequency: string | null; notes: string; published: boolean
  scheduled_date: string; created_at: string; supervisor_id: string | null
  streets: Record<string, string[]> | null; status: string
  cancellation_note: string | null
}

interface Supervisor { id: string; full_name: string; assigned_wards: string[] }

interface RouteAssignment {
  id: string; route_name: string; ward: string; shift: string; status: string
  driver_id: string | null; vehicle_id: string | null; vehicle_number: string | null
  driver_name: string | null; vehicle_plate: string | null
}

// ── Ward multi-select ──────────────────────────────────────────────────────
function WardMultiSelect({ selected, onChange, wards }: {
  selected: string[]; onChange: (w: string[]) => void; wards: string[]
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const filtered = wards.filter(w => w.toLowerCase().includes(q.toLowerCase()))
  const toggle = (w: string) => onChange(selected.includes(w) ? selected.filter(x => x !== w) : [...selected, w])
  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => setOpen(!open)}
        style={{ minHeight: 46, padding: '8px 14px', border: `1.5px solid ${open ? '#00450d' : '#e5e7eb'}`, borderRadius: 10, background: open ? 'white' : '#fafafa', cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', boxSizing: 'border-box', transition: 'all 0.2s', boxShadow: open ? '0 0 0 3px rgba(0,69,13,0.08)' : 'none' }}>
        {selected.length === 0
          ? <span style={{ fontSize: 14, color: '#9ca3af', fontFamily: 'Inter,sans-serif' }}>Select wards</span>
          : selected.map(w => (
            <span key={w} style={{ background: '#00450d', color: 'white', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Manrope,sans-serif' }}>
              {w}<span onClick={e => { e.stopPropagation(); toggle(w) }} style={{ cursor: 'pointer', opacity: 0.7, fontSize: 14, lineHeight: 1 }}>×</span>
            </span>
          ))}
        <span className="msym" style={{ marginLeft: 'auto', fontSize: 18, color: '#94a3b8', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>expand_more</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'white', border: '1px solid rgba(0,69,13,0.12)', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.1)', zIndex: 100, overflow: 'hidden' }}>
          <div style={{ padding: 10 }}>
            <input autoFocus type="text" placeholder="Search wards…" value={q} onChange={e => setQ(e.target.value)} onClick={e => e.stopPropagation()}
              style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: 'Inter,sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.length === 0
              ? <div style={{ padding: 14, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>No wards found</div>
              : filtered.map(ward => (
                <div key={ward} onClick={() => toggle(ward)}
                  style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: selected.includes(ward) ? '#f0fdf4' : 'white', transition: 'background 0.15s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${selected.includes(ward) ? '#00450d' : '#d1d5db'}`, background: selected.includes(ward) ? '#00450d' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {selected.includes(ward) && <svg width="10" height="10" fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span style={{ fontSize: 13, color: selected.includes(ward) ? '#00450d' : '#374151', fontWeight: selected.includes(ward) ? 600 : 400 }}>{ward}</span>
                </div>
              ))}
          </div>
          {selected.length > 0 && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
              <span style={{ fontSize: 12, color: '#717a6d', fontWeight: 600 }}>{selected.length} ward{selected.length !== 1 ? 's' : ''} selected</span>
              <button onClick={e => { e.stopPropagation(); onChange([]) }} style={{ fontSize: 12, color: '#ba1a1a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: 'Manrope,sans-serif' }}>Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Streets entry ──────────────────────────────────────────────────────────
function StreetsEntry({ wards, streets, onChange }: {
  wards: string[]; streets: Record<string, string>; onChange: (s: Record<string, string>) => void
}) {
  if (wards.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {wards.map(ward => (
        <div key={ward}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span className="msym" style={{ fontSize: 14, color: '#00450d' }}>fork_right</span>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>{ward}</label>
          </div>
          <input type="text" className="form-field" placeholder="e.g. Galle Road, Station Road, Marine Drive"
            value={streets[ward] || ''} onChange={e => onChange({ ...streets, [ward]: e.target.value })} />
          {streets[ward] && (
            <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {streets[ward].split(',').map(s => s.trim()).filter(Boolean).map(s => (
                <span key={s} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(0,69,13,0.08)', color: '#00450d', fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>{s}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Cancel modal ───────────────────────────────────────────────────────────
function CancelModal({ schedule, wasteLabel, onConfirm, onClose, saving }: {
  schedule: Schedule; wasteLabel: string
  onConfirm: (note: string) => void; onClose: () => void; saving: boolean
}) {
  const [note, setNote] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 460, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="msym-fill" style={{ color: '#ba1a1a', fontSize: 20 }}>cancel</span>
            </div>
            <div>
              <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: '0 0 3px' }}>Cancel Schedule</h3>
              <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>
                {wasteLabel} · {schedule.collection_day} · {new Date(schedule.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 26px' }}>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)', marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span className="msym" style={{ color: '#ba1a1a', fontSize: 16, flexShrink: 0, marginTop: 1 }}>info</span>
            <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0, lineHeight: 1.5 }}>
              This schedule will be marked as cancelled. Residents and commercial establishments will be notified and will see the cancellation on their schedule view.
            </p>
          </div>

          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>
            Cancellation Note <span style={{ color: '#d1d5db', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Vehicle unavailable due to maintenance. Collection rescheduled for next week."
            rows={3}
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, color: '#181c22', fontFamily: 'Inter,sans-serif', background: '#fafafa', outline: 'none', resize: 'vertical', boxSizing: 'border-box', transition: 'all 0.2s', lineHeight: 1.5 }}
            onFocus={e => { e.target.style.borderColor = '#ba1a1a'; e.target.style.boxShadow = '0 0 0 3px rgba(186,26,26,0.08)' }}
            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        {/* Actions */}
        <div style={{ padding: '0 26px 22px', display: 'flex', gap: 10 }}>
          <button onClick={() => onConfirm(note)} disabled={saving}
            style={{ flex: 1, background: '#ba1a1a', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving ? 0.7 : 1, transition: 'all 0.2s' }}>
            {saving
              ? <><svg style={{ width: 16, height: 16, animation: 'spin .8s linear infinite' }} fill="none" viewBox="0 0 24 24"><circle style={{ opacity: .25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path style={{ opacity: .75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Cancelling…</>
              : <><span className="msym" style={{ fontSize: 16 }}>cancel</span>Cancel Schedule</>}
          </button>
          <button onClick={onClose} disabled={saving}
            style={{ padding: '12px 20px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }}>
            Keep
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DESchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<null | 'draft' | 'publish'>(null)
  const [cancellingSaving, setCancellingSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterWasteType, setFilterWasteType] = useState('all')
  const [wards, setWards] = useState<string[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [selectedWards, setSelectedWards] = useState<string[]>([])
  const [wardStreets, setWardStreets] = useState<Record<string, string>>({})
  const [confirmationCounts, setConfirmationCounts] = useState<Record<string, number>>({})
  const [routeAssignments, setRouteAssignments] = useState<Record<string, RouteAssignment[]>>({})
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Schedule | null>(null)
  const [formData, setFormData] = useState({
    waste_type: '', custom_waste_type: '', collection_day: '',
    collection_time: '08:00', frequency: '', scheduled_date: '', notes: '', supervisor_id: '',
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
      const { data: supData } = await supabase.from('profiles').select('id, full_name, assigned_wards').eq('role', 'supervisor').eq('district', p.district)
      setSupervisors(supData || [])
    }
    const { data: schedulesData } = await supabase
      .from('schedules').select('*').eq('district', p?.district || '').order('created_at', { ascending: false })
    setSchedules(schedulesData || [])
    if (schedulesData?.length) {
      const ids = schedulesData.map((s: any) => s.id)
      const { data: confirmData } = await supabase.from('waste_confirmations').select('schedule_id').in('schedule_id', ids)
      const counts: Record<string, number> = {}
        ; (confirmData || []).forEach((c: any) => { counts[c.schedule_id] = (counts[c.schedule_id] || 0) + 1 })
      setConfirmationCounts(counts)
      const { data: routesData } = await supabase.from('routes')
        .select(`id, route_name, ward, shift, status, schedule_id, driver_id, vehicle_id, vehicle_number, driver:profiles!driver_id(full_name), vehicle:vehicles!vehicle_id(plate_number)`)
        .in('schedule_id', ids)
      const assignments: Record<string, RouteAssignment[]> = {}
        ; (routesData || []).forEach((r: any) => {
          if (!r.schedule_id) return
          if (!assignments[r.schedule_id]) assignments[r.schedule_id] = []
          assignments[r.schedule_id].push({ id: r.id, route_name: r.route_name, ward: r.ward, shift: r.shift, status: r.status, driver_id: r.driver_id, vehicle_id: r.vehicle_id, vehicle_number: r.vehicle_number, driver_name: r.driver?.full_name || null, vehicle_plate: r.vehicle?.plate_number || null })
        })
      setRouteAssignments(assignments)
    }
    setLoading(false)
  }

  function parseStreetsForSave(wards: string[], wardStreets: Record<string, string>) {
    const result: Record<string, string[]> = {}
    wards.forEach(ward => {
      const streets = (wardStreets[ward] || '').split(',').map(s => s.trim()).filter(Boolean)
      if (streets.length) result[ward] = streets
    })
    return result
  }

  function resetForm() {
    setSelectedWards([]); setWardStreets({})
    setFormData({ waste_type: '', custom_waste_type: '', collection_day: '', collection_time: '08:00', frequency: '', scheduled_date: '', notes: '', supervisor_id: '' })
    setMessage('')
  }

  function discard() { resetForm(); setShowForm(false) }

  async function handleSubmit(publishNow: boolean) {
    if (!formData.waste_type) { setMessage('Please select a waste type'); return }
    if (formData.waste_type === 'other' && !formData.custom_waste_type.trim()) { setMessage('Please describe the waste type'); return }
    if (!formData.collection_day) { setMessage('Please select a collection day'); return }
    if (!formData.scheduled_date) { setMessage('Please select a scheduled date'); return }
    setSaving(publishNow ? 'publish' : 'draft'); setMessage('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const streetsJson = parseStreetsForSave(selectedWards, wardStreets)
    const { data: newSchedule, error } = await supabase.from('schedules').insert({
      district: profile?.district,
      wards: selectedWards.length > 0 ? selectedWards : null,
      ward: selectedWards.length === 1 ? selectedWards[0] : null,
      streets: Object.keys(streetsJson).length > 0 ? streetsJson : {},
      waste_type: formData.waste_type,
      custom_waste_type: formData.waste_type === 'other' ? formData.custom_waste_type.trim() : null,
      collection_day: formData.collection_day, collection_time: formData.collection_time,
      frequency: formData.frequency || null, scheduled_date: formData.scheduled_date,
      notes: formData.notes, supervisor_id: formData.supervisor_id || null,
      created_by: user?.id, published: publishNow, status: publishNow ? 'published' : 'draft',
    }).select().single()
    if (error) { setMessage('Error: ' + error.message); setSaving(null); return }
    if (publishNow && newSchedule) {
      const wasteLabel = formData.waste_type === 'other' ? formData.custom_waste_type : WASTE_TYPES.find(w => w.value === formData.waste_type)?.label || formData.waste_type
      const dateStr = new Date(formData.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const wardStr = selectedWards.length > 0 ? selectedWards.join(', ') : profile?.district
      await sendNotification({ roles: ['resident', 'supervisor', 'contractor'], title: `📅 New Collection Schedule — ${wasteLabel}`, body: `${wasteLabel} collection on ${formData.collection_day} ${dateStr} at ${formData.collection_time}. Area: ${wardStr}`, type: 'schedule_published', url: '/dashboard/resident/schedules' })
      if (formData.supervisor_id) await sendNotification({ user_ids: [formData.supervisor_id], title: `📋 Schedule Assigned to You`, body: `You have been assigned to supervise ${wasteLabel} collection on ${formData.collection_day} ${dateStr}.`, type: 'schedule_assigned', url: '/dashboard/supervisor' })
    }
    setMessage(publishNow ? 'Schedule published! Residents and contractors have been notified.' : 'Schedule saved as draft.')
    setShowForm(false); resetForm(); loadData(); setSaving(null)
  }

  async function cancelSchedule(schedule: Schedule, note: string) {
    setCancellingSaving(true)
    const supabase = createClient()
    await supabase.from('schedules').update({
      published: false,
      status: 'cancelled',
      cancellation_note: note.trim() || null,
    }).eq('id', schedule.id)
    // Notify residents and commercial
    const wasteLabel = getWasteLabel(schedule)
    const dateStr = new Date(schedule.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const body = note.trim()
      ? `${wasteLabel} collection on ${dateStr} has been cancelled. Note: ${note.trim()}`
      : `${wasteLabel} collection on ${dateStr} has been cancelled.`
    await sendNotification({
      roles: ['resident', 'supervisor', 'contractor'],
      title: `❌ Collection Cancelled — ${wasteLabel}`,
      body, type: 'schedule_cancelled', url: '/dashboard/resident/schedules',
    })
    setCancellingSaving(false)
    setCancelTarget(null)
    setMessage('Schedule cancelled. Residents and commercial establishments have been notified.')
    loadData()
  }

  async function deleteSchedule(id: string) {
    if (!confirm('Delete this draft? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.from('schedules').delete().eq('id', id)
    loadData()
  }

  async function archiveSchedule(id: string) {
    if (!confirm('Archive this schedule? It will be hidden from view.')) return
    const supabase = createClient()
    await supabase.from('schedules').update({ status: 'archived' }).eq('id', id)
    loadData()
  }

  async function restoreSchedule(id: string) {
    const supabase = createClient()
    await supabase.from('schedules').update({ status: 'draft', published: false, cancellation_note: null }).eq('id', id)
    setMessage('Schedule restored as draft.')
    loadData()
  }

  function getWasteLabel(s: Schedule) {
    if (s.waste_type === 'other' && s.custom_waste_type) return s.custom_waste_type
    return WASTE_TYPES.find(w => w.value === s.waste_type)?.label || s.waste_type
  }

  function getWasteStyle(s: Schedule) {
    return WASTE_TYPES.find(w => w.value === s.waste_type) || WASTE_TYPES[WASTE_TYPES.length - 1]
  }

  function getSupervisorName(id: string | null) {
    if (!id) return null
    return supervisors.find(s => s.id === id)?.full_name || null
  }

  const activeSchedules = schedules.filter(s => s.status !== 'archived')
  const archivedSchedules = schedules.filter(s => s.status === 'archived')

  const displayList = (activeTab === 'archived' ? archivedSchedules : activeSchedules).filter(s => {
    if (filterStatus === 'published' && s.status !== 'published') return false
    if (filterStatus === 'draft' && s.status !== 'draft') return false
    if (filterStatus === 'cancelled' && s.status !== 'cancelled') return false
    if (filterWasteType !== 'all' && s.waste_type !== filterWasteType) return false
    return true
  })

  const publishedCount = activeSchedules.filter(s => s.status === 'published').length
  const draftCount = activeSchedules.filter(s => s.status === 'draft').length
  const cancelledCount = activeSchedules.filter(s => s.status === 'cancelled').length
  const totalConfirmations = Object.values(confirmationCounts).reduce((a, b) => a + b, 0)

  const visibilityNote = () => {
    const area = selectedWards.length > 0
      ? `residents and commercial establishments in ${selectedWards.join(', ')}`
      : `all residents and commercial establishments in ${profile?.district}`
    return `Visible to ${area}`
  }

  return (
    <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}
      primaryAction={{ label: 'New Schedule', href: '#', icon: 'add' }}>
      <style>{`
        .msym { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msym-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:16px; box-shadow:0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.04); border:1px solid rgba(0,69,13,0.06); overflow:hidden; }
        .form-field { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafafa; outline:none; box-sizing:border-box; transition:all 0.2s; }
        .form-field:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .select-field { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafafa; outline:none; cursor:pointer; appearance:none; box-sizing:border-box; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23717a6d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; background-size:14px; transition:all 0.2s; }
        .select-field:focus { border-color:#00450d; background-color:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .field-label { display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#6b7280; font-family:'Manrope',sans-serif; margin-bottom:7px; }
        .pill-btn { padding:6px 16px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .pill-btn.on { background:#00450d; color:white; }
        .pill-btn.off { background:#f1f5f9; color:#64748b; }
        .pill-btn.off:hover { background:#e2e8f0; }
        .tab-btn { padding:8px 20px; border-radius:99px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px; }
        .tab-btn.on { background:#00450d; color:white; }
        .tab-btn.off { background:transparent; color:#64748b; }
        .tab-btn.off:hover { background:#f1f5f9; }
        .btn-publish { background:#00450d; color:white; border:none; border-radius:10px; padding:12px 22px; font-family:'Manrope',sans-serif; font-weight:700; font-size:14px; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; white-space:nowrap; }
        .btn-publish:hover { background:#1b5e20; box-shadow:0 4px 16px rgba(0,69,13,0.25); }
        .btn-publish:disabled { opacity:0.6; cursor:not-allowed; }
        .btn-draft { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.25); border-radius:10px; padding:12px 22px; font-family:'Manrope',sans-serif; font-weight:700; font-size:14px; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; white-space:nowrap; }
        .btn-draft:hover { background:#f0fdf4; }
        .btn-draft:disabled { opacity:0.6; cursor:not-allowed; }
        .btn-discard { background:transparent; color:#94a3b8; border:none; border-radius:10px; padding:12px 16px; font-family:'Manrope',sans-serif; font-weight:600; font-size:14px; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.2s; }
        .btn-discard:hover { color:#64748b; background:#f8fafc; }
        .sched-card { background:white; border-radius:14px; border:1.5px solid rgba(0,69,13,0.07); padding:18px 20px; transition:all 0.2s; }
        .sched-card:hover { border-color:rgba(0,69,13,0.15); box-shadow:0 4px 16px rgba(0,0,0,0.06); }
        .sched-card.cancelled { border-color:rgba(186,26,26,0.15); background:#fffcfc; }
        .sched-card.archived { opacity:0.7; border-style:dashed; }
        .badge { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .divider { height:1px; background:rgba(0,69,13,0.06); margin:14px 0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both} .a3{animation:fadeUp .4s ease .14s both}
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .slide-down { animation:slideDown .25s ease both; }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      {/* Cancel modal */}
      {cancelTarget && (
        <CancelModal
          schedule={cancelTarget}
          wasteLabel={getWasteLabel(cancelTarget)}
          onConfirm={(note) => cancelSchedule(cancelTarget, note)}
          onClose={() => setCancelTarget(null)}
          saving={cancellingSaving}
        />
      )}

      {/* ── Header ── */}
      <section className="mb-8 a1">
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 8 }}>District Engineering · Schedule Management</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 44, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: 0 }}>
              Collection <span style={{ color: '#1b5e20' }}>Schedules</span>
            </h1>
            <p style={{ fontSize: 13, color: '#717a6d', marginTop: 6 }}>{profile?.district} · Waste collection timetables</p>
          </div>
          <button onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12, background: showForm ? '#f1f5f9' : '#00450d', color: showForm ? '#64748b' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, transition: 'all 0.2s' }}>
            <span className="msym" style={{ fontSize: 18 }}>{showForm ? 'close' : 'add'}</span>
            {showForm ? 'Cancel' : 'New Schedule'}
          </button>
        </div>
      </section>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 28 }} className="a2">
        {[
          { label: 'Total', value: activeSchedules.length, icon: 'calendar_month', color: '#00450d', bg: '#f0fdf4', fill: false },
          { label: 'Published', value: publishedCount, icon: 'check_circle', color: '#1b5e20', bg: '#f0fdf4', fill: true },
          { label: 'Drafts', value: draftCount, icon: 'edit_note', color: '#d97706', bg: '#fefce8', fill: false },
          { label: 'Cancelled', value: cancelledCount, icon: 'cancel', color: '#ba1a1a', bg: '#fef2f2', fill: true },
          { label: 'Confirmations', value: totalConfirmations, icon: 'thumb_up', color: '#1d4ed8', bg: '#eff6ff', fill: true },
        ].map(m => (
          <div key={m.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <span className={m.fill ? 'msym-fill' : 'msym'} style={{ color: m.color, fontSize: 17 }}>{m.icon}</span>
            </div>
            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 26, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* ── Message ── */}
      {message && (
        <div className="slide-down" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: message.startsWith('Error') || message.startsWith('Please') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${message.startsWith('Error') || message.startsWith('Please') ? 'rgba(186,26,26,0.2)' : 'rgba(0,69,13,0.15)'}`, color: message.startsWith('Error') || message.startsWith('Please') ? '#ba1a1a' : '#00450d', fontSize: 13 }}>
          <span className="msym-fill" style={{ fontSize: 18 }}>{message.startsWith('Error') || message.startsWith('Please') ? 'error' : 'check_circle'}</span>
          {message}
          <button onClick={() => setMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.5, padding: 0 }}>
            <span className="msym" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>
      )}

      {/* ── Create form ── */}
      {showForm && (
        <div className="card mb-8 slide-down">
          <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 17, color: '#181c22', margin: '0 0 3px' }}>New Schedule</h3>
              <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>
                <span style={{ fontWeight: 600, color: '#00450d' }}>{profile?.district}</span>
                {selectedWards.length > 0 && <> · <span style={{ color: '#374151' }}>{selectedWards.join(', ')}</span></>}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: '#fefce8', border: '1px solid rgba(217,119,6,0.2)' }}>
              <span className="msym" style={{ fontSize: 13, color: '#d97706' }}>edit_note</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', fontFamily: 'Manrope,sans-serif' }}>Draft</span>
            </div>
          </div>
          <div style={{ padding: '24px 28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Wards</label>
                <WardMultiSelect selected={selectedWards} onChange={ws => { setSelectedWards(ws); setWardStreets(prev => { const next: Record<string, string> = {}; ws.forEach(w => { next[w] = prev[w] || '' }); return next }) }} wards={wards} />
                {selectedWards.length === 0 && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}><span className="msym" style={{ fontSize: 13 }}>info</span>Applies to the entire district if no wards selected</p>}
              </div>
              {selectedWards.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="field-label">Streets per ward</label>
                  <StreetsEntry wards={selectedWards} streets={wardStreets} onChange={setWardStreets} />
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Supervisor</label>
                {supervisors.length === 0 ? (
                  <div style={{ padding: '11px 14px', borderRadius: 10, background: '#fefce8', border: '1px solid rgba(217,119,6,0.2)', fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="msym" style={{ fontSize: 16 }}>warning</span>No supervisors in {profile?.district}
                  </div>
                ) : (
                  <select className="select-field" value={formData.supervisor_id} onChange={e => setFormData({ ...formData, supervisor_id: e.target.value })}>
                    <option value="">Select Supervisor</option>
                    {supervisors.map(s => <option key={s.id} value={s.id}>{s.full_name}{s.assigned_wards?.length > 0 ? ` · ${s.assigned_wards.join(', ')}` : ''}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="field-label">Waste Type *</label>
                <select className="select-field" value={formData.waste_type} onChange={e => setFormData({ ...formData, waste_type: e.target.value, custom_waste_type: '' })} required>
                  <option value="">Select waste type</option>
                  {WASTE_TYPES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </div>
              {formData.waste_type === 'other' ? (
                <div>
                  <label className="field-label">Describe Waste Type *</label>
                  <input type="text" className="form-field" placeholder="e.g. Construction debris, Garden waste…"
                    value={formData.custom_waste_type} onChange={e => setFormData({ ...formData, custom_waste_type: e.target.value })} />
                </div>
              ) : (
                <div>
                  <label className="field-label">Scheduled Date *</label>
                  <input type="date" className="form-field" value={formData.scheduled_date} min={new Date().toISOString().split('T')[0]} onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })} required />
                </div>
              )}
              {formData.waste_type === 'other' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="field-label">Scheduled Date *</label>
                  <input type="date" className="form-field" value={formData.scheduled_date} min={new Date().toISOString().split('T')[0]} onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })} required />
                </div>
              )}
              <div>
                <label className="field-label">Collection Day *</label>
                <select className="select-field" value={formData.collection_day} onChange={e => setFormData({ ...formData, collection_day: e.target.value })} required>
                  <option value="">Select day</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Start Time *</label>
                <input type="time" className="form-field" value={formData.collection_time} onChange={e => setFormData({ ...formData, collection_time: e.target.value })} required />
              </div>
              <div>
                <label className="field-label">Frequency</label>
                <select className="select-field" value={formData.frequency} onChange={e => setFormData({ ...formData, frequency: e.target.value })}>
                  <option value="">Select frequency</option>
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Additional Notes</label>
                <input type="text" className="form-field" placeholder="e.g. Please separate organic from inorganic"
                  value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="msym" style={{ color: '#00450d', fontSize: 16, flexShrink: 0 }}>visibility</span>
              <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>{visibilityNote()}</p>
            </div>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" disabled={!!saving} onClick={() => handleSubmit(true)} className="btn-publish">
                {saving === 'publish' ? <><svg style={{ width: 16, height: 16, animation: 'spin .8s linear infinite' }} fill="none" viewBox="0 0 24 24"><circle style={{ opacity: .25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path style={{ opacity: .75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Publishing…</> : <><span className="msym" style={{ fontSize: 18 }}>publish</span>Create and Publish</>}
              </button>
              <button type="button" disabled={!!saving} onClick={() => handleSubmit(false)} className="btn-draft">
                {saving === 'draft' ? <><svg style={{ width: 16, height: 16, animation: 'spin .8s linear infinite' }} fill="none" viewBox="0 0 24 24"><circle style={{ opacity: .25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path style={{ opacity: .75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving…</> : <><span className="msym" style={{ fontSize: 18 }}>save</span>Save as Draft</>}
              </button>
              <button type="button" disabled={!!saving} onClick={discard} className="btn-discard">
                <span className="msym" style={{ fontSize: 16 }}>delete_outline</span>Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="a3">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 99 }}>
            <button onClick={() => { setActiveTab('active'); setFilterStatus('all') }} className={`tab-btn ${activeTab === 'active' ? 'on' : 'off'}`}>
              <span className="msym" style={{ fontSize: 15 }}>event_available</span>Active
              <span style={{ background: activeTab === 'active' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)', color: activeTab === 'active' ? 'white' : '#64748b', padding: '1px 7px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{activeSchedules.length}</span>
            </button>
            <button onClick={() => { setActiveTab('archived'); setFilterStatus('all') }} className={`tab-btn ${activeTab === 'archived' ? 'on' : 'off'}`}>
              <span className="msym" style={{ fontSize: 15 }}>archive</span>Archived
              <span style={{ background: activeTab === 'archived' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)', color: activeTab === 'archived' ? 'white' : '#64748b', padding: '1px 7px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{archivedSchedules.length}</span>
            </button>
          </div>
          {activeTab === 'active' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {([
                { key: 'all', label: 'All' },
                { key: 'published', label: '✓ Published' },
                { key: 'draft', label: '✎ Drafts' },
                { key: 'cancelled', label: '✕ Cancelled' },
              ] as const).map(f => (
                <button key={f.key} onClick={() => setFilterStatus(f.key)} className={`pill-btn ${filterStatus === f.key ? 'on' : 'off'}`}>{f.label}</button>
              ))}
              <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
              <select value={filterWasteType} onChange={e => setFilterWasteType(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: 99, border: 'none', background: filterWasteType !== 'all' ? '#00450d' : '#f1f5f9', color: filterWasteType !== 'all' ? 'white' : '#64748b', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', outline: 'none' }}>
                <option value="all">All Types</option>
                {WASTE_TYPES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
          </div>
        ) : displayList.length === 0 ? (
          <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: activeTab === 'archived' ? '#f8fafc' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <span className="msym" style={{ color: activeTab === 'archived' ? '#94a3b8' : '#00450d', fontSize: 28 }}>{activeTab === 'archived' ? 'archive' : 'calendar_month'}</span>
            </div>
            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', marginBottom: 6 }}>
              {activeTab === 'archived' ? 'No archived schedules' : 'No schedules found'}
            </p>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: activeTab === 'archived' ? 0 : 20 }}>
              {activeTab === 'archived' ? 'Archived schedules will appear here' : `Create the first collection schedule for ${profile?.district}`}
            </p>
            {activeTab === 'active' && filterStatus === 'all' && (
              <button onClick={() => setShowForm(true)} className="btn-publish" style={{ margin: '0 auto' }}>
                <span className="msym" style={{ fontSize: 18 }}>add</span>New Schedule
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayList.map(schedule => {
              const waste = getWasteStyle(schedule)
              const wasteLabel = getWasteLabel(schedule)
              const supName = getSupervisorName(schedule.supervisor_id)
              const scheduleWards = schedule.wards?.length > 0 ? schedule.wards : schedule.ward ? [schedule.ward] : []
              const confirmCount = confirmationCounts[schedule.id] || 0
              const routes = routeAssignments[schedule.id] || []
              const unassigned = routes.filter(r => !r.driver_id || (!r.vehicle_id && !r.vehicle_number)).length
              const isExpanded = expandedSchedule === schedule.id
              const streetsData = schedule.streets as Record<string, string[]> | null
              const streetCount = streetsData ? Object.values(streetsData).flat().length : 0
              const isArchived = schedule.status === 'archived'
              const isCancelled = schedule.status === 'cancelled'
              const isDraft = schedule.status === 'draft'
              const isPublished = schedule.status === 'published'

              return (
                <div key={schedule.id} className={`sched-card ${isArchived ? 'archived' : ''} ${isCancelled ? 'cancelled' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    {/* Icon */}
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: isCancelled ? '#fef2f2' : waste.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <span className="msym-fill" style={{ color: isCancelled ? '#ba1a1a' : waste.color, fontSize: 20 }}>
                        {isCancelled ? 'cancel' : waste.icon}
                      </span>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: isCancelled ? '#94a3b8' : '#181c22', fontFamily: 'Manrope,sans-serif', textDecoration: isCancelled ? 'line-through' : 'none' }}>{wasteLabel}</span>

                        {/* Status badge */}
                        {isArchived && <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}><span className="msym" style={{ fontSize: 11 }}>archive</span>Archived</span>}
                        {isCancelled && <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}><span className="msym-fill" style={{ fontSize: 11 }}>cancel</span>Cancelled</span>}
                        {isPublished && <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}><span className="msym-fill" style={{ fontSize: 11 }}>check_circle</span>Published</span>}
                        {isDraft && <span className="badge" style={{ background: '#fefce8', color: '#d97706' }}><span className="msym" style={{ fontSize: 11 }}>edit_note</span>Draft</span>}

                        {supName && <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed' }}><span className="msym" style={{ fontSize: 11 }}>person</span>{supName}</span>}
                        {routes.length > 0 && !isCancelled && (
                          <span className="badge" style={{ background: unassigned > 0 ? '#fef2f2' : '#f0fdf4', color: unassigned > 0 ? '#ba1a1a' : '#00450d' }}>
                            <span className="msym" style={{ fontSize: 11 }}>{unassigned > 0 ? 'warning' : 'check_circle'}</span>
                            {unassigned > 0 ? `${unassigned} unassigned` : `${routes.length} route${routes.length !== 1 ? 's' : ''} staffed`}
                          </span>
                        )}
                      </div>

                      {/* Meta */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 12, color: isCancelled ? '#94a3b8' : '#717a6d' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="msym" style={{ fontSize: 13 }}>calendar_today</span>{schedule.collection_day} · {schedule.collection_time}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="msym" style={{ fontSize: 13 }}>event</span>{new Date(schedule.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {scheduleWards.length > 0
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="msym" style={{ fontSize: 13 }}>location_on</span>{scheduleWards.join(', ')}</span>
                          : <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="msym" style={{ fontSize: 13 }}>map</span>All wards</span>}
                        {schedule.frequency && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="msym" style={{ fontSize: 13 }}>repeat</span>{FREQUENCIES.find(f => f.value === schedule.frequency)?.label || schedule.frequency}</span>}
                        {streetCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isCancelled ? '#94a3b8' : '#00450d', fontWeight: 600 }}><span className="msym" style={{ fontSize: 13 }}>fork_right</span>{streetCount} street{streetCount !== 1 ? 's' : ''}</span>}
                        {schedule.notes && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontStyle: 'italic' }}><span className="msym" style={{ fontSize: 13 }}>notes</span>{schedule.notes}</span>}
                      </div>

                      {/* Street chips */}
                      {streetsData && streetCount > 0 && !isCancelled && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {Object.values(streetsData).flat().map(street => (
                            <span key={street} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(0,69,13,0.07)', color: '#00450d', fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>{street}</span>
                          ))}
                        </div>
                      )}

                      {/* Cancellation note */}
                      {isCancelled && schedule.cancellation_note && (
                        <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid rgba(186,26,26,0.12)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span className="msym" style={{ fontSize: 13, color: '#ba1a1a', flexShrink: 0, marginTop: 1 }}>info</span>
                          <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0, lineHeight: 1.4 }}>{schedule.cancellation_note}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {confirmCount > 0 && !isCancelled && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 99, background: '#eff6ff' }}>
                          <span className="msym-fill" style={{ fontSize: 13, color: '#1d4ed8' }}>thumb_up</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', fontFamily: 'Manrope,sans-serif' }}>{confirmCount}</span>
                        </div>
                      )}

                      {/* Routes expand — not for cancelled */}
                      {routes.length > 0 && !isCancelled && (
                        <button onClick={() => setExpandedSchedule(isExpanded ? null : schedule.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 99, border: `1.5px solid ${isExpanded ? '#00450d' : 'rgba(0,69,13,0.15)'}`, background: isExpanded ? '#00450d' : 'white', color: isExpanded ? 'white' : '#00450d', fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', transition: 'all 0.2s' }}>
                          <span className="msym" style={{ fontSize: 14 }}>route</span>{routes.length}
                          <span className="msym" style={{ fontSize: 14, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                        </button>
                      )}

                      {/* Archived → Restore */}
                      {isArchived && (
                        <button onClick={() => restoreSchedule(schedule.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 99, border: '1.5px solid rgba(0,69,13,0.2)', color: '#00450d', background: 'white', fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer' }}>
                          <span className="msym" style={{ fontSize: 13 }}>restore</span>Restore
                        </button>
                      )}

                      {/* Cancelled → Restore */}
                      {isCancelled && (
                        <button onClick={() => restoreSchedule(schedule.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 99, border: '1.5px solid rgba(0,69,13,0.2)', color: '#00450d', background: 'white', fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer' }}>
                          <span className="msym" style={{ fontSize: 13 }}>restore</span>Restore
                        </button>
                      )}

                      {/* Draft → Publish + Delete */}
                      {isDraft && (
                        <>
                          <button onClick={() => {
                            const supabase = createClient()
                            supabase.from('schedules').update({ published: true, status: 'published' }).eq('id', schedule.id).then(() => loadData())
                          }} style={{ padding: '6px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', border: '1.5px solid rgba(0,69,13,0.2)', color: '#00450d', background: 'white', transition: 'all 0.2s' }}>
                            Publish
                          </button>
                          <button onClick={() => deleteSchedule(schedule.id)}
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid rgba(186,26,26,0.2)', background: '#fef2f2', color: '#ba1a1a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msym" style={{ fontSize: 15 }}>delete</span>
                          </button>
                        </>
                      )}

                      {/* Published → Cancel + Archive */}
                      {isPublished && (
                        <>
                          <button onClick={() => setCancelTarget(schedule)}
                            style={{ padding: '6px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', border: '1.5px solid rgba(186,26,26,0.2)', color: '#ba1a1a', background: 'white', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="msym" style={{ fontSize: 13 }}>cancel</span>Cancel
                          </button>
                          <button onClick={() => archiveSchedule(schedule.id)}
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid rgba(100,116,139,0.2)', background: '#f8fafc', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            title="Archive">
                            <span className="msym" style={{ fontSize: 15 }}>archive</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded routes */}
                  {isExpanded && routes.length > 0 && (
                    <div className="slide-down" style={{ marginTop: 14 }}>
                      <div className="divider" />
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 8, paddingLeft: 4 }}>Route assignments — staffed by contractor</p>
                      {routes.map(route => (
                        <div key={route.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 10, background: '#f9fdf9', marginBottom: 6, border: '1px solid rgba(0,69,13,0.07)' }}>
                          <span className="msym" style={{ fontSize: 16, color: '#00450d', flexShrink: 0 }}>route</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>{route.route_name}</p>
                            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#94a3b8', flexWrap: 'wrap' }}>
                              {route.ward && <span>📍 {route.ward}</span>}
                              {route.shift && <span>{route.shift === 'night' ? '🌙' : '☀️'} {route.shift}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <span className="badge" style={{ background: route.driver_id ? '#f0fdf4' : '#fef2f2', color: route.driver_id ? '#00450d' : '#ba1a1a' }}>
                              <span className="msym" style={{ fontSize: 11 }}>person</span>{route.driver_name || 'No driver'}
                            </span>
                            <span className="badge" style={{ background: (route.vehicle_id || route.vehicle_number) ? '#f0fdf4' : '#fef2f2', color: (route.vehicle_id || route.vehicle_number) ? '#00450d' : '#ba1a1a' }}>
                              <span className="msym" style={{ fontSize: 11 }}>local_shipping</span>{route.vehicle_plate || route.vehicle_number || 'No vehicle'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'active' && schedules.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: '#f9fdf9', border: '1px solid rgba(0,69,13,0.08)' }}>
            <span className="msym" style={{ color: '#00450d', fontSize: 15, flexShrink: 0 }}>campaign</span>
            <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>
              Publishing notifies residents, commercial establishments, supervisors and contractors in <strong style={{ color: '#374151' }}>{profile?.district}</strong>. Cancelling notifies all users with the reason provided. Published schedules can be cancelled or archived but not deleted.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}