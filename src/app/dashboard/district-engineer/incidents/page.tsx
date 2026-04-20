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
    { label: 'Bin Requests', href: '/dashboard/district-engineer/bin-requests', icon: 'delete_outline' },
  { label: 'Compliance', href: '/dashboard/district-engineer/compliance', icon: 'verified' },
  { label: 'Announcements', href: '/dashboard/district-engineer/announcements', icon: 'campaign' },
    { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

function severityStyle(s: string) {
    switch (s) {
        case 'low': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Low' }
        case 'medium': return { bg: '#fefce8', color: '#92400e', dot: '#d97706', label: 'Medium' }
        case 'high': return { bg: '#fff7ed', color: '#c2410c', dot: '#ea580c', label: 'High' }
        case 'critical': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Critical' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: s }
    }
}

function statusStyle(s: string) {
    switch (s) {
        case 'reported': return { bg: '#f0f9ff', color: '#0369a1', label: 'Reported' }
        case 'under_review': return { bg: '#fefce8', color: '#92400e', label: 'Under Review' }
        case 'in_progress': return { bg: '#fff7ed', color: '#c2410c', label: 'In Progress' }
        case 'resolved': return { bg: '#f0fdf4', color: '#00450d', label: 'Resolved' }
        case 'closed': return { bg: '#f8fafc', color: '#64748b', label: 'Closed' }
        default: return { bg: '#f8fafc', color: '#64748b', label: s }
    }
}

function typeLabel(t: string) { return t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }

export default function DEIncidentsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [incidents, setIncidents] = useState<any[]>([])
    const [selected, setSelected] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [filterSeverity, setFilterSeverity] = useState('all')
    const [activeTab, setActiveTab] = useState<'all' | 'open' | 'resolved'>('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data } = await supabase.from('incidents').select('*').eq('district', p?.district).order('created_at', { ascending: false })
        setIncidents(data || [])
        setLoading(false)
    }

    const filtered = incidents.filter(i => {
        const tabMatch = activeTab === 'all' ? true : activeTab === 'open' ? !['resolved', 'closed'].includes(i.status) : ['resolved', 'closed'].includes(i.status)
        return tabMatch && (filterSeverity === 'all' || i.severity === filterSeverity)
    })

    const stats = {
        total: incidents.length,
        open: incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length,
        critical: incidents.filter(i => i.severity === 'critical').length,
        resolved: incidents.filter(i => ['resolved', 'closed'].includes(i.status)).length,
    }

    return (
        <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}>
            <style>{`
        .material-symbols-outlined{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1;}
        .font-headline{font-family:'Manrope',sans-serif;}
        .bento-card{background:white;border-radius:16px;box-shadow:0 10px 40px -10px rgba(24,28,34,0.08);border:1px solid rgba(0,69,13,0.04);overflow:hidden;}
        .status-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;font-family:'Manrope',sans-serif;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;}
        .tab-btn{padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;font-family:'Manrope',sans-serif;cursor:pointer;border:none;transition:all 0.2s;}
        .tab-active{background:#00450d;color:white;} .tab-inactive{background:transparent;color:#717a6d;}
        .tab-inactive:hover{background:#f0fdf4;color:#00450d;}
        .incident-row{padding:16px 24px;border-bottom:1px solid rgba(0,69,13,0.04);display:flex;align-items:center;gap:16px;cursor:pointer;transition:background 0.15s;}
        .incident-row:hover{background:#f9fafb;} .incident-row:last-child{border-bottom:none;}
        .filter-btn{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;font-family:'Manrope',sans-serif;cursor:pointer;border:1.5px solid transparent;transition:all 0.2s;}
        .btn-primary{background:#00450d;color:white;border:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:700;font-family:'Manrope',sans-serif;cursor:pointer;display:flex;align-items:center;gap:8px;}
        @keyframes staggerIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .s1{animation:staggerIn 0.5s ease 0.05s both} .s2{animation:staggerIn 0.5s ease 0.1s both} .s3{animation:staggerIn 0.5s ease 0.15s both}
      `}</style>

            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif' }}>District Engineering · Field Incidents</span>
                <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Incident <span style={{ color: '#1b5e20' }}>Reports</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: '#717a6d' }}>Read-only view of contractor-reported incidents in {profile?.district}</p>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 s2">
                        {[
                            { label: 'Total', value: stats.total, color: '#00450d', bg: '#f0fdf4', icon: 'warning' },
                            { label: 'Open', value: stats.open, color: '#0369a1', bg: '#f0f9ff', icon: 'pending' },
                            { label: 'Critical', value: stats.critical, color: '#ba1a1a', bg: '#fef2f2', icon: 'emergency_home' },
                            { label: 'Resolved', value: stats.resolved, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                        ].map(s => (
                            <div key={s.label} className="bento-card p-5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
                                    <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '18px' }}>{s.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-2xl" style={{ color: '#181c22' }}>{s.value}</p>
                                <p className="text-xs font-bold uppercase mt-1" style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope,sans-serif' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 mb-4 s3">
                        {(['all', 'open', 'resolved'] as const).map(tab => (
                            <button key={tab} className={`tab-btn ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab(tab)}>
                                {tab === 'all' ? `All (${incidents.length})` : tab === 'open' ? `Open (${stats.open})` : `Resolved (${stats.resolved})`}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 mb-4 flex-wrap s3">
                        <span className="text-xs font-bold uppercase" style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope,sans-serif' }}>Severity:</span>
                        {['all', 'critical', 'high', 'medium', 'low'].map(f => {
                            const active = filterSeverity === f
                            const sv = f !== 'all' ? severityStyle(f) : { bg: '#f8fafc', color: '#64748b' }
                            return (
                                <button key={f} className="filter-btn" onClick={() => setFilterSeverity(f)}
                                    style={{ background: active ? (f === 'all' ? '#00450d' : sv.bg) : '#f8fafc', color: active ? (f === 'all' ? 'white' : sv.color) : '#64748b', borderColor: active ? 'transparent' : 'rgba(0,69,13,0.1)' }}>
                                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            )
                        })}
                    </div>

                    <div className="bento-card s3">
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>check_circle</span>
                                </div>
                                <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No incidents in your district</p>
                                <p className="text-sm" style={{ color: '#94a3b8' }}>Contractors will report incidents here</p>
                            </div>
                        ) : filtered.map(inc => {
                            const sev = severityStyle(inc.severity)
                            const sta = statusStyle(inc.status)
                            return (
                                <div key={inc.id} className="incident-row" onClick={() => setSelected(inc)}>
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: sev.bg }}>
                                        <span className="material-symbols-outlined" style={{ color: sev.color, fontSize: '22px' }}>warning</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <p className="text-sm font-bold truncate" style={{ color: '#181c22' }}>{inc.title}</p>
                                            <span className="status-badge" style={{ background: sev.bg, color: sev.color }}>
                                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sev.dot }} />{sev.label}
                                            </span>
                                            <span className="status-badge" style={{ background: sta.bg, color: sta.color }}>{sta.label}</span>
                                        </div>
                                        <p className="text-xs" style={{ color: '#717a6d' }}>{typeLabel(inc.type)} · {inc.ward || inc.district || 'Unknown'} · {new Date(inc.created_at).toLocaleDateString('en-GB')}</p>
                                    </div>
                                    <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>chevron_right</span>
                                </div>
                            )
                        })}
                    </div>

                    {selected && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-2xl bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h3 className="font-headline font-bold text-xl mb-2" style={{ color: '#181c22' }}>{selected.title}</h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="status-badge" style={{ background: severityStyle(selected.severity).bg, color: severityStyle(selected.severity).color }}>
                                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: severityStyle(selected.severity).dot }} />{severityStyle(selected.severity).label}
                                            </span>
                                            <span className="status-badge" style={{ background: statusStyle(selected.status).bg, color: statusStyle(selected.status).color }}>{statusStyle(selected.status).label}</span>
                                            <span className="status-badge" style={{ background: '#f0fdf4', color: '#00450d' }}>Read-only</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelected(null)} style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[
                                        { label: 'Type', value: typeLabel(selected.type) },
                                        { label: 'Location', value: selected.location_address || 'Not specified' },
                                        { label: 'Ward', value: selected.ward || 'N/A' },
                                        { label: 'District', value: selected.district || 'N/A' },
                                        { label: 'Reported', value: new Date(selected.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                                        { label: 'Resolved', value: selected.resolved_at ? new Date(selected.resolved_at).toLocaleDateString('en-GB') : 'Not yet' },
                                    ].map(item => (
                                        <div key={item.label} className="p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                                            <p className="text-xs font-bold uppercase mb-1" style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope,sans-serif' }}>{item.label}</p>
                                            <p className="text-sm font-semibold" style={{ color: '#181c22' }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 rounded-xl mb-6" style={{ background: '#f8fafc' }}>
                                    <p className="text-xs font-bold uppercase mb-2" style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope,sans-serif' }}>Description</p>
                                    <p className="text-sm leading-relaxed" style={{ color: '#4b5563' }}>{selected.description}</p>
                                </div>
                                {selected.resolution_notes && (
                                    <div className="p-4 rounded-xl mb-6" style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                                        <p className="text-xs font-bold uppercase mb-2" style={{ color: '#00450d', letterSpacing: '0.08em', fontFamily: 'Manrope,sans-serif' }}>Resolution Notes</p>
                                        <p className="text-sm" style={{ color: '#00450d' }}>{selected.resolution_notes}</p>
                                    </div>
                                )}
                                <button className="btn-primary w-full justify-center" onClick={() => setSelected(null)}>Close</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}