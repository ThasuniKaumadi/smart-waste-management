'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface ReportRoute {
    id: string
    route_name: string
    ward: string
    shift: string
    status: string
    driver_name: string | null
    vehicle_number: string
    total_stops: number
    completed_stops: number
    skipped_stops: number
    completion_pct: number
    alert_count: number
}

export default function ShiftReportPage() {
    const [profile, setProfile] = useState<any>(null)
    const [routes, setRoutes] = useState<ReportRoute[]>([])
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)

    useEffect(() => { loadData() }, [date])

    async function loadData() {
        setLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const wards: string[] = p?.assigned_wards || []

        let q = supabase
            .from('routes')
            .select(`
        id, route_name, ward, shift, status, vehicle_number,
        profiles:driver_id(full_name),
        collection_stops(id, status),
        exception_alerts(id, is_resolved)
      `)
            .eq('district', p?.district || '')
            .eq('date', date)
            .order('shift', { ascending: true })
            .order('route_name', { ascending: true })

        if (wards.length > 0) q = q.in('ward', wards)
        const { data } = await q

        const mapped: ReportRoute[] = (data || []).map((r: any) => {
            const stops = r.collection_stops || []
            const done = stops.filter((s: any) => s.status === 'completed').length
            const skipped = stops.filter((s: any) => s.status === 'skipped').length
            const alerts = (r.exception_alerts || []).length
            return {
                id: r.id,
                route_name: r.route_name,
                ward: r.ward,
                shift: r.shift || 'day',
                status: r.status,
                driver_name: r.profiles?.full_name || null,
                vehicle_number: r.vehicle_number || '—',
                total_stops: stops.length,
                completed_stops: done,
                skipped_stops: skipped,
                completion_pct: stops.length > 0 ? Math.round((done / stops.length) * 100) : 0,
                alert_count: alerts,
            }
        })

        setRoutes(mapped)
        setLoading(false)
    }

    function handlePrint() {
        setGenerating(true)
        setTimeout(() => {
            window.print()
            setGenerating(false)
        }, 300)
    }

    const dayRoutes = routes.filter(r => r.shift === 'day' || !r.shift)
    const nightRoutes = routes.filter(r => r.shift === 'night')
    const totalCompleted = routes.reduce((s, r) => s + r.completed_stops, 0)
    const totalStops = routes.reduce((s, r) => s + r.total_stops, 0)
    const totalSkipped = routes.reduce((s, r) => s + r.skipped_stops, 0)
    const totalAlerts = routes.reduce((s, r) => s + r.alert_count, 0)
    const overallPct = totalStops > 0 ? Math.round((totalCompleted / totalStops) * 100) : 0
    const activeCount = routes.filter(r => r.status === 'active').length
    const completedCount = routes.filter(r => r.status === 'completed').length

    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Manrope:wght@400;600;700;800&display=swap');

        * { box-sizing: border-box; }
        body { margin: 0; background: #f4f6f3; font-family: 'Inter', sans-serif; }

        .screen-controls {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: white; border-bottom: 1px solid rgba(0,69,13,0.1);
          padding: 12px 32px; display: flex; align-items: center;
          justify-content: space-between; gap: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .report-wrapper {
          max-width: 900px; margin: 0 auto; padding: 96px 32px 48px;
        }
        .report-page {
          background: white; border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.1);
          padding: 48px; position: relative; overflow: hidden;
        }
        .report-page::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px;
          background: linear-gradient(90deg, #00450d, #1b5e20);
        }
        .stat-grid {
          display: grid; grid-template-columns: repeat(5, 1fr);
          gap: 12px; margin: 24px 0;
        }
        .stat-box {
          background: #f8fafc; border-radius: 12px; padding: 14px;
          border: 1px solid rgba(0,69,13,0.06);
        }
        .route-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .route-table th {
          text-align: left; font-size: 10px; font-weight: 700;
          color: #717a6d; text-transform: uppercase; letter-spacing: 0.1em;
          padding: 8px 10px; background: #f8fafc;
          border-bottom: 2px solid rgba(0,69,13,0.08);
          font-family: 'Manrope', sans-serif;
        }
        .route-table td {
          padding: 10px 10px; font-size: 12px; color: #41493e;
          border-bottom: 1px solid rgba(0,69,13,0.04);
          vertical-align: middle;
        }
        .route-table tr:last-child td { border-bottom: none; }
        .route-table tr:hover td { background: #f9fdf9; }
        .section-header {
          display: flex; align-items: center; gap: 10px;
          margin: 28px 0 12px; padding-bottom: 8px;
          border-bottom: 1.5px solid rgba(0,69,13,0.1);
        }
        .badge {
          display: inline-flex; align-items: center; padding: 2px 8px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .progress-bar-bg {
          height: 5px; background: #f0fdf4; border-radius: 99px;
          overflow: hidden; width: 60px; display: inline-block;
          vertical-align: middle;
        }
        .progress-bar-fill { height: 100%; border-radius: 99px; }
        .print-btn {
          background: #00450d; color: white; border: none;
          border-radius: 10px; padding: 9px 20px;
          font-family: 'Manrope', sans-serif; font-weight: 700;
          font-size: 13px; cursor: pointer; display: flex;
          align-items: center; gap: 8px; transition: background 0.2s;
        }
        .print-btn:hover { background: #1b5e20; }
        .print-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .date-input {
          border: 1.5px solid rgba(0,69,13,0.15); border-radius: 8px;
          padding: 7px 12px; font-size: 13px; font-family: 'Inter', sans-serif;
          outline: none; color: #181c22;
        }
        .date-input:focus { border-color: #00450d; }
        .back-btn {
          background: white; border: 1.5px solid rgba(0,69,13,0.15);
          border-radius: 10px; padding: 8px 16px; font-family: 'Manrope', sans-serif;
          font-weight: 700; font-size: 13px; color: #00450d; cursor: pointer;
          display: flex; align-items: center; gap: 6px; text-decoration: none;
        }

        @media print {
          .screen-controls { display: none !important; }
          .report-wrapper { padding: 0; max-width: 100%; }
          body { background: white; }
          .report-page {
            border-radius: 0; box-shadow: none; padding: 32px;
          }
          .route-table tr { page-break-inside: avoid; }
          .section-header { page-break-after: avoid; }
        }
      `}</style>

            {/* Screen-only controls */}
            <div className="screen-controls">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <a href="/dashboard/supervisor/routes" className="back-btn">
                        ← Back
                    </a>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#717a6d' }}>Report date:</span>
                        <input
                            type="date"
                            className="date-input"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                    </div>
                </div>
                <button className="print-btn" onClick={handlePrint} disabled={generating || loading}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    {generating ? 'Preparing...' : 'Save as PDF'}
                </button>
            </div>

            <div className="report-wrapper">
                <div className="report-page">

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#00450d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ color: 'white', fontSize: '18px', fontFamily: 'Material Symbols Outlined, sans-serif' }}>eco</span>
                                </div>
                                <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#00450d' }}>EcoLedger</span>
                            </div>
                            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '28px', color: '#181c22', margin: '0 0 4px' }}>
                                Daily Shift Report
                            </h1>
                            <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>{formattedDate}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '12px', color: '#717a6d', margin: '0 0 2px' }}>Supervisor</p>
                            <p style={{ fontSize: '14px', fontWeight: 600, color: '#181c22', margin: '0 0 2px', fontFamily: 'Manrope, sans-serif' }}>{profile?.full_name}</p>
                            <p style={{ fontSize: '12px', color: '#717a6d', margin: '0 0 2px' }}>{profile?.district}</p>
                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                                Wards: {(profile?.assigned_wards || []).join(', ') || 'All'}
                            </p>
                            <p style={{ fontSize: '10px', color: '#94a3b8', margin: '4px 0 0' }}>
                                Generated: {new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>

                    <div style={{ height: '1px', background: 'rgba(0,69,13,0.08)', margin: '20px 0' }} />

                    {/* Summary stats */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' }}>Loading report data...</div>
                    ) : routes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px', background: '#f8fafc', borderRadius: '12px' }}>
                            <p style={{ fontSize: '15px', fontWeight: 600, color: '#41493e', margin: '0 0 6px', fontFamily: 'Manrope, sans-serif' }}>No routes found for this date</p>
                            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>Try selecting a different date above.</p>
                        </div>
                    ) : (
                        <>
                            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '15px', color: '#181c22', margin: '0 0 4px' }}>Executive Summary</h2>
                            <div className="stat-grid">
                                {[
                                    { label: 'Total Routes', value: routes.length },
                                    { label: 'Completed', value: completedCount },
                                    { label: 'Active', value: activeCount },
                                    { label: 'Overall Rate', value: `${overallPct}%` },
                                    { label: 'Alerts Raised', value: totalAlerts },
                                ].map(s => (
                                    <div key={s.label} className="stat-box">
                                        <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '22px', color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{s.value}</p>
                                        <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                                <div className="stat-box">
                                    <p style={{ fontSize: '11px', color: '#717a6d', margin: '0 0 4px' }}>Stops completed</p>
                                    <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#00450d', margin: 0 }}>{totalCompleted} / {totalStops}</p>
                                </div>
                                <div className="stat-box">
                                    <p style={{ fontSize: '11px', color: '#717a6d', margin: '0 0 4px' }}>Stops skipped</p>
                                    <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: totalSkipped > 0 ? '#dc2626' : '#00450d', margin: 0 }}>{totalSkipped}</p>
                                </div>
                                <div className="stat-box">
                                    <p style={{ fontSize: '11px', color: '#717a6d', margin: '0 0 4px' }}>Completion rate</p>
                                    <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: overallPct >= 80 ? '#00450d' : overallPct >= 60 ? '#d97706' : '#dc2626', margin: 0 }}>{overallPct}%</p>
                                </div>
                            </div>

                            {/* Day shift */}
                            {dayRoutes.length > 0 && (
                                <>
                                    <div className="section-header">
                                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ fontSize: '14px' }}>☀️</span>
                                        </div>
                                        <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', color: '#181c22', margin: 0 }}>
                                            Morning / Day Shift
                                        </h3>
                                        <span className="badge" style={{ background: '#fefce8', color: '#d97706' }}>{dayRoutes.length} routes</span>
                                    </div>
                                    <RouteTable routes={dayRoutes} />
                                </>
                            )}

                            {/* Night shift */}
                            {nightRoutes.length > 0 && (
                                <>
                                    <div className="section-header" style={{ marginTop: '28px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ fontSize: '14px' }}>🌙</span>
                                        </div>
                                        <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', color: '#181c22', margin: 0 }}>
                                            Evening / Night Shift
                                        </h3>
                                        <span className="badge" style={{ background: '#eef2ff', color: '#4338ca' }}>{nightRoutes.length} routes</span>
                                    </div>
                                    <RouteTable routes={nightRoutes} />
                                </>
                            )}

                            {/* Alerts section */}
                            {totalAlerts > 0 && (
                                <>
                                    <div className="section-header" style={{ marginTop: '28px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ fontSize: '14px' }}>⚠️</span>
                                        </div>
                                        <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', color: '#ba1a1a', margin: 0 }}>
                                            Exception Alerts
                                        </h3>
                                        <span className="badge" style={{ background: '#fef2f2', color: '#dc2626' }}>{totalAlerts} alert{totalAlerts !== 1 ? 's' : ''}</span>
                                    </div>
                                    <table className="route-table">
                                        <thead>
                                            <tr>
                                                <th>Route</th>
                                                <th>Ward</th>
                                                <th>Alerts</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {routes.filter(r => r.alert_count > 0).map(r => (
                                                <tr key={r.id}>
                                                    <td style={{ fontWeight: 600 }}>{r.route_name}</td>
                                                    <td>{r.ward}</td>
                                                    <td>
                                                        <span className="badge" style={{ background: '#fef2f2', color: '#dc2626' }}>
                                                            {r.alert_count} alert{r.alert_count !== 1 ? 's' : ''}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </>
                            )}

                            {/* Footer */}
                            <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: '1px solid rgba(0,69,13,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>
                                    EcoLedger Smart Waste Management · Colombo Municipal Council · Generated automatically
                                </p>
                                <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>
                                    {profile?.district} · {formattedDate}
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}

function RouteTable({ routes }: { routes: ReportRoute[] }) {
    return (
        <table className="route-table">
            <thead>
                <tr>
                    <th>Route</th>
                    <th>Ward</th>
                    <th>Driver</th>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th>Stops</th>
                    <th>Skipped</th>
                    <th>Rate</th>
                </tr>
            </thead>
            <tbody>
                {routes.map(r => {
                    const pColor = r.completion_pct >= 85 ? '#00450d' : r.completion_pct >= 60 ? '#d97706' : '#dc2626'
                    const statusColor = r.status === 'completed' ? '#00450d' : r.status === 'active' ? '#1d4ed8' : '#d97706'
                    const statusBg = r.status === 'completed' ? '#f0fdf4' : r.status === 'active' ? '#eff6ff' : '#fefce8'
                    return (
                        <tr key={r.id}>
                            <td style={{ fontWeight: 600, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{r.route_name}</td>
                            <td>{r.ward || '—'}</td>
                            <td>{r.driver_name || <span style={{ color: '#94a3b8' }}>Unassigned</span>}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{r.vehicle_number}</td>
                            <td>
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '99px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: statusBg, color: statusColor, fontFamily: 'Manrope, sans-serif' }}>
                                    {r.status}
                                </span>
                            </td>
                            <td style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                                {r.completed_stops}/{r.total_stops}
                            </td>
                            <td style={{ color: r.skipped_stops > 0 ? '#dc2626' : '#94a3b8', fontWeight: r.skipped_stops > 0 ? 600 : 400 }}>
                                {r.skipped_stops}
                            </td>
                            <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div className="progress-bar-bg">
                                        <div className="progress-bar-fill" style={{ width: `${r.completion_pct}%`, background: pColor }} />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: pColor, fontFamily: 'Manrope, sans-serif' }}>{r.completion_pct}%</span>
                                </div>
                            </td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}