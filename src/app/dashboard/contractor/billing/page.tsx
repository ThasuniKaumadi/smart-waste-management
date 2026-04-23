'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
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

type Invoice = {
    id: string
    invoice_number: string
    contractor_id: string
    contract_id: string
    period_start: string
    period_end: string
    trips_completed: number
    tonnage_collected: number
    subtotal: number
    tax_amount: number
    total_amount: number
    status: string
    due_date: string
    submitted_at: string
    admin_notes: string
    paid_at: string
    payment_reference: string
    created_at: string
}

type LineItem = {
    id: string
    invoice_id: string
    description: string
    quantity: number
    unit_price: number
    total: number
}

type Payment = {
    id: string
    invoice_id: string
    amount_paid: number
    payment_date: string
    payment_reference: string
    payment_method: string
    notes: string
}

function statusStyle(status: string) {
    switch (status) {
        case 'draft': return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: 'Draft' }
        case 'submitted': return { bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8', label: 'Submitted' }
        case 'under_review': return { bg: '#fefce8', color: '#92400e', dot: '#d97706', label: 'Under Review' }
        case 'approved': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Approved' }
        case 'paid': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Paid' }
        case 'rejected': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Rejected' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: status }
    }
}

const EMPTY_INVOICE_FORM = {
    period_start: '',
    period_end: '',
    trips_completed: '',
    tonnage_collected: '',
    due_date: '',
}

const EMPTY_LINE_ITEM = {
    description: '',
    quantity: '1',
    unit_price: '',
}

