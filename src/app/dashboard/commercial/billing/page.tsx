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
    { label: 'Complaints', href: '/dashboard/commercial/complaints', icon: 'feedback' },
    { label: 'Rate Service', href: '/dashboard/commercial/feedback', icon: 'star' },
]

declare global {
    interface Window { payhere: any }
}

type Invoice = {
    id: string
    invoice_number: string | null
    commercial_id: string
    period_start: string | null
    period_end: string | null
    billing_cycle: string | null
    total_bins: number | null
    tier: string | null
    rate_per_bin: number | null
    amount: number
    status: string
    due_date: string | null
    paid_at: string | null
    payhere_order_id: string | null
    payhere_payment_id: string | null
    created_at: string
}

type LineItem = {
    id: string
    invoice_id: string
    description: string | null
    quantity: number
    unit_price: number
    total: number
    created_at: string
}

type BillingSummary = {
    commercial_id: string
    organisation_name: string | null
    full_name: string | null
    district: string | null
    ward: string | null
    billing_cycle: string | null
    billing_suspended: boolean | null
    total_bins_this_period: number | null
    bins_this_week: number | null
    total_stops_completed: number | null
    last_collection: string | null
    current_tier: string | null
}

const UNPAID_STATUSES = ['pending', 'unpaid', 'failed', 'overdue']
const PAYABLE_STATUSES = ['pending', 'unpaid', 'overdue']

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
            if (window.payhere) {
                setPayhereReady(true)
            } else {
                const script = document.createElement('script')
                script.src = 'https://www.payhere.lk/lib/payhere.js'
                script.async = true
                script.onload = () => setPayhereReady(true)
                script.onerror = () => console.error('PayHere script failed to load')
                document.head.appendChild(script)
            }
        }
        loadData()
    }, [])

    async function loadData() {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setLoadError('Not signed in')
                setLoading(false)
                return
            }

            const [profileRes, summaryRes, invoicesRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', user.id).single(),
                supabase.from('commercial_billing_summary').select('*').eq('commercial_id', user.id).maybeSingle(),
                supabase.from('invoices').select('*').eq('commercial_id', user.id).order('created_at', { ascending: false }),
            ])

            if (profileRes.error) console.error('Profile fetch error:', profileRes.error)
            if (summaryRes.error) console.error('Summary fetch error:', summaryRes.error)
            if (invoicesRes.error) {
                console.error('Invoices fetch error:', invoicesRes.error)
                setLoadError('Could not load invoices. Please refresh.')
            }

            setProfile(profileRes.data)
            setSummary(summaryRes.data)
            const invoiceList = (invoicesRes.data ?? []) as Invoice[]
            setInvoices(invoiceList)

            if (invoiceList.length > 0) {
                const invoiceIds = invoiceList.map(i => i.id)
                const { data: lineItems, error: lineError } = await supabase
                    .from('invoice_line_items')
                    .select('*')
                    .in('invoice_id', invoiceIds)
                    .order('created_at', { ascending: true })

                if (lineError) console.error('Line items fetch error:', lineError)

                const grouped: Record<string, LineItem[]> = {}
                    ; (lineItems ?? []).forEach((li: LineItem) => {
                        if (!grouped[li.invoice_id]) grouped[li.invoice_id] = []
                        grouped[li.invoice_id].push(li)
                    })
                setLineItemsByInvoice(grouped)
            }
        } catch (err: any) {
            console.error('Load error:', err)
            setLoadError(err?.message || 'Failed to load billing data')
        } finally {
            setLoading(false)
        }
    }

    function toggleExpanded(invoiceId: string) {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(invoiceId)) next.delete(invoiceId)
            else next.add(invoiceId)
            return next
        })
    }

    async function handlePay(invoice: Invoice) {
        if (!payhereReady || !window.payhere) {
            alert('PayHere is still loading. Please wait a moment and try again.')
            return
        }

        setPayingId(invoice.id)
        try {
            const res = await fetch('/api/payhere/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_id: invoice.id }),
            })
            const data = await res.json()

            if (data.error) {
                alert('Failed to create payment order: ' + data.error)
                setPayingId(null)
                return
            }

            const payment = {
                sandbox: data.sandbox,
                merchant_id: data.merchant_id,
                return_url: `${window.location.origin}/dashboard/commercial/billing?status=success`,
                cancel_url: `${window.location.origin}/dashboard/commercial/billing?status=cancelled`,
                notify_url: `${window.location.origin}/api/payhere/notify`,
                order_id: data.order_id,
                items: data.items,
                amount: data.amount,
                currency: data.currency,
                hash: data.hash,
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email,
                phone: data.phone,
                address: data.address,
                city: data.city,
                country: data.country,
            }

            window.payhere.onCompleted = async () => { await loadData(); setPayingId(null) }
            window.payhere.onDismissed = () => setPayingId(null)
            window.payhere.onError = (error: string) => { console.error('PayHere error:', error); setPayingId(null) }
            window.payhere.startPayment(payment)
        } catch (err) {
            console.error(err)
            setPayingId(null)
        }
    }

    const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0)
    const totalUnpaid = invoices.filter(i => UNPAID_STATUSES.includes(i.status)).reduce((sum, i) => sum + Number(i.amount), 0)
    const overdueInvoices = invoices.filter(i => i.status === 'overdue')
    const pendingCount = invoices.filter(i => UNPAID_STATUSES.includes(i.status)).length
    const isSuspended = profile?.billing_suspended === true || summary?.billing_suspended === true

    const binsThisWeek = summary?.bins_this_week ?? 0
    const totalBinsThisPeriod = summary?.total_bins_this_period ?? 0
    const currentTier = (summary?.current_tier || profile?.tier || '—').replace(/_/g, ' ')

    function statusStyle(status: string) {
        if (status === 'paid') return { background: '#f0fdf4', color: '#00450d' }
        if (status === 'pending' || status === 'unpaid') return { background: '#fefce8', color: '#92400e' }
        if (status === 'overdue') return { background: '#fef2f2', color: '#ba1a1a' }
        if (status === 'failed') return { background: '#fef2f2', color: '#ba1a1a' }
        if (status === 'cancelled') return { background: '#f1f5f9', color: '#475569' }
        return { background: '#f8fafc', color: '#64748b' }
    }

    function statusLabel(status: string) {
        if (status === 'pending' || status === 'unpaid') return 'Due'
        if (status === 'overdue') return 'Overdue'
        if (status === 'paid') return 'Paid'
        if (status === 'failed') return 'Failed'
        if (status === 'cancelled') return 'Cancelled'
        return status
    }

    function formatDate(dateStr: string | null) {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    function formatPeriod(start: string | null, end: string | null) {
        if (!start || !end) return null
        const s = new Date(start)
        const e = new Date(end)
        const sameYear = s.getFullYear() === e.getFullYear()
        const sStr = s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' })
        const eStr = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        return `${sStr} – ${eStr}`
    }

    function invoiceTitle(inv: Invoice) {
        if (inv.invoice_number) return `Invoice ${inv.invoice_number}`
        return `Invoice #${inv.id.slice(0, 8).toUpperCase()}`
    }

    function tierLabel(tier: string | null) {
        if (!tier) return ''
        return tier.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }

    return (
        <DashboardLayout
            role="Commercial"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={COMMERCIAL_NAV}
            primaryAction={{ label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' }}
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
                .bento-card-green {
                    background: #00450d; border-radius: 16px; color: white;
                    overflow: hidden; position: relative;
                }
                .pay-btn {
                    background: #00450d; color: white; border: none;
                    border-radius: 99px; padding: 8px 20px;
                    font-family: 'Manrope', sans-serif; font-weight: 700;
                    font-size: 12px; cursor: pointer; transition: all 0.2s ease;
                    display: flex; align-items: center; gap: 6px;
                }
                .pay-btn:hover { background: #1b5e20; box-shadow: 0 4px 12px rgba(0,69,13,0.25); transform: translateY(-1px); }
                .pay-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                .status-badge {
                    display: inline-flex; align-items: center; padding: 4px 12px;
                    border-radius: 99px; font-size: 10px; font-weight: 700;
                    font-family: 'Manrope', sans-serif; letter-spacing: 0.08em; text-transform: uppercase;
                }
                .expand-btn {
                    width: 28px; height: 28px; border-radius: 8px; border: none;
                    background: transparent; cursor: pointer; display: flex;
                    align-items: center; justify-content: center; color: #717a6d;
                    transition: all 0.2s ease;
                }
                .expand-btn:hover { background: rgba(0,69,13,0.06); color: #00450d; }
                .line-items-section {
                    background: #f9fbf7; padding: 20px 32px; border-top: 1px solid rgba(0,69,13,0.06);
                    animation: expandIn 0.25s ease-out;
                }
                @keyframes expandIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
                .line-item-row {
                    display: grid;
                    grid-template-columns: 1fr 80px 120px 120px;
                    gap: 16px; padding: 10px 0;
                    border-bottom: 1px dashed rgba(0,69,13,0.08);
                    font-size: 13px;
                }
                .line-item-row:last-child { border-bottom: none; }
                .line-item-header {
                    font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
                    text-transform: uppercase; color: #717a6d;
                    font-family: 'Manrope', sans-serif;
                }
                @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
                .s1 { animation: staggerIn 0.5s ease 0.05s both; }
                .s2 { animation: staggerIn 0.5s ease 0.1s both; }
                .s3 { animation: staggerIn 0.5s ease 0.15s both; }
            `}</style>

            {/* Header */}
            <section className="mb-8 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    Commercial Billing · ClearPath
                </span>
                <h1 className="font-headline font-extrabold tracking-tight"
                    style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Billing <span style={{ color: '#1b5e20' }}>Centre</span>
                </h1>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {/* Error banner */}
                    {loadError && (
                        <div className="rounded-2xl p-5 mb-6 flex items-start gap-4 s1"
                            style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                            <span className="material-symbols-outlined mt-0.5" style={{ color: '#ba1a1a', fontSize: '22px' }}>error</span>
                            <div>
                                <p className="font-bold text-sm mb-1" style={{ color: '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}>
                                    Something went wrong
                                </p>
                                <p className="text-sm" style={{ color: '#991b1b' }}>{loadError}</p>
                            </div>
                        </div>
                    )}

                    {/* Suspension warning */}
                    {isSuspended && (
                        <div className="rounded-2xl p-5 mb-6 flex items-start gap-4 s1"
                            style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                            <span className="material-symbols-outlined mt-0.5" style={{ color: '#ba1a1a', fontSize: '22px' }}>block</span>
                            <div>
                                <p className="font-bold text-sm mb-1" style={{ color: '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}>
                                    Service Suspended
                                </p>
                                <p className="text-sm" style={{ color: '#991b1b' }}>
                                    Your waste collection service has been suspended due to overdue payments. Please settle all outstanding invoices to restore service. Contact CMC at <strong>011 269 4614</strong> for assistance.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Overdue reminder */}
                    {!isSuspended && overdueInvoices.length > 0 && (
                        <div className="rounded-2xl p-5 mb-6 flex items-start gap-4 s1"
                            style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
                            <span className="material-symbols-outlined mt-0.5" style={{ color: '#d97706', fontSize: '22px' }}>warning</span>
                            <div>
                                <p className="font-bold text-sm mb-1" style={{ color: '#92400e', fontFamily: 'Manrope, sans-serif' }}>
                                    Payment Overdue — Action Required
                                </p>
                                <p className="text-sm" style={{ color: '#92400e' }}>
                                    You have {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''} totalling{' '}
                                    <strong>LKR {overdueInvoices.reduce((s, i) => s + Number(i.amount), 0).toLocaleString()}</strong>.
                                    Continued non-payment may result in service suspension.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 4 summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 s2">
                        <div className="bento-card-green p-6">
                            <div className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-10 -mt-10"
                                style={{ background: 'rgba(163,246,156,0.06)' }} />
                            <div className="relative z-10">
                                <span className="material-symbols-outlined mb-3 block"
                                    style={{ color: 'rgba(163,246,156,0.7)', fontSize: '26px' }}>check_circle</span>
                                <p className="text-xs font-bold uppercase mb-1"
                                    style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                                    Total Paid
                                </p>
                                <p className="font-headline font-extrabold tracking-tight" style={{ fontSize: '26px' }}>
                                    LKR {totalPaid.toLocaleString()}
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'rgba(163,246,156,0.5)' }}>
                                    {invoices.filter(i => i.status === 'paid').length} settled
                                </p>
                            </div>
                        </div>

                        <div className="bento-card p-6">
                            <span className="material-symbols-outlined mb-3 block"
                                style={{ color: overdueInvoices.length > 0 ? '#ba1a1a' : '#92400e', fontSize: '26px' }}>
                                {overdueInvoices.length > 0 ? 'error' : 'pending'}
                            </span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Outstanding
                            </p>
                            <p className="font-headline font-extrabold tracking-tight" style={{ fontSize: '26px', color: '#181c22' }}>
                                LKR {totalUnpaid.toLocaleString()}
                            </p>
                            <p className="text-xs mt-1 font-semibold"
                                style={{ color: overdueInvoices.length > 0 ? '#ba1a1a' : '#92400e' }}>
                                {pendingCount} pending
                                {overdueInvoices.length > 0 && ` · ${overdueInvoices.length} overdue`}
                            </p>
                        </div>

                        <div className="bento-card p-6">
                            <span className="material-symbols-outlined mb-3 block"
                                style={{ color: '#00450d', fontSize: '26px' }}>delete</span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Bins This Week
                            </p>
                            <p className="font-headline font-extrabold tracking-tight" style={{ fontSize: '26px', color: '#181c22' }}>
                                {binsThisWeek}
                            </p>
                            <p className="text-xs mt-1 font-semibold" style={{ color: '#00450d' }}>
                                {totalBinsThisPeriod} this period
                            </p>
                        </div>

                        <div className="bento-card p-6">
                            <span className="material-symbols-outlined mb-3 block"
                                style={{ color: '#00450d', fontSize: '26px' }}>verified</span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Current Tier
                            </p>
                            <p className="font-headline font-extrabold tracking-tight"
                                style={{ fontSize: '26px', color: '#181c22' }}>
                                {currentTier}
                            </p>
                            <p className="text-xs mt-1 font-semibold" style={{ color: '#00450d' }}>
                                {profile?.billing_cycle === 'quarterly' ? 'Quarterly' : 'Monthly'} billing
                            </p>
                        </div>
                    </div>

                    {/* Invoice list */}
                    <div className="bento-card s3">
                        <div className="px-8 py-6 flex items-center justify-between"
                            style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <div>
                                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                    Invoice History
                                </h3>
                                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                                    Click any invoice to view its line items
                                </p>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: '#f0fdf4' }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: payhereReady ? '#16a34a' : '#f59e0b' }} />
                                <span className="text-xs font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                    {payhereReady ? 'PayHere · Ready' : 'PayHere · Loading...'}
                                </span>
                            </div>
                        </div>

                        {invoices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>
                                        receipt_long
                                    </span>
                                </div>
                                <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>
                                    No invoices yet
                                </p>
                                <p className="text-sm" style={{ color: '#94a3b8' }}>
                                    Invoices are generated automatically at the end of each billing period based on bins collected.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y" style={{ borderColor: 'rgba(0,69,13,0.04)' }}>
                                {invoices.map(invoice => {
                                    const isExpanded = expandedIds.has(invoice.id)
                                    const lineItems = lineItemsByInvoice[invoice.id] ?? []
                                    const period = formatPeriod(invoice.period_start, invoice.period_end)
                                    const isPayable = PAYABLE_STATUSES.includes(invoice.status)
                                    return (
                                        <div key={invoice.id}>
                                            <div
                                                className="px-8 py-5 flex items-center gap-6 hover:bg-slate-50 transition-colors cursor-pointer"
                                                style={invoice.status === 'overdue' ? { background: '#fff9f9' } : {}}
                                                onClick={() => toggleExpanded(invoice.id)}
                                            >
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                    style={{
                                                        background: invoice.status === 'paid' ? '#f0fdf4'
                                                            : invoice.status === 'overdue' ? '#fef2f2' : '#fefce8'
                                                    }}>
                                                    <span className="material-symbols-outlined"
                                                        style={{
                                                            color: invoice.status === 'paid' ? '#00450d'
                                                                : invoice.status === 'overdue' ? '#ba1a1a' : '#92400e',
                                                            fontSize: '20px'
                                                        }}>
                                                        {invoice.status === 'paid' ? 'check_circle'
                                                            : invoice.status === 'overdue' ? 'error' : 'receipt'}
                                                    </span>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold" style={{ color: '#181c22' }}>
                                                        {invoiceTitle(invoice)}
                                                    </p>
                                                    <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                                                        {period ?? formatDate(invoice.created_at)}
                                                        {invoice.total_bins !== null && ` · ${invoice.total_bins} bins`}
                                                        {invoice.tier && ` · ${tierLabel(invoice.tier)}`}
                                                        {invoice.due_date && invoice.status !== 'paid' && ` · Due ${formatDate(invoice.due_date)}`}
                                                    </p>
                                                </div>

                                                <div className="text-right flex-shrink-0">
                                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>
                                                        LKR {Number(invoice.amount).toLocaleString()}
                                                    </p>
                                                    {invoice.rate_per_bin && (
                                                        <p className="text-xs" style={{ color: '#94a3b8' }}>
                                                            @ LKR {Number(invoice.rate_per_bin).toLocaleString()}/bin
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                    <span className="status-badge" style={statusStyle(invoice.status)}>
                                                        {statusLabel(invoice.status)}
                                                    </span>
                                                    {isPayable && (
                                                        <button
                                                            onClick={() => handlePay(invoice)}
                                                            disabled={payingId === invoice.id || !payhereReady}
                                                            className="pay-btn"
                                                            style={invoice.status === 'overdue' ? { background: '#ba1a1a' } : {}}
                                                        >
                                                            {payingId === invoice.id ? (
                                                                <>
                                                                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                                    </svg>
                                                                    Processing...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>payments</span>
                                                                    Pay Now
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                    <button
                                                        className="expand-btn"
                                                        onClick={(e) => { e.stopPropagation(); toggleExpanded(invoice.id) }}
                                                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '20px', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                                            expand_more
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="line-items-section">
                                                    <p className="text-xs font-bold uppercase mb-3"
                                                        style={{ letterSpacing: '0.12em', color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                                        Line Items · {lineItems.length} entries
                                                    </p>
                                                    {lineItems.length === 0 ? (
                                                        <p className="text-xs italic" style={{ color: '#94a3b8' }}>
                                                            No line items recorded for this invoice.
                                                        </p>
                                                    ) : (
                                                        <>
                                                            <div className="line-item-row line-item-header" style={{ color: '#717a6d', paddingBottom: '8px' }}>
                                                                <span>Description</span>
                                                                <span style={{ textAlign: 'right' }}>Qty</span>
                                                                <span style={{ textAlign: 'right' }}>Unit Price</span>
                                                                <span style={{ textAlign: 'right' }}>Total</span>
                                                            </div>
                                                            {lineItems.map(li => (
                                                                <div key={li.id} className="line-item-row">
                                                                    <span style={{ color: '#181c22' }}>
                                                                        {li.description || 'Collection charge'}
                                                                        <span style={{ color: '#94a3b8', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                                                                            {formatDate(li.created_at)}
                                                                        </span>
                                                                    </span>
                                                                    <span style={{ textAlign: 'right', color: '#181c22' }}>{li.quantity}</span>
                                                                    <span style={{ textAlign: 'right', color: '#181c22' }}>LKR {Number(li.unit_price).toLocaleString()}</span>
                                                                    <span style={{ textAlign: 'right', color: '#181c22', fontWeight: 600 }}>LKR {Number(li.total).toLocaleString()}</span>
                                                                </div>
                                                            ))}
                                                            <div className="line-item-row" style={{ borderTop: '1px solid rgba(0,69,13,0.15)', borderBottom: 'none', marginTop: '8px', paddingTop: '12px' }}>
                                                                <span style={{ fontWeight: 700, color: '#00450d' }}>Invoice Total</span>
                                                                <span></span>
                                                                <span></span>
                                                                <span style={{ textAlign: 'right', fontWeight: 700, color: '#00450d' }}>
                                                                    LKR {Number(invoice.amount).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        <div className="px-8 py-4 flex items-center gap-3"
                            style={{ borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>verified</span>
                            <p className="text-xs" style={{ color: '#717a6d' }}>
                                Payments secured by PayHere · All amounts in Sri Lankan Rupees (LKR) · CMC 2026
                            </p>
                        </div>
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}