'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const CONTRACTOR_NAV = [
    { label: 'Overview', href: '/dashboard/contractor', icon: 'dashboard' },
    { label: 'Routes', href: '/dashboard/contractor/routes', icon: 'route' },
    { label: 'Drivers', href: '/dashboard/contractor/drivers', icon: 'people' },
    { label: 'Breakdowns', href: '/dashboard/contractor/breakdowns', icon: 'car_crash' },
    { label: 'Contracts', href: '/dashboard/contractor/contracts', icon: 'description' },
    { label: 'Fleet', href: '/dashboard/contractor/fleet', icon: 'local_shipping' },
    { label: 'Billing', href: '/dashboard/contractor/billing', icon: 'receipt_long' },
    { label: 'Incidents', href: '/dashboard/contractor/incidents', icon: 'warning' },
    { label: 'Messages', href: '/dashboard/contractor/messages', icon: 'chat' },
    { label: 'Zones', href: '/dashboard/contractor/zones', icon: 'map' },
    { label: 'Staff', href: '/dashboard/contractor/staff', icon: 'badge' },
]

type Incident = {
    id: string; contractor_id: string; driver_id: string; route_id: string
    reported_by: string; title: string; type: string; description: string
    location_address: string; severity: string; status: string; ward: string
    district: string; resolved_at: string; resolution_notes: string
    created_at: string; updated_at: string
}

type IncidentResponse = {
    id: string; incident_id: string; responder_id: string; notes: string
    action_taken: string; new_status: string; responded_at: string
}

function severityStyle(severity: string) {
    switch (severity) {
        case 'low': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Low' }
        case 'medium': return { bg: '#fefce8', color: '#92400e', dot: '#d97706', label: 'Medium' }
        case 'high': return { bg: '#fff7ed', color: '#c2410c', dot: '#ea580c', label: 'High' }
        case 'critical': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444', label: 'Critical' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: severity }
    }
}

function statusStyle(status: string) {
    switch (status) {
        case 'reported': return { bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8', label: 'Reported' }
        case 'under_review': return { bg: '#fefce8', color: '#92400e', dot: '#d97706', label: 'Under Review' }
        case 'in_progress': return { bg: '#fff7ed', color: '#c2410c', dot: '#ea580c', label: 'In Progress' }
        case 'resolved': return { bg: '#f0fdf4', color: '#00450d', dot: '#16a34a', label: 'Resolved' }
        case 'closed': return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: 'Closed' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: status }
    }
}

function incidentTypeIcon(type: string) {
    switch (type) {
        case 'inaccessible_point': return 'block'
        case 'overloaded_bins': return 'delete_sweep'
        case 'road_blockage': return 'traffic'
        case 'equipment_failure': return 'build'
        case 'resident_non_compliance': return 'person_off'
        case 'safety_incident': return 'health_and_safety'
        case 'illegal_dumping': return 'no_trash'
        case 'infrastructure_damage': return 'construction'
        default: return 'warning'
    }
}