export default function ContractorBillingPage() {
    const [profile, setProfile] = useState<any>(null)
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
    const [lineItems, setLineItems] = useState<LineItem[]>([])
    const [payments, setPayments] = useState<Payment[]>([])
    const [contract, setContract] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [invoiceForm, setInvoiceForm] = useState(EMPTY_INVOICE_FORM)
    const [lineItemForms, setLineItemForms] = useState([{ ...EMPTY_LINE_ITEM }])
    const [activeTab, setActiveTab] = useState<'all' | 'draft' | 'submitted' | 'paid'>('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: invoicesData } = await supabase
            .from('contractor_invoices')
            .select('*')
            .eq('contractor_id', user.id)
            .order('created_at', { ascending: false })
        setInvoices(invoicesData || [])

        const { data: contractData } = await supabase
            .from('contracts')
            .select('*')
            .eq('contractor_id', user.id)
            .eq('status', 'active')
            .single()
        setContract(contractData)

        setLoading(false)
    }

    async function loadInvoiceDetails(invoice: Invoice) {
        const supabase = createClient()
        const { data: items } = await supabase
            .from('invoice_line_items')
            .select('*')
            .eq('invoice_id', invoice.id)
            .order('created_at', { ascending: true })
        setLineItems(items || [])

        const { data: pays } = await supabase
            .from('invoice_payments')
            .select('*')
            .eq('invoice_id', invoice.id)
            .order('created_at', { ascending: false })
        setPayments(pays || [])

        setSelectedInvoice(invoice)
    }

    function calculateLineItemTotal() {
        return lineItemForms.reduce((sum, item) => {
            const qty = parseFloat(item.quantity) || 0
            const price = parseFloat(item.unit_price) || 0
            return sum + (qty * price)
        }, 0)
    }

    async function createInvoice() {
        if (!invoiceForm.period_start || !invoiceForm.period_end) {
            setErrorMsg('Period start and end dates are required.')
            return
        }
        if (lineItemForms.some(i => !i.description || !i.unit_price)) {
            setErrorMsg('All line items must have a description and unit price.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const subtotal = calculateLineItemTotal()
        const invoiceNumber = `INV-CMC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`

        const { data: newInvoice, error } = await supabase
            .from('contractor_invoices')
            .insert({
                invoice_number: invoiceNumber,
                contractor_id: user.id,
                contract_id: contract?.id || null,
                period_start: invoiceForm.period_start,
                period_end: invoiceForm.period_end,
                trips_completed: invoiceForm.trips_completed ? parseInt(invoiceForm.trips_completed) : 0,
                tonnage_collected: invoiceForm.tonnage_collected ? parseFloat(invoiceForm.tonnage_collected) : 0,
                subtotal,
                tax_amount: 0,
                total_amount: subtotal,
                status: 'draft',
                due_date: invoiceForm.due_date || null,
            })
            .select()
            .single()

        if (error || !newInvoice) {
            setErrorMsg('Failed to create invoice: ' + error?.message)
            setSubmitting(false)
            return
        }

        // Insert line items
        const itemsToInsert = lineItemForms
            .filter(i => i.description && i.unit_price)
            .map(i => ({
                invoice_id: newInvoice.id,
                description: i.description,
                quantity: parseFloat(i.quantity) || 1,
                unit_price: parseFloat(i.unit_price),
                total: (parseFloat(i.quantity) || 1) * parseFloat(i.unit_price),
            }))

        await supabase.from('invoice_line_items').insert(itemsToInsert)

        setSuccessMsg('Invoice created successfully.')
        setShowCreateForm(false)
        setInvoiceForm(EMPTY_INVOICE_FORM)
        setLineItemForms([{ ...EMPTY_LINE_ITEM }])
        loadData()
        setSubmitting(false)
    }

    async function submitInvoice(invoiceId: string) {
        const supabase = createClient()
        const { error } = await supabase
            .from('contractor_invoices')
            .update({
                status: 'submitted',
                submitted_at: new Date().toISOString(),
            })
            .eq('id', invoiceId)

        if (!error) {
            setSuccessMsg('Invoice submitted to CMC for review.')
            setSelectedInvoice(null)
            loadData()
        }
    }

    async function deleteInvoice(invoiceId: string) {
        if (!confirm('Are you sure you want to delete this draft invoice?')) return
        const supabase = createClient()
        await supabase.from('contractor_invoices').delete().eq('id', invoiceId)
        setSuccessMsg('Invoice deleted.')
        setSelectedInvoice(null)
        loadData()
    }

    function addLineItem() {
        setLineItemForms(f => [...f, { ...EMPTY_LINE_ITEM }])
    }

    function removeLineItem(index: number) {
        setLineItemForms(f => f.filter((_, i) => i !== index))
    }

    function updateLineItem(index: number, field: string, value: string) {
        setLineItemForms(f => f.map((item, i) => i === index ? { ...item, [field]: value } : item))
    }

    const filteredInvoices = activeTab === 'all'
        ? invoices
        : activeTab === 'draft' ? invoices.filter(i => i.status === 'draft')
            : activeTab === 'submitted' ? invoices.filter(i => ['submitted', 'under_review', 'approved'].includes(i.status))
                : invoices.filter(i => i.status === 'paid')

    const stats = {
        total: invoices.length,
        draft: invoices.filter(i => i.status === 'draft').length,
        pending: invoices.filter(i => ['submitted', 'under_review'].includes(i.status)).length,
        approved: invoices.filter(i => i.status === 'approved').length,
        paid: invoices.filter(i => i.status === 'paid').length,
        totalEarned: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_amount, 0),
        totalPending: invoices.filter(i => ['submitted', 'under_review', 'approved'].includes(i.status))
            .reduce((s, i) => s + i.total_amount, 0),
    }

    return (
        <DashboardLayout
            role="Contractor"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={CONTRACTOR_NAV}
            primaryAction={{ label: 'New Invoice', href: '#', icon: 'add' }}
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
        .invoice-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .invoice-row:hover { background:#f9fafb; }
        .invoice-row:last-child { border-bottom:none; }
        .form-input { width:100%; padding:10px 14px; border-radius:10px; border:1.5px solid rgba(0,69,13,0.15); font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:white; color:#181c22; }
        .form-input:focus { border-color:#00450d; }
        .form-label { font-size:12px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.05em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#00450d; color:white; border:none; padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity 0.2s; }
        .btn-primary:hover { opacity:0.88; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
        .btn-danger { background:#fef2f2; color:#ba1a1a; border:1.5px solid rgba(186,26,26,0.15); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-danger:hover { background:#ffdad6; }
        .line-item-row { display:grid; grid-template-columns:1fr 80px 100px 80px; gap:8px; align-items:center; padding:8px 0; border-bottom:1px solid rgba(0,69,13,0.04); }
        .line-item-row:last-child { border-bottom:none; }
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
                            Billing & <span style={{ color: '#1b5e20' }}>Invoices</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Manage your invoices and payments from CMC
                        </p>
                    </div>
                    <button className="btn-primary"
                        onClick={() => { setShowCreateForm(true); setErrorMsg('') }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                        New Invoice
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

                    {/* Hero stats card */}
                    <div className="bento-card-green p-8 mb-6 s2">
                        <div className="absolute top-0 right-0 w-56 h-56 rounded-full -mr-20 -mt-20"
                            style={{ background: 'rgba(163,246,156,0.06)' }} />
                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-8">
                                <div>
                                    <span className="text-xs font-bold uppercase block mb-2"
                                        style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                                        Billing Summary
                                    </span>
                                    <h2 className="font-headline font-extrabold text-3xl tracking-tight">Revenue Overview</h2>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '4px' }}>
                                        All invoices with CMC
                                    </p>
                                </div>
                                <div className="p-3 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>receipt_long</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Total Invoices', value: stats.total, icon: 'description' },
                                    { label: 'Pending Payment', value: `LKR ${stats.totalPending.toLocaleString()}`, icon: 'pending' },
                                    { label: 'Total Earned', value: `LKR ${stats.totalEarned.toLocaleString()}`, icon: 'payments' },
                                    { label: 'Awaiting Review', value: stats.pending, icon: 'hourglass_bottom' },
                                ].map(m => (
                                    <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                        <span className="material-symbols-outlined mb-2 block"
                                            style={{ color: 'rgba(163,246,156,0.7)', fontSize: '18px' }}>{m.icon}</span>
                                        <p className="font-headline font-bold text-xl leading-tight">{m.value}</p>
                                        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 s3">
                        {[
                            { label: 'Draft', value: stats.draft, color: '#64748b', bg: '#f8fafc', icon: 'edit_note' },
                            { label: 'Submitted', value: stats.pending, color: '#0369a1', bg: '#f0f9ff', icon: 'send' },
                            { label: 'Approved', value: stats.approved, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                            { label: 'Paid', value: stats.paid, color: '#00450d', bg: '#f0fdf4', icon: 'payments' },
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

                    {/* Tabs + Invoice list */}
                    <div className="flex items-center gap-2 mb-4 s4">
                        {(['all', 'draft', 'submitted', 'paid'] as const).map(tab => (
                            <button key={tab} className={`tab-btn ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`}
                                onClick={() => setActiveTab(tab)}>
                                {tab === 'all' ? `All (${invoices.length})` :
                                    tab === 'draft' ? `Drafts (${stats.draft})` :
                                        tab === 'submitted' ? `Pending (${stats.pending + stats.approved})` :
                                            `Paid (${stats.paid})`}
                            </button>
                        ))}
                    </div>

                    <div className="bento-card s5">
                        {filteredInvoices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>receipt_long</span>
                                </div>
                                <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No invoices found</p>
                                <p className="text-sm mt-1 mb-6" style={{ color: '#94a3b8' }}>
                                    Create your first invoice to get started
                                </p>
                                <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                    New Invoice
                                </button>
                            </div>
                        ) : (
                            filteredInvoices.map(inv => {
                                const s = statusStyle(inv.status)
                                return (
                                    <div key={inv.id} className="invoice-row" onClick={() => loadInvoiceDetails(inv)}>
                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: s.bg }}>
                                            <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '22px' }}>
                                                receipt_long
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-bold" style={{ color: '#181c22' }}>{inv.invoice_number}</p>
                                                <span className="status-badge" style={{ background: s.bg, color: s.color }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                                                    {s.label}
                                                </span>
                                            </div>
                                            <p className="text-xs" style={{ color: '#717a6d' }}>
                                                {new Date(inv.period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} –{' '}
                                                {new Date(inv.period_end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} ·{' '}
                                                {inv.trips_completed} trips · {inv.tonnage_collected}T
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-sm font-bold" style={{ color: '#00450d' }}>
                                                LKR {inv.total_amount.toLocaleString()}
                                            </p>
                                            <p className="text-xs" style={{ color: '#94a3b8' }}>
                                                Due {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : 'N/A'}
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

                    {/* Invoice Detail Modal */}
                    {selectedInvoice && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-2xl bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            {selectedInvoice.invoice_number}
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            {new Date(selectedInvoice.period_start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} service period
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedInvoice(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                {/* Status + key info */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                    {[
                                        { label: 'Status', value: statusStyle(selectedInvoice.status).label },
                                        { label: 'Total Amount', value: `LKR ${selectedInvoice.total_amount.toLocaleString()}` },
                                        { label: 'Due Date', value: selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString('en-GB') : 'N/A' },
                                        { label: 'Trips Completed', value: selectedInvoice.trips_completed.toString() },
                                        { label: 'Tonnage', value: `${selectedInvoice.tonnage_collected}T` },
                                        { label: 'Submitted', value: selectedInvoice.submitted_at ? new Date(selectedInvoice.submitted_at).toLocaleDateString('en-GB') : 'Not yet' },
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

                                {/* Line items */}
                                {lineItems.length > 0 && (
                                    <div className="mb-6">
                                        <p className="text-xs font-bold uppercase mb-3"
                                            style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                            Line Items
                                        </p>
                                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,69,13,0.08)' }}>
                                            <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs font-bold uppercase"
                                                style={{ background: '#f8fafc', color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                                <span className="col-span-2">Description</span>
                                                <span className="text-right">Qty × Price</span>
                                                <span className="text-right">Total</span>
                                            </div>
                                            {lineItems.map(item => (
                                                <div key={item.id} className="grid grid-cols-4 gap-2 px-4 py-3"
                                                    style={{ borderTop: '1px solid rgba(0,69,13,0.04)' }}>
                                                    <span className="col-span-2 text-sm" style={{ color: '#181c22' }}>{item.description}</span>
                                                    <span className="text-right text-xs" style={{ color: '#717a6d' }}>
                                                        {item.quantity} × LKR {item.unit_price.toLocaleString()}
                                                    </span>
                                                    <span className="text-right text-sm font-bold" style={{ color: '#00450d' }}>
                                                        LKR {item.total.toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                            <div className="grid grid-cols-4 gap-2 px-4 py-3"
                                                style={{ borderTop: '2px solid rgba(0,69,13,0.1)', background: '#f0fdf4' }}>
                                                <span className="col-span-3 text-sm font-bold" style={{ color: '#181c22' }}>Total</span>
                                                <span className="text-right text-sm font-bold" style={{ color: '#00450d' }}>
                                                    LKR {selectedInvoice.total_amount.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Admin notes */}
                                {selectedInvoice.admin_notes && (
                                    <div className="p-4 rounded-xl mb-6" style={{ background: '#f0f9ff' }}>
                                        <p className="text-xs font-bold uppercase mb-1"
                                            style={{ color: '#0369a1', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                            CMC Note
                                        </p>
                                        <p className="text-sm" style={{ color: '#0369a1' }}>{selectedInvoice.admin_notes}</p>
                                    </div>
                                )}

                                {/* Payment info */}
                                {payments.length > 0 && (
                                    <div className="mb-6">
                                        <p className="text-xs font-bold uppercase mb-3"
                                            style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                            Payment History
                                        </p>
                                        {payments.map(pay => (
                                            <div key={pay.id} className="p-4 rounded-xl flex items-center gap-4"
                                                style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>
                                                    payments
                                                </span>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22' }}>
                                                        LKR {pay.amount_paid.toLocaleString()}
                                                    </p>
                                                    <p className="text-xs" style={{ color: '#717a6d' }}>
                                                        {pay.payment_method.replace('_', ' ')} · Ref: {pay.payment_reference || 'N/A'} · {new Date(pay.payment_date).toLocaleDateString('en-GB')}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3">
                                    {selectedInvoice.status === 'draft' && (
                                        <>
                                            <button className="btn-danger flex-1 justify-center"
                                                onClick={() => deleteInvoice(selectedInvoice.id)}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                                                Delete
                                            </button>
                                            <button className="btn-primary flex-1 justify-center"
                                                onClick={() => submitInvoice(selectedInvoice.id)}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
                                                Submit to CMC
                                            </button>
                                        </>
                                    )}
                                    {selectedInvoice.status !== 'draft' && (
                                        <button className="btn-secondary w-full justify-center"
                                            onClick={() => setSelectedInvoice(null)}>
                                            Close
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Create Invoice Modal */}
                    {showCreateForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-2xl bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            Create New Invoice
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            Invoice will be saved as draft — submit when ready
                                        </p>
                                    </div>
                                    <button onClick={() => { setShowCreateForm(false); setErrorMsg('') }}
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
                                            <label className="form-label">Period Start *</label>
                                            <input type="date" className="form-input"
                                                value={invoiceForm.period_start}
                                                onChange={e => setInvoiceForm(f => ({ ...f, period_start: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Period End *</label>
                                            <input type="date" className="form-input"
                                                value={invoiceForm.period_end}
                                                onChange={e => setInvoiceForm(f => ({ ...f, period_end: e.target.value }))} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="form-label">Trips Completed</label>
                                            <input type="number" className="form-input" placeholder="e.g. 48"
                                                value={invoiceForm.trips_completed}
                                                onChange={e => setInvoiceForm(f => ({ ...f, trips_completed: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Tonnage (T)</label>
                                            <input type="number" className="form-input" placeholder="e.g. 192.5"
                                                value={invoiceForm.tonnage_collected}
                                                onChange={e => setInvoiceForm(f => ({ ...f, tonnage_collected: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Due Date</label>
                                            <input type="date" className="form-input"
                                                value={invoiceForm.due_date}
                                                onChange={e => setInvoiceForm(f => ({ ...f, due_date: e.target.value }))} />
                                        </div>
                                    </div>

                                    {/* Line items */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="form-label" style={{ margin: 0 }}>Line Items *</label>
                                            <button onClick={addLineItem}
                                                style={{ background: '#f0fdf4', color: '#00450d', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'Manrope, sans-serif' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                                                Add Item
                                            </button>
                                        </div>

                                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,69,13,0.1)' }}>
                                            <div className="grid gap-2 px-4 py-2 text-xs font-bold uppercase"
                                                style={{ gridTemplateColumns: '1fr 70px 90px 70px', background: '#f8fafc', color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                                <span>Description</span>
                                                <span>Qty</span>
                                                <span>Unit Price</span>
                                                <span>Total</span>
                                            </div>
                                            {lineItemForms.map((item, index) => (
                                                <div key={index} className="grid gap-2 px-4 py-2 items-center"
                                                    style={{ gridTemplateColumns: '1fr 70px 90px 70px', borderTop: '1px solid rgba(0,69,13,0.04)' }}>
                                                    <input className="form-input" style={{ padding: '6px 10px', fontSize: '13px' }}
                                                        placeholder="Description"
                                                        value={item.description}
                                                        onChange={e => updateLineItem(index, 'description', e.target.value)} />
                                                    <input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '13px' }}
                                                        placeholder="1"
                                                        value={item.quantity}
                                                        onChange={e => updateLineItem(index, 'quantity', e.target.value)} />
                                                    <input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '13px' }}
                                                        placeholder="0"
                                                        value={item.unit_price}
                                                        onChange={e => updateLineItem(index, 'unit_price', e.target.value)} />
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold" style={{ color: '#00450d' }}>
                                                            {((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toLocaleString()}
                                                        </span>
                                                        {lineItemForms.length > 1 && (
                                                            <button onClick={() => removeLineItem(index)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ba1a1a' }}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between px-4 py-3"
                                                style={{ borderTop: '2px solid rgba(0,69,13,0.1)', background: '#f0fdf4' }}>
                                                <span className="text-sm font-bold" style={{ color: '#181c22' }}>Total</span>
                                                <span className="text-sm font-bold" style={{ color: '#00450d' }}>
                                                    LKR {calculateLineItemTotal().toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setShowCreateForm(false); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={createInvoice} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                                                Save as Draft
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
