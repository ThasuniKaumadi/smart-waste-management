'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
  { label: 'Overview',      href: '/dashboard/admin',               icon: 'dashboard'       },
  { label: 'Users',         href: '/dashboard/admin/users',         icon: 'manage_accounts' },
  { label: 'Billing',       href: '/dashboard/admin/billing',       icon: 'payments'        },
  { label: 'Billing Rates', href: '/dashboard/admin/billing-rates', icon: 'tune'            },
  { label: 'Blockchain',    href: '/dashboard/admin/blockchain',    icon: 'link'            },
  { label: 'Performance',   href: '/dashboard/admin/performance',   icon: 'analytics'       },
  { label: 'Disposal',      href: '/dashboard/admin/disposal',      icon: 'delete_sweep'    },
  { label: 'Reports',       href: '/dashboard/admin/reports',       icon: 'rate_review'     },
  { label: 'Profile',       href: '/dashboard/admin/profile',       icon: 'person'          },
]

const MATERIAL_COLORS: Record<string, { color: string; bg: string }> = {
    plastic: { color: '#1d4ed8', bg: '#eff6ff' },
    glass: { color: '#0369a1', bg: '#f0f9ff' },
    metal: { color: '#6d28d9', bg: '#f5f3ff' },
    paper: { color: '#d97706', bg: '#fefce8' },
    organic: { color: '#00450d', bg: '#f0fdf4' },
    e_waste: { color: '#7c3aed', bg: '#f5f3ff' },
    recyclable: { color: '#1d4ed8', bg: '#eff6ff' },
    mixed: { color: '#64748b', bg: '#f8fafc' },
}

interface PartnerStats {
    id: string
    name: string
    facility_type: string
    totalDeliveries: number
    totalWeight: number
    totalRevenue: number
    materials: Record<string, number>
    lastDelivery: string | null
    avgGrade: string
}

interface MonthlyTrend {
    month: string
    deliveries: number
    weight: number
    revenue: number
}

