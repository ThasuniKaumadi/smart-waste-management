'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
  { label: 'Overview',             href: '/dashboard/admin',                      icon: 'dashboard',         section: 'Main' },
  { label: 'Users',                href: '/dashboard/admin/users',                icon: 'manage_accounts',   section: 'Management' },
  { label: 'Supervisors',          href: '/dashboard/admin/supervisors',           icon: 'supervisor_account',section: 'Management' },
  { label: 'Zones',                href: '/dashboard/admin/zones',                icon: 'map',               section: 'Management' },
  { label: 'Contracts',            href: '/dashboard/admin/contracts',            icon: 'description',       section: 'Management' },
  { label: 'Billing',              href: '/dashboard/admin/billing',              icon: 'payments',          section: 'Finance' },
  { label: 'Contractor Billing',   href: '/dashboard/admin/billing-contractor',   icon: 'receipt_long',      section: 'Finance' },
  { label: 'Commercial Analytics', href: '/dashboard/admin/commercial-analytics', icon: 'store',             section: 'Finance' },
  { label: 'Recycler Analytics',   href: '/dashboard/admin/recycler-analytics',   icon: 'recycling',         section: 'Finance' },
  { label: 'Blockchain',           href: '/dashboard/admin/blockchain',           icon: 'link',              section: 'Analytics' },
  { label: 'Performance',          href: '/dashboard/admin/performance',          icon: 'analytics',         section: 'Analytics' },
  { label: 'Incidents',            href: '/dashboard/admin/incidents',            icon: 'warning',           section: 'Analytics' },
  { label: 'Disposal',             href: '/dashboard/admin/disposal',             icon: 'delete_sweep',      section: 'Analytics' },
  { label: 'Announcements',        href: '/dashboard/admin/announcements',        icon: 'campaign',          section: 'Communications' },
  { label: 'Communications',       href: '/dashboard/admin/communications',       icon: 'chat',              section: 'Communications' },
]

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    unpaid: { color: '#d97706', bg: '#fefce8', label: 'Unpaid' },
    paid: { color: '#00450d', bg: '#f0fdf4', label: 'Paid' },
    overdue: { color: '#ba1a1a', bg: '#fef2f2', label: 'Overdue' },
    suspended: { color: '#7c3aed', bg: '#f5f3ff', label: 'Suspended' },
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
            if (data.error) setMessage('Error: ' + data.error)
            else setMessage(data.count > 0 ? 'Invoice generated successfully!' : 'No billable activity found for this period.')
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

    // R37 — manual suspension toggle
    async function toggleSuspension(commercialId: string, currentlySuspended: boolean) {
        setTogglingId(commercialId)
        const supabase = createClient()
        const { error } = await supabase.from('profiles').update({ billing_suspended: !currentlySuspended }).eq('id', commercialId)
        if (error) {
            setMessage('Error: ' + error.message)
        } else {
            setMessage(currentlySuspended
                ? '✓ Service restored. Account is now active.'
                : '⚠ Account suspended. Commercial user will see a suspension notice on their billing page.')
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
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .tab-btn { padding:8px 20px; border-radius:99px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s ease; display:flex; align-items:center; gap:6px; }
        .tab-btn.active { background:#00450d; color:white; }
        .tab-btn:not(.active) { background:#f1f5f9; color:#64748b; }
        .tab-btn:not(.active):hover { background:#e2e8f0; }
        .form-field { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafafa; transition:all 0.2s ease; outline:none; box-sizing:border-box; }
        .form-field:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .field-label { display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#374151; font-family:'Manrope',sans-serif; margin-bottom:7px; }
        .submit-btn { background:#00450d; color:white; border:none; border-radius:10px; padding:13px 24px; font-family:'Manrope',sans-serif; font-weight:700; font-size:14px; cursor:pointer; transition:all 0.2s ease; display:flex; align-items:center; gap:8px; }
        .submit-btn:hover { background:#1b5e20; box-shadow:0 4px 16px rgba(0,69,13,0.25); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.08em; text-transform:uppercase; white-space:nowrap; }
        .row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; transition:background 0.2s; }
        .row:hover { background:#f9f9ff; }
        .row:last-child { border-bottom:none; }
        .action-btn { padding:6px 14px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.2s ease; border:1.5px solid; white-space:nowrap; }
        .gen-btn { padding:7px 14px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.2s ease; border:none; background:#00450d; color:white; white-space:nowrap; display:flex; align-items:center; gap:5px; }
        .gen-btn:hover { background:#1b5e20; }
        .gen-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .suspend-btn { padding:6px 14px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.2s ease; white-space:nowrap; border:1.5px solid; }
        .checkbox { width:18px; height:18px; border-radius:5px; border:2px solid #e5e7eb; background:white; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; flex-shrink:0; }
        .checkbox.checked { background:#00450d; border-color:#00450d; }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1 { animation:staggerIn 0.5s ease 0.05s both; }
        .s2 { animation:staggerIn 0.5s ease 0.1s both; }
        .s3 { animation:staggerIn 0.5s ease 0.15s both; }
      `}</style>

            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>System Administration · Billing Management</span>
                <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Billing <span style={{ color: '#1b5e20' }}>Management</span>
                </h1>
            </section>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
                {[
                    { label: 'Total Revenue', value: `LKR ${totalRevenue.toLocaleString()}`, icon: 'payments', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Outstanding', value: `LKR ${totalOutstanding.toLocaleString()}`, icon: 'warning', color: totalOutstanding > 0 ? '#ba1a1a' : '#00450d', bg: totalOutstanding > 0 ? '#fef2f2' : '#f0fdf4' },
                    { label: 'Active Commercials', value: activeCommercials.length, icon: 'storefront', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Suspended Accounts', value: commercialSummaries.filter(s => s.billing_suspended).length, icon: 'block', color: '#7c3aed', bg: '#f5f3ff' },
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

            {message && (
                <div className="mb-6 flex items-center gap-3 p-4 rounded-xl text-sm"
                    style={{ background: message.startsWith('Error') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${message.startsWith('Error') ? 'rgba(186,26,26,0.2)' : 'rgba(0,69,13,0.15)'}`, color: message.startsWith('Error') ? '#ba1a1a' : '#00450d' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
                    {message}
                    <button onClick={() => setMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }} className="s3">
                {[
                    { key: 'overview', label: 'Collection Overview', icon: 'storefront' },
                    { key: 'accounts', label: 'Accounts', icon: 'business' },
                    { key: 'invoices', label: 'Invoices', icon: 'receipt_long' },
                    { key: 'rates', label: 'Billing Rates', icon: 'price_change' },
                    { key: 'requests', label: `Cycle Requests${pendingRequests > 0 ? ` (${pendingRequests})` : ''}`, icon: 'swap_horiz' },
                ].map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key as any)} className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <div className="bento-card">
                    <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                        <div>
                            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Collection Activity — {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
                            <p className="text-sm mt-1" style={{ color: '#717a6d' }}>Bin counts per commercial establishment this period.</p>
                        </div>
                        {eligibleForInvoice.length > 0 && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button onClick={toggleSelectAll} style={{ padding: '8px 16px', borderRadius: '99px', border: '1.5px solid rgba(0,69,13,0.2)', background: 'white', color: '#00450d', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', cursor: 'pointer' }}>
                                    {selectedCommercials.size === eligibleForInvoice.length ? 'Deselect All' : 'Select All'}
                                </button>
                                {selectedCommercials.size > 0 && (
                                    <button onClick={generateSelected} disabled={generatingAll} className="submit-btn" style={{ padding: '9px 20px', fontSize: '13px' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>receipt_long</span>
                                        {generatingAll ? 'Generating...' : `Generate ${selectedCommercials.size} Invoice${selectedCommercials.size > 1 ? 's' : ''}`}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} /></div>
                    ) : commercialSummaries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '48px', marginBottom: '12px' }}>storefront</span>
                            <p style={{ color: '#94a3b8', fontSize: '14px' }}>No commercial establishments registered yet</p>
                        </div>
                    ) : (
                        <div>
                            {(tierARate || tierBRate) && (
                                <div style={{ padding: '12px 24px', background: '#f9f9ff', borderBottom: '1px solid rgba(0,69,13,0.04)', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                    {tierARate && <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}><span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>Tier A</span>0–30 bins · LKR {tierARate.rate_per_bin}/bin</span>}
                                    {tierBRate && <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}><span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Tier B</span>31–100 bins · LKR {tierBRate.rate_per_bin}/bin</span>}
                                </div>
                            )}
                            {commercialSummaries.map(s => {
                                const isEligible = s.total_bins_this_period > 0 && !s.has_invoice
                                const isSelected = selectedCommercials.has(s.commercial_id)
                                const tierStyle = s.current_tier === 'tier_b' ? { color: '#1d4ed8', bg: '#eff6ff' } : s.current_tier === 'no_activity' ? { color: '#94a3b8', bg: '#f1f5f9' } : { color: '#00450d', bg: '#f0fdf4' }
                                return (
                                    <div key={s.commercial_id} className="row" style={{ background: isSelected ? '#f0fdf4' : undefined, cursor: isEligible ? 'pointer' : 'default' }} onClick={() => isEligible && toggleSelect(s.commercial_id)}>
                                        <div className={`checkbox ${isSelected ? 'checked' : ''}`} style={{ opacity: isEligible ? 1 : 0.3 }}>
                                            {isSelected && <svg style={{ width: '10px', height: '10px' }} fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '16px', color: '#00450d' }}>{(s.organisation_name || s.full_name)?.charAt(0)?.toUpperCase()}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{s.organisation_name || s.full_name}</p>
                                                <span className="badge" style={{ background: tierStyle.bg, color: tierStyle.color }}>{s.current_tier === 'no_activity' ? 'No Activity' : s.current_tier === 'tier_b' ? 'Tier B' : 'Tier A'}</span>
                                                <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>{s.billing_cycle}</span>
                                                {s.has_invoice && <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>✓ Invoice Generated</span>}
                                                {s.billing_suspended && <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>Suspended</span>}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: '#94a3b8' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>{s.ward || s.district || 'No location'}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>delete_sweep</span>{s.total_bins_this_period} bins · {s.bins_this_week} this week</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                                            {s.total_bins_this_period > 0 ? (<><p style={{ fontSize: '16px', fontWeight: 800, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>LKR {(s.estimated_amount || 0).toLocaleString()}</p><p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>estimated</p></>) : (<p style={{ fontSize: '13px', color: '#94a3b8' }}>No collections</p>)}
                                            {isEligible && (<button className="gen-btn" disabled={generatingFor === s.commercial_id} onClick={e => { e.stopPropagation(); generateForCommercial(s.commercial_id) }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>receipt</span>{generatingFor === s.commercial_id ? '...' : 'Invoice'}</button>)}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ACCOUNTS TAB — R37 suspension toggle added */}
            {activeTab === 'accounts' && (
                <div className="bento-card">
                    <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Commercial Accounts — Service Agreement Status</h3>
                        <p className="text-sm mt-1" style={{ color: '#717a6d' }}>Payment health, service status and suspension controls for all commercial establishments.</p>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} /></div>
                    ) : commercialSummaries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '48px', marginBottom: '12px' }}>business</span>
                            <p style={{ color: '#94a3b8', fontSize: '14px' }}>No commercial accounts registered yet</p>
                        </div>
                    ) : (
                        <div>
                            <div style={{ padding: '12px 24px', background: '#f9f9ff', borderBottom: '1px solid rgba(0,69,13,0.04)', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>Active</span>
                                    {commercialSummaries.filter(s => !s.billing_suspended).length} accounts
                                </span>
                                <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>Suspended</span>
                                    {commercialSummaries.filter(s => s.billing_suspended).length} accounts
                                </span>
                                <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="badge" style={{ background: '#fefce8', color: '#d97706' }}>Outstanding</span>
                                    LKR {invoices.filter(i => ['pending', 'overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0).toLocaleString()}
                                </span>
                            </div>
                            {commercialSummaries.map(s => {
                                const accountInvoices = invoices.filter(i => i.commercial_id === s.commercial_id)
                                const overdueCount = accountInvoices.filter(i => i.status === 'overdue').length
                                const pendingAmount = accountInvoices.filter(i => ['pending', 'overdue'].includes(i.status)).reduce((sum, i) => sum + i.amount, 0)
                                const paidAmount = accountInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)
                                const healthStatus = s.billing_suspended ? 'suspended' : overdueCount > 0 ? 'overdue' : pendingAmount > 0 ? 'pending' : 'good'
                                const healthConfig = {
                                    suspended: { color: '#7c3aed', bg: '#f5f3ff', label: 'Suspended', icon: 'block' },
                                    overdue: { color: '#ba1a1a', bg: '#fef2f2', label: 'Overdue', icon: 'warning' },
                                    pending: { color: '#d97706', bg: '#fffbeb', label: 'Payment Due', icon: 'pending' },
                                    good: { color: '#00450d', bg: '#f0fdf4', label: 'Good Standing', icon: 'verified' },
                                }[healthStatus]
                                return (
                                    <div key={s.commercial_id} className="row">
                                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: healthConfig.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="material-symbols-outlined" style={{ color: healthConfig.color, fontSize: '20px' }}>{healthConfig.icon}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{s.organisation_name || s.full_name}</p>
                                                <span className="badge" style={{ background: healthConfig.bg, color: healthConfig.color }}>{healthConfig.label}</span>
                                                <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>{s.billing_cycle}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: '#94a3b8' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>{s.ward || s.district || '—'}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>receipt_long</span>{accountInvoices.length} invoice{accountInvoices.length !== 1 ? 's' : ''}</span>
                                                {overdueCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#ba1a1a', fontWeight: 600 }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>warning</span>{overdueCount} overdue</span>}
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#16a34a', fontWeight: 600 }}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>Paid: LKR {paidAmount.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                                            {pendingAmount > 0 ? (
                                                <><p style={{ fontSize: '15px', fontWeight: 800, color: overdueCount > 0 ? '#ba1a1a' : '#d97706', fontFamily: 'Manrope, sans-serif' }}>LKR {pendingAmount.toLocaleString()}</p><p style={{ fontSize: '11px', color: '#94a3b8' }}>outstanding</p></>
                                            ) : (
                                                <p style={{ fontSize: '13px', color: '#00450d', fontWeight: 600 }}>No balance due</p>
                                            )}
                                            {/* R37 — Suspension toggle */}
                                            <button
                                                className="suspend-btn"
                                                disabled={togglingId === s.commercial_id}
                                                onClick={() => toggleSuspension(s.commercial_id, s.billing_suspended)}
                                                style={{
                                                    borderColor: s.billing_suspended ? 'rgba(0,69,13,0.2)' : 'rgba(186,26,26,0.2)',
                                                    color: s.billing_suspended ? '#00450d' : '#ba1a1a',
                                                    background: s.billing_suspended ? '#f0fdf4' : '#fef2f2',
                                                    opacity: togglingId === s.commercial_id ? 0.6 : 1,
                                                }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '12px', verticalAlign: 'middle', marginRight: '4px' }}>
                                                    {s.billing_suspended ? 'lock_open' : 'block'}
                                                </span>
                                                {togglingId === s.commercial_id ? '...' : s.billing_suspended ? 'Restore Service' : 'Suspend'}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* INVOICES TAB */}
            {activeTab === 'invoices' && (
                <div className="bento-card">
                    <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>All Invoices</h3>
                        <p className="text-sm mt-1" style={{ color: '#717a6d' }}>{invoices.length} total invoices</p>
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
                                            <span className="material-symbols-outlined" style={{ color: ss.color, fontSize: '20px' }}>{invoice.status === 'paid' ? 'check_circle' : invoice.status === 'overdue' ? 'warning' : 'receipt'}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{invoice.invoice_number}</p>
                                                <span className="badge" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                                                <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>{invoice.billing_cycle}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                                                <span>{(invoice.profiles as any)?.organisation_name || (invoice.profiles as any)?.full_name}</span>
                                                <span>{invoice.total_bins} bins</span>
                                                <span>{new Date(invoice.period_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {new Date(invoice.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: '16px', fontWeight: 800, color: '#181c22', fontFamily: 'Manrope, sans-serif', flexShrink: 0 }}>LKR {invoice.amount.toLocaleString()}</p>
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
                        <p className="text-sm mt-1" style={{ color: '#717a6d' }}>New rates apply from the effective date. Previous rates are kept for audit.</p>
                    </div>
                    <form onSubmit={saveRates} className="p-8">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div style={{ padding: '20px', borderRadius: '14px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                                <p style={{ fontSize: '12px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Tier A</p>
                                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>0 – 30 bins per week</p>
                                <label className="field-label">Rate per Bin (LKR) *</label>
                                <input type="number" className="form-field" placeholder="e.g. 500" value={rateForm.tier_a_rate} onChange={e => setRateForm({ ...rateForm, tier_a_rate: e.target.value })} min="1" required />
                            </div>
                            <div style={{ padding: '20px', borderRadius: '14px', background: '#eff6ff', border: '1px solid rgba(29,78,216,0.1)' }}>
                                <p style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Tier B</p>
                                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>31 – 100 bins per week</p>
                                <label className="field-label">Rate per Bin (LKR) *</label>
                                <input type="number" className="form-field" placeholder="e.g. 400" value={rateForm.tier_b_rate} onChange={e => setRateForm({ ...rateForm, tier_b_rate: e.target.value })} min="1" required />
                            </div>
                            <div>
                                <label className="field-label">Effective From *</label>
                                <input type="date" className="form-field" value={rateForm.effective_from} onChange={e => setRateForm({ ...rateForm, effective_from: e.target.value })} min={new Date().toISOString().split('T')[0]} required />
                            </div>
                        </div>
                        <button type="submit" disabled={savingRates} className="submit-btn">
                            {savingRates ? 'Saving...' : <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>Save Rates</>}
                        </button>
                    </form>
                    {rates.length > 0 && (
                        <div style={{ padding: '0 24px 24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: '#717a6d', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif', marginBottom: '12px' }}>Rate History</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {rates.slice(0, 6).map(rate => (
                                    <div key={rate.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: '#f9f9ff', border: '1px solid rgba(0,69,13,0.04)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span className="badge" style={{ background: rate.tier === 'tier_b' ? '#eff6ff' : '#f0fdf4', color: rate.tier === 'tier_b' ? '#1d4ed8' : '#00450d' }}>{rate.tier === 'tier_b' ? 'Tier B' : 'Tier A'}</span>
                                            <span style={{ fontSize: '13px', color: '#64748b' }}>{rate.min_bins}–{rate.max_bins} bins</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>LKR {rate.rate_per_bin}/bin</span>
                                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>From {new Date(rate.effective_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
                                            <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{(req.profiles as any)?.organisation_name || (req.profiles as any)?.full_name}</p>
                                            <span className="badge" style={{ background: req.status === 'pending' ? '#fefce8' : req.status === 'approved' ? '#f0fdf4' : '#fef2f2', color: req.status === 'pending' ? '#d97706' : req.status === 'approved' ? '#00450d' : '#ba1a1a' }}>{req.status}</span>
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#64748b' }}>
                                            <span style={{ textTransform: 'capitalize' }}>{req.current_cycle}</span>{' → '}<strong style={{ textTransform: 'capitalize' }}>{req.requested_cycle}</strong>
                                            <span style={{ color: '#94a3b8', marginLeft: '8px' }}>Requested {new Date(req.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </p>
                                    </div>
                                    {req.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                            <button onClick={() => reviewCycleRequest(req.id, 'approved', req.commercial_id, req.requested_cycle)} className="action-btn" style={{ borderColor: 'rgba(0,69,13,0.2)', color: '#00450d', background: 'white' }}>Approve</button>
                                            <button onClick={() => reviewCycleRequest(req.id, 'rejected', req.commercial_id, req.requested_cycle)} className="action-btn" style={{ borderColor: 'rgba(186,26,26,0.2)', color: '#ba1a1a', background: 'white' }}>Reject</button>
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