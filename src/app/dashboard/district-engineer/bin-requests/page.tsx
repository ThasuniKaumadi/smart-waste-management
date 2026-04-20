'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { sendNotification } from '@/lib/notify'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
    { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
    { label: 'History', href: '/dashboard/district-engineer/collection-history', icon: 'history' },
    { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
    { label: 'Heatmap', href: '/dashboard/district-engineer/heatmap', icon: 'thermostat' },
    { label: 'Reports', href: '/dashboard/district-engineer/reports', icon: 'report_problem' },
    { label: 'Incidents', href: '/dashboard/district-engineer/incidents', icon: 'warning' },
    { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
    { label: 'Bin Requests', href: '/dashboard/district-engineer/bin-requests', icon: 'delete_outline' },
    { label: 'Compliance', href: '/dashboard/district-engineer/compliance', icon: 'verified' },
    { label: 'Commercial', href: '/dashboard/district-engineer/commercial', icon: 'storefront' },
    { label: 'Announcements', href: '/dashboard/district-engineer/announcements', icon: 'campaign' },
    { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    pending: { color: '#d97706', bg: '#fefce8', label: 'Pending' },
    approved: { color: '#00450d', bg: '#f0fdf4', label: 'Approved' },
    rejected: { color: '#ba1a1a', bg: '#fef2f2', label: 'Rejected' },
}

const REQUEST_TYPE_LABEL: Record<string, string> = {
    new_bin: 'New Bin',
    additional_bin: 'Additional Bin',
    bin_replacement: 'Bin Replacement',
    bin_removal: 'Bin Removal',
    size_change: 'Size Change',
    add: 'Add Bins',
    remove: 'Remove Bins',
    change_size: 'Change Size',
    change_type: 'Change Type',
}

interface BinRequest {
    id: string
    commercial_id: string
    request_type: string
    bin_size: string
    waste_type: string
    quantity: number
    reason: string
    status: string
    created_at: string
    reviewed_at: string | null
    reviewer_notes: string | null
    commercial: {
        full_name: string
        organisation_name: string
        ward: string
        address: string
        waste_profile: any
    }
}

interface BinDiscrepancy {
    commercial_name: string
    commercial_id: string
    ward: string
    registered_bins: number
    collected_bins: number
    difference: number
    stop_id: string
    date: string
}

export default function DEBinRequestsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [requests, setRequests] = useState<BinRequest[]>([])
    const [discrepancies, setDiscrepancies] = useState<BinDiscrepancy[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
    const [activeTab, setActiveTab] = useState<'requests' | 'discrepancies'>('requests')
    const [processing, setProcessing] = useState<string | null>(null)
    const [selectedRequest, setSelectedRequest] = useState<BinRequest | null>(null)
    const [reviewerNotes, setReviewerNotes] = useState('')
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Load bin requests
        const { data } = await supabase
            .from('commercial_bin_requests')
            .select(`
        *,
        commercial:commercial_id (
          full_name, organisation_name, ward, address, waste_profile
        )
      `)
            .order('created_at', { ascending: false })

        setRequests(data || [])

        // R37 — Load bin count discrepancies
        // Get commercial stops where bin_count was logged
        const { data: stops } = await supabase
            .from('collection_stops')
            .select('id, bin_count, is_commercial, route_id, road_name, address, status, completed_at')
            .eq('is_commercial', true)
            .eq('status', 'completed')
            .not('bin_count', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(100)

        if (stops && stops.length > 0) {
            // For each commercial stop, find the commercial profile by address match
            const commercials = await supabase
                .from('profiles')
                .select('id, organisation_name, full_name, ward, address, waste_profile')
                .eq('role', 'commercial_establishment')
                .eq('district', p?.district)

            const discs: BinDiscrepancy[] = []
            for (const stop of stops) {
                if (!stop.bin_count) continue
                // Match stop address to commercial profile
                const matched = (commercials.data || []).find((c: any) =>
                    c.address && (stop.address || stop.road_name || '').toLowerCase().includes(c.address.toLowerCase().slice(0, 15))
                )
                if (!matched?.waste_profile) continue

                // Total registered bins across all categories
                const registeredTotal = Object.values(matched.waste_profile.bin_sizes || {})
                    .reduce((sum: number, count: any) => sum + (parseInt(count) || 0), 0)

                if (registeredTotal > 0 && stop.bin_count !== registeredTotal) {
                    const diff = stop.bin_count - registeredTotal
                    discs.push({
                        commercial_name: matched.organisation_name || matched.full_name,
                        commercial_id: matched.id,
                        ward: matched.ward || '—',
                        registered_bins: registeredTotal,
                        collected_bins: stop.bin_count,
                        difference: diff,
                        stop_id: stop.id,
                        date: stop.completed_at || '',
                    })
                }
            }
            setDiscrepancies(discs)
        }

        setLoading(false)
    }

    async function handleDecision(requestId: string, decision: 'approved' | 'rejected') {
        setProcessing(requestId)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const req = requests.find(r => r.id === requestId)

        const { error } = await supabase
            .from('commercial_bin_requests')
            .update({
                status: decision,
                reviewed_at: new Date().toISOString(),
                reviewed_by: user?.id,
                reviewer_notes: reviewerNotes.trim() || null,
            })
            .eq('id', requestId)

        if (error) {
            setErrorMsg('Failed to update request: ' + error.message)
            setProcessing(null)
            return
        }

        // R19 — Notify the commercial establishment of the decision
        if (req?.commercial_id) {
            const orgName = req.commercial?.organisation_name || req.commercial?.full_name || 'your establishment'
            await sendNotification({
                user_ids: [req.commercial_id],
                title: `Bin Request ${decision === 'approved' ? 'Approved ✓' : 'Rejected'}`,
                body: decision === 'approved'
                    ? `Your bin request (${REQUEST_TYPE_LABEL[req.request_type] || req.request_type} — ${req.quantity}× ${req.bin_size}) has been approved by ${profile?.district} District Engineer.${reviewerNotes ? ' Note: ' + reviewerNotes : ''}`
                    : `Your bin request has been rejected. ${reviewerNotes ? 'Reason: ' + reviewerNotes : 'Please contact your District Engineer for more information.'}`,
                type: 'bin_request_decision',
                url: '/dashboard/commercial/bins',
            })
        }

        setSuccessMsg(`Request ${decision} successfully. Commercial establishment has been notified.`)
        setSelectedRequest(null)
        setReviewerNotes('')
        loadData()
        setTimeout(() => setSuccessMsg(''), 5000)
        setProcessing(null)
    }

    // R37 — flag discrepancy as exception alert
    async function flagDiscrepancy(disc: BinDiscrepancy) {
        const supabase = createClient()
        await supabase.from('exception_alerts').insert({
            type: 'bin_count_mismatch',
            title: 'Bin Count Discrepancy',
            message: `${disc.commercial_name} (${disc.ward}): Driver collected ${disc.collected_bins} bins but ${disc.registered_bins} registered. Difference: ${disc.difference > 0 ? '+' : ''}${disc.difference} bins.`,
            severity: Math.abs(disc.difference) >= 3 ? 'high' : 'medium',
        })
        // Also notify DE
        await sendNotification({
            user_ids: [profile?.id],
            title: 'Bin Count Discrepancy Flagged',
            body: `${disc.commercial_name}: ${disc.collected_bins} collected vs ${disc.registered_bins} registered.`,
            type: 'bin_discrepancy',
            url: '/dashboard/district-engineer/bin-requests',
        })
        setSuccessMsg('Discrepancy flagged as exception alert.')
        setTimeout(() => setSuccessMsg(''), 4000)
    }

    const filtered = requests.filter(r => filterStatus === 'all' || r.status === filterStatus)
    const pendingCount = requests.filter(r => r.status === 'pending').length

    return (
        <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}>
            <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msf-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:16px; box-shadow:0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.04); border:1px solid rgba(0,69,13,0.06); overflow:hidden; }
        .badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.08em; text-transform:uppercase; white-space:nowrap; }
        .filter-btn { padding:6px 14px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .filter-btn.active { background:#00450d; color:white; }
        .filter-btn:not(.active) { background:#f1f5f9; color:#64748b; }
        .req-row { padding:16px 20px; border-bottom:1px solid rgba(0,69,13,0.04); transition:background 0.15s; }
        .req-row:hover { background:#f9fdf9; }
        .req-row:last-child { border-bottom:none; }
        .tab-btn { padding:9px 18px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px; }
        .tab-btn.on { background:#00450d; color:white; }
        .tab-btn.off { background:transparent; color:#64748b; }
        .tab-btn.off:hover { background:#f1f5f9; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:50; display:flex; align-items:center; justify-content:center; padding:20px; }
        .modal { background:white; border-radius:20px; width:100%; max-width:520px; padding:32px; box-shadow:0 24px 64px rgba(0,0,0,0.15); }
        .form-field { width:100%; padding:10px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; font-family:'Inter',sans-serif; background:#fafafa; outline:none; box-sizing:border-box; resize:vertical; }
        .form-field:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .35s ease both} .a2{animation:fadeUp .35s ease .07s both} .a3{animation:fadeUp .35s ease .14s both}
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 8 }}>District Engineering · Commercial Management</p>
                <h1 style={{ fontSize: 40, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: '0 0 4px' }}>
                    Bin <span style={{ color: '#1b5e20' }}>Requests</span>
                </h1>
                <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>{profile?.district} · Review requests and monitor bin count discrepancies</p>
            </div>

            {/* Stats */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Pending Review', value: pendingCount, icon: 'inbox', color: '#d97706', bg: '#fefce8' },
                    { label: 'Approved', value: requests.filter(r => r.status === 'approved').length, icon: 'check_circle', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Rejected', value: requests.filter(r => r.status === 'rejected').length, icon: 'cancel', color: '#ba1a1a', bg: '#fef2f2' },
                    { label: 'Discrepancies', value: discrepancies.length, icon: 'flag', color: '#7c3aed', bg: '#f5f3ff' },
                ].map(m => (
                    <div key={m.label} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="msf-fill" style={{ fontSize: 16, color: m.color }}>{m.icon}</span>
                        </div>
                        <div>
                            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 22, color: '#181c22', margin: 0, lineHeight: 1 }}>{m.value}</p>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{m.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Messages */}
            {successMsg && (
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)', color: '#00450d', fontSize: 13 }}>
                    <span className="msf-fill" style={{ fontSize: 16 }}>check_circle</span>{successMsg}
                </div>
            )}
            {errorMsg && (
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)', color: '#ba1a1a', fontSize: 13 }}>
                    <span className="msf-fill" style={{ fontSize: 16 }}>error</span>{errorMsg}
                </div>
            )}

            {/* Tabs */}
            <div className="a3" style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 99, marginBottom: 16, width: 'fit-content' }}>
                <button className={`tab-btn ${activeTab === 'requests' ? 'on' : 'off'}`} onClick={() => setActiveTab('requests')}>
                    <span className="msf" style={{ fontSize: 14 }}>delete_outline</span>
                    Requests
                    {pendingCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: activeTab === 'requests' ? 'rgba(255,255,255,0.2)' : '#fef2f2', color: activeTab === 'requests' ? 'white' : '#ba1a1a' }}>{pendingCount}</span>}
                </button>
                <button className={`tab-btn ${activeTab === 'discrepancies' ? 'on' : 'off'}`} onClick={() => setActiveTab('discrepancies')}>
                    <span className="msf" style={{ fontSize: 14 }}>flag</span>
                    Bin Discrepancies (R37)
                    {discrepancies.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: activeTab === 'discrepancies' ? 'rgba(255,255,255,0.2)' : '#fef2f2', color: activeTab === 'discrepancies' ? 'white' : '#ba1a1a' }}>{discrepancies.length}</span>}
                </button>
            </div>

            {/* REQUESTS TAB */}
            {activeTab === 'requests' && (
                <div className="card a3">
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>All Requests</h3>
                            {pendingCount > 0 && <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>{pendingCount} need review</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                                <button key={f} onClick={() => setFilterStatus(f)} className={`filter-btn ${filterStatus === f ? 'active' : ''}`}>
                                    {f.charAt(0).toUpperCase() + f.slice(1)}{f !== 'all' && ` (${requests.filter(r => r.status === f).length})`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
                            <div style={{ width: 24, height: 24, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                            <span className="msf" style={{ fontSize: 36, color: '#d1d5db', display: 'block', marginBottom: 10 }}>inbox</span>
                            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', marginBottom: 4 }}>
                                No {filterStatus !== 'all' ? filterStatus : ''} requests
                            </p>
                            <p style={{ fontSize: 12, color: '#94a3b8' }}>{filterStatus === 'pending' ? 'All caught up — no pending bin requests.' : 'No requests match this filter.'}</p>
                        </div>
                    ) : filtered.map(req => {
                        const ss = STATUS_STYLE[req.status] || STATUS_STYLE.pending
                        return (
                            <div key={req.id} className="req-row">
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: ss.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="msf" style={{ fontSize: 18, color: ss.color }}>delete</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>
                                                {req.commercial?.organisation_name || req.commercial?.full_name || 'Unknown'}
                                            </span>
                                            <span className="badge" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                                            <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>{REQUEST_TYPE_LABEL[req.request_type] || req.request_type}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 12 }}>location_on</span>{req.commercial?.ward || '—'} · {req.commercial?.address || '—'}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 12 }}>calendar_today</span>{new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: req.reason ? 6 : 0 }}>
                                            <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>{req.quantity} × {req.bin_size} bins</span>
                                            <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{req.waste_type?.replace(/_/g, ' ')}</span>
                                        </div>
                                        {req.reason && <p style={{ fontSize: 11, color: '#717a6d', fontStyle: 'italic', margin: 0 }}>"{req.reason}"</p>}
                                        {req.reviewer_notes && req.status !== 'pending' && (
                                            <p style={{ fontSize: 11, color: req.status === 'approved' ? '#00450d' : '#ba1a1a', margin: '4px 0 0' }}>Note: {req.reviewer_notes}</p>
                                        )}
                                    </div>
                                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                        {req.status === 'pending' && (
                                            <button
                                                style={{ padding: '7px 16px', borderRadius: 99, border: '1.5px solid rgba(0,69,13,0.2)', background: 'white', color: '#00450d', fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                                                onClick={() => { setSelectedRequest(req); setReviewerNotes('') }}>
                                                <span className="msf" style={{ fontSize: 13 }}>rate_review</span>Review
                                            </button>
                                        )}
                                        {req.reviewed_at && (
                                            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                                                Reviewed {new Date(req.reviewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* DISCREPANCIES TAB — R37 */}
            {activeTab === 'discrepancies' && (
                <div className="card a3">
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: '0 0 3px' }}>Bin Count Discrepancies</h3>
                        <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>Stops where driver's logged bin count differs from registered profile</p>
                    </div>

                    {discrepancies.length === 0 ? (
                        <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                            <span className="msf-fill" style={{ fontSize: 36, color: '#d1fae5', display: 'block', marginBottom: 10 }}>check_circle</span>
                            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', marginBottom: 4 }}>No discrepancies detected</p>
                            <p style={{ fontSize: 12, color: '#94a3b8' }}>Bin counts from drivers match registered profiles. Discrepancies appear when drivers log bin counts that differ from the registered waste profile.</p>
                        </div>
                    ) : discrepancies.map((disc, idx) => {
                        const isOver = disc.difference > 0
                        return (
                            <div key={idx} style={{ padding: '15px 20px', borderBottom: '1px solid rgba(0,69,13,0.05)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span className="msf" style={{ fontSize: 18, color: '#ba1a1a' }}>flag</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{disc.commercial_name}</span>
                                        <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>
                                            {isOver ? '+' : ''}{disc.difference} bins {isOver ? 'over' : 'under'}
                                        </span>
                                        <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>{disc.ward}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#717a6d', marginBottom: 4 }}>
                                        <span>Registered: <strong style={{ color: '#00450d' }}>{disc.registered_bins} bins</strong></span>
                                        <span>Collected: <strong style={{ color: '#ba1a1a' }}>{disc.collected_bins} bins</strong></span>
                                        {disc.date && <span>{new Date(disc.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                                    </div>
                                </div>
                                <button
                                    onClick={() => flagDiscrepancy(disc)}
                                    style={{ padding: '6px 14px', borderRadius: 99, border: '1.5px solid rgba(186,26,26,0.2)', background: '#fef2f2', color: '#ba1a1a', fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span className="msf" style={{ fontSize: 13 }}>flag</span>Flag Alert
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Review Modal */}
            {selectedRequest && (
                <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 18, color: '#181c22', margin: 0 }}>Review Request</h3>
                            <button onClick={() => setSelectedRequest(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <span className="msf" style={{ fontSize: 20 }}>close</span>
                            </button>
                        </div>

                        <div style={{ padding: '14px 16px', borderRadius: 12, background: '#f4f6f3', marginBottom: 20 }}>
                            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: '0 0 4px' }}>
                                {selectedRequest.commercial?.organisation_name || selectedRequest.commercial?.full_name}
                            </p>
                            <p style={{ fontSize: 12, color: '#717a6d', margin: '0 0 10px' }}>
                                {selectedRequest.commercial?.ward} · {selectedRequest.commercial?.address}
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                <span className="badge" style={{ background: 'white', color: '#475569' }}>{REQUEST_TYPE_LABEL[selectedRequest.request_type] || selectedRequest.request_type}</span>
                                <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>{selectedRequest.quantity} × {selectedRequest.bin_size}</span>
                                <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{selectedRequest.waste_type?.replace(/_/g, ' ')}</span>
                            </div>
                            {selectedRequest.reason && (
                                <p style={{ fontSize: 12, color: '#717a6d', fontStyle: 'italic', margin: '10px 0 0' }}>"{selectedRequest.reason}"</p>
                            )}
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: 8 }}>
                                Reviewer Notes <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — sent to establishment)</span>
                            </label>
                            <textarea className="form-field" rows={3}
                                placeholder="Add notes for the commercial establishment…"
                                value={reviewerNotes}
                                onChange={e => setReviewerNotes(e.target.value)} />
                        </div>

                        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', marginBottom: 20, fontSize: 12, color: '#00450d', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="msf" style={{ fontSize: 14 }}>notifications</span>
                            The establishment will be notified via push notification of your decision.
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                disabled={processing === selectedRequest.id}
                                onClick={() => handleDecision(selectedRequest.id, 'approved')}
                                style={{ flex: 1, padding: 13, borderRadius: 12, border: 'none', background: '#00450d', color: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: processing === selectedRequest.id ? 0.6 : 1 }}>
                                <span className="msf" style={{ fontSize: 17 }}>check_circle</span>Approve
                            </button>
                            <button
                                disabled={processing === selectedRequest.id}
                                onClick={() => handleDecision(selectedRequest.id, 'rejected')}
                                style={{ flex: 1, padding: 13, borderRadius: 12, border: '1.5px solid rgba(186,26,26,0.2)', background: '#fef2f2', color: '#ba1a1a', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: processing === selectedRequest.id ? 0.6 : 1 }}>
                                <span className="msf" style={{ fontSize: 17 }}>cancel</span>Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}