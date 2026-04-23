'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

const ENGINEER_NAV = [
    { label: 'Overview', href: '/dashboard/engineer', icon: 'dashboard' },
    { label: 'Routes', href: '/dashboard/engineer/routes', icon: 'route' },
    { label: 'Complaints', href: '/dashboard/engineer/complaints', icon: 'feedback' },
    { label: 'Waste Reports', href: '/dashboard/engineer/waste-reports', icon: 'report' },
    { label: 'Analytics', href: '/dashboard/engineer/analytics', icon: 'analytics' },
    { label: 'Profile', href: '/dashboard/engineer/profile', icon: 'person' },
]

const COLORS = ['#00450d', '#1b5e20', '#d97706', '#1d4ed8', '#7c3aed', '#dc2626', '#ea580c', '#0891b2']

export default function EngineerAnalyticsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const [complaintsByType, setComplaintsByType] = useState<any[]>([])
    const [complaintsByStatus, setComplaintsByStatus] = useState<any[]>([])
    const [reportsByType, setReportsByType] = useState<any[]>([])
    const [reportsByStatus, setReportsByStatus] = useState<any[]>([])
    const [collectionByDistrict, setCollectionByDistrict] = useState<any[]>([])
    const [intakeByMaterial, setIntakeByMaterial] = useState<any[]>([])
    const [complaintsTrend, setComplaintsTrend] = useState<any[]>([])
    const [stats, setStats] = useState({ complaints: 0, reports: 0, collections: 0, intake: 0 })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const [
            { data: complaints },
            { data: reports },
            { data: collections },
            { data: intakes },
        ] = await Promise.all([
            supabase.from('complaints').select('*'),
            supabase.from('waste_reports').select('*'),
            supabase.from('collection_events').select('*'),
            supabase.from('waste_intake_logs').select('*').eq('is_rejected', false),
        ])

        const c = complaints || []
        const r = reports || []
        const col = collections || []
        const int = intakes || []

        setStats({ complaints: c.length, reports: r.length, collections: col.length, intake: int.length })

        // Complaints by type
        const cTypeMap: Record<string, number> = {}
        c.forEach((x: any) => { const k = x.complaint_type || 'other'; cTypeMap[k] = (cTypeMap[k] || 0) + 1 })
        setComplaintsByType(Object.entries(cTypeMap).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })).sort((a, b) => b.value - a.value))

        // Complaints by status
        const cStatusMap: Record<string, number> = {}
        c.forEach((x: any) => { cStatusMap[x.status] = (cStatusMap[x.status] || 0) + 1 })
        setComplaintsByStatus(Object.entries(cStatusMap).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })))

        // Reports by type
        const rTypeMap: Record<string, number> = {}
        r.forEach((x: any) => { const k = x.report_type || 'other'; rTypeMap[k] = (rTypeMap[k] || 0) + 1 })
        setReportsByType(Object.entries(rTypeMap).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })).sort((a, b) => b.value - a.value))

        // Reports by status
        const rStatusMap: Record<string, number> = {}
        r.forEach((x: any) => { rStatusMap[x.status] = (rStatusMap[x.status] || 0) + 1 })
        setReportsByStatus(Object.entries(rStatusMap).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })))

        // Collections by district
        const colDistMap: Record<string, { total: number; completed: number }> = {}
        col.forEach((x: any) => {
            const k = x.district || 'Unknown'
            if (!colDistMap[k]) colDistMap[k] = { total: 0, completed: 0 }
            colDistMap[k].total += 1
            if (x.status === 'completed') colDistMap[k].completed += 1
        })
        setCollectionByDistrict(Object.entries(colDistMap).map(([district, v]) => ({
            district: district.length > 12 ? district.slice(0, 12) + '…' : district,
            total: v.total,
            completed: v.completed,
            rate: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
        })))

        // Intake by material
        const matMap: Record<string, number> = {}
        int.forEach((x: any) => { const k = x.material_type || x.waste_type || 'other'; matMap[k] = (matMap[k] || 0) + (x.actual_quantity || 0) })
        setIntakeByMaterial(Object.entries(matMap).map(([name, value]) => ({ name, value: parseFloat((value as number).toFixed(1)) })).sort((a, b) => b.value - a.value))

        // Complaints trend by month (last 6 months)
        const monthMap: Record<string, number> = {}
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const key = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
            monthMap[key] = 0
        }
        c.forEach((x: any) => {
            const d = new Date(x.created_at)
            const key = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
            if (key in monthMap) monthMap[key] += 1
        })
        setComplaintsTrend(Object.entries(monthMap).map(([month, complaints]) => ({ month, complaints })))

        setLoading(false)
    }

    return (
        <DashboardLayout role="Engineer" userName={profile?.full_name || ''} navItems={ENGINEER_NAV}>
            <style>{`
        .ms{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
        .chart-card{background:white;border-radius:20px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05)}
        .chart-title{font-family:'Manrope',sans-serif;font-weight:700;font-size:15px;color:#181c22;margin:0 0 4px}
        .chart-sub{font-size:12px;color:#94a3b8;margin:0 0 20px}
        .empty{text-align:center;padding:40px 0;color:#94a3b8;font-size:13px;font-family:'Inter',sans-serif}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .a1{animation:fadeUp .4s ease .04s both}.a2{animation:fadeUp .4s ease .09s both}.a3{animation:fadeUp .4s ease .14s both}.a4{animation:fadeUp .4s ease .19s both}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

            <div className="a1" style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>Municipal Engineer</p>
                <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: 0 }}>
                    System <span style={{ color: '#00450d' }}>Analytics</span>
                </h1>
                <p style={{ fontSize: 13, color: '#717a6d', margin: '4px 0 0' }}>Cross-district performance insights</p>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: 32, height: 32, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* KPI row */}
                    <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
                        {[
                            { label: 'Total Complaints', value: stats.complaints, icon: 'feedback', color: '#dc2626', bg: '#fef2f2' },
                            { label: 'Waste Reports', value: stats.reports, icon: 'report', color: '#d97706', bg: '#fffbeb' },
                            { label: 'Collections', value: stats.collections, icon: 'local_shipping', color: '#00450d', bg: '#f0fdf4' },
                            { label: 'Intake Logs', value: stats.intake, icon: 'recycling', color: '#1d4ed8', bg: '#eff6ff' },
                        ].map(m => (
                            <div key={m.label} className="card" style={{ padding: 20 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                    <span className="ms" style={{ color: m.color, fontSize: 18 }}>{m.icon}</span>
                                </div>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 28, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                                <p style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{m.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Row 1 — Complaints trend + by status */}
                    <div className="a3" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div className="chart-card">
                            <p className="chart-title">Complaints Trend</p>
                            <p className="chart-sub">Monthly complaint volume — last 6 months</p>
                            {complaintsTrend.every(d => d.complaints === 0) ? (
                                <div className="empty">No complaint data yet</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={complaintsTrend}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'Inter' }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                        <Line type="monotone" dataKey="complaints" stroke="#00450d" strokeWidth={2.5} dot={{ fill: '#00450d', r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        <div className="chart-card">
                            <p className="chart-title">Complaints by Status</p>
                            <p className="chart-sub">Current resolution breakdown</p>
                            {complaintsByStatus.length === 0 ? (
                                <div className="empty">No data yet</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={complaintsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9, fontFamily: 'Inter' }}>
                                            {complaintsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Row 2 — Complaints by type + Reports by type */}
                    <div className="a3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div className="chart-card">
                            <p className="chart-title">Complaints by Type</p>
                            <p className="chart-sub">Volume per complaint category</p>
                            {complaintsByType.length === 0 ? (
                                <div className="empty">No complaints yet</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={complaintsByType} layout="vertical" margin={{ left: 10, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 10 }} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter' }} width={110} />
                                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#00450d" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        <div className="chart-card">
                            <p className="chart-title">Waste Reports by Type</p>
                            <p className="chart-sub">Environmental report categories</p>
                            {reportsByType.length === 0 ? (
                                <div className="empty">No reports yet</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={reportsByType} layout="vertical" margin={{ left: 10, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 10 }} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter' }} width={110} />
                                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#d97706" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Row 3 — Collections by district + Intake by material */}
                    <div className="a4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div className="chart-card">
                            <p className="chart-title">Collection Rate by District</p>
                            <p className="chart-sub">Completed vs total collections per district</p>
                            {collectionByDistrict.length === 0 ? (
                                <div className="empty">No collection data yet</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={collectionByDistrict} margin={{ left: -10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="district" tick={{ fontSize: 9, fontFamily: 'Inter' }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="total" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Total" />
                                        <Bar dataKey="completed" fill="#00450d" radius={[4, 4, 0, 0]} name="Completed" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        <div className="chart-card">
                            <p className="chart-title">Recycler Intake by Material</p>
                            <p className="chart-sub">Total quantity (kg) per material type</p>
                            {intakeByMaterial.length === 0 ? (
                                <div className="empty">No intake data yet</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={intakeByMaterial} margin={{ left: -10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter' }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip formatter={(v) => [`${v} kg`, 'Quantity']} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                            {intakeByMaterial.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Row 4 — Waste report status */}
                    <div className="a4" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
                        <div className="chart-card">
                            <p className="chart-title">Waste Reports by Status</p>
                            <p className="chart-sub">Resolution breakdown</p>
                            {reportsByStatus.length === 0 ? (
                                <div className="empty">No data yet</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={reportsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                                            {reportsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        <div className="chart-card">
                            <p className="chart-title">Resolution Summary</p>
                            <p className="chart-sub">Key performance indicators across all districts</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                                {[
                                    { label: 'Complaint Resolution Rate', value: stats.complaints > 0 ? Math.round((complaintsByStatus.find(s => s.name === 'resolved')?.value || 0) / stats.complaints * 100) : 0, color: '#00450d' },
                                    { label: 'Waste Report Resolution Rate', value: stats.reports > 0 ? Math.round((reportsByStatus.find(s => s.name === 'resolved')?.value || 0) / stats.reports * 100) : 0, color: '#1b5e20' },
                                    { label: 'Collection Completion Rate', value: stats.collections > 0 ? Math.round((collectionByDistrict.reduce((s, d) => s + d.completed, 0) / stats.collections) * 100) : 0, color: '#d97706' },
                                ].map(m => (
                                    <div key={m.label}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: '#181c22', fontFamily: 'Inter' }}>{m.label}</span>
                                            <span style={{ fontSize: 13, fontWeight: 800, color: m.color, fontFamily: 'Manrope' }}>{m.value}%</span>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 99, background: '#f0fdf4', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 99, background: m.color, width: `${m.value}%`, transition: 'width 0.8s ease' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}
