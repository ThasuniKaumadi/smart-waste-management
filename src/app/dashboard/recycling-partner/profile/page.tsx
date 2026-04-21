'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const RECYCLER_NAV = [
    { label: 'Home', href: '/dashboard/recycling-partner', icon: 'dashboard' },
    { label: 'New Intake', href: '/dashboard/recycling-partner/log', icon: 'add_circle' },
    { label: 'History', href: '/dashboard/recycling-partner/history', icon: 'history' },
    { label: 'Analytics', href: '/dashboard/recycling-partner/analytics', icon: 'bar_chart' },
    { label: 'Disposal', href: '/dashboard/recycling-partner/disposal', icon: 'delete_sweep' },
    { label: 'Profile', href: '/dashboard/recycling-partner/profile', icon: 'person' },
]

export default function RecyclerProfilePage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'account' | 'edit' | 'security'>('account')
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [editForm, setEditForm] = useState({ full_name: '', phone: '', organisation_name: '', address: '' })
    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
    const [stats, setStats] = useState({ totalIntakes: 0, totalWeight: 0, totalAmount: 0, onChain: 0 })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        setEditForm({ full_name: p?.full_name || '', phone: p?.phone || '', organisation_name: p?.organisation_name || '', address: p?.address || '' })

        const { data: logs } = await supabase.from('waste_intake_logs').select('actual_quantity,total_amount,tx_hash,is_rejected').eq('operator_id', user.id).eq('is_rejected', false)
        if (logs) setStats({
            totalIntakes: logs.length,
            totalWeight: logs.reduce((s, l) => s + (l.actual_quantity || 0), 0),
            totalAmount: logs.reduce((s, l) => s + (l.total_amount || 0), 0),
            onChain: logs.filter(l => l.tx_hash).length,
        })
        setLoading(false)
    }

    async function saveProfile() {
        setSaving(true); setMessage('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('profiles').update({
            full_name: editForm.full_name,
            phone: editForm.phone || null,
            organisation_name: editForm.organisation_name || null,
            address: editForm.address || null,
        }).eq('id', user!.id)
        if (error) setMessage('Error: ' + error.message)
        else { setMessage('Profile updated successfully.'); await loadData() }
        setSaving(false)
    }

    async function changePassword() {
        if (!pwForm.next || pwForm.next !== pwForm.confirm) { setMessage('Passwords do not match.'); return }
        if (pwForm.next.length < 8) { setMessage('Password must be at least 8 characters.'); return }
        setSaving(true); setMessage('')
        const supabase = createClient()
        const { error } = await supabase.auth.updateUser({ password: pwForm.next })
        if (error) setMessage('Error: ' + error.message)
        else { setMessage('Password changed successfully.'); setPwForm({ current: '', next: '', confirm: '' }) }
        setSaving(false)
    }

    const initials = profile?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'RP'

    return (
        <DashboardLayout role="Recycling Partner" userName={profile?.full_name || ''} navItems={RECYCLER_NAV}>
            <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1;}
        .msf-fill{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1;}
        .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden;}
        .form-field{width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:13px;font-family:'Inter',sans-serif;color:#181c22;background:#fafafa;outline:none;box-sizing:border-box;transition:all 0.2s;}
        .form-field:focus{border-color:#15803d;background:white;box-shadow:0 0 0 3px rgba(21,128,61,0.08);}
        .field-label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;font-family:'Manrope',sans-serif;margin-bottom:6px;}
        .tab-btn{padding:9px 20px;border-radius:99px;font-size:12px;font-weight:700;font-family:'Manrope',sans-serif;border:none;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:6px;}
        .tab-btn.on{background:#15803d;color:white;}
        .tab-btn.off{background:transparent;color:#64748b;}
        .tab-btn.off:hover{background:#f1f5f9;}
        .save-btn{display:flex;align-items:center;gap:7px;padding:11px 24px;border-radius:10px;background:#15803d;color:white;border:none;cursor:pointer;font-family:'Manrope',sans-serif;font-weight:700;font-size:13px;transition:all 0.2s;}
        .save-btn:hover{background:#166534;}
        .save-btn:disabled{opacity:0.6;cursor:not-allowed;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .a1{animation:fadeUp .35s ease both}.a2{animation:fadeUp .35s ease .07s both}.a3{animation:fadeUp .35s ease .14s both}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>Recycling Partner</p>
                <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 40, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: 0 }}>
                    My <span style={{ color: '#15803d' }}>Profile</span>
                </h1>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: 26, height: 26, border: '2px solid #15803d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* Profile hero */}
                    <div className="a2 card" style={{ marginBottom: 20 }}>
                        <div style={{ background: 'linear-gradient(135deg,#14532d 0%,#15803d 100%)', padding: '28px 28px 0', borderRadius: '20px 20px 0 0' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, paddingBottom: 20 }}>
                                <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid rgba(255,255,255,0.2)' }}>
                                    <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 26, color: 'white' }}>{initials}</span>
                                </div>
                                <div style={{ flex: 1, paddingBottom: 4 }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(163,246,156,0.7)', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 4px' }}>Recycling Partner</p>
                                    <h2 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 22, color: 'white', margin: '0 0 2px' }}>{profile?.full_name}</h2>
                                    {profile?.organisation_name && (
                                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>{profile.organisation_name}</p>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.1)', marginBottom: 4 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: profile?.is_approved ? '#86efac' : '#fca5a5' }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'white', fontFamily: 'Manrope,sans-serif' }}>{profile?.is_approved ? 'Approved' : 'Pending'}</span>
                                </div>
                            </div>
                        </div>
                        {/* Stats strip */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '1px solid rgba(0,69,13,0.06)' }}>
                            {[
                                { label: 'Total Intakes', value: stats.totalIntakes, icon: 'inventory' },
                                { label: 'Weight (kg)', value: stats.totalWeight.toFixed(0), icon: 'scale' },
                                { label: 'On-Chain', value: stats.onChain, icon: 'link' },
                                { label: 'CMC Payable', value: `LKR ${Math.round(stats.totalAmount / 1000)}k`, icon: 'payments' },
                            ].map((s, i) => (
                                <div key={s.label} style={{ padding: '16px 18px', borderRight: i < 3 ? '1px solid rgba(0,69,13,0.06)' : undefined }}>
                                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 20, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{s.value}</p>
                                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="a3" style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 99, width: 'fit-content', marginBottom: 20 }}>
                        {([
                            { key: 'account', label: 'Account Info', icon: 'person' },
                            { key: 'edit', label: 'Edit Profile', icon: 'edit' },
                            { key: 'security', label: 'Security', icon: 'lock' },
                        ] as const).map(t => (
                            <button key={t.key} onClick={() => { setActiveTab(t.key); setMessage('') }}
                                className={`tab-btn ${activeTab === t.key ? 'on' : 'off'}`}>
                                <span className="msf" style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
                            </button>
                        ))}
                    </div>

                    {message && (
                        <div style={{ marginBottom: 16, padding: '11px 16px', borderRadius: 10, background: message.startsWith('Error') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${message.startsWith('Error') ? 'rgba(186,26,26,0.2)' : 'rgba(0,69,13,0.15)'}`, color: message.startsWith('Error') ? '#ba1a1a' : '#00450d', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="msf-fill" style={{ fontSize: 15 }}>{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
                            {message}
                            <button onClick={() => setMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.5 }}><span className="msf" style={{ fontSize: 14 }}>close</span></button>
                        </div>
                    )}

                    {/* Account tab */}
                    {activeTab === 'account' && (
                        <div className="card" style={{ padding: 28 }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: '0 0 20px' }}>Account Information</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {[
                                    { label: 'Full Name', value: profile?.full_name || '—' },
                                    { label: 'Organisation', value: profile?.organisation_name || '—' },
                                    { label: 'Phone', value: profile?.phone || '—' },
                                    { label: 'District', value: profile?.district || '—' },
                                    { label: 'Address', value: profile?.address || '—' },
                                    { label: 'Account Status', value: profile?.is_approved ? 'Approved' : 'Pending Approval' },
                                    { label: 'Role', value: 'Recycling Partner' },
                                    { label: 'Member Since', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
                                ].map(item => (
                                    <div key={item.label} style={{ padding: '12px 16px', borderRadius: 12, background: '#f8fafc' }}>
                                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: '0 0 4px' }}>{item.label}</p>
                                        <p style={{ fontSize: 14, fontWeight: 600, color: '#181c22', margin: 0 }}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Edit tab */}
                    {activeTab === 'edit' && (
                        <div className="card" style={{ padding: 28 }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: '0 0 20px' }}>Edit Profile</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                                {[
                                    { label: 'Full Name *', key: 'full_name', placeholder: 'Your full name' },
                                    { label: 'Phone', key: 'phone', placeholder: '+94 XX XXX XXXX' },
                                    { label: 'Organisation', key: 'organisation_name', placeholder: 'Company or org name' },
                                    { label: 'Address', key: 'address', placeholder: 'Your operating address' },
                                ].map(f => (
                                    <div key={f.key} style={{ gridColumn: f.key === 'address' ? '1 / -1' : undefined }}>
                                        <label className="field-label">{f.label}</label>
                                        <input type="text" className="form-field" placeholder={f.placeholder}
                                            value={(editForm as any)[f.key]}
                                            onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })} />
                                    </div>
                                ))}
                            </div>
                            <button onClick={saveProfile} disabled={saving} className="save-btn">
                                {saving ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Saving…</> : <><span className="msf" style={{ fontSize: 16 }}>save</span>Save Changes</>}
                            </button>
                        </div>
                    )}

                    {/* Security tab */}
                    {activeTab === 'security' && (
                        <div className="card" style={{ padding: 28 }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: '0 0 20px' }}>Change Password</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400, marginBottom: 20 }}>
                                {[
                                    { label: 'New Password', key: 'next', type: 'password', placeholder: 'At least 8 characters' },
                                    { label: 'Confirm Password', key: 'confirm', type: 'password', placeholder: 'Repeat new password' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="field-label">{f.label}</label>
                                        <input type={f.type} className="form-field" placeholder={f.placeholder}
                                            value={(pwForm as any)[f.key]}
                                            onChange={e => setPwForm({ ...pwForm, [f.key]: e.target.value })} />
                                    </div>
                                ))}
                            </div>
                            <button onClick={changePassword} disabled={saving} className="save-btn">
                                {saving ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Saving…</> : <><span className="msf" style={{ fontSize: 16 }}>lock_reset</span>Change Password</>}
                            </button>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}