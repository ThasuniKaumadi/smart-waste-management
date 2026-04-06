'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
    { label: 'Overview', href: '/dashboard/admin', icon: 'dashboard' },
    { label: 'Users', href: '/dashboard/admin/users', icon: 'manage_accounts' },
    { label: 'Billing', href: '/dashboard/admin/billing', icon: 'receipt_long' },
    { label: 'Blockchain', href: '/dashboard/admin/blockchain', icon: 'link' },
    { label: 'Performance', href: '/dashboard/admin/performance', icon: 'analytics' },
]

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
    unpaid: { color: '#d97706', bg: '#fefce8' },
    paid: { color: '#00450d', bg: '#f0fdf4' },
    overdue: { color: '#ba1a1a', bg: '#fef2f2' },
    suspended: { color: '#7c3aed', bg: '#f5f3ff' },
}

interface BillingRate {
    id: string
    tier: string
    min_bins: number
    max_bins: number
    rate_per_bin: number
    effective_from: string
}

interface Invoice {
    id: string
    invoice_number: string
    commercial_id: string
    period_start: string
    period_end: string
    billing_cycle: string
    total_bins: number
    tier: string
    amount: number
    status: string
    due_date: string
    paid_at: string | null
    profiles: { full_name: string; organisation_name: string }
}

interface CycleRequest {
    id: string
    commercial_id: string
    requested_cycle: string
    current_cycle: string
    status: string
    requested_at: string
    profiles: { full_name: string; organisation_name: string }
}

