'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { logComplaintOnChain } from '@/lib/blockchain'

const RESIDENT_NAV = [
    { label: 'Overview', href: '/dashboard/resident', icon: 'dashboard', section: 'Menu' },
    { label: 'Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today', section: 'Menu' },
    { label: 'Track Vehicle', href: '/dashboard/resident/tracking', icon: 'location_on', section: 'Menu' },
    { label: 'Report Issue', href: '/dashboard/resident/report', icon: 'report_problem', section: 'Menu' },
    { label: 'Rate Service', href: '/dashboard/resident/feedback', icon: 'star', section: 'Menu' },
    { label: 'My Profile', href: '/dashboard/resident/profile', icon: 'person', section: 'Menu' },
]

// Categories — service issues write to complaints, environmental to waste_reports
const CATEGORIES = [
    {
        group: 'Service Issues',
        icon: 'local_shipping',
        items: [
            { value: 'missed_collection', label: 'Missed Collection', icon: 'delete', color: '#dc2626', bg: '#fef2f2', table: 'complaints' },
            { value: 'delayed_collection', label: 'Delayed Collection', icon: 'schedule', color: '#d97706', bg: '#fffbeb', table: 'complaints' },
            { value: 'collection_refusal', label: 'Collection Refusal', icon: 'block', color: '#b45309', bg: '#fffbeb', table: 'complaints' },
            { value: 'bin_damage', label: 'Bin Damage', icon: 'broken_image', color: '#7c3aed', bg: '#faf5ff', table: 'complaints' },
            { value: 'noise_complaint', label: 'Noise Complaint', icon: 'volume_up', color: '#0891b2', bg: '#ecfeff', table: 'complaints' },
            { value: 'driver_behaviour', label: 'Driver Behaviour', icon: 'person_off', color: '#be185d', bg: '#fdf2f8', table: 'complaints' },
        ],
    },
    {
        group: 'Environmental Issues',
        icon: 'eco',
        items: [
            { value: 'illegal_dumping', label: 'Illegal Dumping', icon: 'delete_forever', color: '#ba1a1a', bg: '#fef2f2', table: 'waste_reports' },
            { value: 'blocked_drainage', label: 'Blocked Drainage', icon: 'water_damage', color: '#1d4ed8', bg: '#eff6ff', table: 'waste_reports' },
            { value: 'overflowing_bin', label: 'Overflowing Bin', icon: 'delete_sweep', color: '#d97706', bg: '#fefce8', table: 'waste_reports' },
        ],
    },
    {
        group: 'Other',
        icon: 'more_horiz',
        items: [
            { value: 'other', label: 'Other Issue', icon: 'more_horiz', color: '#64748b', bg: '#f8fafc', table: 'complaints' },
        ],
    },
]

