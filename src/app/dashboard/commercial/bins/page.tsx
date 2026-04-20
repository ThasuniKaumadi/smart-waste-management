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
    { label: 'Rate Service', href: '/dashboard/commercial/feedback', icon: 'star' },
    { label: 'Profile', href: '/dashboard/commercial/profile', icon: 'manage_accounts' },
]

const BIN_SIZES = ['120L', '240L', '660L', '1100L']

const WASTE_TYPES = [
    { value: 'organic', label: 'Organic', icon: 'compost', bg: '#f0fdf4', color: '#00450d', border: '#bbf7d0', dark: '#052e16' },
    { value: 'recyclable', label: 'Recyclable', icon: 'recycling', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dark: '#1e3a8a' },
    { value: 'plastics', label: 'Plastics', icon: 'local_drink', bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe', dark: '#4c1d95' },
    { value: 'glass', label: 'Glass', icon: 'liquor', bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc', dark: '#164e63' },
    { value: 'non-recyclable', label: 'Non-Recyclable', icon: 'delete', bg: '#fefce8', color: '#92400e', border: '#fde68a', dark: '#78350f' },
]

const REQUEST_TYPES = [
    { value: 'add', label: 'Add bin', icon: 'add_circle', desc: 'Request additional bins' },
    { value: 'remove', label: 'Remove bin', icon: 'remove_circle', desc: 'Remove existing bins' },
    { value: 'change_size', label: 'Change size', icon: 'straighten', desc: 'Upgrade or downsize' },
    { value: 'change_type', label: 'Change type', icon: 'swap_horiz', desc: 'Change waste category' },
]

function wasteInfo(type: string | null) {
    return WASTE_TYPES.find(w => w.value === type?.toLowerCase()) || {
        value: type || 'unknown', label: type || 'Unknown',
        icon: 'delete_sweep', bg: '#f8fafc', color: '#475569', border: '#e2e8f0', dark: '#1e293b'
    }
}

function statusStyle(status: string) {
    if (status === 'approved') return { bg: '#f0fdf4', color: '#00450d', border: '#bbf7d0' }
    if (status === 'rejected') return { bg: '#fef2f2', color: '#ba1a1a', border: '#fecaca' }
    return { bg: '#fefce8', color: '#92400e', border: '#fde68a' }
}

export default function CommercialBinsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [bins, setBins] = useState<any[]>([])
    const [requests, setRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitSuccess, setSubmitSuccess] = useState(false)

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
            const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            setProfile(p)
            const [binsRes, requestsRes] = await Promise.all([
                supabase.from('collection_stops').select('*').eq('commercial_id', user.id).eq('is_commercial', true).order('created_at', { ascending: true }),
                supabase.from('commercial_bin_requests').select('*').eq('commercial_id', user.id).order('created_at', { ascending: false }),
            ])
            setBins(binsRes.data ?? [])
            setRequests(requestsRes.data ?? [])
        } catch (err: any) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit() {
        setSubmitting(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const payload: any = { commercial_id: user.id, request_type: reqType, notes: notes || null, status: 'pending' }
            if (reqType === 'add') { payload.waste_type = wasteType; payload.bin_size = binSize; payload.quantity = quantity }
            else if (reqType === 'remove') { payload.current_waste_type = currentWasteType; payload.current_bin_size = currentBinSize; payload.quantity = quantity }
            else if (reqType === 'change_size') { payload.current_waste_type = currentWasteType; payload.current_bin_size = currentBinSize; payload.bin_size = binSize }
            else if (reqType === 'change_type') { payload.current_waste_type = currentWasteType; payload.current_bin_size = currentBinSize; payload.waste_type = wasteType }
            const { error } = await supabase.from('commercial_bin_requests').insert(payload)
            if (error) throw error
            setSubmitSuccess(true); setShowForm(false); setNotes(''); setQuantity(1)
            await loadData()
            setTimeout(() => setSubmitSuccess(false), 4000)
        } catch (err: any) {
            alert('Failed to submit: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const pendingRequests = requests.filter(r => r.status === 'pending')
    const totalBins = bins.reduce((sum, b) => sum + (b.bin_quantity || b.bin_count || 1), 0)

    return (
        <DashboardLayout
            role="Commercial"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={COMMERCIAL_NAV}
            primaryAction={{ label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' }}
        >
            <style>{`
                .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
                .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
                .bin-card { border-radius:16px; padding:20px; position:relative; overflow:hidden; border:1.5px solid transparent; transition:all 0.2s; }
                .bin-card:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,0,0,0.1); }
                .req-btn { border:1.5px solid rgba(0,69,13,0.1); border-radius:12px; padding:12px; cursor:pointer; transition:all 0.15s; background:white; text-align:left; width:100%; }
                .req-btn:hover { border-color:#00450d; background:#f0fdf4; }
                .req-btn.active { border-color:#00450d; background:#f0fdf4; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
                .size-pill { border:1.5px solid rgba(0,69,13,0.1); border-radius:99px; padding:6px 16px; cursor:pointer; background:white; font-family:'Manrope',sans-serif; font-weight:700; font-size:12px; color:#475569; transition:all 0.15s; }
                .size-pill:hover { border-color:#00450d; color:#00450d; }
                .size-pill.on { background:#00450d; color:white; border-color:#00450d; }
                .waste-pill { border:1.5px solid transparent; border-radius:10px; padding:8px 12px; cursor:pointer; display:flex; align-items:center; gap:6px; font-family:'Manrope',sans-serif; font-weight:600; font-size:12px; transition:all 0.15s; }
                .field-label { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#717a6d; font-family:'Manrope',sans-serif; display:block; margin-bottom:8px; }
                .notes-ta { width:100%; border:1.5px solid rgba(0,69,13,0.15); border-radius:10px; padding:10px 12px; font-size:13px; color:#181c22; font-family:inherit; resize:vertical; min-height:72px; outline:none; transition:border-color 0.15s; box-sizing:border-box; }
                .notes-ta:focus { border-color:#00450d; }
                .req-row { padding:14px 0; border-bottom:1px solid rgba(0,69,13,0.05); display:flex; align-items:flex-start; gap:12px; }
                .req-row:last-child { border-bottom:none; }
                @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
                .a1{animation:fadeUp 0.4s ease 0.05s both}
                .a2{animation:fadeUp 0.4s ease 0.1s both}
                .a3{animation:fadeUp 0.4s ease 0.15s both}
                .a4{animation:fadeUp 0.4s ease 0.2s both}
                @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
                .slide-in{animation:slideIn 0.25s ease-out}
            `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Bin Management · ClearPath
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif' }}>
                        Your <span style={{ color: '#00450d' }}>Bins</span>
                    </h1>
                    <button onClick={() => { setShowForm(!showForm); setSubmitSuccess(false) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', borderRadius: '99px', background: showForm ? '#f1f5f9' : '#00450d', color: showForm ? '#475569' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '13px', transition: 'all 0.2s' }}>
                        <span className="msf" style={{ fontSize: '18px' }}>{showForm ? 'close' : 'tune'}</span>
                        {showForm ? 'Close' : 'Request change'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #00450d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* Success */}
                    {submitSuccess && (
                        <div className="slide-in" style={{ borderRadius: '14px', padding: '14px 18px', marginBottom: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="msf" style={{ color: '#00450d', fontSize: '20px' }}>check_circle</span>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>Request submitted — your District Engineer will review it shortly.</p>
                        </div>
                    )}

                    {/* Pending notice */}
                    {pendingRequests.length > 0 && (
                        <div className="a1" style={{ borderRadius: '14px', padding: '14px 18px', marginBottom: '20px', background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="msf" style={{ color: '#d97706', fontSize: '20px' }}>pending</span>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', fontFamily: 'Manrope,sans-serif' }}>
                                {pendingRequests.length} request{pendingRequests.length > 1 ? 's' : ''} pending DE review
                            </p>
                        </div>
                    )}

                    {/* Main layout — two columns when form is open */}
                    <div className="a2" style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 360px' : '1fr', gap: '20px', alignItems: 'start' }}>

                        {/* Left: inventory */}
                        <div>
                            {/* Stat strip */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
                                {[
                                    { label: 'Total bins', value: totalBins, icon: 'delete', color: '#00450d', bg: '#f0fdf4' },
                                    { label: 'Waste types', value: new Set(bins.map(b => b.waste_type).filter(Boolean)).size || bins.length, icon: 'category', color: '#1d4ed8', bg: '#eff6ff' },
                                    { label: 'Pending', value: pendingRequests.length, icon: pendingRequests.length > 0 ? 'pending' : 'task_alt', color: pendingRequests.length > 0 ? '#d97706' : '#00450d', bg: pendingRequests.length > 0 ? '#fffbeb' : '#f0fdf4' },
                                ].map(s => (
                                    <div key={s.label} className="card" style={{ padding: '18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span className="msf" style={{ fontSize: '16px', color: s.color }}>{s.icon}</span>
                                            </div>
                                            <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
                                        </div>
                                        <p style={{ fontSize: '28px', fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{s.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Bin inventory grid */}
                            <div className="card" style={{ marginBottom: '20px' }}>
                                <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>Registered Bins</h2>
                                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Active bins managed by CMC</p>
                                    </div>
                                    {bins.length > 0 && (
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#00450d', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '99px', padding: '4px 12px', fontFamily: 'Manrope,sans-serif' }}>
                                            {totalBins} bins
                                        </span>
                                    )}
                                </div>

                                {bins.length === 0 ? (
                                    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                            <span className="msf" style={{ color: '#00450d', fontSize: '28px' }}>delete_outline</span>
                                        </div>
                                        <p style={{ fontSize: '15px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: '6px' }}>No bins registered yet</p>
                                        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>Bins appear here after your District Engineer approves your setup.</p>
                                        <button onClick={() => setShowForm(true)}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '99px', background: '#00450d', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'Manrope,sans-serif' }}>
                                            <span className="msf" style={{ fontSize: '16px' }}>add</span>
                                            Request bins
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                                        {bins.map(bin => {
                                            const w = wasteInfo(bin.waste_type)
                                            const qty = bin.bin_quantity || bin.bin_count || 1
                                            return (
                                                <div key={bin.id} className="bin-card" style={{ background: w.bg, borderColor: w.border }}>
                                                    {/* Large icon background */}
                                                    <span className="msf" style={{ position: 'absolute', top: '-8px', right: '-4px', fontSize: '80px', color: w.color, opacity: 0.07 }}>{w.icon}</span>
                                                    <div style={{ position: 'relative', zIndex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px rgba(0,0,0,0.08)` }}>
                                                                <span className="msf" style={{ fontSize: '18px', color: w.color }}>{w.icon}</span>
                                                            </div>
                                                            <div>
                                                                <p style={{ fontSize: '13px', fontWeight: 800, color: w.dark, fontFamily: 'Manrope,sans-serif', lineHeight: 1.2 }}>{w.label}</p>
                                                                <p style={{ fontSize: '10px', color: w.color, opacity: 0.8 }}>{bin.bin_size || 'Standard'} bin</p>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                                            <div>
                                                                <p style={{ fontSize: '32px', fontWeight: 900, color: w.dark, fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{qty}</p>
                                                                <p style={{ fontSize: '11px', color: w.color, opacity: 0.8 }}>bin{qty > 1 ? 's' : ''} · {bin.frequency?.replace(/_/g, ' ') || 'scheduled'}</p>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                                <span style={{ fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '99px', background: 'white', color: w.color, fontFamily: 'Manrope,sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                                                    Active
                                                                </span>
                                                                {bin.blockchain_tx && (
                                                                    <a href={`https://amoy.polygonscan.com/tx/${bin.blockchain_tx}`} target="_blank" rel="noopener noreferrer"
                                                                        style={{ fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '99px', background: 'white', color: '#7c3aed', fontFamily: 'Manrope,sans-serif', textDecoration: 'none' }}>
                                                                        Chain ↗
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {bin.road_name && (
                                                            <p style={{ fontSize: '10px', color: w.color, opacity: 0.7, marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {bin.road_name}
                                                            </p>
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
                                <div className="card a3">
                                    <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>Request History</h2>
                                    </div>
                                    <div style={{ padding: '0 22px' }}>
                                        {requests.map(req => {
                                            const ss = statusStyle(req.status)
                                            const rt = REQUEST_TYPES.find(r => r.value === req.request_type)
                                            return (
                                                <div key={req.id} className="req-row">
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <span className="msf" style={{ fontSize: '15px', color: '#00450d' }}>{rt?.icon || 'edit'}</span>
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22' }}>{rt?.label || req.request_type}</p>
                                                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                                            {req.quantity && req.quantity > 1 && `${req.quantity}× `}{req.bin_size || ''}{req.waste_type && ` ${req.waste_type}`}
                                                            {' · '}{new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </p>
                                                        {req.admin_notes && <p style={{ fontSize: '11px', color: '#00450d', fontWeight: 600, marginTop: '3px' }}>DE: {req.admin_notes}</p>}
                                                    </div>
                                                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px', background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, fontFamily: 'Manrope,sans-serif', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                                        {req.status === 'approved' ? 'Approved' : req.status === 'rejected' ? 'Rejected' : 'Pending'}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div style={{ padding: '12px 22px', borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="msf" style={{ color: '#94a3b8', fontSize: '14px' }}>info</span>
                                        <p style={{ fontSize: '11px', color: '#717a6d' }}>Changes take effect from the next billing cycle · CMC EcoLedger 2026</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: request form panel */}
                        {showForm && (
                            <div className="card slide-in" style={{ padding: '24px', position: 'sticky', top: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>New Request</h2>
                                    <button onClick={() => setShowForm(false)}
                                        style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="msf" style={{ fontSize: '16px', color: '#94a3b8' }}>close</span>
                                    </button>
                                </div>

                                {/* Request type */}
                                <div style={{ marginBottom: '18px' }}>
                                    <span className="field-label">Type</span>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        {REQUEST_TYPES.map(rt => (
                                            <button key={rt.value} className={`req-btn ${reqType === rt.value ? 'active' : ''}`} onClick={() => setReqType(rt.value)}>
                                                <span className="msf" style={{ fontSize: '18px', color: reqType === rt.value ? '#00450d' : '#94a3b8', display: 'block', marginBottom: '4px' }}>{rt.icon}</span>
                                                <p style={{ fontSize: '11px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{rt.label}</p>
                                                <p style={{ fontSize: '10px', color: '#94a3b8' }}>{rt.desc}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Current bin — remove/change */}
                                {(reqType === 'remove' || reqType === 'change_size' || reqType === 'change_type') && (
                                    <div style={{ marginBottom: '18px', paddingBottom: '18px', borderBottom: '1px dashed rgba(0,69,13,0.1)' }}>
                                        <span className="field-label">Current bin</span>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                            {WASTE_TYPES.map(wt => (
                                                <button key={wt.value} className="waste-pill"
                                                    style={{ background: currentWasteType === wt.value ? wt.bg : 'white', color: currentWasteType === wt.value ? wt.color : '#475569', borderColor: currentWasteType === wt.value ? wt.color : 'rgba(0,69,13,0.1)' }}
                                                    onClick={() => setCurrentWasteType(wt.value)}>
                                                    <span className="msf" style={{ fontSize: '13px' }}>{wt.icon}</span>
                                                    {wt.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {BIN_SIZES.map(s => (
                                                <button key={s} className={`size-pill ${currentBinSize === s ? 'on' : ''}`} onClick={() => setCurrentBinSize(s)}>{s}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* New waste type — add/change_type */}
                                {(reqType === 'add' || reqType === 'change_type') && (
                                    <div style={{ marginBottom: '18px' }}>
                                        <span className="field-label">{reqType === 'change_type' ? 'New type' : 'Waste type'}</span>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {WASTE_TYPES.map(wt => (
                                                <button key={wt.value} className="waste-pill"
                                                    style={{ background: wasteType === wt.value ? wt.bg : 'white', color: wasteType === wt.value ? wt.color : '#475569', borderColor: wasteType === wt.value ? wt.color : 'rgba(0,69,13,0.1)' }}
                                                    onClick={() => setWasteType(wt.value)}>
                                                    <span className="msf" style={{ fontSize: '13px' }}>{wt.icon}</span>
                                                    {wt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Bin size — add/change_size */}
                                {(reqType === 'add' || reqType === 'change_size') && (
                                    <div style={{ marginBottom: '18px' }}>
                                        <span className="field-label">{reqType === 'change_size' ? 'New size' : 'Bin size'}</span>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                            {BIN_SIZES.map(s => (
                                                <button key={s} className={`size-pill ${binSize === s ? 'on' : ''}`} onClick={() => setBinSize(s)}>{s}</button>
                                            ))}
                                        </div>
                                        <p style={{ fontSize: '10px', color: '#94a3b8' }}>120L café · 240L restaurant · 660L hotel · 1100L supermarket</p>
                                    </div>
                                )}

                                {/* Quantity — add/remove */}
                                {(reqType === 'add' || reqType === 'remove') && (
                                    <div style={{ marginBottom: '18px' }}>
                                        <span className="field-label">Quantity</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                                style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid rgba(0,69,13,0.15)', background: 'white', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00450d', fontWeight: 700 }}>−</button>
                                            <span style={{ fontSize: '20px', fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', minWidth: '24px', textAlign: 'center' }}>{quantity}</span>
                                            <button onClick={() => setQuantity(q => Math.min(10, q + 1))}
                                                style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid rgba(0,69,13,0.15)', background: 'white', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00450d', fontWeight: 700 }}>+</button>
                                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>bin{quantity > 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Notes */}
                                <div style={{ marginBottom: '20px' }}>
                                    <span className="field-label">Notes (optional)</span>
                                    <textarea className="notes-ta" placeholder="Context for your District Engineer..." value={notes} onChange={e => setNotes(e.target.value)} />
                                </div>

                                <button onClick={handleSubmit} disabled={submitting}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: '#00450d', color: 'white', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '14px', opacity: submitting ? 0.7 : 1, transition: 'all 0.2s' }}>
                                    {submitting ? (
                                        <><div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />Submitting...</>
                                    ) : (
                                        <><span className="msf" style={{ fontSize: '18px' }}>send</span>Submit request</>
                                    )}
                                </button>
                                <p style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '10px' }}>Reviewed within 2 working days</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}