'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { DISTRICT_WARD_MAP } from '@/lib/districts'
const ADMIN_NAV = [
    { label: 'Overview', href: '/dashboard/admin', icon: 'dashboard' },
    { label: 'Users', href: '/dashboard/admin/users', icon: 'manage_accounts' },
    { label: 'Blockchain', href: '/dashboard/admin/blockchain', icon: 'link' },
    { label: 'Performance', href: '/dashboard/admin/performance', icon: 'analytics' },
    { label: 'Billing', href: '/dashboard/admin/billing', icon: 'payments' },
    { label: 'Contracts', href: '/dashboard/admin/contracts', icon: 'description' },
    { label: 'Contractor Billing', href: '/dashboard/admin/billing-contractor', icon: 'receipt_long' },
    { label: 'Incidents', href: '/dashboard/admin/incidents', icon: 'warning' },
    { label: 'Communications', href: '/dashboard/admin/communications', icon: 'chat' },
    { label: 'Zones', href: '/dashboard/admin/zones', icon: 'map' },
]

type ZoneAssignment = {
    id: string
    contractor_id: string
    ward: string
    district: string
    assigned_date: string
    status: string
    notes: string
    created_at: string
    contractor?: { full_name: string; organisation_name: string }
}

function zoneStatusStyle(status: string) {
    switch (status) {
        case 'active': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Active' }
        case 'suspended': return { bg: '#fefce8', color: '#92400e', dot: '#d97706', label: 'Suspended' }
        case 'reassigned': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Reassigned' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: status }
    }
}

const EMPTY_FORM = {
    contractor_id: '',
    ward: '',
    district: '',
    assigned_date: new Date().toISOString().split('T')[0],
    notes: '',
}

