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

const WASTE_TYPES = [
    { value: 'organic', label: 'Organic', icon: 'compost' },
    { value: 'recyclable', label: 'Recyclable', icon: 'recycling' },
    { value: 'plastics', label: 'Plastics', icon: 'local_drink' },
    { value: 'glass', label: 'Glass', icon: 'liquor' },
    { value: 'non-recyclable', label: 'Non-Recyclable', icon: 'delete' },
]

const RATING_LABELS = ['', 'Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
const RATING_COLORS = ['', '#dc2626', '#f97316', '#f59e0b', '#16a34a', '#00450d']
const RATING_EMOJIS = ['', '😞', '😕', '😐', '🙂', '😊']

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hover, setHover] = useState(0)
    const active = hover || value
    return (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {[1, 2, 3, 4, 5].map(s => (
                <button key={s} type="button"
                    onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
                    onClick={() => onChange(s)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', lineHeight: 1, transition: 'transform 0.15s', transform: s <= active ? 'scale(1.2)' : 'scale(1)' }}>
                    <span style={{
                        fontFamily: 'Material Symbols Outlined',
                        fontVariationSettings: s <= active ? "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 48" : "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 48",
                        fontSize: '48px',
                        color: s <= active ? (RATING_COLORS[active] || '#f59e0b') : '#e2e8f0',
                        display: 'block',
                        transition: 'all 0.2s',
                    }}>star</span>
                </button>
            ))}
        </div>
    )
}

