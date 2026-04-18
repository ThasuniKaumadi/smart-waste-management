'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const RESIDENT_NAV = [
    { label: 'Overview', href: '/dashboard/resident', icon: 'dashboard' },
    { label: 'Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' },
    { label: 'Track Vehicle', href: '/dashboard/resident/tracking', icon: 'location_on' },
    { label: 'Report Issue', href: '/dashboard/resident/report-dumping', icon: 'report_problem' },
    { label: 'Complaints', href: '/dashboard/resident/complaints', icon: 'feedback' },
    { label: 'Rate Service', href: '/dashboard/resident/feedback', icon: 'star' },
    { label: 'My Profile', href: '/dashboard/resident/profile', icon: 'person' },
]

const REPORT_TYPES = [
    { value: 'illegal_dumping', label: 'Illegal Dumping', icon: 'delete_forever', color: '#dc2626', bg: '#fef2f2', desc: 'Someone dumping waste illegally' },
    { value: 'missed_collection', label: 'Missed Collection', icon: 'delete', color: '#d97706', bg: '#fffbeb', desc: 'Scheduled collection did not happen' },
    { value: 'blocked_drainage', label: 'Blocked Drainage', icon: 'water_damage', color: '#0e7490', bg: '#ecfeff', desc: 'Waste blocking drainage or waterways' },
]

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; step: number }> = {
    pending: { label: 'Pending', color: '#92400e', bg: '#fefce8', border: '#fde68a', step: 0 },
    assigned: { label: 'Assigned', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', step: 1 },
    resolved: { label: 'Resolved', color: '#00450d', bg: '#f0fdf4', border: '#bbf7d0', step: 2 },
}

const TIMELINE_STEPS = [
    { label: 'Submitted', icon: 'send' },
    { label: 'Under Review', icon: 'manage_search' },
    { label: 'Resolved', icon: 'check_circle' },
]

interface WasteReport {
    id: string; report_type: string; description: string
    location_address: string; status: string; photo_url: string | null
    created_at: string; latitude: number | null; longitude: number | null
}

export default function ReportDumpingPage() {
    const router = useRouter()
    const [reports, setReports] = useState<WasteReport[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [success, setSuccess] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [expanded, setExpanded] = useState<string | null>(null)
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [latitude, setLatitude] = useState<number | null>(null)
    const [longitude, setLongitude] = useState<number | null>(null)
    const [locationLoading, setLocationLoading] = useState(false)
    const [locationError, setLocationError] = useState('')
    const [formData, setFormData] = useState({ report_type: '', description: '', location_address: '' })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data } = await supabase.from('waste_reports').select('*')
            .eq('submitted_by', user.id).order('created_at', { ascending: false })
        setReports(data || [])
        setLoading(false)
    }

    function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) {
            setPhotoFile(file)
            const reader = new FileReader()
            reader.onloadend = () => setPhotoPreview(reader.result as string)
            reader.readAsDataURL(file)
        }
    }

    function getLocation() {
        setLocationLoading(true); setLocationError('')
        if (!navigator.geolocation) { setLocationError('Geolocation not supported'); setLocationLoading(false); return }
        navigator.geolocation.getCurrentPosition(
            pos => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); setLocationLoading(false) },
            () => { setLocationError('Unable to get location. Please allow access.'); setLocationLoading(false) }
        )
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setErrorMsg('')
        if (!formData.report_type) { setErrorMsg('Please select a report type.'); return }
        setSaving(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            let photoUrl = null
            if (photoFile) {
                const fileExt = photoFile.name.split('.').pop()
                const fileName = `${user?.id}-${Date.now()}.${fileExt}`
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('waste-reports').upload(fileName, photoFile)
                if (!uploadError && uploadData) {
                    const { data: urlData } = supabase.storage.from('waste-reports').getPublicUrl(fileName)
                    photoUrl = urlData.publicUrl
                }
            }
            const { error } = await supabase.from('waste_reports').insert({
                submitted_by: user?.id,
                report_type: formData.report_type,
                description: formData.description,
                location_address: formData.location_address,
                district: profile?.district,
                photo_url: photoUrl,
                status: 'pending',
                latitude, longitude,
            })
            if (error) { setErrorMsg(error.message); return }
            setSuccess(true)
            setFormData({ report_type: '', description: '', location_address: '' })
            setPhotoFile(null); setPhotoPreview(null)
            setLatitude(null); setLongitude(null)
            await loadData()
            setTimeout(() => setSuccess(false), 5000)
        } finally { setSaving(false) }
    }

    const pending = reports.filter(r => r.status === 'pending').length
    const resolved = reports.filter(r => r.status === 'resolved').length

    return (
        <DashboardLayout role="Resident" userName={profile?.full_name || ''} navItems={RESIDENT_NAV}
            primaryAction={{ label: 'View Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' }}>
            <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
        .type-btn{border:1.5px solid rgba(0,69,13,0.1);border-radius:12px;padding:10px 12px;cursor:pointer;background:white;display:flex;align-items:center;gap:8px;transition:all 0.15s;text-align:left;width:100%}
        .type-btn:hover{border-color:rgba(0,69,13,0.25);background:#f9fbf7}
        .type-btn.on{border-width:2px;box-shadow:0 0 0 3px rgba(0,69,13,0.08)}
        .field{width:100%;padding:10px 12px;border:1.5px solid rgba(0,69,13,0.12);border-radius:10px;font-size:13px;color:#181c22;font-family:inherit;background:#fafafa;outline:none;transition:border-color 0.15s;box-sizing:border-box}
        .field:focus{border-color:#00450d;background:white}
        .field::placeholder{color:#9ca3af}
        .submit-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:13px;border-radius:12px;background:#00450d;color:white;border:none;cursor:pointer;font-family:'Manrope',sans-serif;font-weight:700;font-size:14px;transition:all 0.2s}
        .submit-btn:hover{background:#1b5e20;box-shadow:0 4px 16px rgba(0,69,13,0.25)}
        .submit-btn:disabled{opacity:0.6;cursor:not-allowed}
        .r-row{padding:16px 20px;border-bottom:1px solid rgba(0,69,13,0.04);cursor:pointer;transition:background 0.1s}
        .r-row:hover{background:#fafaf9}
        .r-row:last-child{border-bottom:none}
        .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;font-family:'Manrope',sans-serif;letter-spacing:0.06em;text-transform:uppercase;border:1px solid transparent}
        .field-label{font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#717a6d;font-family:'Manrope',sans-serif;display:block;margin-bottom:7px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .slide-down{animation:slideDown .2s ease both}
        .a1{animation:fadeUp 0.4s ease 0.05s both}
        .a2{animation:fadeUp 0.4s ease 0.1s both}
        .a3{animation:fadeUp 0.4s ease 0.15s both}
      `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>
                    Resident Portal
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <h1 style={{ fontSize: 42, fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif' }}>
                        Report <span style={{ color: '#00450d' }}>Issue</span>
                    </h1>
                    {profile?.district && (
                        <span style={{ fontSize: 12, color: '#717a6d', padding: '6px 14px', borderRadius: 99, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            {profile.district}
                        </span>
                    )}
                </div>
            </div>

            {/* Stat strip */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Total', value: reports.length, icon: 'report', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Pending', value: pending, icon: 'pending', color: '#d97706', bg: '#fffbeb' },
                    { label: 'Resolved', value: resolved, icon: 'check_circle', color: '#15803d', bg: '#f0fdf4' },
                ].map(s => (
                    <div key={s.label} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msf" style={{ fontSize: 18, color: s.color }}>{s.icon}</span>
                        </div>
                        <div>
                            <p style={{ fontSize: 22, fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{s.value}</p>
                            <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Split layout */}
            <div className="a3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

                {/* Left: form — sticky */}
                <div className="card" style={{ position: 'sticky', top: 20 }}>
                    <div style={{ padding: '20px 24px', background: '#00450d', borderRadius: '20px 20px 0 0' }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white', fontFamily: 'Manrope,sans-serif' }}>Submit a Report</h2>
                        <p style={{ fontSize: 11, color: 'rgba(163,246,156,0.7)', marginTop: 3 }}>Help CMC keep your district clean</p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {success && (
                            <div style={{ borderRadius: 10, padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="msf" style={{ color: '#00450d', fontSize: 18 }}>check_circle</span>
                                <p style={{ fontSize: 12, fontWeight: 600, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>Report submitted successfully.</p>
                            </div>
                        )}
                        {errorMsg && (
                            <div style={{ borderRadius: 10, padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="msf" style={{ color: '#ba1a1a', fontSize: 18 }}>error</span>
                                <p style={{ fontSize: 12, color: '#ba1a1a' }}>{errorMsg}</p>
                            </div>
                        )}

                        {/* Report type */}
                        <div>
                            <span className="field-label">Report type <span style={{ color: '#ba1a1a' }}>*</span></span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {REPORT_TYPES.map(rt => {
                                    const isOn = formData.report_type === rt.value
                                    return (
                                        <button key={rt.value} type="button"
                                            className={`type-btn ${isOn ? 'on' : ''}`}
                                            style={isOn ? { borderColor: rt.color, background: rt.bg } : {}}
                                            onClick={() => setFormData(f => ({ ...f, report_type: f.report_type === rt.value ? '' : rt.value }))}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: isOn ? `${rt.color}15` : '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span className="msf" style={{ fontSize: 17, color: isOn ? rt.color : '#94a894' }}>{rt.icon}</span>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: isOn ? rt.color : '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 1 }}>{rt.label}</p>
                                                <p style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.3 }}>{rt.desc}</p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Location */}
                        <div>
                            <span className="field-label">Location / Address <span style={{ color: '#ba1a1a' }}>*</span></span>
                            <input className="field" placeholder="Street, landmark..."
                                value={formData.location_address}
                                onChange={e => setFormData(f => ({ ...f, location_address: e.target.value }))} required />
                        </div>

                        {/* Description */}
                        <div>
                            <span className="field-label">Description <span style={{ color: '#ba1a1a' }}>*</span></span>
                            <textarea className="field" rows={3} style={{ resize: 'vertical' }}
                                placeholder="Describe the issue in detail..."
                                value={formData.description}
                                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} required />
                        </div>

                        {/* Photo */}
                        <div>
                            <span className="field-label">Photo <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></span>
                            {photoPreview ? (
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <img src={photoPreview} alt="Preview" style={{ maxHeight: 140, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                                        style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="msf" style={{ fontSize: 14 }}>close</span>
                                    </button>
                                </div>
                            ) : (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1.5px dashed rgba(0,69,13,0.2)', borderRadius: 10, cursor: 'pointer', background: '#f9fbf9' }}>
                                    <span className="msf" style={{ fontSize: 20, color: '#717a6d' }}>upload</span>
                                    <span style={{ fontSize: 13, color: '#717a6d' }}>Click to upload a photo</span>
                                    <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                                </label>
                            )}
                        </div>

                        {/* GPS */}
                        <div>
                            <span className="field-label">GPS Location <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></span>
                            <button type="button" onClick={getLocation}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, background: latitude ? 'rgba(0,69,13,0.07)' : '#f0f4f0', border: `1.5px solid ${latitude ? 'rgba(0,69,13,0.2)' : '#e4ede4'}`, color: latitude ? '#00450d' : '#717a6d', padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Manrope,sans-serif', width: '100%' }}>
                                <span className="msf" style={{ fontSize: 17 }}>{locationLoading ? 'sync' : latitude ? 'location_on' : 'my_location'}</span>
                                {locationLoading ? 'Getting location...' : latitude ? `${latitude.toFixed(4)}, ${longitude?.toFixed(4)}` : 'Use My Location'}
                            </button>
                            {locationError && <p style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{locationError}</p>}
                        </div>

                        <button type="submit" disabled={saving} className="submit-btn">
                            {saving
                                ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />Submitting...</>
                                : <><span className="msf" style={{ fontSize: 18 }}>send</span>Submit Report</>}
                        </button>
                    </form>
                </div>

                {/* Right: report history with timeline */}
                <div className="card">
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>My Reports</h2>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{reports.length} total</span>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #00450d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                    ) : reports.length === 0 ? (
                        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                <span className="msf" style={{ color: '#00450d', fontSize: 28 }}>check_circle</span>
                            </div>
                            <p style={{ fontSize: 15, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 6 }}>No reports yet</p>
                            <p style={{ fontSize: 13, color: '#94a3b8' }}>Help keep your district clean by reporting issues.</p>
                        </div>
                    ) : (
                        <div>
                            {reports.map(r => {
                                const rt = REPORT_TYPES.find(t => t.value === r.report_type)
                                const sc = STATUS_CFG[r.status] || STATUS_CFG.pending
                                const isExpanded = expanded === r.id
                                return (
                                    <div key={r.id}>
                                        <div className="r-row" onClick={() => setExpanded(isExpanded ? null : r.id)}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                                <div style={{ width: 38, height: 38, borderRadius: 10, background: rt?.bg || '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <span className="msf" style={{ fontSize: 18, color: rt?.color || '#475569' }}>{rt?.icon || 'report'}</span>
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                                        <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22' }}>{rt?.label || r.report_type}</p>
                                                        <span className="badge" style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>{sc.label}</span>
                                                    </div>
                                                    <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 5 }}>
                                                        {r.description.length > 100 ? r.description.slice(0, 100) + '...' : r.description}
                                                    </p>
                                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: '#94a3b8' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                            <span className="msf" style={{ fontSize: 12 }}>location_on</span>{r.location_address}
                                                        </span>
                                                        <span>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                        {r.latitude && <span style={{ color: '#00450d', display: 'flex', alignItems: 'center', gap: 2 }}><span className="msf" style={{ fontSize: 12 }}>my_location</span>GPS</span>}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                    {r.photo_url && <img src={r.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />}
                                                    <span className="msf" style={{ fontSize: 18, color: '#94a3b8' }}>{isExpanded ? 'expand_less' : 'expand_more'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* R29 — Timeline */}
                                        {isExpanded && (
                                            <div className="slide-down" style={{ padding: '16px 20px 20px', background: '#fafbfa', borderBottom: '1px solid rgba(0,69,13,0.04)' }}>
                                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 16 }}>Report Progress</p>
                                                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                                    {TIMELINE_STEPS.map((step, i) => {
                                                        const done = i <= sc.step
                                                        const current = i === sc.step
                                                        const isLast = i === TIMELINE_STEPS.length - 1
                                                        return (
                                                            <div key={step.label} style={{ display: 'flex', alignItems: 'flex-start', flex: isLast ? 'none' : 1 }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                                    <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? (current && r.status !== 'resolved' ? '#1d4ed8' : '#00450d') : '#e5e7eb', boxShadow: current ? '0 0 0 3px rgba(29,78,216,0.15)' : 'none', transition: 'all 0.3s' }}>
                                                                        <span className="msf" style={{ fontSize: 16, color: done ? 'white' : '#94a3b8', fontVariationSettings: done ? "'FILL' 1" : "'FILL' 0" }}>{step.icon}</span>
                                                                    </div>
                                                                    <p style={{ fontSize: 10, fontWeight: done ? 700 : 500, color: done ? '#181c22' : '#94a3b8', fontFamily: 'Manrope,sans-serif', marginTop: 6, textAlign: 'center', whiteSpace: 'nowrap' }}>{step.label}</p>
                                                                </div>
                                                                {!isLast && <div style={{ flex: 1, height: 2, marginTop: 16, background: i < sc.step ? '#00450d' : '#e5e7eb', transition: 'background 0.3s' }} />}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                <p style={{ fontSize: 11, color: '#717a6d', marginTop: 14 }}>
                                                    Submitted {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}