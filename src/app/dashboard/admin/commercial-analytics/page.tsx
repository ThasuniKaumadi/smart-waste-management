'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
  { label: 'Overview',             href: '/dashboard/admin',                      icon: 'dashboard',         section: 'Main' },
  { label: 'Users',                href: '/dashboard/admin/users',                icon: 'manage_accounts',   section: 'Management' },
  { label: 'Supervisors',          href: '/dashboard/admin/supervisors',           icon: 'supervisor_account',section: 'Management' },
  { label: 'Zones',                href: '/dashboard/admin/zones',                icon: 'map',               section: 'Management' },
  { label: 'Contracts',            href: '/dashboard/admin/contracts',            icon: 'description',       section: 'Management' },
  { label: 'Billing',              href: '/dashboard/admin/billing',              icon: 'payments',          section: 'Finance' },
  { label: 'Contractor Billing',   href: '/dashboard/admin/billing-contractor',   icon: 'receipt_long',      section: 'Finance' },
  { label: 'Commercial Analytics', href: '/dashboard/admin/commercial-analytics', icon: 'store',             section: 'Finance' },
  { label: 'Recycler Analytics',   href: '/dashboard/admin/recycler-analytics',   icon: 'recycling',         section: 'Finance' },
  { label: 'Blockchain',           href: '/dashboard/admin/blockchain',           icon: 'link',              section: 'Analytics' },
  { label: 'Performance',          href: '/dashboard/admin/performance',          icon: 'analytics',         section: 'Analytics' },
  { label: 'Incidents',            href: '/dashboard/admin/incidents',            icon: 'warning',           section: 'Analytics' },
  { label: 'Disposal',             href: '/dashboard/admin/disposal',             icon: 'delete_sweep',      section: 'Analytics' },
  { label: 'Announcements',        href: '/dashboard/admin/announcements',        icon: 'campaign',          section: 'Communications' },
  { label: 'Communications',       href: '/dashboard/admin/communications',       icon: 'chat',              section: 'Communications' },
]

interface DistrictSummary {
    district: string
    totalEstablishments: number
    totalBins: number
    totalRevenue: number
    outstanding: number
    collectionRate: number
    suspended: number
}

interface EstablishmentRow {
    id: string
    organisation_name: string
    full_name: string
    district: string
    ward: string
    billing_suspended: boolean
    totalInvoiced: number
    totalPaid: number
    outstanding: number
    invoiceCount: number
    lastCollection: string | null
}

