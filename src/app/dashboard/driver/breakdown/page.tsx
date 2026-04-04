'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const BREAKDOWN_TYPES = [
    { value: 'flat_tire', label: 'Flat Tire', icon: 'tire_repair' },
    { value: 'engine_failure', label: 'Engine Failure', icon: 'build' },
    { value: 'battery_dead', label: 'Battery Dead', icon: 'battery_alert' },
    { value: 'accident', label: 'Accident', icon: 'car_crash' },
    { value: 'fuel_empty', label: 'Fuel Empty', icon: 'local_gas_station' },
    { value: 'other', label: 'Other', icon: 'handyman' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    reported: { label: 'Reported', color: '#dc2626', bg: 'rgba(220,38,38,0.08)', dot: '#ef4444' },
    assistance_sent: { label: 'Assistance Sent', color: '#b45309', bg: 'rgba(180,83,9,0.08)', dot: '#f59e0b' },
    resolved: { label: 'Resolved', color: '#15803d', bg: 'rgba(21,128,61,0.08)', dot: '#22c55e' },
}

interface BreakdownReport {
    id: string
    vehicle_number: string
    location_address: string
    breakdown_type: string
    description: string
    status: string
    created_at: string
}

export default function BreakdownPage() {
    const router = useRouter()
    const [reports, setReports] = useState<BreakdownReport[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [activeRoute, setActiveRoute] = useState<any>(null)
    const [toast, setToast] = useState('')
    const [toastType, setToastType] = useState<'success' | 'error'>('success')
    const [formData, setFormData] = useState({
        vehicle_number: '',
        location_address: '',
        breakdown_type: '',
        description: '',
    })

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
        if (!profileData || profileData.role !== 'driver') { router.push('/login'); return }
        setProfile(profileData)

        const { data: routesData } = await supabase
            .from('routes').select('*')
            .eq('driver_id', user.id).eq('status', 'active').limit(1)

        if (routesData && routesData.length > 0) {
            setActiveRoute(routesData[0])
            setFormData(prev => ({ ...prev, vehicle_number: routesData[0].vehicle_number || '' }))
        }

        const { data: reportsData } = await supabase
            .from('breakdown_reports').select('*')
            .eq('driver_id', user.id)
            .order('created_at', { ascending: false })

        setReports(reportsData || [])
        setLoading(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!formData.breakdown_type) { showToast('Please select a breakdown type', 'error'); return }
        setSaving(true)

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase.from('breakdown_reports').insert({
            driver_id: user?.id,
            route_id: activeRoute?.id || null,
            vehicle_number: formData.vehicle_number,
            location_address: formData.location_address,
            breakdown_type: formData.breakdown_type,
            description: formData.description,
            status: 'reported',
        })

        if (error) {
            showToast('Error: ' + error.message, 'error')
        } else {
            showToast('Breakdown reported! Supervisor has been notified.')
            setShowForm(false)
            setFormData({ vehicle_number: activeRoute?.vehicle_number || '', location_address: '', breakdown_type: '', description: '' })
            loadData()
        }
        setSaving(false)
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
        .nav-link { transition: color 0.2s, background 0.2s; text-decoration: none; }
        .nav-link:hover { background: rgba(0,69,13,0.07); color: #00450d; }
        .breakdown-type-card {
          border: 1.5px solid #e4ede4; border-radius: 12px; padding: 14px 10px;
          cursor: pointer; transition: all 0.2s ease; background: #f9fbf9;
          text-align: center;
        }
        .breakdown-type-card:hover { border-color: rgba(220,38,38,0.3); background: white; transform: translateY(-1px); }
        .breakdown-type-card.selected { border-color: #dc2626; background: rgba(220,38,38,0.04); box-shadow: 0 0 0 3px rgba(220,38,38,0.07); }
        .form-input {
          width: 100%; border: 1.5px solid #e4ede4; border-radius: 10px;
          padding: 12px 16px; font-size: 14px; color: #181c22;
          font-family: 'Inter', sans-serif; transition: all 0.2s; outline: none;
          background: #f9fbf9; box-sizing: border-box;
        }
        .form-input:focus { border-color: #dc2626; background: white; box-shadow: 0 0 0 3px rgba(220,38,38,0.07); }
        .form-input::placeholder { color: #c0ccc0; }
        .report-btn {
          background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; border: none;
          border-radius: 10px; padding: 14px 24px; font-family: 'Manrope', sans-serif;
          font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 8px;
          box-shadow: 0 4px 14px rgba(220,38,38,0.25);
        }
        .report-btn:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(220,38,38,0.35); transform: translateY(-1px); }
        .report-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .trigger-btn {
          background: rgba(220,38,38,0.08); color: #dc2626; border: 1.5px solid rgba(220,38,38,0.2);
          border-radius: 10px; padding: 10px 18px; font-family: 'Manrope', sans-serif;
          font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 6px;
        }
        .trigger-btn:hover { background: rgba(220,38,38,0.12); border-color: rgba(220,38,38,0.35); }
        .cancel-btn {
          background: rgba(0,0,0,0.05); color: #717a6d; border: none; border-radius: 10px;
          padding: 14px 20px; font-family: 'Manrope', sans-serif; font-weight: 600;
          font-size: 14px; cursor: pointer; transition: background 0.2s;
        }
        .cancel-btn:hover { background: rgba(0,0,0,0.09); }
        .report-card { transition: transform 0.15s, box-shadow 0.15s; }
        .report-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .toast { animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { transform: translateY(12px) translateX(-50%); opacity: 0; } to { transform: translateY(0) translateX(-50%); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .form-enter { animation: fadeIn 0.25s ease; }
        textarea.form-input { resize: vertical; min-height: 90px; }
      `}</style>

            {/* Toast */}
            {toast && (
                <div className="toast" style={{
                    position: 'fixed', bottom: '24px', left: '50%',
                    background: toastType === 'error' ? '#dc2626' : '#181c22',
                    color: 'white', padding: '10px 20px', borderRadius: '9999px',
                    fontSize: '13px', fontWeight: 500, zIndex: 1000,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: toastType === 'error' ? '#fca5a5' : '#4ade80' }}>
                        {toastType === 'error' ? 'error' : 'check_circle'}
                    </span>
                    {toast}
                </div>
            )}

            {/* Nav */}
            <nav style={{
                background: 'white', borderBottom: '1px solid rgba(0,0,0,0.06)',
                padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40,
                boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <Link href="/dashboard/driver" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#00450d' }}>eco</span>
                        <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '16px', color: '#00450d', letterSpacing: '-0.02em' }}>EcoLedger</span>
                    </Link>
                    <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.1)' }} />
                    <Link href="/dashboard/driver" className="nav-link" style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
                        borderRadius: '8px', color: '#717a6d', fontSize: '13px', fontWeight: 500,
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                        Driver Dashboard
                    </Link>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: 0 }}>{profile?.full_name}</p>
                        <p style={{ fontSize: '11px', color: '#717a6d', margin: 0 }}>Driver</p>
                    </div>
                    <div style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00450d, #1b5e20)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: '13px', fontWeight: 700,
                    }}>{profile?.full_name?.charAt(0) || 'D'}</div>
                </div>
            </nav>

            <main style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <p style={{ fontSize: '11px', color: '#717a6d', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                            Driver Tools
                        </p>
                        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '26px', fontWeight: 800, color: '#181c22', margin: 0, letterSpacing: '-0.02em' }}>
                            Breakdown Reports
                        </h1>
                        {activeRoute && (
                            <p style={{ fontSize: '13px', color: '#717a6d', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>directions_car</span>
                                Active: {activeRoute.route_name} · {activeRoute.vehicle_number}
                            </p>
                        )}
                    </div>
                    <button className={showForm ? 'cancel-btn' : 'trigger-btn'} onClick={() => setShowForm(!showForm)}>
                        {showForm ? 'Cancel' : (
                            <>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>car_crash</span>
                                Report Breakdown
                            </>
                        )}
                    </button>
                </div>

                {/* Emergency banner when no form */}
                {!showForm && (
                    <div style={{
                        background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.12)',
                        borderRadius: '14px', padding: '16px 20px', marginBottom: '24px',
                        display: 'flex', alignItems: 'center', gap: '14px',
                    }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#dc2626' }}>emergency</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626', fontFamily: 'Manrope, sans-serif', margin: '0 0 2px' }}>
                                Vehicle breakdown?
                            </p>
                            <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>
                                Report immediately — your supervisor will be notified right away.
                            </p>
                        </div>
                        <button className="trigger-btn" onClick={() => setShowForm(true)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                            Report Now
                        </button>
                    </div>
                )}

                {/* Form */}
                {showForm && (
                    <div className="form-enter" style={{
                        background: 'white', borderRadius: '16px', padding: '28px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(220,38,38,0.1)',
                        marginBottom: '24px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#dc2626' }}>car_crash</span>
                            </div>
                            <div>
                                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>Vehicle Breakdown Report</h2>
                                <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>Your supervisor will be notified immediately</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>

                            {/* Breakdown type selector */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '10px', fontFamily: 'Manrope, sans-serif' }}>
                                    Breakdown Type
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                    {BREAKDOWN_TYPES.map(type => (
                                        <div key={type.value}
                                            className={`breakdown-type-card ${formData.breakdown_type === type.value ? 'selected' : ''}`}
                                            onClick={() => setFormData({ ...formData, breakdown_type: type.value })}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px', margin: '0 auto 8px',
                                                background: formData.breakdown_type === type.value ? 'rgba(220,38,38,0.1)' : '#f0f4f0',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'background 0.2s',
                                            }}>
                                                <span className="material-symbols-outlined" style={{
                                                    fontSize: '20px',
                                                    color: formData.breakdown_type === type.value ? '#dc2626' : '#94a894',
                                                }}>{type.icon}</span>
                                            </div>
                                            <p style={{
                                                fontSize: '12px', fontWeight: 700,
                                                color: formData.breakdown_type === type.value ? '#dc2626' : '#41493e',
                                                fontFamily: 'Manrope, sans-serif', margin: 0,
                                            }}>{type.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Vehicle + Location */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '7px', fontFamily: 'Manrope, sans-serif' }}>
                                        Vehicle Number
                                    </label>
                                    <input className="form-input" placeholder="WP CAB 1234"
                                        value={formData.vehicle_number}
                                        onChange={e => setFormData({ ...formData, vehicle_number: e.target.value })}
                                        required />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '7px', fontFamily: 'Manrope, sans-serif' }}>
                                        Current Location
                                    </label>
                                    <input className="form-input" placeholder="Street name or landmark"
                                        value={formData.location_address}
                                        onChange={e => setFormData({ ...formData, location_address: e.target.value })}
                                        required />
                                </div>
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '7px', fontFamily: 'Manrope, sans-serif' }}>
                                    Description <span style={{ color: '#b0b8aa', fontWeight: 500 }}>· optional</span>
                                </label>
                                <textarea className="form-input" placeholder="Describe the breakdown in detail..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="submit" disabled={saving} className="report-btn">
                                    {saving ? (
                                        <>
                                            <svg style={{ width: '16px', height: '16px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24">
                                                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Reporting...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>emergency</span>
                                            Submit Report
                                        </>
                                    )}
                                </button>
                                <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Reports list */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#717a6d', fontSize: '13px' }}>
                        <div style={{ width: '28px', height: '28px', border: '2px solid #dc2626', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
                        Loading reports...
                    </div>
                ) : reports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '44px', color: '#c4c9c0', display: 'block', marginBottom: '12px' }}>car_crash</span>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#41493e', margin: '0 0 4px' }}>No breakdown reports</p>
                        <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>Good news — no incidents recorded yet</p>
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>
                                Breakdown History
                            </h2>
                            <span style={{ fontSize: '12px', color: '#717a6d' }}>{reports.length} reports</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {reports.map(report => {
                                const bt = BREAKDOWN_TYPES.find(t => t.value === report.breakdown_type)
                                const sc = STATUS_CONFIG[report.status] || STATUS_CONFIG.reported
                                return (
                                    <div key={report.id} className="report-card" style={{
                                        background: 'white', borderRadius: '14px', padding: '18px 20px',
                                        border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                        display: 'flex', alignItems: 'flex-start', gap: '14px',
                                    }}>
                                        <div style={{
                                            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                                            background: 'rgba(220,38,38,0.07)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#dc2626' }}>
                                                {bt?.icon || 'car_crash'}
                                            </span>
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#181c22' }}>{bt?.label || report.breakdown_type}</span>
                                                <span style={{
                                                    fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                                                    background: sc.bg, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.06em',
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                }}>
                                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                                                    {sc.label}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '12px', color: '#717a6d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>directions_car</span>
                                                    {report.vehicle_number}
                                                </span>
                                                <span style={{ fontSize: '12px', color: '#717a6d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                                    {report.location_address}
                                                </span>
                                            </div>
                                            {report.description && (
                                                <p style={{ fontSize: '12px', color: '#717a6d', margin: '6px 0 0', fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '13px', marginTop: '1px' }}>sticky_note_2</span>
                                                    {report.description}
                                                </p>
                                            )}
                                        </div>

                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#41493e', margin: 0 }}>
                                                {new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </p>
                                            <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
                                                {new Date(report.created_at).getFullYear()}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}