export default function AdminZonesPage() {
    const [profile, setProfile] = useState<any>(null)
    const [zones, setZones] = useState<ZoneAssignment[]>([])
    const [contractors, setContractors] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [selectedZone, setSelectedZone] = useState<ZoneAssignment | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [form, setForm] = useState(EMPTY_FORM)
    const [filterDistrict, setFilterDistrict] = useState('all')
    const [filterStatus, setFilterStatus] = useState('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: zonesData } = await supabase
            .from('zone_assignments')
            .select('*, contractor:profiles!zone_assignments_contractor_id_fkey(full_name, organisation_name)')
            .order('district', { ascending: true })
        setZones(zonesData || [])

        const { data: contractorsData } = await supabase
            .from('profiles')
            .select('id, full_name, organisation_name')
            .eq('role', 'contractor')
            .eq('is_approved', true)
        setContractors(contractorsData || [])

        setLoading(false)
    }

    async function createZoneAssignment() {
        if (!form.contractor_id || !form.ward || !form.district) {
            setErrorMsg('Contractor, ward and district are required.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('zone_assignments').insert({
            contractor_id: form.contractor_id,
            ward: form.ward,
            district: form.district,
            assigned_date: form.assigned_date,
            notes: form.notes || null,
            assigned_by: user.id,
            status: 'active',
        })

        if (error) {
            setErrorMsg(error.message.includes('unique') ?
                'This contractor is already assigned to this ward.' :
                'Failed to create assignment: ' + error.message)
        } else {
            setSuccessMsg('Zone assigned successfully.')
            setShowCreateForm(false)
            setForm(EMPTY_FORM)
            loadData()
        }
        setSubmitting(false)
    }

    async function updateZoneStatus(zoneId: string, newStatus: string) {
        const supabase = createClient()
        await supabase.from('zone_assignments')
            .update({ status: newStatus })
            .eq('id', zoneId)
        setSuccessMsg('Zone status updated.')
        setSelectedZone(null)
        loadData()
    }

    async function deleteZone(zoneId: string) {
        if (!confirm('Remove this zone assignment?')) return
        const supabase = createClient()
        await supabase.from('zone_assignments').delete().eq('id', zoneId)
        setSuccessMsg('Zone assignment removed.')
        setSelectedZone(null)
        loadData()
    }

    const districts = [...new Set(zones.map(z => z.district))]

    const filteredZones = zones.filter(z => {
        const districtMatch = filterDistrict === 'all' || z.district === filterDistrict
        const statusMatch = filterStatus === 'all' || z.status === filterStatus
        return districtMatch && statusMatch
    })

    const stats = {
        total: zones.length,
        active: zones.filter(z => z.status === 'active').length,
        suspended: zones.filter(z => z.status === 'suspended').length,
        districts: districts.length,
        contractors: [...new Set(zones.map(z => z.contractor_id))].length,
    }

    // Group by district
    const zonesByDistrict = filteredZones.reduce((acc, zone) => {
        if (!acc[zone.district]) acc[zone.district] = []
        acc[zone.district].push(zone)
        return acc
    }, {} as Record<string, ZoneAssignment[]>)

    return (
        <DashboardLayout
            role="Admin"
            userName={profile?.full_name || ''}
            navItems={ADMIN_NAV}
            primaryAction={{ label: 'Add User', href: '/dashboard/admin/users', icon: 'person_add' }}
        >
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .zone-row { padding:14px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .zone-row:hover { background:#f9fafb; }
        .zone-row:last-child { border-bottom:none; }
        .filter-btn { padding:6px 14px; border-radius:8px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:1.5px solid transparent; transition:all 0.2s; }
        .form-input { width:100%; padding:10px 14px; border-radius:10px; border:1.5px solid rgba(0,69,13,0.15); font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:white; color:#181c22; }
        .form-input:focus { border-color:#00450d; }
        .form-label { font-size:12px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.05em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#00450d; color:white; border:none; padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity 0.2s; }
        .btn-primary:hover { opacity:0.88; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
        .btn-danger { background:#fef2f2; color:#ba1a1a; border:1.5px solid rgba(186,26,26,0.15); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-danger:hover { background:#ffdad6; }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1 { animation:staggerIn 0.5s ease 0.05s both; }
        .s2 { animation:staggerIn 0.5s ease 0.10s both; }
        .s3 { animation:staggerIn 0.5s ease 0.15s both; }
        .s4 { animation:staggerIn 0.5s ease 0.20s both; }
      `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="font-headline font-extrabold tracking-tight"
                            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                            Zone <span style={{ color: '#1b5e20' }}>Assignments</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Assign and manage contractor coverage zones
                        </p>
                    </div>
                    <button className="btn-primary" onClick={() => { setShowCreateForm(true); setErrorMsg('') }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                        Assign Zone
                    </button>
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {successMsg && (
                        <div className="mb-6 p-4 rounded-xl flex items-center gap-3"
                            style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>check_circle</span>
                            <p className="text-sm font-medium" style={{ color: '#00450d' }}>{successMsg}</p>
                            <button onClick={() => setSuccessMsg('')} className="ml-auto"
                                style={{ color: '#00450d', background: 'none', border: 'none', cursor: 'pointer' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                            </button>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 s2">
                        {[
                            { label: 'Total Zones', value: stats.total, color: '#00450d', bg: '#f0fdf4', icon: 'map' },
                            { label: 'Active', value: stats.active, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                            { label: 'Suspended', value: stats.suspended, color: '#92400e', bg: '#fefce8', icon: 'pause_circle' },
                            { label: 'Districts', value: stats.districts, color: '#0369a1', bg: '#f0f9ff', icon: 'corporate_fare' },
                            { label: 'Contractors', value: stats.contractors, color: '#7c3aed', bg: '#f5f3ff', icon: 'engineering' },
                        ].map(s => (
                            <div key={s.label} className="bento-card p-5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                                    style={{ background: s.bg }}>
                                    <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '18px' }}>{s.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-2xl" style={{ color: '#181c22' }}>{s.value}</p>
                                <p className="text-xs font-bold uppercase mt-1"
                                    style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-4 mb-4 flex-wrap s3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase"
                                style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                District:
                            </span>
                            {['all', ...districts].map(f => (
                                <button key={f} className="filter-btn"
                                    onClick={() => setFilterDistrict(f)}
                                    style={{
                                        background: filterDistrict === f ? '#00450d' : '#f8fafc',
                                        color: filterDistrict === f ? 'white' : '#64748b',
                                        borderColor: filterDistrict === f ? '#00450d' : 'rgba(0,69,13,0.1)',
                                    }}>
                                    {f === 'all' ? 'All' : f}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase"
                                style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                Status:
                            </span>
                            {['all', 'active', 'suspended', 'reassigned'].map(f => (
                                <button key={f} className="filter-btn"
                                    onClick={() => setFilterStatus(f)}
                                    style={{
                                        background: filterStatus === f ? '#00450d' : '#f8fafc',
                                        color: filterStatus === f ? 'white' : '#64748b',
                                        borderColor: filterStatus === f ? '#00450d' : 'rgba(0,69,13,0.1)',
                                    }}>
                                    {f === 'all' ? 'All' : f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Zone list grouped by district */}
                    {Object.keys(zonesByDistrict).length === 0 ? (
                        <div className="bento-card p-16 flex flex-col items-center justify-center text-center s4">
                            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
                                style={{ background: '#f0fdf4' }}>
                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '40px' }}>map</span>
                            </div>
                            <h2 className="font-headline font-bold text-xl mb-2" style={{ color: '#181c22' }}>No zones found</h2>
                            <p className="text-sm mb-6" style={{ color: '#717a6d' }}>
                                Assign zones to contractors to get started
                            </p>
                            <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                Assign Zone
                            </button>
                        </div>
                    ) : (
                        Object.entries(zonesByDistrict).map(([district, districtZones]) => (
                            <div key={district} className="bento-card mb-6 s4">
                                <div className="px-6 py-4 flex items-center gap-3"
                                    style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '16px' }}>
                                            corporate_fare
                                        </span>
                                    </div>
                                    <h3 className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>{district}</h3>
                                    <span className="text-sm" style={{ color: '#94a3b8' }}>
                                        {districtZones.length} zone{districtZones.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                {districtZones.map(zone => {
                                    const zs = zoneStatusStyle(zone.status)
                                    const contractorName = zone.contractor?.organisation_name || zone.contractor?.full_name || 'Unknown'
                                    return (
                                        <div key={zone.id} className="zone-row" onClick={() => setSelectedZone(zone)}>
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: zs.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: zs.color, fontSize: '20px' }}>
                                                    location_on
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22' }}>{zone.ward}</p>
                                                    <span className="status-badge" style={{ background: zs.bg, color: zs.color }}>
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: zs.dot }} />
                                                        {zs.label}
                                                    </span>
                                                </div>
                                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                                    {contractorName} · Since {new Date(zone.assigned_date).toLocaleDateString('en-GB')}
                                                </p>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>
                                                chevron_right
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        ))
                    )}

                    {/* Zone Detail Modal */}
                    {selectedZone && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            {selectedZone.ward}
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            {selectedZone.district} · {selectedZone.contractor?.organisation_name || selectedZone.contractor?.full_name}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedZone(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[
                                        { label: 'Status', value: selectedZone.status },
                                        { label: 'Assigned Since', value: new Date(selectedZone.assigned_date).toLocaleDateString('en-GB') },
                                        { label: 'Contractor', value: selectedZone.contractor?.organisation_name || selectedZone.contractor?.full_name || 'Unknown' },
                                        { label: 'District', value: selectedZone.district },
                                    ].map(item => (
                                        <div key={item.label} className="p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                                            <p className="text-xs font-bold uppercase mb-1"
                                                style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                                {item.label}
                                            </p>
                                            <p className="text-sm font-semibold capitalize" style={{ color: '#181c22' }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mb-6">
                                    <p className="text-xs font-bold uppercase mb-3"
                                        style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                        Update Status
                                    </p>
                                    <div className="flex gap-2">
                                        {['active', 'suspended', 'reassigned'].map(s => {
                                            const st = zoneStatusStyle(s)
                                            return (
                                                <button key={s}
                                                    onClick={() => updateZoneStatus(selectedZone.id, s)}
                                                    style={{ background: st.bg, color: st.color, border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', textTransform: 'capitalize' }}>
                                                    {s}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button className="btn-danger flex-1 justify-center"
                                        onClick={() => deleteZone(selectedZone.id)}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                                        Remove
                                    </button>
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => setSelectedZone(null)}>
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Create Zone Modal */}
                    {showCreateForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Assign Zone</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>Assign a ward to a contractor</p>
                                    </div>
                                    <button onClick={() => { setShowCreateForm(false); setErrorMsg('') }}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                {errorMsg && (
                                    <div className="mb-4 p-3 rounded-xl flex items-center gap-2"
                                        style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '16px' }}>error</span>
                                        <p className="text-xs font-medium" style={{ color: '#ba1a1a' }}>{errorMsg}</p>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <label className="form-label">Contractor *</label>
                                        <select className="form-input"
                                            value={form.contractor_id}
                                            onChange={e => setForm(f => ({ ...f, contractor_id: e.target.value }))}>
                                            <option value="">Select contractor...</option>
                                            {contractors.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.organisation_name || c.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Ward *</label>
                                            <select className="form-input"
                                                value={form.ward}
                                                onChange={e => setForm(f => ({ ...f, ward: e.target.value }))}>
                                                <option value="">Select ward...</option>
                                                {(DISTRICT_WARD_MAP[form.district] || []).map(w => (
                                                    <option key={w} value={w}>{w}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">District *</label>
                                            <select className="form-input"
                                                value={form.district}
                                                onChange={e => setForm(f => ({ ...f, district: e.target.value, ward: '' }))}>
                                                <option value="">Select district...</option>
                                                {Object.keys(DISTRICT_WARD_MAP).map(d => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">Assigned Date</label>
                                        <input type="date" className="form-input"
                                            value={form.assigned_date}
                                            onChange={e => setForm(f => ({ ...f, assigned_date: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="form-label">Notes</label>
                                        <textarea className="form-input" rows={3}
                                            placeholder="Any notes about this zone assignment..."
                                            value={form.notes}
                                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                            style={{ resize: 'vertical' }} />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setShowCreateForm(false); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={createZoneAssignment} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                                                Assign Zone
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}