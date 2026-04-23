'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const DE_NAV = [
    { label: 'Home', href: '/dashboard/district-engineer', icon: 'dashboard' },
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
    { label: 'Profile', href: '/dashboard/district-engineer/profile', icon: 'person' },
]

interface ContractorCompliance {
    id: string
    name: string
    organisation: string
    totalRoutes: number
    completedRoutes: number
    totalStops: number
    completedStops: number
    skippedStops: number
    breakdowns: number
    completionRate: number
    skipRate: number
    breakdownRate: number
    score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    trend: 'up' | 'down' | 'stable'
}

function calcScore(completionRate: number, skipRate: number, breakdownRate: number): number {
    // Weighted: completion 60%, skip penalty 25%, breakdown penalty 15%
    const completionScore = completionRate * 0.6
    const skipPenalty = Math.min(skipRate * 2, 25)
    const breakdownPenalty = Math.min(breakdownRate * 3, 15)
    return Math.max(0, Math.round(completionScore + (25 - skipPenalty) + (15 - breakdownPenalty)))
}

function scoreGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 85) return 'A'
    if (score >= 70) return 'B'
    if (score >= 55) return 'C'
    if (score >= 40) return 'D'
    return 'F'
}

const GRADE_STYLE: Record<string, { color: string; bg: string }> = {
    A: { color: '#00450d', bg: '#f0fdf4' },
    B: { color: '#1d4ed8', bg: '#eff6ff' },
    C: { color: '#d97706', bg: '#fefce8' },
    D: { color: '#ea580c', bg: '#fff7ed' },
    F: { color: '#ba1a1a', bg: '#fef2f2' },
}

