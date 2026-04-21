'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const RECYCLER_NAV = [
    { label: 'Home', href: '/dashboard/recycling-partner', icon: 'dashboard' },
    { label: 'New Intake', href: '/dashboard/recycling-partner/log', icon: 'add_circle' },
    { label: 'History', href: '/dashboard/recycling-partner/history', icon: 'history' },
    { label: 'Analytics', href: '/dashboard/recycling-partner/analytics', icon: 'bar_chart' },
    { label: 'Disposal', href: '/dashboard/recycling-partner/disposal', icon: 'delete_sweep' },
    { label: 'Profile', href: '/dashboard/recycling-partner/profile', icon: 'person' },
]

const PROCESSING_METHODS = [
    { value: 'baling', label: 'Baling' },
    { value: 'shredding', label: 'Shredding' },
    { value: 'granulating', label: 'Granulating' },
    { value: 'composting', label: 'Composting' },
    { value: 'landfill', label: 'Landfill' },
    { value: 'incineration', label: 'Incineration' },
    { value: 'sold', label: 'Sold to Buyer' },
    { value: 'other', label: 'Other' },
]

const OUTGOING_DESTINATIONS = [
    { value: 'karadiyana', label: 'Karadiyana Sanitary Landfill' },
    { value: 'kerawalapitiya', label: 'Kerawalapitiya Compost Plant' },
    { value: 'homagama', label: 'Homagama MRF' },
    { value: 'cmc_transfer', label: 'CMC Transfer Station' },
    { value: 'private_buyer', label: 'Private Buyer' },
    { value: 'export', label: 'Export' },
    { value: 'other', label: 'Other' },
]

