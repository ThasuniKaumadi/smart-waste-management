'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const SUPERVISOR_NAV = [
    { label: 'Overview', href: '/dashboard/supervisor', icon: 'dashboard' },
    { label: 'Routes', href: '/dashboard/supervisor/routes', icon: 'route' },
    { label: 'Track Route', href: '/dashboard/supervisor/track-route', icon: 'gps_fixed' },
    { label: 'Alerts', href: '/dashboard/supervisor/alerts', icon: 'notifications' },
    { label: 'Complaints', href: '/dashboard/supervisor/complaints', icon: 'feedback' },
    { label: 'Waste Reports', href: '/dashboard/supervisor/waste-reports', icon: 'report' },
]

const COMPLAINT_TYPES: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    missed_collection: { label: 'Missed Collection', icon: 'delete', color: '#d97706', bg: '#fefce8' },
    illegal_dumping: { label: 'Illegal Dumping', icon: 'delete_forever', color: '#ba1a1a', bg: '#fef2f2' },
    bin_damage: { label: 'Bin Damage', icon: 'broken_image', color: '#7c3aed', bg: '#f5f3ff' },
    collection_time: { label: 'Collection Time', icon: 'schedule', color: '#1d4ed8', bg: '#eff6ff' },
    noise_complaint: { label: 'Noise Complaint', icon: 'volume_up', color: '#0891b2', bg: '#ecfeff' },
    other: { label: 'Other', icon: 'report', color: '#64748b', bg: '#f8fafc' },
}

interface Complaint {
    id: string
    complaint_type: string
    description: string
    district: string
    status: string
    created_at: string
    resolution_notes: string | null
    reporter_name?: string
    custom_complaint_type?: string
}

