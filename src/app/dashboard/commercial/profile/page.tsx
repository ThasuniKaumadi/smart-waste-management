'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const COMMERCIAL_NAV = [
    { label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' },
    { label: 'Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_month' },
    { label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' },
    { label: 'Bins', href: '/dashboard/commercial/bins', icon: 'delete' },
    { label: 'Collection History', href: '/dashboard/commercial/collection-history', icon: 'history' },
    { label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' },
    { label: 'Rate Service', href: '/dashboard/commercial/feedback', icon: 'star' },
    { label: 'Profile', href: '/dashboard/commercial/profile', icon: 'manage_accounts' },
]

export default function CommercialProfilePage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    // Editable fields
    const [fullName, setFullName] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')
    const [orgName, setOrgName] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        if (p) {
            setFullName(p.full_name || '')
            setPhone(p.phone || '')
            setAddress(p.address || '')
            setOrgName(p.organisation_name || '')
        }
        setLoading(false)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setErrorMsg('')
        if (!fullName.trim()) { setErrorMsg('Contact name is required.'); return }
        setSaving(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { error } = await supabase.from('profiles').update({
                full_name: fullName.trim(),
                phone: phone.trim() || null,
                address: address.trim() || null,
                organisation_name: orgName.trim() || null,
            }).eq('id', user.id)
            if (error) { setErrorMsg(error.message); return }
            setSuccess(true)
            await loadData()
            setTimeout(() => setSuccess(false), 4000)
        } finally { setSaving(false) }
    }

    const initials = (profile?.organisation_name || profile?.full_name || 'CO')
        .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

    return (
        <DashboardLayout
            role="Commercial"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={COMMERCIAL_NAV}
            primaryAction={{ label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' }}
        >
            <style>{`
                .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
                .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
                .field-wrap{display:flex;flex-direction:column;gap:6px}
                .field-label{font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#717a6d;font-family:'Manrope',sans-serif}
                .field{padding:11px 14px;border:1.5px solid rgba(0,69,13,0.12);border-radius:10px;font-size:14px;color:#181c22;font-family:inherit;background:#fafafa;outline:none;transition:border-color 0.15s;width:100%;box-sizing:border-box}
                .field:focus{border-color:#00450d;background:white}
                .field:disabled{background:#f8fafc;color:#94a3b8;cursor:not-allowed;border-color:rgba(0,69,13,0.06)}
                .field::placeholder{color:#9ca3af}
                .save-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 28px;border-radius:12px;background:#00450d;color:white;border:none;cursor:pointer;font-family:'Manrope',sans-serif;font-weight:700;font-size:14px;transition:all 0.2s}
                .save-btn:hover{background:#1b5e20;box-shadow:0 4px 16px rgba(0,69,13,0.25)}
                .save-btn:disabled{opacity:0.6;cursor:not-allowed}
                .info-row{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid rgba(0,69,13,0.05)}
                .info-row:last-child{border-bottom:none}
                @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
                .a1{animation:fadeUp 0.4s ease 0.05s both}
                .a2{animation:fadeUp 0.4s ease 0.1s both}
                .a3{animation:fadeUp 0.4s ease 0.15s both}
            `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: '28px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Account Settings · ClearPath
                </p>
                <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif' }}>
                    Your <span style={{ color: '#00450d' }}>Profile</span>
                </h1>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #00450d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                </div>
            ) : (
                <div className="a2" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>

                    {/* Left: editable form */}
                    <div className="card">
                        {/* Avatar + name hero */}
                        <div style={{ padding: '28px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', gap: '20px', background: 'linear-gradient(135deg,#00450d,#1b5e20)' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: '24px', fontWeight: 900, color: 'white', fontFamily: 'Manrope,sans-serif' }}>{initials}</span>
                            </div>
                            <div>
                                <p style={{ fontSize: '18px', fontWeight: 800, color: 'white', fontFamily: 'Manrope,sans-serif', marginBottom: '4px' }}>
                                    {profile?.organisation_name || profile?.full_name || 'Your Business'}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px', background: 'rgba(255,255,255,0.15)', color: 'rgba(163,246,156,0.9)', fontFamily: 'Manrope,sans-serif' }}>
                                        Commercial
                                    </span>
                                    {profile?.is_approved && (
                                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px', background: 'rgba(163,246,156,0.2)', color: 'rgba(163,246,156,0.9)', fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span className="msf" style={{ fontSize: '12px' }}>verified</span>
                                            CMC Verified
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSave} style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Success / error */}
                            {success && (
                                <div style={{ borderRadius: '10px', padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="msf" style={{ color: '#00450d', fontSize: '18px' }}>check_circle</span>
                                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>Profile updated successfully.</p>
                                </div>
                            )}
                            {errorMsg && (
                                <div style={{ borderRadius: '10px', padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="msf" style={{ color: '#ba1a1a', fontSize: '18px' }}>error</span>
                                    <p style={{ fontSize: '13px', color: '#ba1a1a' }}>{errorMsg}</p>
                                </div>
                            )}

                            <p style={{ fontSize: '12px', fontWeight: 700, color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(0,69,13,0.06)', paddingBottom: '10px' }}>
                                Editable details
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="field-wrap">
                                    <label className="field-label">Organisation name</label>
                                    <input className="field" type="text" placeholder="Your business name"
                                        value={orgName} onChange={e => setOrgName(e.target.value)} />
                                </div>
                                <div className="field-wrap">
                                    <label className="field-label">Contact person <span style={{ color: '#ba1a1a' }}>*</span></label>
                                    <input className="field" type="text" placeholder="Full name"
                                        value={fullName} onChange={e => setFullName(e.target.value)} required />
                                </div>
                                <div className="field-wrap">
                                    <label className="field-label">Phone number</label>
                                    <input className="field" type="tel" placeholder="+94 77 000 0000"
                                        value={phone} onChange={e => setPhone(e.target.value)} />
                                </div>
                                <div className="field-wrap">
                                    <label className="field-label">Business address</label>
                                    <input className="field" type="text" placeholder="Street address"
                                        value={address} onChange={e => setAddress(e.target.value)} />
                                </div>
                            </div>

                            <p style={{ fontSize: '12px', fontWeight: 700, color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(0,69,13,0.06)', paddingBottom: '10px', marginTop: '8px' }}>
                                Read-only details
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                {[
                                    { label: 'District', value: profile?.district || '—' },
                                    { label: 'Ward', value: profile?.ward || '—' },
                                    { label: 'Business reg. no.', value: profile?.business_registration_number || '—' },
                                    { label: 'Billing cycle', value: profile?.billing_cycle === 'quarterly' ? 'Quarterly' : 'Monthly' },
                                ].map(item => (
                                    <div key={item.label} className="field-wrap">
                                        <label className="field-label">{item.label}</label>
                                        <input className="field" type="text" value={item.value} disabled />
                                    </div>
                                ))}
                            </div>

                            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '-8px' }}>
                                Read-only fields are managed by CMC. Contact your District Engineer to request changes.
                            </p>

                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
                                <button type="submit" disabled={saving} className="save-btn">
                                    {saving ? (
                                        <><div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />Saving...</>
                                    ) : (
                                        <><span className="msf" style={{ fontSize: '18px' }}>save</span>Save changes</>
                                    )}
                                </button>
                                <button type="button" onClick={() => { setFullName(profile?.full_name || ''); setPhone(profile?.phone || ''); setAddress(profile?.address || ''); setOrgName(profile?.organisation_name || '') }}
                                    style={{ padding: '12px 20px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: '#475569' }}>
                                    Reset
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Right: account info */}
                    <div className="a3" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                        {/* Account status */}
                        <div className="card" style={{ padding: '20px 24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '14px' }}>
                                Account status
                            </p>
                            <div>
                                {[
                                    {
                                        label: 'Account',
                                        value: profile?.is_approved ? 'Approved' : 'Pending approval',
                                        icon: profile?.is_approved ? 'verified' : 'pending',
                                        color: profile?.is_approved ? '#00450d' : '#d97706',
                                        bg: profile?.is_approved ? '#f0fdf4' : '#fffbeb',
                                    },
                                    {
                                        label: 'Service',
                                        value: profile?.billing_suspended ? 'Suspended' : 'Active',
                                        icon: profile?.billing_suspended ? 'block' : 'check_circle',
                                        color: profile?.billing_suspended ? '#ba1a1a' : '#00450d',
                                        bg: profile?.billing_suspended ? '#fef2f2' : '#f0fdf4',
                                    },
                                    {
                                        label: 'Billing',
                                        value: profile?.billing_cycle === 'quarterly' ? 'Quarterly' : 'Monthly',
                                        icon: 'calendar_month',
                                        color: '#1d4ed8',
                                        bg: '#eff6ff',
                                    },
                                ].map(item => (
                                    <div key={item.label} className="info-row">
                                        <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="msf" style={{ fontSize: '17px', color: item.color }}>{item.icon}</span>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22' }}>{item.value}</p>
                                            <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>{item.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Account details */}
                        <div className="card" style={{ padding: '20px 24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '14px' }}>
                                Account details
                            </p>
                            <div>
                                {[
                                    { label: 'Member since', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—', icon: 'event' },
                                    { label: 'District', value: profile?.district || '—', icon: 'location_city' },
                                    { label: 'Ward', value: profile?.ward || '—', icon: 'map' },
                                    { label: 'Reg. number', value: profile?.business_registration_number || 'Not set', icon: 'badge' },
                                ].map(item => (
                                    <div key={item.label} className="info-row">
                                        <span className="msf" style={{ fontSize: '16px', color: '#00450d', flexShrink: 0 }}>{item.icon}</span>
                                        <div>
                                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22' }}>{item.value}</p>
                                            <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>{item.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Help note */}
                        <div style={{ borderRadius: '14px', padding: '14px 16px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', display: 'flex', gap: '10px' }}>
                            <span className="msf" style={{ color: '#00450d', fontSize: '16px', flexShrink: 0 }}>info</span>
                            <p style={{ fontSize: '11px', color: '#41493e', lineHeight: 1.5 }}>
                                To change your district, ward, billing cycle, or registration number, contact CMC at <strong>011 269 4614</strong>.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}