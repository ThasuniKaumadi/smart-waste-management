'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'

const INTAKE_NAV = [
    { label: 'Overview', href: '/dashboard/intake', icon: 'dashboard' },
    { label: 'New Intake', href: '/dashboard/intake/log', icon: 'add_circle' },
    { label: 'History', href: '/dashboard/intake/history', icon: 'history' },
]

export default function IntakeDashboardPage() {
    const router = useRouter()
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [scheduledRoutes, setScheduledRoutes] = useState<any[]>([])
    const [stats, setStats] = useState({
        totalIntakes: 0,
        totalWeight: 0,
        pendingPayments: 0,
        rejectedCount: 0,
        awaitingIntake: 0,
    })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        // Get today's routes for this district
        const today = new Date().toISOString().split('T')[0]
        const { data: routes } = await supabase
            .from('routes')
            .select(`
        *,
        driver:driver_id(full_name, phone)
      `)
            .eq('district', p?.district)
            .gte('date', today)
            .order('date', { ascending: true })
            .limit(20)

        // For each route, check if a handoff exists
        const routesWithHandoffs = await Promise.all(
            (routes || []).map(async (route) => {
                const { data: handoff } = await supabase
                    .from('route_handoffs')
                    .select('*')
                    .eq('route_id', route.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                const { data: intakeLog } = await supabase
                    .from('waste_intake_logs')
                    .select('id')
                    .eq('route_id', route.id)
                    .limit(1)
                    .single()

                return {
                    ...route,
                    handoff: handoff || null,
                    intake_done: !!intakeLog,
                }
            })
        )

        setScheduledRoutes(routesWithHandoffs)

        // Stats
        const { data: intakes } = await supabase
            .from('waste_intake_logs')
            .select('*')
            .eq('operator_id', user.id)

        const logs = intakes || []
        const totalWeight = logs.reduce((sum, l) => sum + (l.actual_quantity || 0), 0)
        const pendingPayments = logs.filter(l => l.payment_status === 'pending').length
        const rejectedCount = logs.filter(l => l.is_rejected).length
        const awaitingIntake = routesWithHandoffs.filter(r =>
            r.handoff && r.handoff.status === 'pending' && !r.intake_done
        ).length

        setStats({ totalIntakes: logs.length, totalWeight, pendingPayments, rejectedCount, awaitingIntake })
        setLoading(false)
    }

    function getRouteStatus(route: any) {
        if (route.intake_done) return { label: 'Intake Done', color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' }
        if (route.handoff && route.handoff.status === 'pending') return { label: 'Awaiting Intake', color: '#d97706', bg: '#fefce8', icon: 'local_shipping' }
        if (route.handoff && route.handoff.status === 'rejected') return { label: 'Rejected', color: '#ba1a1a', bg: '#fef2f2', icon: 'cancel' }
        if (route.status === 'active') return { label: 'En Route', color: '#0050d7', bg: '#eff6ff', icon: 'directions_car' }
        return { label: 'Scheduled', color: '#64748b', bg: '#f8fafc', icon: 'schedule' }
    }

    const isRecycler = profile?.role === 'recycling_partner'

    return (
        <DashboardLayout
            role={isRecycler ? 'Recycling Partner' : 'Facility Operator'}
            userName={profile?.full_name || ''}
            navItems={INTAKE_NAV}
            primaryAction={{ label: 'New Intake', href: '/dashboard/intake/log', icon: 'add' }}
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
          border: 1px solid rgba(0,69,13,0.04);
          transition: all 0.4s cubic-bezier(0.05,0.7,0.1,1.0); overflow: hidden;
        }
        .bento-card:hover { transform: translateY(-4px); box-shadow: 0 20px 50px -15px rgba(24,28,34,0.12); }
        .bento-card-green {
          background: #00450d; border-radius: 16px; color: white;
          overflow: hidden; position: relative;
        }
        .route-row {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(0,69,13,0.04);
          transition: background 0.2s ease;
          display: flex; align-items: center; gap: 16px;
        }
        .route-row:hover { background: #f9f9ff; }
        .route-row:last-child { border-bottom: none; }
        .status-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 12px; border-radius: 99px;
          font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif;
          letter-spacing: 0.08em; text-transform: uppercase;
          white-space: nowrap; flex-shrink: 0;
        }
        .intake-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 99px;
          background: #00450d; color: white; border: none;
          font-family: 'Manrope', sans-serif; font-weight: 700;
          font-size: 12px; cursor: pointer;
          transition: all 0.2s ease; white-space: nowrap; flex-shrink: 0;
          text-decoration: none;
        }
        .intake-btn:hover { background: #1b5e20; box-shadow: 0 4px 12px rgba(0,69,13,0.25); transform: translateY(-1px); }
        .manual-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 99px;
          background: white; color: #00450d;
          border: 1.5px solid rgba(0,69,13,0.2);
          font-family: 'Manrope', sans-serif; font-weight: 700;
          font-size: 12px; cursor: pointer;
          transition: all 0.2s ease; white-space: nowrap; flex-shrink: 0;
          text-decoration: none;
        }
        .manual-btn:hover { background: #f0fdf4; }
        @keyframes staggerIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.2s both; }
      `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    {isRecycler ? 'Recycling Partner Console' : 'Facility Operations Console'} · ClearPath
                </span>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <h1 className="font-headline font-extrabold tracking-tight"
                        style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                        Waste <span style={{ color: '#1b5e20' }}>Intake Hub</span>
                    </h1>
                    <div className="flex items-center gap-3">
                        {stats.awaitingIntake > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl animate-pulse"
                                style={{ background: '#fefce8' }}>
                                <span className="w-2 h-2 rounded-full" style={{ background: '#d97706' }} />
                                <span className="text-sm font-bold" style={{ color: '#92400e', fontFamily: 'Manrope, sans-serif' }}>
                                    {stats.awaitingIntake} Awaiting Intake
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                            style={{ background: '#f0fdf4' }}>
                            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#16a34a' }} />
                            <span className="text-sm font-medium" style={{ color: '#14532d', fontFamily: 'Inter, sans-serif' }}>
                                {profile?.district || 'CMC District'}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
                        {[
                            { label: 'Awaiting Intake', value: stats.awaitingIntake, icon: 'local_shipping', color: '#d97706', bg: '#fefce8' },
                            { label: 'Total Intakes', value: stats.totalIntakes, icon: 'inventory', color: '#00450d', bg: '#f0fdf4' },
                            { label: 'Total Weight', value: `${stats.totalWeight}kg`, icon: 'scale', color: '#1b5e20', bg: '#f0fdf4' },
                            { label: isRecycler ? 'Pending Payments' : 'Rejections', value: isRecycler ? stats.pendingPayments : stats.rejectedCount, icon: isRecycler ? 'payments' : 'cancel', color: '#ba1a1a', bg: '#fef2f2' },
                        ].map(m => (
                            <div key={m.label} className="bento-card p-6">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                                    style={{ background: m.bg }}>
                                    <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '20px' }}>{m.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-3xl tracking-tight mb-1" style={{ color: '#181c22' }}>{m.value}</p>
                                <p className="text-xs font-bold uppercase" style={{ letterSpacing: '0.12em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>{m.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Scheduled arrivals */}
                    <div className="bento-card s3">
                        <div className="px-6 py-5 flex items-center justify-between"
                            style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                            <div>
                                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                    Scheduled Arrivals
                                </h3>
                                <p className="text-xs mt-0.5" style={{ color: '#717a6d' }}>
                                    Routes scheduled for your district — click Log Intake when waste arrives
                                </p>
                            </div>
                            <Link href="/dashboard/intake/log" className="manual-btn">
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>pin</span>
                                Enter Code Manually
                            </Link>
                        </div>

                        {scheduledRoutes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>
                                        calendar_month
                                    </span>
                                </div>
                                <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>
                                    No scheduled arrivals
                                </p>
                                <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
                                    No routes are scheduled for your district today
                                </p>
                                <Link href="/dashboard/intake/log" className="intake-btn">
                                    Enter Handoff Code Manually
                                </Link>
                            </div>
                        ) : (
                            <div>
                                {scheduledRoutes.map(route => {
                                    const status = getRouteStatus(route)
                                    return (
                                        <div key={route.id} className="route-row">

                                            {/* Status icon */}
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: status.bg }}>
                                                <span className="material-symbols-outlined"
                                                    style={{ color: status.color, fontSize: '20px' }}>{status.icon}</span>
                                            </div>

                                            {/* Route details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <p className="text-sm font-bold" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                                                        {route.route_name}
                                                    </p>
                                                    <span className="status-badge"
                                                        style={{ background: status.bg, color: status.color }}>
                                                        {status.label}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: '#94a3b8' }}>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>person</span>
                                                        {route.driver?.full_name || 'Unassigned'}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>local_shipping</span>
                                                        {route.vehicle_number || '—'}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>delete_sweep</span>
                                                        {route.waste_type || 'General'}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>
                                                        {new Date(route.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action button */}
                                            <div className="flex-shrink-0">
                                                {route.intake_done ? (
                                                    <Link href="/dashboard/intake/history" className="manual-btn">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>history</span>
                                                        View Log
                                                    </Link>
                                                ) : route.handoff && route.handoff.status === 'pending' ? (
                                                    <Link
                                                        href={`/dashboard/intake/log?handoff=${route.handoff.handoff_code}`}
                                                        className="intake-btn">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                                            add_circle
                                                        </span>
                                                        Log Intake
                                                    </Link>
                                                ) : (
                                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>
                                                        Awaiting dispatch
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Recent history link */}
                    <div className="mt-6 p-5 rounded-2xl flex items-center justify-between s4"
                        style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.08)' }}>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '22px' }}>
                                history
                            </span>
                            <div>
                                <p className="text-sm font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                                    {stats.totalIntakes} total intake records
                                </p>
                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                    View your complete intake history and payment records
                                </p>
                            </div>
                        </div>
                        <Link href="/dashboard/intake/history"
                            className="px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90 whitespace-nowrap"
                            style={{ background: '#00450d', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                            View History
                        </Link>
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}