export default function AdminBillingPage() {
    const [profile, setProfile] = useState<any>(null)
    const [rates, setRates] = useState<BillingRate[]>([])
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [cycleRequests, setCycleRequests] = useState<CycleRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [savingRates, setSavingRates] = useState(false)
    const [message, setMessage] = useState('')
    const [activeTab, setActiveTab] = useState<'invoices' | 'rates' | 'requests'>('invoices')
    const [rateForm, setRateForm] = useState({
        tier_a_rate: '',
        tier_b_rate: '',
        effective_from: new Date().toISOString().split('T')[0],
    })
    const [generatingInvoices, setGeneratingInvoices] = useState(false)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: ratesData } = await supabase
            .from('billing_rates')
            .select('*')
            .order('effective_from', { ascending: false })
        setRates(ratesData || [])

        // Pre-fill rate form with current rates
        const currentA = ratesData?.find(r => r.tier === 'tier_a')
        const currentB = ratesData?.find(r => r.tier === 'tier_b')
        if (currentA) setRateForm(prev => ({ ...prev, tier_a_rate: currentA.rate_per_bin.toString() }))
        if (currentB) setRateForm(prev => ({ ...prev, tier_b_rate: currentB.rate_per_bin.toString() }))

        const { data: invoicesData } = await supabase
            .from('invoices')
            .select('*, profiles!commercial_id(full_name, organisation_name)')
            .order('created_at', { ascending: false })
        setInvoices(invoicesData || [])

        const { data: cycleData } = await supabase
            .from('billing_cycle_requests')
            .select('*, profiles!commercial_id(full_name, organisation_name)')
            .order('requested_at', { ascending: false })
        setCycleRequests(cycleData || [])

        setLoading(false)
    }

    async function saveRates(e: React.FormEvent) {
        e.preventDefault()
        setSavingRates(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase.from('billing_rates').insert([
            {
                tier: 'tier_a', min_bins: 0, max_bins: 30,
                rate_per_bin: parseFloat(rateForm.tier_a_rate),
                effective_from: rateForm.effective_from,
                created_by: user?.id,
            },
            {
                tier: 'tier_b', min_bins: 31, max_bins: 100,
                rate_per_bin: parseFloat(rateForm.tier_b_rate),
                effective_from: rateForm.effective_from,
                created_by: user?.id,
            },
        ])

        if (error) {
            setMessage('Error: ' + error.message)
        } else {
            setMessage('Billing rates updated successfully!')
            loadData()
        }
        setSavingRates(false)
    }

    async function reviewCycleRequest(requestId: string, action: 'approved' | 'rejected', commercialId: string, newCycle: string) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const effectiveFrom = action === 'approved'
            ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split('T')[0]
            : null

        await supabase.from('billing_cycle_requests').update({
            status: action,
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
            effective_from: effectiveFrom,
        }).eq('id', requestId)

        if (action === 'approved') {
            await supabase.from('profiles').update({
                billing_cycle: newCycle,
                billing_cycle_effective_from: effectiveFrom,
            }).eq('id', commercialId)
        }

        setMessage(action === 'approved' ? 'Cycle change approved!' : 'Cycle change rejected.')
        loadData()
    }

    async function generateInvoices() {
        setGeneratingInvoices(true)
        try {
            const res = await fetch('/api/billing/generate-invoices', { method: 'POST' })
            const data = await res.json()
            setMessage(`Generated ${data.count} invoice(s) successfully!`)
            loadData()
        } catch {
            setMessage('Error generating invoices.')
        }
        setGeneratingInvoices(false)
    }

    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
    const totalOutstanding = invoices.filter(i => ['unpaid', 'overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0)
    const pendingRequests = cycleRequests.filter(r => r.status === 'pending').length

    return (
        <DashboardLayout
            role="Admin"
            userName={profile?.full_name || ''}
            navItems={ADMIN_NAV}
        >
            <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .bento-card {
          background: white; border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
          border: 1px solid rgba(0,69,13,0.04); overflow: hidden;
        }
        .tab-btn {
          padding: 8px 20px; border-radius: 99px; font-size: 13px; font-weight: 700;
          font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s ease;
          display: flex; align-items: center; gap: 6px;
        }
        .tab-btn.active { background: #00450d; color: white; }
        .tab-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .tab-btn:not(.active):hover { background: #e2e8f0; }
        .form-field {
          width: 100%; padding: 11px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px;
          font-size: 14px; color: #181c22; font-family: 'Inter', sans-serif;
          background: #fafafa; transition: all 0.2s ease; outline: none; box-sizing: border-box;
        }
        .form-field:focus { border-color: #00450d; background: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.08); }
        .field-label {
          display: block; font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.1em; color: #374151; font-family: 'Manrope', sans-serif; margin-bottom: 7px;
        }
        .submit-btn {
          background: #00450d; color: white; border: none; border-radius: 10px; padding: 13px 24px;
          font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 14px;
          cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 8px;
        }
        .submit-btn:hover { background: #1b5e20; box-shadow: 0 4px 16px rgba(0,69,13,0.25); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .badge {
          display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em;
          text-transform: uppercase; white-space: nowrap;
        }
        .row {
          padding: 16px 24px; border-bottom: 1px solid rgba(0,69,13,0.04);
          display: flex; align-items: center; gap: 16px;
        }
        .row:last-child { border-bottom: none; }
        .action-btn {
          padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 700;
          font-family: 'Manrope', sans-serif; cursor: pointer; transition: all 0.2s ease;
          border: 1.5px solid; white-space: nowrap;
        }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
      `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    System Administration · Billing Management
                </span>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <h1 className="font-headline font-extrabold tracking-tight"
                        style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                        Billing <span style={{ color: '#1b5e20' }}>Management</span>
                    </h1>
                    <button onClick={generateInvoices} disabled={generatingInvoices}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: '#00450d', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                            {generatingInvoices ? 'hourglass_empty' : 'receipt_long'}
                        </span>
                        {generatingInvoices ? 'Generating...' : 'Generate Invoices Now'}
                    </button>
                </div>
            </section>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
                {[
                    { label: 'Total Revenue', value: `LKR ${totalRevenue.toLocaleString()}`, icon: 'payments', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Outstanding', value: `LKR ${totalOutstanding.toLocaleString()}`, icon: 'warning', color: totalOutstanding > 0 ? '#ba1a1a' : '#00450d', bg: totalOutstanding > 0 ? '#fef2f2' : '#f0fdf4' },
                    { label: 'Overdue', value: invoices.filter(i => i.status === 'overdue').length, icon: 'schedule', color: '#ba1a1a', bg: '#fef2f2' },
                    { label: 'Pending Requests', value: pendingRequests, icon: 'pending', color: '#d97706', bg: '#fefce8' },
                ].map(m => (
                    <div key={m.label} className="bento-card p-5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: m.bg }}>
                            <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '18px' }}>{m.icon}</span>
                        </div>
                        <p className="font-headline font-extrabold text-2xl tracking-tight mb-0.5" style={{ color: '#181c22' }}>{m.value}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Message */}
            {message && (
                <div className="mb-6 flex items-center gap-3 p-4 rounded-xl text-sm"
                    style={{ background: message.startsWith('Error') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${message.startsWith('Error') ? 'rgba(186,26,26,0.2)' : 'rgba(0,69,13,0.15)'}`, color: message.startsWith('Error') ? '#ba1a1a' : '#00450d' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        {message.startsWith('Error') ? 'error' : 'check_circle'}
                    </span>
                    {message}
                    <button onClick={() => setMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }} className="s3">
                <button onClick={() => setActiveTab('invoices')} className={`tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>receipt_long</span>
                    Invoices
                </button>
                <button onClick={() => setActiveTab('rates')} className={`tab-btn ${activeTab === 'rates' ? 'active' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>price_change</span>
                    Billing Rates
                </button>
                <button onClick={() => setActiveTab('requests')} className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>swap_horiz</span>
                    Cycle Requests
                    {pendingRequests > 0 && (
                        <span style={{ background: '#ba1a1a', color: 'white', borderRadius: '99px', padding: '1px 7px', fontSize: '10px' }}>
                            {pendingRequests}
                        </span>
                    )}
                </button>
            </div>

            {/* INVOICES TAB */}
            {activeTab === 'invoices' && (
                <div className="bento-card">
                    <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>All Invoices</h3>
                    </div>
                    {invoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '48px', marginBottom: '12px' }}>receipt_long</span>
                            <p style={{ color: '#94a3b8', fontSize: '14px' }}>No invoices generated yet</p>
                        </div>
                    ) : (
                        <div>
                            {invoices.map(invoice => {
                                const ss = STATUS_STYLE[invoice.status] || STATUS_STYLE.unpaid
                                return (
                                    <div key={invoice.id} className="row">
                                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: ss.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="material-symbols-outlined" style={{ color: ss.color, fontSize: '20px' }}>
                                                {invoice.status === 'paid' ? 'check_circle' : invoice.status === 'overdue' ? 'warning' : 'receipt'}
                                            </span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                    {invoice.invoice_number}
                                                </p>
                                                <span className="badge" style={{ background: ss.bg, color: ss.color }}>{invoice.status}</span>
                                                <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                                    {invoice.billing_cycle}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                                                <span>{(invoice.profiles as any)?.organisation_name || (invoice.profiles as any)?.full_name}</span>
                                                <span>{invoice.total_bins} bins</span>
                                                <span>{new Date(invoice.period_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {new Date(invoice.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                <span style={{ color: invoice.status === 'overdue' ? '#ba1a1a' : '#94a3b8' }}>
                                                    Due: {new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: '16px', fontWeight: 800, color: '#181c22', fontFamily: 'Manrope, sans-serif', flexShrink: 0 }}>
                                            LKR {invoice.amount.toLocaleString()}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* BILLING RATES TAB */}
            {activeTab === 'rates' && (
                <div className="bento-card">
                    <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Set Billing Rates</h3>
                        <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                            New rates apply from the effective date. Previous rates are kept for audit purposes.
                        </p>
                    </div>
                    <form onSubmit={saveRates} className="p-8">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div style={{ padding: '20px', borderRadius: '14px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                                <p style={{ fontSize: '12px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Tier A</p>
                                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>0 – 30 bins per week</p>
                                <label className="field-label">Rate per Bin (LKR) *</label>
                                <input type="number" className="form-field" placeholder="e.g. 500"
                                    value={rateForm.tier_a_rate}
                                    onChange={e => setRateForm({ ...rateForm, tier_a_rate: e.target.value })}
                                    min="1" required />
                            </div>
                            <div style={{ padding: '20px', borderRadius: '14px', background: '#eff6ff', border: '1px solid rgba(29,78,216,0.1)' }}>
                                <p style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Tier B</p>
                                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>31 – 100 bins per week</p>
                                <label className="field-label">Rate per Bin (LKR) *</label>
                                <input type="number" className="form-field" placeholder="e.g. 400"
                                    value={rateForm.tier_b_rate}
                                    onChange={e => setRateForm({ ...rateForm, tier_b_rate: e.target.value })}
                                    min="1" required />
                            </div>
                            <div>
                                <label className="field-label">Effective From *</label>
                                <input type="date" className="form-field"
                                    value={rateForm.effective_from}
                                    onChange={e => setRateForm({ ...rateForm, effective_from: e.target.value })}
                                    min={new Date().toISOString().split('T')[0]} required />
                            </div>
                        </div>
                        <button type="submit" disabled={savingRates} className="submit-btn">
                            {savingRates ? 'Saving...' : (
                                <>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                                    Save Rates
                                </>
                            )}
                        </button>
                    </form>

                    {/* Rate history */}
                    {rates.length > 0 && (
                        <div style={{ padding: '0 24px 24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: '#717a6d', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif', marginBottom: '12px' }}>
                                Rate History
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {rates.slice(0, 6).map(rate => (
                                    <div key={rate.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: '#f9f9ff', border: '1px solid rgba(0,69,13,0.04)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span className="badge" style={{ background: rate.tier === 'tier_b' ? '#eff6ff' : '#f0fdf4', color: rate.tier === 'tier_b' ? '#1d4ed8' : '#00450d' }}>
                                                {rate.tier === 'tier_b' ? 'Tier B' : 'Tier A'}
                                            </span>
                                            <span style={{ fontSize: '13px', color: '#64748b' }}>
                                                {rate.min_bins}–{rate.max_bins} bins
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                LKR {rate.rate_per_bin}/bin
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                                From {new Date(rate.effective_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* CYCLE REQUESTS TAB */}
            {activeTab === 'requests' && (
                <div className="bento-card">
                    <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Billing Cycle Change Requests</h3>
                    </div>
                    {cycleRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '48px', marginBottom: '12px' }}>swap_horiz</span>
                            <p style={{ color: '#94a3b8', fontSize: '14px' }}>No cycle change requests yet</p>
                        </div>
                    ) : (
                        <div>
                            {cycleRequests.map(req => (
                                <div key={req.id} className="row">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                {(req.profiles as any)?.organisation_name || (req.profiles as any)?.full_name}
                                            </p>
                                            <span className="badge" style={{ background: req.status === 'pending' ? '#fefce8' : req.status === 'approved' ? '#f0fdf4' : '#fef2f2', color: req.status === 'pending' ? '#d97706' : req.status === 'approved' ? '#00450d' : '#ba1a1a' }}>
                                                {req.status}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#64748b' }}>
                                            {req.current_cycle} → <strong>{req.requested_cycle}</strong>
                                            <span style={{ color: '#94a3b8', marginLeft: '8px' }}>
                                                Requested {new Date(req.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </p>
                                    </div>
                                    {req.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                            <button onClick={() => reviewCycleRequest(req.id, 'approved', req.commercial_id, req.requested_cycle)}
                                                className="action-btn"
                                                style={{ borderColor: 'rgba(0,69,13,0.2)', color: '#00450d', background: 'white' }}>
                                                Approve
                                            </button>
                                            <button onClick={() => reviewCycleRequest(req.id, 'rejected', req.commercial_id, req.requested_cycle)}
                                                className="action-btn"
                                                style={{ borderColor: 'rgba(186,26,26,0.2)', color: '#ba1a1a', background: 'white' }}>
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </DashboardLayout>
    )
}