export default function SupervisorComplaintsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [complaints, setComplaints] = useState<Complaint[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('all')
    const [selected, setSelected] = useState<Complaint | null>(null)
    const [resolutionNotes, setResolutionNotes] = useState('')
    const [updating, setUpdating] = useState(false)
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

        // Supervisors see complaints for their district
        // (complaints table has district but not ward — filter by district)
        const { data } = await supabase
            .from('complaints')
            .select('*, profiles!submitted_by(full_name)')
            .eq('district', p?.district || '')
            .order('created_at', { ascending: false })

        const mapped = (data || []).map((c: any) => ({
            ...c,
            reporter_name: c.profiles?.full_name || 'Unknown Resident',
        }))
        setComplaints(mapped)
        setLoading(false)
    }

    async function updateStatus(complaint: Complaint, status: string) {
        setUpdating(true)
        const supabase = createClient()
        await supabase.from('complaints').update({
            status,
            resolution_notes: resolutionNotes || null,
        }).eq('id', complaint.id)
        showToast(`Complaint marked as ${status.replace('_', ' ')}`)
        setSelected(null)
        setResolutionNotes('')
        await loadData()
        setUpdating(false)
    }

    const filtered = filterStatus === 'all'
        ? complaints
        : complaints.filter(c => c.status === filterStatus)

    const counts = {
        all: complaints.length,
        pending: complaints.filter(c => c.status === 'pending').length,
        in_progress: complaints.filter(c => c.status === 'in_progress').length,
        resolved: complaints.filter(c => c.status === 'resolved').length,
    }

    function statusStyle(status: string) {
        if (status === 'resolved') return { background: '#f0fdf4', color: '#00450d', dot: '#16a34a' }
        if (status === 'in_progress') return { background: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6' }
        return { background: '#fefce8', color: '#92400e', dot: '#d97706' }
    }

    return (
        <DashboardLayout
            role="Supervisor"
            userName={profile?.full_name || ''}
            navItems={SUPERVISOR_NAV}
        >
            <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .bento-card {
          background: white; border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
          border: 1px solid rgba(0,69,13,0.04); overflow: hidden;
        }
        .complaint-row {
          padding: 20px 24px; border-bottom: 1px solid rgba(0,69,13,0.04);
          transition: background 0.2s; display: flex; align-items: flex-start;
          gap: 16px; cursor: pointer;
        }
        .complaint-row:hover { background: #f9fdf9; }
        .complaint-row:last-child { border-bottom: none; }
        .filter-btn {
          padding: 6px 16px; border-radius: 99px; font-size: 12px; font-weight: 700;
          font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s;
        }
        .filter-btn.active { background: #00450d; color: white; }
        .filter-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .filter-btn:not(.active):hover { background: #e2e8f0; }
        .status-badge {
          display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em; text-transform: uppercase;
        }
        .action-btn {
          padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 700;
          font-family: 'Manrope', sans-serif; cursor: pointer; transition: all 0.2s;
          border: none; display: flex; align-items: center; gap: 6px;
          flex: 1; justify-content: center;
        }
        .action-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn   { from { opacity: 0 } to { opacity: 1 } }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.45s ease 0.05s both; }
        .s2 { animation: staggerIn 0.45s ease 0.10s both; }
        .s3 { animation: staggerIn 0.45s ease 0.15s both; }
        @keyframes slideUp { from { transform: translateY(12px) translateX(-50%); opacity: 0; } to { transform: translateY(0) translateX(-50%); opacity: 1; } }
        .toast { animation: slideUp 0.3s ease; }
      `}</style>

            {/* Toast */}
            {toast && (
                <div className="toast" style={{ position: 'fixed', bottom: '24px', left: '50%', background: '#181c22', color: 'white', padding: '10px 20px', borderRadius: '99px', fontSize: '13px', fontWeight: 500, zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#4ade80' }}>check_circle</span>
                    {toast}
                </div>
            )}

            {/* Update modal */}
            {selected && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '18px', color: '#181c22', margin: 0 }}>Update Complaint</h2>
                            <button onClick={() => setSelected(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#64748b' }}>close</span>
                            </button>
                        </div>

                        <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0, background: (COMPLAINT_TYPES[selected.complaint_type] || COMPLAINT_TYPES.other).bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: (COMPLAINT_TYPES[selected.complaint_type] || COMPLAINT_TYPES.other).color }}>
                                        {(COMPLAINT_TYPES[selected.complaint_type] || COMPLAINT_TYPES.other).icon}
                                    </span>
                                </div>
                                <div>
                                    <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', color: '#181c22', margin: 0 }}>
                                        {(COMPLAINT_TYPES[selected.complaint_type] || COMPLAINT_TYPES.other).label}
                                    </p>
                                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                                        By {selected.reporter_name} · {new Date(selected.created_at).toLocaleDateString('en-GB')}
                                    </p>
                                </div>
                            </div>
                            <p style={{ fontSize: '13px', color: '#41493e', margin: 0, lineHeight: 1.6 }}>{selected.description}</p>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>
                                Resolution Notes
                            </label>
                            <textarea
                                value={resolutionNotes}
                                onChange={e => setResolutionNotes(e.target.value)}
                                placeholder="Describe the action taken or planned..."
                                style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '10px', padding: '12px', fontSize: '13px', fontFamily: 'Inter, sans-serif', minHeight: '80px', resize: 'vertical', color: '#181c22', background: '#fafafa', outline: 'none', boxSizing: 'border-box' }}
                                onFocus={e => { e.target.style.borderColor = '#00450d'; e.target.style.boxShadow = '0 0 0 3px rgba(0,69,13,0.08)' }}
                                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="action-btn" onClick={() => updateStatus(selected, 'in_progress')}
                                disabled={updating} style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>pending</span>
                                In Progress
                            </button>
                            <button className="action-btn" onClick={() => updateStatus(selected, 'resolved')}
                                disabled={updating} style={{ background: '#f0fdf4', color: '#00450d' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                                Resolved
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <section className="s1" style={{ marginBottom: '32px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    Supervisor · Resident Feedback
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
                    <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '46px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: 0 }}>
                        Resident <span style={{ color: '#1b5e20' }}>Complaints</span>
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '17px' }}>location_on</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>{profile?.district}</span>
                    </div>
                </div>
            </section>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }} className="s2">
                {[
                    { key: 'all', label: 'Total', value: counts.all, icon: 'feedback', color: '#00450d', bg: '#f0fdf4' },
                    { key: 'pending', label: 'Pending', value: counts.pending, icon: 'pending', color: '#d97706', bg: '#fefce8' },
                    { key: 'in_progress', label: 'In Progress', value: counts.in_progress, icon: 'autorenew', color: '#1d4ed8', bg: '#eff6ff' },
                    { key: 'resolved', label: 'Resolved', value: counts.resolved, icon: 'check_circle', color: '#16a34a', bg: '#f0fdf4' },
                ].map(m => (
                    <div key={m.key} className="bento-card" style={{ padding: '20px', cursor: 'pointer' }} onClick={() => setFilterStatus(m.key)}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: filterStatus === m.key ? m.color : m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', transition: 'background 0.2s' }}>
                            <span className="material-symbols-outlined" style={{ color: filterStatus === m.key ? 'white' : m.color, fontSize: '18px' }}>{m.icon}</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '28px', color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Complaint list */}
            <div className="bento-card s3">
                <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '18px', color: '#181c22', margin: 0 }}>Complaint Feed</h3>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(['all', 'pending', 'in_progress', 'resolved'] as const).map(f => (
                            <button key={f} onClick={() => setFilterStatus(f)} className={`filter-btn ${filterStatus === f ? 'active' : ''}`}>
                                {f.replace('_', ' ').charAt(0).toUpperCase() + f.replace('_', ' ').slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
                        <div style={{ width: '28px', height: '28px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>check_circle</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: '0 0 6px' }}>No complaints found</p>
                        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                            {filterStatus === 'all' ? 'No complaints in your district yet.' : `No ${filterStatus.replace('_', ' ')} complaints.`}
                        </p>
                    </div>
                ) : (
                    <div>
                        {filtered.map(complaint => {
                            const ct = COMPLAINT_TYPES[complaint.complaint_type] || COMPLAINT_TYPES.other
                            const ss = statusStyle(complaint.status)
                            const canUpdate = complaint.status !== 'resolved'
                            return (
                                <div key={complaint.id} className="complaint-row"
                                    onClick={() => { if (canUpdate) { setSelected(complaint); setResolutionNotes(complaint.resolution_notes || '') } }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: ct.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="material-symbols-outlined" style={{ color: ct.color, fontSize: '20px' }}>{ct.icon}</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif', margin: 0 }}>
                                                {ct.label}
                                                {complaint.custom_complaint_type && ` — ${complaint.custom_complaint_type}`}
                                            </p>
                                            <span className="status-badge" style={{ background: ss.background, color: ss.color }}>
                                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ss.dot, display: 'inline-block' }} />
                                                {complaint.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#41493e', margin: '0 0 6px', lineHeight: 1.5 }}>{complaint.description}</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>person</span>
                                                {complaint.reporter_name}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>schedule</span>
                                                {new Date(complaint.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                        {complaint.resolution_notes && (
                                            <p style={{ fontSize: '12px', color: '#717a6d', marginTop: '6px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>sticky_note_2</span>
                                                {complaint.resolution_notes}
                                            </p>
                                        )}
                                    </div>
                                    {canUpdate && (
                                        <div style={{ flexShrink: 0, padding: '6px 12px', borderRadius: '8px', background: '#f0fdf4', color: '#00450d', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                                            Update
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9fdf9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '15px' }}>info</span>
                    <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>
                        Showing {filtered.length} of {complaints.length} complaints in {profile?.district}
                    </p>
                </div>
            </div>
        </DashboardLayout>
    )
}