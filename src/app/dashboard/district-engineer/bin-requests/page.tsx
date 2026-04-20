'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

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
    }
}

export default function DEBinRequestsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [requests, setRequests] = useState<BinRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
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

        const { data } = await supabase
            .from('commercial_bin_requests')
            .select(`
                *,
                commercial:commercial_id (
                    full_name, organisation_name, ward, address
                )
            `)
            .order('created_at', { ascending: false })

        setRequests(data || [])
        setLoading(false)
    }

    async function handleDecision(requestId: string, decision: 'approved' | 'rejected') {
        setProcessing(requestId)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

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
        } else {
            setSuccessMsg(`Request ${decision} successfully.`)
            setSelectedRequest(null)
            setReviewerNotes('')
            loadData()
            setTimeout(() => setSuccessMsg(''), 4000)
        }
        setProcessing(null)
    }

    const filtered = requests.filter(r => filterStatus === 'all' || r.status === filterStatus)
    const pendingCount = requests.filter(r => r.status === 'pending').length

    return (
        <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}>
            <style>{`
                .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
                .font-headline { font-family:'Manrope',sans-serif; }
                .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
                .badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.08em; text-transform:uppercase; white-space:nowrap; }
                .filter-btn { padding:6px 14px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
                .filter-btn.active { background:#00450d; color:white; }
                .filter-btn:not(.active) { background:#f1f5f9; color:#64748b; }
                .req-row { padding:18px 24px; border-bottom:1px solid rgba(0,69,13,0.04); transition:background 0.15s; }
                .req-row:hover { background:#f9fdf9; }
                .req-row:last-child { border-bottom:none; }
                .action-btn { padding:7px 16px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.2s; border:1.5px solid; }
                .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:50; display:flex; align-items:center; justify-content:center; padding:20px; }
                .modal { background:white; border-radius:20px; width:100%; max-width:520px; padding:32px; box-shadow:0 24px 64px rgba(0,0,0,0.15); }
                .form-field { width:100%; padding:10px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; font-family:'Inter',sans-serif; background:#fafafa; outline:none; box-sizing:border-box; resize:vertical; }
                .form-field:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
                @keyframes staggerIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
                .s1{animation:staggerIn 0.5s ease 0.05s both}
                .s2{animation:staggerIn 0.5s ease 0.10s both}
                .s3{animation:staggerIn 0.5s ease 0.15s both}
            `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif' }}>
                    District Engineering · Commercial Management
                </span>
                <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Bin <span style={{ color: '#1b5e20' }}>Requests</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                    {profile?.district} · Review and approve commercial bin requests
                </p>
            </section>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
                {[
                    { label: 'Pending Review', value: requests.filter(r => r.status === 'pending').length, color: '#d97706', bg: '#fefce8', icon: 'inbox' },
                    { label: 'Approved', value: requests.filter(r => r.status === 'approved').length, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                    { label: 'Rejected', value: requests.filter(r => r.status === 'rejected').length, color: '#ba1a1a', bg: '#fef2f2', icon: 'cancel' },
                    { label: 'Total Requests', value: requests.length, color: '#1d4ed8', bg: '#eff6ff', icon: 'inventory_2' },
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

            {/* Messages */}
            {successMsg && (
                <div className="mb-6 flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)', color: '#00450d' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                    {successMsg}
                </div>
            )}
            {errorMsg && (
                <div className="mb-6 flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)', color: '#ba1a1a' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                    {errorMsg}
                </div>
            )}

            {/* Request list */}
            <div className="bento-card s3">
                <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                    <div className="flex items-center gap-3">
                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>All Requests</h3>
                        {pendingCount > 0 && (
                            <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>{pendingCount} need review</span>
                        )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                            <button key={f} onClick={() => setFilterStatus(f)}
                                className={`filter-btn ${filterStatus === f ? 'active' : ''}`}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                                {f !== 'all' && ` (${requests.filter(r => r.status === f).length})`}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>inventory_2</span>
                        </div>
                        <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>
                            No {filterStatus !== 'all' ? filterStatus : ''} requests
                        </p>
                        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                            {filterStatus === 'pending' ? 'All caught up — no pending bin requests.' : 'No requests match this filter.'}
                        </p>
                    </div>
                ) : (
                    filtered.map(req => {
                        const ss = STATUS_STYLE[req.status] || STATUS_STYLE.pending
                        return (
                            <div key={req.id} className="req-row">
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ss.bg }}>
                                        <span className="material-symbols-outlined" style={{ color: ss.color, fontSize: '20px' }}>delete</span>
                                    </div>

                                    {/* Main info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <p className="font-headline font-bold text-sm" style={{ color: '#181c22' }}>
                                                {req.commercial?.organisation_name || req.commercial?.full_name || 'Unknown'}
                                            </p>
                                            <span className="badge" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                                            <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                                                {REQUEST_TYPE_LABEL[req.request_type] || req.request_type}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-4 text-xs mb-2" style={{ color: '#94a3b8' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                                {req.commercial?.ward || '—'} · {req.commercial?.address || '—'}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>
                                                {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-2">
                                            <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>
                                                {req.quantity} × {req.bin_size} bins
                                            </span>
                                            <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                                                {req.waste_type?.replace(/_/g, ' ')}
                                            </span>
                                        </div>

                                        {req.reason && (
                                            <p className="text-xs" style={{ color: '#717a6d', fontStyle: 'italic' }}>
                                                "{req.reason}"
                                            </p>
                                        )}

                                        {req.reviewer_notes && req.status !== 'pending' && (
                                            <p className="text-xs mt-1" style={{ color: req.status === 'approved' ? '#00450d' : '#ba1a1a' }}>
                                                Note: {req.reviewer_notes}
                                            </p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {req.status === 'pending' && (
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button
                                                className="action-btn"
                                                style={{ borderColor: 'rgba(0,69,13,0.2)', color: '#00450d', background: 'white' }}
                                                onClick={() => { setSelectedRequest(req); setReviewerNotes('') }}>
                                                Review
                                            </button>
                                        </div>
                                    )}
                                    {req.reviewed_at && (
                                        <p className="text-xs flex-shrink-0" style={{ color: '#94a3b8' }}>
                                            Reviewed {new Date(req.reviewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Review Modal */}
            {selectedRequest && (
                <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Review Request</h3>
                            <button onClick={() => setSelectedRequest(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Summary */}
                        <div className="p-4 rounded-xl mb-5" style={{ background: '#f4f6f3' }}>
                            <p className="font-headline font-bold text-sm mb-1" style={{ color: '#181c22' }}>
                                {selectedRequest.commercial?.organisation_name || selectedRequest.commercial?.full_name}
                            </p>
                            <p className="text-xs mb-2" style={{ color: '#717a6d' }}>
                                {selectedRequest.commercial?.ward} · {selectedRequest.commercial?.address}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <span className="badge" style={{ background: 'white', color: '#475569' }}>
                                    {REQUEST_TYPE_LABEL[selectedRequest.request_type] || selectedRequest.request_type}
                                </span>
                                <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>
                                    {selectedRequest.quantity} × {selectedRequest.bin_size}
                                </span>
                                <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                                    {selectedRequest.waste_type?.replace(/_/g, ' ')}
                                </span>
                            </div>
                            {selectedRequest.reason && (
                                <p className="text-xs mt-3" style={{ color: '#717a6d', fontStyle: 'italic' }}>
                                    Reason: "{selectedRequest.reason}"
                                </p>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="mb-6">
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope,sans-serif', marginBottom: '8px' }}>
                                Reviewer Notes <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                            </label>
                            <textarea
                                className="form-field"
                                rows={3}
                                placeholder="Add notes for the commercial establishment..."
                                value={reviewerNotes}
                                onChange={e => setReviewerNotes(e.target.value)}
                            />
                        </div>

                        {/* Decision buttons */}
                        <div className="flex gap-3">
                            <button
                                disabled={processing === selectedRequest.id}
                                onClick={() => handleDecision(selectedRequest.id, 'approved')}
                                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#00450d', color: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: processing === selectedRequest.id ? 0.6 : 1 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                                Approve
                            </button>
                            <button
                                disabled={processing === selectedRequest.id}
                                onClick={() => handleDecision(selectedRequest.id, 'rejected')}
                                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid rgba(186,26,26,0.2)', background: '#fef2f2', color: '#ba1a1a', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: processing === selectedRequest.id ? 0.6 : 1 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}