function incidentTypeLabel(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const EMPTY_FORM = {
    title: '', type: 'road_blockage', description: '', location_address: '',
    severity: 'medium', ward: '', district: '', driver_id: '', route_id: '',
}

export default function ContractorIncidentsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [incidents, setIncidents] = useState<Incident[]>([])
    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
    const [responses, setResponses] = useState<IncidentResponse[]>([])
    const [drivers, setDrivers] = useState<any[]>([])
    const [routes, setRoutes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [form, setForm] = useState(EMPTY_FORM)
    const [filterSeverity, setFilterSeverity] = useState('all')
    const [activeTab, setActiveTab] = useState<'all' | 'open' | 'resolved'>('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data: incidentsData } = await supabase.from('incidents').select('*').eq('contractor_id', user.id).order('created_at', { ascending: false })
        setIncidents(incidentsData || [])
        const { data: driversData } = await supabase.from('profiles').select('id, full_name').eq('role', 'driver')
        setDrivers(driversData || [])
        const { data: routesData } = await supabase.from('routes').select('id, route_name, ward, district').eq('contractor_id', user.id)
        setRoutes(routesData || [])
        setLoading(false)
    }

    async function loadIncidentDetails(incident: Incident) {
        const supabase = createClient()
        const { data: responsesData } = await supabase.from('incident_responses').select('*').eq('incident_id', incident.id).order('responded_at', { ascending: true })
        setResponses(responsesData || [])
        setSelectedIncident(incident)
    }

    async function createIncident() {
        if (!form.title || !form.description || !form.type) { setErrorMsg('Title, type and description are required.'); return }
        setSubmitting(true); setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { error } = await supabase.from('incidents').insert({
            contractor_id: user.id, reported_by: user.id, title: form.title, type: form.type,
            description: form.description, location_address: form.location_address || null,
            severity: form.severity, status: 'reported', ward: form.ward || null,
            district: form.district || null, driver_id: form.driver_id || null, route_id: form.route_id || null,
        })
        if (error) { setErrorMsg('Failed to report incident: ' + error.message) }
        else { setSuccessMsg('Incident reported successfully. CMC has been notified.'); setShowCreateForm(false); setForm(EMPTY_FORM); loadData() }
        setSubmitting(false)
    }

    async function closeIncident(incidentId: string) {
        const supabase = createClient()
        await supabase.from('incidents').update({ status: 'closed' }).eq('id', incidentId)
        setSuccessMsg('Incident closed.'); setSelectedIncident(null); loadData()
    }

    const filteredIncidents = incidents.filter(i => {
        const tabMatch = activeTab === 'all' ? true : activeTab === 'open' ? !['resolved', 'closed'].includes(i.status) : ['resolved', 'closed'].includes(i.status)
        const severityMatch = filterSeverity === 'all' || i.severity === filterSeverity
        return tabMatch && severityMatch
    })

    const stats = {
        total: incidents.length,
        open: incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length,
        critical: incidents.filter(i => i.severity === 'critical').length,
        high: incidents.filter(i => i.severity === 'high').length,
        resolved: incidents.filter(i => ['resolved', 'closed'].includes(i.status)).length,
        underReview: incidents.filter(i => i.status === 'under_review').length,
    }

    return (
        <DashboardLayout role="Contractor" userName={profile?.full_name || profile?.organisation_name || ''} navItems={CONTRACTOR_NAV} primaryAction={{ label: 'Report Incident', href: '#', icon: 'add' }}>
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .tab-btn { padding:10px 20px; border-radius:10px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:none; transition:all 0.2s; }
        .tab-active { background:#00450d; color:white; }
        .tab-inactive { background:transparent; color:#717a6d; }
        .tab-inactive:hover { background:#f0fdf4; color:#00450d; }
        .incident-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .incident-row:hover { background:#f9fafb; }
        .incident-row:last-child { border-bottom:none; }
        .filter-btn { padding:6px 14px; border-radius:8px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:1.5px solid transparent; transition:all 0.2s; }
        .form-input { width:100%; padding:10px 14px; border-radius:10px; border:1.5px solid rgba(0,69,13,0.15); font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:white; color:#181c22; }
        .form-input:focus { border-color:#00450d; }
        .form-label { font-size:12px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.05em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#00450d; color:white; border:none; padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity 0.2s; }
        .btn-primary:hover { opacity:0.88; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
        .response-item { padding:14px; border-radius:12px; background:#f8fafc; border-left:3px solid #00450d; margin-bottom:10px; }
        .response-item:last-child { margin-bottom:0; }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1{animation:staggerIn 0.5s ease 0.05s both} .s2{animation:staggerIn 0.5s ease 0.10s both}
        .s3{animation:staggerIn 0.5s ease 0.15s both} .s4{animation:staggerIn 0.5s ease 0.20s both}
      `}</style>

            <section className="mb-10 s1">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="font-headline font-extrabold tracking-tight" style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                            Incident <span style={{ color: '#1b5e20' }}>Reports</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d' }}>Report and track field incidents — visible to your drivers and district engineer</p>
                    </div>
                    <button className="btn-primary" onClick={() => { setShowCreateForm(true); setErrorMsg('') }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>Report Incident
                    </button>
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {successMsg && (
                        <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>check_circle</span>
                            <p className="text-sm font-medium" style={{ color: '#00450d' }}>{successMsg}</p>
                            <button onClick={() => setSuccessMsg('')} className="ml-auto" style={{ color: '#00450d', background: 'none', border: 'none', cursor: 'pointer' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                            </button>
                        </div>
                    )}

                    {stats.critical > 0 && (
                        <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.2)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '20px' }}>emergency_home</span>
                            <p className="text-sm font-medium" style={{ color: '#ba1a1a' }}>
                                You have <strong>{stats.critical} critical incident{stats.critical > 1 ? 's' : ''}</strong> requiring immediate attention.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6 s2">
                        {[
                            { label: 'Total', value: stats.total, color: '#00450d', bg: '#f0fdf4', icon: 'warning' },
                            { label: 'Open', value: stats.open, color: '#0369a1', bg: '#f0f9ff', icon: 'pending' },
                            { label: 'Under Review', value: stats.underReview, color: '#92400e', bg: '#fefce8', icon: 'manage_search' },
                            { label: 'Critical', value: stats.critical, color: '#ba1a1a', bg: '#fef2f2', icon: 'emergency_home' },
                            { label: 'High', value: stats.high, color: '#c2410c', bg: '#fff7ed', icon: 'priority_high' },
                            { label: 'Resolved', value: stats.resolved, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                        ].map(s => (
                            <div key={s.label} className="bento-card p-5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
                                    <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '18px' }}>{s.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-2xl" style={{ color: '#181c22' }}>{s.value}</p>
                                <p className="text-xs font-bold uppercase mt-1" style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 mb-4 s3">
                        {(['all', 'open', 'resolved'] as const).map(tab => (
                            <button key={tab} className={`tab-btn ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab(tab)}>
                                {tab === 'all' ? `All (${incidents.length})` : tab === 'open' ? `Open (${stats.open})` : `Resolved (${stats.resolved})`}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 mb-4 flex-wrap s3">
                        <span className="text-xs font-bold uppercase" style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>Severity:</span>
                        {['all', 'critical', 'high', 'medium', 'low'].map(f => {
                            const active = filterSeverity === f
                            const s = f !== 'all' ? severityStyle(f) : { bg: '#f8fafc', color: '#64748b' }
                            return (
                                <button key={f} className="filter-btn" onClick={() => setFilterSeverity(f)}
                                    style={{ background: active ? (f === 'all' ? '#00450d' : s.bg) : '#f8fafc', color: active ? (f === 'all' ? 'white' : s.color) : '#64748b', borderColor: active ? 'transparent' : 'rgba(0,69,13,0.1)' }}>
                                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            )
                        })}
                    </div>

                    <div className="bento-card s4">
                        {filteredIncidents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>check_circle</span>
                                </div>
                                <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No incidents found</p>
                                <p className="text-sm mt-1 mb-6" style={{ color: '#94a3b8' }}>{activeTab === 'open' ? 'No open incidents — great work!' : 'No incidents match your filters'}</p>
                                <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>Report Incident
                                </button>
                            </div>
                        ) : filteredIncidents.map(inc => {
                            const sev = severityStyle(inc.severity)
                            const sta = statusStyle(inc.status)
                            return (
                                <div key={inc.id} className="incident-row" onClick={() => loadIncidentDetails(inc)}>
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: sev.bg }}>
                                        <span className="material-symbols-outlined" style={{ color: sev.color, fontSize: '22px' }}>{incidentTypeIcon(inc.type)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <p className="text-sm font-bold truncate" style={{ color: '#181c22' }}>{inc.title}</p>
                                            <span className="status-badge" style={{ background: sev.bg, color: sev.color }}>
                                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sev.dot }} />{sev.label}
                                            </span>
                                            <span className="status-badge" style={{ background: sta.bg, color: sta.color }}>{sta.label}</span>
                                        </div>
                                        <p className="text-xs" style={{ color: '#717a6d' }}>{incidentTypeLabel(inc.type)} · {inc.ward || inc.district || 'Unknown'} · {new Date(inc.created_at).toLocaleDateString('en-GB')}</p>
                                    </div>
                                    <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>chevron_right</span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Incident Detail Modal */}
                    {selectedIncident && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-2xl bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h3 className="font-headline font-bold text-xl mb-2" style={{ color: '#181c22' }}>{selectedIncident.title}</h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="status-badge" style={{ background: severityStyle(selectedIncident.severity).bg, color: severityStyle(selectedIncident.severity).color }}>
                                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: severityStyle(selectedIncident.severity).dot }} />{severityStyle(selectedIncident.severity).label}
                                            </span>
                                            <span className="status-badge" style={{ background: statusStyle(selectedIncident.status).bg, color: statusStyle(selectedIncident.status).color }}>{statusStyle(selectedIncident.status).label}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedIncident(null)} style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', flexShrink: 0 }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[
                                        { label: 'Type', value: incidentTypeLabel(selectedIncident.type) },
                                        { label: 'Location', value: selectedIncident.location_address || 'Not specified' },
                                        { label: 'Ward', value: selectedIncident.ward || 'N/A' },
                                        { label: 'District', value: selectedIncident.district || 'N/A' },
                                        { label: 'Reported', value: new Date(selectedIncident.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                                        { label: 'Resolved', value: selectedIncident.resolved_at ? new Date(selectedIncident.resolved_at).toLocaleDateString('en-GB') : 'Not yet' },
                                    ].map(item => (
                                        <div key={item.label} className="p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                                            <p className="text-xs font-bold uppercase mb-1" style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>{item.label}</p>
                                            <p className="text-sm font-semibold" style={{ color: '#181c22' }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 rounded-xl mb-6" style={{ background: '#f8fafc' }}>
                                    <p className="text-xs font-bold uppercase mb-2" style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>Description</p>
                                    <p className="text-sm leading-relaxed" style={{ color: '#4b5563' }}>{selectedIncident.description}</p>
                                </div>
                                {selectedIncident.resolution_notes && (
                                    <div className="p-4 rounded-xl mb-6" style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                                        <p className="text-xs font-bold uppercase mb-2" style={{ color: '#00450d', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>Resolution Notes</p>
                                        <p className="text-sm" style={{ color: '#00450d' }}>{selectedIncident.resolution_notes}</p>
                                    </div>
                                )}
                                {responses.length > 0 && (
                                    <div className="mb-6">
                                        <p className="text-xs font-bold uppercase mb-3" style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>CMC Responses ({responses.length})</p>
                                        {responses.map(r => (
                                            <div key={r.id} className="response-item">
                                                <p className="text-sm font-medium mb-1" style={{ color: '#181c22' }}>{r.notes}</p>
                                                {r.action_taken && <p className="text-xs mt-1" style={{ color: '#717a6d' }}><strong>Action:</strong> {r.action_taken}</p>}
                                                <p className="text-xs mt-2" style={{ color: '#94a3b8' }}>{new Date(r.responded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    {!['resolved', 'closed'].includes(selectedIncident.status) && (
                                        <button className="btn-secondary flex-1 justify-center" onClick={() => closeIncident(selectedIncident.id)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>Mark Closed
                                        </button>
                                    )}
                                    <button className="btn-primary flex-1 justify-center" onClick={() => setSelectedIncident(null)}>Close</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Create Incident Modal */}
                    {showCreateForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-2xl bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Report New Incident</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>Visible to district engineer and related drivers</p>
                                    </div>
                                    <button onClick={() => { setShowCreateForm(false); setErrorMsg('') }} style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>
                                {errorMsg && (
                                    <div className="mb-4 p-3 rounded-xl flex items-center gap-2" style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '16px' }}>error</span>
                                        <p className="text-xs font-medium" style={{ color: '#ba1a1a' }}>{errorMsg}</p>
                                    </div>
                                )}
                                <div className="space-y-4">
                                    <div>
                                        <label className="form-label">Incident Title *</label>
                                        <input className="form-input" placeholder="Brief description of the incident" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Incident Type *</label>
                                            <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                                                <option value="road_blockage">Road Blockage</option>
                                                <option value="overloaded_bins">Overloaded Bins</option>
                                                <option value="inaccessible_point">Inaccessible Point</option>
                                                <option value="equipment_failure">Equipment Failure</option>
                                                <option value="resident_non_compliance">Resident Non-Compliance</option>
                                                <option value="safety_incident">Safety Incident</option>
                                                <option value="illegal_dumping">Illegal Dumping</option>
                                                <option value="infrastructure_damage">Infrastructure Damage</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">Severity *</label>
                                            <select className="form-input" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                                <option value="critical">Critical</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">Description *</label>
                                        <textarea className="form-input" rows={4} placeholder="Describe the incident in detail..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
                                    </div>
                                    <div>
                                        <label className="form-label">Location Address</label>
                                        <input className="form-input" placeholder="e.g. 45 Main Street, Ward 1, Colombo" value={form.location_address} onChange={e => setForm(f => ({ ...f, location_address: e.target.value }))} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="form-label">Ward</label><input className="form-input" placeholder="e.g. Ward 1" value={form.ward} onChange={e => setForm(f => ({ ...f, ward: e.target.value }))} /></div>
                                        <div><label className="form-label">District</label><input className="form-input" placeholder="e.g. Colombo" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Related Driver</label>
                                            <select className="form-input" value={form.driver_id} onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}>
                                                <option value="">None</option>
                                                {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">Related Route</label>
                                            <select className="form-input" value={form.route_id} onChange={e => setForm(f => ({ ...f, route_id: e.target.value }))}>
                                                <option value="">None</option>
                                                {routes.map(r => <option key={r.id} value={r.id}>{r.route_name || `${r.ward} - ${r.district}`}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center" onClick={() => { setShowCreateForm(false); setErrorMsg('') }}>Cancel</button>
                                    <button className="btn-primary flex-1 justify-center" onClick={createIncident} disabled={submitting}>
                                        {submitting ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'white', borderTopColor: 'transparent' }} /> : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>Submit Report</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}