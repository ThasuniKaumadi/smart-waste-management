'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const REPORT_TYPES: Record<string, { label: string; icon: string; color: string }> = {
    illegal_dumping: { label: 'Illegal Dumping', icon: 'delete_forever', color: '#ef4444' },
    missed_collection: { label: 'Missed Collection', icon: 'delete', color: '#f97316' },
    blocked_drainage: { label: 'Blocked Drainage', icon: 'water_damage', color: '#3b82f6' },
    overflowing_bin: { label: 'Overflowing Bin', icon: 'delete_sweep', color: '#eab308' },
    other: { label: 'Other', icon: 'report', color: '#8b5cf6' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    pending: { label: 'Pending', color: '#b45309', bg: 'rgba(180,83,9,0.08)', dot: '#f59e0b' },
    assigned: { label: 'Assigned', color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)', dot: '#3b82f6' },
    resolved: { label: 'Resolved', color: '#15803d', bg: 'rgba(21,128,61,0.08)', dot: '#22c55e' },
}

interface WasteReport {
    id: string
    submitted_by: string
    report_type: string
    description: string
    location_address: string
    latitude: number | null
    longitude: number | null
    photo_url: string | null
    status: string
    district: string
    assigned_to: string | null
    resolution_notes: string | null
    created_at: string
    reporter_name?: string
}

type ViewMode = 'assigned' | 'all'

