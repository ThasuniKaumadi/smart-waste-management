'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'

const INTAKE_NAV = [
    { label: 'Overview', href: '/dashboard/intake', icon: 'dashboard' },
    { label: 'History', href: '/dashboard/intake/history', icon: 'history' },
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

const MATERIAL_TYPES = [
    'Plastic', 'Paper', 'Glass', 'Metal',
    'E-Waste', 'Organic', 'Mixed', 'Other',
]

const WASTE_CONDITIONS = [
    { value: 'segregated', label: '✅ Well Segregated' },
    { value: 'mixed', label: '⚠️ Mixed / Partially Segregated' },
    { value: 'contaminated', label: '❌ Contaminated' },
]

const UNITS = ['kg', 'tonnes', 'bags', 'cubic_meters']

interface FormData {
    actual_quantity: string
    unit: string
    material_type: string
    grade: string
    processing_method: string
    condition: string
    notes: string
    is_rejected: boolean
    rejection_reason: string
    rejection_notes: string
}

function IntakeLogPageContent() {
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
        actual_quantity: '',
        unit: 'kg',
        material_type: '',
        grade: '',
        processing_method: '',
        condition: '',
        notes: '',
        is_rejected: false,
        rejection_reason: '',
        rejection_notes: '',
    })
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [completedIntake, setCompletedIntake] = useState<any>(null)
    const [step, setStep] = useState<'form' | 'success'>('form')

    useEffect(() => {
        loadProfile()
    }, [])

    useEffect(() => {
        if (handoffCodeFromUrl && handoffCodeFromUrl.length === 6) {
            autoVerifyCode(handoffCodeFromUrl)
        }
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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: handoffCode }),
            })
            const data = await res.json()
            if (!res.ok) {
                const supabase = createClient()
                const { data: h } = await supabase
                    .from('route_handoffs')
                    .select(`
                        *,
                        route:route_id(id, route_name, district, vehicle_number, date, waste_type),
                        driver:driver_id(full_name, phone)
                    `)
                    .eq('handoff_code', handoffCode)
                    .single()
                if (h) {
                    setHandoff(h)
                    const { count: total } = await supabase
                        .from('collection_stops').select('*', { count: 'exact', head: true }).eq('route_id', h.route_id)
                    const { count: completed } = await supabase
                        .from('collection_stops').select('*', { count: 'exact', head: true })
                        .eq('route_id', h.route_id).eq('status', 'completed')
                    setTotalStops(total || 0)
                    setCompletedStops(completed || 0)
                }
            } else {
                setHandoff(data.handoff)
                setTotalStops(data.totalStops)
                setCompletedStops(data.completedStops)
            }
        } catch (err) {
            console.error('Auto-verify failed:', err)
        }
        setLoadingHandoff(false)
    }

    function handleCodeInput(index: number, value: string) {
        if (!/^\d*$/.test(value)) return
        const newCode = [...code]
        newCode[index] = value.slice(-1)
        setCode(newCode)
        if (value && index < 5) {
            document.getElementById(`code-${index + 1}`)?.focus()
        }
    }

    function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            document.getElementById(`code-${index - 1}`)?.focus()
        }
    }

    async function verifyCode() {
        const fullCode = code.join('')
        if (fullCode.length !== 6) { setCodeError('Please enter all 6 digits'); return }
        setVerifying(true)
        setCodeError('')
        try {
            const res = await fetch('/api/handoff/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: fullCode }),
            })
            const data = await res.json()
            if (!res.ok) { setCodeError(data.error); setVerifying(false); return }
            setHandoff(data.handoff)
            setTotalStops(data.totalStops)
            setCompletedStops(data.completedStops)
            setShowCodeEntry(false)
        } catch { setCodeError('Something went wrong. Please try again.') }
        setVerifying(false)
    }

    function getRateForMaterial(materialType: string) {
        return rates.find(r => r.material_type === materialType.toLowerCase())?.rate_per_kg || 0
    }

    function calculateAmount() {
        if (!isRecycler || !formData.actual_quantity || !formData.material_type) return '0'
        return (parseFloat(formData.actual_quantity) * getRateForMaterial(formData.material_type)).toFixed(2)
    }

    async function handleSubmit() {
        if (!formData.actual_quantity && !formData.is_rejected) {
            setSubmitError('Please enter the actual quantity received'); return
        }
        if (!formData.condition && !formData.is_rejected) {
            setSubmitError('Please select the waste condition'); return
        }
        if (isRecycler && !formData.material_type && !formData.is_rejected) {
            setSubmitError('Please select the material type'); return
        }
        if (isRecycler && !formData.grade && !formData.is_rejected) {
            setSubmitError('Please select the material grade'); return
        }
        if (formData.is_rejected && !formData.rejection_reason) {
            setSubmitError('Please select a rejection reason'); return
        }

        setSubmitting(true)
        setSubmitError('')

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const rate = isRecycler ? getRateForMaterial(formData.material_type) : null

        try {
            const res = await fetch('/api/intake/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    handoff_id: handoff.id,
                    operator_id: user?.id,
                    operator_type: profile?.role,
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
                    rate_per_unit: rate,
                    notes: formData.notes,
                }),
            })
            const data = await res.json()
            if (!res.ok) { setSubmitError(data.error); setSubmitting(false); return }
            setCompletedIntake(data.intake)
            setStep('success')
        } catch { setSubmitError('Something went wrong. Please try again.') }
        setSubmitting(false)
    }

    const isRecycler = profile?.role === 'recycling_partner'

    return (
        <DashboardLayout
            role={isRecycler ? 'Recycling Partner' : 'Facility Operator'}
            userName={profile?.full_name || ''}
            navItems={INTAKE_NAV}
        >
            <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .form-field {
          width: 100%; padding: 12px 16px;
          border: 1.5px solid #e5e7eb; border-radius: 10px;
          font-size: 14px; color: #181c22;
          font-family: 'Inter', sans-serif; background: #fafafa;
          transition: all 0.2s ease; outline: none;
        }
        .form-field:focus {
          border-color: #00450d; background: white;
          box-shadow: 0 0 0 3px rgba(0,69,13,0.08);
        }
        .select-field {
          width: 100%; padding: 12px 16px;
          border: 1.5px solid #e5e7eb; border-radius: 10px;
          font-size: 14px; color: #181c22;
          font-family: 'Inter', sans-serif; background: #fafafa;
          transition: all 0.2s ease; outline: none;
          appearance: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23717a6d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center; background-size: 16px;
        }
        .select-field:focus {
          border-color: #00450d; background-color: white;
          box-shadow: 0 0 0 3px rgba(0,69,13,0.08);
        }
        .condition-card {
          border: 2px solid #e5e7eb; border-radius: 12px;
          padding: 14px 16px; cursor: pointer;
          transition: all 0.2s ease; font-size: 14px;
          font-family: 'Inter', sans-serif;
        }
        .condition-card:hover { border-color: #00450d; background: #f9f9ff; }
        .condition-card.selected { border-color: #00450d; background: #f0fdf4; }
        .submit-btn {
          background: #00450d; color: white; border: none;
          border-radius: 12px; padding: 16px; width: 100%;
          font-family: 'Manrope', sans-serif; font-weight: 700;
          font-size: 15px; cursor: pointer; transition: all 0.2s ease;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .submit-btn:hover { background: #1b5e20; box-shadow: 0 8px 24px rgba(0,69,13,0.25); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .reject-btn {
          background: #fef2f2; color: #ba1a1a;
          border: 1.5px solid rgba(186,26,26,0.2);
          border-radius: 12px; padding: 16px; width: 100%;
          font-family: 'Manrope', sans-serif; font-weight: 700;
          font-size: 15px; cursor: pointer; transition: all 0.2s ease;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .reject-btn:hover { background: #ffdad6; }
        .code-input {
          width: 52px; height: 64px;
          border: 2px solid #e5e7eb; border-radius: 12px;
          text-align: center; font-size: 28px; font-weight: 800;
          font-family: 'Manrope', sans-serif; color: #181c22;
          background: #fafafa; transition: all 0.2s ease; outline: none;
        }
        .code-input:focus {
          border-color: #00450d; background: white;
          box-shadow: 0 0 0 3px rgba(0,69,13,0.08);
        }
        .code-input.filled { border-color: #1b5e20; background: #f0fdf4; color: #00450d; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-1 { animation: fadeUp 0.4s ease 0.05s both; }
        .fade-2 { animation: fadeUp 0.4s ease 0.1s both; }
      `}</style>

            <section className="mb-8 fade-1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    {isRecycler ? 'Recycling Partner' : 'Facility Operator'} · Waste Intake
                </span>
                <h1 className="font-headline font-extrabold tracking-tight"
                    style={{ fontSize: '40px', color: '#181c22', lineHeight: 1.1 }}>
                    {step === 'success' ? 'Intake Confirmed ✅' : 'Log Waste Intake'}
                </h1>
            </section>

            <div style={{ maxWidth: '640px' }}>

                {loadingHandoff && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', background: 'white', borderRadius: '16px', boxShadow: '0 10px 40px -10px rgba(24,28,34,0.08)' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                                style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                            <p style={{ fontSize: '14px', color: '#717a6d' }}>Loading route details...</p>
                        </div>
                    </div>
                )}

                {!loadingHandoff && !handoff && step === 'form' && (
                    <div className="fade-2">
                        {!showCodeEntry ? (
                            <div style={{ background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 10px 40px -10px rgba(24,28,34,0.08)', border: '1px solid rgba(0,69,13,0.04)', textAlign: 'center' }}>
                                <div style={{ width: '64px', height: '64px', background: '#fefce8', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: '32px' }}>info</span>
                                </div>
                                <p className="font-headline font-bold text-lg mb-2" style={{ color: '#181c22' }}>
                                    No arrival selected
                                </p>
                                <p style={{ fontSize: '14px', color: '#717a6d', marginBottom: '24px' }}>
                                    Go back to the dashboard and click <strong>Log Intake</strong> next to an arrived route, or enter a handoff code manually.
                                </p>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => router.push('/dashboard/intake')}
                                        style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: '#181c22' }}>
                                        ← Back
                                    </button>
                                    <button onClick={() => setShowCodeEntry(true)}
                                        style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#00450d', color: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', border: 'none' }}>
                                        Enter Code Manually
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 10px 40px -10px rgba(24,28,34,0.08)', border: '1px solid rgba(0,69,13,0.04)' }}>
                                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                                    <div style={{ width: '64px', height: '64px', background: '#f0fdf4', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>pin</span>
                                    </div>
                                    <p className="font-headline font-bold text-lg mb-2" style={{ color: '#181c22' }}>
                                        Enter 6-digit handoff code
                                    </p>
                                    <p style={{ fontSize: '13px', color: '#717a6d' }}>Ask the driver for their handoff code</p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px' }}>
                                    {code.map((digit, i) => (
                                        <input key={i} id={`code-${i}`} type="text" inputMode="numeric"
                                            maxLength={1} value={digit}
                                            onChange={e => handleCodeInput(i, e.target.value)}
                                            onKeyDown={e => handleCodeKeyDown(i, e)}
                                            className={`code-input ${digit ? 'filled' : ''}`} />
                                    ))}
                                </div>
                                {codeError && (
                                    <div style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '18px' }}>error</span>
                                        <p style={{ fontSize: '14px', color: '#ba1a1a' }}>{codeError}</p>
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => setShowCodeEntry(false)}
                                        style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: '#181c22' }}>
                                        Cancel
                                    </button>
                                    <button onClick={verifyCode} disabled={verifying || code.join('').length !== 6}
                                        className="submit-btn" style={{ flex: 2 }}>
                                        {verifying ? 'Verifying...' : 'Verify Code'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* INTAKE FORM */}
                {!loadingHandoff && handoff && step === 'form' && (
                    <div className="fade-2">

                        {/* Auto-filled route details */}
                        <div style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.12)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <p className="font-headline font-bold" style={{ color: '#00450d', fontSize: '15px' }}>
                                    ✅ Route Details
                                </p>
                                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 8px', borderRadius: '99px', background: 'rgba(0,69,13,0.08)', color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                    Auto-filled
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                                        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#717a6d', fontFamily: 'Manrope, sans-serif', marginBottom: '2px' }}>
                                            {item.label}
                                        </p>
                                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#181c22' }}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Intake details */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 10px 40px -10px rgba(24,28,34,0.08)', border: '1px solid rgba(0,69,13,0.04)', marginBottom: '16px' }}>
                            <h3 className="font-headline font-bold text-lg mb-6" style={{ color: '#181c22' }}>
                                Intake Details
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                {/* Quantity + unit */}
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>
                                            Actual Quantity *
                                        </label>
                                        <input type="number" min="0" step="0.1" className="form-field"
                                            placeholder="e.g. 250"
                                            value={formData.actual_quantity}
                                            onChange={e => setFormData({ ...formData, actual_quantity: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>
                                            Unit *
                                        </label>
                                        <select className="select-field" value={formData.unit}
                                            onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Recycler: material type + grade | Facility: processing method */}
                                {isRecycler ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>
                                                Material Type *
                                            </label>
                                            <select className="select-field" value={formData.material_type}
                                                onChange={e => setFormData({ ...formData, material_type: e.target.value })}>
                                                <option value="">Select material type</option>
                                                {MATERIAL_TYPES.map(m => <option key={m} value={m.toLowerCase()}>{m}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>
                                                Material Grade *
                                            </label>
                                            <select className="select-field" value={formData.grade}
                                                onChange={e => setFormData({ ...formData, grade: e.target.value })}>
                                                <option value="">Select grade</option>
                                                <option value="grade_a">Grade A — Clean, uncontaminated</option>
                                                <option value="grade_b">Grade B — Minor contamination</option>
                                                <option value="grade_c">Grade C — Heavily contaminated</option>
                                                <option value="mixed">Mixed grades</option>
                                            </select>
                                        </div>
                                        {formData.material_type && formData.actual_quantity && (
                                            <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '12px', color: '#41493e' }}>
                                                    Rate: LKR {getRateForMaterial(formData.material_type)}/kg
                                                </span>
                                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                                    Total: LKR {calculateAmount()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>
                                            Processing Method *
                                        </label>
                                        <select className="select-field" value={formData.processing_method}
                                            onChange={e => setFormData({ ...formData, processing_method: e.target.value })}>
                                            <option value="">Select processing method</option>
                                            {PROCESSING_METHODS.map(m => <option key={m} value={m.toLowerCase()}>{m}</option>)}
                                        </select>
                                    </div>
                                )}

                                {/* Condition */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>
                                        Waste Condition *
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {WASTE_CONDITIONS.map(c => (
                                            <div key={c.value}
                                                onClick={() => setFormData({ ...formData, condition: c.value })}
                                                className={`condition-card ${formData.condition === c.value ? 'selected' : ''}`}>
                                                {c.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>
                                        Notes (Optional)
                                    </label>
                                    <textarea className="form-field" rows={3}
                                        placeholder="Any additional observations..."
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        style={{ resize: 'none' }} />
                                </div>
                            </div>
                        </div>

                        {submitError && (
                            <div style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '18px' }}>error</span>
                                <p style={{ fontSize: '14px', color: '#ba1a1a' }}>{submitError}</p>
                            </div>
                        )}

                        {/* Rejection section */}
                        {formData.is_rejected ? (
                            <div style={{ background: '#fef2f2', border: '1.5px solid rgba(186,26,26,0.2)', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
                                <p className="font-headline font-bold mb-4" style={{ color: '#ba1a1a' }}>
                                    Rejection Details
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>
                                            Rejection Reason *
                                        </label>
                                        <select className="select-field" value={formData.rejection_reason}
                                            onChange={e => setFormData({ ...formData, rejection_reason: e.target.value })}>
                                            <option value="">Select reason</option>
                                            {REJECTION_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '8px' }}>
                                            Notes
                                        </label>
                                        <textarea className="form-field" rows={2}
                                            placeholder="Additional details..."
                                            value={formData.rejection_notes}
                                            onChange={e => setFormData({ ...formData, rejection_notes: e.target.value })}
                                            style={{ resize: 'none' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button onClick={handleSubmit} disabled={submitting}
                                            className="submit-btn" style={{ background: '#ba1a1a' }}>
                                            {submitting ? 'Submitting...' : '❌ Confirm Rejection'}
                                        </button>
                                        <button onClick={() => setFormData({ ...formData, is_rejected: false })}
                                            style={{ padding: '16px', borderRadius: '12px', border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', flex: 1 }}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button onClick={handleSubmit} disabled={submitting} className="submit-btn">
                                    {submitting ? (
                                        <>
                                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Logging Intake...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                                            Confirm Intake
                                        </>
                                    )}
                                </button>
                                <button onClick={() => setFormData({ ...formData, is_rejected: true })}
                                    className="reject-btn">
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
                                    Reject Waste
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* SUCCESS */}
                {step === 'success' && completedIntake && (
                    <div className="fade-2">
                        <div style={{ background: 'white', borderRadius: '20px', padding: '48px', boxShadow: '0 10px 40px -10px rgba(24,28,34,0.08)', border: '1px solid rgba(0,69,13,0.04)', textAlign: 'center' }}>
                            <div style={{ width: '72px', height: '72px', background: completedIntake.is_rejected ? '#fef2f2' : '#f0fdf4', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                <span className="material-symbols-outlined"
                                    style={{ color: completedIntake.is_rejected ? '#ba1a1a' : '#00450d', fontSize: '40px' }}>
                                    {completedIntake.is_rejected ? 'cancel' : 'check_circle'}
                                </span>
                            </div>
                            <h2 className="font-headline font-extrabold text-2xl mb-2" style={{ color: '#181c22' }}>
                                {completedIntake.is_rejected ? 'Waste Rejected' : 'Intake Logged Successfully!'}
                            </h2>
                            <p style={{ fontSize: '14px', color: '#717a6d', marginBottom: '32px' }}>
                                {completedIntake.is_rejected
                                    ? 'The rejection has been recorded and a supervisor has been notified.'
                                    : 'The waste intake has been recorded and logged in the system.'}
                            </p>

                            {!completedIntake.is_rejected && (
                                <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '20px', marginBottom: '32px', textAlign: 'left' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {[
                                            { label: 'Quantity', value: `${completedIntake.actual_quantity} ${completedIntake.unit}` },
                                            { label: 'Condition', value: completedIntake.condition },
                                            { label: isRecycler ? 'Material' : 'Method', value: completedIntake.material_type || completedIntake.processing_method || '—' },
                                            { label: isRecycler ? 'Grade' : 'Logged At', value: isRecycler ? (completedIntake.grade?.replace('_', ' ').toUpperCase() || '—') : new Date(completedIntake.received_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
                                        ].map(item => (
                                            <div key={item.label}>
                                                <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                                                    {item.label}
                                                </p>
                                                <p style={{ fontSize: '14px', fontWeight: 600, color: '#181c22', textTransform: 'capitalize' }}>
                                                    {item.value}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                    {isRecycler && completedIntake.total_amount && (
                                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(0,69,13,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <p style={{ fontSize: '13px', color: '#41493e' }}>Payment due to CMC</p>
                                            <p className="font-headline font-bold text-xl" style={{ color: '#00450d' }}>
                                                LKR {completedIntake.total_amount.toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => router.push('/dashboard/intake')}
                                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: '#181c22' }}>
                                    Back to Dashboard
                                </button>
                                <button onClick={() => router.push('/dashboard/intake/history')}
                                    style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#00450d', color: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', border: 'none' }}>
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

export default function IntakeLogPage() {
  return (
    <Suspense fallback={<div style={{display:'flex',justifyContent:'center',padding:'80px'}}><div style={{width:28,height:28,border:'2px solid #00450d',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .8s linear infinite'}} /></div>}>
      <IntakeLogPageContent />
    </Suspense>
  )
}
