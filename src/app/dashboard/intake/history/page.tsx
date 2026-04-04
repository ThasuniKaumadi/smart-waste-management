'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const INTAKE_NAV = [
    { label: 'Overview', href: '/dashboard/intake', icon: 'dashboard' },
    { label: 'New Intake', href: '/dashboard/intake/log', icon: 'add_circle' },
    { label: 'History', href: '/dashboard/intake/history', icon: 'history' },
]

export default function IntakeHistoryPage() {
    const [profile, setProfile] = useState<any>(null)
    const [intakes, setIntakes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data } = await supabase
            .from('waste_intake_logs')
            .select('*')
            .eq('operator_id', user.id)
            .order('created_at', { ascending: false })
        setIntakes(data || [])
        setLoading(false)
    }

    const isRecycler = profile?.role === 'recycling_partner'

    const filtered = filter === 'all' ? intakes
        : filter === 'rejected' ? intakes.filter(i => i.is_rejected)
            : filter === 'accepted' ? intakes.filter(i => !i.is_rejected)
                : intakes.filter(i => i.payment_status === filter)

    const totalWeight = intakes.filter(i => !i.is_rejected).reduce((sum, i) => sum + (i.actual_quantity || 0), 0)
    const totalAmount = intakes.filter(i => !i.is_rejected && i.total_amount).reduce((sum, i) => sum + (i.total_amount || 0), 0)

    function conditionStyle(condition: string) {
        if (condition === 'segregated') return { background: '#f0fdf4', color: '#00450d' }
        if (condition === 'mixed') return { background: '#fefce8', color: '#92400e' }
        if (condition === 'contaminated') return { background: '#fef2f2', color: '#ba1a1a' }
        return { background: '#f8fafc', color: '#64748b' }
    }

    return (
        <DashboardLayout
            role={isRecycler ? 'Recycling Partner' : 'Facility Operator'}
            userName={profile?.full_name || ''}
            navItems={INTAKE_NAV}
            primaryAction={{ label: 'New Intake', href: '/dashboard/intake/log', icon: 'add' }}
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
        .filter-btn {
          padding: 6px 16px; border-radius: 99px; font-size: 12px;
          font-weight: 700; font-family: 'Manrope', sans-serif;
          border: none; cursor: pointer; transition: all 0.2s ease;
        }
        .filter-btn.active { background: #00450d; color: white; }
        .filter-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .status-badge {
          display: inline-flex; align-items: center; padding: 3px 10px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em;
          text-transform: uppercase; white-space: nowrap;
        }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
      `}</style>

            <section className="mb-8 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    {isRecycler ? 'Recycling Partner' : 'Facility Operator'} · Intake History
                </span>
                <h1 className="font-headline font-extrabold tracking-tight"
                    style={{ fontSize: '40px', color: '#181c22', lineHeight: 1.1 }}>
                    Intake <span style={{ color: '#1b5e20' }}>History</span>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
                        {[
                            { label: 'Total Intakes', value: intakes.length, icon: 'inventory', color: '#00450d' },
                            { label: 'Total Weight', value: `${totalWeight}kg`, icon: 'scale', color: '#1b5e20' },
                            { label: 'Rejections', value: intakes.filter(i => i.is_rejected).length, icon: 'cancel', color: '#ba1a1a' },
                            { label: isRecycler ? 'Total Payable' : 'Accepted', value: isRecycler ? `LKR ${totalAmount.toLocaleString()}` : intakes.filter(i => !i.is_rejected).length, icon: isRecycler ? 'payments' : 'check_circle', color: '#2e7d32' },
                        ].map(m => (
                            <div key={m.label} className="bento-card p-6">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                                    style={{ background: `${m.color}12` }}>
                                    <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '20px' }}>{m.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-2xl tracking-tight mb-1" style={{ color: '#181c22' }}>{m.value}</p>
                                <p className="text-xs font-bold uppercase" style={{ letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>{m.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="bento-card s3">
                        <div className="px-8 py-5 flex flex-wrap items-center justify-between gap-3"
                            style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>All Records</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                {['all', 'accepted', 'rejected', ...(isRecycler ? ['pending', 'paid'] : [])].map(f => (
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
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>inventory</span>
                                </div>
                                <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No records found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ background: '#f9f9ff' }}>
                                            {['Date & Time', 'Vehicle', 'Waste Type', isRecycler ? 'Material' : 'Method', 'Quantity', 'Condition', 'Status', ...(isRecycler ? ['Amount'] : [])].map(h => (
                                                <th key={h} className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider"
                                                    style={{ color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50 transition-colors"
                                                style={{ borderTop: '1px solid rgba(0,69,13,0.04)' }}>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-medium" style={{ color: '#181c22' }}>
                                                        {new Date(log.received_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                    </p>
                                                    <p className="text-xs" style={{ color: '#94a3b8' }}>
                                                        {new Date(log.received_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-medium" style={{ color: '#181c22' }}>{log.vehicle_number || '—'}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm" style={{ color: '#64748b', textTransform: 'capitalize' }}>{log.waste_type || '—'}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm" style={{ color: '#64748b', textTransform: 'capitalize' }}>
                                                        {isRecycler ? (log.material_type || '—') : (log.processing_method || '—')}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                        {log.actual_quantity} {log.unit}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {log.condition ? (
                                                        <span className="status-badge" style={conditionStyle(log.condition)}>
                                                            {log.condition}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="status-badge"
                                                        style={log.is_rejected ? { background: '#fef2f2', color: '#ba1a1a' } : { background: '#f0fdf4', color: '#00450d' }}>
                                                        {log.is_rejected ? 'Rejected' : 'Accepted'}
                                                    </span>
                                                </td>
                                                {isRecycler && (
                                                    <td className="px-6 py-4">
                                                        <p className="text-sm font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                                            {log.total_amount ? `LKR ${log.total_amount.toLocaleString()}` : '—'}
                                                        </p>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}