export default function CommercialAnalyticsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [districtSummaries, setDistrictSummaries] = useState<DistrictSummary[]>([])
    const [establishments, setEstablishments] = useState<EstablishmentRow[]>([])
    const [filterDistrict, setFilterDistrict] = useState('all')
    const [sortBy, setSortBy] = useState<'revenue' | 'outstanding' | 'name'>('outstanding')
    const [activeTab, setActiveTab] = useState<'overview' | 'establishments'>('overview')

    // Totals
    const totalRevenue = districtSummaries.reduce((s, d) => s + d.totalRevenue, 0)
    const totalOutstanding = districtSummaries.reduce((s, d) => s + d.outstanding, 0)
    const totalEstablishments = districtSummaries.reduce((s, d) => s + d.totalEstablishments, 0)
    const totalSuspended = districtSummaries.reduce((s, d) => s + d.suspended, 0)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Get all commercial establishments
        const { data: commercials } = await supabase
            .from('profiles')
            .select('id, organisation_name, full_name, district, ward, billing_suspended')
            .eq('role', 'commercial_establishment')

        // Get all invoices
        const { data: invoices } = await supabase
            .from('invoices')
            .select('commercial_id, total_amount, status, created_at')

        // Get last collection per commercial from collection_stops
        const { data: stops } = await supabase
            .from('collection_stops')
            .select('commercial_id, updated_at')
            .eq('is_commercial', true)
            .eq('status', 'completed')
            .not('commercial_id', 'is', null)

        const invoiceMap: Record<string, { invoiced: number; paid: number; count: number }> = {}
        for (const inv of invoices || []) {
            if (!inv.commercial_id) continue
            if (!invoiceMap[inv.commercial_id]) invoiceMap[inv.commercial_id] = { invoiced: 0, paid: 0, count: 0 }
            invoiceMap[inv.commercial_id].invoiced += inv.total_amount || 0
            invoiceMap[inv.commercial_id].count += 1
            if (inv.status === 'paid') invoiceMap[inv.commercial_id].paid += inv.total_amount || 0
        }

        const lastCollectionMap: Record<string, string> = {}
        for (const s of stops || []) {
            if (!s.commercial_id) continue
            if (!lastCollectionMap[s.commercial_id] || s.updated_at > lastCollectionMap[s.commercial_id]) {
                lastCollectionMap[s.commercial_id] = s.updated_at
            }
        }

        // Build establishment rows
        const rows: EstablishmentRow[] = (commercials || []).map(c => {
            const inv = invoiceMap[c.id] || { invoiced: 0, paid: 0, count: 0 }
            return {
                id: c.id,
                organisation_name: c.organisation_name,
                full_name: c.full_name,
                district: c.district,
                ward: c.ward,
                billing_suspended: c.billing_suspended,
                totalInvoiced: inv.invoiced,
                totalPaid: inv.paid,
                outstanding: inv.invoiced - inv.paid,
                invoiceCount: inv.count,
                lastCollection: lastCollectionMap[c.id] || null,
            }
        })
        setEstablishments(rows)

        // Build district summaries
        const districts = [...new Set((commercials || []).map(c => c.district).filter(Boolean))]
        const summaries: DistrictSummary[] = districts.map(district => {
            const districtRows = rows.filter(r => r.district === district)
            const totalBins = districtRows.length // placeholder — ideally sum from bin requests
            const totalRevenue = districtRows.reduce((s, r) => s + r.totalPaid, 0)
            const outstanding = districtRows.reduce((s, r) => s + r.outstanding, 0)
            const withCollections = districtRows.filter(r => r.lastCollection !== null).length
            return {
                district,
                totalEstablishments: districtRows.length,
                totalBins,
                totalRevenue,
                outstanding,
                collectionRate: districtRows.length > 0 ? Math.round((withCollections / districtRows.length) * 100) : 0,
                suspended: districtRows.filter(r => r.billing_suspended).length,
            }
        })
        setDistrictSummaries(summaries)
        setLoading(false)
    }

    const filteredEstablishments = establishments
        .filter(e => filterDistrict === 'all' || e.district === filterDistrict)
        .sort((a, b) => {
            if (sortBy === 'revenue') return b.totalPaid - a.totalPaid
            if (sortBy === 'outstanding') return b.outstanding - a.outstanding
            return (a.organisation_name || a.full_name || '').localeCompare(b.organisation_name || b.full_name || '')
        })

    const districts = [...new Set(establishments.map(e => e.district).filter(Boolean))]

    return (
        <DashboardLayout role="Admin" userName={profile?.full_name || ''} navItems={ADMIN_NAV}>
            <style>{`
                .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
                .font-headline { font-family:'Manrope',sans-serif; }
                .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
                .badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.08em; text-transform:uppercase; white-space:nowrap; }
                .tab-btn { padding:8px 18px; border-radius:99px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
                .tab-btn.active { background:#00450d; color:white; }
                .tab-btn:not(.active) { background:#f1f5f9; color:#64748b; }
                .filter-btn { padding:5px 12px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
                .filter-btn.active { background:#00450d; color:white; }
                .filter-btn:not(.active) { background:#f1f5f9; color:#64748b; }
                .est-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); transition:background 0.15s; }
                .est-row:hover { background:#f9fdf9; }
                .est-row:last-child { border-bottom:none; }
                .district-card { background:white; border-radius:16px; padding:20px; border:1.5px solid rgba(0,69,13,0.06); transition:all 0.2s; }
                .district-card:hover { box-shadow:0 8px 24px rgba(0,0,0,0.07); border-color:rgba(0,69,13,0.15); }
                .progress-track { height:6px; background:#f1f5f9; border-radius:99px; overflow:hidden; margin-top:8px; }
                .progress-fill { height:100%; background:#00450d; border-radius:99px; transition:width 0.6s ease; }
                @keyframes staggerIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
                .s1{animation:staggerIn 0.5s ease 0.05s both}
                .s2{animation:staggerIn 0.5s ease 0.10s both}
                .s3{animation:staggerIn 0.5s ease 0.15s both}
            `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif' }}>
                    Administration · Commercial Waste
                </span>
                <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Commercial <span style={{ color: '#1b5e20' }}>Analytics</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: '#717a6d' }}>Registered bins by district · Collection compliance · Revenue vs outstanding</p>
            </section>

            {/* Top KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
                {[
                    { label: 'Total Establishments', value: totalEstablishments, icon: 'store', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Revenue Collected', value: `LKR ${(totalRevenue / 1000).toFixed(0)}k`, icon: 'payments', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Outstanding', value: `LKR ${(totalOutstanding / 1000).toFixed(0)}k`, icon: 'pending_actions', color: '#d97706', bg: '#fefce8' },
                    { label: 'Suspended Accounts', value: totalSuspended, icon: 'block', color: '#ba1a1a', bg: '#fef2f2' },
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

            {/* Tabs */}
            <div className="flex gap-3 mb-6 s3">
                <button onClick={() => setActiveTab('overview')} className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}>
                    District Overview
                </button>
                <button onClick={() => setActiveTab('establishments')} className={`tab-btn ${activeTab === 'establishments' ? 'active' : ''}`}>
                    All Establishments ({establishments.length})
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : activeTab === 'overview' ? (
                <div className="grid md:grid-cols-2 gap-5">
                    {districtSummaries.length === 0 ? (
                        <div className="col-span-2 text-center py-16" style={{ color: '#94a3b8' }}>No commercial data available yet.</div>
                    ) : districtSummaries.map(d => (
                        <div key={d.district} className="district-card">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>{d.district}</h3>
                                <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>{d.totalEstablishments} businesses</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                {[
                                    { label: 'Revenue', value: `LKR ${d.totalRevenue.toLocaleString()}`, color: '#00450d' },
                                    { label: 'Outstanding', value: `LKR ${d.outstanding.toLocaleString()}`, color: d.outstanding > 0 ? '#d97706' : '#94a3b8' },
                                    { label: 'Suspended', value: d.suspended, color: d.suspended > 0 ? '#ba1a1a' : '#94a3b8' },
                                    { label: 'With Collections', value: `${d.collectionRate}%`, color: '#1d4ed8' },
                                ].map(item => (
                                    <div key={item.label}>
                                        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: '2px' }}>{item.label}</p>
                                        <p style={{ fontSize: '16px', fontWeight: 700, color: item.color, fontFamily: 'Manrope,sans-serif' }}>{item.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <div className="flex justify-between mb-1">
                                    <p style={{ fontSize: '11px', color: '#717a6d' }}>Collection compliance</p>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#00450d' }}>{d.collectionRate}%</p>
                                </div>
                                <div className="progress-track">
                                    <div className="progress-fill" style={{ width: `${d.collectionRate}%`, background: d.collectionRate >= 80 ? '#00450d' : d.collectionRate >= 50 ? '#d97706' : '#ba1a1a' }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bento-card">
                    <div className="px-6 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                        <div className="flex gap-2 flex-wrap flex-1">
                            <button onClick={() => setFilterDistrict('all')} className={`filter-btn ${filterDistrict === 'all' ? 'active' : ''}`}>All Districts</button>
                            {districts.map(d => (
                                <button key={d} onClick={() => setFilterDistrict(d)} className={`filter-btn ${filterDistrict === d ? 'active' : ''}`}>{d}</button>
                            ))}
                        </div>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', fontFamily: 'Manrope,sans-serif', background: 'white', color: '#374151', cursor: 'pointer' }}>
                            <option value="outstanding">Sort: Outstanding</option>
                            <option value="revenue">Sort: Revenue</option>
                            <option value="name">Sort: Name</option>
                        </select>
                    </div>

                    {filteredEstablishments.length === 0 ? (
                        <div className="py-12 text-center" style={{ color: '#94a3b8', fontSize: '14px' }}>No establishments found.</div>
                    ) : filteredEstablishments.map(e => (
                        <div key={e.id} className="est-row">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>store</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>
                                            {e.organisation_name || e.full_name}
                                        </p>
                                        {e.billing_suspended && (
                                            <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>Suspended</span>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                                        {e.district} · {e.ward}
                                        {e.lastCollection && ` · Last collection: ${new Date(e.lastCollection).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                                    </p>
                                </div>
                                <div className="flex gap-6 flex-shrink-0 text-right">
                                    <div>
                                        <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Paid</p>
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>LKR {e.totalPaid.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Outstanding</p>
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: e.outstanding > 0 ? '#d97706' : '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>
                                            LKR {e.outstanding.toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Invoices</p>
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#475569', fontFamily: 'Manrope,sans-serif' }}>{e.invoiceCount}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </DashboardLayout>
    )
}