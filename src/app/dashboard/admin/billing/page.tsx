'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
    { label: 'Home', href: '/dashboard/admin', icon: 'dashboard' },
    { label: 'Users', href: '/dashboard/admin/users', icon: 'manage_accounts' },
    { label: 'Billing', href: '/dashboard/admin/billing', icon: 'payments' },
    { label: 'Billing Rates', href: '/dashboard/admin/billing-rates', icon: 'tune' },
    { label: 'Blockchain', href: '/dashboard/admin/blockchain', icon: 'link' },
    { label: 'Performance', href: '/dashboard/admin/performance', icon: 'analytics' },
    { label: 'Disposal', href: '/dashboard/admin/disposal', icon: 'delete_sweep' },
    { label: 'Reports', href: '/dashboard/admin/reports', icon: 'rate_review' },
    { label: 'Profile', href: '/dashboard/admin/profile', icon: 'person' },
]

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    unpaid: { color: '#d97706', bg: '#fffbeb', label: 'Unpaid' },
    paid: { color: '#15803d', bg: '#f0fdf4', label: 'Paid' },
    overdue: { color: '#ba1a1a', bg: '#fef2f2', label: 'Overdue' },
    suspended: { color: '#7c3aed', bg: '#faf5ff', label: 'Suspended' },
}

interface BillingRate {
    id: string; tier: string; min_bins: number; max_bins: number
    rate_per_bin: number; effective_from: string
}
interface CommercialSummary {
    commercial_id: string; organisation_name: string; full_name: string
    district: string; ward: string; billing_cycle: string; billing_suspended: boolean
    total_bins_this_period: number; bins_this_week: number; total_stops_completed: number
    last_collection: string | null; current_tier: string
    estimated_amount?: number; has_invoice?: boolean
}
interface Invoice {
    id: string; invoice_number: string; commercial_id: string
    period_start: string; period_end: string; billing_cycle: string
    total_bins: number; tier: string; amount: number; status: string
    due_date: string; paid_at: string | null
    profiles: { full_name: string; organisation_name: string }
}
interface CycleRequest {
    id: string; commercial_id: string; requested_cycle: string
    current_cycle: string; status: string; requested_at: string
    profiles: { full_name: string; organisation_name: string }
}

