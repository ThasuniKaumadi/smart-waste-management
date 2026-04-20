'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const SUPERVISOR_NAV = [
    { label: 'Overview', href: '/dashboard/supervisor', icon: 'dashboard', section: 'Menu' },
    { label: 'Schedules', href: '/dashboard/supervisor/schedules', icon: 'calendar_month', section: 'Menu' },
    { label: 'Routes', href: '/dashboard/supervisor/routes', icon: 'route', section: 'Menu' },
    { label: 'Drivers', href: '/dashboard/supervisor/drivers', icon: 'people', section: 'Menu' },
    { label: 'Track Route', href: '/dashboard/supervisor/track-route', icon: 'gps_fixed', section: 'Menu' },
    { label: 'Alerts', href: '/dashboard/supervisor/alerts', icon: 'notifications_active', section: 'Menu' },
    { label: 'Complaints', href: '/dashboard/supervisor/complaints', icon: 'feedback', section: 'Menu' },
    { label: 'Compliance', href: '/dashboard/supervisor/schedule-compliance', icon: 'fact_check', section: 'Menu' },
    { label: 'Waste Reports', href: '/dashboard/supervisor/waste-reports', icon: 'report', section: 'Menu' },
    { label: 'Ward Heatmap', href: '/dashboard/supervisor/heatmap', icon: 'map', section: 'Menu' },
    { label: 'Shift Report', href: '/dashboard/supervisor/shift-report', icon: 'picture_as_pdf', section: 'Menu' },
    { label: 'Announcements', href: '/dashboard/supervisor/announcements', icon: 'campaign', section: 'Menu' },
]

interface Announcement {
    id: string; title: string; content: string; type: string
    target_roles: string[]; district: string | null; ward: string | null
    is_active: boolean; created_at: string; created_by: string; author_name?: string
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    info: { label: 'Info', color: '#1d4ed8', bg: '#eff6ff', icon: 'info' },
    warning: { label: 'Warning', color: '#d97706', bg: '#fefce8', icon: 'warning' },
    urgent: { label: 'Urgent', color: '#dc2626', bg: '#fef2f2', icon: 'emergency' },
    update: { label: 'Update', color: '#00450d', bg: '#f0fdf4', icon: 'update' },
}

