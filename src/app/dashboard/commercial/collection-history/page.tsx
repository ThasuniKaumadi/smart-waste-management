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
]

const WASTE_TYPES = [
    { value: 'organic', label: 'Organic', icon: 'compost', bg: '#f0fdf4', color: '#00450d', border: '#bbf7d0' },
    { value: 'recyclable', label: 'Recyclable', icon: 'recycling', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    { value: 'plastics', label: 'Plastics', icon: 'local_drink', bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' },
    { value: 'glass', label: 'Glass', icon: 'liquor', bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' },
    { value: 'non-recyclable', label: 'Non-Recyclable', icon: 'delete', bg: '#fefce8', color: '#92400e', border: '#fde68a' },
]

function wasteInfo(type: string | null) {
    return WASTE_TYPES.find(w => w.value === type?.toLowerCase()) || {
        value: type || 'general', label: type || 'General',
        icon: 'delete_sweep', bg: '#f8fafc', color: '#475569', border: '#e2e8f0'
    }
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
    })
}

function formatDateTime(dateStr: string | null) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

type CollectionRecord = {
    id: string
    status: string
    completed_at: string | null
    waste_type: string | null
    bin_size: string | null
    bin_quantity: number | null
    bin_count: number | null
    skip_reason: string | null
    road_name: string | null
    address: string | null
    blockchain_tx: string | null
    route_date: string | null
    vehicle_number: string | null
    shift: string | null
}

export default function CommercialCollectionHistoryPage() {
    const [profile, setProfile] = useState<any>(null)
    const [records, setRecords] = useState<CollectionRecord[]>([])
    const [filtered, setFiltered] = useState<CollectionRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [wasteFilter, setWasteFilter] = useState<string>('all')
    const [monthFilter, setMonthFilter] = useState<string>('all')

    useEffect(() => { loadData() }, [])

    useEffect(() => {
        let result = [...records]
        if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter)
        if (wasteFilter !== 'all') result = result.filter(r => r.waste_type === wasteFilter)
        if (monthFilter !== 'all') {
            result = result.filter(r => {
                const date = r.completed_at || r.route_date
                if (!date) return false
                return new Date(date).toISOString().slice(0, 7) === monthFilter
            })
        }
        setFiltered(result)
    }, [records, statusFilter, wasteFilter, monthFilter])

    async function loadData() {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data: p } = await supabase
                .from('profiles').select('*').eq('id', user.id).single()
            setProfile(p)

            const { data, error } = await supabase
                .from('collection_stops')
                .select(`
                    id,
                    status,
                    completed_at,
                    waste_type,
                    bin_size,
                    bin_quantity,
                    bin_count,
                    skip_reason,
                    road_name,
                    address,
                    blockchain_tx,
                    route_id,
                    routes (
                        date,
                        vehicle_number,
                        shift
                    )
                `)
                .eq('commercial_id', user.id)
                .eq('is_commercial', true)
                .order('completed_at', { ascending: false })

            if (error) {
                console.error('Collection history error:', error)
                setLoading(false)
                return
            }

            const mapped: CollectionRecord[] = (data ?? []).map((row: any) => ({
                id: row.id,
                status: row.status,
                completed_at: row.completed_at,
                waste_type: row.waste_type,
                bin_size: row.bin_size,
                bin_quantity: row.bin_quantity,
                bin_count: row.bin_count,
                skip_reason: row.skip_reason,
                road_name: row.road_name,
                address: row.address,
                blockchain_tx: row.blockchain_tx,
                route_date: row.routes?.date ?? null,
                vehicle_number: row.routes?.vehicle_number ?? null,
                shift: row.routes?.shift ?? null,
            }))

            setRecords(mapped)
            setFiltered(mapped)
        } catch (err: any) {
            console.error('Load error:', err)
        } finally {
            setLoading(false)
        }
    }

    // Derive available months from records
    const availableMonths = Array.from(new Set(
        records
            .map(r => {
                const d = r.completed_at || r.route_date
                return d ? new Date(d).toISOString().slice(0, 7) : null
            })
            .filter(Boolean) as string[]
    )).sort((a, b) => b.localeCompare(a))

    // Stats
    const totalCollected = records.filter(r => r.status === 'completed').length
    const totalSkipped = records.filter(r => r.status === 'skipped').length
    const totalBinsCollected = records
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (r.bin_quantity || r.bin_count || 1), 0)
    const complianceRate = records.length > 0
        ? Math.round((totalCollected / records.length) * 100)
        : 100

    // Group by month for display
    const groupedByMonth: Record<string, CollectionRecord[]> = {}
    filtered.forEach(r => {
        const d = r.completed_at || r.route_date
        const key = d
            ? new Date(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
            : 'Unknown date'
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
                    padding: 6px 14px; border-radius: 99px; font-size: 12px;
                    font-weight: 700; font-family: 'Manrope', sans-serif;
                    border: 1.5px solid rgba(0,69,13,0.12); background: white;
                    cursor: pointer; transition: all 0.15s; color: #475569;
                    white-space: nowrap;
                }
                .filter-btn:hover { border-color: #00450d; color: #00450d; }
                .filter-btn.active { background: #00450d; color: white; border-color: #00450d; }
                .filter-select {
                    padding: 6px 12px; border-radius: 99px; font-size: 12px;
                    font-weight: 700; font-family: 'Manrope', sans-serif;
                    border: 1.5px solid rgba(0,69,13,0.12); background: white;
                    cursor: pointer; color: #475569; outline: none;
                    appearance: none; padding-right: 28px;
                }
                .filter-select.active { border-color: #00450d; color: #00450d; }
                .record-row {
                    padding: 16px 24px; display: flex; align-items: center; gap: 14px;
                    border-bottom: 1px solid rgba(0,69,13,0.05); transition: background 0.1s;
                }
                .record-row:hover { background: #fafaf9; }
                .record-row:last-child { border-bottom: none; }
                .month-header {
                    padding: 10px 24px;
                    background: #f9fbf7;
                    border-bottom: 1px solid rgba(0,69,13,0.06);
                    font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
                    text-transform: uppercase; color: #717a6d;
                    font-family: 'Manrope', sans-serif;
                    display: flex; align-items: center; justify-content: space-between;
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
                    Collection History · ClearPath
                </span>
                <h1 className="font-headline font-extrabold tracking-tight"
                    style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Collection <span style={{ color: '#1b5e20' }}>History</span>
                </h1>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 s2">
                        <div className="bento-card-green p-6">
                            <div className="absolute top-0 right-0 w-28 h-28 rounded-full -mr-8 -mt-8"
                                style={{ background: 'rgba(163,246,156,0.06)' }} />
                            <div className="relative z-10">
                                <span className="material-symbols-outlined mb-2 block"
                                    style={{ color: 'rgba(163,246,156,0.7)', fontSize: '24px' }}>check_circle</span>
                                <p className="text-xs font-bold uppercase mb-1"
                                    style={{ letterSpacing: '0.15em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                                    Collected
                                </p>
                                <p className="font-headline font-extrabold" style={{ fontSize: '28px' }}>
                                    {totalCollected}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: 'rgba(163,246,156,0.5)' }}>
                                    {totalBinsCollected} bins total
                                </p>
                            </div>
                        </div>

                        <div className="bento-card p-6">
                            <span className="material-symbols-outlined mb-2 block"
                                style={{ color: totalSkipped > 0 ? '#ba1a1a' : '#94a3b8', fontSize: '24px' }}>cancel</span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.15em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Rejected
                            </p>
                            <p className="font-headline font-extrabold" style={{ fontSize: '28px', color: '#181c22' }}>
                                {totalSkipped}
                            </p>
                            <p className="text-xs mt-0.5 font-semibold"
                                style={{ color: totalSkipped > 0 ? '#ba1a1a' : '#94a3b8' }}>
                                {totalSkipped > 0 ? 'not billed' : 'none this period'}
                            </p>
                        </div>

                        <div className="bento-card p-6">
                            <span className="material-symbols-outlined mb-2 block"
                                style={{ color: '#00450d', fontSize: '24px' }}>verified</span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.15em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Compliance
                            </p>
                            <p className="font-headline font-extrabold" style={{ fontSize: '28px', color: '#181c22' }}>
                                {complianceRate}%
                            </p>
                            <p className="text-xs mt-0.5 font-semibold" style={{ color: '#00450d' }}>
                                collection rate
                            </p>
                        </div>

                        <div className="bento-card p-6">
                            <span className="material-symbols-outlined mb-2 block"
                                style={{ color: '#00450d', fontSize: '24px' }}>receipt_long</span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.15em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Total Records
                            </p>
                            <p className="font-headline font-extrabold" style={{ fontSize: '28px', color: '#181c22' }}>
                                {records.length}
                            </p>
                            <p className="text-xs mt-0.5 font-semibold" style={{ color: '#00450d' }}>
                                all time
                            </p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bento-card mb-6 s2">
                        <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>filter_list</span>
                            <span className="text-xs font-bold uppercase" style={{ letterSpacing: '0.1em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                                Filter
                            </span>

                            {/* Status filter */}
                            <button className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('all')}>All</button>
                            <button className={`filter-btn ${statusFilter === 'completed' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('completed')}>Collected</button>
                            <button className={`filter-btn ${statusFilter === 'skipped' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('skipped')}>Rejected</button>

                            <div style={{ width: '1px', height: '20px', background: 'rgba(0,69,13,0.1)' }} />

                            {/* Waste type filter */}
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <select
                                    className={`filter-select ${wasteFilter !== 'all' ? 'active' : ''}`}
                                    value={wasteFilter}
                                    onChange={e => setWasteFilter(e.target.value)}
                                    style={{ paddingRight: '28px' }}
                                >
                                    <option value="all">All waste types</option>
                                    {WASTE_TYPES.map(w => (
                                        <option key={w.value} value={w.value}>{w.label}</option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined" style={{
                                    position: 'absolute', right: '8px', top: '50%',
                                    transform: 'translateY(-50%)', fontSize: '14px',
                                    color: '#94a3b8', pointerEvents: 'none'
                                }}>expand_more</span>
                            </div>

                            {/* Month filter */}
                            {availableMonths.length > 1 && (
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <select
                                        className={`filter-select ${monthFilter !== 'all' ? 'active' : ''}`}
                                        value={monthFilter}
                                        onChange={e => setMonthFilter(e.target.value)}
                                    >
                                        <option value="all">All months</option>
                                        {availableMonths.map(m => (
                                            <option key={m} value={m}>
                                                {new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined" style={{
                                        position: 'absolute', right: '8px', top: '50%',
                                        transform: 'translateY(-50%)', fontSize: '14px',
                                        color: '#94a3b8', pointerEvents: 'none'
                                    }}>expand_more</span>
                                </div>
                            )}

                            {activeFilters > 0 && (
                                <button
                                    className="filter-btn"
                                    onClick={() => { setStatusFilter('all'); setWasteFilter('all'); setMonthFilter('all') }}
                                    style={{ color: '#ba1a1a', borderColor: '#fecaca' }}
                                >
                                    Clear filters
                                </button>
                            )}

                            <span className="text-xs ml-auto" style={{ color: '#94a3b8' }}>
                                {filtered.length} of {records.length} records
                            </span>
                        </div>
                    </div>

                    {/* Records grouped by month */}
                    <div className="bento-card s3">
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>
                                        history
                                    </span>
                                </div>
                                <p className="font-headline font-bold text-base mb-1" style={{ color: '#181c22' }}>
                                    {records.length === 0 ? 'No collections yet' : 'No records match your filters'}
                                </p>
                                <p className="text-sm" style={{ color: '#94a3b8' }}>
                                    {records.length === 0
                                        ? 'Your collection history will appear here after your first pickup.'
                                        : 'Try adjusting the filters above.'}
                                </p>
                            </div>
                        ) : (
                            Object.entries(groupedByMonth).map(([month, monthRecords]) => (
                                <div key={month}>
                                    <div className="month-header">
                                        <span>{month}</span>
                                        <span style={{ color: '#00450d' }}>
                                            {monthRecords.filter(r => r.status === 'completed').length} collected
                                            {monthRecords.filter(r => r.status === 'skipped').length > 0 &&
                                                ` · ${monthRecords.filter(r => r.status === 'skipped').length} rejected`}
                                        </span>
                                    </div>
                                    {monthRecords.map(record => {
                                        const waste = wasteInfo(record.waste_type)
                                        const isCompleted = record.status === 'completed'
                                        const isSkipped = record.status === 'skipped'
                                        const qty = record.bin_quantity || record.bin_count || 1
                                        return (
                                            <div key={record.id} className="record-row">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                    style={{
                                                        background: isCompleted ? waste.bg : isSkipped ? '#fef2f2' : '#f8fafc',
                                                        border: `1px solid ${isCompleted ? waste.border : isSkipped ? '#fecaca' : '#e2e8f0'}`
                                                    }}>
                                                    <span className="material-symbols-outlined" style={{
                                                        fontSize: '20px',
                                                        color: isCompleted ? waste.color : isSkipped ? '#ba1a1a' : '#94a3b8'
                                                    }}>
                                                        {isCompleted ? waste.icon : isSkipped ? 'cancel' : 'radio_button_unchecked'}
                                                    </span>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-semibold" style={{ color: '#181c22' }}>
                                                            {qty > 1 ? `${qty}× ` : ''}
                                                            {record.bin_size && `${record.bin_size} `}
                                                            {waste.label} collection
                                                        </p>
                                                    </div>
                                                    <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                                                        {record.road_name || record.address || 'Your premises'}
                                                        {record.route_date && ` · ${formatDate(record.route_date)}`}
                                                        {record.completed_at && isCompleted && ` · ${new Date(record.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                                                        {record.vehicle_number && ` · ${record.vehicle_number}`}
                                                        {record.shift && ` · ${record.shift} shift`}
                                                    </p>
                                                    {isSkipped && record.skip_reason && (
                                                        <p className="text-xs mt-1 font-semibold" style={{ color: '#ba1a1a' }}>
                                                            Rejected: {record.skip_reason}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                                                        style={{
                                                            background: isCompleted ? '#f0fdf4' : isSkipped ? '#fef2f2' : '#f8fafc',
                                                            color: isCompleted ? '#00450d' : isSkipped ? '#ba1a1a' : '#94a3b8',
                                                            border: `1px solid ${isCompleted ? '#bbf7d0' : isSkipped ? '#fecaca' : '#e2e8f0'}`,
                                                            fontFamily: 'Manrope, sans-serif'
                                                        }}>
                                                        {isCompleted ? 'Collected' : isSkipped ? 'Rejected' : 'Pending'}
                                                    </span>
                                                    {record.blockchain_tx && (
                                                        <a
                                                            href={`https://amoy.polygonscan.com/tx/${record.blockchain_tx}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-bold px-2 py-1 rounded-full"
                                                            style={{
                                                                background: '#f5f3ff', color: '#7c3aed',
                                                                border: '1px solid #ddd6fe',
                                                                textDecoration: 'none',
                                                                fontFamily: 'Manrope, sans-serif'
                                                            }}
                                                        >
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
                            <div className="px-8 py-4 flex items-center gap-3"
                                style={{ borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff' }}>
                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>verified</span>
                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                    Completed collections verified on Polygon Amoy · Rejected collections are not billed · CMC EcoLedger 2026
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}