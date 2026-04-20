'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { sendNotification } from '@/lib/notify'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
    { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
    { label: 'History', href: '/dashboard/district-engineer/collection-history', icon: 'history' },
    { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
    { label: 'Heatmap', href: '/dashboard/district-engineer/heatmap', icon: 'thermostat' },
    { label: 'Reports', href: '/dashboard/district-engineer/reports', icon: 'report_problem' },
    { label: 'Incidents', href: '/dashboard/district-engineer/incidents', icon: 'warning' },
    { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
    { label: 'Bin Requests', href: '/dashboard/district-engineer/bin-requests', icon: 'delete_outline' },
    { label: 'Compliance', href: '/dashboard/district-engineer/compliance', icon: 'verified' },
    { label: 'Commercial', href: '/dashboard/district-engineer/commercial', icon: 'storefront' },
    { label: 'Announcements', href: '/dashboard/district-engineer/announcements', icon: 'campaign' },
    { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

const WASTE_TYPES = [
    { value: 'organic', label: 'Organic', icon: 'compost', color: '#00450d', bg: '#f0fdf4' },
    { value: 'recyclable', label: 'Recyclable', icon: 'recycling', color: '#1d4ed8', bg: '#eff6ff' },
    { value: 'plastics', label: 'Plastics', icon: 'local_drink', color: '#7c3aed', bg: '#f5f3ff' },
    { value: 'glass', label: 'Glass', icon: 'liquor', color: '#0e7490', bg: '#ecfeff' },
    { value: 'non-recyclable', label: 'Non-Recyclable', icon: 'delete', color: '#92400e', bg: '#fefce8' },
    { value: 'hazardous', label: 'Hazardous', icon: 'warning', color: '#ba1a1a', bg: '#fef2f2' },
]

const BIN_SIZES = ['120L', '240L', '660L', '1100L']

const COLLECTION_FREQUENCIES = [
    { value: 'daily', label: 'Daily' },
    { value: '3x_week', label: '3× per week' },
    { value: '2x_week', label: '2× per week' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'fortnightly', label: 'Fortnightly' },
]

const ESTABLISHMENT_TYPES = [
    'Hotel', 'Restaurant', 'Café', 'Supermarket', 'Hospital',
    'Office', 'School', 'Factory', 'Warehouse', 'Other',
]

interface CommercialProfile {
    id: string
    full_name: string
    organisation_name: string
    address: string
    ward: string
    district: string
    phone: string | null
    waste_profile: WasteProfile | null
    registered_at: string | null
}

interface WasteProfile {
    establishment_type: string
    waste_categories: string[]
    bin_sizes: Record<string, number>   // waste_type -> count
    bin_size_type: Record<string, string> // waste_type -> size
    collection_frequency: string
    collection_days: string[]
    special_handling: string
    registered_by: string
    registered_at: string
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function DECommercialPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [establishments, setEstablishments] = useState<CommercialProfile[]>([])
    const [selected, setSelected] = useState<CommercialProfile | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState('')
    const [search, setSearch] = useState('')
    const [filterReg, setFilterReg] = useState<'all' | 'registered' | 'unregistered'>('all')

    // Form state
    const [estType, setEstType] = useState('')
    const [wasteCategories, setWasteCategories] = useState<string[]>([])
    const [binCounts, setBinCounts] = useState<Record<string, number>>({})
    const [binSizeTypes, setBinSizeTypes] = useState<Record<string, string>>({})
    const [frequency, setFrequency] = useState('weekly')
    const [collectionDays, setCollectionDays] = useState<string[]>([])
    const [specialHandling, setSpecialHandling] = useState('')

    useEffect(() => { loadData() }, [])

    function showToast(msg: string) {
        setToast(msg)
        setTimeout(() => setToast(''), 3500)
    }

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, organisation_name, address, ward, district, phone, waste_profile, registered_at')
            .eq('role', 'commercial_establishment')
            .eq('district', p?.district)
            .order('organisation_name', { ascending: true })

        setEstablishments(data || [])
        setLoading(false)
    }

    function openRegistration(est: CommercialProfile) {
        setSelected(est)
        const wp = est.waste_profile
        if (wp) {
            setEstType(wp.establishment_type || '')
            setWasteCategories(wp.waste_categories || [])
            setBinCounts(wp.bin_sizes || {})
            setBinSizeTypes(wp.bin_size_type || {})
            setFrequency(wp.collection_frequency || 'weekly')
            setCollectionDays(wp.collection_days || [])
            setSpecialHandling(wp.special_handling || '')
        } else {
            setEstType('')
            setWasteCategories([])
            setBinCounts({})
            setBinSizeTypes({})
            setFrequency('weekly')
            setCollectionDays([])
            setSpecialHandling('')
        }
        setShowForm(true)
    }

    function toggleWasteCategory(val: string) {
        setWasteCategories(prev =>
            prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
        )
        if (!binCounts[val]) setBinCounts(prev => ({ ...prev, [val]: 1 }))
        if (!binSizeTypes[val]) setBinSizeTypes(prev => ({ ...prev, [val]: '240L' }))
    }

    function toggleDay(day: string) {
        setCollectionDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        )
    }

    async function handleSave() {
        if (!selected) return
        if (!estType) { showToast('Please select an establishment type'); return }
        if (wasteCategories.length === 0) { showToast('Please select at least one waste category'); return }
        if (collectionDays.length === 0) { showToast('Please select at least one collection day'); return }

        setSaving(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const wasteProfile: WasteProfile = {
            establishment_type: estType,
            waste_categories: wasteCategories,
            bin_sizes: binCounts,
            bin_size_type: binSizeTypes,
            collection_frequency: frequency,
            collection_days: collectionDays,
            special_handling: specialHandling,
            registered_by: user?.id || '',
            registered_at: new Date().toISOString(),
        }

        const { error } = await supabase
            .from('profiles')
            .update({
                waste_profile: wasteProfile,
                registered_at: new Date().toISOString(),
            })
            .eq('id', selected.id)

        if (error) {
            showToast('Error saving: ' + error.message)
            setSaving(false)
            return
        }

        // R19 — notify the commercial establishment
        await sendNotification({
            user_ids: [selected.id],
            title: 'Waste Profile Registered',
            body: `Your waste collection profile has been set up by ${profile?.district} District Engineer. Collection: ${COLLECTION_FREQUENCIES.find(f => f.value === frequency)?.label} on ${collectionDays.join(', ')}.`,
            type: 'profile_registered',
            url: '/dashboard/commercial/bins',
        })

        showToast('Waste profile saved and establishment notified')
        setShowForm(false)
        setSelected(null)
        await loadData()
        setSaving(false)
    }

    const filtered = establishments.filter(e => {
        if (filterReg === 'registered' && !e.waste_profile) return false
        if (filterReg === 'unregistered' && e.waste_profile) return false
        if (search) {
            const q = search.toLowerCase()
            return (
                (e.organisation_name || '').toLowerCase().includes(q) ||
                (e.full_name || '').toLowerCase().includes(q) ||
                (e.ward || '').toLowerCase().includes(q) ||
                (e.address || '').toLowerCase().includes(q)
            )
        }
        return true
    })

    const registeredCount = establishments.filter(e => e.waste_profile).length
    const unregisteredCount = establishments.filter(e => !e.waste_profile).length

    return (
        <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}>
            <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msf-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:16px; box-shadow:0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.04); border:1px solid rgba(0,69,13,0.06); overflow:hidden; }
        .row { padding:15px 20px; border-bottom:1px solid rgba(0,69,13,0.05); display:flex; align-items:center; gap:13px; transition:background 0.15s; }
        .row:hover { background:#f9fdf9; }
        .row:last-child { border-bottom:none; }
        .badge { display:inline-flex; align-items:center; gap:3px; padding:2px 9px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; text-transform:uppercase; letter-spacing:0.06em; white-space:nowrap; }
        .pill-btn { padding:5px 13px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .pill-btn.on { background:#00450d; color:white; }
        .pill-btn.off { background:#f1f5f9; color:#64748b; }
        .pill-btn.off:hover { background:#e2e8f0; }
        .search-input { width:100%; padding:9px 14px 9px 38px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; color:#181c22; background:#fafafa; outline:none; box-sizing:border-box; transition:all 0.2s; }
        .search-input:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .field-label { display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#6b7280; font-family:'Manrope',sans-serif; margin-bottom:8px; }
        .waste-chip { border:1.5px solid rgba(0,69,13,0.12); border-radius:10px; padding:9px 12px; cursor:pointer; background:white; display:flex; align-items:center; gap:7px; transition:all 0.15s; font-size:12px; font-family:'Manrope',sans-serif; font-weight:600; }
        .waste-chip:hover { border-color:rgba(0,69,13,0.25); }
        .day-pill { padding:6px 12px; border-radius:8px; border:1.5px solid #e5e7eb; background:white; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.15s; }
        .day-pill.on { border-color:#00450d; background:#f0fdf4; color:#00450d; }
        .select-field { width:100%; padding:10px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; color:#181c22; background:#fafafa; outline:none; appearance:none; cursor:pointer; transition:all 0.2s; }
        .select-field:focus { border-color:#00450d; background:white; }
        .form-input { width:100%; padding:10px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; color:#181c22; background:#fafafa; outline:none; box-sizing:border-box; resize:vertical; transition:all 0.2s; }
        .form-input:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .toast-pill { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#181c22; color:white; padding:10px 20px; border-radius:9999px; font-size:13px; font-weight:500; z-index:200; display:flex; align-items:center; gap:8px; box-shadow:0 4px 20px rgba(0,0,0,0.2); white-space:nowrap; animation:slideUp .3s ease; }
        @keyframes slideUp { from{transform:translateY(12px) translateX(-50%);opacity:0} to{transform:translateY(0) translateX(-50%);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .35s ease both} .a2{animation:fadeUp .35s ease .07s both} .a3{animation:fadeUp .35s ease .14s both}
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

            {toast && (
                <div className="toast-pill">
                    <span className="msf-fill" style={{ fontSize: 15, color: '#4ade80' }}>check_circle</span>
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="a1" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 8 }}>District Engineering · Commercial</p>
                <h1 style={{ fontSize: 40, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: 0 }}>
                    Commercial <span style={{ color: '#1b5e20' }}>Establishments</span>
                </h1>
                <p style={{ fontSize: 13, color: '#717a6d', marginTop: 6 }}>{profile?.district} · Register waste profiles and collection requirements</p>
            </div>

            {/* Stats */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Total', value: establishments.length, icon: 'storefront', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Registered', value: registeredCount, icon: 'verified', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Unregistered', value: unregisteredCount, icon: 'error_outline', color: '#ba1a1a', bg: '#fef2f2' },
                ].map(m => (
                    <div key={m.label} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msf-fill" style={{ fontSize: 17, color: m.color }}>{m.icon}</span>
                        </div>
                        <div>
                            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 24, color: '#181c22', margin: 0, lineHeight: 1 }}>{m.value}</p>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{m.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="a3" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <span className="msf" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#94a3b8' }}>search</span>
                    <input className="search-input" placeholder="Search by name, ward, address…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {(['all', 'registered', 'unregistered'] as const).map(f => (
                    <button key={f} className={`pill-btn ${filterReg === f ? 'on' : 'off'}`} onClick={() => setFilterReg(f)}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {/* Establishment list */}
            <div className="a3 card">
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>Establishments in {profile?.district}</h3>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{filtered.length} shown</span>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
                        <div style={{ width: 24, height: 24, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                        <span className="msf" style={{ fontSize: 36, color: '#d1d5db', display: 'block', marginBottom: 12 }}>storefront</span>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', marginBottom: 4 }}>No establishments found</p>
                        <p style={{ fontSize: 13, color: '#94a3b8' }}>Commercial users in your district will appear here once registered in the system.</p>
                    </div>
                ) : filtered.map(est => {
                    const hasProfile = !!est.waste_profile
                    const wp = est.waste_profile
                    return (
                        <div key={est.id} className="row">
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: hasProfile ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="msf" style={{ fontSize: 18, color: hasProfile ? '#00450d' : '#ba1a1a' }}>storefront</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>
                                        {est.organisation_name || est.full_name}
                                    </span>
                                    <span className="badge" style={{ background: hasProfile ? '#f0fdf4' : '#fef2f2', color: hasProfile ? '#00450d' : '#ba1a1a' }}>
                                        {hasProfile ? 'Registered' : 'Unregistered'}
                                    </span>
                                    {wp?.establishment_type && (
                                        <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>{wp.establishment_type}</span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: '#717a6d' }}>
                                    {est.ward && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 12 }}>location_on</span>{est.ward}</span>}
                                    {est.address && <span>{est.address}</span>}
                                    {wp && (
                                        <>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 12 }}>delete</span>{wp.waste_categories?.join(', ')}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 12 }}>schedule</span>{COLLECTION_FREQUENCIES.find(f => f.value === wp.collection_frequency)?.label}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => openRegistration(est)}
                                style={{ padding: '7px 16px', borderRadius: 99, border: `1.5px solid ${hasProfile ? 'rgba(0,69,13,0.2)' : 'rgba(186,26,26,0.2)'}`, background: hasProfile ? '#f0fdf4' : '#fef2f2', color: hasProfile ? '#00450d' : '#ba1a1a', fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span className="msf" style={{ fontSize: 13 }}>{hasProfile ? 'edit' : 'add_circle'}</span>
                                {hasProfile ? 'Edit Profile' : 'Register'}
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* Registration form modal */}
            {showForm && selected && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}
                    onClick={() => setShowForm(false)}>
                    <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 580, boxShadow: '0 24px 60px rgba(0,0,0,0.2)', marginTop: 20, marginBottom: 20 }}
                        onClick={e => e.stopPropagation()}>

                        {/* Modal header */}
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#00450d', borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: 'white', margin: '0 0 2px' }}>
                                    {selected.waste_profile ? 'Edit Waste Profile' : 'Register Establishment'}
                                </h3>
                                <p style={{ fontSize: 12, color: 'rgba(163,246,156,0.8)', margin: 0 }}>{selected.organisation_name || selected.full_name} · {selected.ward}</p>
                            </div>
                            <button onClick={() => setShowForm(false)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="msf" style={{ fontSize: 16, color: 'white' }}>close</span>
                            </button>
                        </div>

                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

                            {/* Establishment type */}
                            <div>
                                <label className="field-label">Establishment Type *</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {ESTABLISHMENT_TYPES.map(t => (
                                        <button key={t} type="button"
                                            onClick={() => setEstType(t)}
                                            style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${estType === t ? '#00450d' : '#e5e7eb'}`, background: estType === t ? '#f0fdf4' : 'white', color: estType === t ? '#00450d' : '#374151', fontSize: 12, fontFamily: 'Manrope,sans-serif', fontWeight: estType === t ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Waste categories */}
                            <div>
                                <label className="field-label">Waste Categories *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                                    {WASTE_TYPES.map(wt => {
                                        const isOn = wasteCategories.includes(wt.value)
                                        return (
                                            <button key={wt.value} type="button" className="waste-chip"
                                                onClick={() => toggleWasteCategory(wt.value)}
                                                style={{ borderColor: isOn ? wt.color : 'rgba(0,69,13,0.12)', background: isOn ? wt.bg : 'white', color: isOn ? wt.color : '#374151', boxShadow: isOn ? `0 0 0 3px ${wt.color}18` : 'none' }}>
                                                <span className="msf" style={{ fontSize: 15, color: isOn ? wt.color : '#94a3b8' }}>{wt.icon}</span>
                                                {wt.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Bin counts per selected category */}
                            {wasteCategories.length > 0 && (
                                <div>
                                    <label className="field-label">Bins Per Category</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {wasteCategories.map(cat => {
                                            const wt = WASTE_TYPES.find(w => w.value === cat)
                                            return (
                                                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: wt?.bg || '#f8fafc', border: `1px solid ${wt?.color || '#e5e7eb'}20` }}>
                                                    <span className="msf" style={{ fontSize: 16, color: wt?.color || '#64748b' }}>{wt?.icon}</span>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: wt?.color || '#374151', fontFamily: 'Manrope,sans-serif', flex: 1, textTransform: 'capitalize' }}>{cat}</span>
                                                    <div style={{ display: 'flex', gap: 5 }}>
                                                        {BIN_SIZES.map(s => (
                                                            <button key={s} type="button"
                                                                onClick={() => setBinSizeTypes(prev => ({ ...prev, [cat]: s }))}
                                                                style={{ padding: '3px 8px', borderRadius: 6, border: `1.5px solid ${binSizeTypes[cat] === s ? wt?.color || '#00450d' : '#e5e7eb'}`, background: binSizeTypes[cat] === s ? wt?.bg || '#f0fdf4' : 'white', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: binSizeTypes[cat] === s ? wt?.color || '#00450d' : '#64748b' }}>
                                                                {s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <button type="button" onClick={() => setBinCounts(p => ({ ...p, [cat]: Math.max(1, (p[cat] || 1) - 1) }))}
                                                            style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', minWidth: 20, textAlign: 'center' }}>{binCounts[cat] || 1}</span>
                                                        <button type="button" onClick={() => setBinCounts(p => ({ ...p, [cat]: Math.min(20, (p[cat] || 1) + 1) }))}
                                                            style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Collection frequency */}
                            <div>
                                <label className="field-label">Collection Frequency *</label>
                                <select className="select-field" value={frequency} onChange={e => setFrequency(e.target.value)}>
                                    {COLLECTION_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                            </div>

                            {/* Collection days */}
                            <div>
                                <label className="field-label">Collection Days *</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {DAYS.map(d => (
                                        <button key={d} type="button" className={`day-pill ${collectionDays.includes(d) ? 'on' : ''}`}
                                            onClick={() => toggleDay(d)}>
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Special handling */}
                            <div>
                                <label className="field-label">Special Handling Notes <span style={{ color: '#d1d5db', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span></label>
                                <textarea className="form-input" rows={2} placeholder="e.g. Hazardous materials, refrigerated waste, access restrictions…"
                                    value={specialHandling} onChange={e => setSpecialHandling(e.target.value)} />
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={handleSave} disabled={saving}
                                    style={{ flex: 2, padding: 13, borderRadius: 12, background: '#00450d', color: 'white', border: 'none', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    {saving
                                        ? <><div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Saving…</>
                                        : <><span className="msf" style={{ fontSize: 17 }}>save</span>Save & Notify Establishment</>}
                                </button>
                                <button onClick={() => setShowForm(false)}
                                    style={{ flex: 1, padding: 13, borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#64748b' }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}