'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { logComplaintOnChain } from '@/lib/blockchain'

const RESIDENT_NAV = [
  { label: 'Overview', href: '/dashboard/resident', icon: 'dashboard' },
  { label: 'Schedule', href: '/dashboard/resident/schedule', icon: 'calendar_today' },
  { label: 'Track Vehicle', href: '/dashboard/resident/track', icon: 'location_on' },
  { label: 'Report Issue', href: '/dashboard/resident/report-dumping', icon: 'report_problem' },
  { label: 'Complaints', href: '/dashboard/resident/complaints', icon: 'feedback' },
]

const COMPLAINT_TYPES = [
  { value: 'missed_collection', label: 'Missed Collection', icon: 'delete' },
  { value: 'delayed_collection', label: 'Delayed Collection', icon: 'schedule' },
  { value: 'illegal_dumping', label: 'Illegal Dumping', icon: 'delete_forever' },
  { value: 'blocked_drainage', label: 'Blocked Drainage by Waste', icon: 'water_damage' },
  { value: 'collection_refusal', label: 'Collection Refusal', icon: 'block' },
  { value: 'other', label: 'Other', icon: 'more_horiz' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: 'Submitted', color: '#b45309', bg: 'rgba(180,83,9,0.08)' },
  in_progress: { label: 'In Progress', color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)' },
  resolved: { label: 'Resolved', color: '#15803d', bg: 'rgba(21,128,61,0.08)' },
}

interface Complaint {
  id: string
  description: string
  complaint_type: string
  status: string
  blockchain_tx: string
  created_at: string
}

