'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const FACILITY_NAV = [
    { label: 'Home', href: '/dashboard/facility', icon: 'dashboard' },
    { label: 'New Intake', href: '/dashboard/facility/log', icon: 'add_circle' },
    { label: 'History', href: '/dashboard/facility/history', icon: 'history' },
    { label: 'Analytics', href: '/dashboard/facility/analytics', icon: 'bar_chart' },
    { label: 'Disposal', href: '/dashboard/facility/disposal', icon: 'delete_sweep' },
    { label: 'Profile', href: '/dashboard/facility/profile', icon: 'person' },
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
        received_tonnage: '', processing_method: 'landfill', notes: '',
    })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: allRecords } = await supabase
            .from('disposal_records').select('*').order('created_at', { ascending: false })

        if (allRecords && allRecords.length > 0) {
            const driverIds = [...new Set(allRecords.map(r => r.driver_id).filter(Boolean))]
            const contractorIds = [...new Set(allRecords.map(r => r.contractor_id).filter(Boolean))]
            const { data: driverProfiles } = await supabase.from('profiles').select('id, full_name').in('id', driverIds)
            const { data: contractorProfiles } = await supabase.from('profiles').select('id, full_name, organisation_name').in('id', contractorIds)

            const enriched = allRecords.map(r => ({
                ...r,
                driver: driverProfiles?.find((p: any) => p.id === r.driver_id) || null,
                contractor: contractorProfiles?.find((p: any) => p.id === r.contractor_id) || null,
            }))
            setPendingRecords(enriched.filter(r => r.status === 'pending'))
            setConfirmedRecords(enriched.filter(r => ['confirmed', 'flagged'].includes(r.status)))
        } else {
            setPendingRecords([]); setConfirmedRecords([])
        }
        setLoading(false)
    }

    async function confirmDisposal() {
        if (!selectedRecord || !confirmForm.received_tonnage) { setErrorMsg('Received tonnage is required.'); return }
        setSubmitting(true); setErrorMsg('')
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
            primaryAction={{ label: 'New Intake', href: '/dashboard/facility/log', icon: 'add_circle' }}
        >
            <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
        .status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .tab-btn { padding:10px 20px; border-radius:10px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:none; transition:all 0.2s; }
        .tab-active   { background:#0369a1; color:white; }
        .tab-inactive { background:transparent; color:#717a6d; }
        .tab-inactive:hover { background:#f0f9ff; color:#0369a1; }
        .record-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .record-row:hover { background:#f9fafb; }
        .record-row:last-child { border-bottom:none; }
        .form-input { width:100%; padding:10px 14px; border-radius:10px; border:1.5px solid rgba(3,105,161,0.15); font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:white; color:#181c22; box-sizing:border-box; }
        .form-input:focus { border-color:#0369a1; box-shadow:0 0 0 3px rgba(3,105,161,0.08); }
        .form-label { font-size:12px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.05em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#0369a1; color:white; border:none; padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-primary:hover { background:#0284c7; box-shadow:0 4px 12px rgba(3,105,161,0.25); }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { background:white; color:#0369a1; border:1.5px solid rgba(3,105,161,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0f9ff; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both}
        .a3{animation:fadeUp .4s ease .14s both} .a4{animation:fadeUp .4s ease .19s both}
        .live{animation:pulse 2s ease-in-out infinite}
      `}</style>

            {/* ── Greeting header ── */}
            <div className="a1" style={{ marginBottom: 32 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>
                    Facility Operator · Disposal
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
                            Disposal <span style={{ color: '#0369a1' }}>Confirmations</span>
                        </h1>
                        <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>
                            Review and confirm waste received at your facility
                        </p>
                    </div>
                    {pendingRecords.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 99, background: '#f0f9ff', border: '1px solid rgba(3,105,161,0.2)' }}>
                            <div className="live" style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8' }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', fontFamily: 'Manrope,sans-serif' }}>
                                {pendingRecords.length} awaiting confirmation
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: 28, height: 28, border: '2px solid #0369a1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* Success toast */}
                    {successMsg && (
                        <div className="a1" style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 14, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="msf" style={{ color: '#00450d', fontSize: 20 }}>check_circle</span>
                            <p style={{ fontSize: 14, fontWeight: 500, color: '#00450d', margin: 0, flex: 1 }}>{successMsg}</p>
                            <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                                <span className="msf" style={{ fontSize: 18, color: '#00450d' }}>close</span>
                            </button>
                        </div>
                    )}

                    {/* Stats strip */}
                    <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
                        {[
                            { label: 'Pending', value: pendingRecords.length, color: '#0369a1', bg: '#f0f9ff', icon: 'pending' },
                            { label: 'Confirmed', value: confirmedRecords.filter(r => r.status === 'confirmed').length, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                            { label: 'Flagged', value: confirmedRecords.filter(r => r.status === 'flagged').length, color: '#ba1a1a', bg: '#fef2f2', icon: 'flag' },
                            { label: 'Total Received', value: `${[...pendingRecords, ...confirmedRecords].reduce((s, r) => s + (r.collected_tonnage || 0), 0).toFixed(1)}T`, color: '#7c3aed', bg: '#faf5ff', icon: 'scale' },
                        ].map(s => (
                            <div key={s.label} className="card" style={{ padding: '20px 22px' }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                    <span className="msf" style={{ color: s.color, fontSize: 20 }}>{s.icon}</span>
                                </div>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 28, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{s.value}</p>
                                <p style={{ fontSize: 12, fontWeight: 600, color: '#41493e', margin: '0 0 2px', fontFamily: 'Manrope,sans-serif' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="a3" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, background: '#f4f6f3', borderRadius: 14, padding: 6, width: 'fit-content' }}>
                        <button className={`tab-btn ${activeTab === 'pending' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('pending')}>
                            Pending ({pendingRecords.length})
                            {pendingRecords.length > 0 && (
                                <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: activeTab === 'pending' ? 'rgba(255,255,255,0.2)' : '#f0f9ff', color: activeTab === 'pending' ? 'white' : '#0369a1' }}>
                                    Action needed
                                </span>
                            )}
                        </button>
                        <button className={`tab-btn ${activeTab === 'confirmed' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('confirmed')}>
                            Processed ({confirmedRecords.length})
                        </button>
                    </div>

                    {/* Records list */}
                    <div className="a4 card">
                        {displayRecords.length === 0 ? (
                            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                                <div style={{ width: 64, height: 64, borderRadius: 20, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <span className="msf" style={{ color: '#0369a1', fontSize: 32 }}>
                                        {activeTab === 'pending' ? 'check_circle' : 'delete_sweep'}
                                    </span>
                                </div>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', marginBottom: 4 }}>
                                    {activeTab === 'pending' ? 'No pending confirmations' : 'No processed records'}
                                </p>
                                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                                    {activeTab === 'pending' ? 'All disposal records have been confirmed' : 'Confirmed records will appear here'}
                                </p>
                            </div>
                        ) : displayRecords.map(record => {
                            const ss = statusStyle(record.status)
                            const contractorName = record.contractor?.organisation_name || record.contractor?.full_name || 'Unknown'
                            return (
                                <div key={record.id} className="record-row"
                                    onClick={() => { setSelectedRecord(record); setConfirmForm(f => ({ ...f, received_tonnage: record.collected_tonnage.toString() })) }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: ss.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="msf" style={{ color: ss.color, fontSize: 22 }}>delete_sweep</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <p style={{ fontSize: 14, fontWeight: 700, color: '#181c22', margin: 0, fontFamily: 'Manrope,sans-serif' }}>{record.facility_name}</p>
                                            <span className="status-badge" style={{ background: ss.bg, color: ss.color }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot, display: 'inline-block' }} />
                                                {ss.label}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>
                                            {record.driver?.full_name || 'Unknown driver'} · {contractorName} · {record.waste_category} · {new Date(record.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ fontSize: 15, fontWeight: 700, color: ss.color, fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>{record.collected_tonnage}T</p>
                                        {activeTab === 'pending' && (
                                            <p style={{ fontSize: 11, fontWeight: 600, color: '#0369a1', margin: 0 }}>Tap to confirm</p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Confirm modal */}
                    {selectedRecord && selectedRecord.status === 'pending' && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div style={{ width: '100%', maxWidth: 520, background: 'white', borderRadius: 20, padding: 32, boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>

                                {/* Modal header */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span className="msf" style={{ color: '#0369a1', fontSize: 22 }}>fact_check</span>
                                            </div>
                                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 20, color: '#181c22', margin: 0 }}>Confirm Disposal</h3>
                                        </div>
                                        <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>{selectedRecord.facility_name} · {selectedRecord.waste_category}</p>
                                    </div>
                                    <button onClick={() => setSelectedRecord(null)} style={{ background: '#f8fafc', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
                                        <span className="msf" style={{ color: '#64748b', fontSize: 20 }}>close</span>
                                    </button>
                                </div>

                                {/* Record summary */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                                    {[
                                        { label: 'Driver', value: selectedRecord.driver?.full_name || 'Unknown' },
                                        { label: 'Contractor', value: selectedRecord.contractor?.organisation_name || selectedRecord.contractor?.full_name || 'Unknown' },
                                        { label: 'Collected', value: `${selectedRecord.collected_tonnage}T` },
                                        { label: 'Ward', value: selectedRecord.ward || 'N/A' },
                                    ].map(item => (
                                        <div key={item.label} style={{ padding: '12px 14px', borderRadius: 12, background: '#f8fafc' }}>
                                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: '0 0 3px' }}>{item.label}</p>
                                            <p style={{ fontSize: 14, fontWeight: 600, color: '#181c22', margin: 0 }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {errorMsg && (
                                    <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="msf" style={{ color: '#ba1a1a', fontSize: 16 }}>error</span>
                                        <p style={{ fontSize: 13, color: '#ba1a1a', margin: 0 }}>{errorMsg}</p>
                                    </div>
                                )}

                                {/* Form */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                                    <div>
                                        <label className="form-label">Received Tonnage *</label>
                                        <input type="number" step="0.1" className="form-input"
                                            placeholder={`Driver reported ${selectedRecord.collected_tonnage}T`}
                                            value={confirmForm.received_tonnage}
                                            onChange={e => setConfirmForm(f => ({ ...f, received_tonnage: e.target.value }))} />
                                        <p style={{ fontSize: 11, color: '#717a6d', marginTop: 4 }}>
                                            If different from {selectedRecord.collected_tonnage}T, a discrepancy will be automatically flagged.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="form-label">Processing Method</label>
                                        <select className="form-input" value={confirmForm.processing_method}
                                            onChange={e => setConfirmForm(f => ({ ...f, processing_method: e.target.value }))}>
                                            {PROCESSING_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Notes</label>
                                        <textarea className="form-input" rows={3} placeholder="Any notes about the received waste..."
                                            value={confirmForm.notes}
                                            onChange={e => setConfirmForm(f => ({ ...f, notes: e.target.value }))}
                                            style={{ resize: 'vertical' }} />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 12 }}>
                                    <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
                                        onClick={() => { setSelectedRecord(null); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                                        onClick={confirmDisposal} disabled={submitting}>
                                        {submitting ? (
                                            <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                                        ) : (
                                            <><span className="msf" style={{ fontSize: 16 }}>check</span>Confirm Receipt</>
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