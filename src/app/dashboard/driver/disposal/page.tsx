'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const DRIVER_NAV = [
    { label: 'Overview', href: '/dashboard/driver', icon: 'dashboard' },
    { label: 'My Routes', href: '/dashboard/driver/routes', icon: 'route' },
    { label: 'Fuel Log', href: '/dashboard/driver/fuel-log', icon: 'local_gas_station' },
    { label: 'Breakdown', href: '/dashboard/driver/breakdown', icon: 'car_crash' },
    { label: 'Disposal', href: '/dashboard/driver/disposal', icon: 'delete_sweep' },
]

type DisposalRecord = {
    id: string
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

function facilityTypeIcon(type: string) {
    switch (type) {
        case 'transfer_station': return 'swap_horiz'
        case 'recycling_center': return 'recycling'
        case 'landfill': return 'landscape'
        case 'composting_facility': return 'compost'
        case 'e_waste_facility': return 'computer'
        default: return 'delete_sweep'
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

const EMPTY_FORM = {
    facility_name: '',
    facility_type: 'transfer_station',
    waste_category: 'general',
    collected_tonnage: '',
    disposed_tonnage: '',
    vehicle_number: '',
    district: '',
    ward: '',
    notes: '',
    route_id: '',
}

const FACILITIES = [
    'Meethotamulla Transfer Station',
    'Karadiyana Recycling Center',
    'Kelaniya Composting Facility',
    'Bloemendhal Transfer Station',
    'Orugodawatta Transfer Station',
    'Other',
]

export default function DriverDisposalPage() {
    const [profile, setProfile] = useState<any>(null)
    const [records, setRecords] = useState<DisposalRecord[]>([])
    const [routes, setRoutes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [form, setForm] = useState(EMPTY_FORM)
    const [selectedRecord, setSelectedRecord] = useState<DisposalRecord | null>(null)
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'confirmed' | 'flagged'>('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: recordsData } = await supabase
            .from('disposal_records')
            .select('*')
            .eq('driver_id', user.id)
            .order('created_at', { ascending: false })
        setRecords(recordsData || [])

        const { data: routesData } = await supabase
            .from('routes')
            .select('id, route_name, ward, district')
            .eq('driver_id', user.id)
            .order('date', { ascending: false })
            .limit(10)
        setRoutes(routesData || [])

        setLoading(false)
    }

    async function submitDisposal() {
        if (!form.facility_name || !form.waste_category || !form.collected_tonnage) {
            setErrorMsg('Facility name, waste category and collected tonnage are required.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Auto-lookup contractor from driver assignments
        const { data: assignment } = await supabase
            .from('driver_assignments')
            .select('contractor_id')
            .eq('driver_id', user.id)
            .eq('status', 'active')
            .order('assigned_date', { ascending: false })
            .limit(1)
            .single()

        const collectedTonnage = parseFloat(form.collected_tonnage)
        const disposedTonnage = form.disposed_tonnage ? parseFloat(form.disposed_tonnage) : collectedTonnage

        const { data: newRecord, error } = await supabase
            .from('disposal_records')
            .insert({
                driver_id: user.id,
                contractor_id: assignment?.contractor_id || null,
                route_id: form.route_id || null,
                facility_name: form.facility_name,
                facility_type: form.facility_type,
                waste_category: form.waste_category,
                collected_tonnage: collectedTonnage,
                disposed_tonnage: disposedTonnage,
                vehicle_number: form.vehicle_number || null,
                district: form.district || profile?.district || null,
                ward: form.ward || null,
                notes: form.notes || null,
                status: 'pending',
                arrival_time: new Date().toISOString(),
            })
            .select()
            .single()

        if (error) {
            setErrorMsg('Failed to log disposal: ' + error.message)
            setSubmitting(false)
            return
        }

        // Record on blockchain
        if (newRecord) {
            try {
                const { data: blockchainData } = await supabase.functions.invoke('record-disposal', {
                    body: {
                        disposalId: newRecord.id,
                        driverId: user.id,
                        facilityName: form.facility_name,
                        wasteCategory: form.waste_category,
                        tonnage: collectedTonnage,
                    }
                })
                if (blockchainData?.txHash) {
                    await supabase.from('disposal_records')
                        .update({ blockchain_tx: blockchainData.txHash })
                        .eq('id', newRecord.id)
                }
            } catch (e) {
                // Blockchain recording failed silently — record still saved
                console.log('Blockchain recording skipped:', e)
            }
        }

        setSuccessMsg('Disposal record logged successfully. Awaiting facility confirmation.')
        setShowForm(false)
        setForm(EMPTY_FORM)
        loadData()
        setSubmitting(false)
    }

    const filteredRecords = activeTab === 'all' ? records
        : records.filter(r => r.status === activeTab)

    const stats = {
        total: records.length,
        pending: records.filter(r => r.status === 'pending').length,
        confirmed: records.filter(r => r.status === 'confirmed').length,
        flagged: records.filter(r => r.status === 'flagged').length,
        totalTonnage: records.reduce((s, r) => s + (r.collected_tonnage || 0), 0),
    }

    return (
        <DashboardLayout
            role="Driver"
            userName={profile?.full_name || ''}
            navItems={DRIVER_NAV}
            primaryAction={{ label: 'Log Disposal', href: '#', icon: 'add' }}
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
                            Waste <span style={{ color: '#1b5e20' }}>Disposal</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Log and track your waste disposal records
                        </p>
                    </div>
                    <button className="btn-primary" onClick={() => { setShowForm(true); setErrorMsg('') }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                        Log Disposal
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

                    {/* Hero stats */}
                    <div className="bento-card-green p-8 mb-6 s2">
                        <div className="absolute top-0 right-0 w-56 h-56 rounded-full -mr-20 -mt-20"
                            style={{ background: 'rgba(163,246,156,0.06)' }} />
                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-8">
                                <div>
                                    <span className="text-xs font-bold uppercase block mb-2"
                                        style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                                        Disposal Summary
                                    </span>
                                    <h2 className="font-headline font-extrabold text-3xl tracking-tight">
                                        {stats.totalTonnage.toFixed(1)}T Total
                                    </h2>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '4px' }}>
                                        Waste disposed across all facilities
                                    </p>
                                </div>
                                <div className="p-3 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>delete_sweep</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Total Records', value: stats.total, icon: 'receipt_long' },
                                    { label: 'Pending', value: stats.pending, icon: 'pending' },
                                    { label: 'Confirmed', value: stats.confirmed, icon: 'check_circle' },
                                    { label: 'Flagged', value: stats.flagged, icon: 'flag' },
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

                    {/* Tabs */}
                    <div className="flex items-center gap-2 mb-6 s3">
                        {(['all', 'pending', 'confirmed', 'flagged'] as const).map(tab => (
                            <button key={tab} className={`tab-btn ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`}
                                onClick={() => setActiveTab(tab)}>
                                {tab === 'all' ? `All (${records.length})` :
                                    tab === 'pending' ? `Pending (${stats.pending})` :
                                        tab === 'confirmed' ? `Confirmed (${stats.confirmed})` :
                                            `Flagged (${stats.flagged})`}
                            </button>
                        ))}
                    </div>

                    {/* Records list */}
                    <div className="bento-card s4">
                        {filteredRecords.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>
                                        delete_sweep
                                    </span>
                                </div>
                                <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>
                                    No disposal records
                                </p>
                                <p className="text-sm mt-1 mb-6" style={{ color: '#94a3b8' }}>
                                    Log your first disposal record after completing a collection
                                </p>
                                <button className="btn-primary" onClick={() => setShowForm(true)}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                    Log Disposal
                                </button>
                            </div>
                        ) : (
                            filteredRecords.map(record => {
                                const ss = statusStyle(record.status)
                                const wc = wasteCategoryColor(record.waste_category)
                                return (
                                    <div key={record.id} className="record-row" onClick={() => setSelectedRecord(record)}>
                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: wc.bg }}>
                                            <span className="material-symbols-outlined" style={{ color: wc.color, fontSize: '22px' }}>
                                                {facilityTypeIcon(record.facility_type)}
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
                                                <span className="status-badge" style={{ background: wc.bg, color: wc.color, fontSize: '10px', padding: '2px 8px' }}>
                                                    {record.waste_category}
                                                </span>
                                            </div>
                                            <p className="text-xs" style={{ color: '#717a6d' }}>
                                                {record.ward || record.district || 'Unknown'} · {record.vehicle_number || 'No vehicle'} · {new Date(record.created_at).toLocaleDateString('en-GB')}
                                            </p>
                                            {record.blockchain_tx && (
                                                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#7c3aed' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>link</span>
                                                    On-chain: {record.blockchain_tx.slice(0, 20)}...
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-sm font-bold" style={{ color: '#00450d' }}>
                                                {record.collected_tonnage}T
                                            </p>
                                            <p className="text-xs" style={{ color: '#94a3b8' }}>collected</p>
                                        </div>
                                        <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>
                                            chevron_right
                                        </span>
                                    </div>
                                )
                            })
                        )}
                    </div>

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
                                            {selectedRecord.facility_type.replace(/_/g, ' ')}
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
                                        { label: 'Vehicle', value: selectedRecord.vehicle_number || 'N/A' },
                                        { label: 'Ward', value: selectedRecord.ward || selectedRecord.district || 'N/A' },
                                        { label: 'Arrival', value: new Date(selectedRecord.arrival_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
                                        { label: 'Date', value: new Date(selectedRecord.created_at).toLocaleDateString('en-GB') },
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

                                {selectedRecord.notes && (
                                    <div className="p-4 rounded-xl mb-6" style={{ background: '#f8fafc' }}>
                                        <p className="text-xs font-bold uppercase mb-1"
                                            style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>Notes</p>
                                        <p className="text-sm" style={{ color: '#4b5563' }}>{selectedRecord.notes}</p>
                                    </div>
                                )}

                                {selectedRecord.blockchain_tx && (
                                    <div className="p-4 rounded-xl mb-6" style={{ background: '#f5f3ff', border: '1px solid rgba(124,58,237,0.15)' }}>
                                        <p className="text-xs font-bold uppercase mb-1"
                                            style={{ color: '#7c3aed', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                            Blockchain Record
                                        </p>
                                        <p className="text-xs font-mono break-all" style={{ color: '#7c3aed' }}>
                                            {selectedRecord.blockchain_tx}
                                        </p>
                                    </div>
                                )}

                                {selectedRecord.status === 'flagged' && (
                                    <div className="p-4 rounded-xl mb-6" style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                        <p className="text-xs font-bold uppercase mb-1"
                                            style={{ color: '#ba1a1a', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                            Discrepancy Flagged
                                        </p>
                                        <p className="text-sm" style={{ color: '#ba1a1a' }}>
                                            Tonnage mismatch detected between collected and disposed amounts. CMC has been notified.
                                        </p>
                                    </div>
                                )}

                                <button className="btn-secondary w-full justify-center" onClick={() => setSelectedRecord(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Log Disposal Modal */}
                    {showForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            Log Waste Disposal
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            Record waste disposed at facility
                                        </p>
                                    </div>
                                    <button onClick={() => { setShowForm(false); setErrorMsg('') }}
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
                                        <label className="form-label">Facility Name *</label>
                                        <select className="form-input"
                                            value={form.facility_name}
                                            onChange={e => setForm(f => ({ ...f, facility_name: e.target.value }))}>
                                            <option value="">Select facility...</option>
                                            {FACILITIES.map(f => (
                                                <option key={f} value={f}>{f}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Facility Type</label>
                                            <select className="form-input"
                                                value={form.facility_type}
                                                onChange={e => setForm(f => ({ ...f, facility_type: e.target.value }))}>
                                                <option value="transfer_station">Transfer Station</option>
                                                <option value="recycling_center">Recycling Center</option>
                                                <option value="landfill">Landfill</option>
                                                <option value="composting_facility">Composting Facility</option>
                                                <option value="e_waste_facility">E-Waste Facility</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">Waste Category</label>
                                            <select className="form-input"
                                                value={form.waste_category}
                                                onChange={e => setForm(f => ({ ...f, waste_category: e.target.value }))}>
                                                <option value="general">General</option>
                                                <option value="organic">Organic</option>
                                                <option value="recyclable">Recyclable</option>
                                                <option value="hazardous">Hazardous</option>
                                                <option value="e_waste">E-Waste</option>
                                                <option value="bulk">Bulk</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Collected Tonnage *</label>
                                            <input type="number" step="0.1" className="form-input" placeholder="e.g. 4.5"
                                                value={form.collected_tonnage}
                                                onChange={e => setForm(f => ({ ...f, collected_tonnage: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Disposed Tonnage</label>
                                            <input type="number" step="0.1" className="form-input" placeholder="Leave blank if same"
                                                value={form.disposed_tonnage}
                                                onChange={e => setForm(f => ({ ...f, disposed_tonnage: e.target.value }))} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="form-label">Related Route</label>
                                        <select className="form-input"
                                            value={form.route_id}
                                            onChange={e => setForm(f => ({ ...f, route_id: e.target.value }))}>
                                            <option value="">None</option>
                                            {routes.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    {r.route_name} — {r.ward || r.district}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Vehicle Number</label>
                                            <input className="form-input" placeholder="e.g. WP-CAB-1234"
                                                value={form.vehicle_number}
                                                onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Ward</label>
                                            <input className="form-input" placeholder="e.g. Mattakkuliya"
                                                value={form.ward}
                                                onChange={e => setForm(f => ({ ...f, ward: e.target.value }))} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="form-label">Notes</label>
                                        <textarea className="form-input" rows={3}
                                            placeholder="Any additional notes about this disposal..."
                                            value={form.notes}
                                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                            style={{ resize: 'vertical' }} />
                                    </div>

                                    <div className="p-3 rounded-xl flex items-center gap-3"
                                        style={{ background: '#f5f3ff', border: '1px solid rgba(124,58,237,0.15)' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#7c3aed', fontSize: '18px' }}>link</span>
                                        <p className="text-xs" style={{ color: '#7c3aed', fontFamily: 'Inter, sans-serif' }}>
                                            This record will be logged on the <strong>Polygon Amoy blockchain</strong> for immutable audit trail.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setShowForm(false); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={submitDisposal} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                                                Log Disposal
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