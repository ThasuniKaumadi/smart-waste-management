'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const RECYCLER_NAV = [
    { label: 'Home', href: '/dashboard/recycling-partner', icon: 'dashboard' },
    { label: 'New Intake', href: '/dashboard/recycling-partner/log', icon: 'add_circle' },
    { label: 'History', href: '/dashboard/recycling-partner/history', icon: 'history' },
    { label: 'Analytics', href: '/dashboard/recycling-partner/analytics', icon: 'bar_chart' },
    { label: 'Disposal', href: '/dashboard/recycling-partner/disposal', icon: 'delete_sweep' },
    { label: 'Profile', href: '/dashboard/recycling-partner/profile', icon: 'person' },
]

interface WeeklyTonnage { week: string; district: string; waste_type: string; total_quantity: number; unit: string; intake_count: number; rejection_count: number }

export default function RecyclerHistoryPage() {
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
        const { data } = await supabase.from('waste_intake_logs').select('*').eq('operator_id', user.id).order('created_at', { ascending: false })
        const logs = data || []
        setIntakes(logs)
        const weekMap: Record<string, WeeklyTonnage> = {}
        logs.forEach((log: any) => {
            if (log.is_rejected) return
            const date = new Date(log.received_at || log.created_at)
            const day = date.getDay(); const diff = date.getDate() - day + (day === 0 ? -6 : 1)
            const monday = new Date(date.setDate(diff)); const weekKey = monday.toISOString().split('T')[0]
            const wasteType = log.waste_type || 'General'; const district = log.disposal_location || p?.organisation_name || 'Unknown'
            const key = `${weekKey}__${district}__${wasteType}`
            if (!weekMap[key]) weekMap[key] = { week: weekKey, district, waste_type: wasteType, total_quantity: 0, unit: log.unit || 'kg', intake_count: 0, rejection_count: 0 }
            weekMap[key].total_quantity += log.actual_quantity || 0; weekMap[key].intake_count += 1
        })
        logs.forEach((log: any) => {
            if (!log.is_rejected) return
            const date = new Date(log.received_at || log.created_at); const day = date.getDay()
            const diff = date.getDate() - day + (day === 0 ? -6 : 1); const monday = new Date(date.setDate(diff))
            const weekKey = monday.toISOString().split('T')[0]
            Object.keys(weekMap).forEach(k => { if (k.startsWith(weekKey)) weekMap[k].rejection_count += 1 })
        })
        setWeeklyData(Object.values(weekMap).sort((a, b) => b.week.localeCompare(a.week)))
        setLoading(false)
    }

    const filtered = filter === 'all' ? intakes : filter === 'rejected' ? intakes.filter(i => i.is_rejected) : filter === 'accepted' ? intakes.filter(i => !i.is_rejected) : intakes.filter(i => i.payment_status === filter)
    const totalWeight = intakes.filter(i => !i.is_rejected).reduce((s, i) => s + (i.actual_quantity || 0), 0)
    const totalAmount = intakes.filter(i => !i.is_rejected && i.total_amount).reduce((s, i) => s + (i.total_amount || 0), 0)
    const chainVerified = intakes.filter(i => !i.is_rejected && i.tx_hash).length
    const uniqueWeeks = [...new Set(weeklyData.map(w => w.week))].sort((a, b) => b.localeCompare(a))
    const filteredWeekly = selectedWeek === 'all' ? weeklyData : weeklyData.filter(w => w.week === selectedWeek)
    const groupedByWeek = filteredWeekly.reduce((acc, row) => { if (!acc[row.week]) acc[row.week] = []; acc[row.week].push(row); return acc }, {} as Record<string, WeeklyTonnage[]>)

    const wasteTypeColor: Record<string, { color: string; bg: string }> = { organic: { color: '#15803d', bg: '#f0fdf4' }, recyclable: { color: '#1d4ed8', bg: '#eff6ff' }, 'non-recyclable': { color: '#d97706', bg: '#fefce8' }, hazardous: { color: '#ba1a1a', bg: '#fef2f2' }, general: { color: '#64748b', bg: '#f1f5f9' } }
    function getWasteTypeStyle(wt: string) { return wasteTypeColor[wt.toLowerCase()] || { color: '#64748b', bg: '#f1f5f9' } }
    function formatWeekLabel(w: string) { const s = new Date(w); const e = new Date(w); e.setDate(e.getDate() + 6); return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` }
    function conditionStyle(c: string) { if (c === 'segregated') return { background: '#f0fdf4', color: '#00450d' }; if (c === 'mixed') return { background: '#fefce8', color: '#92400e' }; if (c === 'contaminated') return { background: '#fef2f2', color: '#ba1a1a' }; return { background: '#f8fafc', color: '#64748b' } }
    function gradeLabel(g: string) { if (g === 'grade_a') return { label: 'Grade A', color: '#15803d', bg: '#f0fdf4' }; if (g === 'grade_b') return { label: 'Grade B', color: '#d97706', bg: '#fefce8' }; if (g === 'grade_c') return { label: 'Grade C', color: '#ba1a1a', bg: '#fef2f2' }; return { label: g || '—', color: '#64748b', bg: '#f1f5f9' } }

    return (
        <DashboardLayout role="Recycling Partner" userName={profile?.full_name || ''} navItems={RECYCLER_NAV}
            primaryAction={{ label: 'New Intake', href: '/dashboard/recycling-partner/log', icon: 'add' }}>
            <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1;}
        .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden;}
        .filter-btn{padding:6px 16px;border-radius:99px;font-size:12px;font-weight:700;font-family:'Manrope',sans-serif;border:none;cursor:pointer;transition:all 0.2s;}
        .filter-btn.active{background:#15803d;color:white;}
        .filter-btn:not(.active){background:#f1f5f9;color:#64748b;}
        .tab-btn{padding:8px 20px;border-radius:99px;font-size:13px;font-weight:700;font-family:'Manrope',sans-serif;border:none;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:6px;}
        .tab-btn.active{background:#15803d;color:white;}
        .tab-btn:not(.active){background:#f1f5f9;color:#64748b;}
        .status-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;font-family:'Manrope',sans-serif;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;}
        .tx-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;background:#f0fdf4;border:1px solid rgba(0,69,13,0.12);font-size:10px;font-family:'Courier New',monospace;color:#15803d;cursor:pointer;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:none;}
        @keyframes staggerIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .s1{animation:staggerIn 0.5s ease 0.05s both}.s2{animation:staggerIn 0.5s ease 0.1s both}.s3{animation:staggerIn 0.5s ease 0.15s both}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

            <section className="s1" style={{ marginBottom: 32 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 8px' }}>Recycling Partner · Records</p>
                <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 40, fontWeight: 800, color: '#181c22', lineHeight: 1.1, margin: 0 }}>
                    Intake <span style={{ color: '#15803d' }}>History</span>
                </h1>
            </section>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <div style={{ width: 28, height: 28, border: '2px solid #15803d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                </div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }} className="s2">
                        {[
                            { label: 'Total Intakes', value: intakes.length, icon: 'inventory', color: '#15803d' },
                            { label: 'Total Weight', value: `${totalWeight.toFixed(1)} kg`, icon: 'scale', color: '#1b5e20' },
                            { label: 'On-Chain', value: chainVerified, icon: 'link', color: '#1d4ed8' },
                            { label: 'Total Payable', value: `LKR ${totalAmount.toLocaleString()}`, icon: 'payments', color: '#7c3aed' },
                        ].map(m => (
                            <div key={m.label} className="card" style={{ padding: 20 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${m.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                    <span className="msf" style={{ color: m.color, fontSize: 18 }}>{m.icon}</span>
                                </div>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 22, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{m.label}</p>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }} className="s3">
                        <button onClick={() => setActiveTab('history')} className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}>
                            <span className="msf" style={{ fontSize: 16 }}>history</span>All Records
                        </button>
                        <button onClick={() => setActiveTab('tonnage')} className={`tab-btn ${activeTab === 'tonnage' ? 'active' : ''}`}>
                            <span className="msf" style={{ fontSize: 16 }}>bar_chart</span>Weekly Tonnage
                        </button>
                    </div>

                    {activeTab === 'history' && (
                        <div className="card s3">
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 17, color: '#181c22', margin: 0 }}>All Records</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    {['all', 'accepted', 'rejected', 'pending', 'paid'].map(f => (
                                        <button key={f} onClick={() => setFilter(f)} className={`filter-btn ${filter === f ? 'active' : ''}`}>
                                            {f.charAt(0).toUpperCase() + f.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {filtered.length === 0 ? (
                                <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                                    <span className="msf" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 12 }}>inventory</span>
                                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: '#181c22', fontSize: 16 }}>No records found</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f9f9ff' }}>
                                                {['Date', 'Vehicle', 'Waste Type', 'Material / Grade', 'Quantity', 'Condition', 'Status', 'Amount', 'Blockchain'].map(h => (
                                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map(log => {
                                                const grade = log.grade ? gradeLabel(log.grade) : null
                                                return (
                                                    <tr key={log.id} style={{ borderTop: '1px solid rgba(0,69,13,0.04)' }}>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <p style={{ fontSize: 13, fontWeight: 600, color: '#181c22', margin: 0 }}>{new Date(log.received_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                                                            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{new Date(log.received_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                                                        </td>
                                                        <td style={{ padding: '12px 16px' }}><p style={{ fontSize: 13, fontWeight: 500, color: '#181c22', margin: 0 }}>{log.vehicle_number || '—'}</p></td>
                                                        <td style={{ padding: '12px 16px' }}><p style={{ fontSize: 13, color: '#64748b', textTransform: 'capitalize', margin: 0 }}>{log.waste_type || '—'}</p></td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <p style={{ fontSize: 13, color: '#181c22', textTransform: 'capitalize', margin: '0 0 3px' }}>{log.material_type || '—'}</p>
                                                            {grade && log.grade && <span className="status-badge" style={{ background: grade.bg, color: grade.color, fontSize: 9 }}>{grade.label}</span>}
                                                        </td>
                                                        <td style={{ padding: '12px 16px' }}><p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{log.actual_quantity} {log.unit}</p></td>
                                                        <td style={{ padding: '12px 16px' }}>{log.condition ? <span className="status-badge" style={conditionStyle(log.condition)}>{log.condition}</span> : '—'}</td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <span className="status-badge" style={log.is_rejected ? { background: '#fef2f2', color: '#ba1a1a' } : { background: '#f0fdf4', color: '#15803d' }}>
                                                                {log.is_rejected ? 'Rejected' : 'Accepted'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px 16px' }}><p style={{ fontSize: 13, fontWeight: 700, color: '#15803d', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{log.total_amount ? `LKR ${log.total_amount.toLocaleString()}` : '—'}</p></td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            {log.tx_hash ? (
                                                                <a href={`https://amoy.polygonscan.com/tx/${log.tx_hash}`} target="_blank" rel="noopener noreferrer" className="tx-chip" title={log.tx_hash}>
                                                                    <span className="msf" style={{ fontSize: 11 }}>verified</span>{log.tx_hash.slice(0, 8)}…
                                                                </a>
                                                            ) : <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'tonnage' && (
                        <div>
                            <div className="card s3" style={{ padding: '20px 24px', marginBottom: 20 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <div>
                                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 17, color: '#181c22', margin: '0 0 2px' }}>Weekly Tonnage Report</p>
                                        <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>Waste received per district by type</p>
                                    </div>
                                    <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}
                                        style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontFamily: 'Inter,sans-serif', color: '#181c22', background: 'white', outline: 'none', cursor: 'pointer' }}>
                                        <option value="all">All Weeks</option>
                                        {uniqueWeeks.map(w => <option key={w} value={w}>{formatWeekLabel(w)}</option>)}
                                    </select>
                                </div>
                            </div>

                            {weeklyData.length === 0 ? (
                                <div className="card s3" style={{ padding: '60px 24px', textAlign: 'center' }}>
                                    <span className="msf" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 12 }}>bar_chart</span>
                                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: '#181c22', fontSize: 16, marginBottom: 4 }}>No tonnage data yet</p>
                                </div>
                            ) : Object.entries(groupedByWeek).sort(([a], [b]) => b.localeCompare(a)).map(([week, rows]) => {
                                const weekTotal = rows.reduce((s, r) => s + r.total_quantity, 0)
                                const weekRejections = rows[0]?.rejection_count || 0
                                return (
                                    <div key={week} style={{ marginBottom: 24 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 3, height: 24, background: '#15803d', borderRadius: 99 }} />
                                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: '#181c22', margin: 0 }}>Week of {formatWeekLabel(week)}</p>
                                            </div>
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                <span style={{ fontSize: 12, color: '#717a6d' }}>Total: <strong style={{ color: '#181c22' }}>{weekTotal.toFixed(1)} kg</strong></span>
                                                {weekRejections > 0 && <span style={{ fontSize: 12, color: '#ba1a1a', background: '#fef2f2', padding: '2px 10px', borderRadius: 99, fontWeight: 700, fontFamily: 'Manrope,sans-serif' }}>{weekRejections} rejected</span>}
                                            </div>
                                        </div>
                                        <div className="card">
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: '#f9f9ff' }}>
                                                        {['Facility / District', 'Waste Type', 'Quantity', 'Deliveries', 'Share'].map(h => (
                                                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map((row, idx) => {
                                                        const wtStyle = getWasteTypeStyle(row.waste_type)
                                                        const share = weekTotal > 0 ? (row.total_quantity / weekTotal) * 100 : 0
                                                        return (
                                                            <tr key={idx} style={{ borderTop: '1px solid rgba(0,69,13,0.04)' }}>
                                                                <td style={{ padding: '12px 16px' }}><p style={{ fontSize: 13, fontWeight: 600, color: '#181c22', margin: 0 }}>{row.district}</p></td>
                                                                <td style={{ padding: '12px 16px' }}><span className="status-badge" style={{ background: wtStyle.bg, color: wtStyle.color }}>{row.waste_type}</span></td>
                                                                <td style={{ padding: '12px 16px' }}><p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 13, color: '#181c22', margin: 0 }}>{row.total_quantity.toFixed(1)} {row.unit}</p></td>
                                                                <td style={{ padding: '12px 16px' }}><p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{row.intake_count}</p></td>
                                                                <td style={{ padding: '12px 16px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                        <div style={{ flex: 1, height: 6, background: '#f0fdf4', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
                                                                            <div style={{ height: '100%', width: `${share}%`, background: '#15803d', borderRadius: 99 }} />
                                                                        </div>
                                                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d', fontFamily: 'Manrope,sans-serif', minWidth: 36 }}>{share.toFixed(0)}%</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                    <tr style={{ background: '#f0fdf4', borderTop: '2px solid rgba(0,69,13,0.1)' }}>
                                                        <td style={{ padding: '10px 16px' }} colSpan={2}><p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#15803d', fontFamily: 'Manrope,sans-serif', letterSpacing: '0.1em', margin: 0 }}>Week Total</p></td>
                                                        <td style={{ padding: '10px 16px' }}><p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 13, color: '#15803d', margin: 0 }}>{weekTotal.toFixed(1)} kg</p></td>
                                                        <td style={{ padding: '10px 16px' }}><p style={{ fontSize: 13, fontWeight: 700, color: '#15803d', margin: 0 }}>{rows.reduce((s, r) => s + r.intake_count, 0)}</p></td>
                                                        <td style={{ padding: '10px 16px' }}><p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', margin: 0 }}>100%</p></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}