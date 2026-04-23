'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

interface FuelLog {
    id: string
    vehicle_number: string
    fuel_amount: number
    fuel_cost: number
    odometer_reading: number | null
    fuel_station: string
    date: string
    notes: string | null
    created_at: string
}

export default function FuelLogPage() {
    const router = useRouter()
    const [logs, setLogs] = useState<FuelLog[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [activeRoute, setActiveRoute] = useState<any>(null)
    const [toast, setToast] = useState('')
    const [formData, setFormData] = useState({
        vehicle_number: '',
        fuel_amount: '',
        fuel_cost: '',
        odometer_reading: '',
        fuel_station: '',
        notes: '',
        date: new Date().toISOString().split('T')[0],
    })

    useEffect(() => { loadData() }, [])

    function showToast(msg: string) {
        setToast(msg)
        setTimeout(() => setToast(''), 3000)
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

        const { data: logsData } = await supabase
            .from('fuel_logs').select('*')
            .eq('driver_id', user.id)
            .order('created_at', { ascending: false })

        setLogs(logsData || [])
        setLoading(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase.from('fuel_logs').insert({
            driver_id: user?.id,
            route_id: activeRoute?.id || null,
            vehicle_number: formData.vehicle_number,
            fuel_amount: parseFloat(formData.fuel_amount),
            fuel_cost: parseFloat(formData.fuel_cost),
            odometer_reading: formData.odometer_reading ? parseFloat(formData.odometer_reading) : null,
            fuel_station: formData.fuel_station,
            date: formData.date,
            notes: formData.notes || null,
        })

        if (error) {
            showToast('Error: ' + error.message)
        } else {
            showToast('Fuel log recorded successfully!')
            setShowForm(false)
            setFormData({
                vehicle_number: activeRoute?.vehicle_number || '',
                fuel_amount: '',
                fuel_cost: '',
                odometer_reading: '',
                fuel_station: '',
                notes: '',
                date: new Date().toISOString().split('T')[0],
            })
            loadData()
        }
        setSaving(false)
    }

    const totalFuel = logs.reduce((sum, l) => sum + (l.fuel_amount || 0), 0)
    const totalCost = logs.reduce((sum, l) => sum + (l.fuel_cost || 0), 0)
    const avgCostPerLitre = totalFuel > 0 ? totalCost / totalFuel : 0
    const thisMonth = logs.filter(l => {
        const d = new Date(l.created_at)
        const now = new Date()
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const thisMonthCost = thisMonth.reduce((sum, l) => sum + (l.fuel_cost || 0), 0)

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
        .stat-card { transition: transform 0.2s, box-shadow 0.2s; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.09); }
        .log-card { transition: transform 0.15s, box-shadow 0.15s; }
        .log-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .form-input {
          width: 100%; border: 1.5px solid #e4ede4; border-radius: 10px;
          padding: 12px 16px; font-size: 14px; color: #181c22;
          font-family: 'Inter', sans-serif; transition: all 0.2s; outline: none;
          background: #f9fbf9; box-sizing: border-box;
        }
        .form-input:focus { border-color: #00450d; background: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.07); }
        .form-input::placeholder { color: #c0ccc0; }
        .nav-link { transition: color 0.2s, background 0.2s; text-decoration: none; }
        .nav-link:hover { background: rgba(0,69,13,0.07); color: #00450d; }
        .submit-btn {
          background: linear-gradient(135deg, #00450d, #1b5e20); color: white; border: none;
          border-radius: 10px; padding: 13px 24px; font-family: 'Manrope', sans-serif;
          font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(0,69,13,0.2);
        }
        .submit-btn:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(0,69,13,0.3); transform: translateY(-1px); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .add-btn {
          background: #00450d; color: white; border: none; border-radius: 10px;
          padding: 10px 18px; font-family: 'Manrope', sans-serif; font-weight: 700;
          font-size: 13px; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 6px;
        }
        .add-btn:hover { background: #1b5e20; box-shadow: 0 4px 14px rgba(0,69,13,0.25); }
        .cancel-btn {
          background: rgba(0,0,0,0.05); color: #717a6d; border: none; border-radius: 10px;
          padding: 10px 18px; font-family: 'Manrope', sans-serif; font-weight: 600;
          font-size: 13px; cursor: pointer; transition: all 0.2s;
        }
        .cancel-btn:hover { background: rgba(0,0,0,0.09); }
        .toast { animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { transform: translateY(12px) translateX(-50%); opacity: 0; } to { transform: translateY(0) translateX(-50%); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .form-enter { animation: fadeIn 0.25s ease; }
      `}</style>

            {/* Toast */}
            {toast && (
                <div className="toast" style={{
                    position: 'fixed', bottom: '24px', left: '50%',
                    background: '#181c22', color: 'white', padding: '10px 20px',
                    borderRadius: '9999px', fontSize: '13px', fontWeight: 500,
                    zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#4ade80' }}>check_circle</span>
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

            <main style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <p style={{ fontSize: '11px', color: '#717a6d', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                            Driver Tools
                        </p>
                        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '26px', fontWeight: 800, color: '#181c22', margin: 0, letterSpacing: '-0.02em' }}>
                            Fuel Log
                        </h1>
                        {activeRoute && (
                            <p style={{ fontSize: '13px', color: '#717a6d', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>directions_car</span>
                                Active: {activeRoute.route_name} · {activeRoute.vehicle_number}
                            </p>
                        )}
                    </div>
                    <button
                        className={showForm ? 'cancel-btn' : 'add-btn'}
                        onClick={() => setShowForm(!showForm)}>
                        {showForm ? (
                            'Cancel'
                        ) : (
                            <>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                                Record Fuel
                            </>
                        )}
                    </button>
                </div>

                {/* Stat Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
                    {[
                        { icon: 'local_gas_station', label: 'Total Fuel', value: `${totalFuel.toFixed(1)} L`, color: '#2563eb', bg: 'rgba(37,99,235,0.07)' },
                        { icon: 'payments', label: 'Total Cost', value: `LKR ${totalCost.toLocaleString()}`, color: '#00450d', bg: 'rgba(0,69,13,0.07)' },
                        { icon: 'calendar_month', label: 'This Month', value: `LKR ${thisMonthCost.toLocaleString()}`, color: '#7c3aed', bg: 'rgba(124,58,237,0.07)' },
                        { icon: 'speed', label: 'Avg / Litre', value: `LKR ${avgCostPerLitre.toFixed(0)}`, color: '#f97316', bg: 'rgba(249,115,22,0.07)' },
                    ].map(card => (
                        <div key={card.label} className="stat-card" style={{
                            background: 'white', borderRadius: '16px', padding: '20px',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)',
                        }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: card.color }}>{card.icon}</span>
                            </div>
                            <p style={{ fontSize: '20px', fontFamily: 'Manrope, sans-serif', fontWeight: 800, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{card.value}</p>
                            <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>{card.label}</p>
                        </div>
                    ))}
                </div>

                {/* Form */}
                {showForm && (
                    <div className="form-enter" style={{
                        background: 'white', borderRadius: '16px', padding: '28px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)',
                        marginBottom: '24px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,69,13,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00450d' }}>local_gas_station</span>
                            </div>
                            <div>
                                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>Record Fuel Refill</h2>
                                <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>Fill in the refill details below</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

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
                                        Fuel Station
                                    </label>
                                    <input className="form-input" placeholder="Ceylon Petroleum, Colombo 1"
                                        value={formData.fuel_station}
                                        onChange={e => setFormData({ ...formData, fuel_station: e.target.value })}
                                        required />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '7px', fontFamily: 'Manrope, sans-serif' }}>
                                        Fuel Amount (Litres)
                                    </label>
                                    <input type="number" step="0.1" className="form-input" placeholder="45.5"
                                        value={formData.fuel_amount}
                                        onChange={e => setFormData({ ...formData, fuel_amount: e.target.value })}
                                        required />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '7px', fontFamily: 'Manrope, sans-serif' }}>
                                        Total Cost (LKR)
                                    </label>
                                    <input type="number" className="form-input" placeholder="13650"
                                        value={formData.fuel_cost}
                                        onChange={e => setFormData({ ...formData, fuel_cost: e.target.value })}
                                        required />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '7px', fontFamily: 'Manrope, sans-serif' }}>
                                        Odometer Reading (km) <span style={{ color: '#b0b8aa', fontWeight: 500 }}>· optional</span>
                                    </label>
                                    <input type="number" className="form-input" placeholder="45230"
                                        value={formData.odometer_reading}
                                        onChange={e => setFormData({ ...formData, odometer_reading: e.target.value })} />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '7px', fontFamily: 'Manrope, sans-serif' }}>
                                        Date
                                    </label>
                                    <input type="date" className="form-input"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        required />
                                </div>

                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2d3d2d', marginBottom: '7px', fontFamily: 'Manrope, sans-serif' }}>
                                        Notes <span style={{ color: '#b0b8aa', fontWeight: 500 }}>· optional</span>
                                    </label>
                                    <input className="form-input" placeholder="Any additional notes..."
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                                </div>

                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button type="submit" disabled={saving} className="submit-btn">
                                    {saving ? (
                                        <>
                                            <svg style={{ width: '16px', height: '16px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24">
                                                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                                            Save Fuel Log
                                        </>
                                    )}
                                </button>
                                <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Logs List */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#717a6d', fontSize: '13px' }}>
                        <div style={{ width: '28px', height: '28px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
                        Loading fuel logs...
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '44px', color: '#c4c9c0', display: 'block', marginBottom: '12px' }}>local_gas_station</span>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#41493e', margin: '0 0 4px' }}>No fuel logs yet</p>
                        <p style={{ fontSize: '13px', color: '#717a6d', margin: '0 0 20px' }}>Click "Record Fuel" to add your first entry</p>
                        <button className="add-btn" onClick={() => setShowForm(true)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                            Record Fuel
                        </button>
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', color: '#181c22', margin: 0 }}>
                                Fuel History
                            </h2>
                            <span style={{ fontSize: '12px', color: '#717a6d' }}>{logs.length} records</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {logs.map(log => (
                                <div key={log.id} className="log-card" style={{
                                    background: 'white', borderRadius: '14px', padding: '18px 20px',
                                    border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                }}>
                                    {/* Icon */}
                                    <div style={{
                                        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                                        background: 'rgba(37,99,235,0.07)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#2563eb' }}>local_gas_station</span>
                                    </div>

                                    {/* Details */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#181c22' }}>{log.vehicle_number}</span>
                                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}>
                                                {log.fuel_amount} L
                                            </span>
                                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(0,69,13,0.08)', color: '#00450d' }}>
                                                LKR {log.fuel_cost?.toLocaleString()}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '12px', color: '#717a6d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                                {log.fuel_station}
                                            </span>
                                            {log.odometer_reading && (
                                                <span style={{ fontSize: '12px', color: '#717a6d', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>speed</span>
                                                    {log.odometer_reading.toLocaleString()} km
                                                </span>
                                            )}
                                            {log.notes && (
                                                <span style={{ fontSize: '12px', color: '#717a6d', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>sticky_note_2</span>
                                                    {log.notes}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Date */}
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#41493e', margin: 0 }}>
                                            {new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        </p>
                                        <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
                                            {new Date(log.date).getFullYear()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
