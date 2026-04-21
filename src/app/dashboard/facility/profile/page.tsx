'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const FACILITY_NAV = [
    { label: 'Home', href: '/dashboard/facility', icon: 'dashboard' },
    { label: 'New Intake', href: '/dashboard/facility/log', icon: 'add_circle' },
    { label: 'History', href: '/dashboard/facility/history', icon: 'history' },
    { label: 'Analytics', href: '/dashboard/facility/analytics', icon: 'bar_chart' },
    { label: 'Disposal', href: '/dashboard/facility/disposal', icon: 'delete_sweep' },
    { label: 'Profile', href: '/dashboard/facility/profile', icon: 'person' },
]

export default function FacilityProfilePage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [activeTab, setActiveTab] = useState<'account' | 'edit' | 'password'>('account')

    const [formData, setFormData] = useState({ full_name: '', phone: '', address: '', organisation_name: '' })
    const [pwData, setPwData] = useState({ newPw: '', confirm: '' })
    const [showPw, setShowPw] = useState({ newPw: false, confirm: false })

    useEffect(() => { loadProfile() }, [])

    async function loadProfile() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (p) {
            setProfile({ ...p, email: user.email })
            setFormData({ full_name: p.full_name || '', phone: p.phone || '', address: p.address || '', organisation_name: p.organisation_name || '' })
        }
        setLoading(false)
    }

    async function handleProfileSave(e: React.FormEvent) {
        e.preventDefault(); setSaving(true); setMessage(null)
        const supabase = createClient()
        const { error } = await supabase.from('profiles').update({
            full_name: formData.full_name, phone: formData.phone || null,
            address: formData.address || null, organisation_name: formData.organisation_name || null,
        }).eq('id', profile.id)
        setSaving(false)
        if (error) setMessage({ type: 'error', text: error.message })
        else { setMessage({ type: 'success', text: 'Profile updated successfully.' }); setProfile((p: any) => ({ ...p, ...formData })) }
    }

    async function handlePasswordChange(e: React.FormEvent) {
        e.preventDefault()
        if (pwData.newPw !== pwData.confirm) { setMessage({ type: 'error', text: 'Passwords do not match.' }); return }
        if (pwData.newPw.length < 8) { setMessage({ type: 'error', text: 'Password must be at least 8 characters.' }); return }
        setSaving(true); setMessage(null)
        const supabase = createClient()
        const { error } = await supabase.auth.updateUser({ password: pwData.newPw })
        setSaving(false)
        if (error) setMessage({ type: 'error', text: error.message })
        else { setMessage({ type: 'success', text: 'Password changed successfully.' }); setPwData({ newPw: '', confirm: '' }) }
    }

    const initials = profile?.full_name
        ? profile.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
        : 'FO'

    const pwScore = [pwData.newPw.length >= 8, /[A-Z]/.test(pwData.newPw), /[0-9]/.test(pwData.newPw), /[^A-Za-z0-9]/.test(pwData.newPw)].filter(Boolean).length

    return (
        <DashboardLayout role="Facility Operator" userName={profile?.full_name || ''} navItems={FACILITY_NAV}>
            <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1;}
        .profile-card{background:white;border-radius:20px;padding:32px;border:1px solid rgba(0,69,13,0.06);box-shadow:0 2px 12px rgba(0,0,0,0.06);}
        .tab-btn{padding:10px 20px;border-radius:10px;font-size:14px;font-weight:500;font-family:'Manrope',sans-serif;border:none;cursor:pointer;transition:all 0.2s;background:transparent;color:#717a6d;display:inline-flex;align-items:center;gap:6px;}
        .tab-btn.active{background:#0369a1;color:white;}
        .tab-btn:not(.active):hover{background:#f0f9ff;color:#0369a1;}
        .field-label{font-size:13px;font-weight:600;color:#41493e;font-family:'Manrope',sans-serif;margin-bottom:6px;display:block;letter-spacing:0.02em;}
        .field-input{width:100%;padding:12px 16px;border:1.5px solid #e4e9e0;border-radius:12px;font-size:14px;font-family:'Inter',sans-serif;color:#181c22;background:#fafbf9;outline:none;transition:border-color 0.2s,box-shadow 0.2s;box-sizing:border-box;}
        .field-input:focus{border-color:#0369a1;box-shadow:0 0 0 3px rgba(3,105,161,0.08);background:white;}
        .field-input:disabled{background:#f4f6f3;color:#a0a89b;cursor:not-allowed;}
        .save-btn{background:#0369a1;color:white;border:none;border-radius:12px;padding:13px 28px;font-size:14px;font-weight:600;font-family:'Manrope',sans-serif;cursor:pointer;transition:all 0.2s;display:inline-flex;align-items:center;gap:8px;}
        .save-btn:hover:not(:disabled){background:#0284c7;transform:translateY(-1px);box-shadow:0 4px 12px rgba(3,105,161,0.25);}
        .save-btn:disabled{opacity:0.6;cursor:not-allowed;}
        .toast-success{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:12px;padding:14px 18px;font-size:14px;font-family:'Inter',sans-serif;display:flex;align-items:center;gap:10px;}
        .toast-error{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:12px;padding:14px 18px;font-size:14px;font-family:'Inter',sans-serif;display:flex;align-items:center;gap:10px;}
        .pw-wrap{position:relative;}
        .pw-eye{position:absolute;right:14px;top:50%;transform:translateY(-50%);cursor:pointer;color:#717a6d;font-size:20px;user-select:none;}
        .info-row{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #f0f2ee;}
        .info-row:last-child{border-bottom:none;}
        .info-label{font-size:13px;color:#717a6d;font-family:'Inter',sans-serif;width:160px;flex-shrink:0;}
        .info-value{font-size:14px;color:#181c22;font-family:'Inter',sans-serif;font-weight:500;}
        .badge-active{background:#f0fdf4;color:#166534;border-radius:8px;padding:4px 12px;font-size:12px;font-weight:700;font-family:'Manrope',sans-serif;}
        .section-title{font-size:11px;font-weight:700;color:#a0a89b;letter-spacing:0.08em;text-transform:uppercase;font-family:'Manrope',sans-serif;margin-bottom:16px;}
        .acc-info-card{background:#fafbf9;border:1px solid #e4e9e0;border-radius:14px;padding:20px 24px;}
        .strength-bar{height:4px;border-radius:99px;flex:1;background:#e4e9e0;overflow:hidden;}
        .strength-fill{height:100%;border-radius:99px;transition:width 0.3s,background 0.3s;}
      `}</style>

            <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 0 40px' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#0369a1,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 26, fontWeight: 700, fontFamily: 'Manrope', flexShrink: 0 }}>
                        {initials}
                    </div>
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope', lineHeight: 1.2 }}>
                            {loading ? 'Loading…' : profile?.full_name || 'Facility Operator'}
                        </div>
                        <div style={{ fontSize: 14, color: '#717a6d', fontFamily: 'Inter', marginTop: 4, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span>{profile?.email}</span>
                            <span style={{ background: '#f0f9ff', color: '#0369a1', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope', letterSpacing: '0.05em' }}>FACILITY OPERATOR</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: '#f4f6f3', borderRadius: 14, padding: 6, width: 'fit-content' }}>
                    {([
                        { key: 'account', label: 'Account', icon: 'badge' },
                        { key: 'edit', label: 'Edit Profile', icon: 'person' },
                        { key: 'password', label: 'Security', icon: 'lock' },
                    ] as const).map(t => (
                        <button key={t.key} className={`tab-btn${activeTab === t.key ? ' active' : ''}`}
                            onClick={() => { setActiveTab(t.key); setMessage(null) }}>
                            <span className="msf" style={{ fontSize: 16 }}>{t.icon}</span>{t.label}
                        </button>
                    ))}
                </div>

                {/* Toast */}
                {message && (
                    <div className={message.type === 'success' ? 'toast-success' : 'toast-error'} style={{ marginBottom: 20 }}>
                        <span className="msf" style={{ fontSize: 18 }}>{message.type === 'success' ? 'check_circle' : 'error'}</span>
                        {message.text}
                    </div>
                )}

                {/* ACCOUNT TAB */}
                {activeTab === 'account' && (
                    <div className="profile-card">
                        <p className="section-title">Account Information</p>
                        <div className="acc-info-card" style={{ marginBottom: 24 }}>
                            <div className="info-row"><span className="info-label">Email Address</span><span className="info-value" style={{ fontFamily: 'monospace', fontSize: 13 }}>{profile?.email || '—'}</span></div>
                            <div className="info-row"><span className="info-label">Role</span><span style={{ background: '#f0f9ff', color: '#0369a1', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope', letterSpacing: '0.05em' }}>FACILITY OPERATOR</span></div>
                            <div className="info-row"><span className="info-label">District</span><span className="info-value">{profile?.district || '—'}</span></div>
                            <div className="info-row"><span className="info-label">Organisation</span><span className="info-value">{profile?.organisation_name || '—'}</span></div>
                            <div className="info-row"><span className="info-label">Approval Status</span><span className="badge-active">APPROVED</span></div>
                            <div className="info-row"><span className="info-label">Account ID</span><span className="info-value" style={{ fontFamily: 'monospace', fontSize: 13 }}>{profile?.id?.slice(0, 16)}…</span></div>
                            <div className="info-row">
                                <span className="info-label">Member Since</span>
                                <span className="info-value">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
                            </div>
                        </div>

                        <p className="section-title">Personal Details</p>
                        <div className="acc-info-card" style={{ marginBottom: 24 }}>
                            <div className="info-row"><span className="info-label">Full Name</span><span className="info-value">{profile?.full_name || '—'}</span></div>
                            <div className="info-row"><span className="info-label">Phone</span><span className="info-value">{profile?.phone || '—'}</span></div>
                            <div className="info-row"><span className="info-label">Address</span><span className="info-value">{profile?.address || '—'}</span></div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button className="save-btn" onClick={() => setActiveTab('edit')}>
                                <span className="msf" style={{ fontSize: 18 }}>edit</span>Edit Profile
                            </button>
                            <button className="save-btn" onClick={() => setActiveTab('password')}>
                                <span className="msf" style={{ fontSize: 18 }}>lock_reset</span>Change Password
                            </button>
                        </div>
                    </div>
                )}

                {/* EDIT TAB */}
                {activeTab === 'edit' && (
                    <div className="profile-card">
                        <p className="section-title">Personal Information</p>
                        <form onSubmit={handleProfileSave}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                                <div><label className="field-label">Full Name</label><input className="field-input" value={formData.full_name} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} placeholder="Your full name" required /></div>
                                <div><label className="field-label">Email Address</label><input className="field-input" value={profile?.email || ''} disabled /></div>
                                <div><label className="field-label">Organisation Name</label><input className="field-input" value={formData.organisation_name} onChange={e => setFormData(p => ({ ...p, organisation_name: e.target.value }))} placeholder="Your facility name" /></div>
                                <div><label className="field-label">Phone Number</label><input className="field-input" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+94 77 123 4567" /></div>
                                <div style={{ gridColumn: '1/-1' }}><label className="field-label">Facility Address</label><input className="field-input" value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} placeholder="Facility address" /></div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <button type="submit" className="save-btn" disabled={saving}>
                                    <span className="msf" style={{ fontSize: 18 }}>{saving ? 'hourglass_empty' : 'save'}</span>{saving ? 'Saving…' : 'Save Changes'}
                                </button>
                                <span style={{ fontSize: 13, color: '#a0a89b', fontFamily: 'Inter' }}>Email is managed by Supabase.</span>
                            </div>
                        </form>
                    </div>
                )}

                {/* SECURITY TAB */}
                {activeTab === 'password' && (
                    <div className="profile-card">
                        <p className="section-title">Change Password</p>
                        <form onSubmit={handlePasswordChange} style={{ maxWidth: 460 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}>
                                <div>
                                    <label className="field-label">New Password</label>
                                    <div className="pw-wrap">
                                        <input className="field-input" type={showPw.newPw ? 'text' : 'password'} value={pwData.newPw}
                                            onChange={e => setPwData(p => ({ ...p, newPw: e.target.value }))}
                                            placeholder="Minimum 8 characters" style={{ paddingRight: 44 }} required />
                                        <span className="msf pw-eye" onClick={() => setShowPw(p => ({ ...p, newPw: !p.newPw }))}>{showPw.newPw ? 'visibility_off' : 'visibility'}</span>
                                    </div>
                                    {pwData.newPw && (
                                        <div style={{ marginTop: 8 }}>
                                            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                                {[1, 2, 3, 4].map(i => {
                                                    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e']
                                                    return (<div key={i} className="strength-bar"><div className="strength-fill" style={{ width: i <= pwScore ? '100%' : '0%', background: colors[pwScore - 1] || '#e4e9e0' }} /></div>)
                                                })}
                                            </div>
                                            <span style={{ fontSize: 12, color: '#717a6d', fontFamily: 'Inter' }}>{pwScore < 2 ? 'Weak — add uppercase, numbers, symbols' : pwScore < 4 ? 'Fair — getting stronger' : 'Strong password'}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="field-label">Confirm New Password</label>
                                    <div className="pw-wrap">
                                        <input className="field-input" type={showPw.confirm ? 'text' : 'password'} value={pwData.confirm}
                                            onChange={e => setPwData(p => ({ ...p, confirm: e.target.value }))}
                                            placeholder="Repeat new password" style={{ paddingRight: 44 }} required />
                                        <span className="msf pw-eye" onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}>{showPw.confirm ? 'visibility_off' : 'visibility'}</span>
                                    </div>
                                    {pwData.confirm && pwData.newPw !== pwData.confirm && (
                                        <p style={{ fontSize: 12, color: '#dc2626', marginTop: 6, fontFamily: 'Inter' }}>Passwords do not match</p>
                                    )}
                                </div>
                            </div>
                            <button type="submit" className="save-btn" disabled={saving || pwData.newPw !== pwData.confirm || !pwData.newPw}>
                                <span className="msf" style={{ fontSize: 18 }}>{saving ? 'hourglass_empty' : 'lock_reset'}</span>{saving ? 'Updating…' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}