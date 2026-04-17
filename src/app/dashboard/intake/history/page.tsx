'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const INTAKE_NAV = [
    { label: 'Overview', href: '/dashboard/intake', icon: 'dashboard' },
    { label: 'New Intake', href: '/dashboard/intake/log', icon: 'add_circle' },
    { label: 'History', href: '/dashboard/intake/history', icon: 'history' },
]

interface WeeklyTonnage {
    week: string
    district: string
    waste_type: string
    total_quantity: number
    unit: string
    intake_count: number
    rejection_count: number
}

export default function IntakeHistoryPage() {
    const [profile, setProfile] = useState<any>(null)
    const [intakes, setIntakes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [activeTab, setActiveTab] = useState<'history' | 'tonnage'>('history')
    const [weeklyData, setWeeklyData] = useState<WeeklyTonnage[]>([])
    const [selectedWeek, setSelectedWeek] = useState<string>('all')

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

        const logs = data || []
        setIntakes(logs)

        // Build weekly tonnage groupings
        const weekMap: Record<string, WeeklyTonnage> = {}
        logs.forEach((log: any) => {
            if (log.is_rejected) return
            const date = new Date(log.received_at || log.created_at)
            // Get Monday of the week
            const day = date.getDay()
            const diff = date.getDate() - day + (day === 0 ? -6 : 1)
            const monday = new Date(date.setDate(diff))
            const weekKey = monday.toISOString().split('T')[0]
            const wasteType = log.waste_type || 'General'
            const district = log.disposal_location || p?.organisation_name || 'Unknown'
            const key = `${weekKey}__${district}__${wasteType}`

            if (!weekMap[key]) {
                weekMap[key] = {
                    week: weekKey,
                    district,
                    waste_type: wasteType,
                    total_quantity: 0,
                    unit: log.unit || 'kg',
                    intake_count: 0,
                    rejection_count: 0,
                }
            }
            weekMap[key].total_quantity += log.actual_quantity || 0
            weekMap[key].intake_count += 1
        })

        // Count rejections per week
        logs.forEach((log: any) => {
            if (!log.is_rejected) return
            const date = new Date(log.received_at || log.created_at)
            const day = date.getDay()
            const diff = date.getDate() - day + (day === 0 ? -6 : 1)
            const monday = new Date(date.setDate(diff))
            const weekKey = monday.toISOString().split('T')[0]
            // Add rejection to any matching week entry
            Object.keys(weekMap).forEach(k => {
                if (k.startsWith(weekKey)) weekMap[k].rejection_count += 1
            })
        })

        setWeeklyData(Object.values(weekMap).sort((a, b) => b.week.localeCompare(a.week)))
        setLoading(false)
    }

    const isRecycler = profile?.role === 'recycling_partner'

    const filtered = filter === 'all' ? intakes
        : filter === 'rejected' ? intakes.filter(i => i.is_rejected)
            : filter === 'accepted' ? intakes.filter(i => !i.is_rejected)
                : intakes.filter(i => i.payment_status === filter)

    const totalWeight = intakes.filter(i => !i.is_rejected).reduce((sum, i) => sum + (i.actual_quantity || 0), 0)
    const totalAmount = intakes.filter(i => !i.is_rejected && i.total_amount).reduce((sum, i) => sum + (i.total_amount || 0), 0)

    // Get unique weeks for filter
    const uniqueWeeks = [...new Set(weeklyData.map(w => w.week))].sort((a, b) => b.localeCompare(a))

    // Filter weekly data by selected week
    const filteredWeekly = selectedWeek === 'all' ? weeklyData : weeklyData.filter(w => w.week === selectedWeek)

    // Group by week for display
    const groupedByWeek = filteredWeekly.reduce((acc, row) => {
        if (!acc[row.week]) acc[row.week] = []
        acc[row.week].push(row)
        return acc
    }, {} as Record<string, WeeklyTonnage[]>)

    // Waste type color map
    const wasteTypeColor: Record<string, { color: string; bg: string }> = {
        'organic': { color: '#15803d', bg: '#f0fdf4' },
        'recyclable': { color: '#1d4ed8', bg: '#eff6ff' },
        'non-recyclable': { color: '#d97706', bg: '#fefce8' },
        'hazardous': { color: '#ba1a1a', bg: '#fef2f2' },
        'general': { color: '#64748b', bg: '#f1f5f9' },
    }

    function getWasteTypeStyle(wt: string) {
        return wasteTypeColor[wt.toLowerCase()] || { color: '#64748b', bg: '#f1f5f9' }
    }

    function formatWeekLabel(weekStart: string) {
        const start = new Date(weekStart)
        const end = new Date(weekStart)
        end.setDate(end.getDate() + 6)
        return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }

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
        .tab-btn {
          padding: 8px 20px; border-radius: 99px; font-size: 13px;
          font-weight: 700; font-family: 'Manrope', sans-serif;
          border: none; cursor: pointer; transition: all 0.2s ease;
          display: flex; align-items: center; gap: 6px;
        }
        .tab-btn.active { background: #00450d; color: white; }
        .tab-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .status-badge {
          display: inline-flex; align-items: center; padding: 3px 10px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em;
          text-transform: uppercase; white-space: nowrap;
        }
        .week-section { margin-bottom: 24px; }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
      `}</style>

            <section className="mb-8 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    {isRecycler ? 'Recycling Partner' : 'Facility Operator'} · Intake Records
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
                            { label: 'Total Weight', value: `${totalWeight.toFixed(1)}kg`, icon: 'scale', color: '#1b5e20' },
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

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }} className="s3">
                        <button onClick={() => setActiveTab('history')}
                            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history</span>
                            All Records
                        </button>
                        <button onClick={() => setActiveTab('tonnage')}
                            className={`tab-btn ${activeTab === 'tonnage' ? 'active' : ''}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>bar_chart</span>
                            Weekly Tonnage Report
                        </button>
                    </div>

                    {/* HISTORY TAB */}
                    {activeTab === 'history' && (
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
                    )}

                    {/* TONNAGE REPORT TAB — R44 */}
                    {activeTab === 'tonnage' && (
                        <div>
                            {/* Week selector */}
                            <div className="bento-card mb-6" style={{ padding: '20px 24px' }}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>
                                            Weekly Tonnage Report
                                        </p>
                                        <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                                            Waste received per district by type — weekly breakdown
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#717a6d', fontSize: '18px' }}>calendar_month</span>
                                        <select
                                            value={selectedWeek}
                                            onChange={e => setSelectedWeek(e.target.value)}
                                            style={{
                                                border: '1.5px solid #e5e7eb', borderRadius: '10px',
                                                padding: '8px 14px', fontSize: '13px',
                                                fontFamily: 'Inter, sans-serif', color: '#181c22',
                                                background: 'white', outline: 'none', cursor: 'pointer',
                                            }}>
                                            <option value="all">All Weeks</option>
                                            {uniqueWeeks.map(w => (
                                                <option key={w} value={w}>{formatWeekLabel(w)}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {weeklyData.length === 0 ? (
                                <div className="bento-card flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>bar_chart</span>
                                    </div>
                                    <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No tonnage data yet</p>
                                    <p className="text-sm" style={{ color: '#94a3b8' }}>Log waste intakes to see weekly reports here.</p>
                                </div>
                            ) : (
                                Object.entries(groupedByWeek)
                                    .sort(([a], [b]) => b.localeCompare(a))
                                    .map(([week, rows]) => {
                                        const weekTotal = rows.reduce((sum, r) => sum + r.total_quantity, 0)
                                        const weekRejections = rows[0]?.rejection_count || 0
                                        return (
                                            <div key={week} className="week-section">
                                                {/* Week header */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ width: '3px', height: '24px', background: '#00450d', borderRadius: '99px' }} />
                                                        <div>
                                                            <p className="font-headline font-bold text-base" style={{ color: '#181c22' }}>
                                                                Week of {formatWeekLabel(week)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '12px', color: '#717a6d' }}>
                                                            Total: <strong style={{ color: '#181c22' }}>{weekTotal.toFixed(1)} kg</strong>
                                                        </span>
                                                        {weekRejections > 0 && (
                                                            <span style={{ fontSize: '12px', color: '#ba1a1a', background: '#fef2f2', padding: '2px 10px', borderRadius: '99px', fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}>
                                                                {weekRejections} rejected
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="bento-card">
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr style={{ background: '#f9f9ff' }}>
                                                                {['Facility / District', 'Waste Type', 'Quantity', 'Deliveries', 'Share'].map(h => (
                                                                    <th key={h} className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider"
                                                                        style={{ color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {rows.map((row, idx) => {
                                                                const wtStyle = getWasteTypeStyle(row.waste_type)
                                                                const share = weekTotal > 0 ? (row.total_quantity / weekTotal) * 100 : 0
                                                                return (
                                                                    <tr key={idx} style={{ borderTop: '1px solid rgba(0,69,13,0.04)' }}
                                                                        className="hover:bg-slate-50 transition-colors">
                                                                        <td className="px-6 py-4">
                                                                            <p className="text-sm font-semibold" style={{ color: '#181c22' }}>{row.district}</p>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <span className="status-badge" style={{ background: wtStyle.bg, color: wtStyle.color }}>
                                                                                {row.waste_type}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <p className="font-headline font-bold text-sm" style={{ color: '#181c22' }}>
                                                                                {row.total_quantity.toFixed(1)} {row.unit}
                                                                            </p>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <p className="text-sm" style={{ color: '#64748b' }}>{row.intake_count}</p>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <div style={{ flex: 1, height: '6px', background: '#f0fdf4', borderRadius: '99px', overflow: 'hidden', minWidth: '60px' }}>
                                                                                    <div style={{ height: '100%', width: `${share}%`, background: '#00450d', borderRadius: '99px' }} />
                                                                                </div>
                                                                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope, sans-serif', minWidth: '36px' }}>
                                                                                    {share.toFixed(0)}%
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })}
                                                            {/* Week total row */}
                                                            <tr style={{ background: '#f0fdf4', borderTop: '2px solid rgba(0,69,13,0.1)' }}>
                                                                <td className="px-6 py-3" colSpan={2}>
                                                                    <p className="text-xs font-bold uppercase" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif', letterSpacing: '0.1em' }}>
                                                                        Week Total
                                                                    </p>
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    <p className="font-headline font-extrabold text-sm" style={{ color: '#00450d' }}>
                                                                        {weekTotal.toFixed(1)} kg
                                                                    </p>
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    <p className="text-sm font-bold" style={{ color: '#00450d' }}>
                                                                        {rows.reduce((sum, r) => sum + r.intake_count, 0)}
                                                                    </p>
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    <p className="text-xs font-bold" style={{ color: '#00450d' }}>100%</p>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )
                                    })
                            )}
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}