export default function ContractorCompliancePage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [contractors, setContractors] = useState<ContractorCompliance[]>([])
    const [sortBy, setSortBy] = useState<'score' | 'completion' | 'name'>('score')
    const [selectedPeriod, setSelectedPeriod] = useState<'30' | '90' | 'all'>('30')

    useEffect(() => { loadData() }, [selectedPeriod])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Date filter
        let dateFilter = ''
        if (selectedPeriod !== 'all') {
            const cutoff = new Date()
            cutoff.setDate(cutoff.getDate() - parseInt(selectedPeriod))
            dateFilter = cutoff.toISOString()
        }

        // Get contractors
        const { data: contractorProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, organisation_name')
            .eq('role', 'contractor')

        // Get routes for this district
        let routeQuery = supabase
            .from('routes')
            .select('id, contractor_id, status')
            .eq('district', p?.district || '')
            .not('contractor_id', 'is', null)
        if (dateFilter) routeQuery = routeQuery.gte('created_at', dateFilter)
        const { data: routes } = await routeQuery

        // Get all stops for those routes
        const routeIds = (routes || []).map(r => r.id)
        let stops: any[] = []
        if (routeIds.length > 0) {
            const { data: stopsData } = await supabase
                .from('collection_stops')
                .select('route_id, status, skip_reason')
                .in('route_id', routeIds)
            stops = stopsData || []
        }

        // Get exception alerts (breakdowns) per contractor
        let alertQuery = supabase
            .from('exception_alerts')
            .select('route_id, alert_type')
            .eq('alert_type', 'breakdown')
        if (dateFilter) alertQuery = alertQuery.gte('created_at', dateFilter)
        const { data: alerts } = await alertQuery

        // Build a route → contractor_id map
        const routeContractorMap: Record<string, string> = {}
        for (const r of routes || []) {
            if (r.contractor_id) routeContractorMap[r.id] = r.contractor_id
        }

        // Compute stats per contractor
        const stats: ContractorCompliance[] = (contractorProfiles || []).map(c => {
            const cRoutes = (routes || []).filter(r => r.contractor_id === c.id)
            const cRouteIds = cRoutes.map(r => r.id)
            const cStops = stops.filter(s => cRouteIds.includes(s.route_id))
            const cAlerts = (alerts || []).filter(a => cRouteIds.includes(a.route_id))

            const totalRoutes = cRoutes.length
            const completedRoutes = cRoutes.filter(r => r.status === 'completed').length
            const totalStops = cStops.length
            const completedStops = cStops.filter(s => s.status === 'completed').length
            const skippedStops = cStops.filter(s => s.status === 'skipped').length
            const breakdowns = cAlerts.length

            const completionRate = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0
            const skipRate = totalStops > 0 ? Math.round((skippedStops / totalStops) * 100) : 0
            const breakdownRate = totalRoutes > 0 ? Math.round((breakdowns / totalRoutes) * 100) : 0

            const score = calcScore(completionRate, skipRate, breakdownRate)
            const grade = scoreGrade(score)

            return {
                id: c.id,
                name: c.full_name,
                organisation: c.organisation_name || c.full_name,
                totalRoutes,
                completedRoutes,
                totalStops,
                completedStops,
                skippedStops,
                breakdowns,
                completionRate,
                skipRate,
                breakdownRate,
                score,
                grade,
                trend: score >= 70 ? 'up' : score >= 50 ? 'stable' : 'down',
            }
        }).filter(c => c.totalRoutes > 0) as ContractorCompliance[]

        const sorted = stats.sort((a, b) => b.score - a.score)
        setContractors(sorted)
        setLoading(false)
    }

    const sorted = [...contractors].sort((a, b) => {
        if (sortBy === 'completion') return b.completionRate - a.completionRate
        if (sortBy === 'name') return a.organisation.localeCompare(b.organisation)
        return b.score - a.score
    })

    const avgScore = contractors.length > 0 ? Math.round(contractors.reduce((s, c) => s + c.score, 0) / contractors.length) : 0

    return (
        <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}>
            <style>{`
                .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
                .font-headline { font-family:'Manrope',sans-serif; }
                .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
                .badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.08em; text-transform:uppercase; white-space:nowrap; }
                .period-btn { padding:6px 14px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
                .period-btn.active { background:#00450d; color:white; }
                .period-btn:not(.active) { background:#f1f5f9; color:#64748b; }
                .score-ring { width:56px; height:56px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; position:relative; }
                .contractor-row { padding:20px 24px; border-bottom:1px solid rgba(0,69,13,0.04); transition:background 0.15s; }
                .contractor-row:hover { background:#f9fdf9; }
                .contractor-row:last-child { border-bottom:none; }
                .metric-bar { height:5px; background:#f1f5f9; border-radius:99px; overflow:hidden; margin-top:4px; }
                .metric-fill { height:100%; border-radius:99px; }
                @keyframes staggerIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
                .s1{animation:staggerIn 0.5s ease 0.05s both}
                .s2{animation:staggerIn 0.5s ease 0.10s both}
                .s3{animation:staggerIn 0.5s ease 0.15s both}
            `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2" style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif' }}>
                    District Engineering · Contractor Management
                </span>
                <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    Compliance <span style={{ color: '#1b5e20' }}>Scores</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                    {profile?.district} · Route completion · Skip rates · Breakdown frequency
                </p>
            </section>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6 s2">
                {[
                    { label: 'Contractors Tracked', value: contractors.length, icon: 'business', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Average Score', value: `${avgScore}/100`, icon: 'verified', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'Grade A Contractors', value: contractors.filter(c => c.grade === 'A').length, icon: 'star', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'At Risk (D/F)', value: contractors.filter(c => c.grade === 'D' || c.grade === 'F').length, icon: 'warning', color: '#ba1a1a', bg: '#fef2f2' },
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

            {/* Score methodology note */}
            <div className="mb-6 p-4 rounded-xl s2" style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.12)' }}>
                <p className="text-xs" style={{ color: '#00450d' }}>
                    <strong>Score methodology:</strong> Stop completion rate (60%) + skip penalty (25%) + breakdown penalty (15%). Max 100 points.
                    Grade A ≥85 · B ≥70 · C ≥55 · D ≥40 · F &lt;40
                </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 s3">
                <div className="flex gap-2">
                    {(['30', '90', 'all'] as const).map(p => (
                        <button key={p} onClick={() => setSelectedPeriod(p)}
                            className={`period-btn ${selectedPeriod === p ? 'active' : ''}`}>
                            {p === 'all' ? 'All Time' : `Last ${p} days`}
                        </button>
                    ))}
                </div>
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', fontFamily: 'Manrope,sans-serif', background: 'white', cursor: 'pointer' }}>
                    <option value="score">Sort: Score</option>
                    <option value="completion">Sort: Completion Rate</option>
                    <option value="name">Sort: Name</option>
                </select>
            </div>

            {/* Contractor list */}
            <div className="bento-card s3">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '48px', display: 'block', marginBottom: '12px' }}>verified</span>
                        <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No contractor data</p>
                        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                            Compliance scores appear once contractors have active routes in {profile?.district}.
                        </p>
                    </div>
                ) : sorted.map((c, i) => {
                    const gs = GRADE_STYLE[c.grade]
                    return (
                        <div key={c.id} className="contractor-row">
                            <div className="flex items-start gap-4">
                                {/* Rank + Score ring */}
                                <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '48px' }}>
                                    <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700 }}>#{i + 1}</p>
                                    <div className="score-ring" style={{ background: gs.bg, margin: '4px auto 0' }}>
                                        <span style={{ fontSize: '18px', fontWeight: 700, color: gs.color, fontFamily: 'Manrope,sans-serif' }}>{c.grade}</span>
                                    </div>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: gs.color, fontFamily: 'Manrope,sans-serif', marginTop: '2px' }}>{c.score}</p>
                                </div>

                                {/* Main */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <p className="font-headline font-bold text-sm" style={{ color: '#181c22' }}>{c.organisation}</p>
                                        <span className="badge" style={{ background: gs.bg, color: gs.color }}>Grade {c.grade}</span>
                                        {c.trend === 'up' && <span className="badge" style={{ background: '#f0fdf4', color: '#00450d' }}>↑ Good</span>}
                                        {c.trend === 'down' && <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>↓ At Risk</span>}
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        {/* Completion rate */}
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <p style={{ fontSize: '11px', color: '#717a6d' }}>Completion</p>
                                                <p style={{ fontSize: '11px', fontWeight: 700, color: '#00450d' }}>{c.completionRate}%</p>
                                            </div>
                                            <div className="metric-bar">
                                                <div className="metric-fill" style={{ width: `${c.completionRate}%`, background: c.completionRate >= 80 ? '#00450d' : c.completionRate >= 60 ? '#d97706' : '#ba1a1a' }} />
                                            </div>
                                            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>{c.completedStops}/{c.totalStops} stops</p>
                                        </div>

                                        {/* Skip rate */}
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <p style={{ fontSize: '11px', color: '#717a6d' }}>Skip Rate</p>
                                                <p style={{ fontSize: '11px', fontWeight: 700, color: c.skipRate > 15 ? '#ba1a1a' : c.skipRate > 5 ? '#d97706' : '#00450d' }}>{c.skipRate}%</p>
                                            </div>
                                            <div className="metric-bar">
                                                <div className="metric-fill" style={{ width: `${Math.min(c.skipRate * 5, 100)}%`, background: c.skipRate > 15 ? '#ba1a1a' : c.skipRate > 5 ? '#d97706' : '#00450d' }} />
                                            </div>
                                            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>{c.skippedStops} skipped</p>
                                        </div>

                                        {/* Breakdowns */}
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <p style={{ fontSize: '11px', color: '#717a6d' }}>Breakdowns</p>
                                                <p style={{ fontSize: '11px', fontWeight: 700, color: c.breakdowns > 3 ? '#ba1a1a' : c.breakdowns > 0 ? '#d97706' : '#00450d' }}>{c.breakdowns}</p>
                                            </div>
                                            <div className="metric-bar">
                                                <div className="metric-fill" style={{ width: `${Math.min(c.breakdowns * 10, 100)}%`, background: c.breakdowns > 3 ? '#ba1a1a' : c.breakdowns > 0 ? '#d97706' : '#f1f5f9' }} />
                                            </div>
                                            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>{c.totalRoutes} routes total</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </DashboardLayout>
    )
}