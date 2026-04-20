'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const INTAKE_NAV = [
    { label: 'Overview', href: '/dashboard/intake', icon: 'dashboard' },
    { label: 'New Intake', href: '/dashboard/intake/log', icon: 'add_circle' },
    { label: 'History', href: '/dashboard/intake/history', icon: 'history' },
    { label: 'Analytics', href: '/dashboard/intake/analytics', icon: 'bar_chart' },
]

const MATERIAL_COLORS: Record<string, { color: string; bg: string }> = {
    plastic: { color: '#1d4ed8', bg: '#eff6ff' },
    paper: { color: '#d97706', bg: '#fefce8' },
    glass: { color: '#0891b2', bg: '#ecfeff' },
    metal: { color: '#64748b', bg: '#f1f5f9' },
    'e-waste': { color: '#7c3aed', bg: '#f5f3ff' },
    organic: { color: '#15803d', bg: '#f0fdf4' },
    mixed: { color: '#9a3412', bg: '#fff7ed' },
    other: { color: '#94a3b8', bg: '#f8fafc' },
}

function getMaterialStyle(mat: string) {
    return MATERIAL_COLORS[mat?.toLowerCase()] || MATERIAL_COLORS.other
}

interface MonthlyData {
    month: string
    label: string
    totalWeight: number
    totalAmount: number
    intakeCount: number
    rejectionCount: number
}

interface MaterialBreakdown {
    material: string
    totalWeight: number
    totalAmount: number
    count: number
    avgGrade: string
}

