'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const CONTRACTOR_NAV = [
  { label: 'Home', href: '/dashboard/contractor', icon: 'dashboard' },
  { label: 'Routes', href: '/dashboard/contractor/routes', icon: 'route' },
  { label: 'Schedules', href: '/dashboard/contractor/schedules', icon: 'calendar_month' },
  { label: 'Fleet', href: '/dashboard/contractor/fleet', icon: 'local_shipping' },
  { label: 'Contracts', href: '/dashboard/contractor/contracts', icon: 'description' },
  { label: 'Breakdowns', href: '/dashboard/contractor/breakdowns', icon: 'car_crash' },
  { label: 'Incidents', href: '/dashboard/contractor/incidents', icon: 'warning' },
  { label: 'Messages', href: '/dashboard/contractor/messages', icon: 'chat' },
  { label: 'Staff', href: '/dashboard/contractor/staff', icon: 'badge' },
]

const BREAKDOWN_TYPES: Record<string, { label: string; icon: string }> = {
    flat_tire: { label: 'Flat Tire', icon: 'tire_repair' },
    engine_failure: { label: 'Engine Failure', icon: 'build' },
    battery_dead: { label: 'Battery Dead', icon: 'battery_alert' },
    accident: { label: 'Accident', icon: 'car_crash' },
    fuel_empty: { label: 'Fuel Empty', icon: 'local_gas_station' },
    other: { label: 'Other', icon: 'handyman' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; next?: string; nextLabel?: string; nextIcon?: string }> = {
    reported: { label: 'Reported', color: '#dc2626', bg: 'rgba(220,38,38,0.08)', dot: '#ef4444', next: 'assistance_sent', nextLabel: 'Send Assistance', nextIcon: 'local_shipping' },
    assistance_sent: { label: 'Assistance Sent', color: '#b45309', bg: 'rgba(180,83,9,0.08)', dot: '#f59e0b', next: 'resolved', nextLabel: 'Mark Resolved', nextIcon: 'check_circle' },
    resolved: { label: 'Resolved', color: '#15803d', bg: 'rgba(21,128,61,0.08)', dot: '#22c55e' },
}

interface Breakdown {
    id: string
    driver_id: string
    vehicle_number: string
    location_address: string
    breakdown_type: string
    description: string
    status: string
    severity: string | null
    resolution_notes: string | null
    created_at: string
    resolved_at: string | null
    driver_name?: string
}

const FILTERS = ['all', 'reported', 'assistance_sent', 'resolved'] as const
type Filter = typeof FILTERS[number]

export default function ContractorBreakdownsPage() {
    const router = useRouter()
    const [profile, setProfile] = useState<any>(null)
    const [breakdowns, setBreakdowns] = useState<Breakdown[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<Filter>('all')
    const [updating, setUpdating] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [resolutionNote, setResolutionNote] = useState('')
    const [toast, setToast] = useState('')
    const [toastType, setToastType] = useState<'success' | 'error'>('success')

    useEffect(() => { loadData() }, [])

    function showToast(msg: string, type: 'success' | 'error' = 'success') {
        setToast(msg); setToastType(type)
        setTimeout(() => setToast(''), 3500)
    }

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const { data: profileData } = await supabase
            .from('profiles').select('*').eq('id', user.id).single()
        if (!profileData || profileData.role !== 'contractor') { router.push('/login'); return }
        setProfile(profileData)

        const { data, error } = await supabase
            .from('breakdown_reports')
            .select(`
        *,
        profiles!breakdown_reports_driver_id_fkey(full_name)
      `)
            .eq('contractor_id', user.id)
            .order('created_at', { ascending: false })

        if (error) {
            // Fallback without join if FK alias fails
            const { data: fallback } = await supabase
                .from('breakdown_reports')
                .select('*')
                .eq('contractor_id', user.id)
                .order('created_at', { ascending: false })
            setBreakdowns((fallback || []).map(r => ({ ...r, driver_name: 'Driver' })))
        } else {
            setBreakdowns((data || []).map((r: any) => ({
                ...r,
                driver_name: r.profiles?.full_name || 'Driver',
            })))
        }
        setLoading(false)
    }

    async function updateStatus(breakdown: Breakdown, newStatus: string) {
        setUpdating(breakdown.id)
        const supabase = createClient()
        const patch: any = { status: newStatus }
        if (newStatus === 'resolved') {
            patch.resolved_at = new Date().toISOString()
            if (resolutionNote.trim()) patch.resolution_notes = resolutionNote.trim()
        }
        const { error } = await supabase
            .from('breakdown_reports')
            .update(patch)
            .eq('id', breakdown.id)

        if (error) {
            showToast('Failed to update: ' + error.message, 'error')
        } else {
            showToast(newStatus === 'assistance_sent' ? 'Assistance dispatched!' : 'Marked as resolved.')
            setExpandedId(null)
            setResolutionNote('')
            loadData()
        }
        setUpdating(null)
    }

    const filtered = filter === 'all' ? breakdowns : breakdowns.filter(b => b.status === filter)

    const counts = {
        all: breakdowns.length,
        reported: breakdowns.filter(b => b.status === 'reported').length,
        assistance_sent: breakdowns.filter(b => b.status === 'assistance_sent').length,
        resolved: breakdowns.filter(b => b.status === 'resolved').length,
    }

    const urgentCount = counts.reported

    return (
        <DashboardLayout role="Contractor" userName={profile?.full_name || profile?.organisation_name} navItems={CONTRACTOR_NAV}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Manrope:wght@400;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        .msf {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .filter-pill {
          border: 1.5px solid #e4ede4; border-radius: 9999px; padding: 7px 16px;
          font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 12px;
          cursor: pointer; transition: all 0.18s; color: #717a6d; background: white;
          display: flex; align-items: center; gap: 6px;
        }
        .filter-pill:hover { border-color: #b8cdb8; color: #41493e; }
        .filter-pill.active { background: #00450d; border-color: #00450d; color: white; }
        .filter-pill.active-red { background: #dc2626; border-color: #dc2626; color: white; }
        .bcard {
          background: white; border-radius: 16px; border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 1px 4px rgba(0,0,0,0.04); transition: all 0.18s;
          overflow: hidden;
        }
        .bcard:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .bcard.urgent { border-left: 3px solid #dc2626; }
        .action-btn {
          border: none; border-radius: 9px; padding: 9px 16px;
          font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 12px;
          cursor: pointer; transition: all 0.18s; display: flex; align-items: center; gap: 6px;
        }
        .action-btn.dispatch {
          background: rgba(180,83,9,0.09); color: #b45309;
          border: 1.5px solid rgba(180,83,9,0.2);
        }
        .action-btn.dispatch:hover { background: rgba(180,83,9,0.15); }
        .action-btn.resolve {
          background: rgba(0,69,13,0.08); color: #00450d;
          border: 1.5px solid rgba(0,69,13,0.2);
        }
        .action-btn.resolve:hover { background: rgba(0,69,13,0.13); }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .resolve-input {
          width: 100%; border: 1.5px solid #e4ede4; border-radius: 9px;
          padding: 10px 14px; font-size: 13px; font-family: 'Inter', sans-serif;
          outline: none; transition: border-color 0.2s; box-sizing: border-box;
          resize: none; min-height: 72px;
        }
        .resolve-input:focus { border-color: #00450d; box-shadow: 0 0 0 3px rgba(0,69,13,0.07); }
        .toast-anim { animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { transform: translateY(12px) translateX(-50%); opacity: 0; } to { transform: translateY(0) translateX(-50%); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .a1 { animation: fadeUp 0.3s ease 0.05s both; }
        .a2 { animation: fadeUp 0.3s ease 0.1s both; }
        .a3 { animation: fadeUp 0.3s ease 0.15s both; }
      `}</style>

            {toast && (
                <div className="toast-anim" style={{
                    position: 'fixed', bottom: '24px', left: '50%',
                    background: toastType === 'error' ? '#dc2626' : '#181c22',
                    color: 'white', padding: '10px 20px', borderRadius: '9999px',
                    fontSize: '13px', fontWeight: 500, zIndex: 1000,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                    <span className="msf" style={{ fontSize: '16px', color: toastType === 'error' ? '#fca5a5' : '#4ade80' }}>
                        {toastType === 'error' ? 'error' : 'check_circle'}
                    </span>
                    {toast}
                </div>
            )}

            <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>

                {/* Header */}
                <div className="a1" style={{ marginBottom: '28px' }}>
                    <p style={{ fontSize: '11px', color: '#717a6d', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 6px' }}>
                        🚨 FLEET MANAGEMENT
                    </p>
                    <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '36px', fontWeight: 800, color: '#181c22', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                        Vehicle <span style={{ color: '#00450d' }}>Breakdowns</span>
                    </h1>
                    <p style={{ fontSize: '14px', color: '#717a6d', margin: 0 }}>
                        Breakdown reports submitted by your drivers
                    </p>
                </div>

                {/* Stat row */}
                <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
                    {[
                        { label: 'Total Reports', value: counts.all, icon: 'summarize', color: '#00450d', bg: 'rgba(0,69,13,0.07)' },
                        { label: 'Needs Action', value: counts.reported, icon: 'emergency', color: '#dc2626', bg: 'rgba(220,38,38,0.07)' },
                        { label: 'In Progress', value: counts.assistance_sent, icon: 'local_shipping', color: '#b45309', bg: 'rgba(180,83,9,0.07)' },
                        { label: 'Resolved', value: counts.resolved, icon: 'check_circle', color: '#15803d', bg: 'rgba(21,128,61,0.07)' },
                    ].map(stat => (
                        <div key={stat.label} style={{
                            background: 'white', borderRadius: '16px', padding: '18px 20px',
                            border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span className="msf" style={{ fontSize: '20px', color: stat.color }}>{stat.icon}</span>
                                </div>
                                <span style={{ fontSize: '11px', color: '#717a6d', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{stat.label}</span>
                            </div>
                            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: '28px', fontWeight: 800, color: '#181c22', margin: 0 }}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Urgent banner */}
                {urgentCount > 0 && (
                    <div className="a2" style={{
                        background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)',
                        borderRadius: '14px', padding: '14px 20px', marginBottom: '20px',
                        display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                        <span className="msf" style={{ fontSize: '22px', color: '#dc2626' }}>warning</span>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626', fontFamily: 'Manrope, sans-serif', margin: 0 }}>
                            {urgentCount} breakdown{urgentCount > 1 ? 's' : ''} need{urgentCount === 1 ? 's' : ''} your response
                        </p>
                    </div>
                )}

                {/* Filters */}
                <div className="a3" style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {FILTERS.map(f => {
                        const isActive = filter === f
                        const isRed = f === 'reported' && isActive
                        return (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`filter-pill ${isActive ? (isRed ? 'active-red' : 'active') : ''}`}
                            >
                                {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label}
                                <span style={{
                                    background: isActive ? 'rgba(255,255,255,0.25)' : '#f0f4f0',
                                    color: isActive ? 'white' : '#717a6d',
                                    borderRadius: '9999px', padding: '1px 7px', fontSize: '11px', fontWeight: 700,
                                }}>{counts[f]}</span>
                            </button>
                        )
                    })}
                </div>

                {/* List */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#717a6d', fontSize: '13px' }}>
                        <div style={{ width: '28px', height: '28px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
                        Loading breakdowns...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <span className="msf" style={{ fontSize: '44px', color: '#c4c9c0', display: 'block', marginBottom: '12px' }}>car_crash</span>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#41493e', margin: '0 0 4px' }}>No breakdowns found</p>
                        <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>
                            {filter === 'all' ? 'No breakdown reports from your drivers yet.' : `No ${STATUS_CONFIG[filter]?.label.toLowerCase()} breakdowns.`}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {filtered.map(b => {
                            const bt = BREAKDOWN_TYPES[b.breakdown_type] || { label: b.breakdown_type, icon: 'car_crash' }
                            const sc = STATUS_CONFIG[b.status] || STATUS_CONFIG.reported
                            const isExpanded = expandedId === b.id
                            const isUrgent = b.status === 'reported'

                            return (
                                <div key={b.id} className={`bcard ${isUrgent ? 'urgent' : ''}`}>
                                    <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>

                                        {/* Icon */}
                                        <div style={{
                                            width: '48px', height: '48px', borderRadius: '13px', flexShrink: 0,
                                            background: isUrgent ? 'rgba(220,38,38,0.08)' : 'rgba(0,69,13,0.07)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <span className="msf" style={{ fontSize: '24px', color: isUrgent ? '#dc2626' : '#00450d' }}>
                                                {bt.icon}
                                            </span>
                                        </div>

                                        {/* Main info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '15px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                    {bt.label}
                                                </span>
                                                <span style={{
                                                    fontSize: '10px', fontWeight: 700, padding: '2px 9px', borderRadius: '9999px',
                                                    background: sc.bg, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.07em',
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                }}>
                                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                                                    {sc.label}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '12px', color: '#717a6d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span className="msf" style={{ fontSize: '13px' }}>person</span>
                                                    {b.driver_name}
                                                </span>
                                                <span style={{ fontSize: '12px', color: '#717a6d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span className="msf" style={{ fontSize: '13px' }}>directions_car</span>
                                                    {b.vehicle_number}
                                                </span>
                                                <span style={{ fontSize: '12px', color: '#717a6d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span className="msf" style={{ fontSize: '13px' }}>location_on</span>
                                                    {b.location_address}
                                                </span>
                                            </div>

                                            {b.description && (
                                                <p style={{ fontSize: '12px', color: '#717a6d', margin: '5px 0 0', fontStyle: 'italic' }}>
                                                    "{b.description}"
                                                </p>
                                            )}

                                            {b.resolution_notes && b.status === 'resolved' && (
                                                <p style={{ fontSize: '12px', color: '#15803d', margin: '5px 0 0', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                                    <span className="msf" style={{ fontSize: '13px', marginTop: '1px' }}>check_circle</span>
                                                    {b.resolution_notes}
                                                </p>
                                            )}
                                        </div>

                                        {/* Right side */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ fontSize: '13px', fontWeight: 600, color: '#41493e', margin: 0 }}>
                                                    {new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                </p>
                                                <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
                                                    {new Date(b.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>

                                            {/* Action buttons */}
                                            {sc.next && (
                                                sc.next === 'resolved' ? (
                                                    <button
                                                        className="action-btn resolve"
                                                        onClick={() => setExpandedId(isExpanded ? null : b.id)}
                                                    >
                                                        <span className="msf" style={{ fontSize: '14px' }}>expand_more</span>
                                                        Resolve
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="action-btn dispatch"
                                                        disabled={updating === b.id}
                                                        onClick={() => updateStatus(b, sc.next!)}
                                                    >
                                                        {updating === b.id ? (
                                                            <svg style={{ width: '13px', height: '13px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24">
                                                                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                            </svg>
                                                        ) : (
                                                            <span className="msf" style={{ fontSize: '14px' }}>{sc.nextIcon}</span>
                                                        )}
                                                        {sc.nextLabel}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {/* Resolve panel */}
                                    {isExpanded && (
                                        <div style={{
                                            borderTop: '1px solid rgba(0,69,13,0.08)', padding: '16px 20px',
                                            background: 'rgba(0,69,13,0.02)',
                                        }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '8px', fontFamily: 'Manrope, sans-serif' }}>
                                                Resolution Notes <span style={{ color: '#b0b8aa', fontWeight: 500 }}>· optional</span>
                                            </label>
                                            <textarea
                                                className="resolve-input"
                                                placeholder="Describe how the breakdown was resolved..."
                                                value={resolutionNote}
                                                onChange={e => setResolutionNote(e.target.value)}
                                            />
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                                <button
                                                    className="action-btn resolve"
                                                    style={{ padding: '10px 20px' }}
                                                    disabled={updating === b.id}
                                                    onClick={() => updateStatus(b, 'resolved')}
                                                >
                                                    {updating === b.id ? (
                                                        <svg style={{ width: '13px', height: '13px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24">
                                                            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                        </svg>
                                                    ) : (
                                                        <span className="msf" style={{ fontSize: '14px' }}>check_circle</span>
                                                    )}
                                                    Confirm Resolved
                                                </button>
                                                <button
                                                    style={{ background: 'none', border: 'none', fontSize: '13px', color: '#717a6d', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}
                                                    onClick={() => { setExpandedId(null); setResolutionNote('') }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>
        </DashboardLayout>
    )
}