export default function AdminBillingPage() {
    const [profile, setProfile] = useState<any>(null)
    const [rates, setRates] = useState<BillingRate[]>([])
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [cycleRequests, setCycleRequests] = useState<CycleRequest[]>([])
    const [commercialSummaries, setCommercialSummaries] = useState<CommercialSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [savingRates, setSavingRates] = useState(false)
    const [message, setMessage] = useState('')
    const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'invoices' | 'rates' | 'requests'>('overview')
    const [rateForm, setRateForm] = useState({ tier_a_rate: '', tier_b_rate: '', effective_from: new Date().toISOString().split('T')[0] })
    const [generatingFor, setGeneratingFor] = useState<string | null>(null)
    const [generatingAll, setGeneratingAll] = useState(false)
    const [selectedCommercials, setSelectedCommercials] = useState<Set<string>>(new Set())
    const [togglingId, setTogglingId] = useState<string | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data: ratesData } = await supabase.from('billing_rates').select('*').order('effective_from', { ascending: false })
        setRates(ratesData || [])
        const currentA = ratesData?.find(r => r.tier === 'tier_a')
        const currentB = ratesData?.find(r => r.tier === 'tier_b')
        if (currentA) setRateForm(prev => ({ ...prev, tier_a_rate: currentA.rate_per_bin.toString() }))
        if (currentB) setRateForm(prev => ({ ...prev, tier_b_rate: currentB.rate_per_bin.toString() }))
        const { data: invoicesData } = await supabase.from('invoices').select('*, profiles!commercial_id(full_name, organisation_name)').order('created_at', { ascending: false })
        setInvoices(invoicesData || [])
        const { data: cycleData } = await supabase.from('billing_cycle_requests').select('*, profiles!commercial_id(full_name, organisation_name)').order('requested_at', { ascending: false })
        setCycleRequests(cycleData || [])
        const { data: summaryData } = await supabase.from('commercial_billing_summary').select('*').order('total_bins_this_period', { ascending: false })
        const enriched = (summaryData || []).map((s: CommercialSummary) => {
            const rate = s.current_tier === 'tier_b' ? ratesData?.find(r => r.tier === 'tier_b')?.rate_per_bin || 0 : ratesData?.find(r => r.tier === 'tier_a')?.rate_per_bin || 0
            const hasInvoice = (invoicesData || []).some(inv => inv.commercial_id === s.commercial_id && new Date(inv.period_start).getMonth() === new Date().getMonth())
            return { ...s, estimated_amount: s.total_bins_this_period * rate, has_invoice: hasInvoice }
        })
        setCommercialSummaries(enriched)
        setLoading(false)
    }

    async function generateForCommercial(commercialId: string) {
        setGeneratingFor(commercialId)
        try {
            const res = await fetch('/api/billing/generate-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commercial_id: commercialId }) })
            const data = await res.json()
            setMessage(data.error ? 'Error: ' + data.error : data.count > 0 ? 'Invoice generated successfully!' : 'No billable activity found for this period.')
            loadData()
        } catch { setMessage('Error generating invoice.') }
        setGeneratingFor(null)
    }

    async function generateSelected() {
        if (selectedCommercials.size === 0) { setMessage('Please select at least one establishment'); return }
        setGeneratingAll(true)
        let total = 0
        for (const id of selectedCommercials) {
            try {
                const res = await fetch('/api/billing/generate-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commercial_id: id }) })
                const data = await res.json()
                if (data.count > 0) total++
            } catch { }
        }
        setMessage(`Generated ${total} invoice(s) for selected establishments.`)
        setSelectedCommercials(new Set())
        loadData()
        setGeneratingAll(false)
    }

    async function saveRates(e: React.FormEvent) {
        e.preventDefault()
        setSavingRates(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('billing_rates').insert([
            { tier: 'tier_a', min_bins: 0, max_bins: 30, rate_per_bin: parseFloat(rateForm.tier_a_rate), effective_from: rateForm.effective_from, created_by: user?.id },
            { tier: 'tier_b', min_bins: 31, max_bins: 100, rate_per_bin: parseFloat(rateForm.tier_b_rate), effective_from: rateForm.effective_from, created_by: user?.id },
        ])
        if (error) setMessage('Error: ' + error.message)
        else { setMessage('Billing rates updated successfully!'); loadData() }
        setSavingRates(false)
    }

    async function reviewCycleRequest(requestId: string, action: 'approved' | 'rejected', commercialId: string, newCycle: string) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const effectiveFrom = action === 'approved' ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split('T')[0] : null
        await supabase.from('billing_cycle_requests').update({ status: action, reviewed_by: user?.id, reviewed_at: new Date().toISOString(), effective_from: effectiveFrom }).eq('id', requestId)
        if (action === 'approved') await supabase.from('profiles').update({ billing_cycle: newCycle, billing_cycle_effective_from: effectiveFrom }).eq('id', commercialId)
        setMessage(action === 'approved' ? 'Cycle change approved!' : 'Cycle change rejected.')
        loadData()
    }

    async function toggleSuspension(commercialId: string, currentlySuspended: boolean) {
        setTogglingId(commercialId)
        const supabase = createClient()
        const { error } = await supabase.from('profiles').update({ billing_suspended: !currentlySuspended }).eq('id', commercialId)
        if (error) setMessage('Error: ' + error.message)
        else {
            setMessage(currentlySuspended ? '✓ Service restored. Account is now active.' : '⚠ Account suspended.')
            loadData()
        }
        setTogglingId(null)
    }

    function toggleSelect(id: string) {
        const next = new Set(selectedCommercials)
        if (next.has(id)) next.delete(id); else next.add(id)
        setSelectedCommercials(next)
    }
    function toggleSelectAll() {
        const eligible = commercialSummaries.filter(s => s.total_bins_this_period > 0 && !s.has_invoice)
        if (selectedCommercials.size === eligible.length) setSelectedCommercials(new Set())
        else setSelectedCommercials(new Set(eligible.map(s => s.commercial_id)))
    }

    const tierARate = rates.find(r => r.tier === 'tier_a')
    const tierBRate = rates.find(r => r.tier === 'tier_b')
    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
    const totalOutstanding = invoices.filter(i => ['unpaid', 'overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0)
    const pendingRequests = cycleRequests.filter(r => r.status === 'pending').length
    const activeCommercials = commercialSummaries.filter(s => s.total_bins_this_period > 0)
    const eligibleForInvoice = commercialSummaries.filter(s => s.total_bins_this_period > 0 && !s.has_invoice)

    return (
        <DashboardLayout role="Admin" userName={profile?.full_name || ''} navItems={ADMIN_NAV}>
            <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
        .stat-card { background:white; border-radius:20px; padding:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); transition:transform 0.2s,box-shadow 0.2s; }
        .stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.09); }
        .tab-btn { padding:8px 18px; border-radius:99px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px; }
        .tab-btn.active { background:#00450d; color:white; }
        .tab-btn:not(.active) { background:#f1f5f9; color:#64748b; }
        .tab-btn:not(.active):hover { background:#e2e8f0; }
        .form-field { width:100%; padding:11px 14px; border:1.5px solid #e4e9e0; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafbf9; transition:all 0.2s; outline:none; box-sizing:border-box; }
        .form-field:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .field-label { display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#41493e; font-family:'Manrope',sans-serif; margin-bottom:7px; }
        .submit-btn { background:#00450d; color:white; border:none; border-radius:12px; padding:12px 24px; font-family:'Manrope',sans-serif; font-weight:700; font-size:14px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:8px; }
        .submit-btn:hover { background:#1b5e20; box-shadow:0 4px 16px rgba(0,69,13,0.25); transform:translateY(-1px); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
        .badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; transition:background 0.15s; }
        .row:hover { background:#f9fbf9; }
        .row:last-child { border-bottom:none; }
        .action-btn { padding:6px 14px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.2s; border:1.5px solid; white-space:nowrap; }
        .gen-btn { padding:7px 14px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:none; background:#00450d; color:white; white-space:nowrap; display:flex; align-items:center; gap:5px; transition:all 0.2s; }
        .gen-btn:hover { background:#1b5e20; }
        .gen-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .suspend-btn { padding:6px 14px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.2s; white-space:nowrap; border:1.5px solid; }
        .checkbox { width:18px; height:18px; border-radius:5px; border:2px solid #e4e9e0; background:white; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; flex-shrink:0; }
        .checkbox.checked { background:#00450d; border-color:#00450d; }
        .toast { border-radius:14px; padding:14px 18px; font-size:13px; font-family:'Inter',sans-serif; display:flex; align-items:center; gap:10px; margin-bottom:20px; }
        .toast-ok  { background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; }
        .toast-err { background:#fef2f2; border:1px solid #fecaca; color:#dc2626; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both}
        .a3{animation:fadeUp .4s ease .14s both} .a4{animation:fadeUp .4s ease .19s both}
      `}</style>

            {/* ── Heading ── */}
            <div className="a1" style={{ marginBottom: 32 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>
                    💳 System Administration
                </p>
                <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
                    Billing <span style={{ color: '#00450d' }}>Management</span>
                </h1>
                <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>
                    {new Date().toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    &nbsp;·&nbsp;Commercial invoices, rates &amp; accounts
                </p>
            </div>

            {/* ── KPI strip ── */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Total Revenue', value: `LKR ${totalRevenue.toLocaleString()}`, icon: 'payments', color: '#15803d', bg: '#f0fdf4' },
                    { label: 'Outstanding', value: `LKR ${totalOutstanding.toLocaleString()}`, icon: 'warning', color: totalOutstanding > 0 ? '#ba1a1a' : '#15803d', bg: totalOutstanding > 0 ? '#fef2f2' : '#f0fdf4' },
                    { label: 'Active Commercials', value: activeCommercials.length, icon: 'storefront', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Suspended', value: commercialSummaries.filter(s => s.billing_suspended).length, icon: 'block', color: '#7c3aed', bg: '#faf5ff' },
                ].map(m => (
                    <div key={m.label} className="stat-card">
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                            <span className="msf" style={{ color: m.color, fontSize: 18 }}>{m.icon}</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 24, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                        <p style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Toast ── */}
            {message && (
                <div className={`toast ${message.startsWith('Error') ? 'toast-err' : 'toast-ok'}`}>
                    <span className="msf" style={{ fontSize: 18 }}>{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
                    {message}
                    <button onClick={() => setMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                        <span className="msf" style={{ fontSize: 16 }}>close</span>
                    </button>
                </div>
            )}

            {/* ── Tabs ── */}
            <div className="a3" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                    { key: 'overview', label: 'Collection Overview', icon: 'storefront' },
                    { key: 'accounts', label: 'Accounts', icon: 'business' },
                    { key: 'invoices', label: 'Invoices', icon: 'receipt_long' },
                    { key: 'rates', label: 'Billing Rates', icon: 'price_change' },
                    { key: 'requests', label: `Cycle Requests${pendingRequests > 0 ? ` (${pendingRequests})` : ''}`, icon: 'swap_horiz' },
                ].map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key as any)} className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}>
                        <span className="msf" style={{ fontSize: 15 }}>{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ════════ OVERVIEW TAB ════════ */}
            {activeTab === 'overview' && (
                <div className="card a3">
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.05)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 17, color: '#181c22', margin: 0 }}>Collection Activity — {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
                            <p style={{ fontSize: 13, color: '#717a6d', margin: '4px 0 0' }}>Bin counts per commercial establishment this period.</p>
                        </div>
                        {eligibleForInvoice.length > 0 && (
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <button onClick={toggleSelectAll} style={{ padding: '8px 16px', borderRadius: 99, border: '1.5px solid rgba(0,69,13,0.2)', background: 'white', color: '#00450d', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer' }}>
                                    {selectedCommercials.size === eligibleForInvoice.length ? 'Deselect All' : 'Select All'}
                                </button>
                                {selectedCommercials.size > 0 && (
                                    <button onClick={generateSelected} disabled={generatingAll} className="submit-btn" style={{ padding: '9px 20px', fontSize: 13 }}>
                                        <span className="msf" style={{ fontSize: 15 }}>receipt_long</span>
                                        {generatingAll ? 'Generating…' : `Generate ${selectedCommercials.size} Invoice${selectedCommercials.size > 1 ? 's' : ''}`}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                            <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                        </div>
                    ) : commercialSummaries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                            <span className="msf" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 10 }}>storefront</span>
                            <p style={{ color: '#94a3b8', fontSize: 14 }}>No commercial establishments registered yet</p>
                        </div>
                    ) : (
                        <>
                            {(tierARate || tierBRate) && (
                                <div style={{ padding: '10px 24px', background: '#fafbf9', borderBottom: '1px solid rgba(0,69,13,0.04)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                    {tierARate && <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}><span className="badge" style={{ background: '#f0fdf4', color: '#15803d' }}>Tier A</span>0–30 bins · LKR {tierARate.rate_per_bin}/bin</span>}
                                    {tierBRate && <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}><span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Tier B</span>31–100 bins · LKR {tierBRate.rate_per_bin}/bin</span>}
                                </div>
                            )}
                            {commercialSummaries.map(s => {
                                const isEligible = s.total_bins_this_period > 0 && !s.has_invoice
                                const isSelected = selectedCommercials.has(s.commercial_id)
                                const tierStyle = s.current_tier === 'tier_b' ? { color: '#1d4ed8', bg: '#eff6ff' } : s.current_tier === 'no_activity' ? { color: '#94a3b8', bg: '#f1f5f9' } : { color: '#15803d', bg: '#f0fdf4' }
                                return (
                                    <div key={s.commercial_id} className="row" style={{ background: isSelected ? '#f0fdf4' : undefined, cursor: isEligible ? 'pointer' : 'default' }} onClick={() => isEligible && toggleSelect(s.commercial_id)}>
                                        <div className={`checkbox ${isSelected ? 'checked' : ''}`} style={{ opacity: isEligible ? 1 : 0.3 }}>
                                            {isSelected && <svg style={{ width: 10, height: 10 }} fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 16, color: '#00450d' }}>{(s.organisation_name || s.full_name)?.charAt(0)?.toUpperCase()}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <p style={{ fontSize: 14, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{s.organisation_name || s.full_name}</p>
                                                <span className="badge" style={{ background: tierStyle.bg, color: tierStyle.color }}>{s.current_tier === 'no_activity' ? 'No Activity' : s.current_tier === 'tier_b' ? 'Tier B' : 'Tier A'}</span>
                                                <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>{s.billing_cycle}</span>
                                                {s.has_invoice && <span className="badge" style={{ background: '#f0fdf4', color: '#15803d' }}>✓ Invoice Generated</span>}
                                                {s.billing_suspended && <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>Suspended</span>}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: '#94a3b8' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 13 }}>location_on</span>{s.ward || s.district || 'No location'}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 13 }}>delete_sweep</span>{s.total_bins_this_period} bins · {s.bins_this_week} this week</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                                            {s.total_bins_this_period > 0 ? (
                                                <><p style={{ fontSize: 16, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0 }}>LKR {(s.estimated_amount || 0).toLocaleString()}</p><p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>estimated</p></>
                                            ) : <p style={{ fontSize: 13, color: '#94a3b8' }}>No collections</p>}
                                            {isEligible && (
                                                <button className="gen-btn" disabled={generatingFor === s.commercial_id} onClick={e => { e.stopPropagation(); generateForCommercial(s.commercial_id) }}>
                                                    <span className="msf" style={{ fontSize: 13 }}>receipt</span>
                                                    {generatingFor === s.commercial_id ? '…' : 'Invoice'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </>
                    )}
                </div>
            )}

            {/* ════════ ACCOUNTS TAB ════════ */}
            {activeTab === 'accounts' && (
                <div className="card a3">
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.05)' }}>
                        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 17, color: '#181c22', margin: 0 }}>Commercial Accounts — Service Agreement Status</h3>
                        <p style={{ fontSize: 13, color: '#717a6d', margin: '4px 0 0' }}>Payment health, service status and suspension controls.</p>
                    </div>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                            <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                        </div>
                    ) : commercialSummaries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                            <span className="msf" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 10 }}>business</span>
                            <p style={{ color: '#94a3b8', fontSize: 14 }}>No commercial accounts registered yet</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ padding: '10px 24px', background: '#fafbf9', borderBottom: '1px solid rgba(0,69,13,0.04)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}><span className="badge" style={{ background: '#f0fdf4', color: '#15803d' }}>Active</span>{commercialSummaries.filter(s => !s.billing_suspended).length} accounts</span>
                                <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}><span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>Suspended</span>{commercialSummaries.filter(s => s.billing_suspended).length} accounts</span>
                                <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}><span className="badge" style={{ background: '#fffbeb', color: '#d97706' }}>Outstanding</span>LKR {invoices.filter(i => ['pending', 'overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0).toLocaleString()}</span>
                            </div>
                            {commercialSummaries.map(s => {
                                const accountInvoices = invoices.filter(i => i.commercial_id === s.commercial_id)
                                const overdueCount = accountInvoices.filter(i => i.status === 'overdue').length
                                const pendingAmount = accountInvoices.filter(i => ['pending', 'overdue'].includes(i.status)).reduce((sum, i) => sum + i.amount, 0)
                                const paidAmount = accountInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)
                                const healthStatus = s.billing_suspended ? 'suspended' : overdueCount > 0 ? 'overdue' : pendingAmount > 0 ? 'pending' : 'good'
                                const hc = {
                                    suspended: { color: '#7c3aed', bg: '#faf5ff', label: 'Suspended', icon: 'block' },
                                    overdue: { color: '#ba1a1a', bg: '#fef2f2', label: 'Overdue', icon: 'warning' },
                                    pending: { color: '#d97706', bg: '#fffbeb', label: 'Payment Due', icon: 'pending' },
                                    good: { color: '#15803d', bg: '#f0fdf4', label: 'Good Standing', icon: 'verified' },
                                }[healthStatus]
                                return (
                                    <div key={s.commercial_id} className="row">
                                        <div style={{ width: 42, height: 42, borderRadius: 12, background: hc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="msf" style={{ color: hc.color, fontSize: 20 }}>{hc.icon}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <p style={{ fontSize: 14, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{s.organisation_name || s.full_name}</p>
                                                <span className="badge" style={{ background: hc.bg, color: hc.color }}>{hc.label}</span>
                                                <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>{s.billing_cycle}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: '#94a3b8' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 13 }}>location_on</span>{s.ward || s.district || '—'}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 13 }}>receipt_long</span>{accountInvoices.length} invoice{accountInvoices.length !== 1 ? 's' : ''}</span>
                                                {overdueCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#ba1a1a', fontWeight: 600 }}><span className="msf" style={{ fontSize: 13 }}>warning</span>{overdueCount} overdue</span>}
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#15803d', fontWeight: 600 }}><span className="msf" style={{ fontSize: 13 }}>check_circle</span>Paid: LKR {paidAmount.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                                            {pendingAmount > 0 ? (
                                                <><p style={{ fontSize: 15, fontWeight: 800, color: overdueCount > 0 ? '#ba1a1a' : '#d97706', fontFamily: 'Manrope,sans-serif', margin: 0 }}>LKR {pendingAmount.toLocaleString()}</p><p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>outstanding</p></>
                                            ) : <p style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>No balance due</p>}
                                            <button
                                                className="suspend-btn"
                                                disabled={togglingId === s.commercial_id}
                                                onClick={() => toggleSuspension(s.commercial_id, s.billing_suspended)}
                                                style={{ borderColor: s.billing_suspended ? 'rgba(0,69,13,0.2)' : 'rgba(186,26,26,0.2)', color: s.billing_suspended ? '#15803d' : '#ba1a1a', background: s.billing_suspended ? '#f0fdf4' : '#fef2f2', opacity: togglingId === s.commercial_id ? 0.6 : 1 }}>
                                                <span className="msf" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 4 }}>{s.billing_suspended ? 'lock_open' : 'block'}</span>
                                                {togglingId === s.commercial_id ? '…' : s.billing_suspended ? 'Restore Service' : 'Suspend'}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </>
                    )}
                </div>
            )}

            {/* ════════ INVOICES TAB ════════ */}
            {activeTab === 'invoices' && (
                <div className="card a3">
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.05)' }}>
                        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 17, color: '#181c22', margin: 0 }}>All Invoices</h3>
                        <p style={{ fontSize: 13, color: '#717a6d', margin: '4px 0 0' }}>{invoices.length} total invoices</p>
                    </div>
                    {invoices.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                            <span className="msf" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 10 }}>receipt_long</span>
                            <p style={{ color: '#94a3b8', fontSize: 14 }}>No invoices generated yet</p>
                        </div>
                    ) : invoices.map(invoice => {
                        const ss = STATUS_STYLE[invoice.status] || STATUS_STYLE.unpaid
                        return (
                            <div key={invoice.id} className="row">
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: ss.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span className="msf" style={{ color: ss.color, fontSize: 20 }}>{invoice.status === 'paid' ? 'check_circle' : invoice.status === 'overdue' ? 'warning' : 'receipt'}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <p style={{ fontSize: 14, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{invoice.invoice_number}</p>
                                        <span className="badge" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                                        <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>{invoice.billing_cycle}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#94a3b8' }}>
                                        <span>{(invoice.profiles as any)?.organisation_name || (invoice.profiles as any)?.full_name}</span>
                                        <span>{invoice.total_bins} bins</span>
                                        <span>{new Date(invoice.period_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {new Date(invoice.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                </div>
                                <p style={{ fontSize: 16, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', flexShrink: 0 }}>LKR {invoice.amount.toLocaleString()}</p>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ════════ BILLING RATES TAB ════════ */}
            {activeTab === 'rates' && (
                <div className="card a3">
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.05)' }}>
                        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 17, color: '#181c22', margin: 0 }}>Set Billing Rates</h3>
                        <p style={{ fontSize: 13, color: '#717a6d', margin: '4px 0 0' }}>New rates apply from the effective date. Previous rates are kept for audit.</p>
                    </div>
                    <form onSubmit={saveRates} style={{ padding: '24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                            <div style={{ padding: 20, borderRadius: 14, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: '#15803d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Tier A</p>
                                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>0 – 30 bins per week</p>
                                <label className="field-label">Rate per Bin (LKR)</label>
                                <input type="number" className="form-field" placeholder="e.g. 500" value={rateForm.tier_a_rate} onChange={e => setRateForm({ ...rateForm, tier_a_rate: e.target.value })} min="1" required />
                            </div>
                            <div style={{ padding: 20, borderRadius: 14, background: '#eff6ff', border: '1px solid rgba(29,78,216,0.1)' }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Tier B</p>
                                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>31 – 100 bins per week</p>
                                <label className="field-label">Rate per Bin (LKR)</label>
                                <input type="number" className="form-field" placeholder="e.g. 400" value={rateForm.tier_b_rate} onChange={e => setRateForm({ ...rateForm, tier_b_rate: e.target.value })} min="1" required />
                            </div>
                            <div>
                                <label className="field-label">Effective From</label>
                                <input type="date" className="form-field" value={rateForm.effective_from} onChange={e => setRateForm({ ...rateForm, effective_from: e.target.value })} min={new Date().toISOString().split('T')[0]} required />
                            </div>
                        </div>
                        <button type="submit" disabled={savingRates} className="submit-btn">
                            <span className="msf" style={{ fontSize: 18 }}>{savingRates ? 'hourglass_empty' : 'save'}</span>
                            {savingRates ? 'Saving…' : 'Save Rates'}
                        </button>
                    </form>
                    {rates.length > 0 && (
                        <div style={{ padding: '0 24px 24px' }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Manrope,sans-serif', marginBottom: 12 }}>Rate History</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {rates.slice(0, 6).map(rate => (
                                    <div key={rate.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, background: '#fafbf9', border: '1px solid rgba(0,69,13,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span className="badge" style={{ background: rate.tier === 'tier_b' ? '#eff6ff' : '#f0fdf4', color: rate.tier === 'tier_b' ? '#1d4ed8' : '#15803d' }}>{rate.tier === 'tier_b' ? 'Tier B' : 'Tier A'}</span>
                                            <span style={{ fontSize: 13, color: '#64748b' }}>{rate.min_bins}–{rate.max_bins} bins</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>LKR {rate.rate_per_bin}/bin</span>
                                            <span style={{ fontSize: 12, color: '#94a3b8' }}>From {new Date(rate.effective_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ════════ CYCLE REQUESTS TAB ════════ */}
            {activeTab === 'requests' && (
                <div className="card a3">
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,69,13,0.05)' }}>
                        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 17, color: '#181c22', margin: 0 }}>Billing Cycle Change Requests</h3>
                    </div>
                    {cycleRequests.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                            <span className="msf" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 10 }}>swap_horiz</span>
                            <p style={{ color: '#94a3b8', fontSize: 14 }}>No cycle change requests yet</p>
                        </div>
                    ) : cycleRequests.map(req => (
                        <div key={req.id} className="row">
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <p style={{ fontSize: 14, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{(req.profiles as any)?.organisation_name || (req.profiles as any)?.full_name}</p>
                                    <span className="badge" style={{ background: req.status === 'pending' ? '#fffbeb' : req.status === 'approved' ? '#f0fdf4' : '#fef2f2', color: req.status === 'pending' ? '#d97706' : req.status === 'approved' ? '#15803d' : '#ba1a1a' }}>{req.status}</span>
                                </div>
                                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                                    <span style={{ textTransform: 'capitalize' }}>{req.current_cycle}</span>{' → '}<strong style={{ textTransform: 'capitalize' }}>{req.requested_cycle}</strong>
                                    <span style={{ color: '#94a3b8', marginLeft: 8 }}>Requested {new Date(req.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </p>
                            </div>
                            {req.status === 'pending' && (
                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                    <button onClick={() => reviewCycleRequest(req.id, 'approved', req.commercial_id, req.requested_cycle)} className="action-btn" style={{ borderColor: 'rgba(0,69,13,0.2)', color: '#15803d', background: 'white' }}>Approve</button>
                                    <button onClick={() => reviewCycleRequest(req.id, 'rejected', req.commercial_id, req.requested_cycle)} className="action-btn" style={{ borderColor: 'rgba(186,26,26,0.2)', color: '#ba1a1a', background: 'white' }}>Reject</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </DashboardLayout>
    )
}