export default function CommercialFeedbackPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [pastFeedback, setPastFeedback] = useState<any[]>([])
    const [rating, setRating] = useState(0)
    const [comment, setComment] = useState('')
    const [wasteType, setWasteType] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data: fb } = await supabase.from('feedback').select('*')
            .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
        setPastFeedback(fb || [])
        setLoading(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setErrorMsg('')
        if (rating === 0) { setErrorMsg('Please select a satisfaction rating.'); return }
        setSubmitting(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            const { error } = await supabase.from('feedback').insert({
                user_id: user?.id,
                role: 'commercial_establishment',
                rating,
                comment: comment.trim() || null,
                waste_type: wasteType || null,
                collection_date: new Date().toISOString().split('T')[0],
            })
            if (error) { setErrorMsg(error.message); return }
            setSubmitted(true)
            await loadData()
        } finally { setSubmitting(false) }
    }

    function reset() {
        setSubmitted(false); setRating(0); setComment(''); setWasteType(''); setErrorMsg('')
    }

    const avgRating = pastFeedback.length > 0
        ? (pastFeedback.reduce((s, f) => s + f.rating, 0) / pastFeedback.length).toFixed(1)
        : null

    const avgNum = avgRating ? parseFloat(avgRating) : 0

    return (
        <DashboardLayout
            role="Commercial"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={COMMERCIAL_NAV}
            primaryAction={{ label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' }}
        >
            <style>{`
                .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
                .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
                .waste-btn{border:1.5px solid rgba(0,69,13,0.1);border-radius:10px;padding:8px 14px;cursor:pointer;background:white;display:flex;align-items:center;gap:6px;font-family:'Manrope',sans-serif;font-weight:600;font-size:12px;color:#475569;transition:all 0.15s}
                .waste-btn:hover{border-color:#00450d;color:#00450d;background:#f0fdf4}
                .waste-btn.on{background:#f0fdf4;color:#00450d;border-color:#00450d;border-width:2px}
                .field{width:100%;padding:12px 14px;border:1.5px solid rgba(0,69,13,0.12);border-radius:12px;font-size:14px;color:#181c22;font-family:inherit;background:#fafafa;outline:none;transition:border-color 0.15s;box-sizing:border-box;resize:vertical}
                .field:focus{border-color:#00450d;background:white}
                .field::placeholder{color:#9ca3af}
                .submit-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;border-radius:12px;border:none;font-family:'Manrope',sans-serif;font-weight:700;font-size:15px;transition:all 0.2s}
                .fb-row{padding:14px 20px;border-bottom:1px solid rgba(0,69,13,0.04)}
                .fb-row:last-child{border-bottom:none}
                @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
                .a1{animation:fadeUp 0.4s ease 0.05s both}
                .a2{animation:fadeUp 0.4s ease 0.1s both}
                @keyframes popIn{0%{transform:scale(0.8);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
                .pop-in{animation:popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both}
            `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: '28px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Commercial Portal · Service Feedback
                </p>
                <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif' }}>
                    Rate Your <span style={{ color: '#00450d' }}>Service</span>
                </h1>
                <p style={{ fontSize: '13px', color: '#717a6d', marginTop: '6px' }}>
                    Share your experience and help CMC improve waste collection
                </p>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #00450d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                </div>
            ) : (
                <div className="a2" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>

                    {/* Left: form */}
                    <div>
                        {submitted ? (
                            <div className="card pop-in" style={{ padding: '64px 32px', textAlign: 'center' }}>
                                <div style={{ fontSize: '64px', marginBottom: '16px', lineHeight: 1 }}>
                                    {RATING_EMOJIS[rating]}
                                </div>
                                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 1", fontSize: '36px', color: '#00450d', display: 'block' }}>check_circle</span>
                                </div>
                                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', marginBottom: '8px' }}>
                                    Thank you!
                                </h2>
                                <p style={{ fontSize: '14px', color: '#717a6d', marginBottom: '8px' }}>
                                    You rated the service: <strong style={{ color: RATING_COLORS[rating] }}>{RATING_LABELS[rating]}</strong>
                                </p>
                                <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '28px' }}>
                                    Your feedback goes directly to CMC and helps improve services across Colombo.
                                </p>
                                <button onClick={reset}
                                    style={{ padding: '12px 28px', borderRadius: '12px', background: '#00450d', color: 'white', border: 'none', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                                    Submit Another
                                </button>
                            </div>
                        ) : (
                            <div className="card">
                                {/* Form header */}
                                <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(0,69,13,0.06)', background: 'linear-gradient(135deg, #00450d, #1b5e20)', borderRadius: '20px 20px 0 0' }}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', fontFamily: 'Manrope,sans-serif', marginBottom: '4px' }}>
                                        How satisfied are you?
                                    </h2>
                                    <p style={{ fontSize: '12px', color: 'rgba(163,246,156,0.75)' }}>
                                        Your feedback is anonymous and helps us serve you better
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                                    {/* Star rating — large and centred */}
                                    <div style={{ textAlign: 'center' }}>
                                        <StarRating value={rating} onChange={setRating} />
                                        <div style={{ marginTop: '14px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            {rating > 0 ? (
                                                <>
                                                    <span style={{ fontSize: '28px', lineHeight: 1 }}>{RATING_EMOJIS[rating]}</span>
                                                    <span style={{ fontSize: '18px', fontWeight: 800, color: RATING_COLORS[rating], fontFamily: 'Manrope,sans-serif', transition: 'color 0.2s' }}>
                                                        {RATING_LABELS[rating]}
                                                    </span>
                                                </>
                                            ) : (
                                                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Tap a star to rate</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Waste type selector */}
                                    <div>
                                        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '10px' }}>
                                            Which collection? <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                                        </p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {WASTE_TYPES.map(wt => (
                                                <button key={wt.value} type="button"
                                                    className={`waste-btn ${wasteType === wt.value ? 'on' : ''}`}
                                                    onClick={() => setWasteType(v => v === wt.value ? '' : wt.value)}>
                                                    <span className="msf" style={{ fontSize: '14px' }}>{wt.icon}</span>
                                                    {wt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Feedback / suggestion text */}
                                    <div>
                                        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: '10px' }}>
                                            Feedback or suggestions <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                                        </p>
                                        <textarea className="field" rows={5}
                                            placeholder="What went well? What could be improved? Any suggestions for CMC?"
                                            value={comment}
                                            onChange={e => setComment(e.target.value)}
                                        />
                                    </div>

                                    {/* Error */}
                                    {errorMsg && (
                                        <div style={{ borderRadius: '10px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="msf" style={{ color: '#ba1a1a', fontSize: '18px' }}>error</span>
                                            <p style={{ fontSize: '12px', color: '#ba1a1a' }}>{errorMsg}</p>
                                        </div>
                                    )}

                                    {/* Submit */}
                                    <button type="submit" disabled={submitting || rating === 0}
                                        className="submit-btn"
                                        style={{
                                            background: rating === 0 ? '#f0f0f0' : '#00450d',
                                            color: rating === 0 ? '#94a3b8' : 'white',
                                            cursor: rating === 0 ? 'not-allowed' : 'pointer',
                                        }}>
                                        {submitting ? (
                                            <><div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />Submitting...</>
                                        ) : (
                                            <><span className="msf" style={{ fontSize: '18px' }}>send</span>Submit Feedback</>
                                        )}
                                    </button>
                                    {rating === 0 && (
                                        <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '-16px' }}>
                                            Select a star rating to continue
                                        </p>
                                    )}
                                </form>
                            </div>
                        )}
                    </div>

                    {/* Right: average + history */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                        {/* Average rating */}
                        {avgRating ? (
                            <div className="card" style={{ background: '#00450d', color: 'white', padding: '24px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(163,246,156,0.08)' }} />
                                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(163,246,156,0.7)', fontFamily: 'Manrope,sans-serif', marginBottom: '10px' }}>
                                    Your average
                                </p>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '4px', position: 'relative', zIndex: 1 }}>
                                    <span style={{ fontSize: '52px', fontWeight: 900, fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{avgRating}</span>
                                    <span style={{ fontSize: '22px', marginBottom: '6px', color: '#f59e0b' }}>★</span>
                                    <span style={{ fontSize: '28px', marginBottom: '4px' }}>{RATING_EMOJIS[Math.round(avgNum)]}</span>
                                </div>
                                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 1 }}>
                                    {RATING_LABELS[Math.round(avgNum)]} · {pastFeedback.length} submission{pastFeedback.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        ) : (
                            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
                                <span className="msf" style={{ fontSize: '32px', color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>star</span>
                                <p style={{ fontSize: '13px', color: '#94a3b8' }}>No ratings yet — be the first!</p>
                            </div>
                        )}

                        {/* Past feedback list */}
                        {pastFeedback.length > 0 && (
                            <div className="card">
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>Past Feedback</h3>
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{pastFeedback.length} total</span>
                                </div>
                                <div>
                                    {pastFeedback.map(fb => (
                                        <div key={fb.id} className="fb-row">
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ display: 'flex', gap: '2px' }}>
                                                        {[1, 2, 3, 4, 5].map(s => (
                                                            <span key={s} style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: s <= fb.rating ? "'FILL' 1" : "'FILL' 0", fontSize: '14px', color: s <= fb.rating ? '#f59e0b' : '#e5e7eb', display: 'inline-block' }}>star</span>
                                                        ))}
                                                    </div>
                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: RATING_COLORS[fb.rating] || '#94a3b8' }}>
                                                        {RATING_LABELS[fb.rating]}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                                    {new Date(fb.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                </span>
                                            </div>
                                            {fb.waste_type && (
                                                <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', background: '#f0fdf4', color: '#00450d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                    {fb.waste_type.replace(/_/g, ' ')}
                                                </span>
                                            )}
                                            {fb.comment && (
                                                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '5px', fontStyle: 'italic', lineHeight: 1.5 }}>
                                                    "{fb.comment.length > 100 ? fb.comment.slice(0, 100) + '...' : fb.comment}"
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Info */}
                        <div style={{ borderRadius: '14px', padding: '14px 16px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', display: 'flex', gap: '10px' }}>
                            <span className="msf" style={{ color: '#00450d', fontSize: '16px', flexShrink: 0 }}>lock</span>
                            <p style={{ fontSize: '11px', color: '#41493e', lineHeight: 1.5 }}>
                                Feedback is anonymous. Your comments go directly to CMC and are never shared with third parties.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}