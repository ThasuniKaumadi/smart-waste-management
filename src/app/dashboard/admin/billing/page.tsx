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
]

export default function AdminBillingPage() {
    const [profile, setProfile] = useState<any>(null)
    const [billing, setBilling] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: records } = await supabase
            .from('billing_records')
            .select('*, profiles(full_name, organisation_name, email)')
            .order('created_at', { ascending: false })
        setBilling(records || [])
        setLoading(false)
    }

    const filtered = filter === 'all' ? billing : billing.filter(b => b.status === filter)
    const totalRevenue = billing.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0)
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
            role="Admin"
            userName={profile?.full_name || ''}
            navItems={ADMIN_NAV}
            primaryAction={{ label: 'Add User', href: '/dashboard/admin/users', icon: 'person_add' }}
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
        .filter-btn {
          padding: 6px 16px; border-radius: 99px; font-size: 12px; font-weight: 700;
          font-family: 'Manrope', sans-serif; border: none; cursor: pointer;
          transition: all 0.2s ease;
        }
        .filter-btn.active { background: #00450d; color: white; }
        .filter-btn:not(.active) { background: #f1f5f9; color: '#64748b'; }
        .filter-btn:not(.active):hover { background: #e2e8f0; }
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
                    Admin · Billing Management
                </span>
                <h1 className="font-headline font-extrabold tracking-tight"
                    style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Revenue <span style={{ color: '#1b5e20' }}>Overview</span>
                </h1>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {/* Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 s2">
                        <div className="bento-card-green p-6">
                            <div className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-8 -mt-8"
                                style={{ background: 'rgba(163,246,156,0.06)' }} />
                            <div className="relative z-10">
                                <span className="material-symbols-outlined mb-2 block"
                                    style={{ color: 'rgba(163,246,156,0.7)', fontSize: '24px' }}>payments</span>
                                <p className="text-xs font-bold uppercase mb-1"
                                    style={{ letterSpacing: '0.15em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                                    Total Revenue
                                </p>
                                <p className="font-headline font-extrabold text-2xl">LKR {totalRevenue.toLocaleString()}</p>
                            </div>
                        </div>

                        {[
                            { label: 'Pending', value: `LKR ${totalPending.toLocaleString()}`, icon: 'pending', color: '#92400e', bg: '#fefce8' },
                            { label: 'Total Invoices', value: billing.length, icon: 'receipt_long', color: '#00450d', bg: '#f0fdf4' },
                            { label: 'Paid Invoices', value: billing.filter(b => b.status === 'paid').length, icon: 'check_circle', color: '#1b5e20', bg: '#f0fdf4' },
                        ].map(m => (
                            <div key={m.label} className="bento-card p-6">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                                    style={{ background: m.bg }}>
                                    <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '20px' }}>{m.icon}</span>
                                </div>
                                <p className="text-xs font-bold uppercase mb-1"
                                    style={{ letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>{m.label}</p>
                                <p className="font-headline font-extrabold text-2xl" style={{ color: '#181c22' }}>{m.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filter + table */}
                    <div className="bento-card s3">
                        <div className="px-8 py-5 flex items-center justify-between flex-wrap gap-3"
                            style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>All Invoices</h3>
                            <div className="flex items-center gap-2">
                                {['all', 'pending', 'paid', 'failed', 'cancelled'].map(f => (
                                    <button key={f} onClick={() => setFilter(f)}
                                        className={`filter-btn ${filter === f ? 'active' : ''}`}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>receipt_long</span>
                                </div>
                                <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No invoices found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ background: '#f9f9ff' }}>
                                            {['Invoice', 'Business', 'Description', 'Amount', 'Status', 'Date'].map(h => (
                                                <th key={h} className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider"
                                                    style={{ color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(record => (
                                            <tr key={record.id} className="hover:bg-slate-50 transition-colors"
                                                style={{ borderTop: '1px solid rgba(0,69,13,0.04)' }}>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                        #{record.id.slice(0, 8).toUpperCase()}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-medium" style={{ color: '#181c22' }}>
                                                        {(record.profiles as any)?.organisation_name || (record.profiles as any)?.full_name || '—'}
                                                    </p>
                                                    <p className="text-xs" style={{ color: '#94a3b8' }}>
                                                        {(record.profiles as any)?.email}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm" style={{ color: '#64748b' }}>
                                                        {record.description || 'Waste Collection'}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                        LKR {record.amount.toLocaleString()}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="status-badge" style={statusStyle(record.status)}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm" style={{ color: '#64748b' }}>
                                                        {new Date(record.created_at).toLocaleDateString('en-GB', {
                                                            day: 'numeric', month: 'short', year: 'numeric'
                                                        })}
                                                    </p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="px-8 py-4 flex items-center gap-3"
                            style={{ borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>verified</span>
                            <p className="text-xs" style={{ color: '#717a6d' }}>
                                All payments processed via PayHere · LKR · CMC 2026
                            </p>
                        </div>
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}