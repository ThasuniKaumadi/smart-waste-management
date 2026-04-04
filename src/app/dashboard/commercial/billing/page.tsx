'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const COMMERCIAL_NAV = [
    { label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' },
    { label: 'Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_month' },
    { label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' },
    { label: 'Complaints', href: '/dashboard/commercial/complaints', icon: 'feedback' },
    { label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' },
]

declare global {
    interface Window {
        payhere: any
    }
}

export default function CommercialBillingPage() {
    const [profile, setProfile] = useState<any>(null)
    const [billing, setBilling] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [payingId, setPayingId] = useState<string | null>(null)
    const payhereLoaded = useRef(false)

    useEffect(() => {
        // Load PayHere JS
        if (!payhereLoaded.current) {
            const script = document.createElement('script')
            script.src = 'https://www.payhere.lk/lib/payhere.js'
            script.async = true
            document.head.appendChild(script)
            payhereLoaded.current = true
        }
        loadData()
    }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: records, error: billingError } = await supabase
            .from('billing_records')
            .select('*')
            .eq('commercial_id', user.id)
            .order('created_at', { ascending: false })

        console.log('User ID:', user.id)
        console.log('Billing records:', records)
        console.log('Billing error:', billingError)

        setBilling(records || [])
        setLoading(false)
    }

    async function handlePay(billingRecord: any) {
        setPayingId(billingRecord.id)
        try {
            const res = await fetch('/api/payhere/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ billing_id: billingRecord.id }),
            })
            const data = await res.json()

            if (!window.payhere) {
                alert('PayHere is still loading. Please try again.')
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

            window.payhere.onCompleted = async (orderId: string) => {
                await loadData()
                setPayingId(null)
            }
            window.payhere.onDismissed = () => setPayingId(null)
            window.payhere.onError = (error: string) => {
                console.error('PayHere error:', error)
                setPayingId(null)
            }

            window.payhere.startPayment(payment)
        } catch (err) {
            console.error(err)
            setPayingId(null)
        }
    }

    const totalPaid = billing.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0)
    const totalPending = billing.filter(b => b.status === 'pending').reduce((sum, b) => sum + b.amount, 0)

    function statusStyle(status: string) {
        if (status === 'paid') return { background: '#f0fdf4', color: '#00450d' }
        if (status === 'pending') return { background: '#fefce8', color: '#92400e' }
        if (status === 'failed') return { background: '#fef2f2', color: '#ba1a1a' }
        if (status === 'cancelled') return { background: '#f8fafc', color: '#64748b' }
        return { background: '#f8fafc', color: '#64748b' }
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
          border: 1px solid rgba(0,69,13,0.04);
          overflow: hidden;
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
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
      `}</style>

            <section className="mb-10 s1">
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
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 s2">
                        <div className="bento-card-green p-8">
                            <div className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-10 -mt-10"
                                style={{ background: 'rgba(163,246,156,0.06)' }} />
                            <div className="relative z-10">
                                <span className="material-symbols-outlined mb-3 block"
                                    style={{ color: 'rgba(163,246,156,0.7)', fontSize: '28px' }}>payments</span>
                                <p className="text-xs font-bold uppercase mb-1"
                                    style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                                    Total Paid
                                </p>
                                <p className="font-headline font-extrabold text-3xl tracking-tight">
                                    LKR {totalPaid.toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="bento-card p-8">
                            <span className="material-symbols-outlined mb-3 block"
                                style={{ color: '#92400e', fontSize: '28px' }}>pending</span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Outstanding
                            </p>
                            <p className="font-headline font-extrabold text-3xl tracking-tight" style={{ color: '#181c22' }}>
                                LKR {totalPending.toLocaleString()}
                            </p>
                            <p className="text-xs mt-1 font-semibold" style={{ color: '#92400e' }}>
                                {billing.filter(b => b.status === 'pending').length} invoice{billing.filter(b => b.status === 'pending').length !== 1 ? 's' : ''} pending
                            </p>
                        </div>

                        <div className="bento-card p-8">
                            <span className="material-symbols-outlined mb-3 block"
                                style={{ color: '#00450d', fontSize: '28px' }}>receipt_long</span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Total Invoices
                            </p>
                            <p className="font-headline font-extrabold text-3xl tracking-tight" style={{ color: '#181c22' }}>
                                {billing.length}
                            </p>
                            <p className="text-xs mt-1 font-semibold" style={{ color: '#00450d' }}>
                                {billing.filter(b => b.status === 'paid').length} paid
                            </p>
                        </div>
                    </div>

                    {/* Billing records */}
                    <div className="bento-card s3">
                        <div className="px-8 py-6 flex items-center justify-between"
                            style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                Invoice History
                            </h3>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                                style={{ background: '#f0fdf4' }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#16a34a' }} />
                                <span className="text-xs font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                    PayHere · LKR
                                </span>
                            </div>
                        </div>

                        {billing.length === 0 ? (
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
                                    Invoices are generated automatically when collections are completed at your premises.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y" style={{ borderColor: 'rgba(0,69,13,0.04)' }}>
                                {billing.map(record => (
                                    <div key={record.id} className="px-8 py-5 flex items-center gap-6 hover:bg-slate-50 transition-colors">

                                        {/* Icon */}
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: record.status === 'paid' ? '#f0fdf4' : '#fefce8' }}>
                                            <span className="material-symbols-outlined"
                                                style={{ color: record.status === 'paid' ? '#00450d' : '#92400e', fontSize: '20px' }}>
                                                {record.status === 'paid' ? 'check_circle' : 'receipt'}
                                            </span>
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold" style={{ color: '#181c22' }}>
                                                {record.description || 'Waste Collection Service'}
                                            </p>
                                            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                                                Invoice #{record.id.slice(0, 8).toUpperCase()} ·{' '}
                                                {new Date(record.created_at).toLocaleDateString('en-GB', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                                {record.paid_at && ` · Paid ${new Date(record.paid_at).toLocaleDateString('en-GB')}`}
                                            </p>
                                        </div>

                                        {/* Amount */}
                                        <div className="text-right flex-shrink-0">
                                            <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>
                                                LKR {record.amount.toLocaleString()}
                                            </p>
                                            <p className="text-xs" style={{ color: '#94a3b8' }}>{record.currency}</p>
                                        </div>

                                        {/* Status + action */}
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="status-badge" style={statusStyle(record.status)}>
                                                {record.status}
                                            </span>
                                            {record.status === 'pending' && (
                                                <button
                                                    onClick={() => handlePay(record)}
                                                    disabled={payingId === record.id}
                                                    className="pay-btn"
                                                >
                                                    {payingId === record.id ? (
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
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="px-8 py-4 flex items-center gap-3"
                            style={{ borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>
                                verified
                            </span>
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