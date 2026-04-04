'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const REPORT_TYPES = [
    { value: 'illegal_dumping', label: 'Illegal Dumping', icon: 'delete_forever', color: '#ef4444', description: 'Someone dumping waste illegally' },
    { value: 'missed_collection', label: 'Missed Collection', icon: 'delete', color: '#f97316', description: 'Scheduled collection did not happen' },
    { value: 'blocked_drainage', label: 'Blocked Drainage', icon: 'water_damage', color: '#3b82f6', description: 'Waste blocking drainage or waterways' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: '#b45309', bg: 'rgba(180,83,9,0.08)' },
    assigned: { label: 'Assigned', color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)' },
    resolved: { label: 'Resolved', color: '#15803d', bg: 'rgba(21,128,61,0.08)' },
}

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
    const [profile, setProfile] = useState<any>(null)
    const [toast, setToast] = useState('')
    const [toastType, setToastType] = useState<'success' | 'error'>('success')
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [latitude, setLatitude] = useState<number | null>(null)
    const [longitude, setLongitude] = useState<number | null>(null)
    const [locationLoading, setLocationLoading] = useState(false)
    const [locationError, setLocationError] = useState('')
    const [formData, setFormData] = useState({
        report_type: '',
        description: '',
        location_address: '',
    })

    useEffect(() => { loadData() }, [])

    function showToast(msg: string, type: 'success' | 'error' = 'success') {
        setToast(msg); setToastType(type)
        setTimeout(() => setToast(''), 3500)
    }

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(profileData)
        const { data: reportsData } = await supabase
            .from('waste_reports').select('*').eq('submitted_by', user.id)
            .order('created_at', { ascending: false })
        setReports(reportsData || [])
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

    return (
        <div style={{ minHeight: '100vh', background: '#f4f6f3', fontFamily: "'Inter', sans-serif" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Manrope:wght@400;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .nav-link { transition: color 0.2s, background 0.2s; text-decoration: none; }
        .nav-link:hover { background: rgba(0,69,13,0.07); color: #00450d; }
        .report-type-card {
          border: 1.5px solid #e4ede4; border-radius: 12px; padding: 16px;
          cursor: pointer; transition: all 0.2s ease; background: #f9fbf9; text-align: left;
        }
        .report-type-card:hover { border-color: rgba(0,69,13,0.3); background: white; transform: translateY(-1px); }
        .report-type-card.selected { border-color: #00450d; background: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.07); }
        .form-input {
          width: 100%; border: 1.5px solid #e4ede4; border-radius: 10px;
          padding: 12px 16px; font-size: 14px; color: #181c22;
          font-family: 'Inter', sans-serif; transition: all 0.2s; outline: none;
          background: #f9fbf9; box-sizing: border-box;
        }
        .form-input:focus { border-color: #00450d; background: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.07); }
        .form-input::placeholder { color: #c0ccc0; }
        textarea.form-input { resize: vertical; min-height: 90px; }
        .submit-btn {
          background: linear-gradient(135deg, #00450d, #1b5e20); color: white; border: none;
          border-radius: 10px; padding: 13px 28px; font-family: 'Manrope', sans-serif;
          font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 8px;
          box-shadow: 0 4px 14px rgba(0,69,13,0.2);
        }
        .submit-btn:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(0,69,13,0.3); transform: translateY(-1px); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .add-btn {
          background: #00450d; color: white; border: none; border-radius: 10px;
          padding: 10px 18px; font-family: 'Manrope', sans-serif; font-weight: 700;
          font-size: 13px; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 6px;
        }
        .add-btn:hover { background: #1b5e20; }
        .cancel-btn {
          background: rgba(0,0,0,0.05); color: #717a6d; border: none; border-radius: 10px;
          padding: 13px 20px; font-family: 'Manrope', sans-serif; font-weight: 600;
          font-size: 14px; cursor: pointer; transition: background 0.2s;
        }
        .cancel-btn:hover { background: rgba(0,0,0,0.09); }
        .report-card { transition: transform 0.15s, box-shadow 0.15s; }
        .report-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .toast { animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { transform: translateY(12px) translateX(-50%); opacity: 0; } to { transform: translateY(0) translateX(-50%); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .form-enter { animation: fadeIn 0.25s ease; }
      `}</style>

            {/* Toast */}
            {toast && (
                <div className="toast" style={{
                    position: 'fixed', bottom: '24px', left: '50%',
                    background: toastType === 'error' ? '#dc2626' : '#181c22',
                    color: 'white', padding: '10px 20px', borderRadius: '9999px',
                    fontSize: '13px', fontWeight: 500, zIndex: 1000,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: toastType === 'error' ? '#fca5a5' : '#4ade80' }}>
                        {toastType === 'error' ? 'error' : 'check_circle'}
                    </span>
                    {toast}
                </div>
            )}

            {/* Nav */}
            <nav style={{
                background: 'white', borderBottom: '1px solid rgba(0,0,0,0.06)',
                padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40,
                boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <Link href="/dashboard/resident" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#00450d' }}>eco</span>
                        <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '16px', color: '#00450d', letterSpacing: '-0.02em' }}>EcoLedger</span>
                    </Link>
                    <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.1)' }} />
                    <Link href="/dashboard/resident" className="nav-link" style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
                        borderRadius: '8px', color: '#717a6d', fontSize: '13px', fontWeight: 500,
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                        Dashboard
                    </Link>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: 0 }}>{profile?.full_name}</p>
                        <p style={{ fontSize: '11px', color: '#717a6d', margin: 0 }}>Resident</p>
                    </div>
                    <div style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00450d, #1b5e20)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: '13px', fontWeight: 700,
                    }}>{profile?.full_name?.charAt(0) || 'R'}</div>
                </div>
            </nav>

            <main style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <p style={{ fontSize: '11px', color: '#717a6d', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                            Resident Portal
                        </p>
                        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '26px', fontWeight: 800, color: '#181c22', margin: 0, letterSpacing: '-0.02em' }}>
                            Report Waste Issue
                        </h1>
                        <p style={{ fontSize: '13px', color: '#717a6d', margin: '4px 0 0' }}>
                            Report illegal dumping, missed collections or blocked drainage
                        </p>
                    </div>
                    <button className={showForm ? 'cancel-btn' : 'add-btn'} onClick={() => setShowForm(!showForm)}>
                        {showForm ? 'Cancel' : (
                            <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>New Report</>
                        )}
                    </button>
                </div>

                {/* Form */}
                {showForm && (
                    <div className="form-enter" style={{
                        background: 'white', borderRadius: '16px', padding: '28px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)',
                        marginBottom: '24px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,69,13,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00450d' }}>report_problem</span>
                            </div>
                            <div>
                                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>Submit Waste Report</h2>
                                <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>Fill in the details below</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>

                            {/* Report type selector */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '10px', fontFamily: 'Manrope, sans-serif' }}>
                                    Report Type
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                    {REPORT_TYPES.map(type => (
                                        <div key={type.value}
                                            className={`report-type-card ${formData.report_type === type.value ? 'selected' : ''}`}
                                            onClick={() => setFormData({ ...formData, report_type: type.value })}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px', marginBottom: '10px',
                                                background: formData.report_type === type.value ? `${type.color}15` : '#f0f4f0',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'background 0.2s',
                                            }}>
                                                <span className="material-symbols-outlined" style={{
                                                    fontSize: '20px',
                                                    color: formData.report_type === type.value ? type.color : '#94a894',
                                                }}>{type.icon}</span>
                                            </div>
                                            <p style={{ fontSize: '13px', fontWeight: 700, color: formData.report_type === type.value ? '#00450d' : '#181c22', fontFamily: 'Manrope, sans-serif', margin: '0 0 3px' }}>
                                                {type.label}
                                            </p>
                                            <p style={{ fontSize: '11px', color: '#717a6d', margin: 0, lineHeight: 1.4 }}>{type.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Location */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '7px', fontFamily: 'Manrope, sans-serif' }}>
                                    Location / Address
                                </label>
                                <input className="form-input" placeholder="Where is the issue? (street, landmark)"
                                    value={formData.location_address}
                                    onChange={e => setFormData({ ...formData, location_address: e.target.value })}
                                    required />
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '7px', fontFamily: 'Manrope, sans-serif' }}>
                                    Description
                                </label>
                                <textarea className="form-input" placeholder="Describe the issue in detail..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    required />
                            </div>

                            {/* Photo upload */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '7px', fontFamily: 'Manrope, sans-serif' }}>
                                    Photo Evidence <span style={{ color: '#b0b8aa', fontWeight: 500 }}>· optional</span>
                                </label>
                                {photoPreview ? (
                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                        <img src={photoPreview} alt="Preview" style={{ maxHeight: '160px', borderRadius: '10px', objectFit: 'cover', display: 'block' }} />
                                        <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                                            style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                                        </button>
                                    </div>
                                ) : (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', border: '1.5px dashed #c4cdc4', borderRadius: '10px', cursor: 'pointer', background: '#f9fbf9', transition: 'border-color 0.2s' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#717a6d' }}>upload</span>
                                        <span style={{ fontSize: '13px', color: '#717a6d' }}>Click to upload a photo</span>
                                        <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                                    </label>
                                )}
                            </div>

                            {/* GPS location */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '7px', fontFamily: 'Manrope, sans-serif' }}>
                                    GPS Location <span style={{ color: '#b0b8aa', fontWeight: 500 }}>· optional</span>
                                </label>
                                <button type="button" onClick={getLocation} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    background: latitude ? 'rgba(0,69,13,0.07)' : '#f0f4f0',
                                    border: `1.5px solid ${latitude ? 'rgba(0,69,13,0.2)' : '#e4ede4'}`,
                                    color: latitude ? '#00450d' : '#717a6d',
                                    padding: '10px 16px', borderRadius: '10px', cursor: 'pointer',
                                    fontSize: '13px', fontWeight: 600, fontFamily: 'Manrope, sans-serif', transition: 'all 0.2s',
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                                        {locationLoading ? 'sync' : latitude ? 'location_on' : 'my_location'}
                                    </span>
                                    {locationLoading ? 'Getting location...' : latitude ? `${latitude.toFixed(4)}, ${longitude?.toFixed(4)}` : 'Use My Location'}
                                </button>
                                {locationError && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>{locationError}</p>}
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="submit" disabled={saving} className="submit-btn">
                                    {saving ? (
                                        <>
                                            <svg style={{ width: '16px', height: '16px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24">
                                                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Submitting...
                                        </>
                                    ) : (
                                        <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>Submit Report</>
                                    )}
                                </button>
                                <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Reports list */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#717a6d', fontSize: '13px' }}>
                        <div style={{ width: '28px', height: '28px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
                        Loading reports...
                    </div>
                ) : reports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '44px', color: '#c4c9c0', display: 'block', marginBottom: '12px' }}>report_problem</span>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#41493e', margin: '0 0 4px' }}>No reports submitted yet</p>
                        <p style={{ fontSize: '13px', color: '#717a6d', margin: '0 0 20px' }}>Help keep your district clean by reporting waste issues</p>
                        <button className="add-btn" onClick={() => setShowForm(true)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                            New Report
                        </button>
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>My Reports</h2>
                            <span style={{ fontSize: '12px', color: '#717a6d' }}>{reports.length} reports</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {reports.map(report => {
                                const rt = REPORT_TYPES.find(t => t.value === report.report_type)
                                const sc = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending
                                return (
                                    <div key={report.id} className="report-card" style={{
                                        background: 'white', borderRadius: '14px', padding: '18px 20px',
                                        border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                        display: 'flex', alignItems: 'flex-start', gap: '14px',
                                    }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0, background: `${rt?.color || '#00450d'}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '22px', color: rt?.color || '#00450d' }}>{rt?.icon || 'report'}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#181c22' }}>{rt?.label || report.report_type}</span>
                                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: sc.bg, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                    {sc.label}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '13px', color: '#41493e', margin: '0 0 5px', lineHeight: 1.5 }}>{report.description}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '12px', color: '#717a6d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                                    {report.location_address}
                                                </span>
                                                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                                    {new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                {report.latitude && (
                                                    <span style={{ fontSize: '12px', color: '#00450d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>my_location</span>
                                                        GPS tagged
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {report.photo_url && (
                                            <img src={report.photo_url} alt="Report" style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(0,0,0,0.06)' }} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}