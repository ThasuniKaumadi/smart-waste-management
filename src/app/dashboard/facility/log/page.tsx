'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { logDeliveryOnChain } from '@/lib/blockchain'

const FACILITY_NAV = [
    { label: 'Home', href: '/dashboard/facility', icon: 'dashboard' },
    { label: 'New Intake', href: '/dashboard/facility/log', icon: 'add_circle' },
    { label: 'History', href: '/dashboard/facility/history', icon: 'history' },
    { label: 'Analytics', href: '/dashboard/facility/analytics', icon: 'bar_chart' },
    { label: 'Disposal', href: '/dashboard/facility/disposal', icon: 'delete_sweep' },
    { label: 'Profile', href: '/dashboard/facility/profile', icon: 'person' },
]

const REJECTION_REASONS = [
    { value: 'mixed_waste', label: 'Mixed / Unsegregated waste' },
    { value: 'wrong_type', label: 'Wrong waste type for this facility' },
    { value: 'contaminated', label: 'Contaminated waste' },
    { value: 'overweight', label: 'Exceeds facility capacity' },
    { value: 'hazardous', label: 'Contains hazardous materials' },
    { value: 'other', label: 'Other reason' },
]

const PROCESSING_METHODS = [
    'Landfill', 'Composting', 'Incineration',
    'Anaerobic Digestion', 'Recycling', 'Other',
]

const WASTE_CONDITIONS = [
    { value: 'segregated', label: '✅ Well Segregated' },
    { value: 'mixed', label: '⚠️ Mixed / Partially Segregated' },
    { value: 'contaminated', label: '❌ Contaminated' },
]

const UNITS = ['kg', 'tonnes', 'bags', 'cubic_meters']

interface FormData {
    actual_quantity: string; unit: string; material_type: string; grade: string
    processing_method: string; condition: string; notes: string
    is_rejected: boolean; rejection_reason: string; rejection_notes: string
}

function FacilityLogPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const handoffCodeFromUrl = searchParams.get('handoff')

    const [profile, setProfile] = useState<any>(null)
    const [rates, setRates] = useState<any[]>([])
    const [handoff, setHandoff] = useState<any>(null)
    const [totalStops, setTotalStops] = useState(0)
    const [completedStops, setCompletedStops] = useState(0)
    const [loadingHandoff, setLoadingHandoff] = useState(false)
    const [showCodeEntry, setShowCodeEntry] = useState(false)
    const [code, setCode] = useState(['', '', '', '', '', ''])
    const [verifying, setVerifying] = useState(false)
    const [codeError, setCodeError] = useState('')
    const [formData, setFormData] = useState<FormData>({
        actual_quantity: '', unit: 'kg', material_type: '', grade: '',
        processing_method: '', condition: '', notes: '',
        is_rejected: false, rejection_reason: '', rejection_notes: '',
    })
    const [submitting, setSubmitting] = useState(false)
    const [blockchainPending, setBlockchainPending] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [completedIntake, setCompletedIntake] = useState<any>(null)
    const [step, setStep] = useState<'form' | 'success'>('form')

    useEffect(() => { loadProfile() }, [])
    useEffect(() => {
        if (handoffCodeFromUrl && handoffCodeFromUrl.length === 6) autoVerifyCode(handoffCodeFromUrl)
    }, [handoffCodeFromUrl])

    async function loadProfile() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data: ratesData } = await supabase.from('recycler_rates').select('*')
        setRates(ratesData || [])
    }

    async function autoVerifyCode(handoffCode: string) {
        setLoadingHandoff(true)
        try {
            const res = await fetch('/api/handoff/verify', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: handoffCode }),
            })
            const data = await res.json()
            if (!res.ok) {
                const supabase = createClient()
                const { data: h } = await supabase
                    .from('route_handoffs')
                    .select(`*, route:route_id(id,route_name,district,vehicle_number,date,waste_type), driver:driver_id(full_name,phone)`)
                    .eq('handoff_code', handoffCode).single()
                if (h) {
                    setHandoff(h)
                    const { count: total } = await supabase.from('collection_stops').select('*', { count: 'exact', head: true }).eq('route_id', h.route_id)
                    const { count: completed } = await supabase.from('collection_stops').select('*', { count: 'exact', head: true }).eq('route_id', h.route_id).eq('status', 'completed')
                    setTotalStops(total || 0); setCompletedStops(completed || 0)
                }
            } else {
                setHandoff(data.handoff); setTotalStops(data.totalStops); setCompletedStops(data.completedStops)
            }
        } catch (err) { console.error('Auto-verify failed:', err) }
        setLoadingHandoff(false)
    }

    function handleCodeInput(index: number, value: string) {
        if (!/^\d*$/.test(value)) return
        const newCode = [...code]; newCode[index] = value.slice(-1); setCode(newCode)
        if (value && index < 5) document.getElementById(`code-${index + 1}`)?.focus()
    }

    function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
        if (e.key === 'Backspace' && !code[index] && index > 0) document.getElementById(`code-${index - 1}`)?.focus()
    }

    async function verifyCode() {
        const fullCode = code.join('')
        if (fullCode.length !== 6) { setCodeError('Please enter all 6 digits'); return }
        setVerifying(true); setCodeError('')
        try {
            const res = await fetch('/api/handoff/verify', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: fullCode }),
            })
            const data = await res.json()
            if (!res.ok) { setCodeError(data.error); setVerifying(false); return }
            setHandoff(data.handoff); setTotalStops(data.totalStops); setCompletedStops(data.completedStops)
            setShowCodeEntry(false)
        } catch { setCodeError('Something went wrong. Please try again.') }
        setVerifying(false)
    }

    function getRateForMaterial(materialType: string) {
        return rates.find(r => r.material_type === materialType.toLowerCase())?.rate_per_kg || 0
    }

    async function handleSubmit() {
        if (!formData.actual_quantity && !formData.is_rejected) { setSubmitError('Please enter the actual quantity received'); return }
        if (!formData.condition && !formData.is_rejected) { setSubmitError('Please select the waste condition'); return }
        if (!formData.processing_method && !formData.is_rejected) { setSubmitError('Please select the processing method'); return }
        if (formData.is_rejected && !formData.rejection_reason) { setSubmitError('Please select a rejection reason'); return }
        setSubmitting(true); setSubmitError('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        try {
            const res = await fetch('/api/intake/create', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    handoff_id: handoff.id,
                    operator_id: user?.id,
                    operator_type: 'facility_operator',
                    route_id: handoff.route_id,
                    driver_id: handoff.driver_id,
                    date_dispatched: handoff.route?.date,
                    time_dispatched: new Date().toTimeString().slice(0, 5),
                    vehicle_number: handoff.route?.vehicle_number,
                    disposal_location: profile?.organisation_name || profile?.full_name,
                    waste_type: handoff.route?.waste_type || handoff.waste_type,
                    material_type: formData.material_type,
                    grade: formData.grade || null,
                    actual_quantity: parseFloat(formData.actual_quantity) || 0,
                    unit: formData.unit,
                    processing_method: formData.processing_method,
                    condition: formData.condition,
                    is_rejected: formData.is_rejected,
                    rejection_reason: formData.rejection_reason,
                    rejection_notes: formData.rejection_notes,
                    rate_per_unit: null,
                    notes: formData.notes,
                }),
            })
            const data = await res.json()
            if (!res.ok) { setSubmitError(data.error); setSubmitting(false); return }
            const savedIntake = data.intake
            setSubmitting(false)
            if (!formData.is_rejected) {
                setBlockchainPending(true)
                try {
                    const txHash = await logDeliveryOnChain(savedIntake.id, formData.material_type || handoff.route?.waste_type || 'general')
                    if (txHash) {
                        await supabase.from('waste_intake_logs').update({ tx_hash: txHash }).eq('id', savedIntake.id)
                        savedIntake.tx_hash = txHash
                    }
                } catch (e) { console.error('Blockchain logging failed (non-fatal):', e) }
                setBlockchainPending(false)
            }
            setCompletedIntake(savedIntake); setStep('success')
        } catch { setSubmitError('Something went wrong. Please try again.'); setSubmitting(false) }
    }

    return (
        <DashboardLayout role="Facility Operator" userName={profile?.full_name || ''} navItems={FACILITY_NAV}>
            <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .form-field { width:100%; padding:12px 16px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafafa; transition:all 0.2s; outline:none; }
        .form-field:focus { border-color:#0369a1; background:white; box-shadow:0 0 0 3px rgba(3,105,161,0.08); }
        .select-field { width:100%; padding:12px 16px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafafa; transition:all 0.2s; outline:none; appearance:none; cursor:pointer; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23717a6d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; background-size:16px; }
        .select-field:focus { border-color:#0369a1; background-color:white; box-shadow:0 0 0 3px rgba(3,105,161,0.08); }
        .condition-card { border:2px solid #e5e7eb; border-radius:12px; padding:14px 16px; cursor:pointer; transition:all 0.2s; font-size:14px; font-family:'Inter',sans-serif; }
        .condition-card:hover { border-color:#0369a1; background:#f0f9ff; }
        .condition-card.selected { border-color:#0369a1; background:#f0f9ff; }
        .submit-btn { background:#0369a1; color:white; border:none; border-radius:12px; padding:16px; width:100%; font-family:'Manrope',sans-serif; font-weight:700; font-size:15px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:8px; }
        .submit-btn:hover { background:#0284c7; box-shadow:0 8px 24px rgba(3,105,161,0.25); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .reject-btn { background:#fef2f2; color:#ba1a1a; border:1.5px solid rgba(186,26,26,0.2); border-radius:12px; padding:16px; width:100%; font-family:'Manrope',sans-serif; font-weight:700; font-size:15px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:8px; }
        .reject-btn:hover { background:#ffdad6; }
        .code-input { width:52px; height:64px; border:2px solid #e5e7eb; border-radius:12px; text-align:center; font-size:28px; font-weight:800; font-family:'Manrope',sans-serif; color:#181c22; background:#fafafa; transition:all 0.2s; outline:none; }
        .code-input:focus { border-color:#0369a1; background:white; box-shadow:0 0 0 3px rgba(3,105,161,0.08); }
        .code-input.filled { border-color:#0284c7; background:#f0f9ff; color:#0369a1; }
        .tx-box { background:#f0f9ff; border:1px solid rgba(3,105,161,0.15); border-radius:10px; padding:12px 16px; display:flex; align-items:flex-start; gap:10px; }
        .tx-hash { font-family:'Courier New',monospace; font-size:11px; color:#0369a1; word-break:break-all; line-height:1.5; }
        @keyframes spin    { to { transform:rotate(360deg) } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        .fade-1 { animation:fadeUp 0.4s ease 0.05s both }
        .fade-2 { animation:fadeUp 0.4s ease 0.10s both }
      `}</style>

            {/* Header */}
            <section style={{ marginBottom: 32 }} className="fade-1">
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    Facility Operator · Waste Intake
                </span>
                <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 40, fontWeight: 900, color: '#181c22', lineHeight: 1.1, margin: 0 }}>
                    {step === 'success'
                        ? 'Intake Confirmed ✅'
                        : <>Log Waste <span style={{ color: '#0369a1' }}>Intake</span></>
                    }
                </h1>
            </section>

            <div style={{ maxWidth: 640 }}>

                {/* Loading handoff */}
                {loadingHandoff && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, background: 'white', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: 28, height: 28, border: '2px solid #0369a1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
                            <p style={{ fontSize: 14, color: '#717a6d' }}>Loading route details...</p>
                        </div>
                    </div>
                )}

                {/* No handoff state */}
                {!loadingHandoff && !handoff && step === 'form' && (
                    <div className="fade-2">
                        {!showCodeEntry ? (
                            <div style={{ background: 'white', borderRadius: 20, padding: 40, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(0,69,13,0.04)', textAlign: 'center' }}>
                                <div style={{ width: 64, height: 64, background: '#f0f9ff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <span className="msf" style={{ color: '#0369a1', fontSize: 32 }}>info</span>
                                </div>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 18, color: '#181c22', marginBottom: 8 }}>No arrival selected</p>
                                <p style={{ fontSize: 14, color: '#717a6d', marginBottom: 24 }}>
                                    Go back to the dashboard and click <strong>Log Intake</strong> next to an arrived route, or enter a handoff code manually.
                                </p>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <button onClick={() => router.push('/dashboard/facility')} style={{ flex: 1, padding: 14, borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#181c22' }}>← Back</button>
                                    <button onClick={() => setShowCodeEntry(true)} style={{ flex: 1, padding: 14, borderRadius: 12, background: '#0369a1', color: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none' }}>Enter Code Manually</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: 'white', borderRadius: 20, padding: 40, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(0,69,13,0.04)' }}>
                                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                                    <div style={{ width: 64, height: 64, background: '#f0f9ff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                        <span className="msf" style={{ color: '#0369a1', fontSize: 32 }}>pin</span>
                                    </div>
                                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 18, color: '#181c22', marginBottom: 4 }}>Enter 6-digit handoff code</p>
                                    <p style={{ fontSize: 13, color: '#717a6d' }}>Ask the driver for their handoff code</p>
                                </div>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
                                    {code.map((digit, i) => (
                                        <input key={i} id={`code-${i}`} type="text" inputMode="numeric" maxLength={1} value={digit}
                                            onChange={e => handleCodeInput(i, e.target.value)}
                                            onKeyDown={e => handleCodeKeyDown(i, e)}
                                            className={`code-input ${digit ? 'filled' : ''}`} />
                                    ))}
                                </div>
                                {codeError && (
                                    <div style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="msf" style={{ color: '#ba1a1a', fontSize: 18 }}>error</span>
                                        <p style={{ fontSize: 14, color: '#ba1a1a', margin: 0 }}>{codeError}</p>
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <button onClick={() => setShowCodeEntry(false)} style={{ flex: 1, padding: 14, borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#181c22' }}>Cancel</button>
                                    <button onClick={verifyCode} disabled={verifying || code.join('').length !== 6} className="submit-btn" style={{ flex: 2 }}>
                                        {verifying ? 'Verifying...' : 'Verify Code'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Intake form */}
                {!loadingHandoff && handoff && step === 'form' && (
                    <div className="fade-2">
                        {/* Route details */}
                        <div style={{ background: '#f0f9ff', border: '1px solid rgba(3,105,161,0.15)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: '#0369a1', fontSize: 15, margin: 0 }}>✅ Route Details</p>
                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 8px', borderRadius: 99, background: 'rgba(3,105,161,0.08)', color: '#0369a1', fontFamily: 'Manrope,sans-serif' }}>Auto-filled</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                {[
                                    { label: 'Route', value: handoff.route?.route_name || '—' },
                                    { label: 'Driver', value: handoff.driver?.full_name || '—' },
                                    { label: 'Vehicle', value: handoff.route?.vehicle_number || '—' },
                                    { label: 'District', value: handoff.route?.district || '—' },
                                    { label: 'Waste Type', value: handoff.route?.waste_type || handoff.waste_type || '—' },
                                    { label: 'Stops', value: `${completedStops} / ${totalStops} completed` },
                                    { label: 'Date Dispatched', value: handoff.route?.date ? new Date(handoff.route.date).toLocaleDateString('en-GB') : '—' },
                                    { label: 'Time Received', value: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
                                ].map(item => (
                                    <div key={item.label}>
                                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', marginBottom: 2 }}>{item.label}</p>
                                        <p style={{ fontSize: 14, fontWeight: 600, color: '#181c22', margin: 0 }}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Form fields */}
                        <div style={{ background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(0,69,13,0.04)', marginBottom: 16 }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 18, color: '#181c22', marginBottom: 24 }}>Intake Details</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>Actual Quantity *</label>
                                        <input type="number" min="0" step="0.1" className="form-field" placeholder="e.g. 250"
                                            value={formData.actual_quantity} onChange={e => setFormData({ ...formData, actual_quantity: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>Unit *</label>
                                        <select className="select-field" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>Processing Method *</label>
                                    <select className="select-field" value={formData.processing_method} onChange={e => setFormData({ ...formData, processing_method: e.target.value })}>
                                        <option value="">Select processing method</option>
                                        {PROCESSING_METHODS.map(m => <option key={m} value={m.toLowerCase()}>{m}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>Waste Condition *</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {WASTE_CONDITIONS.map(c => (
                                            <div key={c.value} onClick={() => setFormData({ ...formData, condition: c.value })}
                                                className={`condition-card ${formData.condition === c.value ? 'selected' : ''}`}>
                                                {c.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>Notes (Optional)</label>
                                    <textarea className="form-field" rows={3} placeholder="Any additional observations..."
                                        value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ resize: 'none' }} />
                                </div>
                            </div>
                        </div>

                        {submitError && (
                            <div style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="msf" style={{ color: '#ba1a1a', fontSize: 18 }}>error</span>
                                <p style={{ fontSize: 14, color: '#ba1a1a', margin: 0 }}>{submitError}</p>
                            </div>
                        )}

                        {formData.is_rejected ? (
                            <div style={{ background: '#fef2f2', border: '1.5px solid rgba(186,26,26,0.2)', borderRadius: 16, padding: 24, marginBottom: 16 }}>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: '#ba1a1a', marginBottom: 16 }}>Rejection Details</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>Rejection Reason *</label>
                                        <select className="select-field" value={formData.rejection_reason} onChange={e => setFormData({ ...formData, rejection_reason: e.target.value })}>
                                            <option value="">Select reason</option>
                                            {REJECTION_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>Notes</label>
                                        <textarea className="form-field" rows={2} placeholder="Additional details..."
                                            value={formData.rejection_notes} onChange={e => setFormData({ ...formData, rejection_notes: e.target.value })} style={{ resize: 'none' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <button onClick={handleSubmit} disabled={submitting} className="submit-btn" style={{ background: '#ba1a1a' }}>
                                            {submitting ? 'Submitting...' : '❌ Confirm Rejection'}
                                        </button>
                                        <button onClick={() => setFormData({ ...formData, is_rejected: false })}
                                            style={{ padding: 16, borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', flex: 1 }}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <button onClick={handleSubmit} disabled={submitting || blockchainPending} className="submit-btn">
                                    {submitting ? (
                                        <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Logging Intake...</>
                                    ) : blockchainPending ? (
                                        <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Writing to Blockchain...</>
                                    ) : (
                                        <><span className="msf" style={{ fontSize: 18 }}>check_circle</span>Confirm Intake</>
                                    )}
                                </button>
                                <button onClick={() => setFormData({ ...formData, is_rejected: true })} className="reject-btn">
                                    <span className="msf" style={{ fontSize: 18 }}>cancel</span>Reject Waste
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Success */}
                {step === 'success' && completedIntake && (
                    <div className="fade-2">
                        <div style={{ background: 'white', borderRadius: 20, padding: 48, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(0,69,13,0.04)', textAlign: 'center' }}>
                            <div style={{ width: 72, height: 72, background: completedIntake.is_rejected ? '#fef2f2' : '#f0f9ff', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                <span className="msf" style={{ color: completedIntake.is_rejected ? '#ba1a1a' : '#0369a1', fontSize: 40 }}>
                                    {completedIntake.is_rejected ? 'cancel' : 'check_circle'}
                                </span>
                            </div>
                            <h2 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 24, color: '#181c22', marginBottom: 8 }}>
                                {completedIntake.is_rejected ? 'Waste Rejected' : 'Intake Logged Successfully!'}
                            </h2>
                            <p style={{ fontSize: 14, color: '#717a6d', marginBottom: 32 }}>
                                {completedIntake.is_rejected ? 'The rejection has been recorded.' : 'The waste intake has been recorded and logged on-chain.'}
                            </p>
                            {!completedIntake.is_rejected && (
                                <div style={{ background: '#f0f9ff', borderRadius: 12, padding: 20, marginBottom: 24, textAlign: 'left' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        {[
                                            { label: 'Quantity', value: `${completedIntake.actual_quantity} ${completedIntake.unit}` },
                                            { label: 'Condition', value: completedIntake.condition },
                                            { label: 'Method', value: completedIntake.processing_method || '—' },
                                            { label: 'Logged At', value: new Date(completedIntake.received_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
                                        ].map(item => (
                                            <div key={item.label}>
                                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>{item.label}</p>
                                                <p style={{ fontSize: 14, fontWeight: 600, color: '#181c22', textTransform: 'capitalize', margin: 0 }}>{item.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {completedIntake.tx_hash && (
                                        <div style={{ borderTop: '1px solid rgba(3,105,161,0.1)', paddingTop: 14, marginTop: 14 }}>
                                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>Blockchain Transaction</p>
                                            <div className="tx-box">
                                                <span className="msf" style={{ fontSize: 16, color: '#0369a1', flexShrink: 0, marginTop: 1 }}>verified</span>
                                                <div>
                                                    <p className="tx-hash">{completedIntake.tx_hash}</p>
                                                    <a href={`https://amoy.polygonscan.com/tx/${completedIntake.tx_hash}`} target="_blank" rel="noopener noreferrer"
                                                        style={{ fontSize: 11, color: '#1d4ed8', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
                                                        View on Polygonscan <span className="msf" style={{ fontSize: 12 }}>open_in_new</span>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button onClick={() => router.push('/dashboard/facility')}
                                    style={{ flex: 1, padding: 14, borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#181c22' }}>
                                    Back to Dashboard
                                </button>
                                <button onClick={() => router.push('/dashboard/facility/history')}
                                    style={{ flex: 1, padding: 14, borderRadius: 12, background: '#0369a1', color: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none' }}>
                                    View History
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}

export default function FacilityLogPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                <div style={{ width: 28, height: 28, border: '2px solid #0369a1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            </div>
        }>
            <FacilityLogPageContent />
        </Suspense>
    )
}