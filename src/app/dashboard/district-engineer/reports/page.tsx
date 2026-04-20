'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
    { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
    { label: 'History', href: '/dashboard/district-engineer/collection-history', icon: 'history' },
    { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
    { label: 'Heatmap', href: '/dashboard/district-engineer/heatmap', icon: 'thermostat' },
    { label: 'Reports', href: '/dashboard/district-engineer/reports', icon: 'report_problem' },
    { label: 'Incidents', href: '/dashboard/district-engineer/incidents', icon: 'warning' },
    { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
    { label: 'Announcements', href: '/dashboard/district-engineer/announcements', icon: 'campaign' },
  { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

const COMPLAINT_TYPES: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    missed_collection: { label: 'Missed Collection', icon: 'delete', color: '#d97706', bg: '#fefce8' },
    delayed_collection: { label: 'Delayed Collection', icon: 'schedule', color: '#d97706', bg: '#fefce8' },
    illegal_dumping: { label: 'Illegal Dumping', icon: 'delete_forever', color: '#ba1a1a', bg: '#fef2f2' },
    bin_damage: { label: 'Bin Damage', icon: 'broken_image', color: '#7c3aed', bg: '#f5f3ff' },
    collection_time: { label: 'Collection Time', icon: 'schedule', color: '#1d4ed8', bg: '#eff6ff' },
    noise_complaint: { label: 'Noise Complaint', icon: 'volume_up', color: '#0891b2', bg: '#ecfeff' },
    driver_behaviour: { label: 'Driver Behaviour', icon: 'person_off', color: '#be185d', bg: '#fdf2f8' },
    billing_issue: { label: 'Billing Issue', icon: 'receipt_long', color: '#0891b2', bg: '#ecfeff' },
    collection_refusal: { label: 'Collection Refusal', icon: 'block', color: '#b45309', bg: '#fffbeb' },
    other: { label: 'Other', icon: 'report', color: '#64748b', bg: '#f8fafc' },
}

const WASTE_REPORT_TYPES: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    illegal_dumping: { label: 'Illegal Dumping', icon: 'delete_forever', color: '#ba1a1a', bg: '#fef2f2' },
    missed_collection: { label: 'Missed Collection', icon: 'delete', color: '#d97706', bg: '#fefce8' },
    blocked_drainage: { label: 'Blocked Drainage', icon: 'water_damage', color: '#1d4ed8', bg: '#eff6ff' },
    overflowing_bin: { label: 'Overflowing Bin', icon: 'delete_sweep', color: '#d97706', bg: '#fefce8' },
    other: { label: 'Other', icon: 'report', color: '#7c3aed', bg: '#f5f3ff' },
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    submitted: { label: 'Submitted', color: '#92400e', bg: '#fefce8', dot: '#d97706' },
    pending: { label: 'Pending', color: '#92400e', bg: '#fefce8', dot: '#d97706' },
    in_progress: { label: 'In Progress', color: '#1d4ed8', bg: '#eff6ff', dot: '#3b82f6' },
    assigned: { label: 'Assigned', color: '#1d4ed8', bg: '#eff6ff', dot: '#3b82f6' },
    resolved: { label: 'Resolved', color: '#00450d', bg: '#f0fdf4', dot: '#16a34a' },
}

interface FeedItem {
    id: string
    kind: 'complaint' | 'waste_report'
    type: string
    custom_type?: string
    description: string
    status: string
    created_at: string
    reporter_name: string
    location_address?: string
    latitude?: number | null
    longitude?: number | null
    photo_url?: string | null
    resolution_notes?: string | null
    assigned_to?: string | null
}

export default function DEReportsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [items, setItems] = useState<FeedItem[]>([])
    const [supervisors, setSupervisors] = useState<{ id: string; full_name: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'all' | 'complaints' | 'waste_reports'>('all')
    const [filterStatus, setFilterStatus] = useState('all')
    const [selected, setSelected] = useState<FeedItem | null>(null)
    const [resolutionNotes, setResolutionNotes] = useState('')
    const [assignTo, setAssignTo] = useState('')
    const [updating, setUpdating] = useState(false)
    const [toast, setToast] = useState('')

    useEffect(() => { loadData() }, [])

    function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const district = p?.district || ''

        const [complaintsRes, reportsRes, supRes] = await Promise.all([
            supabase.from('complaints').select('*, profiles!submitted_by(full_name)').eq('district', district).order('created_at', { ascending: false }),
            supabase.from('waste_reports').select('*, profiles!submitted_by(full_name)').eq('district', district).order('created_at', { ascending: false }),
            supabase.from('profiles').select('id, full_name').eq('role', 'supervisor').eq('district', district),
        ])

        const complaints: FeedItem[] = (complaintsRes.data || []).map((c: any) => ({
            id: c.id, kind: 'complaint',
            type: c.complaint_type || 'other',
            custom_type: c.custom_complaint_type,
            description: c.description, status: c.status,
            created_at: c.created_at,
            reporter_name: c.profiles?.full_name || 'Unknown',
            resolution_notes: c.resolution_notes,
        }))

        const wasteReports: FeedItem[] = (reportsRes.data || []).map((r: any) => ({
            id: r.id, kind: 'waste_report',
            type: r.report_type || 'other',
            description: r.description, status: r.status,
            created_at: r.created_at,
            reporter_name: r.profiles?.full_name || 'Unknown',
            location_address: r.location_address,
            latitude: r.latitude, longitude: r.longitude,
            photo_url: r.photo_url,
            resolution_notes: r.resolution_notes,
            assigned_to: r.assigned_to,
        }))

        // Merge and sort by date
        const merged = [...complaints, ...wasteReports].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        setItems(merged)
        setSupervisors(supRes.data || [])
        setLoading(false)
    }

    async function updateStatus(item: FeedItem, status: string) {
        setUpdating(true)
        const supabase = createClient()
        const table = item.kind === 'complaint' ? 'complaints' : 'waste_reports'
        const update: any = { status, resolution_notes: resolutionNotes || null }
        if (item.kind === 'waste_report') update.assigned_to = assignTo || null
        await supabase.from(table).update(update).eq('id', item.id)
        showToast(`Marked as ${status.replace('_', ' ')}`)
        setSelected(null); setResolutionNotes(''); setAssignTo('')
        await loadData(); setUpdating(false)
    }

    function getTypeInfo(item: FeedItem) {
        if (item.kind === 'complaint') return COMPLAINT_TYPES[item.type] || COMPLAINT_TYPES.other
        return WASTE_REPORT_TYPES[item.type] || WASTE_REPORT_TYPES.other
    }

    function getTypeLabel(item: FeedItem) {
        return item.custom_type || getTypeInfo(item).label
    }

    // Filtered list
    const displayed = items.filter(i => {
        if (tab === 'complaints' && i.kind !== 'complaint') return false
        if (tab === 'waste_reports' && i.kind !== 'waste_report') return false
        if (filterStatus === 'pending' && !['pending', 'submitted'].includes(i.status)) return false
        if (filterStatus === 'in_progress' && !['in_progress', 'assigned'].includes(i.status)) return false
        if (filterStatus === 'resolved' && i.status !== 'resolved') return false
        return true
    })

    const complaints = items.filter(i => i.kind === 'complaint')
    const wasteReports = items.filter(i => i.kind === 'waste_report')
    const totalPending = items.filter(i => ['pending', 'submitted', 'assigned', 'in_progress'].includes(i.status)).length
    const totalResolved = items.filter(i => i.status === 'resolved').length

    return (
        <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}>
            <style>{`
        .msym { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msym-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; border:1px solid rgba(0,69,13,0.07); box-shadow:0 1px 3px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.04); overflow:hidden; }
        .stat-card { padding:20px 22px; cursor:pointer; transition:all 0.2s; }
        .stat-card:hover { transform:translateY(-2px); box-shadow:0 4px 20px rgba(0,69,13,0.1); }
        .tab-btn { padding:8px 20px; border-radius:99px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px; white-space:nowrap; }
        .tab-btn.on { background:#00450d; color:white; }
        .tab-btn.off { background:transparent; color:#64748b; }
        .tab-btn.off:hover { background:#f1f5f9; }
        .pill-btn { padding:5px 14px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .pill-btn.on { background:#00450d; color:white; }
        .pill-btn.off { background:#f1f5f9; color:#64748b; }
        .pill-btn.off:hover { background:#e2e8f0; }
        .feed-row { padding:15px 20px; border-bottom:1px solid rgba(0,69,13,0.05); display:flex; align-items:flex-start; gap:13px; transition:background 0.15s; }
        .feed-row:hover { background:#f9fdf9; }
        .feed-row:last-child { border-bottom:none; }
        .badge { display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .field { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; color:#181c22; background:#fafafa; outline:none; resize:vertical; box-sizing:border-box; transition:all 0.2s; }
        .field:focus { border-color:#00450d; box-shadow:0 0 0 3px rgba(0,69,13,0.08); background:white; }
        .select-field { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; color:#181c22; background:#fafafa; outline:none; cursor:pointer; appearance:none; box-sizing:border-box; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23717a6d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; background-size:14px; padding-right:36px; transition:all 0.2s; }
        .select-field:focus { border-color:#00450d; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .action-btn { padding:11px 16px; border-radius:10px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:none; display:flex; align-items:center; gap:6px; flex:1; justify-content:center; transition:all 0.2s; }
        .action-btn:disabled { opacity:0.6; cursor:not-allowed; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .1s both} .a3{animation:fadeUp .4s ease .16s both}
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(12px) translateX(-50%);opacity:0} to{transform:translateY(0) translateX(-50%);opacity:1} }
        .toast-pill { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#181c22; color:white; padding:10px 20px; border-radius:99px; font-size:13px; font-weight:500; z-index:1000; display:flex; align-items:center; gap:8px; box-shadow:0 4px 20px rgba(0,0,0,0.2); animation:slideUp .3s ease; white-space:nowrap; }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

            {toast && (
                <div className="toast-pill">
                    <span className="msym-fill" style={{ fontSize: 15, color: '#4ade80' }}>check_circle</span>{toast}
                </div>
            )}

            {/* Update modal */}
            {selected && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'fadeIn .2s ease' }}
                    onClick={() => setSelected(null)}>
                    <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 500, boxShadow: '0 24px 60px rgba(0,0,0,0.18)', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}>
                        {/* Modal header */}
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: getTypeInfo(selected).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span className="msym" style={{ fontSize: 18, color: getTypeInfo(selected).color }}>{getTypeInfo(selected).icon}</span>
                                </div>
                                <div>
                                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', margin: '0 0 2px' }}>
                                        Update {selected.kind === 'complaint' ? 'Complaint' : 'Waste Report'}
                                    </h3>
                                    <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>
                                        {getTypeLabel(selected)} · by {selected.reporter_name}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelected(null)} style={{ width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="msym" style={{ fontSize: 16, color: '#64748b' }}>close</span>
                            </button>
                        </div>

                        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px' }}>
                                <p style={{ fontSize: 13, color: '#41493e', lineHeight: 1.6, margin: '0 0 8px' }}>{selected.description}</p>
                                {selected.location_address && (
                                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span className="msym" style={{ fontSize: 13 }}>location_on</span>{selected.location_address}
                                    </p>
                                )}
                                {selected.latitude && selected.longitude && (
                                    <a href={`https://maps.google.com/?q=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer"
                                        style={{ fontSize: 12, color: '#00450d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontFamily: 'Manrope,sans-serif' }}>
                                        <span className="msym" style={{ fontSize: 13 }}>open_in_new</span>View on Google Maps
                                    </a>
                                )}
                                <p style={{ fontSize: 11, color: '#94a3b8', margin: '8px 0 0' }}>
                                    {new Date(selected.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>

                            {selected.photo_url && (
                                <img src={selected.photo_url} alt="Evidence" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }} />
                            )}

                            {selected.kind === 'waste_report' && supervisors.length > 0 && (
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>
                                        Assign to Supervisor
                                    </label>
                                    <select className="select-field" value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                                        <option value="">— No assignment —</option>
                                        {supervisors.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>
                                    Resolution Notes
                                </label>
                                <textarea className="field" rows={3} placeholder="Describe the action taken or planned…"
                                    value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} />
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                {selected.kind === 'waste_report' ? (
                                    <button className="action-btn" onClick={() => updateStatus(selected, 'assigned')}
                                        disabled={updating} style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                                        <span className="msym" style={{ fontSize: 15 }}>assignment_ind</span>Assign
                                    </button>
                                ) : (
                                    <button className="action-btn" onClick={() => updateStatus(selected, 'in_progress')}
                                        disabled={updating} style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                                        <span className="msym" style={{ fontSize: 15 }}>pending</span>In Progress
                                    </button>
                                )}
                                <button className="action-btn" onClick={() => updateStatus(selected, 'resolved')}
                                    disabled={updating} style={{ background: '#f0fdf4', color: '#00450d' }}>
                                    <span className="msym" style={{ fontSize: 15 }}>check_circle</span>Resolved
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <div className="a1" style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>
                    District Engineering
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <h1 style={{ fontSize: 40, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: 0, letterSpacing: '-0.02em' }}>
                        District <span style={{ color: '#1b5e20' }}>Reports</span>
                    </h1>
                    <span style={{ fontSize: 12, color: '#00450d', fontWeight: 700, padding: '6px 14px', borderRadius: 99, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.12)', fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span className="msym" style={{ fontSize: 14 }}>location_on</span>{profile?.district}
                    </span>
                </div>
            </div>

            {/* ── Stats ── */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
                {[
                    {
                        label: 'Total', value: items.length, icon: 'inbox', color: '#00450d', bg: '#f0fdf4',
                        sub: `${complaints.length} complaints · ${wasteReports.length} reports`
                    },
                    {
                        label: 'Complaints', value: complaints.length, icon: 'feedback', color: '#d97706', bg: '#fefce8',
                        sub: `${complaints.filter(c => ['pending', 'submitted', 'in_progress'].includes(c.status)).length} open`
                    },
                    {
                        label: 'Waste Reports', value: wasteReports.length, icon: 'report', color: '#ba1a1a', bg: '#fef2f2',
                        sub: `${wasteReports.filter(r => ['pending', 'assigned'].includes(r.status)).length} pending`
                    },
                    {
                        label: 'Resolved', value: totalResolved, icon: 'check_circle', color: '#16a34a', bg: '#f0fdf4',
                        sub: `${totalPending} still open`
                    },
                ].map(m => (
                    <div key={m.label} className="card stat-card">
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 11, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="msym" style={{ fontSize: 19, color: m.color }}>{m.icon}</span>
                            </div>
                        </div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 32, color: '#181c22', margin: '0 0 3px', lineHeight: 1, letterSpacing: '-0.02em' }}>{m.value}</p>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: '0 0 4px' }}>{m.label}</p>
                        <p style={{ fontSize: 11, color: '#717a6d', margin: 0 }}>{m.sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Tabs + filters ── */}
            <div className="a3 card">
                {/* Tab bar */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: '#fafdf9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 99 }}>
                        {([
                            { key: 'all', label: 'All', count: items.length },
                            { key: 'complaints', label: 'Complaints', count: complaints.length },
                            { key: 'waste_reports', label: 'Waste Reports', count: wasteReports.length },
                        ] as const).map(t => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`tab-btn ${tab === t.key ? 'on' : 'off'}`}>
                                {t.label}
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: tab === t.key ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.07)', color: tab === t.key ? 'white' : '#64748b' }}>
                                    {t.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Status filters */}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {[
                            { key: 'all', label: 'All' },
                            { key: 'pending', label: 'Pending' },
                            { key: 'in_progress', label: 'In Progress' },
                            { key: 'resolved', label: 'Resolved' },
                        ].map(f => (
                            <button key={f.key} onClick={() => setFilterStatus(f.key)}
                                className={`pill-btn ${filterStatus === f.key ? 'on' : 'off'}`}>{f.label}</button>
                        ))}
                    </div>
                </div>

                {/* Feed */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                        <div style={{ width: 26, height: 26, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                    </div>
                ) : displayed.length === 0 ? (
                    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <span className="msym-fill" style={{ color: '#00450d', fontSize: 26 }}>check_circle</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', marginBottom: 5 }}>All clear</p>
                        <p style={{ fontSize: 13, color: '#94a3b8' }}>No {tab === 'all' ? '' : tab.replace('_', ' ')} reports in your district.</p>
                    </div>
                ) : displayed.map(item => {
                    const ti = getTypeInfo(item)
                    const sc = STATUS_CFG[item.status] || STATUS_CFG.pending
                    const canUpdate = item.status !== 'resolved'
                    const isWaste = item.kind === 'waste_report'

                    return (
                        <div key={`${item.kind}-${item.id}`} className="feed-row">
                            {/* Type icon */}
                            <div style={{ width: 38, height: 38, borderRadius: 11, background: ti.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="msym" style={{ fontSize: 19, color: ti.color }}>{ti.icon}</span>
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Title row */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{getTypeLabel(item)}</p>
                                    {/* Kind badge */}
                                    <span className="badge" style={{ background: isWaste ? '#fef2f2' : '#fefce8', color: isWaste ? '#ba1a1a' : '#d97706' }}>
                                        <span className="msym" style={{ fontSize: 10 }}>{isWaste ? 'eco' : 'feedback'}</span>
                                        {isWaste ? 'Env' : 'Service'}
                                    </span>
                                    {/* Status badge */}
                                    <span className="badge" style={{ background: sc.bg, color: sc.color }}>
                                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                                        {sc.label}
                                    </span>
                                </div>

                                {/* Description */}
                                <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 5 }}>
                                    {item.description.length > 130 ? item.description.slice(0, 130) + '…' : item.description}
                                </p>

                                {/* Meta */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: '#94a3b8' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <span className="msym" style={{ fontSize: 12 }}>person</span>{item.reporter_name}
                                    </span>
                                    {item.location_address && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <span className="msym" style={{ fontSize: 12 }}>location_on</span>{item.location_address}
                                        </span>
                                    )}
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <span className="msym" style={{ fontSize: 12 }}>schedule</span>
                                        {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>

                                {item.resolution_notes && (
                                    <p style={{ fontSize: 11, color: '#717a6d', marginTop: 5, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span className="msym" style={{ fontSize: 12 }}>sticky_note_2</span>{item.resolution_notes}
                                    </p>
                                )}
                            </div>

                            {/* Right side: photo + update */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                {item.photo_url && (
                                    <img src={item.photo_url} alt="Evidence" style={{ width: 44, height: 44, borderRadius: 9, objectFit: 'cover', border: '1px solid rgba(0,0,0,0.06)' }} />
                                )}
                                {canUpdate && (
                                    <button onClick={() => { setSelected(item); setResolutionNotes(item.resolution_notes || ''); setAssignTo(item.assigned_to || '') }}
                                        style={{ padding: '5px 12px', borderRadius: 8, background: '#f0fdf4', color: '#00450d', fontSize: 11, fontWeight: 700, border: '1px solid rgba(0,69,13,0.1)', cursor: 'pointer', fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                                        <span className="msym" style={{ fontSize: 13 }}>edit</span>Update
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </DashboardLayout>
    )
}