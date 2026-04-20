'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
    { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
    { label: 'History', href: '/dashboard/district-engineer/collection-history', icon: 'history' },
    { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
    { label: 'Heatmap', href: '/dashboard/district-engineer/heatmap', icon: 'thermostat' },
    { label: 'Reports', href: '/dashboard/district-engineer/reports', icon: 'report_problem' },
    { label: 'Incidents', href: '/dashboard/district-engineer/incidents', icon: 'warning' },
    { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
    { label: 'Announcements', href: '/dashboard/district-engineer/announcements', icon: 'campaign' },
  { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

const FACILITIES = [
    { name: 'Karadiyana Sanitary Landfill', type: 'landfill', location: 'Karadiyana, Kesbewa', icon: 'delete', color: '#64748b', bg: '#f8fafc', waste: ['non_recyclable', 'bulk', 'other'] },
    { name: 'Kerawalapitiya Compost Plant', type: 'composting', location: 'Kerawalapitiya, Wattala', icon: 'compost', color: '#00450d', bg: '#f0fdf4', waste: ['organic'] },
    { name: 'Homagama MRF', type: 'recycling', location: 'Homagama', icon: 'recycling', color: '#1d4ed8', bg: '#eff6ff', waste: ['recyclable'] },
    { name: 'E-Waste Collection Centre', type: 'e_waste', location: 'Boralesgamuwa', icon: 'computer', color: '#7c3aed', bg: '#f5f3ff', waste: ['e_waste'] },
    { name: 'CMC Transfer Station', type: 'transfer', location: 'Colombo', icon: 'local_shipping', color: '#d97706', bg: '#fefce8', waste: ['non_recyclable', 'bulk', 'organic', 'recyclable', 'e_waste', 'other'] },
]

const WASTE_TYPES = [
    { value: 'organic', label: 'Organic', icon: 'compost', color: '#00450d' },
    { value: 'non_recyclable', label: 'Non-Recyclable', icon: 'delete', color: '#ba1a1a' },
    { value: 'recyclable', label: 'Recyclable', icon: 'recycling', color: '#1d4ed8' },
    { value: 'e_waste', label: 'E-Waste', icon: 'computer', color: '#7c3aed' },
    { value: 'bulk', label: 'Bulk', icon: 'inventory_2', color: '#d97706' },
    { value: 'other', label: 'Other', icon: 'category', color: '#64748b' },
]

const DISPOSAL_STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    draft: { label: 'Draft', color: '#d97706', bg: '#fefce8', dot: '#f59e0b' },
    published: { label: 'Published', color: '#1d4ed8', bg: '#eff6ff', dot: '#3b82f6' },
    scheduled: { label: 'Scheduled', color: '#1d4ed8', bg: '#eff6ff', dot: '#3b82f6' },
    in_transit: { label: 'In Transit', color: '#d97706', bg: '#fefce8', dot: '#f59e0b' },
    completed: { label: 'Completed', color: '#00450d', bg: '#f0fdf4', dot: '#16a34a' },
    cancelled: { label: 'Cancelled', color: '#ba1a1a', bg: '#fef2f2', dot: '#ef4444' },
}

const RECORD_STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    pending: { label: 'Pending', color: '#0369a1', bg: '#f0f9ff', dot: '#38bdf8' },
    confirmed: { label: 'Confirmed', color: '#00450d', bg: '#f0fdf4', dot: '#16a34a' },
    flagged: { label: 'Flagged', color: '#ba1a1a', bg: '#fef2f2', dot: '#ef4444' },
    rejected: { label: 'Rejected', color: '#ba1a1a', bg: '#fef2f2', dot: '#ef4444' },
}

function wasteCategoryColor(category: string) {
    const map: Record<string, { bg: string; color: string }> = {
        general: { bg: '#f8fafc', color: '#64748b' },
        organic: { bg: '#f0fdf4', color: '#00450d' },
        recyclable: { bg: '#eff6ff', color: '#1d4ed8' },
        hazardous: { bg: '#fef2f2', color: '#ba1a1a' },
        e_waste: { bg: '#f5f3ff', color: '#7c3aed' },
        bulk: { bg: '#fefce8', color: '#92400e' },
    }
    return map[category] || { bg: '#f8fafc', color: '#64748b' }
}

interface DisposalSchedule {
    id: string
    waste_type: string
    facility_name: string
    facility_type: string
    scheduled_date: string
    scheduled_time: string | null
    vehicle_number: string | null
    estimated_quantity: string | null
    notes: string | null
    status: string
    published: boolean
    created_at: string
    collection_schedule_id: string | null
}

interface HistoryItem {
    id: string
    source: 'schedule' | 'record'
    waste_type: string
    facility_name: string
    status: string
    date: string
    quantity: string | null
    vehicle: string | null
    driver_name: string | null
    contractor_name: string | null
    blockchain_tx: string | null
    notes: string | null
}

const EMPTY_FORM = {
    waste_type: '', facility_name: '', facility_type: '',
    scheduled_date: '', scheduled_time: '', vehicle_number: '',
    estimated_quantity: '', notes: '', collection_schedule_id: '',
}

export default function DEDisposalPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'schedule' | 'records' | 'discrepancies' | 'history'>('schedule')

    // Disposal schedules
    const [disposals, setDisposals] = useState<DisposalSchedule[]>([])
    const [collectionSchedules, setCollectionSchedules] = useState<any[]>([])
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState<null | 'publish' | 'draft'>(null)
    const [message, setMessage] = useState('')
    const [filterDisposal, setFilterDisposal] = useState('all')
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [formData, setFormData] = useState(EMPTY_FORM)

    // Records & discrepancies
    const [records, setRecords] = useState<any[]>([])
    const [discrepancies, setDiscrepancies] = useState<any[]>([])
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
    const [filterRecords, setFilterRecords] = useState('all')

    // History
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [historySearch, setHistorySearch] = useState('')
    const [historyDateFrom, setHistoryDateFrom] = useState('')
    const [historyDateTo, setHistoryDateTo] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const district = p?.district || ''

        const [disposalRes, collSchedRes, recordsRes, discRes] = await Promise.all([
            supabase.from('disposal_schedules').select('*').eq('district', district).order('scheduled_date', { ascending: false }),
            supabase.from('schedules').select('id, waste_type, custom_waste_type, scheduled_date, wards, ward').eq('district', district).eq('status', 'published').order('scheduled_date', { ascending: false }).limit(20),
            supabase.from('disposal_records').select('*').eq('district', district).order('created_at', { ascending: false }),
            supabase.from('disposal_discrepancies').select('*').order('flagged_at', { ascending: false }),
        ])

        setDisposals(disposalRes.data || [])
        setCollectionSchedules(collSchedRes.data || [])

        // Enrich records
        const recs = recordsRes.data || []
        let enrichedRecs: any[] = []
        if (recs.length > 0) {
            const driverIds = [...new Set(recs.map((r: any) => r.driver_id).filter(Boolean))]
            const contractorIds = [...new Set(recs.map((r: any) => r.contractor_id).filter(Boolean))]
            const [{ data: dProfiles }, { data: cProfiles }] = await Promise.all([
                supabase.from('profiles').select('id, full_name').in('id', driverIds),
                supabase.from('profiles').select('id, full_name, organisation_name').in('id', contractorIds),
            ])
            enrichedRecs = recs.map((r: any) => ({
                ...r,
                driver: dProfiles?.find((d: any) => d.id === r.driver_id) || null,
                contractor: cProfiles?.find((c: any) => c.id === r.contractor_id) || null,
            }))
            setRecords(enrichedRecs)
        } else setRecords([])

        const discs = discRes.data || []
        if (discs.length > 0) {
            const driverIds = [...new Set(discs.map((d: any) => d.driver_id).filter(Boolean))]
            const contractorIds = [...new Set(discs.map((d: any) => d.contractor_id).filter(Boolean))]
            const [{ data: dProfiles }, { data: cProfiles }] = await Promise.all([
                supabase.from('profiles').select('id, full_name').in('id', driverIds),
                supabase.from('profiles').select('id, full_name, organisation_name').in('id', contractorIds),
            ])
            setDiscrepancies(discs.map((d: any) => ({
                ...d,
                driver: dProfiles?.find((p: any) => p.id === d.driver_id) || null,
                contractor: cProfiles?.find((p: any) => p.id === d.contractor_id) || null,
            })))
        } else setDiscrepancies([])

        // Build combined history from completed/cancelled disposal schedules + all disposal records
        const completedSchedules: HistoryItem[] = (disposalRes.data || [])
            .filter((d: any) => ['completed', 'cancelled'].includes(d.status))
            .map((d: any) => ({
                id: d.id, source: 'schedule' as const,
                waste_type: d.waste_type, facility_name: d.facility_name,
                status: d.status, date: d.scheduled_date,
                quantity: d.estimated_quantity, vehicle: d.vehicle_number,
                driver_name: null, contractor_name: null, blockchain_tx: null, notes: d.notes,
            }))

        const recordHistory: HistoryItem[] = enrichedRecs.map((r: any) => ({
            id: r.id, source: 'record' as const,
            waste_type: r.waste_category || 'other',
            facility_name: r.facility_name || 'Unknown facility',
            status: r.status, date: r.created_at?.split('T')[0],
            quantity: r.collected_tonnage ? `${r.collected_tonnage}T` : null,
            vehicle: r.vehicle_number,
            driver_name: r.driver?.full_name || null,
            contractor_name: r.contractor?.organisation_name || r.contractor?.full_name || null,
            blockchain_tx: r.blockchain_tx || null,
            notes: r.notes || null,
        }))

        const combined = [...completedSchedules, ...recordHistory].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        setHistory(combined)
        setLoading(false)
    }

    function suggestFacility(wasteType: string) {
        const f = FACILITIES.find(f => f.waste.includes(wasteType))
        if (f) setFormData(prev => ({ ...prev, facility_name: f.name, facility_type: f.type }))
    }

    function resetForm() {
        setFormData(EMPTY_FORM)
        setMessage('')
    }

    async function handleSubmit(publishNow: boolean) {
        setMessage('')
        if (!formData.waste_type) { setMessage('Please select a waste type'); return }
        if (!formData.facility_name) { setMessage('Please select a facility'); return }
        if (!formData.scheduled_date) { setMessage('Please select a date'); return }

        setSaving(publishNow ? 'publish' : 'draft')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase.from('disposal_schedules').insert({
            district: profile?.district,
            created_by: user?.id,
            waste_type: formData.waste_type,
            facility_name: formData.facility_name,
            facility_type: formData.facility_type,
            scheduled_date: formData.scheduled_date,
            scheduled_time: formData.scheduled_time || null,
            vehicle_number: formData.vehicle_number || null,
            estimated_quantity: formData.estimated_quantity || null,
            notes: formData.notes || null,
            collection_schedule_id: formData.collection_schedule_id || null,
            status: publishNow ? 'published' : 'draft',
            published: publishNow,
        })

        if (error) { setMessage('Error: ' + error.message); setSaving(null); return }

        if (publishNow) {
            // TODO: notify recycling_partner and facility_operator roles via Firebase FCM
            // await sendNotification({ roles: ['recycling_partner', 'facility_operator'], title: `Disposal Schedule — ${formData.waste_type}`, body: `New disposal scheduled at ${formData.facility_name} on ${formData.scheduled_date}` })
            setMessage('Disposal schedule published. Recycling partners will be notified once FCM is connected.')
        } else {
            setMessage('Saved as draft.')
        }

        setShowForm(false)
        resetForm()
        await loadData()
        setSaving(null)
    }

    async function publishDraft(id: string) {
        const supabase = createClient()
        await supabase.from('disposal_schedules').update({ status: 'published', published: true }).eq('id', id)
        await loadData()
    }

    async function deleteDraft(id: string) {
        if (!confirm('Delete this draft?')) return
        const supabase = createClient()
        await supabase.from('disposal_schedules').delete().eq('id', id)
        await loadData()
    }

    async function updateDisposalStatus(id: string, status: string) {
        setUpdatingId(id)
        const supabase = createClient()
        await supabase.from('disposal_schedules').update({ status }).eq('id', id)
        await loadData()
        setUpdatingId(null)
    }

    // History filter
    const filteredHistory = history.filter(h => {
        if (historySearch) {
            const q = historySearch.toLowerCase()
            if (!h.facility_name.toLowerCase().includes(q) && !h.waste_type.toLowerCase().includes(q) && !(h.driver_name || '').toLowerCase().includes(q)) return false
        }
        if (historyDateFrom && h.date < historyDateFrom) return false
        if (historyDateTo && h.date > historyDateTo) return false
        return true
    })

    const filteredDisposals = filterDisposal === 'all' ? disposals : disposals.filter(d => d.status === filterDisposal)
    const filteredRecords = filterRecords === 'all' ? records : records.filter((r: any) => r.status === filterRecords)

    const stats = {
        drafts: disposals.filter(d => d.status === 'draft').length,
        published: disposals.filter(d => ['published', 'scheduled'].includes(d.status)).length,
        inTransit: disposals.filter(d => d.status === 'in_transit').length,
        completed: disposals.filter(d => d.status === 'completed').length,
        openDiscrepancies: discrepancies.filter((d: any) => d.status === 'open').length,
    }

    return (
        <DashboardLayout role="District Engineer" userName={profile?.full_name || ''} navItems={DE_NAV}>
            <style>{`
        .msym { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .msym-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; border:1px solid rgba(0,69,13,0.07); box-shadow:0 1px 3px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.04); overflow:hidden; }
        .form-field { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; color:#181c22; background:#fafafa; outline:none; box-sizing:border-box; transition:all 0.2s; }
        .form-field:focus { border-color:#00450d; box-shadow:0 0 0 3px rgba(0,69,13,0.08); background:white; }
        .select-field { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; color:#181c22; background:#fafafa; outline:none; cursor:pointer; appearance:none; box-sizing:border-box; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23717a6d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; background-size:14px; padding-right:36px; transition:all 0.2s; }
        .select-field:focus { border-color:#00450d; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .field-label { display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#6b7280; font-family:'Manrope',sans-serif; margin-bottom:7px; }
        .tab-btn { padding:9px 18px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px; white-space:nowrap; }
        .tab-btn.on { background:#00450d; color:white; }
        .tab-btn.off { background:transparent; color:#64748b; }
        .tab-btn.off:hover { background:#f1f5f9; }
        .pill-btn { padding:5px 13px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .pill-btn.on { background:#00450d; color:white; }
        .pill-btn.off { background:#f1f5f9; color:#64748b; }
        .pill-btn.off:hover { background:#e2e8f0; }
        .facility-btn { border:1.5px solid rgba(0,69,13,0.1); border-radius:12px; padding:11px 14px; cursor:pointer; background:white; display:flex; align-items:center; gap:10px; transition:all 0.15s; text-align:left; width:100%; }
        .facility-btn:hover { border-color:rgba(0,69,13,0.25); background:#f9fbf7; }
        .row { padding:15px 20px; border-bottom:1px solid rgba(0,69,13,0.05); display:flex; align-items:flex-start; gap:13px; transition:background 0.15s; }
        .row:hover { background:#f9fdf9; }
        .row:last-child { border-bottom:none; }
        .badge { display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .btn-publish { display:flex; align-items:center; gap:7px; padding:11px 20px; border-radius:10px; background:#00450d; color:white; border:none; cursor:pointer; font-family:'Manrope',sans-serif; font-weight:700; font-size:13px; transition:all 0.2s; }
        .btn-publish:hover { background:#1b5e20; }
        .btn-publish:disabled { opacity:0.6; cursor:not-allowed; }
        .btn-draft { display:flex; align-items:center; gap:7px; padding:11px 18px; border-radius:10px; background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); cursor:pointer; font-family:'Manrope',sans-serif; font-weight:700; font-size:13px; transition:all 0.2s; }
        .btn-draft:hover { background:#f0fdf4; }
        .btn-draft:disabled { opacity:0.6; cursor:not-allowed; }
        .btn-discard { display:flex; align-items:center; gap:6px; padding:11px 14px; border-radius:10px; background:transparent; color:#94a3b8; border:none; cursor:pointer; font-family:'Manrope',sans-serif; font-weight:600; font-size:13px; transition:all 0.2s; }
        .btn-discard:hover { color:#64748b; background:#f8fafc; }
        .search-input { width:100%; padding:9px 14px 9px 38px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; font-family:'Inter',sans-serif; color:#181c22; background:#fafafa; outline:none; box-sizing:border-box; transition:all 0.2s; }
        .search-input:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .date-input { padding:8px 12px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:12px; font-family:'Inter',sans-serif; color:#181c22; background:#fafafa; outline:none; transition:all 0.2s; }
        .date-input:focus { border-color:#00450d; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .1s both} .a3{animation:fadeUp .4s ease .16s both}
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .slide-down { animation:slideDown .2s ease both; }
      `}</style>

            {/* Header */}
            <div className="a1" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>District Engineering</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <h1 style={{ fontSize: 40, fontWeight: 900, color: '#181c22', lineHeight: 1.05, fontFamily: 'Manrope,sans-serif', margin: 0, letterSpacing: '-0.02em' }}>
                        Waste <span style={{ color: '#1b5e20' }}>Disposal</span>
                    </h1>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {stats.openDiscrepancies > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#ba1a1a', fontFamily: 'Manrope,sans-serif' }}>{stats.openDiscrepancies} discrepanc{stats.openDiscrepancies > 1 ? 'ies' : 'y'}</span>
                            </div>
                        )}
                        <span style={{ fontSize: 12, color: '#00450d', fontWeight: 700, padding: '6px 14px', borderRadius: 99, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.12)', fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span className="msym" style={{ fontSize: 14 }}>location_on</span>{profile?.district}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'Drafts', value: stats.drafts, icon: 'edit_note', color: '#d97706', bg: '#fefce8' },
                    { label: 'Published', value: stats.published, icon: 'event', color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'In Transit', value: stats.inTransit, icon: 'local_shipping', color: '#d97706', bg: '#fefce8' },
                    { label: 'Completed', value: stats.completed, icon: 'check_circle', color: '#00450d', bg: '#f0fdf4' },
                    { label: 'History', value: history.length, icon: 'history', color: '#7c3aed', bg: '#f5f3ff' },
                ].map(m => (
                    <div key={m.label} className="card" style={{ padding: '16px 18px' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                            <span className="msym-fill" style={{ color: m.color, fontSize: 16 }}>{m.icon}</span>
                        </div>
                        <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: 26, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="a3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 99 }}>
                    {([
                        { key: 'schedule', label: 'Schedules', icon: 'event', count: disposals.length },
                        { key: 'records', label: 'Records', icon: 'receipt_long', count: records.length },
                        { key: 'discrepancies', label: 'Discrepancies', icon: 'warning', count: discrepancies.length },
                        { key: 'history', label: 'History', icon: 'history', count: history.length },
                    ] as const).map(t => (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className={`tab-btn ${activeTab === t.key ? 'on' : 'off'}`}>
                            <span className="msym" style={{ fontSize: 14 }}>{t.icon}</span>
                            {t.label}
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: activeTab === t.key ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.07)', color: activeTab === t.key ? 'white' : '#64748b' }}>{t.count}</span>
                        </button>
                    ))}
                </div>

                {activeTab === 'schedule' && (
                    <button onClick={() => { setShowForm(!showForm); resetForm() }}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, background: showForm ? '#f1f5f9' : '#00450d', color: showForm ? '#64748b' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 13, transition: 'all 0.2s' }}>
                        <span className="msym" style={{ fontSize: 16 }}>{showForm ? 'close' : 'add'}</span>
                        {showForm ? 'Cancel' : 'New Disposal'}
                    </button>
                )}
            </div>

            {/* ── SCHEDULE TAB ── */}
            {activeTab === 'schedule' && (
                <div>
                    {message && (
                        <div className="slide-down" style={{ marginBottom: 16, padding: '11px 16px', borderRadius: 10, background: message.startsWith('Error') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${message.startsWith('Error') ? 'rgba(186,26,26,0.2)' : 'rgba(0,69,13,0.15)'}`, color: message.startsWith('Error') ? '#ba1a1a' : '#00450d', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="msym-fill" style={{ fontSize: 15 }}>{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
                            {message}
                            <button onClick={() => setMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.5 }}>
                                <span className="msym" style={{ fontSize: 14 }}>close</span>
                            </button>
                        </div>
                    )}

                    {showForm && (
                        <div className="card slide-down" style={{ marginBottom: 20 }}>
                            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(0,69,13,0.06)', background: '#00450d', borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: 'white', margin: '0 0 2px' }}>New Disposal Schedule</h3>
                                    <p style={{ fontSize: 11, color: 'rgba(163,246,156,0.7)', margin: 0 }}>Publish to notify recycling partners and facility operators</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.1)' }}>
                                    <span className="msym" style={{ fontSize: 13, color: 'rgba(163,246,156,0.7)' }}>edit_note</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(163,246,156,0.9)', fontFamily: 'Manrope,sans-serif' }}>Draft</span>
                                </div>
                            </div>

                            <div style={{ padding: 22 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                                    {/* Waste type */}
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label className="field-label">Waste Type *</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 7 }}>
                                            {WASTE_TYPES.map(wt => {
                                                const isOn = formData.waste_type === wt.value
                                                return (
                                                    <button key={wt.value} type="button"
                                                        onClick={() => { setFormData(p => ({ ...p, waste_type: wt.value })); suggestFacility(wt.value) }}
                                                        style={{ border: `1.5px solid ${isOn ? wt.color : 'rgba(0,69,13,0.1)'}`, borderRadius: 10, padding: '9px 6px', cursor: 'pointer', background: isOn ? wt.color + '12' : 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s', boxShadow: isOn ? `0 0 0 3px ${wt.color}20` : 'none' }}>
                                                        <span className="msym" style={{ fontSize: 18, color: isOn ? wt.color : '#94a3b8' }}>{wt.icon}</span>
                                                        <span style={{ fontSize: 9, fontWeight: 700, color: isOn ? wt.color : '#374151', fontFamily: 'Manrope,sans-serif', textAlign: 'center', lineHeight: 1.2 }}>{wt.label}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Facility */}
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label className="field-label">Facility *{formData.waste_type && <span style={{ color: '#00450d', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — auto-suggested</span>}</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {FACILITIES.map(f => {
                                                const isOn = formData.facility_name === f.name
                                                return (
                                                    <button key={f.name} type="button" className="facility-btn"
                                                        style={isOn ? { borderColor: f.color, background: f.bg, borderWidth: 2, boxShadow: `0 0 0 3px ${f.color}18` } : {}}
                                                        onClick={() => setFormData(p => ({ ...p, facility_name: f.name, facility_type: f.type }))}>
                                                        <div style={{ width: 34, height: 34, borderRadius: 9, background: isOn ? f.color + '20' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <span className="msym" style={{ fontSize: 17, color: isOn ? f.color : '#94a3b8' }}>{f.icon}</span>
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <p style={{ fontSize: 12, fontWeight: 700, color: isOn ? f.color : '#181c22', fontFamily: 'Manrope,sans-serif', margin: '0 0 1px' }}>{f.name}</p>
                                                            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{f.location}</p>
                                                        </div>
                                                        {isOn && <span className="msym-fill" style={{ fontSize: 17, color: f.color, flexShrink: 0 }}>check_circle</span>}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="field-label">Date *</label>
                                        <input type="date" className="form-field" min={new Date().toISOString().split('T')[0]}
                                            value={formData.scheduled_date} onChange={e => setFormData(p => ({ ...p, scheduled_date: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="field-label">Time</label>
                                        <input type="time" className="form-field" value={formData.scheduled_time} onChange={e => setFormData(p => ({ ...p, scheduled_time: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="field-label">Vehicle Number</label>
                                        <input type="text" className="form-field" placeholder="e.g. WP CAB 1234"
                                            value={formData.vehicle_number} onChange={e => setFormData(p => ({ ...p, vehicle_number: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="field-label">Estimated Quantity</label>
                                        <input type="text" className="form-field" placeholder="e.g. 5 tonnes"
                                            value={formData.estimated_quantity} onChange={e => setFormData(p => ({ ...p, estimated_quantity: e.target.value }))} />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label className="field-label">Link to Collection Schedule <span style={{ color: '#d1d5db', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span></label>
                                        <select className="select-field" value={formData.collection_schedule_id} onChange={e => setFormData(p => ({ ...p, collection_schedule_id: e.target.value }))}>
                                            <option value="">— Not linked —</option>
                                            {collectionSchedules.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {new Date(s.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {s.custom_waste_type || s.waste_type?.replace('_', ' ')} · {s.wards?.join(', ') || s.ward || 'District-wide'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label className="field-label">Notes</label>
                                        <textarea className="form-field" rows={2} style={{ resize: 'vertical' }}
                                            placeholder="Special handling instructions…"
                                            value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
                                    </div>
                                </div>

                                {/* Action buttons — same pattern as schedules page */}
                                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <button type="button" disabled={!!saving} onClick={() => handleSubmit(true)} className="btn-publish">
                                        {saving === 'publish'
                                            ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Publishing…</>
                                            : <><span className="msym" style={{ fontSize: 16 }}>publish</span>Create and Publish</>}
                                    </button>
                                    <button type="button" disabled={!!saving} onClick={() => handleSubmit(false)} className="btn-draft">
                                        {saving === 'draft'
                                            ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(0,69,13,0.3)', borderTopColor: '#00450d', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Saving…</>
                                            : <><span className="msym" style={{ fontSize: 16 }}>save</span>Save as Draft</>}
                                    </button>
                                    <button type="button" disabled={!!saving} onClick={() => { setShowForm(false); resetForm() }} className="btn-discard">
                                        <span className="msym" style={{ fontSize: 15 }}>delete_outline</span>Discard
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Schedule list */}
                    <div className="card">
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>Disposal Schedules</h3>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {['all', 'draft', 'published', 'in_transit', 'completed'].map(f => (
                                    <button key={f} onClick={() => setFilterDisposal(f)} className={`pill-btn ${filterDisposal === f ? 'on' : 'off'}`}>
                                        {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
                                <div style={{ width: 24, height: 24, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                            </div>
                        ) : filteredDisposals.length === 0 ? (
                            <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                                <span className="msym" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 10 }}>delete_sweep</span>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', marginBottom: 5 }}>No disposal schedules</p>
                                <p style={{ fontSize: 12, color: '#94a3b8' }}>Use the button above to create one</p>
                            </div>
                        ) : filteredDisposals.map(d => {
                            const wi = WASTE_TYPES.find(w => w.value === d.waste_type) || WASTE_TYPES[WASTE_TYPES.length - 1]
                            const fi = FACILITIES.find(f => f.type === d.facility_type) || FACILITIES[0]
                            const sc = DISPOSAL_STATUS[d.status] || DISPOSAL_STATUS.scheduled
                            const isUpdating = updatingId === d.id
                            const isDraft = d.status === 'draft'
                            const isActive = ['published', 'scheduled', 'in_transit'].includes(d.status)

                            return (
                                <div key={d.id} className="row">
                                    <div style={{ width: 40, height: 40, borderRadius: 11, background: fi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="msym" style={{ fontSize: 19, color: fi.color }}>{fi.icon}</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', textTransform: 'capitalize' }}>{wi.label}</span>
                                            <span className="badge" style={{ background: sc.bg, color: sc.color }}>
                                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                                                {sc.label}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: '#717a6d' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msym" style={{ fontSize: 12 }}>business</span>{d.facility_name}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msym" style={{ fontSize: 12 }}>event</span>{new Date(d.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{d.scheduled_time ? ` · ${d.scheduled_time}` : ''}</span>
                                            {d.vehicle_number && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msym" style={{ fontSize: 12 }}>local_shipping</span>{d.vehicle_number}</span>}
                                            {d.estimated_quantity && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msym" style={{ fontSize: 12 }}>scale</span>{d.estimated_quantity}</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }}>
                                        {isDraft && (
                                            <>
                                                <button onClick={() => publishDraft(d.id)} disabled={isUpdating}
                                                    style={{ padding: '5px 10px', borderRadius: 7, background: '#f0fdf4', color: '#00450d', border: '1px solid rgba(0,69,13,0.15)', fontSize: 10, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <span className="msym" style={{ fontSize: 12 }}>publish</span>Publish
                                                </button>
                                                <button onClick={() => deleteDraft(d.id)}
                                                    style={{ padding: '5px 8px', borderRadius: 7, background: '#fef2f2', color: '#ba1a1a', border: '1px solid rgba(186,26,26,0.15)', fontSize: 10, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer' }}>
                                                    <span className="msym" style={{ fontSize: 12 }}>delete</span>
                                                </button>
                                            </>
                                        )}
                                        {isActive && (
                                            <>
                                                {d.status !== 'in_transit' && (
                                                    <button onClick={() => updateDisposalStatus(d.id, 'in_transit')} disabled={isUpdating}
                                                        style={{ padding: '5px 10px', borderRadius: 7, background: '#fefce8', color: '#d97706', border: '1px solid rgba(217,119,6,0.2)', fontSize: 10, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                        <span className="msym" style={{ fontSize: 12 }}>local_shipping</span>Transit
                                                    </button>
                                                )}
                                                <button onClick={() => updateDisposalStatus(d.id, 'completed')} disabled={isUpdating}
                                                    style={{ padding: '5px 10px', borderRadius: 7, background: '#f0fdf4', color: '#00450d', border: '1px solid rgba(0,69,13,0.15)', fontSize: 10, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <span className="msym" style={{ fontSize: 12 }}>check_circle</span>Done
                                                </button>
                                                <button onClick={() => updateDisposalStatus(d.id, 'cancelled')} disabled={isUpdating}
                                                    style={{ padding: '5px 8px', borderRadius: 7, background: '#fef2f2', color: '#ba1a1a', border: '1px solid rgba(186,26,26,0.15)', fontSize: 10, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer' }}>
                                                    <span className="msym" style={{ fontSize: 12 }}>cancel</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── RECORDS TAB ── */}
            {activeTab === 'records' && (
                <div className="card">
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>Disposal Records</h3>
                        <div style={{ display: 'flex', gap: 5 }}>
                            {['all', 'pending', 'confirmed', 'flagged'].map(f => (
                                <button key={f} onClick={() => setFilterRecords(f)} className={`pill-btn ${filterRecords === f ? 'on' : 'off'}`}>
                                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
                            <div style={{ width: 24, height: 24, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                            <span className="msym-fill" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 10 }}>delete_sweep</span>
                            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', marginBottom: 5 }}>No records found</p>
                            <p style={{ fontSize: 12, color: '#94a3b8' }}>Records appear when drivers dispatch to facilities</p>
                        </div>
                    ) : filteredRecords.map((record: any) => {
                        const rs = RECORD_STATUS[record.status] || RECORD_STATUS.pending
                        const wc = wasteCategoryColor(record.waste_category)
                        return (
                            <div key={record.id} className="row" style={{ cursor: 'pointer' }} onClick={() => setSelectedRecord(record)}>
                                <div style={{ width: 40, height: 40, borderRadius: 11, background: wc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span className="msym" style={{ fontSize: 19, color: wc.color }}>delete_sweep</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{record.facility_name}</span>
                                        <span className="badge" style={{ background: rs.bg, color: rs.color }}>
                                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: rs.dot, display: 'inline-block' }} />{rs.label}
                                        </span>
                                        {record.blockchain_tx && <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed' }}>on-chain</span>}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: '#717a6d' }}>
                                        <span>{record.driver?.full_name || 'Unknown driver'}</span>
                                        <span>{record.contractor?.organisation_name || record.contractor?.full_name || 'Unknown'}</span>
                                        <span>{new Date(record.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <p style={{ fontSize: 14, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif', margin: '0 0 2px' }}>{record.collected_tonnage}T</p>
                                    <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'capitalize', margin: 0 }}>{record.waste_category}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ── DISCREPANCIES TAB ── */}
            {activeTab === 'discrepancies' && (
                <div className="card">
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>Disposal Discrepancies</h3>
                    </div>
                    {discrepancies.length === 0 ? (
                        <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                            <span className="msym-fill" style={{ fontSize: 32, color: '#d1fae5', display: 'block', marginBottom: 10 }}>check_circle</span>
                            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', marginBottom: 5 }}>No discrepancies</p>
                            <p style={{ fontSize: 12, color: '#94a3b8' }}>All disposal records match</p>
                        </div>
                    ) : discrepancies.map((disc: any) => (
                        <div key={disc.id} className="row">
                            <div style={{ width: 40, height: 40, borderRadius: 11, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="msym" style={{ fontSize: 19, color: '#ba1a1a' }}>flag</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{disc.difference?.toFixed(1)}T discrepancy</span>
                                    <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>{disc.status?.replace('_', ' ')}</span>
                                    <span className="badge" style={{ background: '#fef2f2', color: '#ba1a1a' }}>{disc.difference_percentage?.toFixed(0)}% variance</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: '#717a6d' }}>
                                    <span>{disc.driver?.full_name || 'Unknown'}</span>
                                    <span>{disc.contractor?.organisation_name || disc.contractor?.full_name || 'Unknown'}</span>
                                    <span>{new Date(disc.flagged_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                </div>
                                {disc.reason && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontStyle: 'italic' }}>{disc.reason}</p>}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <p style={{ fontSize: 11, color: '#717a6d', margin: '0 0 2px' }}>{disc.collected_tonnage}T collected</p>
                                <p style={{ fontSize: 11, color: '#ba1a1a', margin: 0 }}>{disc.disposed_tonnage}T disposed</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab === 'history' && (
                <div>
                    {/* Search + date filters */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
                            <span className="msym" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#94a3b8' }}>search</span>
                            <input type="text" className="search-input" placeholder="Search facility, waste type, driver…"
                                value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
                        </div>
                        <input type="date" className="date-input" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)} />
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>to</span>
                        <input type="date" className="date-input" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)} />
                        {(historySearch || historyDateFrom || historyDateTo) && (
                            <button onClick={() => { setHistorySearch(''); setHistoryDateFrom(''); setHistoryDateTo('') }}
                                style={{ padding: '7px 12px', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 11, color: '#64748b', fontWeight: 600, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span className="msym" style={{ fontSize: 13 }}>close</span>Clear
                            </button>
                        )}
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{filteredHistory.length} entries</span>
                    </div>

                    <div className="card">
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', margin: 0 }}>Past Waste Logs</h3>
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Completed disposal schedules + driver dispatch records</p>
                        </div>

                        {filteredHistory.length === 0 ? (
                            <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                                <span className="msym" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 10 }}>history</span>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22', marginBottom: 5 }}>No history yet</p>
                                <p style={{ fontSize: 12, color: '#94a3b8' }}>Completed disposals and dispatch records will appear here</p>
                            </div>
                        ) : filteredHistory.map(item => {
                            const wi = WASTE_TYPES.find(w => w.value === item.waste_type) || WASTE_TYPES[WASTE_TYPES.length - 1]
                            const sc = item.source === 'record'
                                ? (RECORD_STATUS[item.status] || RECORD_STATUS.pending)
                                : (DISPOSAL_STATUS[item.status] || DISPOSAL_STATUS.completed)

                            return (
                                <div key={`${item.source}-${item.id}`} className="row">
                                    <div style={{ width: 40, height: 40, borderRadius: 11, background: wi.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="msym" style={{ fontSize: 19, color: wi.color }}>{wi.icon}</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{item.facility_name}</span>
                                            <span className="badge" style={{ background: sc.bg, color: sc.color }}>
                                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />{sc.label}
                                            </span>
                                            <span className="badge" style={{ background: item.source === 'record' ? '#f5f3ff' : '#f0fdf4', color: item.source === 'record' ? '#7c3aed' : '#00450d' }}>
                                                {item.source === 'record' ? 'Driver Dispatch' : 'DE Schedule'}
                                            </span>
                                            {item.blockchain_tx && <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed' }}>on-chain</span>}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: '#717a6d' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msym" style={{ fontSize: 12 }}>event</span>{new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                            {item.driver_name && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msym" style={{ fontSize: 12 }}>person</span>{item.driver_name}</span>}
                                            {item.contractor_name && <span>{item.contractor_name}</span>}
                                            {item.vehicle && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msym" style={{ fontSize: 12 }}>local_shipping</span>{item.vehicle}</span>}
                                            {item.quantity && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600, color: '#00450d' }}><span className="msym" style={{ fontSize: 12 }}>scale</span>{item.quantity}</span>}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Record detail modal */}
            {selectedRecord && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                    onClick={() => setSelectedRecord(null)}>
                    <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div>
                                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: '0 0 3px' }}>{selectedRecord.facility_name}</h3>
                                <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>{selectedRecord.driver?.full_name} · {selectedRecord.contractor?.organisation_name || selectedRecord.contractor?.full_name}</p>
                            </div>
                            <button onClick={() => setSelectedRecord(null)} style={{ width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="msym" style={{ fontSize: 16, color: '#64748b' }}>close</span>
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                            {[
                                { label: 'Status', value: RECORD_STATUS[selectedRecord.status]?.label || selectedRecord.status },
                                { label: 'Waste Category', value: selectedRecord.waste_category },
                                { label: 'Collected', value: `${selectedRecord.collected_tonnage}T` },
                                { label: 'Disposed', value: `${selectedRecord.disposed_tonnage}T` },
                                { label: 'Vehicle', value: selectedRecord.vehicle_number || 'N/A' },
                                { label: 'Ward', value: selectedRecord.ward || 'N/A' },
                            ].map(item => (
                                <div key={item.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc' }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', margin: '0 0 3px' }}>{item.label}</p>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#181c22', textTransform: 'capitalize', margin: 0 }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                        {selectedRecord.blockchain_tx && (
                            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f5f3ff', border: '1px solid rgba(124,58,237,0.15)', marginBottom: 12 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7c3aed', fontFamily: 'Manrope,sans-serif', margin: '0 0 4px' }}>Blockchain TX</p>
                                <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#7c3aed', wordBreak: 'break-all', margin: 0 }}>{selectedRecord.blockchain_tx}</p>
                            </div>
                        )}
                        <button onClick={() => setSelectedRecord(null)}
                            style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#64748b' }}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}