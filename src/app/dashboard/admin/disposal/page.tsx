'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
    { label: 'Home', href: '/dashboard/admin', icon: 'dashboard' },
    { label: 'Users', href: '/dashboard/admin/users', icon: 'manage_accounts' },
    { label: 'Billing', href: '/dashboard/admin/billing', icon: 'payments' },
    { label: 'Billing Rates', href: '/dashboard/admin/billing-rates', icon: 'tune' },
    { label: 'Blockchain', href: '/dashboard/admin/blockchain', icon: 'link' },
    { label: 'Performance', href: '/dashboard/admin/performance', icon: 'analytics' },
    { label: 'Disposal', href: '/dashboard/admin/disposal', icon: 'delete_sweep' },
    { label: 'Reports', href: '/dashboard/admin/reports', icon: 'rate_review' },
    { label: 'Profile', href: '/dashboard/admin/profile', icon: 'person' },
]

const RECORD_STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    pending: { label: 'Pending', color: '#d97706', bg: '#fefce8', dot: '#d97706' },
    confirmed: { label: 'Confirmed', color: '#00450d', bg: '#f0fdf4', dot: '#16a34a' },
    flagged: { label: 'Flagged', color: '#ba1a1a', bg: '#fef2f2', dot: '#ef4444' },
}

function wasteCategoryColor(cat: string) {
    const m: Record<string, { color: string; bg: string }> = {
        organic: { color: '#15803d', bg: '#f0fdf4' },
        recyclable: { color: '#1d4ed8', bg: '#eff6ff' },
        'non-recyclable': { color: '#d97706', bg: '#fefce8' },
        hazardous: { color: '#ba1a1a', bg: '#fef2f2' },
    }
    return m[cat?.toLowerCase()] || { color: '#64748b', bg: '#f1f5f9' }
}

