'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
    { label: 'Home', href: '/dashboard/admin', icon: 'dashboard' },
    { label: 'Users', href: '/dashboard/admin/users', icon: 'manage_accounts' },
    { label: 'Billing', href: '/dashboard/admin/billing', icon: 'payments' },
    { label: 'Billing Rates', href: '/dashboard/admin/billing-rates', icon: 'tune' },
    { label: 'Blockchain', href: '/dashboard/admin/blockchain', icon: 'link' },
    { label: 'Performance', href: '/dashboard/admin/performance', icon: 'analytics' },
    { label: 'Disposal', href: '/dashboard/admin/disposal', icon: 'delete_sweep' },
    { label: 'Reports', href: '/dashboard/admin/reports', icon: 'rate_review' },
    { label: 'Profile', href: '/dashboard/admin/profile', icon: 'person' },
]

// ─── Shared config ────────────────────────────────────────────────────────────

const REPORT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    pending: { label: 'Pending', color: '#d97706', bg: '#fefce8', icon: 'schedule' },
    under_review: { label: 'Under Review', color: '#1d4ed8', bg: '#eff6ff', icon: 'manage_search' },
    resolved: { label: 'Resolved', color: '#166534', bg: '#f0fdf4', icon: 'check_circle' },
    rejected: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2', icon: 'cancel' },
}

const COMPLAINT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    open: { label: 'Open', color: '#d97706', bg: '#fefce8', icon: 'radio_button_unchecked' },
    in_progress: { label: 'In Progress', color: '#1d4ed8', bg: '#eff6ff', icon: 'autorenew' },
    resolved: { label: 'Resolved', color: '#166534', bg: '#f0fdf4', icon: 'check_circle' },
    closed: { label: 'Closed', color: '#6b7280', bg: '#f4f6f3', icon: 'lock' },
}

const REPORT_TYPES = ['All', 'Illegal Dumping', 'Missed Collection', 'Blocked Drainage', 'Other']
const DISTRICTS = ['All', 'District 1', 'District 2', 'District 3', 'District 4']

interface WasteReport {
    id: string; report_type: string; description: string; status: string
    district: string; ward?: string; latitude?: number; longitude?: number
    submitted_by: string; created_at: string; photo_url?: string
    reporter?: { full_name: string; phone?: string }
}

