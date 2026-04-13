'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const FACILITY_NAV = [
    { label: 'Overview', href: '/dashboard/facility', icon: 'dashboard' },
    { label: 'Disposal', href: '/dashboard/facility/disposal', icon: 'delete_sweep' },
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

function statusStyle(status: string) {
    switch (status) {
        case 'pending': return { bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8', label: 'Pending' }
        case 'confirmed': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Confirmed' }
        case 'flagged': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Flagged' }
        case 'rejected': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Rejected' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: status }
    }
}

const PROCESSING_METHODS = [
    { value: 'landfill', label: 'Landfill' },
    { value: 'composting', label: 'Composting' },
    { value: 'recycling', label: 'Recycling' },
    { value: 'incineration', label: 'Incineration' },
    { value: 'energy_recovery', label: 'Energy Recovery' },
    { value: 'other', label: 'Other' },
]

export default function FacilityDisposalPage() {
    const [profile, setProfile] = useState<any>(null)
    const [pendingRecords, setPendingRecords] = useState<DisposalRecord[]>([])
    const [confirmedRecords, setConfirmedRecords] = useState<DisposalRecord[]>([])
    const [selectedRecord, setSelectedRecord] = useState<DisposalRecord | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [activeTab, setActiveTab] = useState<'pending' | 'confirmed'>('pending')
    const [confirmForm, setConfirmForm] = useState({
        received_tonnage: '',
        processing_method: 'landfill',
        notes: '',
    })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Load all disposal records for facility operator
        const { data: allRecords } = await supabase
            .from('disposal_records')
            .select('*')
            .order('created_at', { ascending: false })

        if (allRecords && allRecords.length > 0) {
            const driverIds = [...new Set(allRecords.map(r => r.driver_id).filter(Boolean))]
            const contractorIds = [...new Set(allRecords.map(r => r.contractor_id).filter(Boolean))]

            const { data: driverProfiles } = await supabase
                .from('profiles').select('id, full_name').in('id', driverIds)
            const { data: contractorProfiles } = await supabase
                .from('profiles').select('id, full_name, organisation_name').in('id', contractorIds)

            const enriched = allRecords.map(r => ({
                ...r,
                driver: driverProfiles?.find((p: any) => p.id === r.driver_id) || null,
                contractor: contractorProfiles?.find((p: any) => p.id === r.contractor_id) || null,
            }))

            setPendingRecords(enriched.filter(r => r.status === 'pending'))
            setConfirmedRecords(enriched.filter(r => ['confirmed', 'flagged'].includes(r.status)))
        } else {
            setPendingRecords([])
            setConfirmedRecords([])
        }

        setLoading(false)
    }

    async function confirmDisposal() {
        if (!selectedRecord || !confirmForm.received_tonnage) {
            setErrorMsg('Received tonnage is required.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('disposal_confirmations').insert({
            disposal_id: selectedRecord.id,
            confirmed_by: user.id,
            facility_name: selectedRecord.facility_name,
            received_tonnage: parseFloat(confirmForm.received_tonnage),
            processing_method: confirmForm.processing_method,
            notes: confirmForm.notes || null,
        })

        if (error) {
            setErrorMsg('Failed to confirm disposal: ' + error.message)
        } else {
            setSuccessMsg('Disposal confirmed successfully.')
            setSelectedRecord(null)
            setConfirmForm({ received_tonnage: '', processing_method: 'landfill', notes: '' })
            loadData()
        }
        setSubmitting(false)
    }

    const displayRecords = activeTab === 'pending' ? pendingRecords : confirmedRecords

    return (
        <DashboardLayout
            role="Facility Operator"
            userName={profile?.full_name || ''}
            navItems={FACILITY_NAV}
            primaryAction={{ label: 'Overview', href: '/dashboard/facility', icon: 'dashboard' }}
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
                            Disposal <span style={{ color: '#1b5e20' }}>Confirmations</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Confirm waste received at your facility
                        </p>
                    </div>
                    {pendingRecords.length > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                            style={{ background: '#f0f9ff', border: '1px solid rgba(3,105,161,0.15)' }}>
                            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#38bdf8' }} />
                            <span className="text-sm font-bold" style={{ color: '#0369a1', fontFamily: 'Manrope, sans-serif' }}>
                                {pendingRecords.length} awaiting confirmation
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

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 s2">
                        {[
                            { label: 'Pending', value: pendingRecords.length, color: '#0369a1', bg: '#f0f9ff', icon: 'pending' },
                            { label: 'Confirmed', value: confirmedRecords.filter(r => r.status === 'confirmed').length, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                            { label: 'Flagged', value: confirmedRecords.filter(r => r.status === 'flagged').length, color: '#ba1a1a', bg: '#fef2f2', icon: 'flag' },
                            { label: 'Total Received', value: `${[...pendingRecords, ...confirmedRecords].reduce((s, r) => s + (r.collected_tonnage || 0), 0).toFixed(1)}T`, color: '#00450d', bg: '#f0fdf4', icon: 'scale' },
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

                    {/* Tabs */}
                    <div className="flex items-center gap-2 mb-6 s3">
                        <button className={`tab-btn ${activeTab === 'pending' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('pending')}>
                            Pending ({pendingRecords.length})
                            {pendingRecords.length > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                                    style={{ background: activeTab === 'pending' ? 'rgba(255,255,255,0.2)' : '#f0f9ff', color: activeTab === 'pending' ? 'white' : '#0369a1' }}>
                                    Action needed
                                </span>
                            )}
                        </button>
                        <button className={`tab-btn ${activeTab === 'confirmed' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('confirmed')}>
                            Processed ({confirmedRecords.length})
                        </button>
                    </div>

                    {/* Records */}
                    <div className="bento-card s4">
                        {displayRecords.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>
                                        {activeTab === 'pending' ? 'check_circle' : 'delete_sweep'}
                                    </span>
                                </div>
                                <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>
                                    {activeTab === 'pending' ? 'No pending confirmations' : 'No processed records'}
                                </p>
                                <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                                    {activeTab === 'pending' ? 'All disposal records have been confirmed' : 'Confirmed records will appear here'}
                                </p>
                            </div>
                        ) : (
                            displayRecords.map(record => {
                                const ss = statusStyle(record.status)
                                const contractorName = record.contractor?.organisation_name || record.contractor?.full_name || 'Unknown'
                                return (
                                    <div key={record.id} className="record-row"
                                        onClick={() => {
                                            setSelectedRecord(record)
                                            setConfirmForm(f => ({ ...f, received_tonnage: record.collected_tonnage.toString() }))
                                        }}>
                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: ss.bg }}>
                                            <span className="material-symbols-outlined" style={{ color: ss.color, fontSize: '22px' }}>
                                                delete_sweep
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-bold" style={{ color: '#181c22' }}>
                                                    {record.facility_name}
                                                </p>
                                                <span className="status-badge" style={{ background: ss.bg, color: ss.color }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: ss.dot }} />
                                                    {ss.label}
                                                </span>
                                            </div>
                                            <p className="text-xs" style={{ color: '#717a6d' }}>
                                                {record.driver?.full_name || 'Unknown driver'} · {contractorName} · {record.waste_category} · {new Date(record.created_at).toLocaleDateString('en-GB')}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-sm font-bold" style={{ color: '#00450d' }}>
                                                {record.collected_tonnage}T
                                            </p>
                                            {activeTab === 'pending' && (
                                                <p className="text-xs font-bold mt-0.5" style={{ color: '#0369a1' }}>
                                                    Tap to confirm
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* Confirm Modal */}
                    {selectedRecord && selectedRecord.status === 'pending' && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            Confirm Disposal
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            {selectedRecord.facility_name} · {selectedRecord.waste_category}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedRecord(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                {/* Record summary */}
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[
                                        { label: 'Driver', value: selectedRecord.driver?.full_name || 'Unknown' },
                                        { label: 'Contractor', value: selectedRecord.contractor?.organisation_name || selectedRecord.contractor?.full_name || 'Unknown' },
                                        { label: 'Collected', value: `${selectedRecord.collected_tonnage}T` },
                                        { label: 'Ward', value: selectedRecord.ward || 'N/A' },
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

                                {errorMsg && (
                                    <div className="mb-4 p-3 rounded-xl flex items-center gap-2"
                                        style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '16px' }}>error</span>
                                        <p className="text-xs font-medium" style={{ color: '#ba1a1a' }}>{errorMsg}</p>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <label className="form-label">Received Tonnage *</label>
                                        <input type="number" step="0.1" className="form-input"
                                            placeholder={`Driver reported ${selectedRecord.collected_tonnage}T`}
                                            value={confirmForm.received_tonnage}
                                            onChange={e => setConfirmForm(f => ({ ...f, received_tonnage: e.target.value }))} />
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            If different from {selectedRecord.collected_tonnage}T, a discrepancy will be automatically flagged.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="form-label">Processing Method</label>
                                        <select className="form-input"
                                            value={confirmForm.processing_method}
                                            onChange={e => setConfirmForm(f => ({ ...f, processing_method: e.target.value }))}>
                                            {PROCESSING_METHODS.map(m => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Notes</label>
                                        <textarea className="form-input" rows={3}
                                            placeholder="Any notes about the received waste..."
                                            value={confirmForm.notes}
                                            onChange={e => setConfirmForm(f => ({ ...f, notes: e.target.value }))}
                                            style={{ resize: 'vertical' }} />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setSelectedRecord(null); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={confirmDisposal} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                                                Confirm Receipt
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