export default function AdminDisposalPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'records' | 'discrepancies' | 'schedules'>('records')
    const [records, setRecords] = useState<any[]>([])
    const [discrepancies, setDiscrepancies] = useState<any[]>([])
    const [schedules, setSchedules] = useState<any[]>([])
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
    const [filterDistrict, setFilterDistrict] = useState('all')
    const [filterStatus, setFilterStatus] = useState('all')
    const [search, setSearch] = useState('')
    const [districts, setDistricts] = useState<string[]>([])

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const [recordsRes, discRes, schedRes] = await Promise.all([
            supabase.from('disposal_records').select('*').order('created_at', { ascending: false }),
            supabase.from('disposal_discrepancies').select('*').order('flagged_at', { ascending: false }),
            supabase.from('disposal_schedules').select('*').order('scheduled_date', { ascending: false }).limit(100),
        ])

        const recs = recordsRes.data || []
        if (recs.length > 0) {
            const driverIds = [...new Set(recs.map((r: any) => r.driver_id).filter(Boolean))]
            const contractorIds = [...new Set(recs.map((r: any) => r.contractor_id).filter(Boolean))]
            const [{ data: dProfiles }, { data: cProfiles }] = await Promise.all([
                supabase.from('profiles').select('id, full_name').in('id', driverIds),
                supabase.from('profiles').select('id, full_name, organisation_name').in('id', contractorIds),
            ])
            const enriched = recs.map((r: any) => ({
                ...r,
                driver: dProfiles?.find((d: any) => d.id === r.driver_id) || null,
                contractor: cProfiles?.find((c: any) => c.id === r.contractor_id) || null,
            }))
            setRecords(enriched)
            const uniqueDistricts = [...new Set(enriched.map((r: any) => r.district).filter(Boolean))] as string[]
            setDistricts(uniqueDistricts)
        } else {
            setRecords([])
        }

        const discs = discRes.data || []
        if (discs.length > 0) {
            const driverIds = [...new Set(discs.map((d: any) => d.driver_id).filter(Boolean))]
            const contractorIds = [...new Set(discs.map((d: any) => d.contractor_id).filter(Boolean))]
            const [{ data: dProfiles }, { data: cProfiles }] = await Promise.all([
                supabase.from('profiles').select('id, full_name').in('id', driverIds),
                supabase.from('profiles').select('id, full_name, organisation_name').in('id', contractorIds),
            ])
            setDiscrepancies(discs.map((d: any) => ({
                ...d,
                driver: dProfiles?.find((p: any) => p.id === d.driver_id) || null,
                contractor: cProfiles?.find((p: any) => p.id === d.contractor_id) || null,
            })))
        } else {
            setDiscrepancies([])
        }

        setSchedules(schedRes.data || [])
        setLoading(false)
    }

    const filteredRecords = records.filter(r => {
        if (filterDistrict !== 'all' && r.district !== filterDistrict) return false
        if (filterStatus !== 'all' && r.status !== filterStatus) return false
        if (search) {
            const q = search.toLowerCase()
            return (
                (r.facility_name || '').toLowerCase().includes(q) ||
                (r.driver?.full_name || '').toLowerCase().includes(q) ||
                (r.contractor?.organisation_name || '').toLowerCase().includes(q) ||
                (r.district || '').toLowerCase().includes(q)
            )
        }
        return true
    })

    const stats = {
        totalRecords: records.length,
        confirmedRecords: records.filter(r => r.status === 'confirmed').length,
        openDiscrepancies: discrepancies.filter(d => d.status === 'open').length,
        totalTonnage: records.reduce((sum, r) => sum + (r.collected_tonnage || 0), 0),
    }

    return (
        <DashboardLayout role="Admin" userName={profile?.full_name || ''} navItems={ADMIN_NAV}>
            <style>{`
        .msym { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msym-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; border:1px solid rgba(0,69,13,0.07); box-shadow:0 1px 3px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.04); overflow:hidden; }
        .tab-btn { padding:9px 18px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px; white-space:nowrap; }
        .tab-btn.on { background:#00450d; color:white; }
        .tab-btn.off { background:transparent; color:#64748b; }
        .tab-btn.off:hover { background:#f1f5f9; }
        .pill-btn { padding:5px 13px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .pill-btn.on { background:#00450d; color:white; }
        .pill-btn.off { background:#f1f5f9; color:#64748b; }
        .pill-btn.off:hover { background:#e2e8f0; }
        .row { padding:15px 20px; border-bottom:1px solid rgba(0,69,13,0.05); display:flex; align-items:flex-start; gap:13px; transition:background 0.15s; }
        .row:hover { background:#f9fdf9; }
        .row:last-child { border-bottom:none; }
        .badge { display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .search-input { width:100%; padding:9px 14px 9px 38px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; color:#181c22; background:#fafafa; outline:none; box-sizing:border-box; transition:all 0.2s; }
        .search-input:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .select-filter { padding:8px 12px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:12px; font-family:'Inter',sans-serif; color:#181c22; background:white; outline:none; cursor:pointer; }
        .select-filter:focus { border-color:#00450d; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .1s both} .a3{animation:fadeUp .4s ease .16s both}
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>Admin · System-wide</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <h1> Waste <span style={{ color: '#1b5e20' }}>Disposal</span></h1>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>
                        🗑️ System Administration
                    </p>
                    <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
                        Waste <span style={{ color: '#00450d' }}>Disposal</span>
                    </h1>
                    {stats.openDiscrepancies > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#ba1a1a', fontFamily: 'Manrope,sans-serif' }}>{stats.openDiscrepancies} open discrepanc{stats.openDiscrepancies > 1 ? 'ies' : 'y'}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'Total Records', value: stats.totalRecords, icon: 'receipt_long', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Confirmed', value: stats.confirmedRecords, icon: 'check_circle', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Discrepancies', value: stats.openDiscrepancies, icon: 'flag', color: '#ba1a1a', bg: '#fef2f2' },
                    { label: 'Total Tonnage', value: `${stats.totalTonnage.toFixed(1)}T`, icon: 'scale', color: '#7c3aed', bg: '#f5f3ff' },
                ].map(m => (
                    <div key={m.label} className="card" style={{ padding: '16px 18px' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                            <span className="msym-fill" style={{ color: m.color, fontSize: 16 }}>{m.icon}</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 26, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="a3" style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 99, marginBottom: 20, width: 'fit-content' }}>
                {([
                    { key: 'records', label: 'Disposal Records', icon: 'receipt_long', count: records.length },
                    { key: 'discrepancies', label: 'Discrepancies', icon: 'warning', count: discrepancies.length },
                    { key: 'schedules', label: 'DE Schedules', icon: 'event', count: schedules.length },
                ] as const).map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                        className={`tab-btn ${activeTab === t.key ? 'on' : 'off'}`}>
                        <span className="msym" style={{ fontSize: 14 }}>{t.icon}</span>
                        {t.label}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: activeTab === t.key ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.07)', color: activeTab === t.key ? 'white' : '#64748b' }}>{t.count}</span>
                    </button>
                ))}
            </div>

            {/* RECORDS TAB */}
            {
                activeTab === 'records' && (
                    <div>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
                                <span className="msym" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#94a3b8' }}>search</span>
                                <input className="search-input" placeholder="Search facility, driver, contractor, district…" value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                            <select className="select-filter" value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
                                <option value="all">All Districts</option>
                                {districts.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <div style={{ display: 'flex', gap: 5 }}>
                                {['all', 'pending', 'confirmed', 'flagged'].map(f => (
                                    <button key={f} onClick={() => setFilterStatus(f)} className={`pill-btn ${filterStatus === f ? 'on' : 'off'}`}>
                                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="card">
                            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>All Disposal Records</h3>
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>{filteredRecords.length} records</span>
                            </div>

                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
                                    <div style={{ width: 24, height: 24, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                                </div>
                            ) : filteredRecords.length === 0 ? (
                                <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                                    <span className="msym-fill" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 10 }}>delete_sweep</span>
                                    <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', marginBottom: 5 }}>No records found</p>
                                    <p style={{ fontSize: 12, color: '#94a3b8' }}>Records appear when drivers dispatch waste to facilities</p>
                                </div>
                            ) : filteredRecords.map((record: any) => {
                                const rs = RECORD_STATUS[record.status] || RECORD_STATUS.pending
                                const wc = wasteCategoryColor(record.waste_category)
                                return (
                                    <div key={record.id} className="row" style={{ cursor: 'pointer' }} onClick={() => setSelectedRecord(record)}>
                                        <div style={{ width: 40, height: 40, borderRadius: 11, background: wc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="msym" style={{ fontSize: 19, color: wc.color }}>delete_sweep</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{record.facility_name}</span>
                                                <span className="badge" style={{ background: rs.bg, color: rs.color }}>
                                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: rs.dot, display: 'inline-block' }} />{rs.label}
                                                </span>
                                                {record.district && <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>{record.district}</span>}
                                                {record.blockchain_tx && <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed' }}>on-chain</span>}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: '#717a6d' }}>
                                                <span>{record.driver?.full_name || 'Unknown driver'}</span>
                                                <span>{record.contractor?.organisation_name || record.contractor?.full_name || '—'}</span>
                                                <span>{new Date(record.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <p style={{ fontSize: 14, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>{record.collected_tonnage}T</p>
                                            <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'capitalize', margin: 0 }}>{record.waste_category}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            }

            {/* DISCREPANCIES TAB */}
            {
                activeTab === 'discrepancies' && (
                    <div className="card">
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>All Discrepancies — System-wide</h3>
                        </div>
                        {discrepancies.length === 0 ? (
                            <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                                <span className="msym-fill" style={{ fontSize: 32, color: '#d1fae5', display: 'block', marginBottom: 10 }}>check_circle</span>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', marginBottom: 5 }}>No discrepancies</p>
                                <p style={{ fontSize: 12, color: '#94a3b8' }}>All disposal records match across all districts</p>
                            </div>
                        ) : discrepancies.map((disc: any) => (
                            <div key={disc.id} className="row">
                                <div style={{ width: 40, height: 40, borderRadius: 11, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span className="msym" style={{ fontSize: 19, color: '#ba1a1a' }}>flag</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{disc.difference?.toFixed(1)}T discrepancy</span>
                                        <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>{disc.status?.replace('_', ' ')}</span>
                                        <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>{disc.difference_percentage?.toFixed(0)}% variance</span>
                                        {disc.district && <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>{disc.district}</span>}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: '#717a6d' }}>
                                        <span>{disc.driver?.full_name || 'Unknown'}</span>
                                        <span>{disc.contractor?.organisation_name || disc.contractor?.full_name || '—'}</span>
                                        <span>{new Date(disc.flagged_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                    {disc.reason && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontStyle: 'italic' }}>{disc.reason}</p>}
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <p style={{ fontSize: 11, color: '#717a6d', margin: '0 0 2px' }}>{disc.collected_tonnage}T collected</p>
                                    <p style={{ fontSize: 11, color: '#ba1a1a', margin: 0 }}>{disc.disposed_tonnage}T disposed</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }

            {/* SCHEDULES TAB */}
            {
                activeTab === 'schedules' && (
                    <div className="card">
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>All DE Disposal Schedules</h3>
                        </div>
                        {schedules.length === 0 ? (
                            <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                                <span className="msym" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 10 }}>event</span>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', marginBottom: 5 }}>No schedules yet</p>
                                <p style={{ fontSize: 12, color: '#94a3b8' }}>District Engineers create disposal schedules from their dashboards</p>
                            </div>
                        ) : schedules.map((s: any) => (
                            <div key={s.id} className="row">
                                <div style={{ width: 40, height: 40, borderRadius: 11, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span className="msym" style={{ fontSize: 19, color: '#00450d' }}>event</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', textTransform: 'capitalize' }}>{s.waste_type}</span>
                                        <span className="badge" style={{ background: s.published ? '#f0fdf4' : '#fefce8', color: s.published ? '#00450d' : '#d97706' }}>
                                            {s.published ? 'Published' : 'Draft'}
                                        </span>
                                        {s.district && <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{s.district}</span>}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: '#717a6d' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msym" style={{ fontSize: 12 }}>business</span>{s.facility_name}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msym" style={{ fontSize: 12 }}>event</span>{new Date(s.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        {s.vehicle_number && <span>{s.vehicle_number}</span>}
                                        {s.estimated_quantity && <span>{s.estimated_quantity}</span>}
                                    </div>
                                </div>
                                <span className="badge" style={{
                                    background: s.status === 'completed' ? '#f0fdf4' : s.status === 'in_transit' ? '#fefce8' : s.status === 'cancelled' ? '#fef2f2' : '#eff6ff',
                                    color: s.status === 'completed' ? '#00450d' : s.status === 'in_transit' ? '#d97706' : s.status === 'cancelled' ? '#ba1a1a' : '#1d4ed8',
                                }}>
                                    {(s.status || 'scheduled').replace('_', ' ')}
                                </span>
                            </div>
                        ))}
                    </div>
                )
            }

            {/* Record detail modal */}
            {
                selectedRecord && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                        onClick={() => setSelectedRecord(null)}>
                        <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}
                            onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                <div>
                                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: '0 0 3px' }}>{selectedRecord.facility_name}</h3>
                                    <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>{selectedRecord.driver?.full_name} · {selectedRecord.contractor?.organisation_name || selectedRecord.contractor?.full_name}</p>
                                </div>
                                <button onClick={() => setSelectedRecord(null)} style={{ width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="msym" style={{ fontSize: 16, color: '#64748b' }}>close</span>
                                </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                                {[
                                    { label: 'Status', value: RECORD_STATUS[selectedRecord.status]?.label || selectedRecord.status },
                                    { label: 'District', value: selectedRecord.district || 'N/A' },
                                    { label: 'Waste Category', value: selectedRecord.waste_category },
                                    { label: 'Collected', value: `${selectedRecord.collected_tonnage}T` },
                                    { label: 'Disposed', value: `${selectedRecord.disposed_tonnage}T` },
                                    { label: 'Vehicle', value: selectedRecord.vehicle_number || 'N/A' },
                                ].map(item => (
                                    <div key={item.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc' }}>
                                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: '0 0 3px' }}>{item.label}</p>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#181c22', textTransform: 'capitalize', margin: 0 }}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                            {selectedRecord.blockchain_tx && (
                                <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f5f3ff', border: '1px solid rgba(124,58,237,0.15)', marginBottom: 12 }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7c3aed', fontFamily: 'Manrope,sans-serif', margin: '0 0 4px' }}>Blockchain TX</p>
                                    <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#7c3aed', wordBreak: 'break-all', margin: 0 }}>{selectedRecord.blockchain_tx}</p>
                                </div>
                            )}
                            <button onClick={() => setSelectedRecord(null)}
                                style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#64748b' }}>
                                Close
                            </button>
                        </div>
                    </div>
                )
            }
        </DashboardLayout >
    )
}