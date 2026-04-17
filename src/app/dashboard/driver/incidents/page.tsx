'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

function severityStyle(s: string) {
    switch (s) {
        case 'low': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Low' }
        case 'medium': return { bg: '#fefce8', color: '#92400e', dot: '#d97706', label: 'Medium' }
        case 'high': return { bg: '#fff7ed', color: '#c2410c', dot: '#ea580c', label: 'High' }
        case 'critical': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Critical' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: s }
    }
}

function statusStyle(s: string) {
    switch (s) {
        case 'reported': return { bg: '#f0f9ff', color: '#0369a1', label: 'Reported' }
        case 'under_review': return { bg: '#fefce8', color: '#92400e', label: 'Under Review' }
        case 'in_progress': return { bg: '#fff7ed', color: '#c2410c', label: 'In Progress' }
        case 'resolved': return { bg: '#f0fdf4', color: '#00450d', label: 'Resolved' }
        case 'closed': return { bg: '#f8fafc', color: '#64748b', label: 'Closed' }
        default: return { bg: '#f8fafc', color: '#64748b', label: s }
    }
}

function typeLabel(t: string) { return t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }

export default function DriverIncidentsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [incidents, setIncidents] = useState<any[]>([])
    const [selected, setSelected] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data } = await supabase.from('incidents').select('*').eq('driver_id', user.id).order('created_at', { ascending: false })
        setIncidents(data || [])
        setLoading(false)
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f4f6f3', fontFamily: "'Inter',sans-serif" }}>
            <style>{`
        .material-symbols-outlined{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1;}
        .bento-card{background:white;border-radius:16px;box-shadow:0 10px 40px -10px rgba(24,28,34,0.08);border:1px solid rgba(0,69,13,0.04);overflow:hidden;}
        .status-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;font-family:'Manrope',sans-serif;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;}
        .incident-row{padding:16px 24px;border-bottom:1px solid rgba(0,69,13,0.04);display:flex;align-items:center;gap:16px;cursor:pointer;transition:background 0.15s;}
        .incident-row:hover{background:#f9fafb;} .incident-row:last-child{border-bottom:none;}
        .nav-link{transition:color 0.2s,background 0.2s;text-decoration:none;}
        .nav-link:hover{background:rgba(0,69,13,0.07);color:#00450d;}
      `}</style>

            <nav style={{ background: 'white', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <Link href="/dashboard/driver" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#00450d' }}>eco</span>
                        <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '16px', color: '#00450d' }}>EcoLedger</span>
                    </Link>
                    <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.1)' }} />
                    <Link href="/dashboard/driver" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px', color: '#717a6d', fontSize: '13px', fontWeight: 500 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>Driver Dashboard
                    </Link>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: 0 }}>{profile?.full_name}</p>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg,#00450d,#1b5e20)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: 700 }}>
                        {profile?.full_name?.charAt(0) || 'D'}
                    </div>
                </div>
            </nav>

            <main style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px' }}>
                <div style={{ marginBottom: '28px' }}>
                    <p style={{ fontSize: '11px', color: '#717a6d', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>Driver Portal</p>
                    <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: '32px', fontWeight: 800, color: '#181c22', margin: 0 }}>
                        My <span style={{ color: '#1b5e20' }}>Incidents</span>
                    </h1>
                    <p style={{ fontSize: '13px', color: '#717a6d', margin: '4px 0 0' }}>Incidents reported by your contractor that involve you</p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}>
                        <div style={{ width: '28px', height: '28px', border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto', animation: 'spin .8s linear infinite' }} />
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                ) : incidents.length === 0 ? (
                    <div className="bento-card" style={{ padding: '60px', textAlign: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '44px', color: '#c4c9c0', display: 'block', marginBottom: '12px' }}>check_circle</span>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#41493e', margin: '0 0 4px', fontFamily: 'Manrope,sans-serif' }}>No incidents linked to you</p>
                        <p style={{ fontSize: '13px', color: '#717a6d', margin: 0 }}>Your contractor will link incidents to you when relevant</p>
                    </div>
                ) : (
                    <div className="bento-card">
                        {incidents.map(inc => {
                            const sev = severityStyle(inc.severity)
                            const sta = statusStyle(inc.status)
                            return (
                                <div key={inc.id} className="incident-row" onClick={() => setSelected(inc)}>
                                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0, background: sev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="material-symbols-outlined" style={{ color: sev.color, fontSize: '22px' }}>warning</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                            <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', margin: 0 }}>{inc.title}</p>
                                            <span className="status-badge" style={{ background: sev.bg, color: sev.color }}>
                                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sev.dot, display: 'inline-block' }} />{sev.label}
                                            </span>
                                            <span className="status-badge" style={{ background: sta.bg, color: sta.color }}>{sta.label}</span>
                                        </div>
                                        <p style={{ fontSize: '12px', color: '#717a6d', margin: 0 }}>{typeLabel(inc.type)} · {inc.ward || inc.district || 'Unknown'} · {new Date(inc.created_at).toLocaleDateString('en-GB')}</p>
                                    </div>
                                    <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>chevron_right</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            {selected && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                    <div className="bento-card" style={{ width: '100%', maxWidth: '560px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <div style={{ flex: 1, minWidth: 0, paddingRight: '16px' }}>
                                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '18px', color: '#181c22', marginBottom: '8px' }}>{selected.title}</h3>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    <span className="status-badge" style={{ background: severityStyle(selected.severity).bg, color: severityStyle(selected.severity).color }}>
                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: severityStyle(selected.severity).dot, display: 'inline-block' }} />{severityStyle(selected.severity).label}
                                    </span>
                                    <span className="status-badge" style={{ background: statusStyle(selected.status).bg, color: statusStyle(selected.status).color }}>{statusStyle(selected.status).label}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelected(null)} style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', flexShrink: 0 }}>
                                <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                            {[
                                { label: 'Type', value: typeLabel(selected.type) },
                                { label: 'Location', value: selected.location_address || 'Not specified' },
                                { label: 'Ward', value: selected.ward || 'N/A' },
                                { label: 'Reported', value: new Date(selected.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                            ].map(item => (
                                <div key={item.label} style={{ padding: '12px', borderRadius: '10px', background: '#f8fafc' }}>
                                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: '4px' }}>{item.label}</p>
                                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: 0 }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '16px', borderRadius: '10px', background: '#f8fafc', marginBottom: '20px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', marginBottom: '8px' }}>Description</p>
                            <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.6, margin: 0 }}>{selected.description}</p>
                        </div>
                        {selected.resolution_notes && (
                            <div style={{ padding: '16px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', marginBottom: '20px' }}>
                                <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#00450d', fontFamily: 'Manrope,sans-serif', marginBottom: '8px' }}>Resolution Notes</p>
                                <p style={{ fontSize: '13px', color: '#00450d', margin: 0 }}>{selected.resolution_notes}</p>
                            </div>
                        )}
                        <button onClick={() => setSelected(null)} style={{ width: '100%', background: '#00450d', color: 'white', border: 'none', borderRadius: '12px', padding: '13px', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Close</button>
                    </div>
                </div>
            )}
        </div>
    )
}