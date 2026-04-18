'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const COMMERCIAL_NAV = [
    { label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' },
    { label: 'Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_month' },
    { label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' },
    { label: 'Complaints', href: '/dashboard/commercial/complaints', icon: 'feedback' },
    { label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' },
    { label: 'Bins', href: '/dashboard/commercial/bins', icon: 'delete' },
    { label: 'Collection History', href: '/dashboard/commercial/collection-history', icon: 'history' },
]

const BIN_SIZES = ['120L', '240L', '660L', '1100L']

const WASTE_TYPES = [
    { value: 'organic', label: 'Organic', icon: 'compost', bg: '#f0fdf4', color: '#00450d', border: '#bbf7d0' },
    { value: 'recyclable', label: 'Recyclable', icon: 'recycling', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    { value: 'plastics', label: 'Plastics', icon: 'local_drink', bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' },
    { value: 'glass', label: 'Glass', icon: 'liquor', bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' },
    { value: 'non-recyclable', label: 'Non-Recyclable', icon: 'delete', bg: '#fefce8', color: '#92400e', border: '#fde68a' },
]

const REQUEST_TYPES = [
    { value: 'add', label: 'Add new bin', icon: 'add_circle', desc: 'Request an additional bin' },
    { value: 'remove', label: 'Remove bin', icon: 'remove_circle', desc: 'Remove an existing bin' },
    { value: 'change_size', label: 'Change bin size', icon: 'straighten', desc: 'Upgrade or downsize a bin' },
    { value: 'change_type', label: 'Change waste type', icon: 'swap_horiz', desc: 'Change what a bin collects' },
]

function wasteInfo(type: string | null) {
    return WASTE_TYPES.find(w => w.value === type?.toLowerCase()) || {
        value: type || 'unknown', label: type || 'Unknown',
        icon: 'delete_sweep', bg: '#f8fafc', color: '#475569', border: '#e2e8f0'
    }
}

function statusStyle(status: string) {
    if (status === 'approved') return { bg: '#f0fdf4', color: '#00450d', border: '#bbf7d0' }
    if (status === 'rejected') return { bg: '#fef2f2', color: '#ba1a1a', border: '#fecaca' }
    return { bg: '#fefce8', color: '#92400e', border: '#fde68a' }
}

function statusLabel(status: string) {
    if (status === 'approved') return 'Approved'
    if (status === 'rejected') return 'Rejected'
    return 'Pending review'
}

export default function CommercialBinsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [bins, setBins] = useState<any[]>([])
    const [requests, setRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitSuccess, setSubmitSuccess] = useState(false)

    // Form state
    const [reqType, setReqType] = useState('add')
    const [wasteType, setWasteType] = useState('organic')
    const [binSize, setBinSize] = useState('240L')
    const [quantity, setQuantity] = useState(1)
    const [currentBinSize, setCurrentBinSize] = useState('240L')
    const [currentWasteType, setCurrentWasteType] = useState('organic')
    const [notes, setNotes] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data: p } = await supabase
                .from('profiles').select('*').eq('id', user.id).single()
            setProfile(p)

            const [binsRes, requestsRes] = await Promise.all([
                supabase
                    .from('collection_stops')
                    .select('*')
                    .eq('commercial_id', user.id)
                    .eq('is_commercial', true)
                    .order('created_at', { ascending: true }),
                supabase
                    .from('commercial_bin_requests')
                    .select('*')
                    .eq('commercial_id', user.id)
                    .order('created_at', { ascending: false }),
            ])

            if (binsRes.error) console.error('Bins fetch error:', binsRes.error)
            if (requestsRes.error) console.error('Requests fetch error:', requestsRes.error)

            setBins(binsRes.data ?? [])
            setRequests(requestsRes.data ?? [])
        } catch (err: any) {
            console.error('Load error:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit() {
        if (!profile) return
        setSubmitting(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const payload: any = {
                commercial_id: user.id,
                request_type: reqType,
                notes: notes || null,
                status: 'pending',
            }

            if (reqType === 'add') {
                payload.waste_type = wasteType
                payload.bin_size = binSize
                payload.quantity = quantity
            } else if (reqType === 'remove') {
                payload.current_waste_type = currentWasteType
                payload.current_bin_size = currentBinSize
                payload.quantity = quantity
            } else if (reqType === 'change_size') {
                payload.current_waste_type = currentWasteType
                payload.current_bin_size = currentBinSize
                payload.bin_size = binSize
            } else if (reqType === 'change_type') {
                payload.current_waste_type = currentWasteType
                payload.current_bin_size = currentBinSize
                payload.waste_type = wasteType
            }

            const { error } = await supabase
                .from('commercial_bin_requests')
                .insert(payload)

            if (error) throw error

            setSubmitSuccess(true)
            setShowForm(false)
            setNotes('')
            setQuantity(1)
            await loadData()

            setTimeout(() => setSubmitSuccess(false), 4000)
        } catch (err: any) {
            console.error('Submit error:', err)
            alert('Failed to submit request: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const pendingRequests = requests.filter(r => r.status === 'pending')
    const totalBins = bins.reduce((sum, b) => sum + (b.bin_quantity || b.bin_count || 1), 0)
    const wasteTypeCount = new Set(bins.map(b => b.waste_type).filter(Boolean)).size

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
                .req-type-btn {
                    border: 1.5px solid rgba(0,69,13,0.1); border-radius: 12px;
                    padding: 12px 14px; cursor: pointer; transition: all 0.15s;
                    background: white; text-align: left; width: 100%;
                }
                .req-type-btn:hover { border-color: #00450d; background: #f0fdf4; }
                .req-type-btn.active { border-color: #00450d; background: #f0fdf4; }
                .size-btn {
                    border: 1.5px solid rgba(0,69,13,0.1); border-radius: 10px;
                    padding: 8px 16px; cursor: pointer; transition: all 0.15s;
                    background: white; font-family: 'Manrope', sans-serif;
                    font-weight: 700; font-size: 13px; color: #475569;
                }
                .size-btn:hover { border-color: #00450d; color: #00450d; }
                .size-btn.active { border-color: #00450d; background: #00450d; color: white; }
                .waste-btn {
                    border: 1.5px solid rgba(0,69,13,0.1); border-radius: 10px;
                    padding: 10px 12px; cursor: pointer; transition: all 0.15s;
                    background: white; display: flex; align-items: center; gap: 8px;
                    font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 12px;
                }
                .waste-btn.active { border-width: 2px; }
                .submit-btn {
                    background: #00450d; color: white; border: none;
                    border-radius: 99px; padding: 12px 28px;
                    font-family: 'Manrope', sans-serif; font-weight: 700;
                    font-size: 14px; cursor: pointer; transition: all 0.2s;
                    display: flex; align-items: center; gap: 8px;
                }
                .submit-btn:hover { background: #1b5e20; transform: translateY(-1px); }
                .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                .cancel-btn {
                    background: transparent; color: #475569; border: 1.5px solid #e2e8f0;
                    border-radius: 99px; padding: 12px 28px;
                    font-family: 'Manrope', sans-serif; font-weight: 700;
                    font-size: 14px; cursor: pointer; transition: all 0.2s;
                }
                .cancel-btn:hover { border-color: #94a3b8; }
                .bin-row {
                    padding: 18px 24px; display: flex; align-items: center; gap: 16px;
                    border-bottom: 1px solid rgba(0,69,13,0.05);
                }
                .bin-row:last-child { border-bottom: none; }
                .request-row {
                    padding: 16px 24px; display: flex; align-items: flex-start; gap: 14px;
                    border-bottom: 1px solid rgba(0,69,13,0.05);
                }
                .request-row:last-child { border-bottom: none; }
                .field-label {
                    font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
                    text-transform: uppercase; color: #717a6d;
                    font-family: 'Manrope', sans-serif; display: block; margin-bottom: 8px;
                }
                textarea.notes-field {
                    width: 100%; border: 1.5px solid rgba(0,69,13,0.15); border-radius: 10px;
                    padding: 12px 14px; font-size: 13px; color: #181c22;
                    font-family: inherit; resize: vertical; min-height: 80px;
                    outline: none; transition: border-color 0.15s;
                }
                textarea.notes-field:focus { border-color: #00450d; }
                @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
                .s1 { animation: staggerIn 0.5s ease 0.05s both; }
                .s2 { animation: staggerIn 0.5s ease 0.1s both; }
                .s3 { animation: staggerIn 0.5s ease 0.15s both; }
                .s4 { animation: staggerIn 0.5s ease 0.2s both; }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
                .slide-down { animation: slideDown 0.25s ease-out; }
            `}</style>

            {/* Header */}
            <section className="mb-8 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    Bin Management · ClearPath
                </span>
                <div className="flex items-end justify-between gap-4 flex-wrap">
                    <h1 className="font-headline font-extrabold tracking-tight"
                        style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                        Your <span style={{ color: '#1b5e20' }}>Bins</span>
                    </h1>
                    <button
                        onClick={() => { setShowForm(!showForm); setSubmitSuccess(false) }}
                        className="submit-btn"
                        style={{ fontSize: '13px', padding: '10px 22px', marginBottom: '6px' }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                            {showForm ? 'close' : 'add'}
                        </span>
                        {showForm ? 'Cancel' : 'Request change'}
                    </button>
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {/* Success banner */}
                    {submitSuccess && (
                        <div className="rounded-2xl p-5 mb-6 flex items-center gap-4 slide-down"
                            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '22px' }}>check_circle</span>
                            <p className="text-sm font-semibold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                Request submitted successfully. Your District Engineer will review it shortly.
                            </p>
                        </div>
                    )}

                    {/* Pending requests notice */}
                    {pendingRequests.length > 0 && (
                        <div className="rounded-2xl p-5 mb-6 flex items-start gap-4 s1"
                            style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                            <span className="material-symbols-outlined mt-0.5" style={{ color: '#d97706', fontSize: '22px' }}>pending</span>
                            <div>
                                <p className="font-bold text-sm mb-1" style={{ color: '#92400e', fontFamily: 'Manrope, sans-serif' }}>
                                    {pendingRequests.length} request{pendingRequests.length > 1 ? 's' : ''} under review
                                </p>
                                <p className="text-sm" style={{ color: '#92400e' }}>
                                    Your District Engineer is reviewing your bin change request{pendingRequests.length > 1 ? 's' : ''}. You will be notified once approved.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 s2">
                        <div className="bento-card-green p-6">
                            <div className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-10 -mt-10"
                                style={{ background: 'rgba(163,246,156,0.06)' }} />
                            <div className="relative z-10">
                                <span className="material-symbols-outlined mb-3 block"
                                    style={{ color: 'rgba(163,246,156,0.7)', fontSize: '26px' }}>delete</span>
                                <p className="text-xs font-bold uppercase mb-1"
                                    style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                                    Total Bins
                                </p>
                                <p className="font-headline font-extrabold tracking-tight" style={{ fontSize: '32px' }}>
                                    {totalBins}
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'rgba(163,246,156,0.5)' }}>
                                    registered at your premises
                                </p>
                            </div>
                        </div>

                        <div className="bento-card p-6">
                            <span className="material-symbols-outlined mb-3 block"
                                style={{ color: '#00450d', fontSize: '26px' }}>category</span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Waste Types
                            </p>
                            <p className="font-headline font-extrabold tracking-tight" style={{ fontSize: '32px', color: '#181c22' }}>
                                {wasteTypeCount || bins.length}
                            </p>
                            <p className="text-xs mt-1 font-semibold" style={{ color: '#00450d' }}>
                                categories segregated
                            </p>
                        </div>

                        <div className="bento-card p-6">
                            <span className="material-symbols-outlined mb-3 block"
                                style={{ color: pendingRequests.length > 0 ? '#d97706' : '#00450d', fontSize: '26px' }}>
                                {pendingRequests.length > 0 ? 'pending' : 'task_alt'}
                            </span>
                            <p className="text-xs font-bold uppercase mb-1"
                                style={{ letterSpacing: '0.2em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                Pending Requests
                            </p>
                            <p className="font-headline font-extrabold tracking-tight" style={{ fontSize: '32px', color: '#181c22' }}>
                                {pendingRequests.length}
                            </p>
                            <p className="text-xs mt-1 font-semibold"
                                style={{ color: pendingRequests.length > 0 ? '#d97706' : '#00450d' }}>
                                {pendingRequests.length > 0 ? 'awaiting DE approval' : 'all up to date'}
                            </p>
                        </div>
                    </div>

                    {/* Request form */}
                    {showForm && (
                        <div className="bento-card mb-6 slide-down">
                            <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                    New Bin Request
                                </h3>
                                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                                    Requests are reviewed by your District Engineer and typically processed within 2 working days.
                                </p>
                            </div>

                            <div className="p-8 flex flex-col gap-7">
                                {/* Request type */}
                                <div>
                                    <span className="field-label">Request type</span>
                                    <div className="grid grid-cols-2 gap-3">
                                        {REQUEST_TYPES.map(rt => (
                                            <button
                                                key={rt.value}
                                                className={`req-type-btn ${reqType === rt.value ? 'active' : ''}`}
                                                onClick={() => setReqType(rt.value)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="material-symbols-outlined"
                                                        style={{ fontSize: '20px', color: reqType === rt.value ? '#00450d' : '#94a3b8' }}>
                                                        {rt.icon}
                                                    </span>
                                                    <div>
                                                        <p className="text-sm font-bold" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                            {rt.label}
                                                        </p>
                                                        <p className="text-xs" style={{ color: '#94a3b8' }}>{rt.desc}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Current bin — for remove/change */}
                                {(reqType === 'remove' || reqType === 'change_size' || reqType === 'change_type') && (
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <span className="field-label">Current waste type</span>
                                            <div className="flex flex-wrap gap-2">
                                                {WASTE_TYPES.map(wt => (
                                                    <button
                                                        key={wt.value}
                                                        className={`waste-btn ${currentWasteType === wt.value ? 'active' : ''}`}
                                                        style={currentWasteType === wt.value
                                                            ? { background: wt.bg, color: wt.color, borderColor: wt.color }
                                                            : {}}
                                                        onClick={() => setCurrentWasteType(wt.value)}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{wt.icon}</span>
                                                        {wt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="field-label">Current bin size</span>
                                            <div className="flex gap-2 flex-wrap">
                                                {BIN_SIZES.map(s => (
                                                    <button key={s} className={`size-btn ${currentBinSize === s ? 'active' : ''}`}
                                                        onClick={() => setCurrentBinSize(s)}>{s}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* New waste type — for add/change_type */}
                                {(reqType === 'add' || reqType === 'change_type') && (
                                    <div>
                                        <span className="field-label">
                                            {reqType === 'change_type' ? 'New waste type' : 'Waste type'}
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {WASTE_TYPES.map(wt => (
                                                <button
                                                    key={wt.value}
                                                    className={`waste-btn ${wasteType === wt.value ? 'active' : ''}`}
                                                    style={wasteType === wt.value
                                                        ? { background: wt.bg, color: wt.color, borderColor: wt.color }
                                                        : {}}
                                                    onClick={() => setWasteType(wt.value)}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{wt.icon}</span>
                                                    {wt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Bin size — for add/change_size */}
                                {(reqType === 'add' || reqType === 'change_size') && (
                                    <div>
                                        <span className="field-label">
                                            {reqType === 'change_size' ? 'New bin size' : 'Bin size'}
                                        </span>
                                        <div className="flex gap-2 flex-wrap">
                                            {BIN_SIZES.map(s => (
                                                <button key={s} className={`size-btn ${binSize === s ? 'active' : ''}`}
                                                    onClick={() => setBinSize(s)}>{s}</button>
                                            ))}
                                        </div>
                                        <p className="text-xs mt-2" style={{ color: '#94a3b8' }}>
                                            120L — small café · 240L — restaurant · 660L — hotel · 1100L — supermarket/large commercial
                                        </p>
                                    </div>
                                )}

                                {/* Quantity — for add/remove */}
                                {(reqType === 'add' || reqType === 'remove') && (
                                    <div>
                                        <span className="field-label">Quantity</span>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                                style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1.5px solid rgba(0,69,13,0.15)', background: 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00450d', fontWeight: 700 }}>
                                                −
                                            </button>
                                            <span className="font-headline font-bold text-xl" style={{ color: '#181c22', minWidth: '32px', textAlign: 'center' }}>
                                                {quantity}
                                            </span>
                                            <button
                                                onClick={() => setQuantity(q => Math.min(10, q + 1))}
                                                style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1.5px solid rgba(0,69,13,0.15)', background: 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00450d', fontWeight: 700 }}>
                                                +
                                            </button>
                                            <span className="text-sm" style={{ color: '#94a3b8' }}>bin{quantity > 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Notes */}
                                <div>
                                    <span className="field-label">Additional notes (optional)</span>
                                    <textarea
                                        className="notes-field"
                                        placeholder="Any additional context for your District Engineer..."
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                    />
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3">
                                    <button
                                        className="submit-btn"
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            <>
                                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
                                                Submit request
                                            </>
                                        )}
                                    </button>
                                    <button className="cancel-btn" onClick={() => setShowForm(false)}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Current bins */}
                    <div className="bento-card mb-6 s3">
                        <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                Registered Bins
                            </h3>
                            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                                Active bins at your premises managed by CMC
                            </p>
                        </div>

                        {bins.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '28px' }}>
                                        delete_outline
                                    </span>
                                </div>
                                <p className="font-headline font-bold text-base mb-1" style={{ color: '#181c22' }}>
                                    No bins registered yet
                                </p>
                                <p className="text-sm" style={{ color: '#94a3b8' }}>
                                    Your bins will appear here once your District Engineer has approved your account setup.
                                </p>
                            </div>
                        ) : (
                            <div>
                                {bins.map((bin, i) => {
                                    const waste = wasteInfo(bin.waste_type)
                                    const qty = bin.bin_quantity || bin.bin_count || 1
                                    const isCompleted = bin.status === 'completed'
                                    return (
                                        <div key={bin.id} className="bin-row">
                                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: waste.bg, border: `1px solid ${waste.border}` }}>
                                                <span className="material-symbols-outlined"
                                                    style={{ color: waste.color, fontSize: '22px' }}>{waste.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22' }}>
                                                        {qty}× {bin.bin_size || 'Standard'} {waste.label} bin
                                                    </p>
                                                </div>
                                                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                                                    {bin.road_name || bin.address || 'Your premises'}
                                                    {bin.frequency && ` · ${bin.frequency.replace(/_/g, ' ')}`}
                                                    {isCompleted && bin.completed_at && ` · Last collected ${new Date(bin.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-xs font-bold px-3 py-1 rounded-full"
                                                    style={{
                                                        background: isCompleted ? '#f0fdf4' : '#f0fdf4',
                                                        color: '#00450d',
                                                        border: '1px solid #bbf7d0',
                                                        fontFamily: 'Manrope, sans-serif'
                                                    }}>
                                                    Active
                                                </span>
                                                {bin.blockchain_tx && (
                                                    <a
                                                        href={`https://amoy.polygonscan.com/tx/${bin.blockchain_tx}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs font-bold px-2 py-1 rounded-full"
                                                        style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}
                                                    >
                                                        Chain ↗
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Request history */}
                    {requests.length > 0 && (
                        <div className="bento-card s4">
                            <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                    Request History
                                </h3>
                                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                                    All bin change requests you have submitted
                                </p>
                            </div>
                            <div>
                                {requests.map(req => {
                                    const ss = statusStyle(req.status)
                                    const rt = REQUEST_TYPES.find(r => r.value === req.request_type)
                                    return (
                                        <div key={req.id} className="request-row">
                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                                                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                                <span className="material-symbols-outlined"
                                                    style={{ fontSize: '18px', color: '#00450d' }}>
                                                    {rt?.icon || 'edit'}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold" style={{ color: '#181c22' }}>
                                                    {rt?.label || req.request_type}
                                                </p>
                                                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                                                    {req.quantity && req.quantity > 1 && `${req.quantity}× `}
                                                    {req.bin_size && `${req.bin_size} `}
                                                    {req.waste_type && `${req.waste_type} `}
                                                    {req.current_bin_size && `from ${req.current_bin_size} `}
                                                    {req.current_waste_type && `(${req.current_waste_type}) `}
                                                    · {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                                {req.notes && (
                                                    <p className="text-xs mt-1 italic" style={{ color: '#94a3b8' }}>{req.notes}</p>
                                                )}
                                                {req.admin_notes && (
                                                    <p className="text-xs mt-1 font-semibold" style={{ color: '#00450d' }}>
                                                        DE note: {req.admin_notes}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex-shrink-0">
                                                <span className="text-xs font-bold px-3 py-1 rounded-full"
                                                    style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, fontFamily: 'Manrope, sans-serif' }}>
                                                    {statusLabel(req.status)}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="px-8 py-4 flex items-center gap-3"
                                style={{ borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff' }}>
                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>info</span>
                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                    Requests are reviewed by your District Engineer · Changes take effect from the next billing cycle · CMC EcoLedger 2026
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}