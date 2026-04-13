'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

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
    { label: 'Disposal', href: '/dashboard/admin/disposal', icon: 'delete_sweep' },
]

type DisposalRecord = {
    id: string
    driver_id: string
    contractor_id: string
    facility_name: string
    facility_type: string
    waste_category: string
    collected_tonnage: number
    disposed_tonnage: number
    vehicle_number: string
    district: string
    ward: string
    status: string
    blockchain_tx: string
    notes: string
    arrival_time: string
    created_at: string
    driver?: { full_name: string }
    contractor?: { full_name: string; organisation_name: string }
}

type Discrepancy = {
    id: string
    disposal_id: string
    collected_tonnage: number
    disposed_tonnage: number
    difference: number
    difference_percentage: number
    reason: string
    status: string
    flagged_at: string
    driver?: { full_name: string }
    contractor?: { full_name: string; organisation_name: string }
}

function statusStyle(status: string) {
    switch (status) {
        case 'pending': return { bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8', label: 'Pending' }
        case 'confirmed': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Confirmed' }
        case 'flagged': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Flagged' }
        case 'rejected': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Rejected' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: status }
    }
}

function discrepancyStatusStyle(status: string) {
    switch (status) {
        case 'open': return { bg: '#fef2f2', color: '#ba1a1a' }
        case 'under_review': return { bg: '#fefce8', color: '#92400e' }
        case 'resolved': return { bg: '#f0fdf4', color: '#00450d' }
        case 'closed': return { bg: '#f8fafc', color: '#64748b' }
        default: return { bg: '#f8fafc', color: '#64748b' }
    }
}

function wasteCategoryColor(category: string) {
    switch (category) {
        case 'general': return { bg: '#f8fafc', color: '#64748b' }
        case 'organic': return { bg: '#f0fdf4', color: '#00450d' }
        case 'recyclable': return { bg: '#eff6ff', color: '#1d4ed8' }
        case 'hazardous': return { bg: '#fef2f2', color: '#ba1a1a' }
        case 'e_waste': return { bg: '#f5f3ff', color: '#7c3aed' }
        case 'bulk': return { bg: '#fefce8', color: '#92400e' }
        default: return { bg: '#f8fafc', color: '#64748b' }
    }
}

export default function AdminDisposalPage() {
    const [profile, setProfile] = useState<any>(null)
    const [records, setRecords] = useState<DisposalRecord[]>([])
    const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([])
    const [selectedRecord, setSelectedRecord] = useState<DisposalRecord | null>(null)
    const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<Discrepancy | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'records' | 'discrepancies'>('records')
    const [filterStatus, setFilterStatus] = useState('all')
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [resolutionNotes, setResolutionNotes] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Load disposal records
        const { data: recordsData } = await supabase
            .from('disposal_records')
            .select('*')
            .order('created_at', { ascending: false })

        console.log('disposal records:', recordsData, 'error check')

        if (recordsData && recordsData.length > 0) {
            const driverIds = [...new Set(recordsData.map(r => r.driver_id).filter(Boolean))]
            const contractorIds = [...new Set(recordsData.map(r => r.contractor_id).filter(Boolean))]

            const { data: driverProfiles } = await supabase
                .from('profiles').select('id, full_name').in('id', driverIds)
            const { data: contractorProfiles } = await supabase
                .from('profiles').select('id, full_name, organisation_name').in('id', contractorIds)

            const enriched = recordsData.map(r => ({
                ...r,
                driver: driverProfiles?.find(p => p.id === r.driver_id) || null,
                contractor: contractorProfiles?.find(p => p.id === r.contractor_id) || null,
            }))
            setRecords(enriched)
        } else {
            setRecords([])
        }

        // Load discrepancies
        const { data: discData } = await supabase
            .from('disposal_discrepancies')
            .select('*')
            .order('flagged_at', { ascending: false })

        if (discData && discData.length > 0) {
            const driverIds = [...new Set(discData.map(d => d.driver_id).filter(Boolean))]
            const contractorIds = [...new Set(discData.map(d => d.contractor_id).filter(Boolean))]

            const { data: driverProfiles } = await supabase
                .from('profiles').select('id, full_name').in('id', driverIds)
            const { data: contractorProfiles } = await supabase
                .from('profiles').select('id, full_name, organisation_name').in('id', contractorIds)

            const enriched = discData.map(d => ({
                ...d,
                driver: driverProfiles?.find(p => p.id === d.driver_id) || null,
                contractor: contractorProfiles?.find(p => p.id === d.contractor_id) || null,
            }))
            setDiscrepancies(enriched)
        } else {
            setDiscrepancies([])
        }

        setLoading(false)
    }

    async function resolveDiscrepancy(discrepancyId: string, newStatus: string) {
        setSubmitting(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('disposal_discrepancies')
            .update({
                status: newStatus,
                resolution_notes: resolutionNotes || null,
                resolved_by: user.id,
                resolved_at: new Date().toISOString(),
            })
            .eq('id', discrepancyId)

        setSuccessMsg(`Discrepancy marked as ${newStatus}.`)
        setSelectedDiscrepancy(null)
        setResolutionNotes('')
        loadData()
        setSubmitting(false)
    }

    const filteredRecords = filterStatus === 'all'
        ? records : records.filter(r => r.status === filterStatus)

    const stats = {
        total: records.length,
        pending: records.filter(r => r.status === 'pending').length,
        confirmed: records.filter(r => r.status === 'confirmed').length,
        flagged: records.filter(r => r.status === 'flagged').length,
        openDiscrepancies: discrepancies.filter(d => d.status === 'open').length,
        totalTonnage: records.reduce((s, r) => s + (r.collected_tonnage || 0), 0),
        onChain: records.filter(r => r.blockchain_tx).length,
    }

    // Group by facility
    const byFacility = records.reduce((acc, r) => {
        if (!acc[r.facility_name]) acc[r.facility_name] = { count: 0, tonnage: 0 }
        acc[r.facility_name].count++
        acc[r.facility_name].tonnage += r.collected_tonnage || 0
        return acc
    }, {} as Record<string, { count: number; tonnage: number }>)

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
        .bento-card-green { background:#00450d; border-radius:16px; color:white; overflow:hidden; position:relative; }
        .status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .tab-btn { padding:10px 20px; border-radius:10px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:none; transition:all 0.2s; }
        .tab-active { background:#00450d; color:white; }
        .tab-inactive { background:transparent; color:#717a6d; }
        .tab-inactive:hover { background:#f0fdf4; color:#00450d; }
        .record-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .record-row:hover { background:#f9fafb; }
        .record-row:last-child { border-bottom:none; }
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
                            Waste Disposal <span style={{ color: '#1b5e20' }}>Records</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Full chain of custody from collection to disposal
                        </p>
                    </div>
                    {stats.openDiscrepancies > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                            style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                            <span className="text-sm font-bold" style={{ color: '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}>
                                {stats.openDiscrepancies} open discrepanc{stats.openDiscrepancies > 1 ? 'ies' : 'y'}
                            </span>
                        </div>
                    )}
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

                    {/* Hero stats */}
                    <div className="bento-card-green p-8 mb-6 s2">
                        <div className="absolute top-0 right-0 w-56 h-56 rounded-full -mr-20 -mt-20"
                            style={{ background: 'rgba(163,246,156,0.06)' }} />
                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-8">
                                <div>
                                    <span className="text-xs font-bold uppercase block mb-2"
                                        style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                                        Waste Chain Overview
                                    </span>
                                    <h2 className="font-headline font-extrabold text-3xl tracking-tight">
                                        {stats.totalTonnage.toFixed(1)}T Disposed
                                    </h2>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '4px' }}>
                                        Across {Object.keys(byFacility).length} facilities · {stats.onChain} on-chain records
                                    </p>
                                </div>
                                <div className="p-3 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>delete_sweep</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Total Records', value: stats.total, icon: 'receipt_long' },
                                    { label: 'Confirmed', value: stats.confirmed, icon: 'check_circle' },
                                    { label: 'Pending', value: stats.pending, icon: 'pending' },
                                    { label: 'Discrepancies', value: stats.openDiscrepancies, icon: 'flag' },
                                ].map(m => (
                                    <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                        <span className="material-symbols-outlined mb-2 block"
                                            style={{ color: 'rgba(163,246,156,0.7)', fontSize: '18px' }}>{m.icon}</span>
                                        <p className="font-headline font-bold text-2xl">{m.value}</p>
                                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Facility breakdown */}
                    {Object.keys(byFacility).length > 0 && (
                        <div className="bento-card mb-6 s3">
                            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <h3 className="font-headline font-bold text-base" style={{ color: '#181c22' }}>
                                    Disposal by Facility
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                                {Object.entries(byFacility).map(([facility, data], i) => (
                                    <div key={facility} className="p-6"
                                        style={{ borderRight: i < Object.keys(byFacility).length - 1 ? '1px solid rgba(0,69,13,0.06)' : 'none' }}>
                                        <p className="text-sm font-bold mb-1" style={{ color: '#181c22' }}>{facility}</p>
                                        <p className="font-headline font-extrabold text-2xl" style={{ color: '#00450d' }}>
                                            {data.tonnage.toFixed(1)}T
                                        </p>
                                        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{data.count} record{data.count !== 1 ? 's' : ''}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex items-center gap-2 mb-4 s3">
                        <button className={`tab-btn ${activeTab === 'records' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('records')}>
                            All Records ({records.length})
                        </button>
                        <button className={`tab-btn ${activeTab === 'discrepancies' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('discrepancies')}>
                            Discrepancies ({discrepancies.length})
                            {stats.openDiscrepancies > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                                    style={{ background: activeTab === 'discrepancies' ? 'rgba(255,255,255,0.2)' : '#fef2f2', color: activeTab === 'discrepancies' ? 'white' : '#ba1a1a' }}>
                                    {stats.openDiscrepancies}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Records Tab */}
                    {activeTab === 'records' && (
                        <>
                            <div className="flex items-center gap-2 mb-4 flex-wrap s3">
                                {['all', 'pending', 'confirmed', 'flagged'].map(f => (
                                    <button key={f} className="filter-btn"
                                        onClick={() => setFilterStatus(f)}
                                        style={{ background: filterStatus === f ? '#00450d' : '#f8fafc', color: filterStatus === f ? 'white' : '#64748b', borderColor: 'transparent' }}>
                                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                            </div>
                            <div className="bento-card s4">
                                {filteredRecords.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                            style={{ background: '#f0fdf4' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>
                                                delete_sweep
                                            </span>
                                        </div>
                                        <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No records found</p>
                                        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Disposal records logged by drivers will appear here</p>
                                    </div>
                                ) : (
                                    filteredRecords.map(record => {
                                        const ss = statusStyle(record.status)
                                        const wc = wasteCategoryColor(record.waste_category)
                                        const contractorName = record.contractor?.organisation_name || record.contractor?.full_name || 'Unknown'
                                        return (
                                            <div key={record.id} className="record-row" onClick={() => setSelectedRecord(record)}>
                                                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                                    style={{ background: wc.bg }}>
                                                    <span className="material-symbols-outlined" style={{ color: wc.color, fontSize: '22px' }}>
                                                        delete_sweep
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <p className="text-sm font-bold" style={{ color: '#181c22' }}>
                                                            {record.facility_name}
                                                        </p>
                                                        <span className="status-badge" style={{ background: ss.bg, color: ss.color }}>
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ss.dot }} />
                                                            {ss.label}
                                                        </span>
                                                        {record.blockchain_tx && (
                                                            <span className="status-badge" style={{ background: '#f5f3ff', color: '#7c3aed', fontSize: '10px', padding: '2px 8px' }}>
                                                                on-chain
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs" style={{ color: '#717a6d' }}>
                                                        {record.driver?.full_name || 'Unknown driver'} · {contractorName} · {record.ward || record.district || 'Unknown'} · {new Date(record.created_at).toLocaleDateString('en-GB')}
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-sm font-bold" style={{ color: '#00450d' }}>
                                                        {record.collected_tonnage}T
                                                    </p>
                                                    <p className="text-xs capitalize" style={{ color: '#94a3b8' }}>
                                                        {record.waste_category}
                                                    </p>
                                                </div>
                                                <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>
                                                    chevron_right
                                                </span>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </>
                    )}

                    {/* Discrepancies Tab */}
                    {activeTab === 'discrepancies' && (
                        <div className="bento-card s4">
                            {discrepancies.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>
                                            check_circle
                                        </span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No discrepancies</p>
                                    <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>All disposal records match — no tonnage mismatches detected</p>
                                </div>
                            ) : (
                                discrepancies.map(disc => {
                                    const ds = discrepancyStatusStyle(disc.status)
                                    const contractorName = disc.contractor?.organisation_name || disc.contractor?.full_name || 'Unknown'
                                    return (
                                        <div key={disc.id} className="record-row"
                                            onClick={() => { setSelectedDiscrepancy(disc); setResolutionNotes('') }}>
                                            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: ds.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: ds.color, fontSize: '22px' }}>
                                                    flag
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22' }}>
                                                        {disc.difference?.toFixed(1)}T discrepancy
                                                    </p>
                                                    <span className="status-badge" style={{ background: ds.bg, color: ds.color }}>
                                                        {disc.status.replace('_', ' ')}
                                                    </span>
                                                    <span className="status-badge" style={{ background: '#fef2f2', color: '#ba1a1a', fontSize: '10px', padding: '2px 8px' }}>
                                                        {disc.difference_percentage?.toFixed(0)}% variance
                                                    </span>
                                                </div>
                                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                                    {disc.driver?.full_name || 'Unknown driver'} · {contractorName} · {new Date(disc.flagged_at).toLocaleDateString('en-GB')}
                                                </p>
                                                {disc.reason && (
                                                    <p className="text-xs mt-0.5 truncate" style={{ color: '#94a3b8' }}>{disc.reason}</p>
                                                )}
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                                    {disc.collected_tonnage}T collected
                                                </p>
                                                <p className="text-xs" style={{ color: '#ba1a1a' }}>
                                                    {disc.disposed_tonnage}T disposed
                                                </p>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>
                                                chevron_right
                                            </span>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* Record Detail Modal */}
                    {selectedRecord && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            {selectedRecord.facility_name}
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            {selectedRecord.driver?.full_name} · {selectedRecord.contractor?.organisation_name || selectedRecord.contractor?.full_name}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedRecord(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[
                                        { label: 'Status', value: statusStyle(selectedRecord.status).label },
                                        { label: 'Waste Category', value: selectedRecord.waste_category },
                                        { label: 'Collected', value: `${selectedRecord.collected_tonnage}T` },
                                        { label: 'Disposed', value: `${selectedRecord.disposed_tonnage}T` },
                                        { label: 'Facility Type', value: selectedRecord.facility_type.replace(/_/g, ' ') },
                                        { label: 'Vehicle', value: selectedRecord.vehicle_number || 'N/A' },
                                        { label: 'Ward', value: selectedRecord.ward || 'N/A' },
                                        { label: 'District', value: selectedRecord.district || 'N/A' },
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
                                {selectedRecord.blockchain_tx && (
                                    <div className="p-4 rounded-xl mb-6"
                                        style={{ background: '#f5f3ff', border: '1px solid rgba(124,58,237,0.15)' }}>
                                        <p className="text-xs font-bold uppercase mb-1"
                                            style={{ color: '#7c3aed', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                            Blockchain Transaction
                                        </p>
                                        <p className="text-xs font-mono break-all" style={{ color: '#7c3aed' }}>
                                            {selectedRecord.blockchain_tx}
                                        </p>
                                    </div>
                                )}
                                {selectedRecord.notes && (
                                    <div className="p-4 rounded-xl mb-6" style={{ background: '#f8fafc' }}>
                                        <p className="text-xs font-bold uppercase mb-1"
                                            style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>Notes</p>
                                        <p className="text-sm" style={{ color: '#4b5563' }}>{selectedRecord.notes}</p>
                                    </div>
                                )}
                                <button className="btn-secondary w-full justify-center" onClick={() => setSelectedRecord(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Discrepancy Detail Modal */}
                    {selectedDiscrepancy && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            Tonnage Discrepancy
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            {selectedDiscrepancy.driver?.full_name} · {selectedDiscrepancy.contractor?.organisation_name || selectedDiscrepancy.contractor?.full_name}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedDiscrepancy(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                <div className="p-4 rounded-xl mb-6"
                                    style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-bold" style={{ color: '#ba1a1a' }}>
                                            {selectedDiscrepancy.difference?.toFixed(2)}T missing
                                        </p>
                                        <span className="status-badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>
                                            {selectedDiscrepancy.difference_percentage?.toFixed(0)}% variance
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl" style={{ background: 'white' }}>
                                            <p className="text-xs font-bold uppercase mb-1"
                                                style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                                Collected
                                            </p>
                                            <p className="text-lg font-bold" style={{ color: '#181c22' }}>
                                                {selectedDiscrepancy.collected_tonnage}T
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'white' }}>
                                            <p className="text-xs font-bold uppercase mb-1"
                                                style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                                Disposed
                                            </p>
                                            <p className="text-lg font-bold" style={{ color: '#ba1a1a' }}>
                                                {selectedDiscrepancy.disposed_tonnage}T
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {selectedDiscrepancy.reason && (
                                    <div className="p-4 rounded-xl mb-6" style={{ background: '#f8fafc' }}>
                                        <p className="text-xs font-bold uppercase mb-1"
                                            style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>Reason</p>
                                        <p className="text-sm" style={{ color: '#4b5563' }}>{selectedDiscrepancy.reason}</p>
                                    </div>
                                )}

                                {selectedDiscrepancy.status === 'open' || selectedDiscrepancy.status === 'under_review' ? (
                                    <>
                                        <div className="mb-6">
                                            <label className="form-label">Resolution Notes</label>
                                            <textarea className="form-input" rows={3}
                                                placeholder="Describe how this discrepancy was resolved..."
                                                value={resolutionNotes}
                                                onChange={e => setResolutionNotes(e.target.value)}
                                                style={{ resize: 'vertical' }} />
                                        </div>
                                        <div className="flex gap-3">
                                            <button className="btn-secondary flex-1 justify-center"
                                                onClick={() => resolveDiscrepancy(selectedDiscrepancy.id, 'under_review')}
                                                disabled={submitting}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>pending</span>
                                                Under Review
                                            </button>
                                            <button className="btn-primary flex-1 justify-center"
                                                onClick={() => resolveDiscrepancy(selectedDiscrepancy.id, 'resolved')}
                                                disabled={submitting}>
                                                {submitting ? (
                                                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                        style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                                ) : (
                                                    <>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                                                        Resolve
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <button className="btn-secondary w-full justify-center"
                                        onClick={() => setSelectedDiscrepancy(null)}>
                                        Close
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}