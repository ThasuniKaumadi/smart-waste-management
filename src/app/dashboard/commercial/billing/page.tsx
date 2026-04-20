'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const COMMERCIAL_NAV = [
    { label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' },
    { label: 'Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_month' },
    { label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' },
    { label: 'Bins', href: '/dashboard/commercial/bins', icon: 'delete' },
    { label: 'Collection History', href: '/dashboard/commercial/collection-history', icon: 'history' },
    { label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' },
    { label: 'Rate Service', href: '/dashboard/commercial/feedback', icon: 'star' },
    { label: 'Profile', href: '/dashboard/commercial/profile', icon: 'manage_accounts' },
]

declare global { interface Window { payhere: any } }

type Invoice = {
    id: string; invoice_number: string | null; commercial_id: string
    period_start: string | null; period_end: string | null; billing_cycle: string | null
    total_bins: number | null; tier: string | null; rate_per_bin: number | null
    amount: number; status: string; due_date: string | null; paid_at: string | null
    payhere_order_id: string | null; payhere_payment_id: string | null; created_at: string
}
type LineItem = { id: string; invoice_id: string; description: string | null; quantity: number; unit_price: number; total: number; created_at: string }
type BillingSummary = { commercial_id: string; organisation_name: string | null; full_name: string | null; district: string | null; ward: string | null; billing_cycle: string | null; billing_suspended: boolean | null; total_bins_this_period: number | null; bins_this_week: number | null; total_stops_completed: number | null; last_collection: string | null; current_tier: string | null }

const UNPAID = ['pending', 'unpaid', 'failed', 'overdue']
const PAYABLE = ['pending', 'unpaid', 'overdue']

function fd(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fp(s: string | null, e: string | null) {
    if (!s || !e) return null
    const sd = new Date(s), ed = new Date(e)
    const sy = sd.getFullYear() === ed.getFullYear()
    return `${sd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: sy ? undefined : 'numeric' })} – ${ed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export default function CommercialBillingPage() {
    const [profile, setProfile] = useState<any>(null)
    const [summary, setSummary] = useState<BillingSummary | null>(null)
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [lineItemsByInvoice, setLineItemsByInvoice] = useState<Record<string, LineItem[]>>({})
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [payingId, setPayingId] = useState<string | null>(null)
    const [payhereReady, setPayhereReady] = useState(false)
    const scriptRef = useRef(false)

    useEffect(() => {
        if (!scriptRef.current) {
            scriptRef.current = true
            if (window.payhere) setPayhereReady(true)
            else {
                const s = document.createElement('script')
                s.src = 'https://www.payhere.lk/lib/payhere.js'; s.async = true
                s.onload = () => setPayhereReady(true)
                document.head.appendChild(s)
            }
        }
        loadData()
    }, [])

    async function loadData() {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoadError('Not signed in'); setLoading(false); return }
            const [pR, sR, iR] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', user.id).single(),
                supabase.from('commercial_billing_summary').select('*').eq('commercial_id', user.id).maybeSingle(),
                supabase.from('invoices').select('*').eq('commercial_id', user.id).order('created_at', { ascending: false }),
            ])
            if (iR.error) setLoadError('Could not load invoices. Please refresh.')
            setProfile(pR.data); setSummary(sR.data)
            const list = (iR.data ?? []) as Invoice[]
            setInvoices(list)
            if (list.length > 0) {
                const { data: li } = await supabase.from('invoice_line_items').select('*').in('invoice_id', list.map(i => i.id)).order('created_at', { ascending: true })
                const g: Record<string, LineItem[]> = {};
                (li ?? []).forEach((x: LineItem) => { if (!g[x.invoice_id]) g[x.invoice_id] = []; g[x.invoice_id].push(x) })
                setLineItemsByInvoice(g)
            }
        } catch (err: any) { setLoadError(err?.message || 'Failed to load') }
        finally { setLoading(false) }
    }

    function toggle(id: string) { setExpandedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }) }

    async function handlePay(invoice: Invoice) {
        if (!payhereReady || !window.payhere) { alert('PayHere is still loading.'); return }
        setPayingId(invoice.id)
        try {
            const res = await fetch('/api/payhere/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_id: invoice.id }) })
            const data = await res.json()
            if (data.error) { alert('Failed: ' + data.error); setPayingId(null); return }
            const payment = { sandbox: data.sandbox, merchant_id: data.merchant_id, return_url: `${window.location.origin}/dashboard/commercial/billing?status=success`, cancel_url: `${window.location.origin}/dashboard/commercial/billing?status=cancelled`, notify_url: `${window.location.origin}/api/payhere/notify`, order_id: data.order_id, items: data.items, amount: data.amount, currency: data.currency, hash: data.hash, first_name: data.first_name, last_name: data.last_name, email: data.email, phone: data.phone, address: data.address, city: data.city, country: data.country }
            window.payhere.onCompleted = async () => { await loadData(); setPayingId(null) }
            window.payhere.onDismissed = () => setPayingId(null)
            window.payhere.onError = (e: string) => { console.error(e); setPayingId(null) }
            window.payhere.startPayment(payment)
        } catch { setPayingId(null) }
    }

    const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0)
    const totalUnpaid = invoices.filter(i => UNPAID.includes(i.status)).reduce((s, i) => s + Number(i.amount), 0)
    const totalAll = totalPaid + totalUnpaid
    const paidPct = totalAll > 0 ? (totalPaid / totalAll) * 100 : 100
    const overdueInvoices = invoices.filter(i => i.status === 'overdue')
    const pendingCount = invoices.filter(i => UNPAID.includes(i.status)).length
    const isSuspended = profile?.billing_suspended === true || summary?.billing_suspended === true
    const currentTier = (summary?.current_tier || profile?.tier || '—').replace(/_/g, ' ')
    const binsThisWeek = summary?.bins_this_week ?? 0
    const totalBinsThisPeriod = summary?.total_bins_this_period ?? 0

    function sBadge(status: string) {
        if (status === 'paid') return { bg: '#f0fdf4', color: '#00450d', border: '#bbf7d0' }
        if (status === 'pending' || status === 'unpaid') return { bg: '#fefce8', color: '#92400e', border: '#fde68a' }
        if (status === 'overdue') return { bg: '#fef2f2', color: '#ba1a1a', border: '#fecaca' }
        if (status === 'failed') return { bg: '#fef2f2', color: '#ba1a1a', border: '#fecaca' }
        return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }
    }
    function sLabel(status: string) {
        if (status === 'pending' || status === 'unpaid') return 'Due'
        if (status === 'overdue') return 'Overdue'
        if (status === 'paid') return 'Paid'
        if (status === 'failed') return 'Failed'
        return status
    }

    return (
        <DashboardLayout
            role="Commercial"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={COMMERCIAL_NAV}
            primaryAction={{ label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' }}
        >
            <style>{`
                .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
                .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
                .pay-btn{background:#00450d;color:white;border:none;border-radius:99px;padding:8px 18px;font-family:'Manrope',sans-serif;font-weight:700;font-size:12px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:6px}
                .pay-btn:hover{background:#1b5e20;box-shadow:0 4px 12px rgba(0,69,13,0.25);transform:translateY(-1px)}
                .pay-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
                .expand-btn{width:28px;height:28px;border-radius:8px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#717a6d;transition:all 0.2s}
                .expand-btn:hover{background:rgba(0,69,13,0.06);color:#00450d}
                .inv-row{padding:16px 24px;display:flex;align-items:center;gap:14px;border-bottom:1px solid rgba(0,69,13,0.04);cursor:pointer;transition:background 0.1s;position:relative}
                .inv-row:hover{background:#fafaf9}
                .inv-row:last-child{border-bottom:none}
                .li-section{background:#f9fbf7;padding:16px 24px;border-top:1px solid rgba(0,69,13,0.06);animation:expandIn 0.2s ease-out}
                .li-row{display:grid;grid-template-columns:1fr 72px 110px 110px;gap:12px;padding:9px 0;border-bottom:1px dashed rgba(0,69,13,0.07);font-size:12px}
                .li-row:last-child{border-bottom:none}
                @keyframes expandIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
                .badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;font-family:'Manrope',sans-serif;letter-spacing:0.07em;text-transform:uppercase;border:1px solid transparent}
                @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
                .a1{animation:fadeUp 0.4s ease 0.05s both}
                .a2{animation:fadeUp 0.4s ease 0.1s both}
                .a3{animation:fadeUp 0.4s ease 0.15s both}
            `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Commercial Billing · ClearPath
                </p>
                <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif' }}>
                    Billing <span style={{ color: '#00450d' }}>Centre</span>
                </h1>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #00450d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* Alerts */}
                    {loadError && (
                        <div className="a1" style={{ borderRadius: '14px', padding: '14px 18px', marginBottom: '16px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="msf" style={{ color: '#ba1a1a', fontSize: '20px' }}>error</span>
                            <p style={{ fontSize: '13px', color: '#991b1b' }}>{loadError}</p>
                        </div>
                    )}
                    {isSuspended && (
                        <div className="a1" style={{ borderRadius: '14px', padding: '14px 18px', marginBottom: '16px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <span className="msf" style={{ color: '#ba1a1a', fontSize: '20px', flexShrink: 0 }}>block</span>
                            <div>
                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#ba1a1a', fontFamily: 'Manrope,sans-serif', marginBottom: '3px' }}>Service Suspended</p>
                                <p style={{ fontSize: '12px', color: '#991b1b' }}>Settle all outstanding invoices to restore service. Contact CMC at <strong>011 269 4614</strong>.</p>
                            </div>
                        </div>
                    )}
                    {!isSuspended && overdueInvoices.length > 0 && (
                        <div className="a1" style={{ borderRadius: '14px', padding: '14px 18px', marginBottom: '16px', background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <span className="msf" style={{ color: '#d97706', fontSize: '20px', flexShrink: 0 }}>warning</span>
                            <p style={{ fontSize: '13px', color: '#92400e' }}>
                                <strong>{overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''}</strong> totalling LKR {overdueInvoices.reduce((s, i) => s + Number(i.amount), 0).toLocaleString()}. Please pay to avoid suspension.
                            </p>
                        </div>
                    )}

                    {/* Finance hero — two column */}
                    <div className="a2" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px', marginBottom: '20px' }}>

                        {/* Outstanding hero */}
                        <div style={{ background: '#181c22', borderRadius: '20px', padding: '32px', position: 'relative', overflow: 'hidden', color: 'white' }}>
                            <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
                            <div style={{ position: 'absolute', bottom: '-20px', left: '40px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)' }} />
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '8px' }}>
                                    Outstanding balance
                                </p>
                                <p style={{ fontSize: '44px', fontWeight: 900, fontFamily: 'Manrope,sans-serif', lineHeight: 1, marginBottom: '6px', color: totalUnpaid > 0 ? 'white' : '#a3f69c' }}>
                                    LKR {totalUnpaid.toLocaleString()}
                                </p>
                                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '24px' }}>
                                    {pendingCount > 0 ? `${pendingCount} invoice${pendingCount > 1 ? 's' : ''} pending` : 'No outstanding amount'}
                                </p>

                                {/* Payment progress bar */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Manrope,sans-serif' }}>Payment progress</span>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#a3f69c', fontFamily: 'Manrope,sans-serif' }}>{Math.round(paidPct)}% paid</span>
                                    </div>
                                    <div style={{ height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', borderRadius: '99px', background: '#a3f69c', width: `${paidPct}%`, transition: 'width 1s ease' }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>LKR {totalPaid.toLocaleString()} paid</span>
                                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>LKR {totalAll.toLocaleString()} total</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: account details */}
                        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '0' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '16px' }}>
                                Account details
                            </p>
                            {[
                                { label: 'Billing cycle', value: profile?.billing_cycle === 'quarterly' ? 'Quarterly' : 'Monthly', icon: 'calendar_month' },
                                { label: 'Current tier', value: currentTier, icon: 'verified' },
                                { label: 'Bins this week', value: `${binsThisWeek}`, icon: 'delete' },
                                { label: 'This period', value: `${totalBinsThisPeriod} bins`, icon: 'history' },
                            ].map((item, i) => (
                                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < 3 ? '1px solid rgba(0,69,13,0.06)' : 'none' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="msf" style={{ fontSize: '15px', color: '#00450d' }}>{item.icon}</span>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{item.value}</p>
                                        <p style={{ fontSize: '10px', color: '#94a3b8' }}>{item.label}</p>
                                    </div>
                                </div>
                            ))}

                            {/* PayHere status */}
                            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: payhereReady ? '#16a34a' : '#f59e0b', animation: payhereReady ? 'none' : 'pulse 1s infinite' }} />
                                <span style={{ fontSize: '11px', color: '#717a6d', fontFamily: 'Manrope,sans-serif' }}>
                                    PayHere {payhereReady ? 'ready' : 'loading...'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Invoice ledger */}
                    <div className="card a3">
                        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>Invoice History</h2>
                                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Click any invoice to view line items</p>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>
                                {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {invoices.length === 0 ? (
                            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                                <span className="msf" style={{ fontSize: '40px', color: '#e2e8f0', display: 'block', marginBottom: '12px' }}>receipt_long</span>
                                <p style={{ fontSize: '15px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: '6px' }}>No invoices yet</p>
                                <p style={{ fontSize: '13px', color: '#94a3b8' }}>Invoices are generated at the end of each billing period.</p>
                            </div>
                        ) : (
                            invoices.map((invoice, idx) => {
                                const isExpanded = expandedIds.has(invoice.id)
                                const lineItems = lineItemsByInvoice[invoice.id] ?? []
                                const period = fp(invoice.period_start, invoice.period_end)
                                const isPayable = PAYABLE.includes(invoice.status)
                                const sb = sBadge(invoice.status)
                                const isLast = idx === invoices.length - 1
                                return (
                                    <div key={invoice.id}>
                                        <div className="inv-row" onClick={() => toggle(invoice.id)}
                                            style={{ background: invoice.status === 'overdue' ? '#fff9f9' : undefined }}>

                                            {/* Timeline dot */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: invoice.status === 'paid' ? '#00450d' : invoice.status === 'overdue' ? '#ba1a1a' : '#f59e0b', border: '2px solid white', boxShadow: `0 0 0 2px ${invoice.status === 'paid' ? '#bbf7d0' : invoice.status === 'overdue' ? '#fecaca' : '#fde68a'}`, flexShrink: 0 }} />
                                                {!isLast && <div style={{ width: '1px', height: '100%', minHeight: '20px', background: 'rgba(0,69,13,0.08)', marginTop: '4px' }} />}
                                            </div>

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', marginBottom: '2px' }}>
                                                    {invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : `Invoice #${invoice.id.slice(0, 8).toUpperCase()}`}
                                                </p>
                                                <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                    {period ?? fd(invoice.created_at)}
                                                    {invoice.total_bins !== null && ` · ${invoice.total_bins} bins`}
                                                    {invoice.tier && ` · ${invoice.tier.replace(/_/g, ' ')}`}
                                                    {invoice.due_date && invoice.status !== 'paid' && ` · Due ${fd(invoice.due_date)}`}
                                                </p>
                                            </div>

                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <p style={{ fontSize: '16px', fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>LKR {Number(invoice.amount).toLocaleString()}</p>
                                                {invoice.rate_per_bin && <p style={{ fontSize: '10px', color: '#94a3b8' }}>@ LKR {Number(invoice.rate_per_bin).toLocaleString()}/bin</p>}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                                <span className="badge" style={{ background: sb.bg, color: sb.color, borderColor: sb.border }}>{sLabel(invoice.status)}</span>
                                                {isPayable && (
                                                    <button className="pay-btn" onClick={() => handlePay(invoice)} disabled={payingId === invoice.id || !payhereReady}
                                                        style={invoice.status === 'overdue' ? { background: '#ba1a1a' } : {}}>
                                                        {payingId === invoice.id ? (
                                                            <><div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />Processing...</>
                                                        ) : (
                                                            <><span className="msf" style={{ fontSize: '13px' }}>payments</span>Pay Now</>
                                                        )}
                                                    </button>
                                                )}
                                                <button className="expand-btn" onClick={e => { e.stopPropagation(); toggle(invoice.id) }}>
                                                    <span className="msf" style={{ fontSize: '18px', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'block' }}>expand_more</span>
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="li-section">
                                                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: '#00450d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '12px' }}>
                                                    Line Items · {lineItems.length} entries
                                                </p>
                                                {lineItems.length === 0 ? (
                                                    <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No line items for this invoice.</p>
                                                ) : (
                                                    <>
                                                        <div className="li-row" style={{ color: '#717a6d', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Manrope,sans-serif', paddingBottom: '8px' }}>
                                                            <span>Description</span>
                                                            <span style={{ textAlign: 'right' }}>Qty</span>
                                                            <span style={{ textAlign: 'right' }}>Unit</span>
                                                            <span style={{ textAlign: 'right' }}>Total</span>
                                                        </div>
                                                        {lineItems.map(li => (
                                                            <div key={li.id} className="li-row">
                                                                <span style={{ color: '#181c22' }}>
                                                                    {li.description || 'Collection charge'}
                                                                    <span style={{ color: '#94a3b8', fontSize: '10px', display: 'block', marginTop: '1px' }}>{fd(li.created_at)}</span>
                                                                </span>
                                                                <span style={{ textAlign: 'right', color: '#181c22' }}>{li.quantity}</span>
                                                                <span style={{ textAlign: 'right', color: '#181c22' }}>LKR {Number(li.unit_price).toLocaleString()}</span>
                                                                <span style={{ textAlign: 'right', fontWeight: 700, color: '#181c22' }}>LKR {Number(li.total).toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                        <div className="li-row" style={{ borderTop: '1px solid rgba(0,69,13,0.12)', borderBottom: 'none', marginTop: '8px', paddingTop: '10px' }}>
                                                            <span style={{ fontWeight: 700, color: '#00450d' }}>Total</span>
                                                            <span /><span />
                                                            <span style={{ textAlign: 'right', fontWeight: 800, color: '#00450d' }}>LKR {Number(invoice.amount).toLocaleString()}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )}

                        <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="msf" style={{ color: '#00450d', fontSize: '14px' }}>verified</span>
                            <p style={{ fontSize: '11px', color: '#717a6d' }}>Payments secured by PayHere · All amounts in Sri Lankan Rupees (LKR) · CMC 2026</p>
                        </div>
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}