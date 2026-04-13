'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
    { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
    { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
    { label: 'Complaints', href: '/dashboard/district-engineer/complaints', icon: 'feedback' },
    { label: 'Waste Reports', href: '/dashboard/district-engineer/waste-reports', icon: 'report' },
    { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
    { label: 'Zones', href: '/dashboard/district-engineer/zones', icon: 'map' },
    { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

const REPORT_TYPES: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    illegal_dumping: { label: 'Illegal Dumping', icon: 'delete_forever', color: '#ba1a1a', bg: '#fef2f2' },
    missed_collection: { label: 'Missed Collection', icon: 'delete', color: '#d97706', bg: '#fefce8' },
    blocked_drainage: { label: 'Blocked Drainage', icon: 'water_damage', color: '#1d4ed8', bg: '#eff6ff' },
    overflowing_bin: { label: 'Overflowing Bin', icon: 'delete_sweep', color: '#d97706', bg: '#fefce8' },
    other: { label: 'Other', icon: 'report', color: '#7c3aed', bg: '#f5f3ff' },
}

interface WasteReport {
    id: string
    submitted_by: string
    report_type: string
    description: string
    location_address: string
    latitude: number | null
    longitude: number | null
    photo_url: string | null
    status: string
    district: string
    assigned_to: string | null
    resolution_notes: string | null
    created_at: string
    reporter_name?: string
}

export default function DEWasteReportsPage() {
    const [reports, setReports] = useState<WasteReport[]>([])
    const [supervisors, setSupervisors] = useState<{ id: string; full_name: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<any>(null)
    const [filterStatus, setFilterStatus] = useState('all')
    const [selected, setSelected] = useState<WasteReport | null>(null)
    const [resolutionNotes, setResolutionNotes] = useState('')
    const [assignTo, setAssignTo] = useState('')
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

        const { data: reportsData } = await supabase
            .from('waste_reports')
            .select('*, profiles!submitted_by(full_name)')
            .eq('district', p?.district || '')
            .order('created_at', { ascending: false })

        const { data: supervisorData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'supervisor')
            .eq('district', p?.district || '')

        setReports((reportsData || []).map((r: any) => ({
            ...r, reporter_name: r.profiles?.full_name || 'Unknown',
        })))
        setSupervisors(supervisorData || [])
        setLoading(false)
    }

    async function updateStatus(report: WasteReport, status: string) {
        setUpdating(true)
        const supabase = createClient()
        await supabase.from('waste_reports').update({
            status,
            resolution_notes: resolutionNotes || null,
            assigned_to: assignTo || null,
        }).eq('id', report.id)
        showToast(`Report marked as ${status}`)
        setSelected(null)
        setResolutionNotes('')
        setAssignTo('')
        await loadData()
        setUpdating(false)
    }

    const filtered = filterStatus === 'all' ? reports : reports.filter(r => r.status === filterStatus)
    const counts = {
        all: reports.length,
        pending: reports.filter(r => r.status === 'pending').length,
        assigned: reports.filter(r => r.status === 'assigned').length,
        resolved: reports.filter(r => r.status === 'resolved').length,
    }

    function statusStyle(status: string) {
        if (status === 'resolved') return { background: '#f0fdf4', color: '#00450d', dot: '#16a34a' }
        if (status === 'assigned') return { background: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6' }
        return { background: '#fefce8', color: '#92400e', dot: '#d97706' }
    }

    return (
        <DashboardLayout
            role="District Engineer"
            userName={profile?.full_name || ''}
            navItems={DE_NAV}
        >
            <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .bento-card {
          background: white; border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
          border: 1px solid rgba(0,69,13,0.04); overflow: hidden;
        }
        .report-row {
          padding: 20px 24px; border-bottom: 1px solid rgba(0,69,13,0.04);
          transition: background 0.2s ease; display: flex; align-items: flex-start; gap: 16px;
        }
        .report-row:hover { background: #f9f9ff; }
        .report-row:last-child { border-bottom: none; }
        .filter-btn {
          padding: 6px 16px; border-radius: 99px; font-size: 12px; font-weight: 700;
          font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s ease;
        }
        .filter-btn.active { background: #00450d; color: white; }
        .filter-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .filter-btn:not(.active):hover { background: #e2e8f0; }
        .status-badge {
          display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em;
          text-transform: uppercase; white-space: nowrap;
        }
        .action-btn {
          padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 700;
          font-family: 'Manrope', sans-serif; cursor: pointer; transition: all 0.2s ease;
          border: none; display: flex; align-items: center; gap: 6px; flex: 1; justify-content: center;
        }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .toast { animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { transform: translateY(16px) translateX(-50%); opacity: 0; } to { transform: translateY(0) translateX(-50%); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

            {/* Toast */}
            {toast && (
                <div className="toast" style={{
                    position: 'fixed', bottom: '24px', left: '50%',
                    background: '#181c22', color: 'white', padding: '10px 20px',
                    borderRadius: '99px', fontSize: '13px', fontWeight: 500, zIndex: 1000,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#4ade80' }}>check_circle</span>
                    {toast}
                </div>
            )}

            {/* Modal */}
            {selected && (
                <div className="modal-overlay" style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
                    zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
                }}>
                    <div style={{
                        background: 'white', borderRadius: '20px', padding: '28px',
                        width: '100%', maxWidth: '540px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                        maxHeight: '90vh', overflowY: 'auto',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '18px', color: '#181c22', margin: 0 }}>
                                Update Report
                            </h2>
                            <button onClick={() => setSelected(null)} style={{
                                background: '#f1f5f9', border: 'none', borderRadius: '8px',
                                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#64748b' }}>close</span>
                            </button>
                        </div>

                        {/* Report details */}
                        <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                                    background: (REPORT_TYPES[selected.report_type] || REPORT_TYPES.other).bg,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <span className="material-symbols-outlined"
                                        style={{ fontSize: '20px', color: (REPORT_TYPES[selected.report_type] || REPORT_TYPES.other).color }}>
                                        {(REPORT_TYPES[selected.report_type] || REPORT_TYPES.other).icon}
                                    </span>
                                </div>
                                <div>
                                    <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', color: '#181c22', margin: 0 }}>
                                        {(REPORT_TYPES[selected.report_type] || REPORT_TYPES.other).label}
                                    </p>
                                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                                        By {selected.reporter_name} · {new Date(selected.created_at).toLocaleDateString('en-GB')}
                                    </p>
                                </div>
                            </div>
                            <p style={{ fontSize: '13px', color: '#41493e', margin: '0 0 8px', lineHeight: 1.6 }}>
                                {selected.description}
                            </p>
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                {selected.location_address}
                            </p>
                            {selected.latitude && selected.longitude && (
                                <a href={`https://maps.google.com/?q=${selected.latitude},${selected.longitude}`}
                                    target="_blank" rel="noreferrer"
                                    style={{ fontSize: '12px', color: '#00450d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', textDecoration: 'none' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                                    View on Google Maps
                                </a>
                            )}
                        </div>

                        {selected.photo_url && (
                            <img src={selected.photo_url} alt="Report" style={{
                                width: '100%', maxHeight: '180px', objectFit: 'cover',
                                borderRadius: '10px', marginBottom: '16px',
                            }} />
                        )}

                        {/* Assign to supervisor */}
                        {supervisors.length > 0 && (
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>
                                    Assign to Supervisor
                                </label>
                                <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={{
                                    width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '10px',
                                    padding: '11px 14px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
                                    color: '#181c22', background: '#fafafa', outline: 'none', boxSizing: 'border-box',
                                    appearance: 'none',
                                }}>
                                    <option value="">— No assignment —</option>
                                    {supervisors.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Resolution notes */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>
                                Resolution Notes
                            </label>
                            <textarea
                                value={resolutionNotes}
                                onChange={e => setResolutionNotes(e.target.value)}
                                placeholder="Describe the action taken or planned..."
                                style={{
                                    width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '10px',
                                    padding: '12px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
                                    minHeight: '80px', resize: 'vertical', color: '#181c22',
                                    background: '#fafafa', outline: 'none', boxSizing: 'border-box',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="action-btn" onClick={() => updateStatus(selected, 'assigned')}
                                disabled={updating} style={{ background: '#eff6ff', color: '#1d4ed8', opacity: updating ? 0.6 : 1 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>assignment_ind</span>
                                Mark Assigned
                            </button>
                            <button className="action-btn" onClick={() => updateStatus(selected, 'resolved')}
                                disabled={updating} style={{ background: '#f0fdf4', color: '#00450d', opacity: updating ? 0.6 : 1 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                                Mark Resolved
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hero */}
            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    District Engineering · Crowdsourced Reports
                </span>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <h1 className="font-headline font-extrabold tracking-tight"
                        style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                        Waste <span style={{ color: '#1b5e20' }}>Reports</span>
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>location_on</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                            {profile?.district}
                        </span>
                    </div>
                </div>
            </section>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
                {[
                    { key: 'all', label: 'Total Reports', value: counts.all, icon: 'report', color: '#00450d', bg: '#f0fdf4' },
                    { key: 'pending', label: 'Pending', value: counts.pending, icon: 'pending', color: '#d97706', bg: '#fefce8' },
                    { key: 'assigned', label: 'Assigned', value: counts.assigned, icon: 'assignment_ind', color: '#1d4ed8', bg: '#eff6ff' },
                    { key: 'resolved', label: 'Resolved', value: counts.resolved, icon: 'check_circle', color: '#16a34a', bg: '#f0fdf4' },
                ].map(m => (
                    <div key={m.key} className="bento-card p-5" style={{ cursor: 'pointer' }}
                        onClick={() => setFilterStatus(m.key)}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                            style={{ background: filterStatus === m.key ? m.color : m.bg }}>
                            <span className="material-symbols-outlined"
                                style={{ color: filterStatus === m.key ? 'white' : m.color, fontSize: '18px' }}>{m.icon}</span>
                        </div>
                        <p className="font-headline font-extrabold text-2xl tracking-tight mb-0.5" style={{ color: '#181c22' }}>
                            {m.value}
                        </p>
                        <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {m.label}
                        </p>
                    </div>
                ))}
            </div>

            {/* Report list */}
            <div className="bento-card s3">
                <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3"
                    style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                    <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Report Feed</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {['all', 'pending', 'assigned', 'resolved'].map(f => (
                            <button key={f} onClick={() => setFilterStatus(f)}
                                className={`filter-btn ${filterStatus === f ? 'active' : ''}`}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>inbox</span>
                        </div>
                        <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No reports found</p>
                        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                            {filterStatus === 'all' ? 'No waste reports in your district yet.' : `No ${filterStatus} reports.`}
                        </p>
                    </div>
                ) : (
                    <div>
                        {filtered.map(report => {
                            const rt = REPORT_TYPES[report.report_type] || REPORT_TYPES.other
                            const ss = statusStyle(report.status)
                            return (
                                <div key={report.id} className="report-row">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: rt.bg }}>
                                        <span className="material-symbols-outlined" style={{ color: rt.color, fontSize: '20px' }}>{rt.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <p className="text-sm font-bold" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                {rt.label}
                                            </p>
                                            <span className="status-badge" style={{ background: ss.background, color: ss.color }}>
                                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ss.dot, display: 'inline-block' }} />
                                                {report.status}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#41493e', marginBottom: '6px', lineHeight: 1.5 }}>
                                            {report.description}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: '#94a3b8' }}>
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                                {report.location_address}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>person</span>
                                                {report.reporter_name}
                                            </span>
                                            <span>{new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                        </div>
                                        {report.resolution_notes && (
                                            <p style={{ fontSize: '12px', color: '#717a6d', marginTop: '6px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>sticky_note_2</span>
                                                {report.resolution_notes}
                                            </p>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                        {report.photo_url && (
                                            <img src={report.photo_url} alt="Report" style={{
                                                width: '52px', height: '52px', borderRadius: '10px',
                                                objectFit: 'cover', border: '1px solid rgba(0,0,0,0.06)',
                                            }} />
                                        )}
                                        {report.status !== 'resolved' && (
                                            <button onClick={() => { setSelected(report); setResolutionNotes(report.resolution_notes || ''); setAssignTo(report.assigned_to || '') }}
                                                style={{ padding: '7px 14px', borderRadius: '8px', background: '#f0fdf4', color: '#00450d', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                                                Update
                                            </button>
                                        )}
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