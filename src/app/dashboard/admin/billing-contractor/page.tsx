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

type Invoice = {
    id: string; invoice_number: string; contractor_id: string
    period_start: string; period_end: string; trips_completed: number
    tonnage_collected: number; total_amount: number; status: string
    due_date: string; submitted_at: string; admin_notes: string
    paid_at: string; payment_reference: string; created_at: string
    contractor?: { full_name: string; organisation_name: string }
}
type LineItem = {
    id: string; description: string; quantity: number; unit_price: number; total: number
}

function statusStyle(status: string) {
    switch (status) {
        case 'draft': return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: 'Draft' }
        case 'submitted': return { bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8', label: 'Submitted' }
        case 'under_review': return { bg: '#fffbeb', color: '#92400e', dot: '#d97706', label: 'Under Review' }
        case 'approved': return { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a', label: 'Approved' }
        case 'paid': return { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a', label: 'Paid' }
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
    const [paymentForm, setPaymentForm] = useState({ amount_paid: '', payment_date: new Date().toISOString().split('T')[0], payment_reference: '', payment_method: 'bank_transfer', notes: '' })
    const [showPaymentForm, setShowPaymentForm] = useState(false)
    const [filterStatus, setFilterStatus] = useState('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data: invoicesData } = await supabase.from('contractor_invoices').select('*, contractor:profiles!contractor_invoices_contractor_id_fkey(full_name, organisation_name)').order('created_at', { ascending: false })
        setInvoices(invoicesData || [])
        setLoading(false)
    }

    async function loadInvoiceDetails(invoice: Invoice) {
        const supabase = createClient()
        const { data: items } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', invoice.id)
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
        const { error } = await supabase.from('contractor_invoices').update({ status: newStatus, admin_notes: adminNote, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', invoiceId)
        if (!error) { setSuccessMsg(`Invoice ${newStatus}.`); setSelectedInvoice(null); loadData() }
        setSubmitting(false)
    }

    async function recordPayment(invoiceId: string) {
        if (!paymentForm.amount_paid || !paymentForm.payment_date) return
        setSubmitting(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { error } = await supabase.from('invoice_payments').insert({ invoice_id: invoiceId, contractor_id: selectedInvoice?.contractor_id, amount_paid: parseFloat(paymentForm.amount_paid), payment_date: paymentForm.payment_date, payment_reference: paymentForm.payment_reference || null, payment_method: paymentForm.payment_method, notes: paymentForm.notes || null, recorded_by: user.id })
        if (!error) {
            await supabase.from('contractor_invoices').update({ status: 'paid', paid_at: new Date().toISOString(), payment_reference: paymentForm.payment_reference }).eq('id', invoiceId)
            setSuccessMsg('Payment recorded and invoice marked as paid.')
            setSelectedInvoice(null); setShowPaymentForm(false); loadData()
        }
        setSubmitting(false)
    }

    const filteredInvoices = filterStatus === 'all' ? invoices : invoices.filter(i => i.status === filterStatus)
    const stats = {
        total: invoices.length,
        submitted: invoices.filter(i => i.status === 'submitted').length,
        underReview: invoices.filter(i => i.status === 'under_review').length,
        approved: invoices.filter(i => i.status === 'approved').length,
        paid: invoices.filter(i => i.status === 'paid').length,
        totalPaid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_amount, 0),
        totalPending: invoices.filter(i => ['submitted', 'under_review', 'approved'].includes(i.status)).reduce((s, i) => s + i.total_amount, 0),
    }

    return (
        <DashboardLayout role="Admin" userName={profile?.full_name || ''} navItems={ADMIN_NAV} primaryAction={{ label: 'Add User', href: '/dashboard/admin/users', icon: 'person_add' }}>
            <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
        .stat-card { background:white; border-radius:20px; padding:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); transition:transform 0.2s,box-shadow 0.2s; }
        .stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.09); }
        .status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.04em; white-space:nowrap; }
        .invoice-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .invoice-row:hover { background:#f9fbf9; }
        .invoice-row:last-child { border-bottom:none; }
        .filter-btn { padding:7px 14px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:1.5px solid transparent; transition:all 0.2s; }
        .form-input { width:100%; padding:10px 14px; border-radius:12px; border:1.5px solid #e4e9e0; font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:#fafbf9; color:#181c22; box-sizing:border-box; }
        .form-input:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .form-label { font-size:11px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#00450d; color:white; border:none; padding:11px 22px; border-radius:12px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-primary:hover { background:#1b5e20; transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,69,13,0.25); }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:11px 22px; border-radius:12px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
        .btn-danger { background:#fef2f2; color:#ba1a1a; border:1.5px solid rgba(186,26,26,0.15); padding:11px 22px; border-radius:12px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-danger:hover { background:#ffdad6; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both}
        .a3{animation:fadeUp .4s ease .14s both} .a4{animation:fadeUp .4s ease .19s both}
      `}</style>

            {/* ── Heading ── */}
            <div className="a1" style={{ marginBottom: 32 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>
                    🤝 System Administration
                </p>
                <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
                    Contractor <span style={{ color: '#00450d' }}>Billing</span>
                </h1>
                <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>Review and process contractor invoice payments</p>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                </div>
            ) : (
                <>
                    {successMsg && (
                        <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 14, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="msf" style={{ color: '#00450d', fontSize: 18 }}>check_circle</span>
                            <p style={{ fontSize: 13, fontWeight: 500, color: '#15803d', margin: 0 }}>{successMsg}</p>
                            <button onClick={() => setSuccessMsg('')} style={{ marginLeft: 'auto', color: '#15803d', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                                <span className="msf" style={{ fontSize: 18 }}>close</span>
                            </button>
                        </div>
                    )}

                    {/* ── Stats ── */}
                    <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
                        {[
                            { label: 'Total Invoices', value: stats.total, icon: 'receipt_long', color: '#15803d', bg: '#f0fdf4' },
                            { label: 'Submitted', value: stats.submitted, icon: 'send', color: '#0369a1', bg: '#f0f9ff' },
                            { label: 'Under Review', value: stats.underReview, icon: 'pending', color: '#92400e', bg: '#fffbeb' },
                            { label: 'Approved', value: stats.approved, icon: 'check_circle', color: '#15803d', bg: '#f0fdf4' },
                            { label: 'Total Paid', value: `LKR ${stats.totalPaid.toLocaleString()}`, icon: 'payments', color: '#15803d', bg: '#f0fdf4' },
                        ].map(s => (
                            <div key={s.label} className="stat-card">
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                    <span className="msf" style={{ color: s.color, fontSize: 18 }}>{s.icon}</span>
                                </div>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 22, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{s.value}</p>
                                <p style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Invoice list ── */}
                    <div className="card a3">
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,69,13,0.05)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {['all', 'submitted', 'under_review', 'approved', 'paid', 'rejected'].map(f => (
                                <button key={f} className="filter-btn" onClick={() => setFilterStatus(f)}
                                    style={{ background: filterStatus === f ? '#00450d' : '#f1f5f9', color: filterStatus === f ? 'white' : '#64748b', borderColor: filterStatus === f ? '#00450d' : 'transparent' }}>
                                    {f === 'all' ? 'All' : f.replace('_', ' ')}
                                    {f === 'submitted' && stats.submitted > 0 && (
                                        <span style={{ marginLeft: 4, padding: '1px 6px', borderRadius: 99, fontSize: 10, background: filterStatus === f ? 'rgba(255,255,255,0.2)' : '#fef2f2', color: filterStatus === f ? 'white' : '#ba1a1a' }}>{stats.submitted}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {filteredInvoices.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 0' }}>
                                <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                    <span className="msf" style={{ color: '#00450d', fontSize: 28 }}>receipt_long</span>
                                </div>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', marginBottom: 4 }}>No invoices found</p>
                                <p style={{ fontSize: 13, color: '#94a3b8' }}>Contractor invoices will appear here</p>
                            </div>
                        ) : filteredInvoices.map(inv => {
                            const s = statusStyle(inv.status)
                            const contractorName = inv.contractor?.organisation_name || inv.contractor?.full_name || 'Unknown'
                            return (
                                <div key={inv.id} className="invoice-row" onClick={() => loadInvoiceDetails(inv)}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="msf" style={{ color: s.color, fontSize: 22 }}>receipt_long</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <p style={{ fontSize: 14, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{inv.invoice_number}</p>
                                            <span className="status-badge" style={{ background: s.bg, color: s.color }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
                                                {s.label}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>
                                            {contractorName} · {new Date(inv.period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} – {new Date(inv.period_end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ fontSize: 14, fontWeight: 700, color: '#15803d', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>LKR {inv.total_amount.toLocaleString()}</p>
                                        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{inv.submitted_at ? new Date(inv.submitted_at).toLocaleDateString('en-GB') : 'Not submitted'}</p>
                                    </div>
                                    <span className="msf" style={{ color: '#c4c9c0', fontSize: 18 }}>chevron_right</span>
                                </div>
                            )
                        })}
                    </div>

                    {/* ── Invoice Detail Modal ── */}
                    {selectedInvoice && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div style={{ width: '100%', maxWidth: 640, background: 'white', borderRadius: 24, padding: 32, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                                    <div>
                                        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 20, color: '#181c22', margin: 0 }}>{selectedInvoice.invoice_number}</h3>
                                        <p style={{ fontSize: 13, color: '#717a6d', margin: '4px 0 0' }}>{selectedInvoice.contractor?.organisation_name || selectedInvoice.contractor?.full_name}</p>
                                    </div>
                                    <button onClick={() => setSelectedInvoice(null)} style={{ background: '#f4f6f3', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
                                        <span className="msf" style={{ color: '#64748b', fontSize: 20 }}>close</span>
                                    </button>
                                </div>

                                {/* Key info grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
                                    {[
                                        { label: 'Total Amount', value: `LKR ${selectedInvoice.total_amount.toLocaleString()}` },
                                        { label: 'Period', value: `${new Date(selectedInvoice.period_start).toLocaleDateString('en-GB')} – ${new Date(selectedInvoice.period_end).toLocaleDateString('en-GB')}` },
                                        { label: 'Trips', value: selectedInvoice.trips_completed.toString() },
                                        { label: 'Tonnage', value: `${selectedInvoice.tonnage_collected}T` },
                                        { label: 'Due Date', value: selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString('en-GB') : 'N/A' },
                                        { label: 'Submitted', value: selectedInvoice.submitted_at ? new Date(selectedInvoice.submitted_at).toLocaleDateString('en-GB') : 'N/A' },
                                    ].map(item => (
                                        <div key={item.label} style={{ padding: '12px 14px', borderRadius: 12, background: '#fafbf9', border: '1px solid rgba(0,69,13,0.05)' }}>
                                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: '0 0 4px' }}>{item.label}</p>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: '#181c22', margin: 0 }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Line items */}
                                {lineItems.length > 0 && (
                                    <div style={{ marginBottom: 24 }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: 10 }}>Line Items</p>
                                        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,69,13,0.07)' }}>
                                            {lineItems.map((item, i) => (
                                                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, padding: '12px 16px', borderTop: i === 0 ? 'none' : '1px solid rgba(0,69,13,0.04)' }}>
                                                    <span style={{ fontSize: 13, color: '#181c22' }}>{item.description}</span>
                                                    <span style={{ fontSize: 12, color: '#717a6d', whiteSpace: 'nowrap' }}>{item.quantity} × LKR {item.unit_price.toLocaleString()}</span>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>LKR {item.total.toLocaleString()}</span>
                                                </div>
                                            ))}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '12px 16px', borderTop: '2px solid rgba(0,69,13,0.1)', background: '#f0fdf4' }}>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22' }}>Total</span>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>LKR {selectedInvoice.total_amount.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Admin notes */}
                                <div style={{ marginBottom: 24 }}>
                                    <label className="form-label">Admin Notes</label>
                                    <textarea className="form-input" rows={3} placeholder="Add review notes or conditions…" value={adminNote} onChange={e => setAdminNote(e.target.value)} style={{ resize: 'vertical' }} />
                                </div>

                                {/* Payment form */}
                                {showPaymentForm && (
                                    <div style={{ marginBottom: 24, padding: 16, borderRadius: 14, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#15803d', fontFamily: 'Manrope,sans-serif', marginBottom: 14 }}>Record Payment</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div><label className="form-label">Amount Paid (LKR)</label><input type="number" className="form-input" value={paymentForm.amount_paid} onChange={e => setPaymentForm(f => ({ ...f, amount_paid: e.target.value }))} /></div>
                                            <div><label className="form-label">Payment Date</label><input type="date" className="form-input" value={paymentForm.payment_date} onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))} /></div>
                                            <div>
                                                <label className="form-label">Payment Method</label>
                                                <select className="form-input" value={paymentForm.payment_method} onChange={e => setPaymentForm(f => ({ ...f, payment_method: e.target.value }))}>
                                                    <option value="bank_transfer">Bank Transfer</option>
                                                    <option value="cheque">Cheque</option>
                                                    <option value="cash">Cash</option>
                                                    <option value="online">Online</option>
                                                </select>
                                            </div>
                                            <div><label className="form-label">Reference Number</label><input className="form-input" placeholder="e.g. CMC-PAY-001" value={paymentForm.payment_reference} onChange={e => setPaymentForm(f => ({ ...f, payment_reference: e.target.value }))} /></div>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {(selectedInvoice.status === 'submitted' || selectedInvoice.status === 'under_review') && (
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            <button className="btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => updateInvoiceStatus(selectedInvoice.id, 'rejected')} disabled={submitting}>
                                                <span className="msf" style={{ fontSize: 16 }}>close</span>Reject
                                            </button>
                                            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => updateInvoiceStatus(selectedInvoice.id, 'under_review')} disabled={submitting}>
                                                <span className="msf" style={{ fontSize: 16 }}>pending</span>Under Review
                                            </button>
                                            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => updateInvoiceStatus(selectedInvoice.id, 'approved')} disabled={submitting}>
                                                <span className="msf" style={{ fontSize: 16 }}>check</span>Approve
                                            </button>
                                        </div>
                                    )}
                                    {selectedInvoice.status === 'approved' && (
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            {!showPaymentForm ? (
                                                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowPaymentForm(true)}>
                                                    <span className="msf" style={{ fontSize: 16 }}>payments</span>Record Payment
                                                </button>
                                            ) : (
                                                <>
                                                    <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowPaymentForm(false)}>Cancel</button>
                                                    <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => recordPayment(selectedInvoice.id)} disabled={submitting}>
                                                        {submitting ? <div style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> : <><span className="msf" style={{ fontSize: 16 }}>save</span>Confirm Payment</>}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {(['paid', 'rejected', 'draft'].includes(selectedInvoice.status)) && (
                                        <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSelectedInvoice(null)}>Close</button>
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