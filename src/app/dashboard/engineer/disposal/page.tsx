'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
    { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
    { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
    { label: 'Complaints', href: '/dashboard/district-engineer/complaints', icon: 'feedback' },
    { label: 'Waste Reports', href: '/dashboard/district-engineer/waste-reports', icon: 'report' },
    { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
    { label: 'Zones', href: '/dashboard/district-engineer/zones', icon: 'map' },
    { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

function statusStyle(status: string) {
    switch (status) {
        case 'pending': return { bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8', label: 'Pending' }
        case 'confirmed': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Confirmed' }
        case 'flagged': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Flagged' }
        case 'rejected': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Rejected' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: status }
    }
}

function wasteCategoryColor(category: string) {
    switch (category) {
        case 'general': return { bg: '#f8fafc', color: '#64748b' }
        case 'organic': return { bg: '#f0fdf4', color: '#00450d' }
        case 'recyclable': return { bg: '#eff6ff', color: '#1d4ed8' }
        case 'hazardous': return { bg: '#fef2f2', color: '#ba1a1a' }
        case 'e_waste': return { bg: '#f5f3ff', color: '#7c3aed' }
        case 'bulk': return { bg: '#fefce8', color: '#92400e' }
        default: return { bg: '#f8fafc', color: '#64748b' }
    }
}

export default function DEDisposalPage() {
    const [profile, setProfile] = useState<any>(null)
    const [records, setRecords] = useState<any[]>([])
    const [discrepancies, setDiscrepancies] = useState<any[]>([])
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'records' | 'discrepancies'>('records')
    const [filterStatus, setFilterStatus] = useState('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Load disposal records filtered by DE's district
        const query = supabase
            .from('disposal_records')
            .select('*')
            .order('created_at', { ascending: false })

        // Filter by district if DE has one assigned
        const { data: recordsData } = p?.district
            ? await query.eq('district', p.district)
            : await query

        if (recordsData && recordsData.length > 0) {
            const driverIds = [...new Set(recordsData.map((r: any) => r.driver_id).filter(Boolean))]
            const contractorIds = [...new Set(recordsData.map((r: any) => r.contractor_id).filter(Boolean))]

            const { data: driverProfiles } = await supabase
                .from('profiles').select('id, full_name').in('id', driverIds)
            const { data: contractorProfiles } = await supabase
                .from('profiles').select('id, full_name, organisation_name').in('id', contractorIds)

            const enriched = recordsData.map((r: any) => ({
                ...r,
                driver: driverProfiles?.find((p: any) => p.id === r.driver_id) || null,
                contractor: contractorProfiles?.find((p: any) => p.id === r.contractor_id) || null,
            }))
            setRecords(enriched)
        } else {
            setRecords([])
        }

        // Load discrepancies
        const { data: discData } = await supabase
            .from('disposal_discrepancies')
            .select('*')
            .order('flagged_at', { ascending: false })

        if (discData && discData.length > 0) {
            const driverIds = [...new Set(discData.map((d: any) => d.driver_id).filter(Boolean))]
            const contractorIds = [...new Set(discData.map((d: any) => d.contractor_id).filter(Boolean))]

            const { data: driverProfiles } = await supabase
                .from('profiles').select('id, full_name').in('id', driverIds)
            const { data: contractorProfiles } = await supabase
                .from('profiles').select('id, full_name, organisation_name').in('id', contractorIds)

            const enriched = discData.map((d: any) => ({
                ...d,
                driver: driverProfiles?.find((p: any) => p.id === d.driver_id) || null,
                contractor: contractorProfiles?.find((p: any) => p.id === d.contractor_id) || null,
            }))
            setDiscrepancies(enriched)
        } else {
            setDiscrepancies([])
        }

        setLoading(false)
    }

    const filteredRecords = filterStatus === 'all'
        ? records : records.filter(r => r.status === filterStatus)

    const stats = {
        total: records.length,
        confirmed: records.filter(r => r.status === 'confirmed').length,
        pending: records.filter(r => r.status === 'pending').length,
        flagged: records.filter(r => r.status === 'flagged').length,
        totalTonnage: records.reduce((s: number, r: any) => s + (r.collected_tonnage || 0), 0),
        openDiscrepancies: discrepancies.filter(d => d.status === 'open').length,
    }

    return (
        <DashboardLayout
            role="District Engineer"
            userName={profile?.full_name || ''}
            navItems={DE_NAV}
            primaryAction={{ label: 'New Schedule', href: '/dashboard/district-engineer/schedules/new', icon: 'add' }}
        >
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .bento-card-green { background:#00450d; border-radius:16px; color:white; overflow:hidden; position:relative; }
        .status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .tab-btn { padding:10px 20px; border-radius:10px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:none; transition:all 0.2s; }
        .tab-active { background:#00450d; color:white; }
        .tab-inactive { background:transparent; color:#717a6d; }
        .tab-inactive:hover { background:#f0fdf4; color:#00450d; }
        .record-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .record-row:hover { background:#f9fafb; }
        .record-row:last-child { border-bottom:none; }
        .filter-btn { padding:6px 14px; border-radius:8px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:1.5px solid transparent; transition:all 0.2s; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1 { animation:staggerIn 0.5s ease 0.05s both; }
        .s2 { animation:staggerIn 0.5s ease 0.10s both; }
        .s3 { animation:staggerIn 0.5s ease 0.15s both; }
        .s4 { animation:staggerIn 0.5s ease 0.20s both; }
      `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="font-headline font-extrabold tracking-tight"
                            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                            Disposal <span style={{ color: '#1b5e20' }}>Records</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            {profile?.district ? `Viewing records for ${profile.district}` : 'All disposal records in your district'}
                        </p>
                    </div>
                    {stats.openDiscrepancies > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                            style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                            <span className="text-sm font-bold" style={{ color: '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}>
                                {stats.openDiscrepancies} open discrepanc{stats.openDiscrepancies > 1 ? 'ies' : 'y'}
                            </span>
                        </div>
                    )}
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6 s2">
                        {[
                            { label: 'Total', value: stats.total, color: '#00450d', bg: '#f0fdf4', icon: 'receipt_long' },
                            { label: 'Confirmed', value: stats.confirmed, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                            { label: 'Pending', value: stats.pending, color: '#0369a1', bg: '#f0f9ff', icon: 'pending' },
                            { label: 'Flagged', value: stats.flagged, color: '#ba1a1a', bg: '#fef2f2', icon: 'flag' },
                            { label: 'Discrepancies', value: stats.openDiscrepancies, color: '#ba1a1a', bg: '#fef2f2', icon: 'warning' },
                            { label: 'Total Tonnage', value: `${stats.totalTonnage.toFixed(1)}T`, color: '#00450d', bg: '#f0fdf4', icon: 'scale' },
                        ].map(s => (
                            <div key={s.label} className="bento-card p-5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                                    style={{ background: s.bg }}>
                                    <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '18px' }}>{s.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-xl" style={{ color: '#181c22' }}>{s.value}</p>
                                <p className="text-xs font-bold uppercase mt-1"
                                    style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-2 mb-4 s3">
                        <button className={`tab-btn ${activeTab === 'records' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('records')}>
                            Records ({records.length})
                        </button>
                        <button className={`tab-btn ${activeTab === 'discrepancies' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('discrepancies')}>
                            Discrepancies ({discrepancies.length})
                            {stats.openDiscrepancies > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                                    style={{ background: activeTab === 'discrepancies' ? 'rgba(255,255,255,0.2)' : '#fef2f2', color: activeTab === 'discrepancies' ? 'white' : '#ba1a1a' }}>
                                    {stats.openDiscrepancies}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Records Tab */}
                    {activeTab === 'records' && (
                        <>
                            <div className="flex items-center gap-2 mb-4 flex-wrap s3">
                                {['all', 'pending', 'confirmed', 'flagged'].map(f => (
                                    <button key={f} className="filter-btn"
                                        onClick={() => setFilterStatus(f)}
                                        style={{ background: filterStatus === f ? '#00450d' : '#f8fafc', color: filterStatus === f ? 'white' : '#64748b', borderColor: 'transparent' }}>
                                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                            </div>
                            <div className="bento-card s4">
                                {filteredRecords.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                            style={{ background: '#f0fdf4' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>delete_sweep</span>
                                        </div>
                                        <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No records found</p>
                                        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Disposal records for your district will appear here</p>
                                    </div>
                                ) : (
                                    filteredRecords.map((record: any) => {
                                        const ss = statusStyle(record.status)
                                        const wc = wasteCategoryColor(record.waste_category)
                                        return (
                                            <div key={record.id} className="record-row" onClick={() => setSelectedRecord(record)}>
                                                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                                    style={{ background: wc.bg }}>
                                                    <span className="material-symbols-outlined" style={{ color: wc.color, fontSize: '22px' }}>
                                                        delete_sweep
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <p className="text-sm font-bold" style={{ color: '#181c22' }}>
                                                            {record.facility_name}
                                                        </p>
                                                        <span className="status-badge" style={{ background: ss.bg, color: ss.color }}>
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ss.dot }} />
                                                            {ss.label}
                                                        </span>
                                                        {record.blockchain_tx && (
                                                            <span className="status-badge" style={{ background: '#f5f3ff', color: '#7c3aed', fontSize: '10px', padding: '2px 8px' }}>
                                                                on-chain
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs" style={{ color: '#717a6d' }}>
                                                        {record.driver?.full_name || 'Unknown'} · {record.contractor?.organisation_name || record.contractor?.full_name || 'Unknown'} · {record.ward || record.district} · {new Date(record.created_at).toLocaleDateString('en-GB')}
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-sm font-bold" style={{ color: '#00450d' }}>{record.collected_tonnage}T</p>
                                                    <p className="text-xs capitalize" style={{ color: '#94a3b8' }}>{record.waste_category}</p>
                                                </div>
                                                <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>chevron_right</span>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </>
                    )}

                    {/* Discrepancies Tab */}
                    {activeTab === 'discrepancies' && (
                        <div className="bento-card s4">
                            {discrepancies.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>check_circle</span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No discrepancies</p>
                                    <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>All disposal records match for your district</p>
                                </div>
                            ) : (
                                discrepancies.map((disc: any) => (
                                    <div key={disc.id} className="record-row">
                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: '#fef2f2' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '22px' }}>flag</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-bold" style={{ color: '#181c22' }}>
                                                    {disc.difference?.toFixed(1)}T discrepancy
                                                </p>
                                                <span className="status-badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>
                                                    {disc.status.replace('_', ' ')}
                                                </span>
                                                <span className="status-badge" style={{ background: '#fef2f2', color: '#ba1a1a', fontSize: '10px', padding: '2px 8px' }}>
                                                    {disc.difference_percentage?.toFixed(0)}% variance
                                                </span>
                                            </div>
                                            <p className="text-xs" style={{ color: '#717a6d' }}>
                                                {disc.driver?.full_name || 'Unknown'} · {disc.contractor?.organisation_name || disc.contractor?.full_name || 'Unknown'} · {new Date(disc.flagged_at).toLocaleDateString('en-GB')}
                                            </p>
                                            {disc.reason && (
                                                <p className="text-xs mt-0.5 truncate" style={{ color: '#94a3b8' }}>{disc.reason}</p>
                                            )}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-xs" style={{ color: '#717a6d' }}>{disc.collected_tonnage}T collected</p>
                                            <p className="text-xs" style={{ color: '#ba1a1a' }}>{disc.disposed_tonnage}T disposed</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Record Detail Modal */}
                    {selectedRecord && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            {selectedRecord.facility_name}
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            {selectedRecord.driver?.full_name} · {selectedRecord.contractor?.organisation_name || selectedRecord.contractor?.full_name}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedRecord(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[
                                        { label: 'Status', value: statusStyle(selectedRecord.status).label },
                                        { label: 'Waste Category', value: selectedRecord.waste_category },
                                        { label: 'Collected', value: `${selectedRecord.collected_tonnage}T` },
                                        { label: 'Disposed', value: `${selectedRecord.disposed_tonnage}T` },
                                        { label: 'Vehicle', value: selectedRecord.vehicle_number || 'N/A' },
                                        { label: 'Ward', value: selectedRecord.ward || 'N/A' },
                                    ].map(item => (
                                        <div key={item.label} className="p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                                            <p className="text-xs font-bold uppercase mb-1"
                                                style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                                {item.label}
                                            </p>
                                            <p className="text-sm font-semibold capitalize" style={{ color: '#181c22' }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                {selectedRecord.blockchain_tx && (
                                    <div className="p-4 rounded-xl mb-6"
                                        style={{ background: '#f5f3ff', border: '1px solid rgba(124,58,237,0.15)' }}>
                                        <p className="text-xs font-bold uppercase mb-1"
                                            style={{ color: '#7c3aed', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                            Blockchain Transaction
                                        </p>
                                        <p className="text-xs font-mono break-all" style={{ color: '#7c3aed' }}>
                                            {selectedRecord.blockchain_tx}
                                        </p>
                                    </div>
                                )}
                                <button className="btn-secondary w-full justify-center" onClick={() => setSelectedRecord(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}