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

const ASPECTS = [
    { key: 'punctuality', label: 'Punctuality', icon: 'schedule' },
    { key: 'cleanliness', label: 'Cleanliness', icon: 'cleaning_services' },
    { key: 'staff_behaviour', label: 'Staff Behaviour', icon: 'people' },
    { key: 'overall', label: 'Overall Service', icon: 'star' },
]

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hover, setHover] = useState(0)
    return (
        <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 3, 4, 5].map(star => (
                <button key={star} type="button"
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => onChange(star)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', transition: 'transform 0.15s' }}>
                    <span className="material-symbols-outlined"
                        style={{
                            fontSize: '32px',
                            color: star <= (hover || value) ? '#f59e0b' : '#e5e7eb',
                            fontVariationSettings: star <= (hover || value) ? "'FILL' 1" : "'FILL' 0",
                            transition: 'all 0.15s',
                            transform: star <= (hover || value) ? 'scale(1.15)' : 'scale(1)',
                            display: 'inline-block',
                        }}>star</span>
                </button>
            ))}
        </div>
    )
}

const RATING_LABELS = ['', 'Very Poor', 'Poor', 'Average', 'Good', 'Excellent']

export default function CommercialFeedbackPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [pastFeedback, setPastFeedback] = useState<any[]>([])
    const [ratings, setRatings] = useState({ punctuality: 0, cleanliness: 0, staff_behaviour: 0, overall: 0 })
    const [comment, setComment] = useState('')
    const [wasteType, setWasteType] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data: fb } = await supabase.from('feedback').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
        setPastFeedback(fb || [])
        setLoading(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (ratings.overall === 0) { setMessage('Please rate the overall service'); return }
        setSubmitting(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('feedback').insert({
            user_id: user?.id,
            role: 'commercial_establishment',
            rating: ratings.overall,
            punctuality_rating: ratings.punctuality || null,
            cleanliness_rating: ratings.cleanliness || null,
            staff_behaviour_rating: ratings.staff_behaviour || null,
            comment: comment || null,
            waste_type: wasteType || null,
            collection_date: new Date().toISOString().split('T')[0],
        })
        if (error) {
            setMessage('Error: ' + error.message)
        } else {
            setSubmitted(true)
            loadData()
        }
        setSubmitting(false)
    }

    const avgRating = pastFeedback.length > 0
        ? (pastFeedback.reduce((s, f) => s + f.rating, 0) / pastFeedback.length).toFixed(1)
        : null

    return (
        <DashboardLayout role="Commercial" userName={profile?.full_name || ''} navItems={COMMERCIAL_NAV}
            primaryAction={{ label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' }}>
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .form-field { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafafa; transition:all 0.2s; outline:none; box-sizing:border-box; }
        .form-field:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .aspect-card { background:#f9fafb; border-radius:14px; padding:20px; border:1.5px solid #f1f5f9; transition:all 0.2s; }
        .aspect-card:hover { border-color:rgba(0,69,13,0.15); background:white; }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1 { animation:staggerIn 0.5s ease 0.05s both; }
        .s2 { animation:staggerIn 0.5s ease 0.1s both; }
        .s3 { animation:staggerIn 0.5s ease 0.15s both; }
        @keyframes successPop { 0% { transform:scale(0.8); opacity:0; } 60% { transform:scale(1.05); } 100% { transform:scale(1); opacity:1; } }
        .success-pop { animation:successPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
      `}</style>

            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    Resident Portal · Service Feedback
                </span>
                <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Rate <span style={{ color: '#1b5e20' }}>Your Service</span>
                </h1>
                <p className="text-sm mt-2" style={{ color: '#717a6d' }}>
                    Help CMC improve waste collection services for your establishment
                </p>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : submitted ? (
                /* Success state */
                <div className="bento-card s1 flex flex-col items-center justify-center text-center" style={{ padding: '64px 32px' }}>
                    <div className="success-pop w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: '#f0fdf4' }}>
                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '40px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <h2 className="font-headline font-bold text-2xl mb-2" style={{ color: '#181c22' }}>Thank you for your feedback!</h2>
                    <p className="text-sm mb-8" style={{ color: '#717a6d' }}>Your rating helps CMC improve waste collection services across Colombo.</p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => { setSubmitted(false); setRatings({ punctuality: 0, cleanliness: 0, staff_behaviour: 0, overall: 0 }); setComment(''); setWasteType('') }}
                            style={{ padding: '12px 24px', borderRadius: '12px', background: '#00450d', color: 'white', border: 'none', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                            Submit Another
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Form */}
                    <div className="lg:col-span-2 s2">
                        <form onSubmit={handleSubmit}>
                            <div className="bento-card mb-6">
                                <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                    <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Rate Your Collection Service</h3>
                                    <p className="text-sm mt-1" style={{ color: '#717a6d' }}>Your feedback is anonymous and goes directly to CMC</p>
                                </div>
                                <div className="p-8">
                                    {message && (
                                        <div className="mb-6 p-3 rounded-xl flex items-center gap-2" style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '16px' }}>error</span>
                                            <p className="text-xs font-medium" style={{ color: '#ba1a1a' }}>{message}</p>
                                        </div>
                                    )}

                                    {/* Aspect ratings */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                        {ASPECTS.map(aspect => (
                                            <div key={aspect.key} className="aspect-card">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '16px' }}>{aspect.icon}</span>
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{aspect.label}</p>
                                                        {ratings[aspect.key as keyof typeof ratings] > 0 && (
                                                            <p style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>
                                                                {RATING_LABELS[ratings[aspect.key as keyof typeof ratings]]}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <StarRating
                                                    value={ratings[aspect.key as keyof typeof ratings]}
                                                    onChange={v => setRatings(r => ({ ...r, [aspect.key]: v }))}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Waste type */}
                                    <div className="mb-5">
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '7px' }}>
                                            Which collection are you rating? (optional)
                                        </label>
                                        <select className="form-field" value={wasteType} onChange={e => setWasteType(e.target.value)}>
                                            <option value="">— Select waste type —</option>
                                            <option value="organic">Organic Waste</option>
                                            <option value="recyclable">Recyclable</option>
                                            <option value="non_recyclable">Non-Recyclable</option>
                                            <option value="e_waste">E-Waste</option>
                                            <option value="bulk">Bulk Waste</option>
                                        </select>
                                    </div>

                                    {/* Comment */}
                                    <div className="mb-6">
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', fontFamily: 'Manrope, sans-serif', marginBottom: '7px' }}>
                                            Additional Comments (optional)
                                        </label>
                                        <textarea className="form-field" rows={4} placeholder="Tell us what went well or what could be improved..."
                                            value={comment} onChange={e => setComment(e.target.value)}
                                            style={{ resize: 'vertical' }} />
                                    </div>

                                    <button type="submit" disabled={submitting || ratings.overall === 0}
                                        style={{ background: ratings.overall === 0 ? '#e5e7eb' : '#00450d', color: ratings.overall === 0 ? '#94a3b8' : 'white', border: 'none', borderRadius: '12px', padding: '14px 28px', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '15px', cursor: ratings.overall === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
                                        {submitting ? (
                                            <><div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />Submitting...</>
                                        ) : (
                                            <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>Submit Feedback</>
                                        )}
                                    </button>
                                    {ratings.overall === 0 && (
                                        <p className="text-xs mt-2" style={{ color: '#94a3b8' }}>Please give an overall rating to submit</p>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Sidebar — past feedback */}
                    <div className="s3">
                        {avgRating && (
                            <div className="bento-card mb-4" style={{ background: '#00450d', color: 'white', padding: '24px' }}>
                                <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(163,246,156,0.7)', marginBottom: '8px', fontFamily: 'Manrope, sans-serif' }}>
                                    Your Average Rating
                                </p>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '52px', fontWeight: 900, fontFamily: 'Manrope, sans-serif', lineHeight: 1 }}>{avgRating}</span>
                                    <span style={{ fontSize: '24px', color: '#f59e0b', marginBottom: '4px' }}>★</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Based on {pastFeedback.length} rating{pastFeedback.length !== 1 ? 's' : ''}</p>
                            </div>
                        )}

                        <div className="bento-card">
                            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                <h3 className="font-headline font-bold text-base" style={{ color: '#181c22' }}>Your Past Feedback</h3>
                            </div>
                            {pastFeedback.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center px-5">
                                    <span className="material-symbols-outlined mb-2" style={{ color: '#d1d5db', fontSize: '32px' }}>rate_review</span>
                                    <p className="text-sm font-medium" style={{ color: '#181c22' }}>No feedback yet</p>
                                    <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Your ratings will appear here</p>
                                </div>
                            ) : (
                                <div>
                                    {pastFeedback.map(fb => (
                                        <div key={fb.id} style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,69,13,0.04)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <div style={{ display: 'flex', gap: '2px' }}>
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <span key={s} className="material-symbols-outlined"
                                                            style={{ fontSize: '16px', color: s <= fb.rating ? '#f59e0b' : '#e5e7eb', fontVariationSettings: s <= fb.rating ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                                                    ))}
                                                </div>
                                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                    {new Date(fb.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                            {fb.waste_type && (
                                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 8px', borderRadius: '99px', background: '#f0fdf4', color: '#00450d', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase' }}>
                                                    {fb.waste_type.replace('_', ' ')}
                                                </span>
                                            )}
                                            {fb.comment && (
                                                <p className="text-xs mt-2" style={{ color: '#64748b', fontStyle: 'italic' }}>"{fb.comment}"</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}