const ALL_ITEMS = CATEGORIES.flatMap(g => g.items)

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    submitted: { label: 'Submitted', color: '#92400e', bg: '#fefce8', border: '#fde68a' },
    pending: { label: 'Pending', color: '#92400e', bg: '#fefce8', border: '#fde68a' },
    in_progress: { label: 'In Progress', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    assigned: { label: 'Assigned', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    resolved: { label: 'Resolved', color: '#00450d', bg: '#f0fdf4', border: '#bbf7d0' },
}

interface HistoryItem {
    id: string
    type: 'complaint' | 'waste_report'
    category: string
    custom_category?: string
    description: string
    status: string
    created_at: string
    location_address?: string
    photo_url?: string
    blockchain_tx?: string
}

function getCategoryInfo(value: string) {
    return ALL_ITEMS.find(i => i.value === value) || { label: value, icon: 'report', color: '#64748b', bg: '#f8fafc', table: 'complaints' }
}

function isEnvironmental(category: string) {
    return ALL_ITEMS.find(i => i.value === category)?.table === 'waste_reports'
}

export default function ResidentReportPage() {
    const [profile, setProfile] = useState<any>(null)
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    // Form state
    const [selectedCategory, setSelectedCategory] = useState('')
    const [customCategory, setCustomCategory] = useState('')
    const [description, setDescription] = useState('')
    const [locationAddress, setLocationAddress] = useState('')
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [latitude, setLatitude] = useState<number | null>(null)
    const [longitude, setLongitude] = useState<number | null>(null)
    const [locationLoading, setLocationLoading] = useState(false)
    const [locationError, setLocationError] = useState('')

    const environmental = isEnvironmental(selectedCategory)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Load both complaints and waste_reports
        const [complaintsRes, reportsRes] = await Promise.all([
            supabase.from('complaints').select('*').eq('submitted_by', user.id).order('created_at', { ascending: false }),
            supabase.from('waste_reports').select('*').eq('submitted_by', user.id).order('created_at', { ascending: false }),
        ])

        const complaints: HistoryItem[] = (complaintsRes.data || []).map((c: any) => ({
            id: c.id, type: 'complaint',
            category: c.complaint_type || 'other',
            custom_category: c.custom_complaint_type,
            description: c.description,
            status: c.status,
            created_at: c.created_at,
            blockchain_tx: c.blockchain_tx,
        }))

        const reports: HistoryItem[] = (reportsRes.data || []).map((r: any) => ({
            id: r.id, type: 'waste_report',
            category: r.report_type || 'other',
            description: r.description,
            status: r.status,
            created_at: r.created_at,
            location_address: r.location_address,
            photo_url: r.photo_url,
        }))

        // Merge and sort by date
        const merged = [...complaints, ...reports].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        setHistory(merged)
        setLoading(false)
    }

    function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setPhotoFile(file)
        const reader = new FileReader()
        reader.onloadend = () => setPhotoPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    function getLocation() {
        setLocationLoading(true); setLocationError('')
        if (!navigator.geolocation) { setLocationError('Geolocation not supported'); setLocationLoading(false); return }
        navigator.geolocation.getCurrentPosition(
            pos => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); setLocationLoading(false) },
            () => { setLocationError('Unable to get location. Please allow access.'); setLocationLoading(false) }
        )
    }

    function resetForm() {
        setSelectedCategory(''); setCustomCategory(''); setDescription('')
        setLocationAddress(''); setPhotoFile(null); setPhotoPreview(null)
        setLatitude(null); setLongitude(null); setLocationError('')
        setErrorMsg('')
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setErrorMsg('')
        if (!selectedCategory) { setErrorMsg('Please select a category'); return }
        if (selectedCategory === 'other' && !customCategory.trim()) { setErrorMsg('Please describe the issue type'); return }
        if (!description.trim()) { setErrorMsg('Please describe the issue'); return }
        if (environmental && !locationAddress.trim()) { setErrorMsg('Please provide a location for this type of report'); return }

        setSaving(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const table = ALL_ITEMS.find(i => i.value === selectedCategory)?.table || 'complaints'

            if (table === 'waste_reports') {
                // Upload photo if provided
                let photoUrl = null
                if (photoFile) {
                    const ext = photoFile.name.split('.').pop()
                    const fileName = `${user.id}-${Date.now()}.${ext}`
                    const { data: uploadData, error: uploadError } = await supabase.storage.from('waste-reports').upload(fileName, photoFile)
                    if (!uploadError && uploadData) {
                        const { data: urlData } = supabase.storage.from('waste-reports').getPublicUrl(fileName)
                        photoUrl = urlData.publicUrl
                    }
                }
                await supabase.from('waste_reports').insert({
                    submitted_by: user.id,
                    report_type: selectedCategory,
                    description,
                    location_address: locationAddress,
                    district: profile?.district,
                    photo_url: photoUrl,
                    status: 'pending',
                    latitude, longitude,
                })
            } else {
                // Write to complaints table
                const { data: cd, error } = await supabase.from('complaints').insert({
                    submitted_by: user.id,
                    role: 'resident',
                    district: profile?.district,
                    complaint_type: selectedCategory,
                    custom_complaint_type: selectedCategory === 'other' ? customCategory.trim() : null,
                    description,
                    status: 'submitted',
                }).select().single()
                if (error) { setErrorMsg(error.message); return }
                if (cd) {
                    const tx = await logComplaintOnChain(cd.id, profile?.district || '')
                    if (tx) await supabase.from('complaints').update({ blockchain_tx: tx }).eq('id', cd.id)
                }
            }

            setSuccess(true)
            resetForm()
            await loadData()
            setTimeout(() => setSuccess(false), 5000)
        } finally {
            setSaving(false)
        }
    }

    const resolvedCount = history.filter(h => h.status === 'resolved').length
    const inProgressCount = history.filter(h => ['in_progress', 'assigned'].includes(h.status)).length

    return (
        <DashboardLayout role="Resident" userName={profile?.full_name || ''} navItems={RESIDENT_NAV}
            primaryAction={{ label: 'View Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' }}>
            <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msf-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
        .cat-btn { border:1.5px solid rgba(0,69,13,0.1); border-radius:12px; padding:10px 12px; cursor:pointer; background:white; display:flex; align-items:center; gap:8px; transition:all 0.15s; text-align:left; width:100%; }
        .cat-btn:hover { border-color:rgba(0,69,13,0.25); background:#f9fbf7; }
        .cat-btn.on { border-width:2px; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .field { width:100%; padding:10px 12px; border:1.5px solid rgba(0,69,13,0.12); border-radius:10px; font-size:13px; color:#181c22; font-family:inherit; background:#fafafa; outline:none; transition:border-color 0.15s; box-sizing:border-box; }
        .field:focus { border-color:#00450d; background:white; }
        .field::placeholder { color:#9ca3af; }
        .field-label { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#717a6d; font-family:'Manrope',sans-serif; display:block; margin-bottom:7px; }
        .submit-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:13px; border-radius:12px; background:#00450d; color:white; border:none; cursor:pointer; font-family:'Manrope',sans-serif; font-weight:700; font-size:14px; transition:all 0.2s; }
        .submit-btn:hover { background:#1b5e20; box-shadow:0 4px 16px rgba(0,69,13,0.25); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .h-row { padding:14px 20px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:flex-start; gap:12px; transition:background 0.1s; }
        .h-row:hover { background:#fafaf9; }
        .h-row:last-child { border-bottom:none; }
        .badge { display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:99px; font-size:9px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; border:1px solid transparent; }
        .group-label { font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#94a3b8; font-family:'Manrope',sans-serif; margin:0 0 8px; display:flex; align-items:center; gap:6px; }
        .loc-btn { display:flex; align-items:center; gap:8px; padding:9px 14px; border-radius:10px; border:1.5px solid #e5e7eb; background:#fafafa; color:#717a6d; font-size:13px; font-weight:600; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.2s; }
        .loc-btn.gps-on { border-color:rgba(0,69,13,0.2); background:rgba(0,69,13,0.04); color:#00450d; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both} .a3{animation:fadeUp .4s ease .14s both}
        .slide-in { animation:slideIn .2s ease both; }
      `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 8px' }}>
                    Resident Portal
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: '46px', fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: 0 }}>
                        Report <span style={{ color: '#00450d' }}>Issue</span>
                    </h1>
                    {profile?.district && (
                        <span style={{ fontSize: 12, color: '#717a6d', padding: '6px 14px', borderRadius: 99, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            {profile.district}
                        </span>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'Total Reports', value: history.length, icon: 'report_problem', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'In Progress', value: inProgressCount, icon: 'pending', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Resolved', value: resolvedCount, icon: 'check_circle', color: '#15803d', bg: '#f0fdf4' },
                ].map(s => (
                    <div key={s.label} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msf" style={{ fontSize: 18, color: s.color }}>{s.icon}</span>
                        </div>
                        <div>
                            <p style={{ fontSize: 22, fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1, margin: 0 }}>{s.value}</p>
                            <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2, margin: 0 }}>{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main layout: form left, history right */}
            <div className="a3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

                {/* ── Form ── */}
                <div className="card" style={{ position: 'sticky', top: 20 }}>
                    {/* Form header */}
                    <div style={{ padding: '20px 24px', background: '#00450d', borderRadius: '20px 20px 0 0' }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white', fontFamily: 'Manrope,sans-serif', margin: '0 0 3px' }}>Report an Issue</h2>
                        <p style={{ fontSize: 11, color: 'rgba(163,246,156,0.7)', margin: 0 }}>Service complaints logged on Polygon Amoy blockchain</p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* Success / error */}
                        {success && (
                            <div className="slide-in" style={{ borderRadius: 10, padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="msf-fill" style={{ color: '#00450d', fontSize: 18 }}>check_circle</span>
                                <p style={{ fontSize: 12, fontWeight: 600, color: '#00450d', fontFamily: 'Manrope,sans-serif', margin: 0 }}>Issue reported successfully. CMC has been notified.</p>
                            </div>
                        )}
                        {errorMsg && (
                            <div className="slide-in" style={{ borderRadius: 10, padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="msf-fill" style={{ color: '#ba1a1a', fontSize: 18 }}>error</span>
                                <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errorMsg}</p>
                            </div>
                        )}

                        {/* Category selector */}
                        <div>
                            <span className="field-label">Category *</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {CATEGORIES.map(group => (
                                    <div key={group.group}>
                                        <p className="group-label">
                                            <span className="msf" style={{ fontSize: 13 }}>{group.icon}</span>
                                            {group.group}
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                            {group.items.map(item => {
                                                const isOn = selectedCategory === item.value
                                                return (
                                                    <button key={item.value} type="button"
                                                        className={`cat-btn ${isOn ? 'on' : ''}`}
                                                        style={isOn ? { borderColor: item.color, background: item.bg } : {}}
                                                        onClick={() => { setSelectedCategory(isOn ? '' : item.value); setCustomCategory(''); setLocationAddress(''); setLocationError('') }}>
                                                        <span className="msf" style={{ fontSize: 15, color: isOn ? item.color : '#94a3b8', flexShrink: 0 }}>{item.icon}</span>
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: isOn ? item.color : '#374151', fontFamily: 'Manrope,sans-serif', lineHeight: 1.3 }}>{item.label}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Custom description — only for Other */}
                        {selectedCategory === 'other' && (
                            <div className="slide-in">
                                <span className="field-label">Describe issue type *</span>
                                <input className="field" placeholder="e.g. Waste left on pavement…"
                                    value={customCategory} onChange={e => setCustomCategory(e.target.value)} />
                            </div>
                        )}

                        {/* Environmental fields — location, photo, GPS */}
                        {environmental && selectedCategory && (
                            <div className="slide-in" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid rgba(186,26,26,0.12)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="msf" style={{ fontSize: 15, color: '#ba1a1a' }}>place</span>
                                    <p style={{ fontSize: 12, fontWeight: 700, color: '#ba1a1a', fontFamily: 'Manrope,sans-serif', margin: 0 }}>Location details required for environmental reports</p>
                                </div>

                                {/* Location address */}
                                <div>
                                    <span className="field-label" style={{ color: '#7f1d1d' }}>Location / Address *</span>
                                    <input className="field" placeholder="Street name, landmark or area…"
                                        value={locationAddress} onChange={e => setLocationAddress(e.target.value)} required={environmental} />
                                </div>

                                {/* Photo upload */}
                                <div>
                                    <span className="field-label" style={{ color: '#7f1d1d' }}>Photo Evidence <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span></span>
                                    {photoPreview ? (
                                        <div style={{ position: 'relative', display: 'inline-block' }}>
                                            <img src={photoPreview} alt="Preview" style={{ maxHeight: 120, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                                            <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                                                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span className="msf" style={{ fontSize: 13 }}>close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: '1.5px dashed rgba(186,26,26,0.3)', borderRadius: 10, cursor: 'pointer', background: 'rgba(186,26,26,0.03)' }}>
                                            <span className="msf" style={{ fontSize: 18, color: '#ba1a1a' }}>upload</span>
                                            <span style={{ fontSize: 12, color: '#7f1d1d' }}>Click to upload a photo</span>
                                            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                                        </label>
                                    )}
                                </div>

                                {/* GPS */}
                                <div>
                                    <button type="button" onClick={getLocation}
                                        className={`loc-btn ${latitude ? 'gps-on' : ''}`}>
                                        <span className="msf" style={{ fontSize: 16 }}>{locationLoading ? 'sync' : latitude ? 'location_on' : 'my_location'}</span>
                                        {locationLoading ? 'Getting location…' : latitude ? `${latitude.toFixed(4)}, ${longitude?.toFixed(4)}` : 'Use GPS Location'}
                                    </button>
                                    {locationError && <p style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{locationError}</p>}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div>
                            <span className="field-label">Description *</span>
                            <textarea className="field" rows={4} style={{ resize: 'vertical' }}
                                placeholder={environmental
                                    ? 'Describe what you observed — when did you notice it, how much waste, any relevant details…'
                                    : 'Describe the issue — what happened, when, and any other relevant details…'}
                                value={description} onChange={e => setDescription(e.target.value)} required />
                        </div>

                        {/* Info note */}
                        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 10, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                            <span className="msf" style={{ color: '#00450d', fontSize: 15, flexShrink: 0 }}>info</span>
                            <p style={{ fontSize: 11, color: '#41493e', lineHeight: 1.5, margin: 0 }}>
                                {environmental
                                    ? 'Environmental reports are sent directly to your District Engineer for field action.'
                                    : 'Service complaints are logged on the Polygon Amoy blockchain for full transparency.'}
                            </p>
                        </div>

                        <button type="submit" disabled={saving} className="submit-btn">
                            {saving
                                ? <><div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />Submitting…</>
                                : <><span className="msf" style={{ fontSize: 17 }}>send</span>Submit Report</>}
                        </button>
                    </form>
                </div>

                {/* ── History ── */}
                <div className="card">
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0 }}>My Reports</h2>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{history.length} total</span>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #00450d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                    ) : history.length === 0 ? (
                        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                <span className="msf" style={{ color: '#00450d', fontSize: 28 }}>check_circle</span>
                            </div>
                            <p style={{ fontSize: 15, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: 6 }}>No issues reported yet</p>
                            <p style={{ fontSize: 13, color: '#94a3b8' }}>Use the form to report any waste-related issue.</p>
                        </div>
                    ) : (
                        <div>
                            {history.map(item => {
                                const cat = getCategoryInfo(item.category)
                                const sc = STATUS_CFG[item.status] || STATUS_CFG.submitted
                                const label = item.custom_category || cat.label
                                const isEnv = item.type === 'waste_report'
                                return (
                                    <div key={`${item.type}-${item.id}`} className="h-row">
                                        <div style={{ width: 38, height: 38, borderRadius: 10, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="msf" style={{ fontSize: 18, color: cat.color }}>{cat.icon}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                                <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', margin: 0 }}>{label}</p>
                                                <span className="badge" style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>{sc.label}</span>
                                                <span className="badge" style={{ background: isEnv ? '#fef2f2' : '#eff6ff', color: isEnv ? '#ba1a1a' : '#1d4ed8', borderColor: isEnv ? '#fecaca' : '#bfdbfe' }}>
                                                    {isEnv ? 'Environmental' : 'Service'}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 5 }}>
                                                {item.description.length > 100 ? item.description.slice(0, 100) + '…' : item.description}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                                    {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                {item.location_address && (
                                                    <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                        <span className="msf" style={{ fontSize: 12 }}>location_on</span>
                                                        {item.location_address}
                                                    </span>
                                                )}
                                                {item.blockchain_tx && (
                                                    <a href={`https://amoy.polygonscan.com/tx/${item.blockchain_tx}`} target="_blank" rel="noopener noreferrer"
                                                        style={{ fontSize: 11, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none', fontFamily: 'Manrope,sans-serif', fontWeight: 600 }}>
                                                        <span className="msf" style={{ fontSize: 12 }}>link</span>Chain ↗
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        {item.photo_url && (
                                            <img src={item.photo_url} alt="Report" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(0,0,0,0.06)' }} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {history.length > 0 && (
                        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="msf" style={{ color: '#7c3aed', fontSize: 14 }}>verified</span>
                            <p style={{ fontSize: 11, color: '#717a6d', margin: 0 }}>Service complaints verified on Polygon Amoy · CMC EcoLedger 2026</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}