export default function SupervisorAnnouncementsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [toast, setToast] = useState('')
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [type, setType] = useState('info')
    const [targetWard, setTargetWard] = useState('all')
    const [targetRoles, setTargetRoles] = useState<string[]>(['driver', 'supervisor'])

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data } = await supabase.from('announcements')
            .select('*, profiles:created_by(full_name)')
            .eq('district', p?.district || '')
            .order('created_at', { ascending: false }).limit(50)
        setAnnouncements((data || []).map((a: any) => ({ ...a, author_name: a.profiles?.full_name || 'Unknown' })))
        setLoading(false)
    }

    async function handleSubmit() {
        if (!title.trim() || !content.trim()) { showToastMsg('Please fill in title and content.'); return }
        setSubmitting(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('announcements').insert({
            title: title.trim(), content: content.trim(), type,
            target_roles: targetRoles, district: profile?.district || null,
            ward: targetWard === 'all' ? null : targetWard,
            is_active: true, created_by: user?.id,
        })
        if (error) { showToastMsg('Failed to post announcement.'); console.error(error) }
        else {
            showToastMsg('Announcement posted!')
            setTitle(''); setContent(''); setType('info'); setTargetWard('all'); setTargetRoles(['driver', 'supervisor'])
            setShowForm(false); await loadData()
        }
        setSubmitting(false)
    }

    async function toggleActive(id: string, current: boolean) {
        const supabase = createClient()
        await supabase.from('announcements').update({ is_active: !current }).eq('id', id)
        setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a))
        showToastMsg(current ? 'Announcement deactivated.' : 'Announcement activated.')
    }

    async function handleDelete(id: string) {
        const supabase = createClient()
        await supabase.from('announcements').delete().eq('id', id)
        setAnnouncements(prev => prev.filter(a => a.id !== id))
        showToastMsg('Announcement deleted.')
    }

    function showToastMsg(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }
    function toggleRole(role: string) {
        setTargetRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
    }

    const filtered = announcements.filter(a => {
        if (filterActive === 'active') return a.is_active
        if (filterActive === 'inactive') return !a.is_active
        return true
    })
    const assignedWards = profile?.assigned_wards || []
    const activeCount = announcements.filter(a => a.is_active).length

    return (
        <DashboardLayout role="Supervisor" userName={profile?.full_name || ''} navItems={SUPERVISOR_NAV}>
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .filter-btn { padding:6px 14px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .filter-btn.active { background:#00450d; color:white; }
        .filter-btn:not(.active) { background:#f1f5f9; color:#64748b; }
        .text-input,.text-area,.select-input { border:1.5px solid rgba(0,69,13,0.12); border-radius:10px; padding:10px 14px; font-size:13px; font-family:'Inter',sans-serif; outline:none; color:#181c22; background:white; width:100%; box-sizing:border-box; transition:border 0.2s; }
        .text-input:focus,.text-area:focus,.select-input:focus { border-color:#00450d; }
        .text-area { resize:vertical; min-height:100px; }
        .submit-btn { background:#00450d; color:white; border:none; border-radius:10px; padding:10px 20px; font-family:'Manrope',sans-serif; font-weight:700; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:6px; transition:background 0.2s; }
        .submit-btn:hover { background:#1b5e20; }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .cancel-btn { background:white; color:#64748b; border:1.5px solid #e2e8f0; border-radius:10px; padding:10px 20px; font-family:'Manrope',sans-serif; font-weight:700; font-size:13px; cursor:pointer; }
        .ann-row { padding:20px 24px; border-bottom:1px solid rgba(0,69,13,0.04); transition:background 0.15s; }
        .ann-row:hover { background:#f9fdf9; }
        .ann-row:last-child { border-bottom:none; }
        .badge { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; }
        .role-chip { display:inline-flex; align-items:center; padding:4px 10px; border-radius:99px; font-size:11px; font-weight:600; cursor:pointer; border:1.5px solid; transition:all 0.15s; user-select:none; font-family:'Manrope',sans-serif; }
        .role-chip.selected { background:#00450d; color:white; border-color:#00450d; }
        .role-chip:not(.selected) { background:white; color:#64748b; border-color:#e2e8f0; }
        .icon-btn { border:none; border-radius:8px; padding:6px 8px; cursor:pointer; display:flex; align-items:center; gap:4px; font-size:11px; font-weight:600; font-family:'Manrope',sans-serif; transition:all 0.15s; }
        @keyframes staggerIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .s1{animation:staggerIn 0.4s ease 0.05s both} .s2{animation:staggerIn 0.4s ease 0.10s both} .s3{animation:staggerIn 0.4s ease 0.15s both}
        .form-anim{animation:slideDown 0.25s ease both}
      `}</style>

            {toast && (
                <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#181c22', color: 'white', padding: '10px 20px', borderRadius: '99px', fontSize: '13px', fontWeight: 500, zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#4ade80' }}>check_circle</span>{toast}
                </div>
            )}

            {/* Header */}
            <section style={{ marginBottom: '32px' }} className="s1">
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 8px' }}>
                    Supervisor · Communications
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: '46px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: 0 }}>
                        Ward <span style={{ color: '#1b5e20' }}>Announcements</span>
                    </h1>
                    <button onClick={() => setShowForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', background: showForm ? '#f1f5f9' : '#00450d', color: showForm ? '#64748b' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '13px', transition: 'all 0.2s' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showForm ? 'close' : 'add'}</span>
                        {showForm ? 'Cancel' : 'New Announcement'}
                    </button>
                </div>
                <p style={{ fontSize: '13px', color: '#717a6d', margin: '6px 0 0' }}>
                    {profile?.district} · {activeCount} active announcement{activeCount !== 1 ? 's' : ''}
                </p>
            </section>

            {/* Create form */}
            {showForm && (
                <div className="bento-card form-anim s2" style={{ marginBottom: '24px', padding: '24px' }}>
                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: '0 0 20px' }}>Post New Announcement</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#41493e', display: 'block', marginBottom: '6px' }}>Title *</label>
                            <input className="text-input" placeholder="e.g. Route change notice for Ward 2" value={title} onChange={e => setTitle(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#41493e', display: 'block', marginBottom: '6px' }}>Type</label>
                            <select className="select-input" value={type} onChange={e => setType(e.target.value)}>
                                <option value="info">Info</option><option value="update">Update</option>
                                <option value="warning">Warning</option><option value="urgent">Urgent</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#41493e', display: 'block', marginBottom: '6px' }}>Content *</label>
                        <textarea className="text-area" placeholder="Write your announcement here..." value={content} onChange={e => setContent(e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#41493e', display: 'block', marginBottom: '6px' }}>Target Ward</label>
                            <select className="select-input" value={targetWard} onChange={e => setTargetWard(e.target.value)}>
                                <option value="all">All assigned wards</option>
                                {assignedWards.map((w: string) => <option key={w} value={w}>{w}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#41493e', display: 'block', marginBottom: '6px' }}>Visible to</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '2px' }}>
                                {['driver', 'supervisor', 'resident', 'contractor'].map(role => (
                                    <span key={role} className={`role-chip ${targetRoles.includes(role) ? 'selected' : ''}`} onClick={() => toggleRole(role)}>{role}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="submit-btn" onClick={handleSubmit} disabled={submitting}>
                            {submitting
                                ? <><div style={{ width: '14px', height: '14px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Posting...</>
                                : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>Post Announcement</>}
                        </button>
                        <button className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="bento-card s3">
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>Posted Announcements</h3>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{filtered.length}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {(['all', 'active', 'inactive'] as const).map(f => (
                            <button key={f} className={`filter-btn ${filterActive === f ? 'active' : ''}`} onClick={() => setFilterActive(f)}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
                        <div style={{ width: '28px', height: '28px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>campaign</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '15px', color: '#181c22', margin: '0 0 6px' }}>No announcements yet</p>
                        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>Post your first announcement using the button above.</p>
                    </div>
                ) : (
                    <div>
                        {filtered.map(a => {
                            const tc = TYPE_CONFIG[a.type] || TYPE_CONFIG.info
                            const isOwn = a.created_by === profile?.id
                            return (
                                <div key={a.id} className="ann-row" style={{ opacity: a.is_active ? 1 : 0.6 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                                <span className="badge" style={{ background: tc.bg, color: tc.color }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>{tc.icon}</span>{tc.label}
                                                </span>
                                                {!a.is_active && <span className="badge" style={{ background: '#f1f5f9', color: '#94a3b8' }}>Inactive</span>}
                                                {a.ward && <span className="badge" style={{ background: 'rgba(0,69,13,0.07)', color: '#00450d' }}>{a.ward}</span>}
                                            </div>
                                            <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', margin: '0 0 4px', fontFamily: 'Manrope,sans-serif' }}>{a.title}</p>
                                            <p style={{ fontSize: '13px', color: '#41493e', margin: '0 0 8px', lineHeight: 1.5 }}>{a.content}</p>
                                            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>person</span>{a.author_name}
                                                </span>
                                                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>calendar_today</span>
                                                    {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                {a.target_roles?.length > 0 && (
                                                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>group</span>{a.target_roles.join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {isOwn && (
                                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                                <button className="icon-btn" onClick={() => toggleActive(a.id, a.is_active)}
                                                    style={{ background: a.is_active ? '#fefce8' : '#f0fdf4', color: a.is_active ? '#d97706' : '#00450d' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{a.is_active ? 'visibility_off' : 'visibility'}</span>
                                                    {a.is_active ? 'Hide' : 'Show'}
                                                </button>
                                                <button className="icon-btn" onClick={() => handleDelete(a.id)} style={{ background: '#fef2f2', color: '#dc2626' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9fdf9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '15px' }}>info</span>
                    <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>
                        Announcements are visible to selected roles in your district. You can only edit or delete your own posts.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    )
}