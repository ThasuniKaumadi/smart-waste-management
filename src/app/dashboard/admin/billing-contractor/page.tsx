'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
    { label: 'Overview', href: '/dashboard/admin', icon: 'dashboard' },
    { label: 'Users', href: '/dashboard/admin/users', icon: 'manage_accounts' },
    { label: 'Blockchain', href: '/dashboard/admin/blockchain', icon: 'link' },
    { label: 'Performance', href: '/dashboard/admin/performance', icon: 'analytics' },
    { label: 'Billing', href: '/dashboard/admin/billing', icon: 'payments' },
    { label: 'Contracts', href: '/dashboard/admin/contracts', icon: 'description' },
    { label: 'Contractor Billing', href: '/dashboard/admin/billing-contractor', icon: 'receipt_long' },
]

type Invoice = {
    id: string
    invoice_number: string
    contractor_id: string
    period_start: string
    period_end: string
    trips_completed: number
    tonnage_collected: number
    total_amount: number
    status: string
    due_date: string
    submitted_at: string
    admin_notes: string
    paid_at: string
    payment_reference: string
    created_at: string
    contractor?: { full_name: string; organisation_name: string }
}

type LineItem = {
    id: string
    description: string
    quantity: number
    unit_price: number
    total: number
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

export default function AdminContractorBillingPage() {
    const [profile, setProfile] = useState<any>(null)
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
    const [lineItems, setLineItems] = useState<LineItem[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [adminNote, setAdminNote] = useState('')
    const [paymentForm, setPaymentForm] = useState({
        amount_paid: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_reference: '',
        payment_method: 'bank_transfer',
        notes: '',
    })
    const [showPaymentForm, setShowPaymentForm] = useState(false)
    const [filterStatus, setFilterStatus] = useState('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: invoicesData } = await supabase
            .from('contractor_invoices')
            .select('*, contractor:profiles!contractor_invoices_contractor_id_fkey(full_name, organisation_name)')
            .order('created_at', { ascending: false })
        setInvoices(invoicesData || [])
        setLoading(false)
    }

    async function loadInvoiceDetails(invoice: Invoice) {
        const supabase = createClient()
        const { data: items } = await supabase
            .from('invoice_line_items')
            .select('*')
            .eq('invoice_id', invoice.id)
        setLineItems(items || [])
        setAdminNote(invoice.admin_notes || '')
        setPaymentForm(f => ({ ...f, amount_paid: invoice.total_amount.toString() }))
        setSelectedInvoice(invoice)
        setShowPaymentForm(false)
    }

    async function updateInvoiceStatus(invoiceId: string, newStatus: string) {
        setSubmitting(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase
            .from('contractor_invoices')
            .update({
                status: newStatus,
                admin_notes: adminNote,
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', invoiceId)

        if (!error) {
            setSuccessMsg(`Invoice ${newStatus}.`)
            setSelectedInvoice(null)
            loadData()
        }
        setSubmitting(false)
    }

    async function recordPayment(invoiceId: string) {
        if (!paymentForm.amount_paid || !paymentForm.payment_date) return
        setSubmitting(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('invoice_payments').insert({
            invoice_id: invoiceId,
            contractor_id: selectedInvoice?.contractor_id,
            amount_paid: parseFloat(paymentForm.amount_paid),
            payment_date: paymentForm.payment_date,
            payment_reference: paymentForm.payment_reference || null,
            payment_method: paymentForm.payment_method,
            notes: paymentForm.notes || null,
            recorded_by: user.id,
        })

        if (!error) {
            await supabase.from('contractor_invoices')
                .update({ status: 'paid', paid_at: new Date().toISOString(), payment_reference: paymentForm.payment_reference })
                .eq('id', invoiceId)
            setSuccessMsg('Payment recorded and invoice marked as paid.')
            setSelectedInvoice(null)
            setShowPaymentForm(false)
            loadData()
        }
        setSubmitting(false)
    }

    const filteredInvoices = filterStatus === 'all'
        ? invoices
        : invoices.filter(i => i.status === filterStatus)

    const stats = {
        total: invoices.length,
        submitted: invoices.filter(i => i.status === 'submitted').length,
        underReview: invoices.filter(i => i.status === 'under_review').length,
        approved: invoices.filter(i => i.status === 'approved').length,
        paid: invoices.filter(i => i.status === 'paid').length,
        totalPaid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_amount, 0),
        totalPending: invoices.filter(i => ['submitted', 'under_review', 'approved'].includes(i.status))
            .reduce((s, i) => s + i.total_amount, 0),
    }

    return (
        <DashboardLayout
            role="Admin"
            userName={profile?.full_name || ''}
            navItems={ADMIN_NAV}
            primaryAction={{ label: 'Add User', href: '/dashboard/admin/users', icon: 'person_add' }}
        >
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .bento-card-green { background:#00450d; border-radius:16px; color:white; overflow:hidden; position:relative; }
        .status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .invoice-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .invoice-row:hover { background:#f9fafb; }
        .invoice-row:last-child { border-bottom:none; }
        .filter-btn { padding:6px 14px; border-radius:8px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:1.5px solid transparent; transition:all 0.2s; }
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
                            Contractor <span style={{ color: '#1b5e20' }}>Billing</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Review and process contractor invoice payments
                        </p>
                    </div>
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

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 s2">
                        {[
                            { label: 'Total Invoices', value: stats.total, color: '#00450d', bg: '#f0fdf4', icon: 'receipt_long' },
                            { label: 'Submitted', value: stats.submitted, color: '#0369a1', bg: '#f0f9ff', icon: 'send' },
                            { label: 'Under Review', value: stats.underReview, color: '#92400e', bg: '#fefce8', icon: 'pending' },
                            { label: 'Approved', value: stats.approved, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                            { label: 'Total Paid', value: `LKR ${stats.totalPaid.toLocaleString()}`, color: '#00450d', bg: '#f0fdf4', icon: 'payments' },
                        ].map(s => (
                            <div key={s.label} className="bento-card p-5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                                    style={{ background: s.bg }}>
                                    <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '18px' }}>{s.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-xl" style={{ color: '#181c22' }}>{s.value}</p>
                                <p className="text-xs font-bold uppercase mt-1"
                                    style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filter + Invoice list */}
                    <div className="bento-card s3">
                        <div className="px-6 py-4 flex items-center gap-2 flex-wrap"
                            style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            {['all', 'submitted', 'under_review', 'approved', 'paid', 'rejected'].map(f => {
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
                                        {f === 'submitted' && stats.submitted > 0 && (
                                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
                                                style={{ background: active ? 'rgba(255,255,255,0.2)' : '#fef2f2', color: active ? 'white' : '#ba1a1a' }}>
                                                {stats.submitted}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>

                        {filteredInvoices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>receipt_long</span>
                                </div>
                                <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No invoices found</p>
                                <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Contractor invoices will appear here</p>
                            </div>
                        ) : (
                            filteredInvoices.map(inv => {
                                const s = statusStyle(inv.status)
                                const contractorName = inv.contractor?.organisation_name || inv.contractor?.full_name || 'Unknown'
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
                                                {contractorName} · {new Date(inv.period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} – {new Date(inv.period_end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-sm font-bold" style={{ color: '#00450d' }}>
                                                LKR {inv.total_amount.toLocaleString()}
                                            </p>
                                            <p className="text-xs" style={{ color: '#94a3b8' }}>
                                                {inv.submitted_at ? new Date(inv.submitted_at).toLocaleDateString('en-GB') : 'Not submitted'}
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
                                            {selectedInvoice.contractor?.organisation_name || selectedInvoice.contractor?.full_name}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedInvoice(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                {/* Key info */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                    {[
                                        { label: 'Total Amount', value: `LKR ${selectedInvoice.total_amount.toLocaleString()}` },
                                        { label: 'Period', value: `${new Date(selectedInvoice.period_start).toLocaleDateString('en-GB')} – ${new Date(selectedInvoice.period_end).toLocaleDateString('en-GB')}` },
                                        { label: 'Trips', value: selectedInvoice.trips_completed.toString() },
                                        { label: 'Tonnage', value: `${selectedInvoice.tonnage_collected}T` },
                                        { label: 'Due Date', value: selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString('en-GB') : 'N/A' },
                                        { label: 'Submitted', value: selectedInvoice.submitted_at ? new Date(selectedInvoice.submitted_at).toLocaleDateString('en-GB') : 'N/A' },
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
                                            {lineItems.map((item, i) => (
                                                <div key={item.id} className="grid grid-cols-4 gap-2 px-4 py-3"
                                                    style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(0,69,13,0.04)' }}>
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
                                <div className="mb-6">
                                    <label className="form-label">Admin Notes</label>
                                    <textarea className="form-input" rows={3}
                                        placeholder="Add review notes or conditions..."
                                        value={adminNote}
                                        onChange={e => setAdminNote(e.target.value)}
                                        style={{ resize: 'vertical' }} />
                                </div>

                                {/* Payment form */}
                                {showPaymentForm && (
                                    <div className="mb-6 p-4 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                                        <p className="text-xs font-bold uppercase mb-4"
                                            style={{ color: '#00450d', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                            Record Payment
                                        </p>
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="form-label">Amount Paid (LKR)</label>
                                                    <input type="number" className="form-input"
                                                        value={paymentForm.amount_paid}
                                                        onChange={e => setPaymentForm(f => ({ ...f, amount_paid: e.target.value }))} />
                                                </div>
                                                <div>
                                                    <label className="form-label">Payment Date</label>
                                                    <input type="date" className="form-input"
                                                        value={paymentForm.payment_date}
                                                        onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="form-label">Payment Method</label>
                                                    <select className="form-input"
                                                        value={paymentForm.payment_method}
                                                        onChange={e => setPaymentForm(f => ({ ...f, payment_method: e.target.value }))}>
                                                        <option value="bank_transfer">Bank Transfer</option>
                                                        <option value="cheque">Cheque</option>
                                                        <option value="cash">Cash</option>
                                                        <option value="online">Online</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="form-label">Reference Number</label>
                                                    <input className="form-input" placeholder="e.g. CMC-PAY-001"
                                                        value={paymentForm.payment_reference}
                                                        onChange={e => setPaymentForm(f => ({ ...f, payment_reference: e.target.value }))} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="space-y-3">
                                    {(selectedInvoice.status === 'submitted' || selectedInvoice.status === 'under_review') && (
                                        <div className="flex gap-3">
                                            <button className="btn-danger flex-1 justify-center"
                                                onClick={() => updateInvoiceStatus(selectedInvoice.id, 'rejected')}
                                                disabled={submitting}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                                Reject
                                            </button>
                                            <button className="btn-secondary flex-1 justify-center"
                                                onClick={() => updateInvoiceStatus(selectedInvoice.id, 'under_review')}
                                                disabled={submitting}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>pending</span>
                                                Under Review
                                            </button>
                                            <button className="btn-primary flex-1 justify-center"
                                                onClick={() => updateInvoiceStatus(selectedInvoice.id, 'approved')}
                                                disabled={submitting}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                                                Approve
                                            </button>
                                        </div>
                                    )}
                                    {selectedInvoice.status === 'approved' && (
                                        <div className="flex gap-3">
                                            {!showPaymentForm ? (
                                                <button className="btn-primary w-full justify-center"
                                                    onClick={() => setShowPaymentForm(true)}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>payments</span>
                                                    Record Payment
                                                </button>
                                            ) : (
                                                <>
                                                    <button className="btn-secondary flex-1 justify-center"
                                                        onClick={() => setShowPaymentForm(false)}>
                                                        Cancel
                                                    </button>
                                                    <button className="btn-primary flex-1 justify-center"
                                                        onClick={() => recordPayment(selectedInvoice.id)}
                                                        disabled={submitting}>
                                                        {submitting ? (
                                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                                        ) : (
                                                            <>
                                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                                                                Confirm Payment
                                                            </>
                                                        )}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {(selectedInvoice.status === 'paid' || selectedInvoice.status === 'rejected' || selectedInvoice.status === 'draft') && (
                                        <button className="btn-secondary w-full justify-center"
                                            onClick={() => setSelectedInvoice(null)}>
                                            Close
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}