interface Complaint {
    id: string; type: string; description: string; status: string
    district: string; created_at: string; tx_hash?: string
    complainant?: { full_name: string }
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatusPill({ config, status }: { config: Record<string, any>; status: string }) {
    const sc = config[status] || { label: status, color: '#717a6d', bg: '#f4f6f3', icon: 'help' }
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'Manrope', background: sc.bg, color: sc.color }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{sc.icon}</span>
            {sc.label}
        </span>
    )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
            <div style={{ background: 'white', borderRadius: 20, padding: 32, width: '100%', maxWidth: 540, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminReportsComplaintsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [activeTab, setActiveTab] = useState<'reports' | 'complaints'>('reports')

    // Waste reports state
    const [reports, setReports] = useState<WasteReport[]>([])
    const [reportsLoading, setRLoad] = useState(true)
    const [selectedReport, setSelReport] = useState<WasteReport | null>(null)
    const [rFilterType, setRFilterType] = useState('All')
    const [rFilterStatus, setRFilterStatus] = useState('All')
    const [rFilterDistrict, setRFilterDist] = useState('All')
    const [rSearch, setRSearch] = useState('')

    // Complaints state
    const [complaints, setComplaints] = useState<Complaint[]>([])
    const [complaintsLoading, setCLoad] = useState(true)
    const [selectedComplaint, setSelComp] = useState<Complaint | null>(null)
    const [cFilterStatus, setCFilterStatus] = useState('All')
    const [cFilterDistrict, setCFilterDist] = useState('All')
    const [cFilterType, setCFilterType] = useState('All')
    const [cSearch, setCSearch] = useState('')
    const [cSortBy, setCSortBy] = useState<'date' | 'district' | 'status'>('date')

    const [updating, setUpdating] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => { loadAll() }, [])

    async function loadAll() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        setProfile(p)

        // Load waste reports
        const { data: rData } = await supabase
            .from('waste_reports')
            .select(`*, reporter:profiles!waste_reports_submitted_by_fkey(full_name, phone)`)
            .order('created_at', { ascending: false })
            .limit(200)
        setReports(rData || [])
        setRLoad(false)

        // Load complaints
        const { data: cData } = await supabase
            .from('complaints')
            .select(`*, complainant:profiles!complaints_user_id_fkey(full_name)`)
            .order('created_at', { ascending: false })
            .limit(300)
        setComplaints(cData || [])
        setCLoad(false)
    }

    async function updateReportStatus(id: string, status: string) {
        setUpdating(true)
        const supabase = createClient()
        const { error } = await supabase.from('waste_reports').update({ status }).eq('id', id)
        if (!error) {
            setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r))
            setSelReport(prev => prev?.id === id ? { ...prev, status } : prev)
            flash('success', `Report marked as "${REPORT_STATUS_CONFIG[status]?.label || status}".`)
        } else flash('error', error.message)
        setUpdating(false)
    }

    async function updateComplaintStatus(id: string, status: string) {
        setUpdating(true)
        const supabase = createClient()
        const { error } = await supabase.from('complaints').update({ status }).eq('id', id)
        if (!error) {
            setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c))
            setSelComp(prev => prev?.id === id ? { ...prev, status } : prev)
            flash('success', `Complaint status updated to "${COMPLAINT_STATUS_CONFIG[status]?.label || status}".`)
        } else flash('error', error.message)
        setUpdating(false)
    }

    function flash(type: 'success' | 'error', text: string) {
        setMessage({ type, text })
        setTimeout(() => setMessage(null), 3500)
    }

    // ── Derived: reports ──
    const filteredReports = reports.filter(r => {
        if (rFilterType !== 'All' && r.report_type !== rFilterType) return false
        if (rFilterStatus !== 'All' && r.status !== rFilterStatus) return false
        if (rFilterDistrict !== 'All' && r.district !== rFilterDistrict) return false
        if (rSearch && !r.description?.toLowerCase().includes(rSearch.toLowerCase()) && !r.report_type?.toLowerCase().includes(rSearch.toLowerCase())) return false
        return true
    })

    // ── Derived: complaints ──
    const allCTypes = ['All', ...Array.from(new Set(complaints.map(c => c.type).filter(Boolean)))]
    const filteredComplaints = complaints
        .filter(c => {
            if (cFilterStatus !== 'All' && c.status !== cFilterStatus) return false
            if (cFilterDistrict !== 'All' && c.district !== cFilterDistrict) return false
            if (cFilterType !== 'All' && c.type !== cFilterType) return false
            if (cSearch && !c.description?.toLowerCase().includes(cSearch.toLowerCase()) && !c.type?.toLowerCase().includes(cSearch.toLowerCase())) return false
            return true
        })
        .sort((a, b) => {
            if (cSortBy === 'district') return (a.district || '').localeCompare(b.district || '')
            if (cSortBy === 'status') return (a.status || '').localeCompare(b.status || '')
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

    // ── Stats ──
    const rStats = {
        total: reports.length,
        pending: reports.filter(r => r.status === 'pending').length,
        resolved: reports.filter(r => r.status === 'resolved').length,
    }
    const cStats = {
        total: complaints.length,
        open: complaints.filter(c => c.status === 'open').length,
        resolved: complaints.filter(c => c.status === 'resolved').length,
    }

    const districtBreakdown = ['District 1', 'District 2', 'District 3', 'District 4'].map(d => ({
        district: d,
        total: complaints.filter(c => c.district === d).length,
        open: complaints.filter(c => c.district === d && c.status === 'open').length,
        resolved: complaints.filter(c => c.district === d && c.status === 'resolved').length,
    }))
    const maxTotal = Math.max(...districtBreakdown.map(d => d.total), 1)

    return (
        <DashboardLayout
            role="Admin"
            userName={profile?.full_name || 'Administrator'}
            navItems={ADMIN_NAV}
        >
            <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .tab-btn { padding: 10px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s; background: transparent; color: #717a6d; display: inline-flex; align-items: center; gap: 8px; }
        .tab-btn.active { background: #00450d; color: white; }
        .tab-btn:not(.active):hover { background: #f0fdf4; color: #00450d; }
        .stat-card { background: white; border-radius: 16px; padding: 20px; border: 1px solid rgba(0,69,13,0.06); box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .filter-select { padding: 9px 14px; border: 1.5px solid #e4e9e0; border-radius: 10px; font-size: 13px; font-family: 'Inter', sans-serif; color: #181c22; background: white; outline: none; cursor: pointer; }
        .filter-select:focus { border-color: #00450d; }
        .search-box { padding: 9px 14px 9px 40px; border: 1.5px solid #e4e9e0; border-radius: 10px; font-size: 13px; font-family: 'Inter'; color: #181c22; background: white; outline: none; width: 220px; }
        .search-box:focus { border-color: #00450d; box-shadow: 0 0 0 3px rgba(0,69,13,0.08); }
        .table-header { display: grid; padding: 12px 20px; background: #fafbf9; border-bottom: 1px solid #e4e9e0; }
        .row { padding: 14px 20px; border-bottom: 1px solid #f4f6f3; transition: background 0.15s; cursor: pointer; display: grid; align-items: center; }
        .row:hover { background: #f9fdf9; }
        .row:last-child { border-bottom: none; }
        .action-btn { border: none; border-radius: 8px; padding: 6px 13px; font-size: 12px; font-weight: 600; font-family: 'Manrope'; cursor: pointer; transition: all 0.15s; }
        .toast { border-radius: 12px; padding: 12px 16px; font-size: 13px; font-family: 'Inter'; display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .toast.success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
        .toast.error   { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
        .detail-row { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f4f6f3; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-size: 12px; color: #717a6d; font-family: 'Inter'; width: 115px; flex-shrink: 0; padding-top: 1px; }
        .detail-value { font-size: 13px; color: #181c22; font-family: 'Inter'; font-weight: 500; line-height: 1.5; }
        .bar-track { height: 8px; background: #f0fdf4; border-radius: 99px; overflow: hidden; flex: 1; }
        .bar-fill-green { height: 100%; border-radius: 99px; background: #00450d; }
        .bar-fill-amber { height: 100%; border-radius: 99px; background: #fbbf24; }
        .section-label { font-size: 11px; font-weight: 700; color: #a0a89b; letter-spacing: 0.08em; text-transform: uppercase; font-family: 'Manrope'; margin-bottom: 14px; }
      `}</style>

            <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>

                {/* ── Page header ── */}
                <div style={{ marginBottom: 24 }}>
                    <h1> Waste <span style={{ color: '#1b5e20' }}>Disposal</span></h1>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>
                        🗑️ System Administration
                    </p>
                    <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
                        Waste <span style={{ color: '#00450d' }}>Disposal</span>
                    </h1>
                </div>

                {/* ── Combined stats strip ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
                    {[
                        { label: 'Reports', value: rStats.total, icon: 'report', color: '#7c3aed' },
                        { label: 'Pending', value: rStats.pending, icon: 'schedule', color: '#d97706' },
                        { label: 'Reports Resolved', value: rStats.resolved, icon: 'check_circle', color: '#166534' },
                        { label: 'Complaints', value: cStats.total, icon: 'feedback', color: '#00450d' },
                        { label: 'Open', value: cStats.open, icon: 'radio_button_unchecked', color: '#d97706' },
                        { label: 'Comp. Resolved', value: cStats.resolved, icon: 'verified', color: '#166534' },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: s.color }}>{s.icon}</span>
                                <span style={{ fontSize: 10, color: '#717a6d', fontFamily: 'Manrope', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>{s.label}</span>
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope' }}>
                                {(reportsLoading || complaintsLoading) ? '—' : s.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Tab switcher ── */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#f4f6f3', borderRadius: 14, padding: 6, width: 'fit-content' }}>
                    <button className={`tab-btn${activeTab === 'reports' ? ' active' : ''}`} onClick={() => setActiveTab('reports')}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>report</span>
                        Waste Reports
                        {rStats.pending > 0 && (
                            <span style={{ background: activeTab === 'reports' ? 'rgba(255,255,255,0.25)' : '#d97706', color: activeTab === 'reports' ? 'white' : 'white', borderRadius: 99, fontSize: 11, padding: '1px 7px', fontWeight: 700, fontFamily: 'Manrope' }}>
                                {rStats.pending}
                            </span>
                        )}
                    </button>
                    <button className={`tab-btn${activeTab === 'complaints' ? ' active' : ''}`} onClick={() => setActiveTab('complaints')}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>feedback</span>
                        Complaints
                        {cStats.open > 0 && (
                            <span style={{ background: activeTab === 'complaints' ? 'rgba(255,255,255,0.25)' : '#d97706', color: 'white', borderRadius: 99, fontSize: 11, padding: '1px 7px', fontWeight: 700, fontFamily: 'Manrope' }}>
                                {cStats.open}
                            </span>
                        )}
                    </button>
                </div>

                {/* ── Toast ── */}
                {message && (
                    <div className={`toast ${message.type}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{message.type === 'success' ? 'check_circle' : 'error'}</span>
                        {message.text}
                    </div>
                )}

                {/* ════════════════════════════════════════
            TAB: WASTE REPORTS
        ════════════════════════════════════════ */}
                {activeTab === 'reports' && (
                    <>
                        {/* Filters */}
                        <div style={{ background: 'white', borderRadius: 16, padding: '14px 20px', border: '1px solid rgba(0,69,13,0.06)', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#a0a89b' }}>search</span>
                                <input className="search-box" placeholder="Search reports…" value={rSearch} onChange={e => setRSearch(e.target.value)} />
                            </div>
                            <select className="filter-select" value={rFilterType} onChange={e => setRFilterType(e.target.value)}>
                                {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                            <select className="filter-select" value={rFilterStatus} onChange={e => setRFilterStatus(e.target.value)}>
                                <option value="All">All statuses</option>
                                {Object.entries(REPORT_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <select className="filter-select" value={rFilterDistrict} onChange={e => setRFilterDist(e.target.value)}>
                                {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                            </select>
                            <span style={{ marginLeft: 'auto', fontSize: 13, color: '#717a6d', fontFamily: 'Inter' }}>{filteredReports.length} of {reports.length}</span>
                        </div>

                        {/* Table */}
                        <div style={{ background: 'white', borderRadius: 16, border: '1px solid rgba(0,69,13,0.06)', overflow: 'hidden' }}>
                            <div className="table-header" style={{ gridTemplateColumns: '1fr 120px 120px 120px 150px' }}>
                                {['Report', 'Type', 'District', 'Status', 'Actions'].map(h => (
                                    <span key={h} style={{ fontSize: 12, fontWeight: 700, color: '#717a6d', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                                ))}
                            </div>
                            {reportsLoading ? (
                                <div style={{ padding: 40, textAlign: 'center', color: '#717a6d', fontFamily: 'Inter', fontSize: 14 }}>Loading…</div>
                            ) : filteredReports.length === 0 ? (
                                <div style={{ padding: 48, textAlign: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 10 }}>report_off</span>
                                    <p style={{ color: '#717a6d', fontFamily: 'Inter', fontSize: 14 }}>No reports match your filters.</p>
                                </div>
                            ) : filteredReports.map(r => {
                                const sc = REPORT_STATUS_CONFIG[r.status] || { label: r.status, color: '#717a6d', bg: '#f4f6f3', icon: 'help' }
                                return (
                                    <div key={r.id} className="row" style={{ gridTemplateColumns: '1fr 120px 120px 120px 150px' }} onClick={() => setSelReport(r)}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#181c22', fontFamily: 'Manrope', marginBottom: 2 }}>
                                                {r.description?.slice(0, 60)}{(r.description?.length || 0) > 60 ? '…' : ''}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#a0a89b', fontFamily: 'Inter' }}>
                                                {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                {r.ward ? ` · ${r.ward}` : ''}
                                            </div>
                                        </div>
                                        <div><span style={{ fontSize: 12, color: '#41493e', fontFamily: 'Inter', background: '#f4f6f3', borderRadius: 6, padding: '3px 8px' }}>{r.report_type || '—'}</span></div>
                                        <div style={{ fontSize: 13, color: '#41493e', fontFamily: 'Inter' }}>{r.district || '—'}</div>
                                        <div><StatusPill config={REPORT_STATUS_CONFIG} status={r.status} /></div>
                                        <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                                            {r.status === 'pending' && (
                                                <button className="action-btn" style={{ background: '#eff6ff', color: '#1d4ed8' }} onClick={() => updateReportStatus(r.id, 'under_review')} disabled={updating}>Review</button>
                                            )}
                                            {(r.status === 'pending' || r.status === 'under_review') && (
                                                <button className="action-btn" style={{ background: '#f0fdf4', color: '#166534' }} onClick={() => updateReportStatus(r.id, 'resolved')} disabled={updating}>Resolve</button>
                                            )}
                                            {r.status === 'pending' && (
                                                <button className="action-btn" style={{ background: '#fef2f2', color: '#dc2626' }} onClick={() => updateReportStatus(r.id, 'rejected')} disabled={updating}>Reject</button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

                {/* ════════════════════════════════════════
            TAB: COMPLAINTS
        ════════════════════════════════════════ */}
                {activeTab === 'complaints' && (
                    <>
                        {/* District breakdown bar chart */}
                        <div style={{ background: 'white', borderRadius: 16, padding: '20px 24px', border: '1px solid rgba(0,69,13,0.06)', marginBottom: 16 }}>
                            <p className="section-label">By District</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {districtBreakdown.map(d => (
                                    <div key={d.district} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <span style={{ fontSize: 13, color: '#41493e', fontFamily: 'Inter', width: 90, flexShrink: 0 }}>{d.district}</span>
                                        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                                            <div className="bar-track"><div className="bar-fill-green" style={{ width: `${(d.resolved / maxTotal) * 100}%` }} /></div>
                                            <div className="bar-track" style={{ background: '#fef9ee' }}><div className="bar-fill-amber" style={{ width: `${(d.open / maxTotal) * 100}%` }} /></div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, width: 130, flexShrink: 0, justifyContent: 'flex-end' }}>
                                            <span style={{ fontSize: 12, color: '#166534', fontFamily: 'Inter' }}>{d.resolved} resolved</span>
                                            <span style={{ fontSize: 12, color: '#d97706', fontFamily: 'Inter' }}>{d.open} open</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#00450d' }} /><span style={{ fontSize: 12, color: '#717a6d', fontFamily: 'Inter' }}>Resolved</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#fbbf24' }} /><span style={{ fontSize: 12, color: '#717a6d', fontFamily: 'Inter' }}>Open</span></div>
                            </div>
                        </div>

                        {/* Filters */}
                        <div style={{ background: 'white', borderRadius: 16, padding: '14px 20px', border: '1px solid rgba(0,69,13,0.06)', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#a0a89b' }}>search</span>
                                <input className="search-box" placeholder="Search complaints…" value={cSearch} onChange={e => setCSearch(e.target.value)} />
                            </div>
                            <select className="filter-select" value={cFilterStatus} onChange={e => setCFilterStatus(e.target.value)}>
                                <option value="All">All statuses</option>
                                {Object.entries(COMPLAINT_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <select className="filter-select" value={cFilterDistrict} onChange={e => setCFilterDist(e.target.value)}>
                                {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                            </select>
                            <select className="filter-select" value={cFilterType} onChange={e => setCFilterType(e.target.value)}>
                                {allCTypes.map(t => <option key={t}>{t}</option>)}
                            </select>
                            <select className="filter-select" value={cSortBy} onChange={e => setCSortBy(e.target.value as any)}>
                                <option value="date">Sort: Date</option>
                                <option value="district">Sort: District</option>
                                <option value="status">Sort: Status</option>
                            </select>
                            <span style={{ marginLeft: 'auto', fontSize: 13, color: '#717a6d', fontFamily: 'Inter' }}>{filteredComplaints.length} of {complaints.length}</span>
                        </div>

                        {/* Table */}
                        <div style={{ background: 'white', borderRadius: 16, border: '1px solid rgba(0,69,13,0.06)', overflow: 'hidden' }}>
                            <div className="table-header" style={{ gridTemplateColumns: '1fr 110px 120px 110px 130px' }}>
                                {['Complaint', 'Type', 'District', 'Status', 'Actions'].map(h => (
                                    <span key={h} style={{ fontSize: 12, fontWeight: 700, color: '#717a6d', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                                ))}
                            </div>
                            {complaintsLoading ? (
                                <div style={{ padding: 40, textAlign: 'center', color: '#717a6d', fontFamily: 'Inter', fontSize: 14 }}>Loading…</div>
                            ) : filteredComplaints.length === 0 ? (
                                <div style={{ padding: 48, textAlign: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 10 }}>sentiment_satisfied</span>
                                    <p style={{ color: '#717a6d', fontFamily: 'Inter', fontSize: 14 }}>No complaints match your filters.</p>
                                </div>
                            ) : filteredComplaints.map(c => {
                                const sc = COMPLAINT_STATUS_CONFIG[c.status] || { label: c.status, color: '#717a6d', bg: '#f4f6f3', icon: 'help' }
                                return (
                                    <div key={c.id} className="row" style={{ gridTemplateColumns: '1fr 110px 120px 110px 130px' }} onClick={() => setSelComp(c)}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#181c22', fontFamily: 'Manrope', marginBottom: 2 }}>
                                                {c.description?.slice(0, 55)}{(c.description?.length || 0) > 55 ? '…' : ''}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#a0a89b', fontFamily: 'Inter' }}>
                                                {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                {c.complainant?.full_name ? ` · ${c.complainant.full_name}` : ''}
                                                {c.tx_hash && <span style={{ color: '#1d4ed8', marginLeft: 6 }}>⛓</span>}
                                            </div>
                                        </div>
                                        <div><span style={{ fontSize: 12, color: '#41493e', fontFamily: 'Inter', background: '#f4f6f3', borderRadius: 6, padding: '3px 8px' }}>{c.type || '—'}</span></div>
                                        <div style={{ fontSize: 13, color: '#41493e', fontFamily: 'Inter' }}>{c.district || '—'}</div>
                                        <div><StatusPill config={COMPLAINT_STATUS_CONFIG} status={c.status} /></div>
                                        <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                                            {c.status === 'open' && (
                                                <button className="action-btn" style={{ background: '#eff6ff', color: '#1d4ed8' }} onClick={() => updateComplaintStatus(c.id, 'in_progress')} disabled={updating}>Start</button>
                                            )}
                                            {(c.status === 'open' || c.status === 'in_progress') && (
                                                <button className="action-btn" style={{ background: '#f0fdf4', color: '#166534' }} onClick={() => updateComplaintStatus(c.id, 'resolved')} disabled={updating}>Resolve</button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* ── Waste report detail modal ── */}
            {selectedReport && (
                <Modal onClose={() => setSelReport(null)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope', margin: 0 }}>Report Details</h2>
                        <button onClick={() => setSelReport(null)} style={{ background: '#f4f6f3', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontFamily: 'Manrope', color: '#41493e' }}>Close</button>
                    </div>
                    <div style={{ marginBottom: 16 }}><StatusPill config={REPORT_STATUS_CONFIG} status={selectedReport.status} /></div>
                    <div style={{ marginBottom: 20 }}>
                        {[
                            { label: 'Type', value: selectedReport.report_type || '—' },
                            { label: 'District', value: selectedReport.district || '—' },
                            { label: 'Ward', value: selectedReport.ward || '—' },
                            { label: 'Submitted', value: new Date(selectedReport.created_at).toLocaleString('en-GB') },
                            { label: 'Reporter', value: selectedReport.reporter?.full_name || 'Anonymous' },
                            { label: 'Contact', value: selectedReport.reporter?.phone || '—' },
                            { label: 'Coordinates', value: selectedReport.latitude ? `${selectedReport.latitude.toFixed(5)}, ${selectedReport.longitude?.toFixed(5)}` : 'Not tagged' },
                        ].map(d => (
                            <div key={d.label} className="detail-row">
                                <span className="detail-label">{d.label}</span>
                                <span className="detail-value">{d.value}</span>
                            </div>
                        ))}
                        <div className="detail-row">
                            <span className="detail-label">Description</span>
                            <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.description || '—'}</span>
                        </div>
                    </div>
                    <div style={{ borderTop: '1px solid #f4f6f3', paddingTop: 16 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#a0a89b', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Update Status</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {Object.entries(REPORT_STATUS_CONFIG).map(([k, v]) => {
                                const isCurrent = selectedReport.status === k
                                return (
                                    <button key={k} onClick={() => updateReportStatus(selectedReport.id, k)} disabled={isCurrent || updating}
                                        style={{ border: isCurrent ? `2px solid ${v.color}` : '1.5px solid #e4e9e0', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'Manrope', cursor: isCurrent ? 'default' : 'pointer', background: isCurrent ? v.bg : 'white', color: isCurrent ? v.color : '#41493e', opacity: updating ? 0.6 : 1 }}>
                                        {v.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── Complaint detail modal ── */}
            {selectedComplaint && (
                <Modal onClose={() => setSelComp(null)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope', margin: 0 }}>Complaint Details</h2>
                        <button onClick={() => setSelComp(null)} style={{ background: '#f4f6f3', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontFamily: 'Manrope', color: '#41493e' }}>Close</button>
                    </div>
                    <div style={{ marginBottom: 16 }}><StatusPill config={COMPLAINT_STATUS_CONFIG} status={selectedComplaint.status} /></div>
                    <div style={{ marginBottom: 20 }}>
                        {[
                            { label: 'Type', value: selectedComplaint.type || '—' },
                            { label: 'District', value: selectedComplaint.district || '—' },
                            { label: 'Submitted', value: new Date(selectedComplaint.created_at).toLocaleString('en-GB') },
                            { label: 'Complainant', value: selectedComplaint.complainant?.full_name || 'Anonymous' },
                            { label: 'Blockchain', value: selectedComplaint.tx_hash || 'Not recorded' },
                        ].map(d => (
                            <div key={d.label} className="detail-row">
                                <span className="detail-label">{d.label}</span>
                                <span className="detail-value" style={d.label === 'Blockchain' ? { fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' } : {}}>{d.value}</span>
                            </div>
                        ))}
                        <div className="detail-row">
                            <span className="detail-label">Description</span>
                            <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{selectedComplaint.description || '—'}</span>
                        </div>
                    </div>
                    {selectedComplaint.tx_hash && (
                        <div style={{ background: '#eff6ff', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#1d4ed8' }}>link</span>
                            <a href={`https://amoy.polygonscan.com/tx/${selectedComplaint.tx_hash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#1d4ed8', fontFamily: 'Inter', textDecoration: 'none' }}>View on Polygonscan ↗</a>
                        </div>
                    )}
                    <div style={{ borderTop: '1px solid #f4f6f3', paddingTop: 16 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#a0a89b', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Update Status</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {Object.entries(COMPLAINT_STATUS_CONFIG).map(([k, v]) => {
                                const isCurrent = selectedComplaint.status === k
                                return (
                                    <button key={k} onClick={() => updateComplaintStatus(selectedComplaint.id, k)} disabled={isCurrent || updating}
                                        style={{ border: isCurrent ? `2px solid ${v.color}` : '1.5px solid #e4e9e0', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'Manrope', cursor: isCurrent ? 'default' : 'pointer', background: isCurrent ? v.bg : 'white', color: isCurrent ? v.color : '#41493e', opacity: updating ? 0.6 : 1 }}>
                                        {v.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </Modal>
            )}
        </DashboardLayout>
    )
}