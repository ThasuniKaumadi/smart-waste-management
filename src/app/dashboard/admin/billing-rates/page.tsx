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

const BIN_SIZES = ['120L', '240L', '660L', '1100L']
const WASTE_TYPES = ['General', 'Recyclable', 'Organic', 'Hazardous']
const TIERS = ['A', 'B'] as const
type RateMap = Record<string, string>

export default function BillingRateMatrixPage() {
    const [profile, setProfile] = useState<any>(null)
    const [rates, setRates] = useState<RateMap>({})
    const [savedRates, setSavedRates] = useState<RateMap>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [activeTier, setActiveTier] = useState<'A' | 'B'>('A')
    const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0])

    useEffect(() => { loadData() }, [])

    function rateKey(binSize: string, wasteType: string, tier: string) {
        return `${binSize}_${wasteType}_${tier}`
    }

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        setProfile(p)
        const { data: existingRates } = await supabase.from('billing_rates').select('*').order('effective_from', { ascending: false }).limit(1).single()
        const initRates: RateMap = {}
        const sizeMultiplier: Record<string, number> = { '120L': 1, '240L': 1.5, '660L': 3, '1100L': 5 }
        const wasteMultiplier: Record<string, number> = { General: 1, Recyclable: 0.8, Organic: 0.9, Hazardous: 2 }
        BIN_SIZES.forEach(bin => {
            WASTE_TYPES.forEach(waste => {
                const m = sizeMultiplier[bin] || 1
                const wm = wasteMultiplier[waste] || 1
                const baseA = existingRates?.tier_a_rate || 500
                const baseB = existingRates?.tier_b_rate || 400
                initRates[rateKey(bin, waste, 'A')] = String(Math.round(baseA * m * wm))
                initRates[rateKey(bin, waste, 'B')] = String(Math.round(baseB * m * wm))
            })
        })
        setRates(initRates)
        setSavedRates(initRates)
        setLoading(false)
    }

    async function handleSave() {
        setSaving(true)
        setMessage(null)
        const supabase = createClient()
        const tierABase = Number(rates[rateKey('120L', 'General', 'A')]) || 500
        const tierBBase = Number(rates[rateKey('120L', 'General', 'B')]) || 400
        const { error } = await supabase.from('billing_rates').upsert({ tier_a_rate: tierABase, tier_b_rate: tierBBase, effective_from: effectiveDate }, { onConflict: 'effective_from' })
        await supabase.from('billing_rates').update({ rate_matrix: rates }).eq('effective_from', effectiveDate)
        setSaving(false)
        if (error) setMessage({ type: 'error', text: error.message })
        else {
            setSavedRates({ ...rates })
            setMessage({ type: 'success', text: `Billing rates saved. Effective from ${new Date(effectiveDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.` })
        }
    }

    const hasChanges = () => JSON.stringify(rates) !== JSON.stringify(savedRates)

    return (
        <DashboardLayout role="Admin" userName={profile?.full_name || 'Administrator'} navItems={ADMIN_NAV}>
            <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
        .stat-card { background:white; border-radius:20px; padding:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); }
        .matrix-table { width:100%; border-collapse:collapse; }
        .matrix-table th { padding:12px 16px; font-size:11px; font-weight:700; color:#717a6d; text-transform:uppercase; letter-spacing:0.08em; font-family:'Manrope',sans-serif; background:#fafbf9; border-bottom:1px solid #e4e9e0; text-align:left; }
        .matrix-table td { padding:12px 16px; border-bottom:1px solid #f0f2ee; vertical-align:middle; }
        .matrix-table tr:last-child td { border-bottom:none; }
        .matrix-table tr:hover td { background:#f9fbf9; }
        .rate-input { width:110px; padding:9px 12px; border:1.5px solid #e4e9e0; border-radius:10px; font-size:14px; font-family:'Inter',sans-serif; color:#181c22; background:#fafbf9; outline:none; transition:border-color 0.2s,box-shadow 0.2s; text-align:right; }
        .rate-input:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .tab-btn { padding:9px 20px; border-radius:10px; font-size:14px; font-weight:600; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; background:transparent; color:#717a6d; }
        .tab-btn.active { background:#00450d; color:white; }
        .tab-btn:not(.active):hover { background:#f0fdf4; color:#00450d; }
        .save-btn { background:#00450d; color:white; border:none; border-radius:12px; padding:12px 26px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.2s; display:inline-flex; align-items:center; gap:8px; }
        .save-btn:hover:not(:disabled) { background:#1b5e20; transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,69,13,0.25); }
        .save-btn:disabled { opacity:0.55; cursor:not-allowed; }
        .tier-badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:8px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both}
        .a3{animation:fadeUp .4s ease .14s both} .a4{animation:fadeUp .4s ease .19s both}
      `}</style>

            <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>

                {/* ── Heading ── */}
                <div className="a1" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>
                            💰 System Administration
                        </p>
                        <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
                            Billing Rate <span style={{ color: '#00450d' }}>Matrix</span>
                        </h1>
                        <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>Per-collection rates by bin size and waste type for Tier A and Tier B customers.</p>
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#717a6d', fontFamily: 'Manrope,sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Effective From</label>
                        <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
                            style={{ padding: '10px 14px', border: '1.5px solid #e4e9e0', borderRadius: 12, fontSize: 14, fontFamily: 'Inter,sans-serif', color: '#181c22', outline: 'none', background: 'white' }} />
                    </div>
                </div>

                {/* ── Stats strip ── */}
                <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
                    {[
                        { label: 'Bin Sizes', value: BIN_SIZES.length.toString(), icon: 'delete', color: '#15803d' },
                        { label: 'Waste Types', value: WASTE_TYPES.length.toString(), icon: 'category', color: '#1d4ed8' },
                        { label: 'Rate Combos', value: (BIN_SIZES.length * WASTE_TYPES.length * 2).toString(), icon: 'grid_4x4', color: '#7c3aed' },
                        { label: 'Active Tier', value: `Tier ${activeTier}`, icon: 'star', color: '#d97706' },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <span className="msf" style={{ fontSize: 18, color: s.color }}>{s.icon}</span>
                                <span style={{ fontSize: 11, color: '#717a6d', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* ── Toast ── */}
                {message && (
                    <div style={{ borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: message.type === 'success' ? '#166534' : '#dc2626' }}>
                        <span className="msf" style={{ fontSize: 18 }}>{message.type === 'success' ? 'check_circle' : 'error'}</span>
                        <span style={{ fontSize: 14, fontFamily: 'Inter,sans-serif' }}>{message.text}</span>
                    </div>
                )}

                {/* ── Tier tabs ── */}
                <div className="a3" style={{ display: 'flex', gap: 6, marginBottom: 16, background: '#f4f6f3', borderRadius: 14, padding: 6, width: 'fit-content' }}>
                    {(['A', 'B'] as const).map(tier => (
                        <button key={tier} className={`tab-btn${activeTier === tier ? ' active' : ''}`} onClick={() => setActiveTier(tier)}>
                            Tier {tier} — {tier === 'A' ? 'Premium' : 'Standard'}
                        </button>
                    ))}
                </div>

                {/* Tier description */}
                <div className="a3" style={{ background: activeTier === 'A' ? '#eff6ff' : '#fffbeb', borderRadius: 12, padding: '12px 18px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="msf" style={{ fontSize: 18, color: activeTier === 'A' ? '#1d4ed8' : '#d97706' }}>info</span>
                    <span style={{ fontSize: 13, fontFamily: 'Inter,sans-serif', color: activeTier === 'A' ? '#1e40af' : '#92400e' }}>
                        {activeTier === 'A' ? 'Tier A — Premium commercial customers. Higher volume, dedicated collection schedule. Rates reflect priority service.' : 'Tier B — Standard commercial customers. Regular collection schedule. Rates reflect standard service level.'}
                    </span>
                </div>

                {/* ── Rate matrix ── */}
                <div className="card a3">
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,69,13,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0 }}>
                            Tier {activeTier} Rates — LKR per collection
                        </h2>
                        <span className="tier-badge" style={{ background: activeTier === 'A' ? '#eff6ff' : '#fffbeb', color: activeTier === 'A' ? '#1d4ed8' : '#d97706' }}>
                            {activeTier === 'A' ? 'Premium' : 'Standard'}
                        </span>
                    </div>
                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#717a6d', fontFamily: 'Inter,sans-serif', fontSize: 14 }}>Loading rates…</div>
                    ) : (
                        <table className="matrix-table">
                            <thead>
                                <tr>
                                    <th>Bin Size</th>
                                    {WASTE_TYPES.map(w => <th key={w}>{w}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {BIN_SIZES.map(bin => (
                                    <tr key={bin}>
                                        <td>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{bin}</div>
                                            <div style={{ fontSize: 11, color: '#a0a89b', fontFamily: 'Inter,sans-serif', marginTop: 2 }}>
                                                {bin === '120L' ? 'Small bin' : bin === '240L' ? 'Standard bin' : bin === '660L' ? 'Euro bin' : 'Large container'}
                                            </div>
                                        </td>
                                        {WASTE_TYPES.map(waste => {
                                            const key = rateKey(bin, waste, activeTier)
                                            return (
                                                <td key={waste}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ fontSize: 13, color: '#717a6d', fontFamily: 'Inter,sans-serif' }}>LKR</span>
                                                        <input className="rate-input" type="number" min="0" step="10" value={rates[key] || ''} onChange={e => setRates(prev => ({ ...prev, [key]: e.target.value }))} placeholder="0" />
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Save footer ── */}
                <div className="a4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, background: 'white', borderRadius: 16, padding: '18px 24px', border: '1px solid rgba(0,69,13,0.05)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: 12 }}>
                    <span style={{ fontSize: 13, color: hasChanges() ? '#d97706' : '#717a6d', fontFamily: 'Inter,sans-serif' }}>
                        {hasChanges() ? '⚠ You have unsaved changes. These rates affect all future invoice generation.' : '✓ All rates are saved and up to date.'}
                    </span>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {hasChanges() && (
                            <button onClick={() => setRates({ ...savedRates })} style={{ background: 'transparent', border: '1.5px solid #e4e9e0', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 600, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', color: '#41493e' }}>
                                Discard
                            </button>
                        )}
                        <button className="save-btn" onClick={handleSave} disabled={saving || !hasChanges()}>
                            <span className="msf" style={{ fontSize: 18 }}>{saving ? 'hourglass_empty' : 'save'}</span>
                            {saving ? 'Saving…' : 'Save All Rates'}
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}