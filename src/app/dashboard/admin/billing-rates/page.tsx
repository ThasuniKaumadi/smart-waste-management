'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
  { label: 'Overview',      href: '/dashboard/admin',               icon: 'dashboard'       },
  { label: 'Users',         href: '/dashboard/admin/users',         icon: 'manage_accounts' },
  { label: 'Billing',       href: '/dashboard/admin/billing',       icon: 'payments'        },
  { label: 'Billing Rates', href: '/dashboard/admin/billing-rates', icon: 'tune'            },
  { label: 'Blockchain',    href: '/dashboard/admin/blockchain',    icon: 'link'            },
  { label: 'Performance',   href: '/dashboard/admin/performance',   icon: 'analytics'       },
  { label: 'Disposal',      href: '/dashboard/admin/disposal',      icon: 'delete_sweep'    },
  { label: 'Reports',       href: '/dashboard/admin/reports',       icon: 'rate_review'     },
  { label: 'Profile',       href: '/dashboard/admin/profile',       icon: 'person'          },
]

const BIN_SIZES = ['120L', '240L', '660L', '1100L']
const WASTE_TYPES = ['General', 'Recyclable', 'Organic', 'Hazardous']
const TIERS = ['A', 'B'] as const

type RateKey = `${string}_${string}_${typeof TIERS[number]}`
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

        // Try to load from billing_rates table (flat structure)
        const { data: existingRates } = await supabase
            .from('billing_rates')
            .select('*')
            .order('effective_from', { ascending: false })
            .limit(1)
            .single()

        const initRates: RateMap = {}
        if (existingRates) {
            // Map flat rates into matrix keys — fallback: tier_a_rate and tier_b_rate applied to all combos
            BIN_SIZES.forEach(bin => {
                WASTE_TYPES.forEach(waste => {
                    // Apply size multiplier: 120L=1x, 240L=1.5x, 660L=3x, 1100L=5x
                    const sizeMultiplier: Record<string, number> = { '120L': 1, '240L': 1.5, '660L': 3, '1100L': 5 }
                    const m = sizeMultiplier[bin] || 1
                    initRates[rateKey(bin, waste, 'A')] = String(Math.round((existingRates.tier_a_rate || 500) * m))
                    initRates[rateKey(bin, waste, 'B')] = String(Math.round((existingRates.tier_b_rate || 400) * m))
                })
            })
        } else {
            // Sensible defaults
            const defaults: Record<string, number> = { '120L': 1, '240L': 1.5, '660L': 3, '1100L': 5 }
            BIN_SIZES.forEach(bin => {
                WASTE_TYPES.forEach(waste => {
                    const m = defaults[bin] || 1
                    const wasteMultiplier: Record<string, number> = { General: 1, Recyclable: 0.8, Organic: 0.9, Hazardous: 2 }
                    const wm = wasteMultiplier[waste] || 1
                    initRates[rateKey(bin, waste, 'A')] = String(Math.round(500 * m * wm))
                    initRates[rateKey(bin, waste, 'B')] = String(Math.round(400 * m * wm))
                })
            })
        }

        setRates(initRates)
        setSavedRates(initRates)
        setLoading(false)
    }

    async function handleSave() {
        setSaving(true)
        setMessage(null)
        const supabase = createClient()

        // Compute aggregate tier_a_rate and tier_b_rate (average of 120L General rates for backward compat)
        const tierABase = Number(rates[rateKey('120L', 'General', 'A')]) || 500
        const tierBBase = Number(rates[rateKey('120L', 'General', 'B')]) || 400

        // Upsert into billing_rates (flat table — backward compat)
        const { error } = await supabase.from('billing_rates').upsert({
            tier_a_rate: tierABase,
            tier_b_rate: tierBBase,
            effective_from: effectiveDate,
        }, { onConflict: 'effective_from' })

        // Also save full matrix to a JSONB column or separate table if available
        // Here we do it as a system setting in a metadata key
        await supabase.from('billing_rates').update({
            rate_matrix: rates,
        }).eq('effective_from', effectiveDate).then(() => { })

        setSaving(false)
        if (error) {
            setMessage({ type: 'error', text: error.message })
        } else {
            setSavedRates({ ...rates })
            setMessage({ type: 'success', text: `Billing rates saved. Effective from ${new Date(effectiveDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.` })
        }
    }

    function hasChanges() {
        return JSON.stringify(rates) !== JSON.stringify(savedRates)
    }

    const totalCombinations = BIN_SIZES.length * WASTE_TYPES.length

    return (
        <DashboardLayout
            role="Admin"
            userName={profile?.full_name || 'Administrator'}
            navItems={ADMIN_NAV}
        >
            <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .rate-card { background: white; border-radius: 20px; border: 1px solid rgba(0,69,13,0.06); box-shadow: 0 4px 24px rgba(0,0,0,0.05); overflow: hidden; }
        .matrix-table { width: 100%; border-collapse: collapse; }
        .matrix-table th { padding: 12px 16px; font-size: 12px; font-weight: 700; color: #717a6d; text-transform: uppercase; letter-spacing: 0.06em; font-family: 'Manrope', sans-serif; background: #fafbf9; border-bottom: 1px solid #e4e9e0; text-align: left; }
        .matrix-table td { padding: 10px 16px; border-bottom: 1px solid #f4f6f3; vertical-align: middle; }
        .matrix-table tr:last-child td { border-bottom: none; }
        .matrix-table tr:hover td { background: #f9fdf9; }
        .rate-input { width: 110px; padding: 9px 12px; border: 1.5px solid #e4e9e0; border-radius: 10px; font-size: 14px; font-family: 'Inter', sans-serif; color: #181c22; background: #fafbf9; outline: none; transition: border-color 0.2s; text-align: right; }
        .rate-input:focus { border-color: #00450d; background: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.08); }
        .tab-btn { padding: 9px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s; background: transparent; color: #717a6d; }
        .tab-btn.active { background: #00450d; color: white; }
        .tab-btn:not(.active):hover { background: #f0fdf4; color: #00450d; }
        .save-btn { background: #00450d; color: white; border: none; border-radius: 12px; padding: 12px 26px; font-size: 14px; font-weight: 600; font-family: 'Manrope', sans-serif; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; }
        .save-btn:hover:not(:disabled) { background: #005c12; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,69,13,0.25); }
        .save-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .toast-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: 12px; padding: 14px 18px; font-size: 14px; font-family: 'Inter', sans-serif; display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .toast-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 12px; padding: 14px 18px; font-size: 14px; font-family: 'Inter', sans-serif; display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .bin-label { font-size: 14px; font-weight: 700; color: #181c22; font-family: 'Manrope', sans-serif; }
        .waste-label { font-size: 13px; color: #41493e; font-family: 'Inter', sans-serif; }
        .tier-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; font-family: 'Manrope', sans-serif; }
        .tier-a { background: #eff6ff; color: #1d4ed8; }
        .tier-b { background: #fefce8; color: #a16207; }
      `}</style>

            <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope', margin: 0 }}>Billing Rate Matrix</h1>
                        <p style={{ fontSize: 14, color: '#717a6d', fontFamily: 'Inter', marginTop: 4 }}>
                            Set per-collection rates by bin size and waste type for Tier A and Tier B commercial customers.
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 700, color: '#717a6d', fontFamily: 'Manrope', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>EFFECTIVE FROM</label>
                            <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
                                style={{ padding: '9px 12px', border: '1.5px solid #e4e9e0', borderRadius: 10, fontSize: 14, fontFamily: 'Inter', color: '#181c22', outline: 'none', background: 'white' }} />
                        </div>
                    </div>
                </div>

                {/* Stats strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                    {[
                        { label: 'Bin sizes', value: BIN_SIZES.length.toString(), icon: 'delete', color: '#00450d' },
                        { label: 'Waste types', value: WASTE_TYPES.length.toString(), icon: 'category', color: '#1d4ed8' },
                        { label: 'Total rate combos', value: (totalCombinations * 2).toString(), icon: 'grid_4x4', color: '#7c3aed' },
                        { label: 'Active tier', value: `Tier ${activeTier}`, icon: 'star', color: '#d97706' },
                    ].map(s => (
                        <div key={s.label} style={{ background: 'white', borderRadius: 14, padding: '16px 18px', border: '1px solid rgba(0,69,13,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: s.color }}>{s.icon}</span>
                                <span style={{ fontSize: 11, color: '#717a6d', fontFamily: 'Manrope', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope' }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {message && (
                    <div className={message.type === 'success' ? 'toast-success' : 'toast-error'}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{message.type === 'success' ? 'check_circle' : 'error'}</span>
                        {message.text}
                    </div>
                )}

                {/* Tier tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#f4f6f3', borderRadius: 12, padding: 5, width: 'fit-content' }}>
                    {(['A', 'B'] as const).map(tier => (
                        <button key={tier} className={`tab-btn${activeTier === tier ? ' active' : ''}`} onClick={() => setActiveTier(tier)}>
                            <span className={`tier-badge ${tier === 'A' ? 'tier-a' : 'tier-b'}`} style={{ marginRight: 6, background: 'transparent', padding: 0, color: 'inherit' }}>Tier {tier}</span>
                            {tier === 'A' ? '— Premium' : '— Standard'}
                        </button>
                    ))}
                </div>

                {/* Description of tiers */}
                <div style={{ background: activeTier === 'A' ? '#eff6ff' : '#fefce8', borderRadius: 12, padding: '12px 18px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: activeTier === 'A' ? '#1d4ed8' : '#a16207' }}>info</span>
                    <span style={{ fontSize: 13, fontFamily: 'Inter', color: activeTier === 'A' ? '#1e40af' : '#854d0e' }}>
                        {activeTier === 'A' ? 'Tier A — Premium commercial customers. Higher volume, dedicated collection schedule. Rates reflect priority service.' : 'Tier B — Standard commercial customers. Regular collection schedule. Rates reflect standard service level.'}
                    </span>
                </div>

                {/* Rate matrix table */}
                <div className="rate-card">
                    <div style={{ padding: '18px 20px 0', borderBottom: '1px solid #f0f2ee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope', margin: 0 }}>
                            Tier {activeTier} Rates — LKR per collection
                        </h2>
                        <span className={`tier-badge ${activeTier === 'A' ? 'tier-a' : 'tier-b'}`}>{activeTier === 'A' ? 'Premium' : 'Standard'}</span>
                    </div>

                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#717a6d', fontFamily: 'Inter', fontSize: 14 }}>Loading rates…</div>
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
                                            <div className="bin-label">{bin}</div>
                                            <div style={{ fontSize: 11, color: '#a0a89b', fontFamily: 'Inter', marginTop: 2 }}>
                                                {bin === '120L' ? 'Small bin' : bin === '240L' ? 'Standard bin' : bin === '660L' ? 'Euro bin' : 'Large container'}
                                            </div>
                                        </td>
                                        {WASTE_TYPES.map(waste => {
                                            const key = rateKey(bin, waste, activeTier)
                                            return (
                                                <td key={waste}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ fontSize: 13, color: '#717a6d', fontFamily: 'Inter' }}>LKR</span>
                                                        <input
                                                            className="rate-input"
                                                            type="number"
                                                            min="0"
                                                            step="10"
                                                            value={rates[key] || ''}
                                                            onChange={e => setRates(prev => ({ ...prev, [key]: e.target.value }))}
                                                            placeholder="0"
                                                        />
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

                {/* Save footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, background: 'white', borderRadius: 16, padding: '18px 24px', border: '1px solid rgba(0,69,13,0.06)', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <span style={{ fontSize: 13, color: '#717a6d', fontFamily: 'Inter' }}>
                            {hasChanges()
                                ? '⚠ You have unsaved changes. These rates affect all future invoice generation.'
                                : 'All rates are saved and up to date.'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {hasChanges() && (
                            <button onClick={() => setRates({ ...savedRates })} style={{ background: 'transparent', border: '1.5px solid #e4e9e0', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 600, fontFamily: 'Manrope', cursor: 'pointer', color: '#41493e' }}>
                                Discard
                            </button>
                        )}
                        <button className="save-btn" onClick={handleSave} disabled={saving || !hasChanges()}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{saving ? 'hourglass_empty' : 'save'}</span>
                            {saving ? 'Saving…' : 'Save All Rates'}
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}