'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
    { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
    { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
    { label: 'Heatmap', href: '/dashboard/district-engineer/heatmap', icon: 'thermostat' },
    { label: 'Complaints', href: '/dashboard/district-engineer/complaints', icon: 'feedback' },
    { label: 'Waste Reports', href: '/dashboard/district-engineer/waste-reports', icon: 'report' },
    { label: 'Incidents', href: '/dashboard/district-engineer/incidents', icon: 'warning' },
    { label: 'Announcements', href: '/dashboard/district-engineer/announcements', icon: 'campaign' },
    { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
    { label: 'Zones', href: '/dashboard/district-engineer/zones', icon: 'map' },
    { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

const PRIORITY_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    normal: { color: '#00450d', bg: '#f0fdf4', label: 'Normal' },
    important: { color: '#d97706', bg: '#fefce8', label: 'Important' },
    urgent: { color: '#ba1a1a', bg: '#fef2f2', label: 'Urgent' },
}

const DISTRICT_ROLES = [
    { value: 'supervisor', label: 'Supervisors' },
    { value: 'driver', label: 'Drivers' },
    { value: 'contractor', label: 'Contractors' },
]

export default function DEAnnouncementsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState('')
    const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active')
    const [expanded, setExpanded] = useState<string | null>(null)
    const [form, setForm] = useState({ title: '', body: '', priority: 'normal', target_roles: [] as string[] })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data } = await supabase.from('announcements').select('*, profiles!created_by(full_name)')
            .or(`district.eq.${p?.district},district.is.null`)
            .order('created_at', { ascending: false })
        setAnnouncements(data || [])
        setLoading(false)
    }

    async function createAnnouncement() {
        if (!form.title.trim() || !form.body.trim()) { setMessage('Title and body are required.'); return }
        setSubmitting(true); setMessage('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('announcements').insert({
            title: form.title.trim(), body: form.body.trim(), priority: form.priority,
            target_roles: form.target_roles.length > 0 ? form.target_roles : DISTRICT_ROLES.map(r => r.value),
            district: profile?.district, created_by: user?.id, archived: false,
        })
        if (error) { setMessage('Error: ' + error.message) }
        else {
            setMessage('Announcement published to your district!')
            setShowForm(false)
            setForm({ title: '', body: '', priority: 'normal', target_roles: [] })
            loadData()
        }
        setSubmitting(false)
    }

    async function toggleArchive(id: string, archived: boolean) {
        const supabase = createClient()
        await supabase.from('announcements').update({ archived: !archived }).eq('id', id)
        loadData()
    }

    function toggleRole(role: string) {
        setForm(f => ({ ...f, target_roles: f.target_roles.includes(role) ? f.target_roles.filter(r => r !== role) : [...f.target_roles, role] }))
    }

    const filtered = announcements.filter(a => activeTab === 'active' ? !a.archived : a.archived)
    const mine = announcements.filter(a => !a.archived)

    return (
        <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}>
            <style>{`
        .material-symbols-outlined{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1;}
        .font-headline{font-family:'Manrope',sans-serif;}
        .bento-card{background:white;border-radius:16px;box-shadow:0 10px 40px -10px rgba(24,28,34,0.08);border:1px solid rgba(0,69,13,0.04);overflow:hidden;}
        .tab-btn{padding:8px 20px;border-radius:99px;font-size:13px;font-weight:700;font-family:'Manrope',sans-serif;border:none;cursor:pointer;transition:all 0.2s;}
        .tab-active{background:#00450d;color:white;} .tab-inactive{background:#f1f5f9;color:#64748b;}
        .form-field{width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;color:#181c22;font-family:'Inter',sans-serif;background:#fafafa;transition:all 0.2s;outline:none;box-sizing:border-box;}
        .form-field:focus{border-color:#00450d;background:white;box-shadow:0 0 0 3px rgba(0,69,13,0.08);}
        .field-label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#374151;font-family:'Manrope',sans-serif;margin-bottom:7px;}
        .btn-primary{background:#00450d;color:white;border:none;border-radius:10px;padding:12px 24px;font-family:'Manrope',sans-serif;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:opacity 0.2s;}
        .btn-primary:hover{opacity:0.88;} .btn-primary:disabled{opacity:0.5;cursor:not-allowed;}
        .role-pill{padding:5px 12px;border-radius:99px;font-size:12px;font-weight:700;font-family:'Manrope',sans-serif;cursor:pointer;border:1.5px solid;transition:all 0.2s;}
        .ann-row{padding:18px 24px;border-bottom:1px solid rgba(0,69,13,0.04);cursor:pointer;transition:background 0.15s;}
        .ann-row:hover{background:#f9f9ff;} .ann-row:last-child{border-bottom:none;}
        @keyframes staggerIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .s1{animation:staggerIn 0.5s ease 0.05s both} .s2{animation:staggerIn 0.5s ease 0.1s both} .s3{animation:staggerIn 0.5s ease 0.15s both}
      `}</style>

            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif' }}>District Engineering · {profile?.district}</span>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                        <span style={{ color: '#1b5e20' }}>Announcements</span>
                    </h1>
                    <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showForm ? 'close' : 'add'}</span>
                        {showForm ? 'Cancel' : 'New Announcement'}
                    </button>
                </div>
            </section>

            {message && (
                <div className="mb-6 flex items-center gap-3 p-4 rounded-xl text-sm s2"
                    style={{ background: message.startsWith('Error') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${message.startsWith('Error') ? 'rgba(186,26,26,0.2)' : 'rgba(0,69,13,0.15)'}`, color: message.startsWith('Error') ? '#ba1a1a' : '#00450d' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
                    {message}
                </div>
            )}

            {showForm && (
                <div className="bento-card mb-8 s2">
                    <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Create District Announcement</h3>
                        <p className="text-sm mt-1" style={{ color: '#717a6d' }}>Visible to operational staff in {profile?.district}</p>
                    </div>
                    <div className="p-8 space-y-5">
                        <div>
                            <label className="field-label">Title *</label>
                            <input className="form-field" placeholder="e.g. Route change for Ward 5 this Friday" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div>
                            <label className="field-label">Body *</label>
                            <textarea className="form-field" rows={4} placeholder="Full details..." value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} style={{ resize: 'vertical' }} />
                        </div>
                        <div>
                            <label className="field-label">Priority</label>
                            <select className="form-field" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                                <option value="normal">Normal</option>
                                <option value="important">Important</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <div>
                            <label className="field-label">Target Roles <span style={{ color: '#94a3b8', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(blank = all district roles)</span></label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                {DISTRICT_ROLES.map(r => {
                                    const selected = form.target_roles.includes(r.value)
                                    return (
                                        <button key={r.value} type="button" className="role-pill" onClick={() => toggleRole(r.value)}
                                            style={{ background: selected ? '#00450d' : 'white', color: selected ? 'white' : '#64748b', borderColor: selected ? '#00450d' : '#e5e7eb' }}>
                                            {r.label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button className="btn-primary" onClick={createAnnouncement} disabled={submitting}>
                                {submitting ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'white', borderTopColor: 'transparent' }} /> : <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>campaign</span>Publish</>}
                            </button>
                            <button onClick={() => setShowForm(false)} style={{ padding: '12px 24px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: '#64748b' }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex gap-2 mb-4 s3">
                <button className={`tab-btn ${activeTab === 'active' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('active')}>Active ({mine.length})</button>
                <button className={`tab-btn ${activeTab === 'archived' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('archived')}>Archived ({announcements.filter(a => a.archived).length})</button>
            </div>

            <div className="bento-card s3">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} /></div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>campaign</span>
                        </div>
                        <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No announcements</p>
                        {activeTab === 'active' && <p className="text-sm" style={{ color: '#94a3b8' }}>Create one to notify your district staff</p>}
                    </div>
                ) : filtered.map(ann => {
                    const ps = PRIORITY_STYLE[ann.priority] || PRIORITY_STYLE.normal
                    const isExpanded = expanded === ann.id
                    const isOwn = ann.district === profile?.district
                    return (
                        <div key={ann.id} className="ann-row" onClick={() => setExpanded(isExpanded ? null : ann.id)}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0, background: ps.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ color: ps.color, fontSize: '18px' }}>campaign</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{ann.title}</p>
                                        {ann.priority !== 'normal' && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: ps.bg, color: ps.color, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Manrope,sans-serif' }}>{ps.label}</span>}
                                        {!isOwn && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: '#eff6ff', color: '#1d4ed8', fontFamily: 'Manrope,sans-serif' }}>System-wide</span>}
                                    </div>
                                    {isExpanded ? <p style={{ fontSize: '13px', color: '#41493e', lineHeight: 1.6, marginBottom: '6px' }}>{ann.body}</p> : <p style={{ fontSize: '13px', color: '#717a6d', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ann.body}</p>}
                                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0' }}>{new Date(ann.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                    {isOwn && (
                                        <button onClick={() => toggleArchive(ann.id, ann.archived)}
                                            style={{ padding: '5px 12px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', border: '1.5px solid', background: 'white', borderColor: ann.archived ? 'rgba(0,69,13,0.2)' : 'rgba(100,116,139,0.2)', color: ann.archived ? '#00450d' : '#64748b' }}>
                                            {ann.archived ? 'Restore' : 'Archive'}
                                        </button>
                                    )}
                                    <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>{isExpanded ? 'expand_less' : 'expand_more'}</span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </DashboardLayout>
    )
}