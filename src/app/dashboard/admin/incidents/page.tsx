'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
  { label: 'Overview',             href: '/dashboard/admin',                      icon: 'dashboard',         section: 'Main' },
  { label: 'Users',                href: '/dashboard/admin/users',                icon: 'manage_accounts',   section: 'Management' },
  { label: 'Supervisors',          href: '/dashboard/admin/supervisors',           icon: 'supervisor_account',section: 'Management' },
  { label: 'Zones',                href: '/dashboard/admin/zones',                icon: 'map',               section: 'Management' },
  { label: 'Contracts',            href: '/dashboard/admin/contracts',            icon: 'description',       section: 'Management' },
  { label: 'Billing',              href: '/dashboard/admin/billing',              icon: 'payments',          section: 'Finance' },
  { label: 'Contractor Billing',   href: '/dashboard/admin/billing-contractor',   icon: 'receipt_long',      section: 'Finance' },
  { label: 'Commercial Analytics', href: '/dashboard/admin/commercial-analytics', icon: 'store',             section: 'Finance' },
  { label: 'Recycler Analytics',   href: '/dashboard/admin/recycler-analytics',   icon: 'recycling',         section: 'Finance' },
  { label: 'Blockchain',           href: '/dashboard/admin/blockchain',           icon: 'link',              section: 'Analytics' },
  { label: 'Performance',          href: '/dashboard/admin/performance',          icon: 'analytics',         section: 'Analytics' },
  { label: 'Incidents',            href: '/dashboard/admin/incidents',            icon: 'warning',           section: 'Analytics' },
  { label: 'Disposal',             href: '/dashboard/admin/disposal',             icon: 'delete_sweep',      section: 'Analytics' },
  { label: 'Announcements',        href: '/dashboard/admin/announcements',        icon: 'campaign',          section: 'Communications' },
  { label: 'Communications',       href: '/dashboard/admin/communications',       icon: 'chat',              section: 'Communications' },
]

type Incident = {
    id: string
    contractor_id: string
    title: string
    type: string
    description: string
    location_address: string
    severity: string
    status: string
    ward: string
    district: string
    resolved_at: string
    resolution_notes: string
    created_at: string
    contractor?: { full_name: string; organisation_name: string }
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
        case 'reported': return { bg: '#f0f9ff', color: '#0369a1', label: 'Reported' }
        case 'under_review': return { bg: '#fefce8', color: '#92400e', label: 'Under Review' }
        case 'in_progress': return { bg: '#fff7ed', color: '#c2410c', label: 'In Progress' }
        case 'resolved': return { bg: '#f0fdf4', color: '#00450d', label: 'Resolved' }
        case 'closed': return { bg: '#f8fafc', color: '#64748b', label: 'Closed' }
        default: return { bg: '#f8fafc', color: '#64748b', label: status }
    }
}

