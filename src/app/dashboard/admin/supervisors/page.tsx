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
    { label: 'Supervisors', href: '/dashboard/admin/supervisors', icon: 'supervisor_account' },
]

type Supervisor = {
    id: string
    full_name: string
    district: string
    assigned_wards: string[]
    supervisor_phone: string
    is_approved: boolean
    created_at: string
}

type WardSupervisor = {
    id: string
    ward: string
    district: string
    supervisor_id: string
    supervisor_phone: string
    is_primary: boolean
    supervisor?: { full_name: string; supervisor_phone: string }
}

export default function AdminSupervisorsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [supervisors, setSupervisors] = useState<Supervisor[]>([])
    const [wardAssignments, setWardAssignments] = useState<WardSupervisor[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'supervisors' | 'wards'>('supervisors')
    const [selectedSupervisor, setSelectedSupervisor] = useState<Supervisor | null>(null)
    const [showAssignForm, setShowAssignForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [filterDistrict, setFilterDistrict] = useState('all')
    const [assignForm, setAssignForm] = useState({
        supervisor_id: '',
        district: '',
        ward: '',
        supervisor_phone: '',
        is_primary: true,
    })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Load supervisors
        const { data: supervisorsData } = await supabase
            .from('profiles')
            .select('id, full_name, district, assigned_wards, supervisor_phone, is_approved, created_at')
            .eq('role', 'supervisor')
            .order('district', { ascending: true })
        setSupervisors(supervisorsData || [])

        // Load ward assignments without foreign key join
        const { data: wardData } = await supabase
            .from('ward_supervisors')
            .select('*')
            .order('district', { ascending: true })

        if (wardData && wardData.length > 0) {
            const supervisorIds = [...new Set(wardData.map((w: any) => w.supervisor_id).filter(Boolean))]
            const { data: supProfiles } = await supabase
                .from('profiles')
                .select('id, full_name, supervisor_phone')
                .in('id', supervisorIds)

            const enriched = wardData.map((w: any) => ({
                ...w,
                supervisor: supProfiles?.find((p: any) => p.id === w.supervisor_id) || null
            }))
            setWardAssignments(enriched)
        } else {
            setWardAssignments([])
        }

        setLoading(false)
    }

    async function assignSupervisorToWard() {
        if (!assignForm.supervisor_id || !assignForm.ward || !assignForm.district) {
            setErrorMsg('Supervisor, district and ward are required.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()

        const { error } = await supabase.from('ward_supervisors').upsert({
            ward: assignForm.ward,
            district: assignForm.district,
            supervisor_id: assignForm.supervisor_id,
            supervisor_phone: assignForm.supervisor_phone || null,
            is_primary: assignForm.is_primary,
        }, { onConflict: 'ward,district' })

        if (error) {
            setErrorMsg('Failed to assign supervisor: ' + error.message)
        } else {
            const supervisor = supervisors.find(s => s.id === assignForm.supervisor_id)
            if (supervisor) {
                const currentWards = supervisor.assigned_wards || []
                if (!currentWards.includes(assignForm.ward)) {
                    await supabase.from('profiles')
                        .update({
                            assigned_wards: [...currentWards, assignForm.ward],
                            district: assignForm.district,
                        })
                        .eq('id', assignForm.supervisor_id)
                }
            }
            setSuccessMsg('Supervisor assigned to ward successfully.')
            setShowAssignForm(false)
            setAssignForm({ supervisor_id: '', district: '', ward: '', supervisor_phone: '', is_primary: true })
            loadData()
        }
        setSubmitting(false)
    }

    async function removeWardAssignment(assignmentId: string) {
        if (!confirm('Remove this ward assignment?')) return
        const supabase = createClient()
        await supabase.from('ward_supervisors').delete().eq('id', assignmentId)
        setSuccessMsg('Ward assignment removed.')
        loadData()
    }

    const districts = Object.keys(DISTRICT_WARD_MAP)

    const filteredSupervisors = filterDistrict === 'all'
        ? supervisors
        : supervisors.filter(s => s.district === filterDistrict)

    const filteredWards = filterDistrict === 'all'
        ? wardAssignments
        : wardAssignments.filter(w => w.district === filterDistrict)

    const stats = {
        total: supervisors.length,
        assigned: supervisors.filter(s => s.assigned_wards && s.assigned_wards.length > 0).length,
        totalWards: wardAssignments.length,
        unassignedWards: Object.values(DISTRICT_WARD_MAP).flat().length - wardAssignments.length,
    }

    const wardsByDistrict = filteredWards.reduce((acc, w) => {
        if (!acc[w.district]) acc[w.district] = []
        acc[w.district].push(w)
        return acc
    }, {} as Record<string, WardSupervisor[]>)

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
        .tab-btn { padding:10px 20px; border-radius:10px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:none; transition:all 0.2s; }
        .tab-active { background:#00450d; color:white; }
        .tab-inactive { background:transparent; color:#717a6d; }
        .tab-inactive:hover { background:#f0fdf4; color:#00450d; }
        .list-row { padding:14px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .list-row:hover { background:#f9fafb; }
        .list-row:last-child { border-bottom:none; }
        .filter-btn { padding:6px 14px; border-radius:8px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:1.5px solid transparent; transition:all 0.2s; }
        .form-input { width:100%; padding:10px 14px; border-radius:10px; border:1.5px solid rgba(0,69,13,0.15); font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:white; color:#181c22; }
        .form-input:focus { border-color:#00450d; }
        .form-label { font-size:12px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.05em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#00450d; color:white; border:none; padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity 0.2s; }
        .btn-primary:hover { opacity:0.88; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
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
                            Supervisor <span style={{ color: '#1b5e20' }}>Management</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Manage CMC supervisors and their ward assignments
                        </p>
                    </div>
                    <button className="btn-primary" onClick={() => { setShowAssignForm(true); setErrorMsg('') }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                        Assign to Ward
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 s2">
                        {[
                            { label: 'Total Supervisors', value: stats.total, color: '#00450d', bg: '#f0fdf4', icon: 'supervisor_account' },
                            { label: 'Assigned', value: stats.assigned, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                            { label: 'Ward Assignments', value: stats.totalWards, color: '#0369a1', bg: '#f0f9ff', icon: 'location_on' },
                            { label: 'Unassigned Wards', value: stats.unassignedWards, color: '#92400e', bg: '#fefce8', icon: 'warning' },
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

                    {/* Tabs + filter */}
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3 s3">
                        <div className="flex items-center gap-2">
                            <button className={`tab-btn ${activeTab === 'supervisors' ? 'tab-active' : 'tab-inactive'}`}
                                onClick={() => setActiveTab('supervisors')}>
                                Supervisors ({supervisors.length})
                            </button>
                            <button className={`tab-btn ${activeTab === 'wards' ? 'tab-active' : 'tab-inactive'}`}
                                onClick={() => setActiveTab('wards')}>
                                Ward Assignments ({wardAssignments.length})
                            </button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase"
                                style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                District:
                            </span>
                            <button className="filter-btn"
                                onClick={() => setFilterDistrict('all')}
                                style={{ background: filterDistrict === 'all' ? '#00450d' : '#f8fafc', color: filterDistrict === 'all' ? 'white' : '#64748b', borderColor: 'transparent' }}>
                                All
                            </button>
                            {districts.map(d => (
                                <button key={d} className="filter-btn"
                                    onClick={() => setFilterDistrict(d)}
                                    style={{ background: filterDistrict === d ? '#00450d' : '#f8fafc', color: filterDistrict === d ? 'white' : '#64748b', borderColor: 'transparent' }}>
                                    {d.split(' - ')[0]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Supervisors Tab */}
                    {activeTab === 'supervisors' && (
                        <div className="bento-card s4">
                            {filteredSupervisors.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>
                                            supervisor_account
                                        </span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No supervisors found</p>
                                    <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                                        Add supervisors from the Users page first
                                    </p>
                                </div>
                            ) : (
                                filteredSupervisors.map(sup => (
                                    <div key={sup.id} className="list-row" onClick={() => setSelectedSupervisor(sup)}>
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: '#f0fdf4' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>
                                                supervisor_account
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-bold" style={{ color: '#181c22' }}>{sup.full_name}</p>
                                                {sup.assigned_wards && sup.assigned_wards.length > 0 ? (
                                                    <span className="status-badge" style={{ background: '#f0fdf4', color: '#00450d' }}>
                                                        {sup.assigned_wards.length} ward{sup.assigned_wards.length !== 1 ? 's' : ''}
                                                    </span>
                                                ) : (
                                                    <span className="status-badge" style={{ background: '#fefce8', color: '#92400e' }}>
                                                        Unassigned
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs" style={{ color: '#717a6d' }}>
                                                {sup.district || 'No district'}{sup.supervisor_phone ? ` · ${sup.supervisor_phone}` : ''}
                                            </p>
                                            {sup.assigned_wards && sup.assigned_wards.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {sup.assigned_wards.slice(0, 3).map(w => (
                                                        <span key={w} className="px-2 py-0.5 rounded-lg text-xs"
                                                            style={{ background: '#f8fafc', color: '#64748b' }}>{w}</span>
                                                    ))}
                                                    {sup.assigned_wards.length > 3 && (
                                                        <span className="px-2 py-0.5 rounded-lg text-xs"
                                                            style={{ background: '#f8fafc', color: '#64748b' }}>
                                                            +{sup.assigned_wards.length - 3} more
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>
                                            chevron_right
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Ward Assignments Tab */}
                    {activeTab === 'wards' && (
                        <div className="s4">
                            {Object.keys(wardsByDistrict).length === 0 ? (
                                <div className="bento-card p-16 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>
                                            location_on
                                        </span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No ward assignments</p>
                                    <p className="text-sm mt-1 mb-6" style={{ color: '#94a3b8' }}>
                                        Assign supervisors to wards to get started
                                    </p>
                                    <button className="btn-primary" onClick={() => setShowAssignForm(true)}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                        Assign to Ward
                                    </button>
                                </div>
                            ) : (
                                Object.entries(wardsByDistrict).map(([district, wards]) => (
                                    <div key={district} className="bento-card mb-6">
                                        <div className="px-6 py-4 flex items-center gap-3"
                                            style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                                style={{ background: '#f0fdf4' }}>
                                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '16px' }}>
                                                    corporate_fare
                                                </span>
                                            </div>
                                            <h3 className="font-headline font-bold text-base" style={{ color: '#181c22' }}>{district}</h3>
                                            <span className="text-sm" style={{ color: '#94a3b8' }}>
                                                {wards.length} ward{wards.length !== 1 ? 's' : ''} assigned
                                            </span>
                                        </div>
                                        {wards.map(w => (
                                            <div key={w.id} className="list-row">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                    style={{ background: '#f0fdf4' }}>
                                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>
                                                        location_on
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="text-sm font-bold" style={{ color: '#181c22' }}>{w.ward}</p>
                                                        {w.is_primary && (
                                                            <span className="status-badge"
                                                                style={{ background: '#f0fdf4', color: '#00450d', padding: '2px 8px', fontSize: '10px' }}>
                                                                Primary
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs" style={{ color: '#717a6d' }}>
                                                        {w.supervisor?.full_name || 'Unknown'}{w.supervisor_phone ? ` · ${w.supervisor_phone}` : ''}
                                                    </p>
                                                </div>
                                                <button onClick={() => removeWardAssignment(w.id)}
                                                    style={{ background: '#fef2f2', color: '#ba1a1a', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', flexShrink: 0 }}>
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Supervisor Detail Modal */}
                    {selectedSupervisor && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            {selectedSupervisor.full_name}
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            CMC Supervisor · {selectedSupervisor.district || 'No district'}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedSupervisor(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[
                                        { label: 'District', value: selectedSupervisor.district || 'Not assigned' },
                                        { label: 'Phone', value: selectedSupervisor.supervisor_phone || 'Not provided' },
                                        { label: 'Wards Assigned', value: (selectedSupervisor.assigned_wards?.length || 0).toString() },
                                        { label: 'Status', value: selectedSupervisor.is_approved ? 'Active' : 'Pending' },
                                    ].map(item => (
                                        <div key={item.label} className="p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                                            <p className="text-xs font-bold uppercase mb-1"
                                                style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                                {item.label}
                                            </p>
                                            <p className="text-sm font-semibold" style={{ color: '#181c22' }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                {selectedSupervisor.assigned_wards && selectedSupervisor.assigned_wards.length > 0 && (
                                    <div className="mb-6">
                                        <p className="text-xs font-bold uppercase mb-3"
                                            style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                            Assigned Wards
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedSupervisor.assigned_wards.map(w => (
                                                <span key={w} className="px-3 py-1.5 rounded-xl text-sm font-medium"
                                                    style={{ background: '#f0fdf4', color: '#00450d' }}>{w}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={() => {
                                            setAssignForm(f => ({
                                                ...f,
                                                supervisor_id: selectedSupervisor.id,
                                                district: selectedSupervisor.district || ''
                                            }))
                                            setSelectedSupervisor(null)
                                            setShowAssignForm(true)
                                        }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_location</span>
                                        Assign to Ward
                                    </button>
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => setSelectedSupervisor(null)}>
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Assign to Ward Modal */}
                    {showAssignForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            Assign Supervisor to Ward
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            Assign a CMC supervisor to a specific ward
                                        </p>
                                    </div>
                                    <button onClick={() => { setShowAssignForm(false); setErrorMsg('') }}
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
                                        <label className="form-label">Supervisor *</label>
                                        <select className="form-input"
                                            value={assignForm.supervisor_id}
                                            onChange={e => setAssignForm(f => ({ ...f, supervisor_id: e.target.value }))}>
                                            <option value="">Select supervisor...</option>
                                            {supervisors.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.full_name} — {s.district || 'No district'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">District *</label>
                                        <select className="form-input"
                                            value={assignForm.district}
                                            onChange={e => setAssignForm(f => ({ ...f, district: e.target.value, ward: '' }))}>
                                            <option value="">Select district...</option>
                                            {Object.keys(DISTRICT_WARD_MAP).map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Ward *</label>
                                        <select className="form-input"
                                            value={assignForm.ward}
                                            onChange={e => setAssignForm(f => ({ ...f, ward: e.target.value }))}
                                            disabled={!assignForm.district}>
                                            <option value="">{assignForm.district ? 'Select ward...' : 'Select district first'}</option>
                                            {(DISTRICT_WARD_MAP[assignForm.district] || []).map(w => (
                                                <option key={w} value={w}>{w}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Supervisor Phone</label>
                                        <input className="form-input" placeholder="e.g. 077-2106529"
                                            value={assignForm.supervisor_phone}
                                            onChange={e => setAssignForm(f => ({ ...f, supervisor_phone: e.target.value }))} />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" id="is_primary"
                                            checked={assignForm.is_primary}
                                            onChange={e => setAssignForm(f => ({ ...f, is_primary: e.target.checked }))}
                                            style={{ width: '16px', height: '16px', accentColor: '#00450d' }} />
                                        <label htmlFor="is_primary" className="text-sm font-medium"
                                            style={{ color: '#181c22', fontFamily: 'Inter, sans-serif' }}>
                                            Primary supervisor for this ward
                                        </label>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setShowAssignForm(false); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={assignSupervisorToWard} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                                                Assign
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