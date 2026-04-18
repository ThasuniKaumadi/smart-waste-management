'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { logComplaintOnChain } from '@/lib/blockchain'

const COMMERCIAL_NAV = [
    { label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' },
    { label: 'Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_month' },
    { label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' },
    { label: 'Bins', href: '/dashboard/commercial/bins', icon: 'delete' },
    { label: 'Collection History', href: '/dashboard/commercial/collection-history', icon: 'history' },
    { label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' },
    { label: 'Complaints', href: '/dashboard/commercial/complaints', icon: 'feedback' },
    { label: 'Rate Service', href: '/dashboard/commercial/feedback', icon: 'star' },
]

const COMPLAINT_TYPES = [
    { value: 'missed_collection', label: 'Missed Collection', icon: 'delete', color: '#dc2626', bg: '#fef2f2' },
    { value: 'delayed_collection', label: 'Delayed Collection', icon: 'schedule', color: '#d97706', bg: '#fffbeb' },
    { value: 'illegal_dumping', label: 'Illegal Dumping', icon: 'delete_forever', color: '#7c3aed', bg: '#faf5ff' },
    { value: 'blocked_drainage', label: 'Blocked Drainage', icon: 'water_damage', color: '#0e7490', bg: '#ecfeff' },
    { value: 'collection_refusal', label: 'Collection Refusal', icon: 'block', color: '#b45309', bg: '#fffbeb' },
    { value: 'other', label: 'Other Issue', icon: 'more_horiz', color: '#475569', bg: '#f8fafc' },
]

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    submitted: { label: 'Submitted', color: '#92400e', bg: '#fefce8', border: '#fde68a' },
    in_progress: { label: 'In Progress', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    resolved: { label: 'Resolved', color: '#00450d', bg: '#f0fdf4', border: '#bbf7d0' },
}

interface Complaint {
    id: string; description: string; complaint_type: string
    custom_complaint_type: string; status: string; blockchain_tx: string; created_at: string
}

export default function CommercialComplaintsPage() {
    const [complaints, setComplaints] = useState<Complaint[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [success, setSuccess] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [formData, setFormData] = useState({ complaint_type: '', custom_complaint_type: '', description: '' })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data } = await supabase.from('complaints').select('*').eq('submitted_by', user.id).order('created_at', { ascending: false })
        setComplaints(data || [])
        setLoading(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setErrorMsg('')
        if (!formData.description.trim()) { setErrorMsg('Please describe your complaint.'); return }
        setSaving(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            const finalType = formData.custom_complaint_type.trim() || formData.complaint_type || 'general'
            const { data: cd, error } = await supabase.from('complaints').insert({
                submitted_by: user?.id, role: 'commercial_establishment',
                district: profile?.district, complaint_type: finalType,
                custom_complaint_type: formData.custom_complaint_type.trim() || null,
                description: formData.description, status: 'submitted',
            }).select().single()
            if (error) { setErrorMsg(error.message); return }
            if (cd) {
                const tx = await logComplaintOnChain(cd.id, profile?.district || '')
                if (tx) await supabase.from('complaints').update({ blockchain_tx: tx }).eq('id', cd.id)
            }
            setSuccess(true)
            setFormData({ complaint_type: '', custom_complaint_type: '', description: '' })
            await loadData()
            setTimeout(() => setSuccess(false), 5000)
        } finally { setSaving(false) }
    }

    function typeInfo(c: Complaint) {
        return COMPLAINT_TYPES.find(t => t.value === c.complaint_type) || COMPLAINT_TYPES[5]
    }
    function typeLabel(c: Complaint) {
        return c.custom_complaint_type || COMPLAINT_TYPES.find(t => t.value === c.complaint_type)?.label || c.complaint_type
    }

    const inProgress = complaints.filter(c => c.status === 'in_progress').length
    const resolved = complaints.filter(c => c.status === 'resolved').length

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
                .type-btn{border:1.5px solid rgba(0,69,13,0.1);border-radius:12px;padding:10px 12px;cursor:pointer;background:white;display:flex;align-items:center;gap:8px;transition:all 0.15s;text-align:left}
                .type-btn:hover{border-color:rgba(0,69,13,0.25);background:#f9fbf7}
                .type-btn.on{border-width:2px;box-shadow:0 0 0 3px rgba(0,69,13,0.08)}
                .field{width:100%;padding:10px 12px;border:1.5px solid rgba(0,69,13,0.12);border-radius:10px;font-size:13px;color:#181c22;font-family:inherit;background:#fafafa;outline:none;transition:border-color 0.15s;box-sizing:border-box}
                .field:focus{border-color:#00450d;background:white}
                .field::placeholder{color:#9ca3af}
                .submit-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:13px;border-radius:12px;background:#00450d;color:white;border:none;cursor:pointer;font-family:'Manrope',sans-serif;font-weight:700;font-size:14px;transition:all 0.2s}
                .submit-btn:hover{background:#1b5e20;box-shadow:0 4px 16px rgba(0,69,13,0.25)}
                .submit-btn:disabled{opacity:0.6;cursor:not-allowed}
                .c-row{padding:16px 20px;border-bottom:1px solid rgba(0,69,13,0.04);display:flex;align-items:flex-start;gap:12px;transition:background 0.1s}
                .c-row:hover{background:#fafaf9}
                .c-row:last-child{border-bottom:none}
                .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;font-family:'Manrope',sans-serif;letter-spacing:0.06em;text-transform:uppercase;border:1px solid transparent}
                .field-label{font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#717a6d;font-family:'Manrope',sans-serif;display:block;margin-bottom:7px}
                @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
                .a1{animation:fadeUp 0.4s ease 0.05s both}
                .a2{animation:fadeUp 0.4s ease 0.1s both}
                .a3{animation:fadeUp 0.4s ease 0.15s both}
            `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Commercial Portal · ClearPath
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif' }}>
                        My <span style={{ color: '#00450d' }}>Complaints</span>
                    </h1>
                    {profile?.district && (
                        <span style={{ fontSize: '12px', color: '#717a6d', padding: '6px 14px', borderRadius: '99px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            {profile.district}
                        </span>
                    )}
                </div>
            </div>

            {/* Stat strip */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                    { label: 'Total filed', value: complaints.length, icon: 'feedback', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'In progress', value: inProgress, icon: 'pending', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Resolved', value: resolved, icon: 'check_circle', color: '#15803d', bg: '#f0fdf4' },
                ].map(s => (
                    <div key={s.label} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msf" style={{ fontSize: '18px', color: s.color }}>{s.icon}</span>
                        </div>
                        <div>
                            <p style={{ fontSize: '22px', fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{s.value}</p>
                            <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Split layout: form left, history right */}
            <div className="a3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

                {/* Left: complaint form — always visible */}
                <div className="card" style={{ position: 'sticky', top: '20px' }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', background: '#00450d', borderRadius: '20px 20px 0 0' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'white', fontFamily: 'Manrope,sans-serif' }}>File a Complaint</h2>
                        <p style={{ fontSize: '11px', color: 'rgba(163,246,156,0.7)', marginTop: '3px' }}>Logged on Polygon Amoy blockchain for transparency</p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        {/* Success */}
                        {success && (
                            <div style={{ borderRadius: '10px', padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="msf" style={{ color: '#00450d', fontSize: '18px' }}>check_circle</span>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>Complaint submitted and logged on chain.</p>
                            </div>
                        )}
                        {errorMsg && (
                            <div style={{ borderRadius: '10px', padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="msf" style={{ color: '#ba1a1a', fontSize: '18px' }}>error</span>
                                <p style={{ fontSize: '12px', color: '#ba1a1a' }}>{errorMsg}</p>
                            </div>
                        )}

                        {/* Complaint type grid */}
                        <div>
                            <span className="field-label">Issue type <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></span>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {COMPLAINT_TYPES.map(ct => {
                                    const isOn = formData.complaint_type === ct.value
                                    return (
                                        <button key={ct.value} type="button"
                                            className={`type-btn ${isOn ? 'on' : ''}`}
                                            style={isOn ? { borderColor: ct.color, background: ct.bg } : {}}
                                            onClick={() => setFormData(f => ({ ...f, complaint_type: f.complaint_type === ct.value ? '' : ct.value }))}>
                                            <span className="msf" style={{ fontSize: '16px', color: isOn ? ct.color : '#94a3b8', flexShrink: 0 }}>{ct.icon}</span>
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: isOn ? ct.color : '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1.3 }}>{ct.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Custom type */}
                        <div>
                            <span className="field-label">Custom type <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(overrides above)</span></span>
                            <input className="field" placeholder="e.g. Waste left on pavement..."
                                value={formData.custom_complaint_type}
                                onChange={e => setFormData(f => ({ ...f, custom_complaint_type: e.target.value }))} />
                        </div>

                        {/* Description */}
                        <div>
                            <span className="field-label">Description <span style={{ color: '#ba1a1a' }}>*</span></span>
                            <textarea className="field" rows={4} style={{ resize: 'vertical' }}
                                placeholder="Describe the issue in detail — what happened, when, and where..."
                                value={formData.description}
                                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                                required />
                        </div>

                        {/* Info */}
                        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                            <span className="msf" style={{ color: '#00450d', fontSize: '16px', flexShrink: 0 }}>info</span>
                            <p style={{ fontSize: '11px', color: '#41493e', lineHeight: 1.5 }}>Only the description is required. A complaint type helps CMC route your complaint faster.</p>
                        </div>

                        <button type="submit" disabled={saving} className="submit-btn">
                            {saving ? (
                                <><div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />Submitting...</>
                            ) : (
                                <><span className="msf" style={{ fontSize: '18px' }}>send</span>Submit Complaint</>
                            )}
                        </button>
                    </form>
                </div>

                {/* Right: complaint history */}
                <div className="card">
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>Complaint History</h2>
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>{complaints.length} total</span>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid #00450d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                    ) : complaints.length === 0 ? (
                        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                <span className="msf" style={{ color: '#00450d', fontSize: '28px' }}>check_circle</span>
                            </div>
                            <p style={{ fontSize: '15px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: '6px' }}>No complaints filed</p>
                            <p style={{ fontSize: '13px', color: '#94a3b8' }}>All clear for your establishment.</p>
                        </div>
                    ) : (
                        <div>
                            {complaints.map(c => {
                                const ti = typeInfo(c)
                                const sc = STATUS_CFG[c.status] || STATUS_CFG.submitted
                                return (
                                    <div key={c.id} className="c-row">
                                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: ti.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="msf" style={{ fontSize: '18px', color: ti.color }}>{ti.icon}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22' }}>{typeLabel(c)}</p>
                                                <span className="badge" style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>{sc.label}</span>
                                            </div>
                                            <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginBottom: '6px' }}>
                                                {c.description.length > 120 ? c.description.slice(0, 120) + '...' : c.description}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                    {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                {c.blockchain_tx && (
                                                    <a href={`https://amoy.polygonscan.com/tx/${c.blockchain_tx}`} target="_blank" rel="noopener noreferrer"
                                                        style={{ fontSize: '11px', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none', fontFamily: 'Manrope,sans-serif', fontWeight: 600 }}>
                                                        <span className="msf" style={{ fontSize: '12px' }}>link</span>
                                                        Chain ↗
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {complaints.length > 0 && (
                        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="msf" style={{ color: '#7c3aed', fontSize: '14px' }}>verified</span>
                            <p style={{ fontSize: '11px', color: '#717a6d' }}>All complaints logged on Polygon Amoy · CMC EcoLedger 2026</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}