function statusStyle(s: string) {
    switch (s) {
        case 'pending': return { bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8', label: 'Pending' }
        case 'processing': return { bg: '#fefce8', color: '#d97706', dot: '#f59e0b', label: 'Processing' }
        case 'completed': return { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a', label: 'Completed' }
        case 'cancelled': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Cancelled' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: s }
    }
}

function materialColor(mat: string) {
    const map: Record<string, { color: string; bg: string }> = {
        plastic: { color: '#1d4ed8', bg: '#eff6ff' },
        paper: { color: '#d97706', bg: '#fefce8' },
        glass: { color: '#0891b2', bg: '#ecfeff' },
        metal: { color: '#64748b', bg: '#f1f5f9' },
        'e-waste': { color: '#7c3aed', bg: '#f5f3ff' },
        organic: { color: '#15803d', bg: '#f0fdf4' },
        mixed: { color: '#9a3412', bg: '#fff7ed' },
    }
    return map[mat?.toLowerCase()] || { color: '#94a3b8', bg: '#f8fafc' }
}

const EMPTY_OUTGOING = {
    material_type: '', quantity: '', unit: 'kg',
    destination: '', destination_name: '', processing_method: '',
    vehicle_number: '', scheduled_date: '', notes: '',
}

export default function RecyclerDisposalPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming')

    // Incoming — processed waste_intake_logs
    const [incoming, setIncoming] = useState<any[]>([])
    const [filterIncoming, setFilterIncoming] = useState('all')
    const [showProcessForm, setShowProcessForm] = useState<string | null>(null)
    const [processMethod, setProcessMethod] = useState('')
    const [processNotes, setProcessNotes] = useState('')
    const [processSaving, setProcessSaving] = useState(false)

    // Outgoing — disposal_schedules where assigned_partner_id = me
    // + custom outgoing_disposals table if it exists, else we use disposal_schedules
    const [outgoing, setOutgoing] = useState<any[]>([])
    const [filterOutgoing, setFilterOutgoing] = useState('all')
    const [showOutgoingForm, setShowOutgoingForm] = useState(false)
    const [outgoingForm, setOutgoingForm] = useState(EMPTY_OUTGOING)
    const [outgoingSaving, setOutgoingSaving] = useState(false)

    const [message, setMessage] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Incoming: all accepted intake logs
        const { data: incomingData } = await supabase
            .from('waste_intake_logs')
            .select('*')
            .eq('operator_id', user.id)
            .eq('operator_type', 'recycling_partner')
            .eq('is_rejected', false)
            .order('received_at', { ascending: false })
        setIncoming(incomingData || [])

        // Outgoing: disposal_schedules assigned to this partner
        const { data: outgoingData } = await supabase
            .from('disposal_schedules')
            .select('*')
            .eq('assigned_partner_id', user.id)
            .order('scheduled_date', { ascending: false })
        setOutgoing(outgoingData || [])

        setLoading(false)
    }

    async function saveProcessingMethod(intakeId: string) {
        if (!processMethod) return
        setProcessSaving(true)
        const supabase = createClient()
        await supabase.from('waste_intake_logs').update({
            processing_method: processMethod,
            notes: processNotes || null,
        }).eq('id', intakeId)
        setShowProcessForm(null); setProcessMethod(''); setProcessNotes('')
        await loadData()
        setProcessSaving(false)
    }

    async function submitOutgoing() {
        if (!outgoingForm.material_type || !outgoingForm.quantity || !outgoingForm.destination || !outgoingForm.scheduled_date) {
            setMessage('Please fill in material, quantity, destination and date.'); return
        }
        setOutgoingSaving(true); setMessage('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const destLabel = OUTGOING_DESTINATIONS.find(d => d.value === outgoingForm.destination)?.label || outgoingForm.destination

        const { error } = await supabase.from('disposal_schedules').insert({
            district: profile?.district,
            created_by: user?.id,
            assigned_partner_id: user?.id,
            waste_type: outgoingForm.material_type,
            facility_name: outgoingForm.destination_name || destLabel,
            facility_type: 'recycling',
            scheduled_date: outgoingForm.scheduled_date,
            vehicle_number: outgoingForm.vehicle_number || null,
            estimated_quantity: `${outgoingForm.quantity} ${outgoingForm.unit}`,
            notes: outgoingForm.notes || null,
            status: 'published',
            published: true,
        })

        if (error) { setMessage('Error: ' + error.message) }
        else { setMessage('Outgoing disposal logged successfully.'); setShowOutgoingForm(false); setOutgoingForm(EMPTY_OUTGOING); await loadData() }
        setOutgoingSaving(false)
    }

    // Derived
    const filteredIncoming = filterIncoming === 'all' ? incoming
        : filterIncoming === 'processed' ? incoming.filter(i => i.processing_method)
            : incoming.filter(i => !i.processing_method)

    const filteredOutgoing = filterOutgoing === 'all' ? outgoing
        : outgoing.filter(o => o.status === filterOutgoing)

    const stats = {
        totalReceived: incoming.length,
        totalProcessed: incoming.filter(i => i.processing_method).length,
        pendingProcess: incoming.filter(i => !i.processing_method).length,
        outgoingCount: outgoing.length,
        totalWeight: incoming.reduce((s, i) => s + (i.actual_quantity || 0), 0),
    }

    return (
        <DashboardLayout role="Recycling Partner" userName={profile?.full_name || ''} navItems={RECYCLER_NAV}
            primaryAction={{ label: 'New Intake', href: '/dashboard/recycling-partner/log', icon: 'add_circle' }}>
            <style>{`
        .msf      { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msf-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card     { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
        .form-field   { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; color:#181c22; background:#fafafa; outline:none; box-sizing:border-box; transition:all 0.2s; }
        .form-field:focus   { border-color:#15803d; box-shadow:0 0 0 3px rgba(21,128,61,0.08); background:white; }
        .select-field { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; color:#181c22; background:#fafafa; outline:none; cursor:pointer; appearance:none; box-sizing:border-box; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23717a6d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; background-size:14px; padding-right:36px; transition:all 0.2s; }
        .select-field:focus { border-color:#15803d; box-shadow:0 0 0 3px rgba(21,128,61,0.08); }
        .field-label  { display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#6b7280; font-family:'Manrope',sans-serif; margin-bottom:6px; }
        .tab-btn  { padding:9px 18px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px; white-space:nowrap; }
        .tab-btn.on  { background:#15803d; color:white; }
        .tab-btn.off { background:transparent; color:#64748b; }
        .tab-btn.off:hover { background:#f1f5f9; }
        .pill-btn { padding:5px 13px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .pill-btn.on  { background:#15803d; color:white; }
        .pill-btn.off { background:#f1f5f9; color:#64748b; }
        .pill-btn.off:hover { background:#e2e8f0; }
        .row  { padding:15px 20px; border-bottom:1px solid rgba(0,69,13,0.05); display:flex; align-items:flex-start; gap:13px; transition:background 0.15s; }
        .row:hover { background:#f9fdf9; }
        .row:last-child { border-bottom:none; }
        .badge { display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .btn-save { display:flex; align-items:center; gap:7px; padding:10px 20px; border-radius:10px; background:#15803d; color:white; border:none; cursor:pointer; font-family:'Manrope',sans-serif; font-weight:700; font-size:13px; transition:all 0.2s; }
        .btn-save:hover    { background:#166534; }
        .btn-save:disabled { opacity:0.6; cursor:not-allowed; }
        .btn-outline { display:flex; align-items:center; gap:7px; padding:10px 16px; border-radius:10px; background:white; color:#15803d; border:1.5px solid rgba(21,128,61,0.2); cursor:pointer; font-family:'Manrope',sans-serif; font-weight:700; font-size:13px; transition:all 0.2s; }
        .btn-outline:hover { background:#f0fdf4; }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .1s both} .a3{animation:fadeUp .4s ease .16s both}
        .slide-down { animation:slideDown .2s ease both; }
      `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>
                    Recycling Partner
                </p>
                <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 40, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: 0 }}>
                    Waste <span style={{ color: '#15803d' }}>Disposal</span>
                </h1>
            </div>

            {/* Stats */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'Total Received', value: stats.totalReceived, icon: 'download', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Processed', value: stats.totalProcessed, icon: 'recycling', color: '#15803d', bg: '#f0fdf4' },
                    { label: 'Pending Process', value: stats.pendingProcess, icon: 'pending', color: '#d97706', bg: '#fefce8' },
                    { label: 'Outgoing', value: stats.outgoingCount, icon: 'upload', color: '#7c3aed', bg: '#f5f3ff' },
                    { label: 'Total Weight', value: `${stats.totalWeight.toFixed(0)}kg`, icon: 'scale', color: '#64748b', bg: '#f8fafc' },
                ].map(m => (
                    <div key={m.label} className="card" style={{ padding: '16px 18px' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                            <span className="msf-fill" style={{ color: m.color, fontSize: 16 }}>{m.icon}</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 22, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="a3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 99 }}>
                    {([
                        { key: 'incoming', label: 'Incoming Processed', icon: 'download', count: incoming.length },
                        { key: 'outgoing', label: 'Outgoing Disposal', icon: 'upload', count: outgoing.length },
                    ] as const).map(t => (
                        <button key={t.key} onClick={() => setActiveTab(t.key)} className={`tab-btn ${activeTab === t.key ? 'on' : 'off'}`}>
                            <span className="msf" style={{ fontSize: 14 }}>{t.icon}</span>
                            {t.label}
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: activeTab === t.key ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.07)', color: activeTab === t.key ? 'white' : '#64748b' }}>{t.count}</span>
                        </button>
                    ))}
                </div>
                {activeTab === 'outgoing' && (
                    <button onClick={() => { setShowOutgoingForm(!showOutgoingForm); setMessage('') }}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, background: showOutgoingForm ? '#f1f5f9' : '#15803d', color: showOutgoingForm ? '#64748b' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 13, transition: 'all 0.2s' }}>
                        <span className="msf" style={{ fontSize: 16 }}>{showOutgoingForm ? 'close' : 'add'}</span>
                        {showOutgoingForm ? 'Cancel' : 'Log Outgoing'}
                    </button>
                )}
            </div>

            {/* Message */}
            {message && (
                <div className="slide-down" style={{ marginBottom: 16, padding: '11px 16px', borderRadius: 10, background: message.startsWith('Error') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${message.startsWith('Error') ? 'rgba(186,26,26,0.2)' : 'rgba(0,69,13,0.15)'}`, color: message.startsWith('Error') ? '#ba1a1a' : '#00450d', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="msf-fill" style={{ fontSize: 15 }}>{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
                    {message}
                    <button onClick={() => setMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.5 }}>
                        <span className="msf" style={{ fontSize: 14 }}>close</span>
                    </button>
                </div>
            )}

            {/* ── INCOMING TAB ── */}
            {activeTab === 'incoming' && (
                <div>
                    <div className="card">
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>Received Waste — Processing Status</h3>
                            <div style={{ display: 'flex', gap: 5 }}>
                                {['all', 'processed', 'pending'].map(f => (
                                    <button key={f} onClick={() => setFilterIncoming(f)} className={`pill-btn ${filterIncoming === f ? 'on' : 'off'}`}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
                                <div style={{ width: 24, height: 24, border: '2px solid #15803d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                            </div>
                        ) : filteredIncoming.length === 0 ? (
                            <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                                <span className="msf" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 10 }}>recycling</span>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', marginBottom: 4 }}>No records found</p>
                                <p style={{ fontSize: 12, color: '#94a3b8' }}>Accepted intakes will appear here</p>
                            </div>
                        ) : filteredIncoming.map(intake => {
                            const mc = materialColor(intake.material_type)
                            const isOpen = showProcessForm === intake.id
                            const hasMethod = !!intake.processing_method

                            return (
                                <div key={intake.id}>
                                    <div className="row">
                                        <div style={{ width: 40, height: 40, borderRadius: 11, background: mc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="msf" style={{ fontSize: 19, color: mc.color }}>recycling</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', textTransform: 'capitalize' }}>{intake.material_type || 'Unknown material'}</span>
                                                {hasMethod ? (
                                                    <span className="badge" style={{ background: '#f0fdf4', color: '#15803d' }}>
                                                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                                                        Processed
                                                    </span>
                                                ) : (
                                                    <span className="badge" style={{ background: '#fefce8', color: '#d97706' }}>
                                                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                                                        Pending
                                                    </span>
                                                )}
                                                {intake.tx_hash && <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed' }}>on-chain</span>}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: '#717a6d' }}>
                                                <span>{intake.actual_quantity} {intake.unit}</span>
                                                <span>{intake.vehicle_number || '—'}</span>
                                                {hasMethod && <span style={{ color: '#15803d', fontWeight: 600, textTransform: 'capitalize' }}>{intake.processing_method}</span>}
                                                <span>{new Date(intake.received_at || intake.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        </div>
                                        <div style={{ flexShrink: 0 }}>
                                            {!hasMethod ? (
                                                <button onClick={() => { setShowProcessForm(isOpen ? null : intake.id); setProcessMethod(''); setProcessNotes('') }}
                                                    style={{ padding: '5px 12px', borderRadius: 8, background: isOpen ? '#f1f5f9' : '#f0fdf4', color: isOpen ? '#64748b' : '#15803d', border: `1px solid ${isOpen ? '#e5e7eb' : 'rgba(21,128,61,0.2)'}`, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <span className="msf" style={{ fontSize: 13 }}>{isOpen ? 'close' : 'edit'}</span>
                                                    {isOpen ? 'Cancel' : 'Log Method'}
                                                </button>
                                            ) : (
                                                <button onClick={() => { setShowProcessForm(isOpen ? null : intake.id); setProcessMethod(intake.processing_method); setProcessNotes(intake.notes || '') }}
                                                    style={{ padding: '5px 10px', borderRadius: 8, background: '#f8fafc', color: '#64748b', border: '1px solid #e5e7eb', fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <span className="msf" style={{ fontSize: 12 }}>edit</span>Edit
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Inline processing form */}
                                    {isOpen && (
                                        <div className="slide-down" style={{ padding: '16px 20px', background: '#f9fdf9', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                                            <div style={{ flex: '1 1 200px' }}>
                                                <label className="field-label">Processing Method *</label>
                                                <select className="select-field" value={processMethod} onChange={e => setProcessMethod(e.target.value)}>
                                                    <option value="">Select method</option>
                                                    {PROCESSING_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ flex: '2 1 260px' }}>
                                                <label className="field-label">Notes</label>
                                                <input type="text" className="form-field" placeholder="Optional notes about processing..."
                                                    value={processNotes} onChange={e => setProcessNotes(e.target.value)} />
                                            </div>
                                            <button onClick={() => saveProcessingMethod(intake.id)} disabled={processSaving || !processMethod} className="btn-save">
                                                {processSaving ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> : <span className="msf" style={{ fontSize: 15 }}>save</span>}
                                                Save
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── OUTGOING TAB ── */}
            {activeTab === 'outgoing' && (
                <div>
                    {/* New outgoing form */}
                    {showOutgoingForm && (
                        <div className="card slide-down" style={{ marginBottom: 20 }}>
                            <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(0,69,13,0.06)', background: '#15803d', borderRadius: '20px 20px 0 0' }}>
                                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: 'white', margin: '0 0 2px' }}>Log Outgoing Disposal</h3>
                                <p style={{ fontSize: 11, color: 'rgba(163,246,156,0.7)', margin: 0 }}>Record waste being sent from your facility for further disposal or sale</p>
                            </div>
                            <div style={{ padding: 22 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <label className="field-label">Material Type *</label>
                                        <select className="select-field" value={outgoingForm.material_type} onChange={e => setOutgoingForm(f => ({ ...f, material_type: e.target.value }))}>
                                            <option value="">Select material</option>
                                            {['Plastic', 'Paper', 'Glass', 'Metal', 'E-Waste', 'Organic', 'Mixed', 'Other'].map(m => <option key={m} value={m.toLowerCase()}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                                        <div>
                                            <label className="field-label">Quantity *</label>
                                            <input type="number" min="0" step="0.1" className="form-field" placeholder="e.g. 500"
                                                value={outgoingForm.quantity} onChange={e => setOutgoingForm(f => ({ ...f, quantity: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="field-label">Unit</label>
                                            <select className="select-field" value={outgoingForm.unit} onChange={e => setOutgoingForm(f => ({ ...f, unit: e.target.value }))}>
                                                {['kg', 'tonnes', 'bags'].map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="field-label">Destination *</label>
                                        <select className="select-field" value={outgoingForm.destination} onChange={e => setOutgoingForm(f => ({ ...f, destination: e.target.value }))}>
                                            <option value="">Select destination</option>
                                            {OUTGOING_DESTINATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="field-label">Processing Method</label>
                                        <select className="select-field" value={outgoingForm.processing_method} onChange={e => setOutgoingForm(f => ({ ...f, processing_method: e.target.value }))}>
                                            <option value="">Select method</option>
                                            {PROCESSING_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="field-label">Scheduled Date *</label>
                                        <input type="date" className="form-field" min={new Date().toISOString().split('T')[0]}
                                            value={outgoingForm.scheduled_date} onChange={e => setOutgoingForm(f => ({ ...f, scheduled_date: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="field-label">Vehicle Number</label>
                                        <input type="text" className="form-field" placeholder="e.g. WP CAB 1234"
                                            value={outgoingForm.vehicle_number} onChange={e => setOutgoingForm(f => ({ ...f, vehicle_number: e.target.value }))} />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label className="field-label">Notes</label>
                                        <textarea className="form-field" rows={2} style={{ resize: 'vertical' }} placeholder="Additional details..."
                                            value={outgoingForm.notes} onChange={e => setOutgoingForm(f => ({ ...f, notes: e.target.value }))} />
                                    </div>
                                </div>
                                <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
                                    <button onClick={submitOutgoing} disabled={outgoingSaving} className="btn-save">
                                        {outgoingSaving
                                            ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Saving…</>
                                            : <><span className="msf" style={{ fontSize: 15 }}>upload</span>Log Outgoing Disposal</>}
                                    </button>
                                    <button onClick={() => { setShowOutgoingForm(false); setOutgoingForm(EMPTY_OUTGOING) }} className="btn-outline">
                                        <span className="msf" style={{ fontSize: 14 }}>close</span>Discard
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Outgoing list */}
                    <div className="card">
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>Outgoing Disposal Records</h3>
                            <div style={{ display: 'flex', gap: 5 }}>
                                {['all', 'published', 'in_transit', 'completed', 'cancelled'].map(f => (
                                    <button key={f} onClick={() => setFilterOutgoing(f)} className={`pill-btn ${filterOutgoing === f ? 'on' : 'off'}`}>
                                        {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
                                <div style={{ width: 24, height: 24, border: '2px solid #15803d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                            </div>
                        ) : filteredOutgoing.length === 0 ? (
                            <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                                <span className="msf" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 10 }}>upload</span>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', marginBottom: 4 }}>No outgoing records yet</p>
                                <p style={{ fontSize: 12, color: '#94a3b8' }}>Use the button above to log outgoing waste</p>
                            </div>
                        ) : filteredOutgoing.map(record => {
                            const ss = statusStyle(record.status)
                            const wt = OUTGOING_DESTINATIONS.find(d => d.label === record.facility_name) || null
                            return (
                                <div key={record.id} className="row">
                                    <div style={{ width: 40, height: 40, borderRadius: 11, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="msf" style={{ fontSize: 19, color: '#15803d' }}>upload</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', textTransform: 'capitalize' }}>{record.waste_type}</span>
                                            <span className="badge" style={{ background: ss.bg, color: ss.color }}>
                                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: ss.dot, display: 'inline-block' }} />
                                                {ss.label}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: '#717a6d' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 12 }}>business</span>{record.facility_name}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 12 }}>event</span>{new Date(record.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                            {record.vehicle_number && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 12 }}>local_shipping</span>{record.vehicle_number}</span>}
                                            {record.estimated_quantity && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 12 }}>scale</span>{record.estimated_quantity}</span>}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}