'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

const CONTRACTOR_NAV = [
  { label: 'Overview', href: '/dashboard/contractor', icon: 'dashboard' },
  { label: 'Routes', href: '/dashboard/contractor/routes', icon: 'route' },
  { label: 'Schedules', href: '/dashboard/contractor/schedules', icon: 'calendar_month' },
  { label: 'Fleet', href: '/dashboard/contractor/fleet', icon: 'local_shipping' },
  { label: 'Contracts', href: '/dashboard/contractor/contracts', icon: 'description' },
  { label: 'Incidents', href: '/dashboard/contractor/incidents', icon: 'warning' },
  { label: 'Messages', href: '/dashboard/contractor/messages', icon: 'chat' },
  { label: 'Zones', href: '/dashboard/contractor/zones', icon: 'map' },
  { label: 'Staff', href: '/dashboard/contractor/staff', icon: 'badge' },
]

type Contract = {
    id: string
    contract_number: string
    contractor_id: string
    start_date: string
    end_date: string
    wards_covered: string[]
    districts_covered: string[]
    kpi_collection_rate: number
    kpi_ontime_rate: number
    kpi_complaint_limit: number
    status: string
    terms_and_conditions: string
    monthly_payment_amount: number
    payment_terms: string
    created_at: string
}

type Renewal = {
    id: string
    contract_id: string
    proposed_start_date: string
    proposed_end_date: string
    proposed_monthly_amount: number
    reason: string
    status: string
    admin_notes: string
    created_at: string
}

