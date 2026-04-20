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
    contractor?: { full_name: string; organisation_name: string; phone: string; email: string }
}

type Renewal = {
    id: string
    contract_id: string
    contractor_id: string
    proposed_start_date: string
    proposed_end_date: string
    proposed_monthly_amount: number
    reason: string
    status: string
    admin_notes: string
    created_at: string
    contractor?: { full_name: string; organisation_name: string }
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

const EMPTY_FORM = {
    contract_number: '',
    contractor_id: '',
    start_date: '',
    end_date: '',
    wards_covered: '',
    districts_covered: '',
    kpi_collection_rate: '95',
    kpi_ontime_rate: '90',
    kpi_complaint_limit: '5',
    status: 'active',
    terms_and_conditions: '',
    monthly_payment_amount: '',
    payment_terms: '',
}

export default function AdminContractsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [contracts, setContracts] = useState<Contract[]>([])
    const [renewals, setRenewals] = useState<Renewal[]>([])
    const [contractors, setContractors] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'contracts' | 'renewals'>('contracts')
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
    const [selectedRenewal, setSelectedRenewal] = useState<Renewal | null>(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [adminNote, setAdminNote] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Load contracts with contractor profile
        const { data: contractsData } = await supabase
            .from('contracts')
            .select('*, contractor:profiles!contracts_contractor_id_fkey(full_name, organisation_name, phone)')
            .order('created_at', { ascending: false })
        setContracts(contractsData || [])

        // Load renewals with contractor profile
        const { data: renewalsData } = await supabase
            .from('contract_renewals')
            .select('*, contractor:profiles!contract_renewals_contractor_id_fkey(full_name, organisation_name)')
            .order('created_at', { ascending: false })
        setRenewals(renewalsData || [])

        // Load all contractors for the create form
        const { data: contractorsData } = await supabase
            .from('profiles')
            .select('id, full_name, organisation_name')
            .eq('role', 'contractor')
            .eq('is_approved', true)
        setContractors(contractorsData || [])

        setLoading(false)
    }

    async function createContract() {
        if (!form.contract_number || !form.contractor_id || !form.start_date || !form.end_date) {
            setErrorMsg('Please fill in all required fields.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('contracts').insert({
            contract_number: form.contract_number,
            contractor_id: form.contractor_id,
            start_date: form.start_date,
            end_date: form.end_date,
            wards_covered: form.wards_covered.split(',').map(w => w.trim()).filter(Boolean),
            districts_covered: form.districts_covered.split(',').map(d => d.trim()).filter(Boolean),
            kpi_collection_rate: parseFloat(form.kpi_collection_rate),
            kpi_ontime_rate: parseFloat(form.kpi_ontime_rate),
            kpi_complaint_limit: parseInt(form.kpi_complaint_limit),
            status: form.status,
            terms_and_conditions: form.terms_and_conditions,
            monthly_payment_amount: form.monthly_payment_amount ? parseFloat(form.monthly_payment_amount) : null,
            payment_terms: form.payment_terms,
            created_by: user.id,
        })

        if (error) {
            setErrorMsg('Failed to create contract: ' + error.message)
        } else {
            setSuccessMsg('Contract created successfully.')
            setShowCreateForm(false)
            setForm(EMPTY_FORM)
            loadData()
        }
        setSubmitting(false)
    }

    async function updateContractStatus(contractId: string, newStatus: string) {
        const supabase = createClient()
        const { error } = await supabase
            .from('contracts')
            .update({ status: newStatus })
            .eq('id', contractId)
        if (!error) {
            setSuccessMsg('Contract status updated.')
            setSelectedContract(null)
            loadData()
        }
    }

    async function reviewRenewal(renewalId: string, newStatus: 'approved' | 'rejected' | 'under_review') {
        setSubmitting(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase
            .from('contract_renewals')
            .update({
                status: newStatus,
                admin_notes: adminNote,
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', renewalId)

        // If approved, also update the contract dates
        if (!error && newStatus === 'approved' && selectedRenewal) {
            const renewal = renewals.find(r => r.id === renewalId)
            if (renewal) {
                await supabase.from('contracts')
                    .update({
                        start_date: renewal.proposed_start_date,
                        end_date: renewal.proposed_end_date,
                        monthly_payment_amount: renewal.proposed_monthly_amount || undefined,
                        status: 'active',
                    })
                    .eq('id', renewal.contract_id)
            }
        }

        if (!error) {
            setSuccessMsg(`Renewal request ${newStatus}.`)
            setSelectedRenewal(null)
            setAdminNote('')
            loadData()
        }
        setSubmitting(false)
    }

    const filteredContracts = filterStatus === 'all'
        ? contracts
        : contracts.filter(c => c.status === filterStatus)

    const pendingRenewals = renewals.filter(r => r.status === 'pending')

    const stats = {
        total: contracts.length,
        active: contracts.filter(c => c.status === 'active').length,
        expiring: contracts.filter(c => c.status === 'expiring_soon').length,
        expired: contracts.filter(c => c.status === 'expired').length,
        pendingRenewals: pendingRenewals.length,
    }

    return (
        <DashboardLayout
            role="Admin"
            userName={profile?.full_name || ''}
            navItems={ADMIN_NAV}
            primaryAction={{ label: 'New Contract', href: '#', icon: 'add' }}
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
        .contract-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .contract-row:hover { background:#f9fafb; }
        .contract-row:last-child { border-bottom:none; }
        .renewal-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .renewal-row:hover { background:#f9fafb; }
        .renewal-row:last-child { border-bottom:none; }
        .form-input { width:100%; padding:10px 14px; border-radius:10px; border:1.5px solid rgba(0,69,13,0.15); font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:white; color:#181c22; }
        .form-input:focus { border-color:#00450d; }
        .form-label { font-size:12px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.05em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#00450d; color:white; border:none; padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity 0.2s; }
        .btn-primary:hover { opacity:0.88; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
        .btn-danger { background:#fef2f2; color:#ba1a1a; border:1.5px solid rgba(186,26,26,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-danger:hover { background:#ffdad6; }
        .filter-btn { padding:6px 14px; border-radius:8px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:1.5px solid transparent; transition:all 0.2s; }
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
                            Contract <span style={{ color: '#1b5e20' }}>Management</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Manage all contractor service agreements with CMC
                        </p>
                    </div>
                    <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                        New Contract
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
                    {/* Success/Error */}
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

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 s2">
                        {[
                            { label: 'Total', value: stats.total, color: '#00450d', bg: '#f0fdf4', icon: 'description' },
                            { label: 'Active', value: stats.active, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                            { label: 'Expiring', value: stats.expiring, color: '#d97706', bg: '#fefce8', icon: 'warning' },
                            { label: 'Expired', value: stats.expired, color: '#ba1a1a', bg: '#fef2f2', icon: 'cancel' },
                            { label: 'Pending Renewals', value: stats.pendingRenewals, color: '#0369a1', bg: '#f0f9ff', icon: 'autorenew' },
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
                        <button className={`tab-btn ${activeTab === 'contracts' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('contracts')}>
                            Contracts ({contracts.length})
                        </button>
                        <button className={`tab-btn ${activeTab === 'renewals' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('renewals')}>
                            Renewal Requests
                            {pendingRenewals.length > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                                    style={{ background: '#fef2f2', color: '#ba1a1a' }}>
                                    {pendingRenewals.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Contracts Tab */}
                    {activeTab === 'contracts' && (
                        <div className="bento-card s4">
                            {/* Filter bar */}
                            <div className="px-6 py-4 flex items-center gap-2 flex-wrap"
                                style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                {['all', 'active', 'expiring_soon', 'expired', 'draft', 'terminated'].map(f => {
                                    const active = filterStatus === f
                                    return (
                                        <button key={f} className="filter-btn"
                                            onClick={() => setFilterStatus(f)}
                                            style={{
                                                background: active ? '#00450d' : '#f8fafc',
                                                color: active ? 'white' : '#64748b',
                                                borderColor: active ? '#00450d' : 'rgba(0,69,13,0.1)',
                                            }}>
                                            {f === 'all' ? 'All' : f.replace('_', ' ')}
                                        </button>
                                    )
                                })}
                            </div>

                            {filteredContracts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>description</span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No contracts found</p>
                                    <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Create a new contract to get started</p>
                                </div>
                            ) : (
                                filteredContracts.map(c => {
                                    const s = statusStyle(c.status)
                                    const contractorName = c.contractor?.organisation_name || c.contractor?.full_name || 'Unknown'
                                    return (
                                        <div key={c.id} className="contract-row" onClick={() => setSelectedContract(c)}>
                                            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: s.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '22px' }}>description</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22' }}>{c.contract_number}</p>
                                                    <span className="status-badge" style={{ background: s.bg, color: s.color }}>
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                                                        {c.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                                    {contractorName} · {c.districts_covered?.join(', ')} · {c.wards_covered?.length} wards
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm font-bold" style={{ color: '#00450d' }}>
                                                    LKR {c.monthly_payment_amount?.toLocaleString()}
                                                </p>
                                                <p className="text-xs" style={{ color: '#94a3b8' }}>
                                                    {new Date(c.start_date).toLocaleDateString('en-GB')} – {new Date(c.end_date).toLocaleDateString('en-GB')}
                                                </p>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>
                                                chevron_right
                                            </span>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* Renewals Tab */}
                    {activeTab === 'renewals' && (
                        <div className="bento-card s4">
                            {renewals.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>autorenew</span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No renewal requests</p>
                                    <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Contractor renewal requests will appear here</p>
                                </div>
                            ) : (
                                renewals.map(r => {
                                    const rs = renewalStatusStyle(r.status)
                                    const contractorName = r.contractor?.organisation_name || r.contractor?.full_name || 'Unknown'
                                    return (
                                        <div key={r.id} className="renewal-row" onClick={() => { setSelectedRenewal(r); setAdminNote(r.admin_notes || '') }}>
                                            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: rs.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: rs.color, fontSize: '22px' }}>autorenew</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22' }}>{contractorName}</p>
                                                    <span className="status-badge" style={{ background: rs.bg, color: rs.color }}>
                                                        {r.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <p className="text-xs truncate" style={{ color: '#717a6d' }}>{r.reason}</p>
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
                                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>
                                                chevron_right
                                            </span>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* Contract Detail Modal */}
                    {selectedContract && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-2xl bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            {selectedContract.contract_number}
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            {selectedContract.contractor?.organisation_name || selectedContract.contractor?.full_name}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedContract(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    {[
                                        { label: 'Start Date', value: new Date(selectedContract.start_date).toLocaleDateString('en-GB') },
                                        { label: 'End Date', value: new Date(selectedContract.end_date).toLocaleDateString('en-GB') },
                                        { label: 'Monthly Amount', value: `LKR ${selectedContract.monthly_payment_amount?.toLocaleString()}` },
                                        { label: 'Status', value: selectedContract.status.replace('_', ' ') },
                                        { label: 'Collection KPI', value: `Min ${selectedContract.kpi_collection_rate}%` },
                                        { label: 'On-Time KPI', value: `Min ${selectedContract.kpi_ontime_rate}%` },
                                    ].map(item => (
                                        <div key={item.label} className="p-4 rounded-xl" style={{ background: '#f8fafc' }}>
                                            <p className="text-xs font-bold uppercase mb-1"
                                                style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                                {item.label}
                                            </p>
                                            <p className="text-sm font-semibold" style={{ color: '#181c22' }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mb-6">
                                    <p className="text-xs font-bold uppercase mb-2"
                                        style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                        Wards Covered
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedContract.wards_covered?.map(w => (
                                            <span key={w} className="px-3 py-1 rounded-lg text-xs font-medium"
                                                style={{ background: '#f0fdf4', color: '#00450d' }}>{w}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <p className="text-xs font-bold uppercase mb-2"
                                        style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                        Update Status
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {['active', 'expiring_soon', 'terminated', 'expired'].map(s => {
                                            const st = statusStyle(s)
                                            return (
                                                <button key={s}
                                                    onClick={() => updateContractStatus(selectedContract.id, s)}
                                                    className="filter-btn"
                                                    style={{ background: st.bg, color: st.color, borderColor: 'transparent' }}>
                                                    {s.replace('_', ' ')}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <button className="btn-secondary w-full justify-center" onClick={() => setSelectedContract(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Renewal Review Modal */}
                    {selectedRenewal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Review Renewal</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            {selectedRenewal.contractor?.organisation_name || selectedRenewal.contractor?.full_name}
                                        </p>
                                    </div>
                                    <button onClick={() => { setSelectedRenewal(null); setAdminNote('') }}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    {[
                                        { label: 'Proposed Start', value: new Date(selectedRenewal.proposed_start_date).toLocaleDateString('en-GB') },
                                        { label: 'Proposed End', value: new Date(selectedRenewal.proposed_end_date).toLocaleDateString('en-GB') },
                                        { label: 'Proposed Amount', value: selectedRenewal.proposed_monthly_amount ? `LKR ${selectedRenewal.proposed_monthly_amount.toLocaleString()}` : 'Not specified' },
                                        { label: 'Submitted', value: new Date(selectedRenewal.created_at).toLocaleDateString('en-GB') },
                                    ].map(item => (
                                        <div key={item.label} className="p-4 rounded-xl" style={{ background: '#f8fafc' }}>
                                            <p className="text-xs font-bold uppercase mb-1"
                                                style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                                {item.label}
                                            </p>
                                            <p className="text-sm font-semibold" style={{ color: '#181c22' }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 rounded-xl mb-6" style={{ background: '#f8fafc' }}>
                                    <p className="text-xs font-bold uppercase mb-2"
                                        style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                        Reason
                                    </p>
                                    <p className="text-sm" style={{ color: '#4b5563', fontFamily: 'Inter, sans-serif' }}>
                                        {selectedRenewal.reason}
                                    </p>
                                </div>

                                <div className="mb-6">
                                    <label className="form-label">Admin Notes (optional)</label>
                                    <textarea className="form-input" rows={3}
                                        placeholder="Add notes or conditions for the contractor..."
                                        value={adminNote}
                                        onChange={e => setAdminNote(e.target.value)}
                                        style={{ resize: 'vertical' }} />
                                </div>

                                {selectedRenewal.status === 'pending' || selectedRenewal.status === 'under_review' ? (
                                    <div className="flex gap-3">
                                        <button className="btn-danger flex-1 justify-center"
                                            onClick={() => reviewRenewal(selectedRenewal.id, 'rejected')}
                                            disabled={submitting}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                            Reject
                                        </button>
                                        <button className="btn-secondary flex-1 justify-center"
                                            onClick={() => reviewRenewal(selectedRenewal.id, 'under_review')}
                                            disabled={submitting}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>pending</span>
                                            Under Review
                                        </button>
                                        <button className="btn-primary flex-1 justify-center"
                                            onClick={() => reviewRenewal(selectedRenewal.id, 'approved')}
                                            disabled={submitting}>
                                            {submitting ? (
                                                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                    style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                            ) : (
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                                            )}
                                            Approve
                                        </button>
                                    </div>
                                ) : (
                                    <button className="btn-secondary w-full justify-center"
                                        onClick={() => { setSelectedRenewal(null); setAdminNote('') }}>
                                        Close
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Create Contract Modal */}
                    {showCreateForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-2xl bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Create New Contract</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>Set up a new service agreement with a contractor</p>
                                    </div>
                                    <button onClick={() => { setShowCreateForm(false); setForm(EMPTY_FORM); setErrorMsg('') }}
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
                                            <label className="form-label">Contract Number *</label>
                                            <input className="form-input" placeholder="e.g. CMC-CON-2025-002"
                                                value={form.contract_number}
                                                onChange={e => setForm(f => ({ ...f, contract_number: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Contractor *</label>
                                            <select className="form-input"
                                                value={form.contractor_id}
                                                onChange={e => setForm(f => ({ ...f, contractor_id: e.target.value }))}>
                                                <option value="">Select contractor...</option>
                                                {contractors.map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.organisation_name || c.full_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Start Date *</label>
                                            <input type="date" className="form-input"
                                                value={form.start_date}
                                                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">End Date *</label>
                                            <input type="date" className="form-input"
                                                value={form.end_date}
                                                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="form-label">Districts Covered (comma separated)</label>
                                        <input className="form-input" placeholder="e.g. Colombo, Dehiwala"
                                            value={form.districts_covered}
                                            onChange={e => setForm(f => ({ ...f, districts_covered: e.target.value }))} />
                                    </div>

                                    <div>
                                        <label className="form-label">Wards Covered (comma separated)</label>
                                        <input className="form-input" placeholder="e.g. Ward 1, Ward 2, Ward 3"
                                            value={form.wards_covered}
                                            onChange={e => setForm(f => ({ ...f, wards_covered: e.target.value }))} />
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="form-label">Collection KPI (%)</label>
                                            <input type="number" className="form-input" min="0" max="100"
                                                value={form.kpi_collection_rate}
                                                onChange={e => setForm(f => ({ ...f, kpi_collection_rate: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">On-Time KPI (%)</label>
                                            <input type="number" className="form-input" min="0" max="100"
                                                value={form.kpi_ontime_rate}
                                                onChange={e => setForm(f => ({ ...f, kpi_ontime_rate: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Complaint Limit</label>
                                            <input type="number" className="form-input" min="0"
                                                value={form.kpi_complaint_limit}
                                                onChange={e => setForm(f => ({ ...f, kpi_complaint_limit: e.target.value }))} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Monthly Amount (LKR)</label>
                                            <input type="number" className="form-input" placeholder="e.g. 150000"
                                                value={form.monthly_payment_amount}
                                                onChange={e => setForm(f => ({ ...f, monthly_payment_amount: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Status</label>
                                            <select className="form-input"
                                                value={form.status}
                                                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                                <option value="draft">Draft</option>
                                                <option value="active">Active</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="form-label">Payment Terms</label>
                                        <input className="form-input" placeholder="e.g. Monthly payment on the 15th upon invoice approval"
                                            value={form.payment_terms}
                                            onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} />
                                    </div>

                                    <div>
                                        <label className="form-label">Terms & Conditions</label>
                                        <textarea className="form-input" rows={4}
                                            placeholder="Enter contract terms and conditions..."
                                            value={form.terms_and_conditions}
                                            onChange={e => setForm(f => ({ ...f, terms_and_conditions: e.target.value }))}
                                            style={{ resize: 'vertical' }} />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setShowCreateForm(false); setForm(EMPTY_FORM); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={createContract} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                                                Create Contract
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