export default function SupervisorWasteReportsPage() {
    const router = useRouter()
    const [reports, setReports] = useState<WasteReport[]>([])
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<any>(null)
    const [filterStatus, setFilterStatus] = useState('all')
    const [viewMode, setViewMode] = useState<ViewMode>('assigned')
    const [selectedReport, setSelectedReport] = useState<WasteReport | null>(null)
    const [resolutionNotes, setResolutionNotes] = useState('')
    const [updating, setUpdating] = useState(false)
    const [toast, setToast] = useState('')

    useEffect(() => { loadData() }, [viewMode])

    function showToast(msg: string) {
        setToast(msg)
        setTimeout(() => setToast(''), 3000)
    }

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (!prof || prof.role !== 'supervisor') {
            router.push('/login'); return
        }
        setProfile(prof)

        let query = supabase
            .from('waste_reports')
            .select('*, profiles!submitted_by(full_name)')
            .eq('district', prof.district || '')
            .order('created_at', { ascending: false })

        // In assigned mode, show only reports assigned to this supervisor
        if (viewMode === 'assigned') {
            query = query.eq('assigned_to', user.id)
        }

        const { data: reportsData } = await query

        const mapped = (reportsData || []).map((r: any) => ({
            ...r,
            reporter_name: r.profiles?.full_name || 'Unknown',
        }))

        setReports(mapped)
        setLoading(false)
    }

    async function updateStatus(report: WasteReport, newStatus: string) {
        setUpdating(true)
        const supabase = createClient()
        await supabase.from('waste_reports').update({
            status: newStatus,
            resolution_notes: resolutionNotes || null,
        }).eq('id', report.id)

        // If escalating, also fire an exception alert
        if (newStatus === 'escalated') {
            await supabase.from('exception_alerts').insert({
                alert_type: 'waste_report_escalated',
                severity: 'high',
                message: `Supervisor escalated waste report: ${report.description?.slice(0, 80)}`,
                driver_id: null,
                route_id: null,
                resolved: false,
                created_at: new Date().toISOString(),
            })
        }

        showToast(newStatus === 'resolved' ? 'Report marked as resolved' : `Report ${newStatus}`)
        setSelectedReport(null)
        setResolutionNotes('')
        await loadData()
        setUpdating(false)
    }

    const filtered = filterStatus === 'all' ? reports : reports.filter(r => r.status === filterStatus)
    const counts = {
        all: reports.length,
        pending: reports.filter(r => r.status === 'pending').length,
        assigned: reports.filter(r => r.status === 'assigned').length,
        resolved: reports.filter(r => r.status === 'resolved').length,
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f4f6f3', fontFamily: "'Inter', sans-serif" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Manrope:wght@400;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .filter-btn { transition: all 0.15s; cursor: pointer; border: none; }
        .filter-btn:hover { transform: translateY(-1px); }
        .report-card { transition: box-shadow 0.2s, transform 0.2s; }
        .report-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .action-btn { transition: background 0.15s, transform 0.1s; cursor: pointer; border: none; }
        .action-btn:active { transform: scale(0.97); }
        .nav-link { transition: color 0.2s, background 0.2s; text-decoration: none; }
        .nav-link:hover { background: rgba(0,69,13,0.07); color: #00450d; }
        .toast { animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { transform: translateY(16px) translateX(-50%); opacity: 0; } to { transform: translateY(0) translateX(-50%); opacity: 1; } }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        textarea:focus { outline: none; box-shadow: 0 0 0 2px rgba(0,69,13,0.15); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

            {toast && (
                <div className="toast" style={{
                    position: 'fixed', bottom: '24px', left: '50%',
                    background: '#181c22', color: 'white', padding: '10px 20px', borderRadius: '9999px',
                    fontSize: '13px', fontWeight: 500, zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#4ade80' }}>check_circle</span>
                    {toast}
                </div>
            )}

            <nav style={{
                background: 'white', borderBottom: '1px solid rgba(0,0,0,0.06)',
                padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40,
                boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <Link href="/dashboard/supervisor" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#00450d' }}>eco</span>
                        <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '16px', color: '#00450d', letterSpacing: '-0.02em' }}>EcoLedger</span>
                    </Link>
                    <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.1)' }} />
                    <Link href="/dashboard/supervisor" className="nav-link" style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
                        borderRadius: '8px', color: '#717a6d', fontSize: '13px', fontWeight: 500,
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                        Supervisor
                    </Link>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: 0 }}>{profile?.full_name}</p>
                        <p style={{ fontSize: '11px', color: '#717a6d', margin: 0 }}>{profile?.district}</p>
                    </div>
                    <div style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00450d, #1b5e20)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: '13px', fontWeight: 700,
                    }}>{profile?.full_name?.charAt(0) || 'S'}</div>
                </div>
            </nav>

            <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

                {/* Header + View Toggle */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <p style={{ fontSize: '11px', color: '#717a6d', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>Field Supervisor</p>
                        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '26px', fontWeight: 800, color: '#181c22', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Waste Reports</h1>
                        <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>District: <strong style={{ color: '#41493e' }}>{profile?.district}</strong></p>
                    </div>
                    {/* Toggle: My Assignments / All District */}
                    <div style={{ display: 'flex', background: 'white', borderRadius: '10px', padding: '4px', border: '1px solid rgba(0,0,0,0.08)', gap: '2px' }}>
                        {([
                            { key: 'assigned', label: 'My Assignments' },
                            { key: 'all', label: 'All District' },
                        ] as { key: ViewMode; label: string }[]).map(v => (
                            <button key={v.key} className="action-btn" onClick={() => { setViewMode(v.key); setFilterStatus('all') }} style={{
                                padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
                                background: viewMode === v.key ? '#00450d' : 'transparent',
                                color: viewMode === v.key ? 'white' : '#717a6d',
                            }}>{v.label}</button>
                        ))}
                    </div>
                </div>

                {/* Filter Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                    {[
                        { key: 'all', label: 'All Reports', color: '#41493e', bg: 'rgba(65,73,62,0.08)' },
                        { key: 'pending', label: 'Pending', color: '#b45309', bg: 'rgba(180,83,9,0.08)' },
                        { key: 'assigned', label: 'Assigned', color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)' },
                        { key: 'resolved', label: 'Resolved', color: '#15803d', bg: 'rgba(21,128,61,0.08)' },
                    ].map(f => (
                        <button key={f.key} className="filter-btn" onClick={() => setFilterStatus(f.key)} style={{
                            padding: '16px 20px', borderRadius: '14px', textAlign: 'left',
                            background: filterStatus === f.key ? f.bg : 'white',
                            border: `1.5px solid ${filterStatus === f.key ? f.color + '40' : 'rgba(0,0,0,0.06)'}`,
                            boxShadow: filterStatus === f.key ? `0 2px 12px ${f.color}18` : '0 1px 4px rgba(0,0,0,0.04)',
                        }}>
                            <p style={{ fontSize: '28px', fontFamily: 'Manrope, sans-serif', fontWeight: 800, color: f.color, margin: '0 0 2px', lineHeight: 1 }}>
                                {counts[f.key as keyof typeof counts]}
                            </p>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: f.color, margin: 0 }}>{f.label}</p>
                        </button>
                    ))}
                </div>

                {/* Action Modal */}
                {selectedReport && (
                    <div className="modal-overlay" style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
                        zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
                    }}>
                        <div style={{
                            background: 'white', borderRadius: '20px', padding: '28px',
                            width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                            maxHeight: '90vh', overflowY: 'auto',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '18px', color: '#181c22', margin: 0 }}>Review Report</h2>
                                <button onClick={() => setSelectedReport(null)} className="action-btn" style={{
                                    background: 'rgba(0,0,0,0.05)', borderRadius: '8px',
                                    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#717a6d' }}>close</span>
                                </button>
                            </div>

                            <div style={{ background: '#f8f9f7', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '8px',
                                        background: `${REPORT_TYPES[selectedReport.report_type]?.color || '#8b5cf6'}15`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: REPORT_TYPES[selectedReport.report_type]?.color || '#8b5cf6' }}>
                                            {REPORT_TYPES[selectedReport.report_type]?.icon || 'report'}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#181c22' }}>
                                        {REPORT_TYPES[selectedReport.report_type]?.label || selectedReport.report_type}
                                    </span>
                                </div>
                                <p style={{ fontSize: '13px', color: '#41493e', margin: '0 0 6px' }}>{selectedReport.description}</p>
                                <p style={{ fontSize: '12px', color: '#717a6d', margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>location_on</span>
                                    {selectedReport.location_address}
                                </p>
                                <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>Reported by {selectedReport.reporter_name}</p>
                                {selectedReport.latitude && selectedReport.longitude && (
                                    <a href={`https://maps.google.com/?q=${selectedReport.latitude},${selectedReport.longitude}`}
                                        target="_blank" rel="noreferrer"
                                        style={{ fontSize: '12px', color: '#00450d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', textDecoration: 'none' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                                        View on Google Maps
                                    </a>
                                )}
                            </div>

                            {selectedReport.photo_url && (
                                <img src={selectedReport.photo_url} alt="Report" style={{
                                    width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '10px', marginBottom: '16px',
                                }} />
                            )}

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#717a6d', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                    Field Notes
                                </label>
                                <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)}
                                    placeholder="Add field notes or action taken..."
                                    style={{
                                        width: '100%', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: '10px',
                                        padding: '12px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
                                        minHeight: '80px', resize: 'vertical', boxSizing: 'border-box',
                                        color: '#181c22', background: '#fafaf9',
                                    }} />
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button className="action-btn" onClick={() => updateStatus(selectedReport, 'resolved')} disabled={updating} style={{
                                    flex: 1, minWidth: '120px', padding: '12px', borderRadius: '10px',
                                    background: 'rgba(21,128,61,0.08)', color: '#15803d',
                                    fontSize: '13px', fontWeight: 700, opacity: updating ? 0.6 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                                    Resolved
                                </button>
                                <button className="action-btn" onClick={() => updateStatus(selectedReport, 'escalated')} disabled={updating} style={{
                                    flex: 1, minWidth: '120px', padding: '12px', borderRadius: '10px',
                                    background: 'rgba(239,68,68,0.08)', color: '#dc2626',
                                    fontSize: '13px', fontWeight: 700, opacity: updating ? 0.6 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>priority_high</span>
                                    Escalate to DE
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reports List */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#717a6d', fontSize: '13px' }}>
                        <div style={{ width: '28px', height: '28px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
                        Loading reports...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#c4c9c0', display: 'block', marginBottom: '12px' }}>assignment_turned_in</span>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#41493e', margin: '0 0 4px' }}>
                            {viewMode === 'assigned' ? 'No reports assigned to you' : 'No reports found'}
                        </p>
                        <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>
                            {viewMode === 'assigned' ? 'Switch to "All District" to see all reports.' : `No ${filterStatus === 'all' ? '' : filterStatus + ' '}reports in your district.`}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {filtered.map(report => {
                            const rt = REPORT_TYPES[report.report_type] || REPORT_TYPES.other
                            const sc = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending
                            return (
                                <div key={report.id} className="report-card" style={{
                                    background: 'white', borderRadius: '14px', padding: '18px 20px',
                                    border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                    display: 'flex', alignItems: 'flex-start', gap: '14px',
                                }}>
                                    <div style={{
                                        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                                        background: `${rt.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '22px', color: rt.color }}>{rt.icon}</span>
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#181c22' }}>{rt.label}</span>
                                            <span style={{
                                                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                                                background: sc.bg, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.06em',
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            }}>
                                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                                                {sc.label}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#41493e', margin: '0 0 6px', lineHeight: 1.5 }}>{report.description}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '12px', color: '#717a6d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                                {report.location_address}
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#717a6d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>person</span>
                                                {report.reporter_name}
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                                {new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                        {report.resolution_notes && (
                                            <p style={{ fontSize: '12px', color: '#717a6d', margin: '6px 0 0', fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px', marginTop: '1px' }}>sticky_note_2</span>
                                                {report.resolution_notes}
                                            </p>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                        {report.photo_url && (
                                            <img src={report.photo_url} alt="Report" style={{
                                                width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover',
                                                border: '1px solid rgba(0,0,0,0.06)',
                                            }} />
                                        )}
                                        {report.status !== 'resolved' && (
                                            <button className="action-btn" onClick={() => {
                                                setSelectedReport(report)
                                                setResolutionNotes(report.resolution_notes || '')
                                            }} style={{
                                                padding: '8px 14px', borderRadius: '8px',
                                                background: 'rgba(0,69,13,0.06)', color: '#00450d',
                                                fontSize: '12px', fontWeight: 700,
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                            }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>rate_review</span>
                                                Review
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>
        </div>
    )
}