function incidentTypeLabel(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
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

export default function AdminIncidentsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [incidents, setIncidents] = useState<Incident[]>([])
    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
    const [responses, setResponses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [filterSeverity, setFilterSeverity] = useState('all')
    const [filterStatus, setFilterStatus] = useState('all')
    const [responseForm, setResponseForm] = useState({
        notes: '',
        action_taken: '',
        new_status: 'under_review',
    })
    const [showResponseForm, setShowResponseForm] = useState(false)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: incidentsData } = await supabase
            .from('incidents')
            .select('*, contractor:profiles!incidents_contractor_id_fkey(full_name, organisation_name)')
            .order('created_at', { ascending: false })
        setIncidents(incidentsData || [])
        setLoading(false)
    }

    async function loadIncidentDetails(incident: Incident) {
        const supabase = createClient()
        const { data: responsesData } = await supabase
            .from('incident_responses')
            .select('*')
            .eq('incident_id', incident.id)
            .order('responded_at', { ascending: true })
        setResponses(responsesData || [])
        setResponseForm({ notes: '', action_taken: '', new_status: incident.status === 'reported' ? 'under_review' : incident.status })
        setSelectedIncident(incident)
        setShowResponseForm(false)
    }

    async function submitResponse() {
        if (!responseForm.notes || !selectedIncident) return
        setSubmitting(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('incident_responses').insert({
            incident_id: selectedIncident.id,
            responder_id: user.id,
            notes: responseForm.notes,
            action_taken: responseForm.action_taken || null,
            new_status: responseForm.new_status,
        })

        const updateData: any = { status: responseForm.new_status }
        if (responseForm.new_status === 'resolved') {
            updateData.resolved_at = new Date().toISOString()
            updateData.resolution_notes = responseForm.notes
        }

        await supabase.from('incidents')
            .update(updateData)
            .eq('id', selectedIncident.id)

        setSuccessMsg('Response submitted and incident updated.')
        setShowResponseForm(false)
        setSelectedIncident(null)
        loadData()
        setSubmitting(false)
    }

    const filteredIncidents = incidents.filter(i => {
        const severityMatch = filterSeverity === 'all' || i.severity === filterSeverity
        const statusMatch = filterStatus === 'all' || i.status === filterStatus
        return severityMatch && statusMatch
    })

    const stats = {
        total: incidents.length,
        open: incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length,
        critical: incidents.filter(i => i.severity === 'critical').length,
        high: incidents.filter(i => i.severity === 'high').length,
        resolved: incidents.filter(i => ['resolved', 'closed'].includes(i.status)).length,
        awaitingResponse: incidents.filter(i => i.status === 'reported').length,
    }

    return (
        <DashboardLayout
            role="Admin"
            userName={profile?.full_name || ''}
            navItems={ADMIN_NAV}
            primaryAction={{ label: 'Add User', href: '/dashboard/admin/users', icon: 'person_add' }}
        >
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
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
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1 { animation:staggerIn 0.5s ease 0.05s both; }
        .s2 { animation:staggerIn 0.5s ease 0.10s both; }
        .s3 { animation:staggerIn 0.5s ease 0.15s both; }
        .s4 { animation:staggerIn 0.5s ease 0.20s both; }
      `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="font-headline font-extrabold tracking-tight"
                            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                            Incident <span style={{ color: '#1b5e20' }}>Management</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Review and respond to contractor field incidents
                        </p>
                    </div>
                    {stats.awaitingResponse > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                            style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                            <span className="text-sm font-bold" style={{ color: '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}>
                                {stats.awaitingResponse} awaiting response
                            </span>
                        </div>
                    )}
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {successMsg && (
                        <div className="mb-6 p-4 rounded-xl flex items-center gap-3"
                            style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>check_circle</span>
                            <p className="text-sm font-medium" style={{ color: '#00450d' }}>{successMsg}</p>
                            <button onClick={() => setSuccessMsg('')} className="ml-auto"
                                style={{ color: '#00450d', background: 'none', border: 'none', cursor: 'pointer' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                            </button>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6 s2">
                        {[
                            { label: 'Total', value: stats.total, color: '#00450d', bg: '#f0fdf4', icon: 'warning' },
                            { label: 'Open', value: stats.open, color: '#0369a1', bg: '#f0f9ff', icon: 'pending' },
                            { label: 'Awaiting', value: stats.awaitingResponse, color: '#ba1a1a', bg: '#fef2f2', icon: 'mark_email_unread' },
                            { label: 'Critical', value: stats.critical, color: '#ba1a1a', bg: '#fef2f2', icon: 'emergency_home' },
                            { label: 'High', value: stats.high, color: '#c2410c', bg: '#fff7ed', icon: 'priority_high' },
                            { label: 'Resolved', value: stats.resolved, color: '#00450d', bg: '#f0fdf4', icon: 'check_circle' },
                        ].map(s => (
                            <div key={s.label} className="bento-card p-5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                                    style={{ background: s.bg }}>
                                    <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '18px' }}>{s.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-2xl" style={{ color: '#181c22' }}>{s.value}</p>
                                <p className="text-xs font-bold uppercase mt-1"
                                    style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-4 mb-4 flex-wrap s3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase"
                                style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                Severity:
                            </span>
                            {['all', 'critical', 'high', 'medium', 'low'].map(f => {
                                const active = filterSeverity === f
                                const s = f !== 'all' ? severityStyle(f) : { bg: '#f8fafc', color: '#64748b' }
                                return (
                                    <button key={f} className="filter-btn"
                                        onClick={() => setFilterSeverity(f)}
                                        style={{
                                            background: active ? (f === 'all' ? '#00450d' : s.bg) : '#f8fafc',
                                            color: active ? (f === 'all' ? 'white' : s.color) : '#64748b',
                                            borderColor: active ? 'transparent' : 'rgba(0,69,13,0.1)',
                                        }}>
                                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                )
                            })}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase"
                                style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                Status:
                            </span>
                            {['all', 'reported', 'under_review', 'in_progress', 'resolved'].map(f => {
                                const active = filterStatus === f
                                return (
                                    <button key={f} className="filter-btn"
                                        onClick={() => setFilterStatus(f)}
                                        style={{
                                            background: active ? '#00450d' : '#f8fafc',
                                            color: active ? 'white' : '#64748b',
                                            borderColor: active ? 'transparent' : 'rgba(0,69,13,0.1)',
                                        }}>
                                        {f === 'all' ? 'All' : f.replace('_', ' ')}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Incident list */}
                    <div className="bento-card s4">
                        {filteredIncidents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                    style={{ background: '#f0fdf4' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>check_circle</span>
                                </div>
                                <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No incidents found</p>
                                <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>No incidents match your current filters</p>
                            </div>
                        ) : (
                            filteredIncidents.map(inc => {
                                const sev = severityStyle(inc.severity)
                                const sta = statusStyle(inc.status)
                                const contractorName = inc.contractor?.organisation_name || inc.contractor?.full_name || 'Unknown'
                                return (
                                    <div key={inc.id} className="incident-row" onClick={() => loadIncidentDetails(inc)}>
                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: sev.bg }}>
                                            <span className="material-symbols-outlined" style={{ color: sev.color, fontSize: '22px' }}>
                                                {incidentTypeIcon(inc.type)}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <p className="text-sm font-bold truncate" style={{ color: '#181c22' }}>{inc.title}</p>
                                                <span className="status-badge" style={{ background: sev.bg, color: sev.color }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: sev.dot }} />
                                                    {sev.label}
                                                </span>
                                                <span className="status-badge" style={{ background: sta.bg, color: sta.color }}>
                                                    {sta.label}
                                                </span>
                                            </div>
                                            <p className="text-xs" style={{ color: '#717a6d' }}>
                                                {contractorName} · {incidentTypeLabel(inc.type)} · {inc.ward || inc.district || 'Unknown'} · {new Date(inc.created_at).toLocaleDateString('en-GB')}
                                            </p>
                                        </div>
                                        <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>
                                            chevron_right
                                        </span>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* Incident Detail + Response Modal */}
                    {selectedIncident && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-2xl bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h3 className="font-headline font-bold text-xl mb-2" style={{ color: '#181c22' }}>
                                            {selectedIncident.title}
                                        </h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="status-badge"
                                                style={{ background: severityStyle(selectedIncident.severity).bg, color: severityStyle(selectedIncident.severity).color }}>
                                                <span className="w-1.5 h-1.5 rounded-full"
                                                    style={{ background: severityStyle(selectedIncident.severity).dot }} />
                                                {severityStyle(selectedIncident.severity).label}
                                            </span>
                                            <span className="status-badge"
                                                style={{ background: statusStyle(selectedIncident.status).bg, color: statusStyle(selectedIncident.status).color }}>
                                                {statusStyle(selectedIncident.status).label}
                                            </span>
                                            <span className="text-xs" style={{ color: '#717a6d' }}>
                                                {selectedIncident.contractor?.organisation_name || selectedIncident.contractor?.full_name}
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedIncident(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', flexShrink: 0 }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                {/* Details */}
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
                                            <p className="text-xs font-bold uppercase mb-1"
                                                style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                                {item.label}
                                            </p>
                                            <p className="text-sm font-semibold" style={{ color: '#181c22' }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Description */}
                                <div className="p-4 rounded-xl mb-6" style={{ background: '#f8fafc' }}>
                                    <p className="text-xs font-bold uppercase mb-2"
                                        style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                        Description
                                    </p>
                                    <p className="text-sm leading-relaxed" style={{ color: '#4b5563' }}>
                                        {selectedIncident.description}
                                    </p>
                                </div>

                                {/* Existing responses */}
                                {responses.length > 0 && (
                                    <div className="mb-6">
                                        <p className="text-xs font-bold uppercase mb-3"
                                            style={{ color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                            Response History ({responses.length})
                                        </p>
                                        {responses.map(r => (
                                            <div key={r.id} className="response-item">
                                                <p className="text-sm font-medium mb-1" style={{ color: '#181c22' }}>{r.notes}</p>
                                                {r.action_taken && (
                                                    <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                                        <strong>Action:</strong> {r.action_taken}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-2 mt-2">
                                                    {r.new_status && (
                                                        <span className="status-badge"
                                                            style={{ background: statusStyle(r.new_status).bg, color: statusStyle(r.new_status).color, fontSize: '10px', padding: '2px 8px' }}>
                                                            → {statusStyle(r.new_status).label}
                                                        </span>
                                                    )}
                                                    <span className="text-xs" style={{ color: '#94a3b8' }}>
                                                        {new Date(r.responded_at).toLocaleDateString('en-GB')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Response form */}
                                {!['resolved', 'closed'].includes(selectedIncident.status) && (
                                    <>
                                        {!showResponseForm ? (
                                            <button className="btn-primary w-full justify-center mb-3"
                                                onClick={() => setShowResponseForm(true)}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>reply</span>
                                                Add Response
                                            </button>
                                        ) : (
                                            <div className="p-4 rounded-xl mb-4"
                                                style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                                                <p className="text-xs font-bold uppercase mb-4"
                                                    style={{ color: '#00450d', letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>
                                                    Add Response
                                                </p>
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="form-label">Response Notes *</label>
                                                        <textarea className="form-input" rows={3}
                                                            placeholder="Describe your response or findings..."
                                                            value={responseForm.notes}
                                                            onChange={e => setResponseForm(f => ({ ...f, notes: e.target.value }))}
                                                            style={{ resize: 'vertical' }} />
                                                    </div>
                                                    <div>
                                                        <label className="form-label">Action Taken</label>
                                                        <input className="form-input"
                                                            placeholder="Describe specific actions taken..."
                                                            value={responseForm.action_taken}
                                                            onChange={e => setResponseForm(f => ({ ...f, action_taken: e.target.value }))} />
                                                    </div>
                                                    <div>
                                                        <label className="form-label">Update Status</label>
                                                        <select className="form-input"
                                                            value={responseForm.new_status}
                                                            onChange={e => setResponseForm(f => ({ ...f, new_status: e.target.value }))}>
                                                            <option value="under_review">Under Review</option>
                                                            <option value="in_progress">In Progress</option>
                                                            <option value="resolved">Resolved</option>
                                                            <option value="closed">Closed</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 mt-4">
                                                    <button className="btn-secondary flex-1 justify-center"
                                                        onClick={() => setShowResponseForm(false)}>
                                                        Cancel
                                                    </button>
                                                    <button className="btn-primary flex-1 justify-center"
                                                        onClick={submitResponse} disabled={submitting}>
                                                        {submitting ? (
                                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                                        ) : (
                                                            <>
                                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
                                                                Submit Response
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                <button className="btn-secondary w-full justify-center"
                                    onClick={() => setSelectedIncident(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}