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
    { label: 'My Profile', desc: 'Update your details', icon: 'person', href: '/dashboard/resident/profile', color: '#7c3aed', bg: 'rgba(124,58,237,0.07)' },
]

const REPORT_TYPES = [
    { value: 'illegal_dumping', label: 'Illegal Dumping', icon: 'delete_forever', color: '#ef4444', description: 'Someone dumping waste illegally' },
    { value: 'missed_collection', label: 'Missed Collection', icon: 'delete', color: '#f97316', description: 'Scheduled collection did not happen' },
    { value: 'blocked_drainage', label: 'Blocked Drainage', icon: 'water_damage', color: '#3b82f6', description: 'Waste blocking drainage or waterways' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; step: number }> = {
    pending: { label: 'Pending', color: '#b45309', bg: 'rgba(180,83,9,0.08)', step: 0 },
    assigned: { label: 'Assigned', color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)', step: 1 },
    resolved: { label: 'Resolved', color: '#15803d', bg: 'rgba(21,128,61,0.08)', step: 2 },
}

const TIMELINE_STEPS = [
    { label: 'Submitted', icon: 'send', key: 'pending' },
    { label: 'Under Review', icon: 'manage_search', key: 'assigned' },
    { label: 'Resolved', icon: 'check_circle', key: 'resolved' },
]

interface WasteReport {
    id: string
    report_type: string
    description: string
    location_address: string
    status: string
    photo_url: string | null
    created_at: string
    latitude: number | null
    longitude: number | null
}

export default function ReportDumpingPage() {
    const router = useRouter()
    const [reports, setReports] = useState<WasteReport[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [expanded, setExpanded] = useState<string | null>(null)
    const [profile, setProfile] = useState<any>(null)
    const [toast, setToast] = useState('')
    const [toastType, setToastType] = useState<'success' | 'error'>('success')
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [latitude, setLatitude] = useState<number | null>(null)
    const [longitude, setLongitude] = useState<number | null>(null)
    const [locationLoading, setLocationLoading] = useState(false)
    const [locationError, setLocationError] = useState('')
    const [formData, setFormData] = useState({ report_type: '', description: '', location_address: '' })

    useEffect(() => { loadData() }, [])

    function showToast(msg: string, type: 'success' | 'error' = 'success') {
        setToast(msg); setToastType(type)
        setTimeout(() => setToast(''), 3500)
    }

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
        if (!formData.report_type) { showToast('Please select a report type', 'error'); return }
        setSaving(true)
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
        if (error) {
            showToast('Error: ' + error.message, 'error')
        } else {
            showToast('Report submitted successfully!')
            setShowForm(false)
            setFormData({ report_type: '', description: '', location_address: '' })
            setPhotoFile(null); setPhotoPreview(null)
            setLatitude(null); setLongitude(null)
            loadData()
        }
        setSaving(false)
    }

    function getStepIndex(status: string) {
        return STATUS_CONFIG[status]?.step ?? 0
    }

    return (
        <DashboardLayout
            role="Resident"
            userName={profile?.full_name || ''}
            navItems={RESIDENT_NAV}
            primaryAction={{ label: 'New Report', href: '#', icon: 'add' }}
        >
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .report-type-card { border:1.5px solid #e4ede4; border-radius:12px; padding:16px; cursor:pointer; transition:all 0.2s ease; background:#f9fbf9; text-align:left; }
        .report-type-card:hover { border-color:rgba(0,69,13,0.3); background:white; }
        .report-type-card.selected { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.07); }
        .form-input { width:100%; border:1.5px solid #e4ede4; border-radius:10px; padding:12px 16px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; transition:all 0.2s; outline:none; background:#f9fbf9; box-sizing:border-box; }
        .form-input:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.07); }
        .form-input::placeholder { color:#c0ccc0; }
        textarea.form-input { resize:vertical; min-height:90px; }
        .report-row { padding:16px 20px; border-bottom:1px solid rgba(0,69,13,0.04); cursor:pointer; transition:background 0.15s; }
        .report-row:hover { background:#f9fbf9; }
        .report-row:last-child { border-bottom:none; }
        .submit-btn { background:#00450d; color:white; border:none; border-radius:10px; padding:13px 28px; font-family:'Manrope',sans-serif; font-weight:700; font-size:14px; cursor:pointer; display:flex; align-items:center; gap:8px; }
        .submit-btn:hover:not(:disabled) { background:#1b5e20; }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .toast { animation:slideUp 0.3s ease; }
        @keyframes slideUp { from{transform:translateY(12px) translateX(-50%);opacity:0} to{transform:translateY(0) translateX(-50%);opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .s1{animation:fadeUp .4s ease .04s both} .s2{animation:fadeUp .4s ease .09s both} .s3{animation:fadeUp .4s ease .14s both}
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .slide-down { animation:slideDown 0.25s ease both; }
      `}</style>

            {toast && (
                <div className="toast" style={{ position: 'fixed', bottom: 24, left: '50%', background: toastType === 'error' ? '#dc2626' : '#181c22', color: 'white', padding: '10px 20px', borderRadius: 9999, fontSize: 13, fontWeight: 500, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: toastType === 'error' ? '#fca5a5' : '#4ade80' }}>{toastType === 'error' ? 'error' : 'check_circle'}</span>
                    {toast}
                </div>
            )}

            {/* Header */}
            <section className="s1" style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', display: 'block', marginBottom: 8 }}>Resident Portal</span>
                        <h1 style={{ fontSize: 48, fontWeight: 900, fontFamily: 'Manrope,sans-serif', color: '#181c22', lineHeight: 1.1, marginBottom: 6 }}>
                            Report <span style={{ color: '#1b5e20' }}>Issue</span>
                        </h1>
                        <p style={{ fontSize: 13, color: '#717a6d' }}>{profile?.district || 'CMC District'}</p>
                    </div>
                    <button onClick={() => setShowForm(!showForm)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: showForm ? '#f1f5f9' : '#00450d', color: showForm ? '#64748b' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{showForm ? 'close' : 'add'}</span>
                        {showForm ? 'Cancel' : 'New Report'}
                    </button>
                </div>
            </section>

            {/* Stats */}
            <div className="s2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
                {[
                    { label: 'Total', value: reports.length, color: '#00450d', bg: '#f0fdf4', icon: 'report' },
                    { label: 'Pending', value: reports.filter(r => r.status === 'pending').length, color: '#b45309', bg: '#fffbeb', icon: 'pending' },
                    { label: 'Resolved', value: reports.filter(r => r.status === 'resolved').length, color: '#15803d', bg: '#f0fdf4', icon: 'check_circle' },
                ].map(m => (
                    <div key={m.label} className="bento-card" style={{ padding: 20 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                            <span className="material-symbols-outlined" style={{ color: m.color, fontSize: 18 }}>{m.icon}</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 24, color: '#181c22', marginBottom: 2 }}>{m.value}</p>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Form */}
            {showForm && (
                <div className="bento-card slide-down s2" style={{ marginBottom: 24 }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 18, color: '#181c22' }}>Submit Waste Report</h3>
                        <p style={{ fontSize: 13, color: '#717a6d', marginTop: 4 }}>Help CMC keep your district clean</p>
                    </div>
                    <form onSubmit={handleSubmit} style={{ padding: 24 }}>
                        {/* Report type */}
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Report Type *</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                                {REPORT_TYPES.map(type => (
                                    <div key={type.value}
                                        className={`report-type-card ${formData.report_type === type.value ? 'selected' : ''}`}
                                        onClick={() => setFormData({ ...formData, report_type: type.value })}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, marginBottom: 10, background: formData.report_type === type.value ? `${type.color}15` : '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: formData.report_type === type.value ? type.color : '#94a894' }}>{type.icon}</span>
                                        </div>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: formData.report_type === type.value ? '#00450d' : '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 3px' }}>{type.label}</p>
                                        <p style={{ fontSize: 11, color: '#717a6d', margin: 0, lineHeight: 1.4 }}>{type.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Location */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>Location / Address *</label>
                            <input className="form-input" placeholder="Where is the issue? (street, landmark)"
                                value={formData.location_address} onChange={e => setFormData({ ...formData, location_address: e.target.value })} required />
                        </div>

                        {/* Description */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>Description *</label>
                            <textarea className="form-input" placeholder="Describe the issue in detail..."
                                value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required />
                        </div>

                        {/* Photo */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>
                                Photo Evidence <span style={{ color: '#94a3b8', fontWeight: 500, textTransform: 'none' }}>· optional</span>
                            </label>
                            {photoPreview ? (
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <img src={photoPreview} alt="Preview" style={{ maxHeight: 160, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                                        style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                                    </button>
                                </div>
                            ) : (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', border: '1.5px dashed #c4cdc4', borderRadius: 10, cursor: 'pointer', background: '#f9fbf9' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#717a6d' }}>upload</span>
                                    <span style={{ fontSize: 13, color: '#717a6d' }}>Click to upload a photo</span>
                                    <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                                </label>
                            )}
                        </div>

                        {/* GPS */}
                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 7 }}>
                                GPS Location <span style={{ color: '#94a3b8', fontWeight: 500, textTransform: 'none' }}>· optional</span>
                            </label>
                            <button type="button" onClick={getLocation} style={{ display: 'flex', alignItems: 'center', gap: 8, background: latitude ? 'rgba(0,69,13,0.07)' : '#f0f4f0', border: `1.5px solid ${latitude ? 'rgba(0,69,13,0.2)' : '#e4ede4'}`, color: latitude ? '#00450d' : '#717a6d', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Manrope,sans-serif' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{locationLoading ? 'sync' : latitude ? 'location_on' : 'my_location'}</span>
                                {locationLoading ? 'Getting location...' : latitude ? `${latitude.toFixed(4)}, ${longitude?.toFixed(4)}` : 'Use My Location'}
                            </button>
                            {locationError && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{locationError}</p>}
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button type="submit" disabled={saving} className="submit-btn">
                                {saving
                                    ? <><div style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Submitting...</>
                                    : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>Submit Report</>}
                            </button>
                            <button type="button" onClick={() => setShowForm(false)}
                                style={{ padding: '13px 24px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#64748b' }}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Reports list */}
            <div className="bento-card s3">
                <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 18, color: '#181c22' }}>My Reports</h3>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{reports.length} total</span>
                </div>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                        <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                    </div>
                ) : reports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#00450d' }}>check_circle</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', marginBottom: 6 }}>No reports submitted yet</p>
                        <p style={{ fontSize: 13, color: '#94a3b8' }}>Help keep your district clean by reporting waste issues</p>
                    </div>
                ) : (
                    reports.map(report => {
                        const rt = REPORT_TYPES.find(t => t.value === report.report_type)
                        const sc = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending
                        const isExpanded = expanded === report.id
                        const stepIndex = getStepIndex(report.status)
                        return (
                            <div key={report.id}>
                                <div className="report-row" onClick={() => setExpanded(isExpanded ? null : report.id)}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: `${rt?.color || '#00450d'}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 22, color: rt?.color || '#00450d' }}>{rt?.icon || 'report'}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 14, fontWeight: 700, color: '#181c22' }}>{rt?.label || report.report_type}</span>
                                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: sc.bg, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Manrope,sans-serif' }}>{sc.label}</span>
                                            </div>
                                            <p style={{ fontSize: 13, color: '#41493e', margin: '0 0 5px', lineHeight: 1.5 }}>{report.description}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#9ca3af' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>location_on</span>
                                                    {report.location_address}
                                                </span>
                                                <span>{new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                {report.latitude && <span style={{ color: '#00450d', display: 'flex', alignItems: 'center', gap: 3 }}><span className="material-symbols-outlined" style={{ fontSize: 13 }}>my_location</span>GPS tagged</span>}
                                            </div>
                                        </div>
                                        {report.photo_url && (
                                            <img src={report.photo_url} alt="Report" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                                        )}
                                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8', flexShrink: 0, marginTop: 2 }}>{isExpanded ? 'expand_less' : 'expand_more'}</span>
                                    </div>
                                </div>

                                {/* R29 — Status timeline */}
                                {isExpanded && (
                                    <div className="slide-down" style={{ padding: '16px 24px 20px', background: '#fafbfa', borderBottom: '1px solid rgba(0,69,13,0.04)' }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 16 }}>Report Progress</p>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                                            {TIMELINE_STEPS.map((step, i) => {
                                                const done = i <= stepIndex
                                                const current = i === stepIndex
                                                const isLast = i === TIMELINE_STEPS.length - 1
                                                return (
                                                    <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', flex: isLast ? 'none' : 1 }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? (current && report.status !== 'resolved' ? '#1d4ed8' : '#00450d') : '#e5e7eb', border: current ? '2px solid white' : 'none', boxShadow: current ? '0 0 0 3px rgba(29,78,216,0.2)' : 'none', transition: 'all 0.3s' }}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: done ? 'white' : '#94a3b8', fontVariationSettings: done ? "'FILL' 1" : "'FILL' 0" }}>{step.icon}</span>
                                                            </div>
                                                            <p style={{ fontSize: 11, fontWeight: done ? 700 : 500, color: done ? '#181c22' : '#94a3b8', fontFamily: 'Manrope,sans-serif', marginTop: 6, textAlign: 'center', whiteSpace: 'nowrap' }}>{step.label}</p>
                                                        </div>
                                                        {!isLast && (
                                                            <div style={{ flex: 1, height: 2, marginTop: 17, background: i < stepIndex ? '#00450d' : '#e5e7eb', transition: 'background 0.3s' }} />
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <p style={{ fontSize: 12, color: '#717a6d', marginTop: 16 }}>
                                            Submitted on {new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </DashboardLayout>
    )
}