export default function RecyclerAnalyticsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [partners, setPartners] = useState<PartnerStats[]>([])
    const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([])
    const [selectedPartner, setSelectedPartner] = useState<string | null>(null)
    const [filterMaterial, setFilterMaterial] = useState('all')

    const totalWeight = partners.reduce((s, p) => s + p.totalWeight, 0)
    const totalRevenue = partners.reduce((s, p) => s + p.totalRevenue, 0)
    const totalDeliveries = partners.reduce((s, p) => s + p.totalDeliveries, 0)

    // Aggregate materials across all partners
    const materialTotals: Record<string, number> = {}
    for (const p of partners) {
        for (const [mat, kg] of Object.entries(p.materials)) {
            materialTotals[mat] = (materialTotals[mat] || 0) + kg
        }
    }
    const topMaterial = Object.entries(materialTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Get recycling partners
        const { data: recyclers } = await supabase
            .from('profiles')
            .select('id, full_name, organisation_name, facility_type')
            .eq('role', 'recycling_partner')

        // Get all intake logs for recyclers
        const { data: logs } = await supabase
            .from('waste_intake_logs')
            .select('*')
            .order('created_at', { ascending: false })

        // Build per-partner stats
        const partnerStats: PartnerStats[] = (recyclers || []).map(r => {
            const partnerLogs = (logs || []).filter(l => l.facility_id === r.id || l.operator_id === r.id)
            const materials: Record<string, number> = {}
            let totalRevenue = 0
            for (const log of partnerLogs) {
                const mat = log.material_type || log.waste_type || 'mixed'
                materials[mat] = (materials[mat] || 0) + (log.weight_kg || 0)
                totalRevenue += log.payment_amount || 0
            }
            const grades = partnerLogs.map(l => l.grade).filter(Boolean)
            const avgGrade = grades.length > 0
                ? (grades.reduce((s: number, g: string) => s + (g === 'A' ? 3 : g === 'B' ? 2 : 1), 0) / grades.length > 2.5 ? 'A' : grades.reduce((s: number, g: string) => s + (g === 'A' ? 3 : g === 'B' ? 2 : 1), 0) / grades.length > 1.5 ? 'B' : 'C')
                : '—'

            return {
                id: r.id,
                name: r.organisation_name || r.full_name,
                facility_type: r.facility_type || 'recycler',
                totalDeliveries: partnerLogs.length,
                totalWeight: partnerLogs.reduce((s, l) => s + (l.weight_kg || 0), 0),
                totalRevenue,
                materials,
                lastDelivery: partnerLogs[0]?.created_at || null,
                avgGrade,
            }
        })
        setPartners(partnerStats.sort((a, b) => b.totalWeight - a.totalWeight))

        // Build monthly trend (last 6 months)
        const now = new Date()
        const trend: MonthlyTrend[] = []
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const monthStr = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
            const monthLogs = (logs || []).filter(l => {
                const ld = new Date(l.created_at)
                return ld.getFullYear() === d.getFullYear() && ld.getMonth() === d.getMonth()
            })
            trend.push({
                month: monthStr,
                deliveries: monthLogs.length,
                weight: monthLogs.reduce((s, l) => s + (l.weight_kg || 0), 0),
                revenue: monthLogs.reduce((s, l) => s + (l.payment_amount || 0), 0),
            })
        }
        setMonthlyTrend(trend)
        setLoading(false)
    }

    const maxWeight = Math.max(...monthlyTrend.map(m => m.weight), 1)
    const displayedPartner = selectedPartner ? partners.find(p => p.id === selectedPartner) : null

    return (
        <DashboardLayout role="Admin" userName={profile?.full_name || ''} navItems={ADMIN_NAV}>
            <style>{`
                .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
                .font-headline { font-family:'Manrope',sans-serif; }
                .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
                .badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.08em; text-transform:uppercase; white-space:nowrap; }
                .partner-card { background:white; border-radius:14px; padding:20px; border:1.5px solid rgba(0,69,13,0.06); cursor:pointer; transition:all 0.2s; }
                .partner-card:hover, .partner-card.selected { box-shadow:0 8px 24px rgba(0,0,0,0.08); border-color:#00450d; }
                .bar-wrap { display:flex; flex-direction:column; align-items:center; gap:6px; flex:1; }
                .bar-col { width:100%; border-radius:6px 6px 0 0; background:#00450d; transition:height 0.5s ease; min-height:2px; }
                @keyframes staggerIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
                .s1{animation:staggerIn 0.5s ease 0.05s both}
                .s2{animation:staggerIn 0.5s ease 0.10s both}
                .s3{animation:staggerIn 0.5s ease 0.15s both}
                .s4{animation:staggerIn 0.5s ease 0.20s both}
            `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif' }}>
                    Administration · Recycling
                </span>
                <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Recycler <span style={{ color: '#1b5e20' }}>Analytics</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: '#717a6d' }}>Volume received · Material grades · Revenue per partner per month</p>
            </section>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
                {[
                    { label: 'Total Partners', value: partners.length, icon: 'recycling', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Total Deliveries', value: totalDeliveries, icon: 'local_shipping', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Total Weight (kg)', value: totalWeight.toLocaleString(), icon: 'scale', color: '#7c3aed', bg: '#f5f3ff' },
                    { label: 'Revenue to CMC', value: `LKR ${totalRevenue.toLocaleString()}`, icon: 'payments', color: '#d97706', bg: '#fefce8' },
                ].map(m => (
                    <div key={m.label} className="bento-card p-5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: m.bg }}>
                            <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '18px' }}>{m.icon}</span>
                        </div>
                        <p className="font-headline font-extrabold text-2xl tracking-tight mb-0.5" style={{ color: '#181c22' }}>{m.value}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {/* Monthly trend chart */}
                    <div className="bento-card mb-6 p-6 s3">
                        <h3 className="font-headline font-bold text-lg mb-6" style={{ color: '#181c22' }}>Monthly Delivery Volume (kg)</h3>
                        {monthlyTrend.every(m => m.weight === 0) ? (
                            <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '2rem 0' }}>No delivery data yet.</p>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px' }}>
                                {monthlyTrend.map(m => (
                                    <div key={m.month} className="bar-wrap">
                                        <div className="bar-col" style={{ height: `${maxWeight > 0 ? Math.max((m.weight / maxWeight) * 130, m.weight > 0 ? 4 : 0) : 0}px`, background: m.weight > 0 ? '#00450d' : '#f1f5f9' }} />
                                        <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textAlign: 'center' }}>{m.month}</p>
                                        <p style={{ fontSize: '10px', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textAlign: 'center' }}>{m.weight > 0 ? `${m.weight}kg` : '—'}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Material totals */}
                    {Object.keys(materialTotals).length > 0 && (
                        <div className="bento-card mb-6 p-6 s3">
                            <h3 className="font-headline font-bold text-lg mb-4" style={{ color: '#181c22' }}>Material Breakdown</h3>
                            <div className="flex flex-wrap gap-3">
                                {Object.entries(materialTotals).sort((a, b) => b[1] - a[1]).map(([mat, kg]) => {
                                    const mc = MATERIAL_COLORS[mat] || { color: '#64748b', bg: '#f8fafc' }
                                    return (
                                        <div key={mat} style={{ padding: '10px 16px', borderRadius: '12px', background: mc.bg, border: `1px solid ${mc.color}20` }}>
                                            <p style={{ fontSize: '11px', fontWeight: 700, color: mc.color, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Manrope,sans-serif' }}>{mat.replace(/_/g, ' ')}</p>
                                            <p style={{ fontSize: '18px', fontWeight: 700, color: mc.color, fontFamily: 'Manrope,sans-serif' }}>{kg.toLocaleString()} kg</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Partner cards */}
                    <h3 className="font-headline font-bold text-lg mb-4 s4" style={{ color: '#181c22' }}>Partner Performance</h3>
                    {partners.length === 0 ? (
                        <div className="bento-card p-12 text-center s4">
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '48px', display: 'block', marginBottom: '12px' }}>recycling</span>
                            <p style={{ color: '#94a3b8', fontSize: '14px' }}>No recycling partners registered yet.</p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-5 s4">
                            {partners.map(partner => (
                                <div
                                    key={partner.id}
                                    className={`partner-card ${selectedPartner === partner.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedPartner(selectedPartner === partner.id ? null : partner.id)}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="font-headline font-bold text-base" style={{ color: '#181c22' }}>{partner.name}</p>
                                            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{partner.facility_type.replace(/_/g, ' ')}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {partner.avgGrade !== '—' && (
                                                <span className="badge" style={{ background: partner.avgGrade === 'A' ? '#f0fdf4' : partner.avgGrade === 'B' ? '#fefce8' : '#fef2f2', color: partner.avgGrade === 'A' ? '#00450d' : partner.avgGrade === 'B' ? '#d97706' : '#ba1a1a' }}>
                                                    Grade {partner.avgGrade}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 mb-3">
                                        {[
                                            { label: 'Deliveries', value: partner.totalDeliveries },
                                            { label: 'Weight (kg)', value: partner.totalWeight.toLocaleString() },
                                            { label: 'Revenue LKR', value: partner.totalRevenue.toLocaleString() },
                                        ].map(item => (
                                            <div key={item.label} style={{ textAlign: 'center', padding: '8px', background: '#f9fdf9', borderRadius: '8px' }}>
                                                <p style={{ fontSize: '16px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{item.value}</p>
                                                <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {partner.lastDelivery && (
                                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                                            Last delivery: {new Date(partner.lastDelivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    )}

                                    {/* Material breakdown — expanded */}
                                    {selectedPartner === partner.id && Object.keys(partner.materials).length > 0 && (
                                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(0,69,13,0.08)' }}>
                                            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: '8px' }}>Materials received</p>
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(partner.materials).map(([mat, kg]) => {
                                                    const mc = MATERIAL_COLORS[mat] || { color: '#64748b', bg: '#f8fafc' }
                                                    return (
                                                        <span key={mat} className="badge" style={{ background: mc.bg, color: mc.color }}>
                                                            {mat.replace(/_/g, ' ')} · {kg}kg
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}