export default function ResidentComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [formData, setFormData] = useState({ complaint_type: '', description: '' })

  useEffect(() => { loadData() }, [])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 3500)
  }

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    const { data } = await supabase.from('complaints').select('*')
      .eq('submitted_by', user.id).order('created_at', { ascending: false })
    setComplaints(data || [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.complaint_type || !formData.description) {
      showToast('Please fill in all fields', 'error'); return
    }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: complaintData, error } = await supabase.from('complaints').insert({
      submitted_by: user?.id,
      district: profile?.district,
      complaint_type: formData.complaint_type,
      description: formData.description,
      status: 'submitted',
    }).select().single()

    if (!error && complaintData) {
      const txHash = await logComplaintOnChain(complaintData.id, profile?.district || '')
      if (txHash) {
        await supabase.from('complaints').update({ blockchain_tx: txHash }).eq('id', complaintData.id)
      }
    }

    if (error) {
      showToast('Error: ' + error.message, 'error')
    } else {
      showToast('Complaint submitted successfully!')
      setShowForm(false)
      setFormData({ complaint_type: '', description: '' })
      loadData()
    }
    setSaving(false)
  }

  return (
    <DashboardLayout
      role="Resident"
      userName={profile?.full_name || ''}
      navItems={RESIDENT_NAV}
      primaryAction={{ label: 'New Complaint', href: '#', icon: 'add' }}
    >
      <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .complaint-type-card { border:1.5px solid #e4ede4; border-radius:12px; padding:14px; cursor:pointer; transition:all 0.2s ease; background:#f9fbf9; }
        .complaint-type-card:hover { border-color:rgba(0,69,13,0.3); background:white; }
        .complaint-type-card.selected { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.07); }
        .form-field { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafafa; transition:all 0.2s ease; outline:none; box-sizing:border-box; }
        .form-field:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .form-field::placeholder { color:#9ca3af; }
        .submit-btn { background:#00450d; color:white; border:none; border-radius:10px; padding:13px 24px; font-family:'Manrope',sans-serif; font-weight:700; font-size:14px; cursor:pointer; transition:all 0.2s ease; display:flex; align-items:center; gap:8px; }
        .submit-btn:hover { background:#1b5e20; box-shadow:0 4px 16px rgba(0,69,13,0.25); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .complaint-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); transition:background 0.15s; display:flex; align-items:flex-start; gap:14px; }
        .complaint-row:hover { background:#f9f9ff; }
        .complaint-row:last-child { border-bottom:none; }
        .toast { animation:slideUp 0.3s ease; }
        @keyframes slideUp { from { transform:translateY(12px) translateX(-50%); opacity:0; } to { transform:translateY(0) translateX(-50%); opacity:1; } }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1 { animation:staggerIn 0.5s ease 0.05s both; }
        .s2 { animation:staggerIn 0.5s ease 0.10s both; }
        .s3 { animation:staggerIn 0.5s ease 0.15s both; }
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .slide-down { animation:slideDown 0.3s ease both; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className="toast" style={{ position: 'fixed', bottom: '24px', left: '50%', background: toastType === 'error' ? '#dc2626' : '#181c22', color: 'white', padding: '10px 20px', borderRadius: '9999px', fontSize: '13px', fontWeight: 500, zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: toastType === 'error' ? '#fca5a5' : '#4ade80' }}>{toastType === 'error' ? 'error' : 'check_circle'}</span>
          {toast}
        </div>
      )}

      {/* Hero */}
      <section className="mb-10 s1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>Resident Portal</span>
            <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
              My <span style={{ color: '#1b5e20' }}>Complaints</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: '#717a6d' }}>{profile?.district || 'CMC District'}</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: showForm ? '#f1f5f9' : '#00450d', color: showForm ? '#64748b' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showForm ? 'close' : 'add'}</span>
            {showForm ? 'Cancel' : 'New Complaint'}
          </button>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-8 s2">
        {[
          { label: 'Total', value: complaints.length, color: '#00450d', bg: '#f0fdf4', icon: 'feedback' },
          { label: 'In Progress', value: complaints.filter(c => c.status === 'in_progress').length, color: '#1d4ed8', bg: '#eff6ff', icon: 'pending' },
          { label: 'Resolved', value: complaints.filter(c => c.status === 'resolved').length, color: '#15803d', bg: '#f0fdf4', icon: 'check_circle' },
        ].map(m => (
          <div key={m.label} className="bento-card p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: m.bg }}>
              <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '18px' }}>{m.icon}</span>
            </div>
            <p className="font-headline font-extrabold text-2xl mb-0.5" style={{ color: '#181c22' }}>{m.value}</p>
            <p className="text-xs font-bold uppercase" style={{ letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bento-card mb-8 s2 slide-down">
          <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Submit a Complaint</h3>
            <p className="text-sm mt-1" style={{ color: '#717a6d' }}>Your complaint will be logged on the blockchain for transparency</p>
          </div>
          <form onSubmit={handleSubmit} className="p-8">
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '10px' }}>
                Complaint Type *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                {COMPLAINT_TYPES.map(ct => (
                  <div key={ct.value}
                    className={`complaint-type-card ${formData.complaint_type === ct.value ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, complaint_type: ct.value })}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', marginBottom: '8px', background: formData.complaint_type === ct.value ? 'rgba(0,69,13,0.1)' : '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: formData.complaint_type === ct.value ? '#00450d' : '#94a894' }}>{ct.icon}</span>
                    </div>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: formData.complaint_type === ct.value ? '#00450d' : '#181c22', fontFamily: 'Manrope, sans-serif', margin: 0 }}>{ct.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '7px' }}>
                Description *
              </label>
              <textarea className="form-field" style={{ minHeight: '100px', resize: 'vertical' }}
                placeholder="Describe your complaint in detail..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                required />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="submit-btn">
                {saving ? (
                  <><svg style={{ width: '16px', height: '16px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24"><circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Submitting...</>
                ) : (
                  <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>Submit Complaint</>
                )}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '13px 24px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: '#64748b' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Complaints list */}
      <div className="bento-card s3">
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
          <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>All Complaints</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
          </div>
        ) : complaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
              <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>check_circle</span>
            </div>
            <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No complaints filed</p>
            <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>All clear in your district</p>
          </div>
        ) : (
          <div>
            {complaints.map(c => {
              const ct = COMPLAINT_TYPES.find(t => t.value === c.complaint_type)
              const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.submitted
              return (
                <div key={c.id} className="complaint-row">
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: 'rgba(180,83,9,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#b45309' }}>{ct?.icon || 'feedback'}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#181c22' }}>{ct?.label || c.complaint_type}</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: sc.bg, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Manrope, sans-serif' }}>{sc.label}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#41493e', margin: '0 0 4px', lineHeight: 1.5 }}>{c.description}</p>
                    <div className="flex items-center gap-10 text-xs" style={{ color: '#9ca3af' }}>
                      <span>{new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {c.blockchain_tx && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#7c3aed', fontFamily: 'monospace' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px', fontFamily: "'Material Symbols Outlined'" }}>link</span>
                          {c.blockchain_tx.slice(0, 20)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}