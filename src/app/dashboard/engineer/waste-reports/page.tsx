'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ENGINEER_NAV = [
    { label: 'Overview', href: '/dashboard/engineer', icon: 'dashboard' },
    { label: 'Routes', href: '/dashboard/engineer/routes', icon: 'route' },
    { label: 'Complaints', href: '/dashboard/engineer/complaints', icon: 'feedback' },
    { label: 'Waste Reports', href: '/dashboard/engineer/waste-reports', icon: 'report' },
    { label: 'Analytics', href: '/dashboard/engineer/analytics', icon: 'analytics' },
    { label: 'Profile', href: '/dashboard/engineer/profile', icon: 'person' },
]

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    pending: { color: '#d97706', bg: '#fffbeb', label: 'Pending' },
    in_progress: { color: '#1d4ed8', bg: '#eff6ff', label: 'In Progress' },
    resolved: { color: '#00450d', bg: '#f0fdf4', label: 'Resolved' },
    dismissed: { color: '#64748b', bg: '#f8fafc', label: 'Dismissed' },
}

const TYPE_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
    illegal_dumping: { icon: 'delete_forever', color: '#dc2626', bg: '#fef2f2' },
    overflowing_bin: { icon: 'delete_sweep', color: '#d97706', bg: '#fffbeb' },
    hazardous_waste: { icon: 'warning', color: '#b45309', bg: '#fefce8' },
    burning_waste: { icon: 'local_fire_department', color: '#ea580c', bg: '#fff7ed' },
}

export default function EngineerWasteReportsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [reports, setReports] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [message, setMessage] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data } = await supabase
            .from('waste_reports')
            .select('*, submitter:submitted_by(full_name, role)')
            .order('created_at', { ascending: false })
        setReports(data || [])
        setLoading(false)
    }

    async function updateStatus(id: string, status: string) {
        setSaving(id)
        const supabase = createClient()
        await supabase.from('waste_reports').update({ status }).eq('id', id)
        setMessage('Status updated')
        setTimeout(() => setMessage(''), 3000)
        await loadData()
        setSaving(null)
    }

    const filtered = reports.filter(r => {
        const matchStatus = filterStatus === 'all' || r.status === filterStatus
        const matchSearch = !search || r.report_type?.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase()) || r.location_address?.toLowerCase().includes(search.toLowerCase())
        return matchStatus && matchSearch
    })

    return (
        <DashboardLayout role="Engineer" userName={profile?.full_name || ''} navItems={ENGINEER_NAV}>
            <style>{`
        .ms{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
        .badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;font-family:'Manrope',sans-serif;letter-spacing:0.06em;text-transform:uppercase}
        .filter-btn{padding:7px 16px;border-radius:99px;font-size:12px;font-weight:700;font-family:'Manrope',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
        .filter-btn.active{background:#00450d;color:white}
        .filter-btn:not(.active){background:#f1f5f9;color:#64748b}
        .row{padding:16px 24px;border-bottom:1px solid rgba(0,69,13,0.04);display:flex;align-items:flex-start;gap:16px;transition:background 0.15s}
        .row:hover{background:#f9fbf9}
        .row:last-child{border-bottom:none}
        .status-select{padding:5px 10px;border:1.5px solid #e4e9e0;border-radius:8px;font-size:12px;font-family:'Inter',sans-serif;outline:none;cursor:pointer;background:#fafbf9;color:#181c22}
        .status-select:focus{border-color:#00450d}
        .toast{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:12px;padding:12px 16px;font-size:13px;font-family:'Inter',sans-serif;display:flex;align-items:center;gap:8px;margin-bottom:16px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .a1{animation:fadeUp .4s ease .04s both}.a2{animation:fadeUp .4s ease .09s both}.a3{animation:fadeUp .4s ease .14s both}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

            <div className="a1" style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>Municipal Engineer</p>
                <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: 0 }}>
                    Waste <span style={{ color: '#00450d' }}>Reports</span>
                </h1>
                <p style={{ fontSize: 13, color: '#717a6d', margin: '4px 0 0' }}>Environmental waste reports submitted by residents</p>
            </div>

            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Total', value: reports.length, icon: 'report', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Pending', value: reports.filter(r => r.status === 'pending').length, icon: 'pending', color: '#d97706', bg: '#fffbeb' },
                    { label: 'In Progress', value: reports.filter(r => r.status === 'in_progress').length, icon: 'sync', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Resolved', value: reports.filter(r => r.status === 'resolved').length, icon: 'check_circle', color: '#00450d', bg: '#f0fdf4' },
                ].map(m => (
                    <div key={m.label} className="card" style={{ padding: 20 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                            <span className="ms" style={{ color: m.color, fontSize: 18 }}>{m.icon}</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 28, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                        <p style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {message && (
                <div className="toast a2"><span className="ms" style={{ fontSize: 16 }}>check_circle</span>{message}</div>
            )}

            <div className="card a3">
                <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0,69,13,0.05)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: 0 }}>All Reports</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative' }}>
                            <span className="ms" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#94a3b8' }}>search</span>
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports…"
                                style={{ paddingLeft: 34, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: '1.5px solid #e4e9e0', borderRadius: 99, fontSize: 13, fontFamily: 'Inter,sans-serif', outline: 'none', background: '#fafbf9', width: 180, color: '#181c22' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {['all', 'pending', 'in_progress', 'resolved'].map(s => (
                                <button key={s} onClick={() => setFilterStatus(s)} className={`filter-btn ${filterStatus === s ? 'active' : ''}`}>
                                    {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                        <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <span className="ms" style={{ fontSize: 40, color: '#e2e8f0' }}>report</span>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', marginTop: 12 }}>No reports found</p>
                    </div>
                ) : filtered.map(r => {
                    const ts = TYPE_STYLE[r.report_type] || { icon: 'report', color: '#64748b', bg: '#f8fafc' }
                    const ss = STATUS_STYLE[r.status] || STATUS_STYLE.pending
                    return (
                        <div key={r.id} className="row">
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: ts.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="ms" style={{ fontSize: 20, color: ts.color }}>{ts.icon}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <p style={{ fontSize: 14, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0 }}>
                                        {r.report_type?.replace(/_/g, ' ').replace(/\b\w/g, (x: string) => x.toUpperCase()) || 'Report'}
                                    </p>
                                    <span className="badge" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                                    {r.district && <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>{r.district}</span>}
                                </div>
                                <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, margin: '0 0 5px' }}>
                                    {r.description?.length > 120 ? r.description.slice(0, 120) + '…' : r.description}
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#94a3b8' }}>
                                    {r.location_address && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="ms" style={{ fontSize: 13 }}>location_on</span>{r.location_address.length > 40 ? r.location_address.slice(0, 40) + '…' : r.location_address}</span>}
                                    {r.submitter && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="ms" style={{ fontSize: 13 }}>person</span>{r.submitter.full_name}</span>}
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="ms" style={{ fontSize: 13 }}>calendar_today</span>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                            </div>
                            {r.photo_url && (
                                <img src={r.photo_url} alt="Evidence" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(0,0,0,0.06)' }} />
                            )}
                            <div style={{ flexShrink: 0 }}>
                                <select className="status-select" value={r.status} disabled={saving === r.id}
                                    onChange={e => updateStatus(r.id, e.target.value)}>
                                    {Object.entries(STATUS_STYLE).map(([val, s]) => (
                                        <option key={val} value={val}>{s.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )
                })}

                <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(0,69,13,0.05)', background: '#fafbf9' }}>
                    <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>Showing {filtered.length} of {reports.length} reports</p>
                </div>
            </div>
        </DashboardLayout>
    )
}