export default function RecyclerAnalyticsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [intakes, setIntakes] = useState<any[]>([])
    const [monthly, setMonthly] = useState<MonthlyData[]>([])
    const [materials, setMaterials] = useState<MaterialBreakdown[]>([])
    const [selectedMonth, setSelectedMonth] = useState<string>('all')

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
            .eq('operator_type', 'recycling_partner')
            .order('received_at', { ascending: false })

        const logs = (data || []).filter((l: any) => !l.is_rejected)
        setIntakes(logs)

        // Build monthly data
        const monthMap: Record<string, MonthlyData> = {}
        const allLogs = data || []
        allLogs.forEach((log: any) => {
            const d = new Date(log.received_at || log.created_at)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
            if (!monthMap[key]) {
                monthMap[key] = { month: key, label, totalWeight: 0, totalAmount: 0, intakeCount: 0, rejectionCount: 0 }
            }
            if (log.is_rejected) {
                monthMap[key].rejectionCount++
            } else {
                monthMap[key].totalWeight += log.actual_quantity || 0
                monthMap[key].totalAmount += log.total_amount || 0
                monthMap[key].intakeCount++
            }
        })
        const sortedMonths = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month))
        setMonthly(sortedMonths)

        // Build material breakdown (filtered by month if selected)
        buildMaterials(logs, 'all')
        setLoading(false)
    }

    function buildMaterials(logs: any[], month: string) {
        const filtered = month === 'all' ? logs : logs.filter((l: any) => {
            const d = new Date(l.received_at || l.created_at)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            return key === month
        })

        const matMap: Record<string, MaterialBreakdown> = {}
        filtered.forEach((log: any) => {
            const mat = log.material_type || 'other'
            if (!matMap[mat]) {
                matMap[mat] = { material: mat, totalWeight: 0, totalAmount: 0, count: 0, avgGrade: '' }
            }
            matMap[mat].totalWeight += log.actual_quantity || 0
            matMap[mat].totalAmount += log.total_amount || 0
            matMap[mat].count++
        })
        setMaterials(Object.values(matMap).sort((a, b) => b.totalWeight - a.totalWeight))
    }

    function handleMonthChange(month: string) {
        setSelectedMonth(month)
        const filtered = month === 'all' ? intakes : intakes.filter((l: any) => {
            const d = new Date(l.received_at || l.created_at)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            return key === month
        })
        buildMaterials(filtered, month)
    }

    const currentData = selectedMonth === 'all'
        ? { totalWeight: intakes.reduce((s, l) => s + (l.actual_quantity || 0), 0), totalAmount: intakes.reduce((s, l) => s + (l.total_amount || 0), 0), intakeCount: intakes.length }
        : monthly.find(m => m.month === selectedMonth) || { totalWeight: 0, totalAmount: 0, intakeCount: 0 }

    const totalRejections = (monthly.find(m => m.month === selectedMonth)?.rejectionCount) || (selectedMonth === 'all' ? monthly.reduce((s, m) => s + m.rejectionCount, 0) : 0)
    const maxWeight = Math.max(...monthly.map(m => m.totalWeight), 1)
    const isRecycler = profile?.role === 'recycling_partner'

    return (
        <DashboardLayout
            role={isRecycler ? 'Recycling Partner' : 'Facility Operator'}
            userName={profile?.full_name || ''}
            navItems={INTAKE_NAV}
        >
            <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msf-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:16px; box-shadow:0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.04); border:1px solid rgba(0,69,13,0.06); overflow:hidden; }
        .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; text-transform:capitalize; white-space:nowrap; }
        .select-field { padding:8px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; color:#181c22; background:white; outline:none; cursor:pointer; transition:border 0.2s; }
        .select-field:focus { border-color:#00450d; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .35s ease both} .a2{animation:fadeUp .35s ease .07s both} .a3{animation:fadeUp .35s ease .14s both} .a4{animation:fadeUp .35s ease .21s both}
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 8 }}>
                    Recycling Partner · Analytics
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <h1 style={{ fontSize: 38, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: 0 }}>
                        Material <span style={{ color: '#1b5e20' }}>Analytics</span>
                    </h1>
                    <select className="select-field" value={selectedMonth} onChange={e => handleMonthChange(e.target.value)}>
                        <option value="all">All Time</option>
                        {monthly.map(m => <option key={m.month} value={m.month}>{m.label}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: 26, height: 26, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* Summary stats */}
                    <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                        {[
                            { label: 'Volume Received', value: `${currentData.totalWeight.toFixed(1)} kg`, icon: 'scale', color: '#00450d', bg: '#f0fdf4' },
                            { label: 'Revenue to CMC', value: `LKR ${Math.round(currentData.totalAmount).toLocaleString()}`, icon: 'payments', color: '#7c3aed', bg: '#f5f3ff' },
                            { label: 'Deliveries', value: currentData.intakeCount, icon: 'inventory', color: '#1d4ed8', bg: '#eff6ff' },
                            { label: 'Rejections', value: totalRejections, icon: 'cancel', color: '#ba1a1a', bg: '#fef2f2' },
                        ].map(m => (
                            <div key={m.label} className="card" style={{ padding: '16px 18px' }}>
                                <div style={{ width: 34, height: 34, borderRadius: 9, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                    <span className="msf-fill" style={{ fontSize: 16, color: m.color }}>{m.icon}</span>
                                </div>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 22, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{m.label}</p>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

                        {/* Monthly volume chart */}
                        <div className="a3 card" style={{ padding: '20px 22px' }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: '0 0 16px' }}>Monthly Volume (kg)</h3>
                            {monthly.length === 0 ? (
                                <div style={{ padding: '30px', textAlign: 'center' }}>
                                    <span className="msf" style={{ fontSize: 28, color: '#d1d5db', display: 'block', marginBottom: 8 }}>bar_chart</span>
                                    <p style={{ fontSize: 12, color: '#94a3b8' }}>No data yet</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {monthly.slice(0, 6).map(m => {
                                        const barW = maxWeight > 0 ? Math.round((m.totalWeight / maxWeight) * 100) : 0
                                        const isSelected = selectedMonth === m.month
                                        return (
                                            <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                                                onClick={() => handleMonthChange(isSelected ? 'all' : m.month)}>
                                                <span style={{ fontSize: 11, color: '#64748b', width: 56, flexShrink: 0, fontFamily: 'Manrope,sans-serif', fontWeight: isSelected ? 700 : 400 }}>{m.label}</span>
                                                <div style={{ flex: 1, height: 22, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                                                    <div style={{ height: '100%', width: `${barW}%`, background: isSelected ? '#00450d' : '#a3f69c', borderRadius: 6, transition: 'width 0.4s ease', minWidth: barW > 0 ? 4 : 0 }} />
                                                </div>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#00450d' : '#64748b', fontFamily: 'Manrope,sans-serif', width: 52, textAlign: 'right', flexShrink: 0 }}>
                                                    {m.totalWeight.toFixed(0)}kg
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Monthly revenue chart */}
                        <div className="a3 card" style={{ padding: '20px 22px' }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: '0 0 16px' }}>Monthly Revenue to CMC (LKR)</h3>
                            {monthly.length === 0 ? (
                                <div style={{ padding: '30px', textAlign: 'center' }}>
                                    <span className="msf" style={{ fontSize: 28, color: '#d1d5db', display: 'block', marginBottom: 8 }}>payments</span>
                                    <p style={{ fontSize: 12, color: '#94a3b8' }}>No revenue data yet</p>
                                </div>
                            ) : (() => {
                                const maxAmt = Math.max(...monthly.map(m => m.totalAmount), 1)
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {monthly.slice(0, 6).map(m => {
                                            const barW = maxAmt > 0 ? Math.round((m.totalAmount / maxAmt) * 100) : 0
                                            const isSelected = selectedMonth === m.month
                                            return (
                                                <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                                                    onClick={() => handleMonthChange(isSelected ? 'all' : m.month)}>
                                                    <span style={{ fontSize: 11, color: '#64748b', width: 56, flexShrink: 0, fontFamily: 'Manrope,sans-serif', fontWeight: isSelected ? 700 : 400 }}>{m.label}</span>
                                                    <div style={{ flex: 1, height: 22, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${barW}%`, background: isSelected ? '#7c3aed' : '#c4b5fd', borderRadius: 6, transition: 'width 0.4s ease', minWidth: barW > 0 ? 4 : 0 }} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#7c3aed' : '#64748b', fontFamily: 'Manrope,sans-serif', width: 64, textAlign: 'right', flexShrink: 0 }}>
                                                        {m.totalAmount > 0 ? `${Math.round(m.totalAmount / 1000)}k` : '—'}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })()}
                        </div>
                    </div>

                    {/* Material breakdown */}
                    <div className="a4 card">
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>Material Breakdown</h3>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{selectedMonth === 'all' ? 'All time' : monthly.find(m => m.month === selectedMonth)?.label}</span>
                        </div>

                        {materials.length === 0 ? (
                            <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                                <span className="msf" style={{ fontSize: 36, color: '#d1d5db', display: 'block', marginBottom: 12 }}>recycling</span>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', marginBottom: 4 }}>No material data yet</p>
                                <p style={{ fontSize: 13, color: '#94a3b8' }}>Log intakes with material types to see the breakdown here.</p>
                            </div>
                        ) : (() => {
                            const totalW = materials.reduce((s, m) => s + m.totalWeight, 0)
                            return materials.map(mat => {
                                const style = getMaterialStyle(mat.material)
                                const share = totalW > 0 ? (mat.totalWeight / totalW) * 100 : 0
                                return (
                                    <div key={mat.material} style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="msf" style={{ fontSize: 18, color: style.color }}>recycling</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', textTransform: 'capitalize' }}>{mat.material}</span>
                                                    <span className="badge" style={{ background: style.bg, color: style.color }}>{mat.count} deliveries</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>{mat.totalWeight.toFixed(1)} kg</span>
                                                    {mat.totalAmount > 0 && (
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', fontFamily: 'Manrope,sans-serif' }}>LKR {Math.round(mat.totalAmount).toLocaleString()}</span>
                                                    )}
                                                    <span style={{ fontSize: 11, color: '#94a3b8', width: 36, textAlign: 'right' }}>{share.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${share}%`, background: style.color, borderRadius: 99, transition: 'width 0.5s ease', opacity: 0.7 }} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        })()}

                        {materials.length > 0 && (
                            <div style={{ padding: '12px 18px', background: '#f9fbf9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</span>
                                <div style={{ display: 'flex', gap: 20 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>
                                        {materials.reduce((s, m) => s + m.totalWeight, 0).toFixed(1)} kg
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', fontFamily: 'Manrope,sans-serif' }}>
                                        LKR {Math.round(materials.reduce((s, m) => s + m.totalAmount, 0)).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}