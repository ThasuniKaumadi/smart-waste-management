'use client'

import { useState, useEffect } from 'react'
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
    { label: 'Profile', href: '/dashboard/commercial/profile', icon: 'manage_accounts' },
]

const WASTE_TYPES = [
    { value: 'organic', label: 'Organic', icon: 'compost', bg: '#f0fdf4', color: '#00450d', border: '#bbf7d0', bar: '#16a34a' },
    { value: 'recyclable', label: 'Recyclable', icon: 'recycling', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', bar: '#3b82f6' },
    { value: 'plastics', label: 'Plastics', icon: 'local_drink', bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe', bar: '#8b5cf6' },
    { value: 'glass', label: 'Glass', icon: 'liquor', bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc', bar: '#06b6d4' },
    { value: 'non-recyclable', label: 'Non-Recyclable', icon: 'delete', bg: '#fefce8', color: '#92400e', border: '#fde68a', bar: '#f59e0b' },
]

function wi(type: string | null) {
    return WASTE_TYPES.find(w => w.value === type?.toLowerCase()) || {
        value: type || 'general', label: type || 'General',
        icon: 'delete_sweep', bg: '#f8fafc', color: '#475569', border: '#e2e8f0', bar: '#94a3b8'
    }
}

function fd(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

type CR = {
    id: string; status: string; completed_at: string | null; waste_type: string | null
    bin_size: string | null; bin_quantity: number | null; bin_count: number | null
    skip_reason: string | null; road_name: string | null; address: string | null
    blockchain_tx: string | null; route_date: string | null; vehicle_number: string | null; shift: string | null
}

// SVG compliance ring
function ComplianceRing({ rate }: { rate: number }) {
    const r = 52, cx = 64, cy = 64
    const circ = 2 * Math.PI * r
    const dash = (rate / 100) * circ
    const color = rate >= 90 ? '#00450d' : rate >= 70 ? '#d97706' : '#ba1a1a'
    return (
        <svg width="128" height="128" viewBox="0 0 128 128">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0f0" strokeWidth="10" />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
                strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
                strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="900" fill="#181c22" fontFamily="Manrope,sans-serif">{rate}%</text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fill="#94a3b8" fontFamily="Manrope,sans-serif">compliance</text>
        </svg>
    )
}

export default function CommercialCollectionHistoryPage() {
    const [profile, setProfile] = useState<any>(null)
    const [records, setRecords] = useState<CR[]>([])
    const [filtered, setFiltered] = useState<CR[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('all')
    const [wasteFilter, setWasteFilter] = useState('all')
    const [monthFilter, setMonthFilter] = useState('all')

    useEffect(() => { loadData() }, [])

    useEffect(() => {
        let r = [...records]
        if (statusFilter !== 'all') r = r.filter(x => x.status === statusFilter)
        if (wasteFilter !== 'all') r = r.filter(x => x.waste_type === wasteFilter)
        if (monthFilter !== 'all') r = r.filter(x => {
            const d = x.completed_at || x.route_date
            return d ? new Date(d).toISOString().slice(0, 7) === monthFilter : false
        })
        setFiltered(r)
    }, [records, statusFilter, wasteFilter, monthFilter])

    async function loadData() {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }
            const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            setProfile(p)
            const { data } = await supabase.from('collection_stops')
                .select(`id,status,completed_at,waste_type,bin_size,bin_quantity,bin_count,skip_reason,road_name,address,blockchain_tx,route_id,routes(date,vehicle_number,shift)`)
                .eq('commercial_id', user.id).eq('is_commercial', true)
                .order('completed_at', { ascending: false })
            const mapped: CR[] = (data ?? []).map((row: any) => ({
                id: row.id, status: row.status, completed_at: row.completed_at,
                waste_type: row.waste_type, bin_size: row.bin_size, bin_quantity: row.bin_quantity,
                bin_count: row.bin_count, skip_reason: row.skip_reason, road_name: row.road_name,
                address: row.address, blockchain_tx: row.blockchain_tx,
                route_date: row.routes?.date ?? null, vehicle_number: row.routes?.vehicle_number ?? null,
                shift: row.routes?.shift ?? null,
            }))
            setRecords(mapped); setFiltered(mapped)
        } finally { setLoading(false) }
    }

    const totalCollected = records.filter(r => r.status === 'completed').length
    const totalSkipped = records.filter(r => r.status === 'skipped').length
    const totalBins = records.filter(r => r.status === 'completed').reduce((s, r) => s + (r.bin_quantity || r.bin_count || 1), 0)
    const complianceRate = records.length > 0 ? Math.round((totalCollected / records.length) * 100) : 100

    // Waste type breakdown
    const byWasteType = WASTE_TYPES.map(wt => ({
        ...wt,
        count: records.filter(r => r.waste_type === wt.value && r.status === 'completed').length
    })).filter(w => w.count > 0)

    const availableMonths = Array.from(new Set(
        records.map(r => { const d = r.completed_at || r.route_date; return d ? new Date(d).toISOString().slice(0, 7) : null }).filter(Boolean) as string[]
    )).sort((a, b) => b.localeCompare(a))

    const groupedByMonth: Record<string, CR[]> = {}
    filtered.forEach(r => {
        const d = r.completed_at || r.route_date
        const key = d ? new Date(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Unknown'
        if (!groupedByMonth[key]) groupedByMonth[key] = []
        groupedByMonth[key].push(r)
    })

    const activeFilters = [statusFilter, wasteFilter, monthFilter].filter(f => f !== 'all').length

    return (
        <DashboardLayout
            role="Commercial"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={COMMERCIAL_NAV}
            primaryAction={{ label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' }}
        >
            <style>{`
                .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
                .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
                .filter-pill{padding:5px 14px;border-radius:99px;font-size:11px;font-weight:700;font-family:'Manrope',sans-serif;border:1.5px solid rgba(0,69,13,0.12);background:white;cursor:pointer;color:#475569;transition:all 0.15s;white-space:nowrap}
                .filter-pill:hover{border-color:#00450d;color:#00450d}
                .filter-pill.on{background:#00450d;color:white;border-color:#00450d}
                .fsel{padding:5px 28px 5px 12px;border-radius:99px;font-size:11px;font-weight:700;font-family:'Manrope',sans-serif;border:1.5px solid rgba(0,69,13,0.12);background:white;cursor:pointer;color:#475569;outline:none;appearance:none}
                .fsel.on{border-color:#00450d;color:#00450d}
                .rec-row{display:grid;grid-template-columns:40px 1fr auto;gap:12px;align-items:center;padding:11px 20px;border-bottom:1px solid rgba(0,69,13,0.04);transition:background 0.1s;cursor:default}
                .rec-row:hover{background:#fafaf9}
                .rec-row:last-child{border-bottom:none}
                .month-hdr{padding:8px 20px;background:#f9fbf7;border-bottom:1px solid rgba(0,69,13,0.06);font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#717a6d;font-family:'Manrope',sans-serif;display:flex;align-items:center;justify-content:space-between}
                .chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;font-family:'Manrope',sans-serif;border:1px solid transparent;white-space:nowrap}
                @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
                .a1{animation:fadeUp 0.4s ease 0.05s both}
                .a2{animation:fadeUp 0.4s ease 0.1s both}
                .a3{animation:fadeUp 0.4s ease 0.15s both}
            `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Collection History · ClearPath
                </p>
                <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif' }}>
                    Collection <span style={{ color: '#00450d' }}>History</span>
                </h1>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #00450d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* Top row: compliance ring + stats + breakdown */}
                    <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '16px', marginBottom: '20px', alignItems: 'stretch' }}>

                        {/* Compliance ring */}
                        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '180px' }}>
                            <ComplianceRing rate={complianceRate} />
                            <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '8px' }}>
                                Collection rate
                            </p>
                        </div>

                        {/* Stats block */}
                        <div className="card" style={{ padding: '24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
                                Summary
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                {[
                                    { label: 'Collected', value: totalCollected, sub: `${totalBins} bins`, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                                    { label: 'Rejected', value: totalSkipped, sub: 'not billed', color: totalSkipped > 0 ? '#ba1a1a' : '#94a3b8', bg: totalSkipped > 0 ? '#fef2f2' : '#f8fafc', icon: 'cancel' },
                                    { label: 'Total records', value: records.length, sub: 'all time', color: '#1d4ed8', bg: '#eff6ff', icon: 'receipt_long' },
                                    { label: 'This period', value: filtered.length, sub: 'with filters', color: '#7c3aed', bg: '#faf5ff', icon: 'filter_list' },
                                ].map(s => (
                                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="msf" style={{ fontSize: '18px', color: s.color }}>{s.icon}</span>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '20px', fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{s.value}</p>
                                            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{s.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Waste type breakdown */}
                        <div className="card" style={{ padding: '24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
                                By waste type
                            </p>
                            {byWasteType.length === 0 ? (
                                <p style={{ fontSize: '12px', color: '#94a3b8', padding: '8px 0' }}>No data yet</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {byWasteType.map(wt => (
                                        <div key={wt.value}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span className="msf" style={{ fontSize: '13px', color: wt.color }}>{wt.icon}</span>
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#181c22' }}>{wt.label}</span>
                                                </div>
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: wt.color, fontFamily: 'Manrope,sans-serif' }}>{wt.count}</span>
                                            </div>
                                            <div style={{ height: '4px', borderRadius: '99px', background: '#f0f0f0', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', borderRadius: '99px', background: wt.bar, width: `${totalCollected > 0 ? (wt.count / totalCollected) * 100 : 0}%`, transition: 'width 0.8s ease' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Filter bar */}
                    <div className="card a2" style={{ marginBottom: '16px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="msf" style={{ color: '#00450d', fontSize: '16px' }}>filter_list</span>
                        <button className={`filter-pill ${statusFilter === 'all' ? 'on' : ''}`} onClick={() => setStatusFilter('all')}>All</button>
                        <button className={`filter-pill ${statusFilter === 'completed' ? 'on' : ''}`} onClick={() => setStatusFilter('completed')}>Collected</button>
                        <button className={`filter-pill ${statusFilter === 'skipped' ? 'on' : ''}`} onClick={() => setStatusFilter('skipped')}>Rejected</button>
                        <div style={{ width: '1px', height: '16px', background: 'rgba(0,69,13,0.1)' }} />
                        <div style={{ position: 'relative' }}>
                            <select className={`fsel ${wasteFilter !== 'all' ? 'on' : ''}`} value={wasteFilter} onChange={e => setWasteFilter(e.target.value)}>
                                <option value="all">All types</option>
                                {WASTE_TYPES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                            </select>
                            <span className="msf" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94a3b8', pointerEvents: 'none' }}>expand_more</span>
                        </div>
                        {availableMonths.length > 1 && (
                            <div style={{ position: 'relative' }}>
                                <select className={`fsel ${monthFilter !== 'all' ? 'on' : ''}`} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                                    <option value="all">All months</option>
                                    {availableMonths.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>)}
                                </select>
                                <span className="msf" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94a3b8', pointerEvents: 'none' }}>expand_more</span>
                            </div>
                        )}
                        {activeFilters > 0 && (
                            <button className="filter-pill" onClick={() => { setStatusFilter('all'); setWasteFilter('all'); setMonthFilter('all') }}
                                style={{ color: '#ba1a1a', borderColor: '#fecaca' }}>
                                Clear
                            </button>
                        )}
                        <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>{filtered.length} of {records.length}</span>
                    </div>

                    {/* Records table */}
                    <div className="card a3">
                        {/* Table header */}
                        {filtered.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: '12px', padding: '10px 20px', borderBottom: '1px solid rgba(0,69,13,0.08)', background: '#f9fbf7' }}>
                                <div />
                                <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Collection</p>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Status</p>
                            </div>
                        )}

                        {filtered.length === 0 ? (
                            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                                <span className="msf" style={{ fontSize: '40px', color: '#e2e8f0', display: 'block', marginBottom: '12px' }}>history</span>
                                <p style={{ fontSize: '15px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: '6px' }}>
                                    {records.length === 0 ? 'No collections yet' : 'No matches'}
                                </p>
                                <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                                    {records.length === 0 ? 'Your history will appear after your first collection.' : 'Try adjusting the filters.'}
                                </p>
                            </div>
                        ) : (
                            Object.entries(groupedByMonth).map(([month, monthRecs]) => (
                                <div key={month}>
                                    <div className="month-hdr">
                                        <span>{month}</span>
                                        <span style={{ color: '#00450d' }}>
                                            {monthRecs.filter(r => r.status === 'completed').length} collected
                                            {monthRecs.filter(r => r.status === 'skipped').length > 0 && ` · ${monthRecs.filter(r => r.status === 'skipped').length} rejected`}
                                        </span>
                                    </div>
                                    {monthRecs.map(rec => {
                                        const w = wi(rec.waste_type)
                                        const isDone = rec.status === 'completed'
                                        const isSkip = rec.status === 'skipped'
                                        const qty = rec.bin_quantity || rec.bin_count || 1
                                        return (
                                            <div key={rec.id} className="rec-row">
                                                {/* Icon */}
                                                <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: isDone ? w.bg : isSkip ? '#fef2f2' : '#f8fafc', border: `1px solid ${isDone ? w.border : isSkip ? '#fecaca' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span className="msf" style={{ fontSize: '15px', color: isDone ? w.color : isSkip ? '#ba1a1a' : '#94a3b8' }}>
                                                        {isDone ? w.icon : isSkip ? 'cancel' : 'radio_button_unchecked'}
                                                    </span>
                                                </div>

                                                {/* Details */}
                                                <div>
                                                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', marginBottom: '2px' }}>
                                                        {qty > 1 ? `${qty}× ` : ''}{rec.bin_size ? `${rec.bin_size} ` : ''}{w.label} collection
                                                    </p>
                                                    <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                        {rec.road_name || rec.address || 'Your premises'}
                                                        {rec.route_date && ` · ${fd(rec.route_date)}`}
                                                        {rec.completed_at && isDone && ` · ${new Date(rec.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                                                        {rec.vehicle_number && ` · ${rec.vehicle_number}`}
                                                        {rec.shift && ` · ${rec.shift}`}
                                                    </p>
                                                    {isSkip && rec.skip_reason && (
                                                        <p style={{ fontSize: '11px', color: '#ba1a1a', fontWeight: 600, marginTop: '2px' }}>Rejected: {rec.skip_reason}</p>
                                                    )}
                                                </div>

                                                {/* Status + chain */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                                    <span className="chip" style={{ background: isDone ? '#f0fdf4' : isSkip ? '#fef2f2' : '#f8fafc', color: isDone ? '#00450d' : isSkip ? '#ba1a1a' : '#94a3b8', borderColor: isDone ? '#bbf7d0' : isSkip ? '#fecaca' : '#e2e8f0' }}>
                                                        {isDone ? 'Collected' : isSkip ? 'Rejected' : 'Pending'}
                                                    </span>
                                                    {rec.blockchain_tx && (
                                                        <a href={`https://amoy.polygonscan.com/tx/${rec.blockchain_tx}`} target="_blank" rel="noopener noreferrer"
                                                            className="chip" style={{ background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe', textDecoration: 'none' }}>
                                                            Chain ↗
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ))
                        )}

                        {filtered.length > 0 && (
                            <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="msf" style={{ color: '#7c3aed', fontSize: '14px' }}>verified</span>
                                <p style={{ fontSize: '11px', color: '#717a6d' }}>Collections verified on Polygon Amoy · Rejected collections are not billed · CMC EcoLedger 2026</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}