function statusStyle(status: string) {
    switch (status) {
        case 'active': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a' }
        case 'expiring_soon': return { bg: '#fefce8', color: '#92400e', dot: '#d97706' }
        case 'expired': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444' }
        case 'terminated': return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8' }
        case 'draft': return { bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8' }
    }
}

function renewalStatusStyle(status: string) {
    switch (status) {
        case 'pending': return { bg: '#fefce8', color: '#92400e' }
        case 'under_review': return { bg: '#f0f9ff', color: '#0369a1' }
        case 'approved': return { bg: '#f0fdf4', color: '#00450d' }
        case 'rejected': return { bg: '#fef2f2', color: '#ba1a1a' }
        default: return { bg: '#f8fafc', color: '#64748b' }
    }
}

function daysUntilExpiry(endDate: string) {
    const today = new Date()
    const end = new Date(endDate)
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
}

export default function ContractorContractsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [contract, setContract] = useState<Contract | null>(null)
    const [renewals, setRenewals] = useState<Renewal[]>([])
    const [loading, setLoading] = useState(true)
    const [showRenewalForm, setShowRenewalForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [renewalForm, setRenewalForm] = useState({
        proposed_start_date: '',
        proposed_end_date: '',
        proposed_monthly_amount: '',
        reason: '',
    })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: contractData } = await supabase
            .from('contracts')
            .select('*')
            .eq('contractor_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
        setContract(contractData)

        if (contractData) {
            const { data: renewalData } = await supabase
                .from('contract_renewals')
                .select('*')
                .eq('contract_id', contractData.id)
                .order('created_at', { ascending: false })
            setRenewals(renewalData || [])

            // Pre-fill renewal form with suggested dates
            const newStart = new Date(contractData.end_date)
            newStart.setDate(newStart.getDate() + 1)
            const newEnd = new Date(newStart)
            newEnd.setFullYear(newEnd.getFullYear() + 2)
            setRenewalForm(f => ({
                ...f,
                proposed_start_date: newStart.toISOString().split('T')[0],
                proposed_end_date: newEnd.toISOString().split('T')[0],
                proposed_monthly_amount: contractData.monthly_payment_amount?.toString() || '',
            }))
        }

        setLoading(false)
    }

    async function submitRenewal() {
        if (!contract) return
        if (!renewalForm.proposed_start_date || !renewalForm.proposed_end_date || !renewalForm.reason) {
            setErrorMsg('Please fill in all required fields.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('contract_renewals').insert({
            contract_id: contract.id,
            contractor_id: user.id,
            proposed_start_date: renewalForm.proposed_start_date,
            proposed_end_date: renewalForm.proposed_end_date,
            proposed_monthly_amount: renewalForm.proposed_monthly_amount
                ? parseFloat(renewalForm.proposed_monthly_amount) : null,
            reason: renewalForm.reason,
            status: 'pending',
        })

        if (error) {
            setErrorMsg('Failed to submit renewal request. Please try again.')
        } else {
            setSuccessMsg('Renewal request submitted successfully. CMC will review your request.')
            setShowRenewalForm(false)
            loadData()
        }
        setSubmitting(false)
    }

    const days = contract ? daysUntilExpiry(contract.end_date) : 0
    const hasPendingRenewal = renewals.some(r => r.status === 'pending' || r.status === 'under_review')

    return (
        <DashboardLayout
            role="Contractor"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={CONTRACTOR_NAV}
            primaryAction={{ label: 'New Route', href: '/dashboard/contractor/routes/new', icon: 'add' }}
        >
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); transition:all 0.4s cubic-bezier(0.05,0.7,0.1,1.0); overflow:hidden; }
        .bento-card-green { background:#00450d; border-radius:16px; color:white; overflow:hidden; position:relative; }
        .status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .kpi-bar { height:8px; border-radius:99px; background:#f0fdf4; overflow:hidden; }
        .kpi-fill { height:100%; border-radius:99px; transition:width 0.8s cubic-bezier(0.05,0.7,0.1,1.0); }
        .form-input { width:100%; padding:10px 14px; border-radius:10px; border:1.5px solid rgba(0,69,13,0.15); font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:white; color:#181c22; }
        .form-input:focus { border-color:#00450d; }
        .form-label { font-size:12px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.05em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#00450d; color:white; border:none; padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity 0.2s; }
        .btn-primary:hover { opacity:0.88; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
        .renewal-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; }
        .renewal-row:last-child { border-bottom:none; }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1 { animation:staggerIn 0.5s ease 0.05s both; }
        .s2 { animation:staggerIn 0.5s ease 0.10s both; }
        .s3 { animation:staggerIn 0.5s ease 0.15s both; }
        .s4 { animation:staggerIn 0.5s ease 0.20s both; }
        .s5 { animation:staggerIn 0.5s ease 0.25s both; }
      `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="font-headline font-extrabold tracking-tight"
                            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                            My <span style={{ color: '#1b5e20' }}>Contract</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            View your service agreement with Colombo Municipal Council
                        </p>
                    </div>
                    {contract && !hasPendingRenewal && (contract.status === 'active' || contract.status === 'expiring_soon') && (
                        <button className="btn-primary" onClick={() => setShowRenewalForm(true)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>autorenew</span>
                            Request Renewal
                        </button>
                    )}
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : !contract ? (
                /* No contract state */
                <div className="bento-card p-16 flex flex-col items-center justify-center text-center s2">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
                        style={{ background: '#f0fdf4' }}>
                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '40px' }}>description</span>
                    </div>
                    <h2 className="font-headline font-bold text-2xl mb-2" style={{ color: '#181c22' }}>No Active Contract</h2>
                    <p className="text-sm max-w-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                        You don't have an active contract with CMC yet. Please contact your CMC administrator to get your contract set up.
                    </p>
                </div>
            ) : (
                <>
                    {/* Success / Error messages */}
                    {successMsg && (
                        <div className="mb-6 p-4 rounded-xl flex items-center gap-3 s1"
                            style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>check_circle</span>
                            <p className="text-sm font-medium" style={{ color: '#00450d', fontFamily: 'Inter, sans-serif' }}>{successMsg}</p>
                            <button onClick={() => setSuccessMsg('')} className="ml-auto" style={{ color: '#00450d', background: 'none', border: 'none', cursor: 'pointer' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                            </button>
                        </div>
                    )}

                    {/* Expiry warning banner */}
                    {contract.status === 'expiring_soon' && (
                        <div className="mb-6 p-4 rounded-xl flex items-center gap-3 s1"
                            style={{ background: '#fefce8', border: '1px solid rgba(217,119,6,0.2)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: '20px' }}>warning</span>
                            <p className="text-sm font-medium" style={{ color: '#92400e', fontFamily: 'Inter, sans-serif' }}>
                                Your contract expires in <strong>{days} days</strong> on {new Date(contract.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Request a renewal to continue operations.
                            </p>
                        </div>
                    )}

                    {contract.status === 'expired' && (
                        <div className="mb-6 p-4 rounded-xl flex items-center gap-3 s1"
                            style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.2)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '20px' }}>error</span>
                            <p className="text-sm font-medium" style={{ color: '#ba1a1a', fontFamily: 'Inter, sans-serif' }}>
                                Your contract has expired. Please contact CMC administration to renew your service agreement.
                            </p>
                        </div>
                    )}

                    {hasPendingRenewal && (
                        <div className="mb-6 p-4 rounded-xl flex items-center gap-3 s1"
                            style={{ background: '#f0f9ff', border: '1px solid rgba(3,105,161,0.15)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#0369a1', fontSize: '20px' }}>pending</span>
                            <p className="text-sm font-medium" style={{ color: '#0369a1', fontFamily: 'Inter, sans-serif' }}>
                                Your renewal request is currently under review by CMC. You'll be notified when a decision is made.
                            </p>
                        </div>
                    )}

                    {/* Row 1 — Contract hero card */}
                    <div className="bento-card-green p-8 mb-6 s2">
                        <div className="absolute top-0 right-0 w-64 h-64 rounded-full -mr-24 -mt-24"
                            style={{ background: 'rgba(163,246,156,0.06)' }} />
                        <div className="relative z-10">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                                <div>
                                    <span className="text-xs font-bold uppercase block mb-2"
                                        style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                                        Service Agreement
                                    </span>
                                    <h2 className="font-headline font-extrabold text-3xl tracking-tight mb-1">
                                        {contract.contract_number}
                                    </h2>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                                        Colombo Municipal Council
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {(() => {
                                        const s = statusStyle(contract.status)
                                        return (
                                            <span className="status-badge" style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
                                                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: s.dot }} />
                                                {contract.status.replace('_', ' ')}
                                            </span>
                                        )
                                    })()}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Start Date', value: new Date(contract.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), icon: 'event' },
                                    { label: 'End Date', value: new Date(contract.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), icon: 'event_busy' },
                                    { label: 'Monthly Value', value: `LKR ${contract.monthly_payment_amount?.toLocaleString()}`, icon: 'payments' },
                                    { label: days > 0 ? 'Days Remaining' : 'Expired', value: days > 0 ? `${days} days` : 'Expired', icon: 'hourglass_bottom' },
                                ].map(m => (
                                    <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                        <span className="material-symbols-outlined mb-2 block"
                                            style={{ color: 'rgba(163,246,156,0.7)', fontSize: '18px' }}>{m.icon}</span>
                                        <p className="font-headline font-bold text-lg leading-tight">{m.value}</p>
                                        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Row 2 — KPIs + Coverage */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 s3">
                        {/* KPI Targets */}
                        <div className="bento-card p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>KPI Targets</h3>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>
                                        monitoring
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-6">
                                {[
                                    { label: 'Collection Rate', target: contract.kpi_collection_rate, icon: 'delete_sweep', color: '#00450d' },
                                    { label: 'On-Time Rate', target: contract.kpi_ontime_rate, icon: 'schedule', color: '#1d4ed8' },
                                ].map(kpi => (
                                    <div key={kpi.label}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined" style={{ color: kpi.color, fontSize: '16px' }}>{kpi.icon}</span>
                                                <span className="text-sm font-semibold" style={{ color: '#181c22', fontFamily: 'Inter, sans-serif' }}>{kpi.label}</span>
                                            </div>
                                            <span className="font-headline font-bold text-sm" style={{ color: kpi.color }}>
                                                Min {kpi.target}%
                                            </span>
                                        </div>
                                        <div className="kpi-bar">
                                            <div className="kpi-fill" style={{ width: `${kpi.target}%`, background: kpi.color }} />
                                        </div>
                                    </div>
                                ))}
                                <div className="p-4 rounded-xl" style={{ background: '#fefce8' }}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: '16px' }}>warning</span>
                                        <span className="text-xs font-bold" style={{ color: '#92400e', fontFamily: 'Manrope, sans-serif' }}>
                                            Complaint Limit
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold" style={{ color: '#92400e' }}>
                                        Max {contract.kpi_complaint_limit} complaints per month
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Coverage */}
                        <div className="bento-card p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Coverage Area</h3>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>
                                        map
                                    </span>
                                </div>
                            </div>
                            <div className="mb-6">
                                <p className="text-xs font-bold uppercase mb-3"
                                    style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                    Districts
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {contract.districts_covered.map(d => (
                                        <span key={d} className="px-3 py-1.5 rounded-xl text-sm font-semibold"
                                            style={{ background: '#f0fdf4', color: '#00450d', fontFamily: 'Inter, sans-serif' }}>
                                            {d}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase mb-3"
                                    style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                    Wards ({contract.wards_covered.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {contract.wards_covered.map(w => (
                                        <span key={w} className="px-3 py-1.5 rounded-xl text-sm font-medium"
                                            style={{ background: '#f8fafc', color: '#64748b', border: '1px solid rgba(0,69,13,0.08)', fontFamily: 'Inter, sans-serif' }}>
                                            {w}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Row 3 — Terms + Payment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 s4">
                        <div className="bento-card p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Terms & Conditions</h3>
                                <span className="material-symbols-outlined" style={{ color: '#717a6d', fontSize: '20px' }}>gavel</span>
                            </div>
                            <p className="text-sm leading-relaxed" style={{ color: '#4b5563', fontFamily: 'Inter, sans-serif' }}>
                                {contract.terms_and_conditions || 'No terms specified.'}
                            </p>
                        </div>
                        <div className="bento-card p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Payment Details</h3>
                                <span className="material-symbols-outlined" style={{ color: '#717a6d', fontSize: '20px' }}>payments</span>
                            </div>
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl" style={{ background: '#f0fdf4' }}>
                                    <p className="text-xs font-bold uppercase mb-1"
                                        style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                        Monthly Amount
                                    </p>
                                    <p className="font-headline font-extrabold text-2xl" style={{ color: '#00450d' }}>
                                        LKR {contract.monthly_payment_amount?.toLocaleString()}
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl" style={{ background: '#f8fafc' }}>
                                    <p className="text-xs font-bold uppercase mb-1"
                                        style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                        Payment Terms
                                    </p>
                                    <p className="text-sm" style={{ color: '#4b5563', fontFamily: 'Inter, sans-serif' }}>
                                        {contract.payment_terms || 'Not specified'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Row 4 — Renewal History */}
                    <div className="bento-card mb-6 s5">
                        <div className="px-6 py-5 flex items-center justify-between"
                            style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <div>
                                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Renewal History</h3>
                                <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                    {renewals.length} renewal request{renewals.length !== 1 ? 's' : ''} submitted
                                </p>
                            </div>
                            {!hasPendingRenewal && (contract.status === 'active' || contract.status === 'expiring_soon') && (
                                <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}
                                    onClick={() => setShowRenewalForm(true)}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>autorenew</span>
                                    Request Renewal
                                </button>
                            )}
                        </div>
                        {renewals.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>autorenew</span>
                                </div>
                                <p className="text-sm font-medium" style={{ color: '#181c22' }}>No renewal requests yet</p>
                                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                                    Submit a renewal request before your contract expires
                                </p>
                            </div>
                        ) : (
                            <div>
                                {renewals.map(r => {
                                    const rs = renewalStatusStyle(r.status)
                                    return (
                                        <div key={r.id} className="renewal-row">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: rs.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: rs.color, fontSize: '20px' }}>
                                                    autorenew
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-semibold" style={{ color: '#181c22' }}>
                                                        {new Date(r.proposed_start_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} –{' '}
                                                        {new Date(r.proposed_end_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                                    </p>
                                                    <span className="status-badge" style={{ background: rs.bg, color: rs.color }}>
                                                        {r.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <p className="text-xs" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                                                    {r.reason}
                                                </p>
                                                {r.admin_notes && (
                                                    <p className="text-xs mt-1 font-medium" style={{ color: '#0369a1' }}>
                                                        CMC Note: {r.admin_notes}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                {r.proposed_monthly_amount && (
                                                    <p className="text-sm font-bold" style={{ color: '#00450d' }}>
                                                        LKR {r.proposed_monthly_amount.toLocaleString()}
                                                    </p>
                                                )}
                                                <p className="text-xs" style={{ color: '#94a3b8' }}>
                                                    {new Date(r.created_at).toLocaleDateString('en-GB')}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Renewal Form Modal */}
                    {showRenewalForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            Request Contract Renewal
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            Submit a renewal request to CMC for review
                                        </p>
                                    </div>
                                    <button onClick={() => setShowRenewalForm(false)}
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Proposed Start Date *</label>
                                            <input type="date" className="form-input"
                                                value={renewalForm.proposed_start_date}
                                                onChange={e => setRenewalForm(f => ({ ...f, proposed_start_date: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Proposed End Date *</label>
                                            <input type="date" className="form-input"
                                                value={renewalForm.proposed_end_date}
                                                onChange={e => setRenewalForm(f => ({ ...f, proposed_end_date: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">Proposed Monthly Amount (LKR)</label>
                                        <input type="number" className="form-input" placeholder="e.g. 175000"
                                            value={renewalForm.proposed_monthly_amount}
                                            onChange={e => setRenewalForm(f => ({ ...f, proposed_monthly_amount: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="form-label">Reason for Renewal *</label>
                                        <textarea className="form-input" rows={4}
                                            placeholder="Explain why you are requesting a renewal and any changes you'd like to propose..."
                                            value={renewalForm.reason}
                                            onChange={e => setRenewalForm(f => ({ ...f, reason: e.target.value }))}
                                            style={{ resize: 'vertical' }} />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1" onClick={() => setShowRenewalForm(false)}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1" onClick={submitRenewal} disabled={submitting}>
                                        {submitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                    style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
                                                Submit Request
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
