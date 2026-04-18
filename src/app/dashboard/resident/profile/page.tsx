'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const RESIDENT_NAV = [
    { label: 'Overview', href: '/dashboard/resident', icon: 'dashboard' },
    { label: 'Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' },
    { label: 'Track Vehicle', href: '/dashboard/resident/tracking', icon: 'location_on' },
    { label: 'Report Issue', href: '/dashboard/resident/report-dumping', icon: 'report_problem' },
    { label: 'Complaints', href: '/dashboard/resident/complaints', icon: 'feedback' },
    { label: 'Rate Service', href: '/dashboard/resident/feedback', icon: 'star' },
    { label: 'My Profile', desc: 'Update your details', icon: 'person', href: '/dashboard/resident/profile', color: '#7c3aed', bg: 'rgba(124,58,237,0.07)' },
]

export default function ResidentProfilePage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState('')
    const [toastType, setToastType] = useState<'success' | 'error'>('success')
    const [form, setForm] = useState({
        full_name: '', phone: '', address: '', ward: '', district: '', email: '',
    })

    useEffect(() => { loadData() }, [])

    function showToast(msg: string, type: 'success' | 'error' = 'success') {
        setToast(msg); setToastType(type)
        setTimeout(() => setToast(''), 3500)
    }

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        setForm({
            full_name: p?.full_name || '',
            phone: p?.phone || '',
            address: p?.address || '',
            ward: p?.ward || '',
            district: p?.district || '',
            email: user.email || '',
        })
        setLoading(false)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('profiles').update({
            full_name: form.full_name,
            phone: form.phone,
            address: form.address,
        }).eq('id', user!.id)
        if (error) showToast('Error saving: ' + error.message, 'error')
        else showToast('Profile updated successfully!')
        setSaving(false)
    }

    const initials = form.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'R'

    return (
        <DashboardLayout role="Resident" userName={profile?.full_name || ''} navItems={RESIDENT_NAV}
            primaryAction={{ label: 'View Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' }}>
            <style>{`
        .material-symbols-outlined{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1;}
        .bento-card{background:white;border-radius:16px;box-shadow:0 10px 40px -10px rgba(24,28,34,0.08);border:1px solid rgba(0,69,13,0.04);overflow:hidden;}
        .form-field{width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;color:#181c22;font-family:'Inter',sans-serif;background:#fafafa;transition:all 0.2s;outline:none;box-sizing:border-box;}
        .form-field:focus{border-color:#00450d;background:white;box-shadow:0 0 0 3px rgba(0,69,13,0.08);}
        .form-field:disabled{background:#f3f4f6;color:#9ca3af;cursor:not-allowed;}
        .toast{animation:slideUp 0.3s ease;}
        @keyframes slideUp{from{transform:translateY(12px) translateX(-50%);opacity:0}to{transform:translateY(0) translateX(-50%);opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .s1{animation:fadeUp .4s ease .04s both}.s2{animation:fadeUp .4s ease .09s both}
      `}</style>

            {toast && (
                <div className="toast" style={{ position: 'fixed', bottom: 24, left: '50%', background: toastType === 'error' ? '#dc2626' : '#181c22', color: 'white', padding: '10px 20px', borderRadius: 9999, fontSize: 13, fontWeight: 500, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: toastType === 'error' ? '#fca5a5' : '#4ade80' }}>{toastType === 'error' ? 'error' : 'check_circle'}</span>
                    {toast}
                </div>
            )}

            <section className="s1" style={{ marginBottom: 32 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', display: 'block', marginBottom: 8 }}>Resident Portal</span>
                <h1 style={{ fontSize: 48, fontWeight: 900, fontFamily: 'Manrope,sans-serif', color: '#181c22', lineHeight: 1.1 }}>
                    My <span style={{ color: '#1b5e20' }}>Profile</span>
                </h1>
            </section>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
                    <form onSubmit={handleSave} className="s2">
                        <div className="bento-card" style={{ marginBottom: 20 }}>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22' }}>Personal Information</h3>
                                <p style={{ fontSize: 13, color: '#717a6d', marginTop: 4 }}>Update your name, phone and address</p>
                            </div>
                            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>Full Name</label>
                                    <input className="form-field" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>Email Address</label>
                                    <input className="form-field" value={form.email} disabled />
                                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>Email cannot be changed here. Contact CMC admin if needed.</p>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>Phone Number</label>
                                    <input className="form-field" placeholder="+94 7X XXX XXXX" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>Address</label>
                                    <input className="form-field" placeholder="Your street address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                                </div>
                            </div>
                        </div>

                        <div className="bento-card" style={{ marginBottom: 20 }}>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22' }}>Location Details</h3>
                                <p style={{ fontSize: 13, color: '#717a6d', marginTop: 4 }}>Your district and ward — set by CMC admin</p>
                            </div>
                            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>District</label>
                                    <input className="form-field" value={form.district} disabled />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>Ward</label>
                                    <input className="form-field" value={form.ward || 'Not assigned'} disabled />
                                </div>
                                <div style={{ padding: '12px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', display: 'flex', gap: 10 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#00450d', flexShrink: 0, marginTop: 1 }}>info</span>
                                    <p style={{ fontSize: 12, color: '#41493e', lineHeight: 1.6 }}>District and ward are assigned by your CMC admin and cannot be self-edited. Contact your district office to request changes.</p>
                                </div>
                            </div>
                        </div>

                        <button type="submit" disabled={saving}
                            style={{ background: saving ? '#94a3b8' : '#00450d', color: 'white', border: 'none', borderRadius: 12, padding: '14px 28px', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {saving
                                ? <><div style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Saving...</>
                                : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>Save Changes</>}
                        </button>
                    </form>

                    {/* Sidebar */}
                    <div className="s1">
                        <div className="bento-card" style={{ padding: 24, textAlign: 'center' }}>
                            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#00450d,#1b5e20)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 26, fontWeight: 800, color: 'white', fontFamily: 'Manrope,sans-serif' }}>
                                {initials}
                            </div>
                            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', marginBottom: 4 }}>{form.full_name || 'Resident'}</p>
                            <p style={{ fontSize: 12, color: '#717a6d', marginBottom: 4 }}>{form.email}</p>
                            <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(0,69,13,0.08)', color: '#00450d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Resident</span>

                            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(0,69,13,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
                                    { label: 'District', value: form.district || '—', icon: 'location_city' },
                                    { label: 'Ward', value: form.ward || '—', icon: 'location_on' },
                                    { label: 'Phone', value: form.phone || '—', icon: 'phone' },
                                ].map(item => (
                                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                                        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#00450d' }}>{item.icon}</span>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 600 }}>{item.label}</p>
                                            <p style={{ fontSize: 13, color: '#181c22', fontWeight: 600 }}>{item.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}