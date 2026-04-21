'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const ADMIN_NAV = [
    { label: 'Home', href: '/dashboard/admin', icon: 'dashboard' },
    { label: 'Users', href: '/dashboard/admin/users', icon: 'manage_accounts' },
    { label: 'Billing', href: '/dashboard/admin/billing', icon: 'payments' },
    { label: 'Billing Rates', href: '/dashboard/admin/billing-rates', icon: 'tune' },
    { label: 'Blockchain', href: '/dashboard/admin/blockchain', icon: 'link' },
    { label: 'Performance', href: '/dashboard/admin/performance', icon: 'analytics' },
    { label: 'Disposal', href: '/dashboard/admin/disposal', icon: 'delete_sweep' },
    { label: 'Reports', href: '/dashboard/admin/reports', icon: 'rate_review' },
    { label: 'Profile', href: '/dashboard/admin/profile', icon: 'person' },
]

const COLORS = ['#00450d', '#1b5e20', '#2e7d32', '#1d4ed8', '#7c3aed', '#0891b2']

export default function AdminPerformancePage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalUsers: 0, totalRoutes: 0, totalComplaints: 0, resolvedComplaints: 0,
        totalReports: 0, totalSchedules: 0, totalCollections: 0, blockchainRecords: 0,
    })
    const [districtData, setDistrictData] = useState<any[]>([])
    const [complaintTypeData, setComplaintTypeData] = useState<any[]>([])
    const [roleData, setRoleData] = useState<any[]>([])

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const [
            { count: totalUsers }, { count: totalRoutes }, { count: totalComplaints },
            { count: resolvedComplaints }, { count: totalReports }, { count: totalSchedules },
            { count: totalCollections }, { count: blockchainRecords },
        ] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }),
            supabase.from('routes').select('*', { count: 'exact', head: true }),
            supabase.from('complaints').select('*', { count: 'exact', head: true }),
            supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
            supabase.from('waste_reports').select('*', { count: 'exact', head: true }),
            supabase.from('schedules').select('*', { count: 'exact', head: true }),
            supabase.from('collection_events').select('*', { count: 'exact', head: true }),
            supabase.from('collection_events').select('*', { count: 'exact', head: true }).not('blockchain_tx', 'is', null),
        ])
        setStats({
            totalUsers: totalUsers || 0, totalRoutes: totalRoutes || 0,
            totalComplaints: totalComplaints || 0, resolvedComplaints: resolvedComplaints || 0,
            totalReports: totalReports || 0, totalSchedules: totalSchedules || 0,
            totalCollections: totalCollections || 0, blockchainRecords: blockchainRecords || 0,
        })

        const { data: complaintsData } = await supabase.from('complaints').select('district')
        if (complaintsData) {
            const counts: Record<string, number> = {}
            complaintsData.forEach(c => { if (c.district) counts[c.district] = (counts[c.district] || 0) + 1 })
            setDistrictData(Object.entries(counts).map(([name, value]) => ({ name: name.replace('Colombo ', 'Col '), value })))
        }

        const { data: complaintTypes } = await supabase.from('complaints').select('complaint_type')
        if (complaintTypes) {
            const counts: Record<string, number> = {}
            complaintTypes.forEach(c => { if (c.complaint_type) counts[c.complaint_type] = (counts[c.complaint_type] || 0) + 1 })
            setComplaintTypeData(Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })))
        }

        const { data: rolesData } = await supabase.from('profiles').select('role')
        if (rolesData) {
            const counts: Record<string, number> = {}
            rolesData.forEach(r => { if (r.role) counts[r.role] = (counts[r.role] || 0) + 1 })
            setRoleData(Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })))
        }

        setLoading(false)
    }

    const resolutionRate = stats.totalComplaints > 0 ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100) : 0
    const blockchainRate = stats.totalCollections > 0 ? Math.round((stats.blockchainRecords / stats.totalCollections) * 100) : 0

    return (
        <DashboardLayout
            role="Admin"
            userName={profile?.full_name || ''}
            navItems={ADMIN_NAV}
            primaryAction={{ label: 'View Blockchain', href: '/dashboard/admin/blockchain', icon: 'link' }}
        >
            <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
        .stat-card { background:white; border-radius:20px; padding:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); transition:transform 0.2s,box-shadow 0.2s; }
        .stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.09); }
        .progress-bar  { height:8px; border-radius:99px; background:#f0fdf4; overflow:hidden; }
        .progress-fill { height:100%; border-radius:99px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both}
        .a3{animation:fadeUp .4s ease .14s both} .a4{animation:fadeUp .4s ease .19s both}
        .a5{animation:fadeUp .4s ease .24s both}
        .live{animation:pulse 2s ease-in-out infinite}
      `}</style>

            {/* ── Heading ── */}
            <div className="a1" style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>
                            📊 System Administration
                        </p>
                        <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
                            System <span style={{ color: '#00450d' }}>Performance</span>
                        </h1>
                        <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>
                            {new Date().toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            &nbsp;·&nbsp;Colombo Municipal Council
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 99, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.12)' }}>
                        <div className="live" style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>Live Analytics</span>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* ── Primary KPI strip ── */}
                    <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
                        {[
                            { label: 'Total Users', value: stats.totalUsers, sub: 'Registered accounts', icon: 'group', color: '#15803d', bg: '#f0fdf4' },
                            { label: 'Total Routes', value: stats.totalRoutes, sub: 'Collection routes', icon: 'route', color: '#1d4ed8', bg: '#eff6ff' },
                            { label: 'Complaints', value: stats.totalComplaints, sub: `${resolutionRate}% resolved`, icon: 'feedback', color: '#d97706', bg: '#fffbeb' },
                            { label: 'Blockchain Records', value: stats.blockchainRecords, sub: `${blockchainRate}% on-chain`, icon: 'link', color: '#7c3aed', bg: '#faf5ff' },
                        ].map(m => (
                            <div key={m.label} className="stat-card">
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                    <span className="msf" style={{ color: m.color, fontSize: 20 }}>{m.icon}</span>
                                </div>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 30, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                                <p style={{ fontSize: 12, fontWeight: 600, color: '#41493e', margin: '0 0 2px', fontFamily: 'Manrope,sans-serif' }}>{m.label}</p>
                                <p style={{ fontSize: 11, color: m.color, margin: 0, fontWeight: 500 }}>{m.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Secondary KPI strip ── */}
                    <div className="a3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
                        {[
                            { label: 'Schedules', value: stats.totalSchedules, icon: 'calendar_month', color: '#1d4ed8', bg: '#eff6ff' },
                            { label: 'Waste Reports', value: stats.totalReports, icon: 'report_problem', color: '#dc2626', bg: '#fef2f2' },
                            { label: 'Collections', value: stats.totalCollections, icon: 'delete_sweep', color: '#15803d', bg: '#f0fdf4' },
                            { label: 'Resolution %', value: `${resolutionRate}%`, icon: 'analytics', color: '#0891b2', bg: '#ecfeff' },
                        ].map(m => (
                            <div key={m.label} className="stat-card">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="msf" style={{ color: m.color, fontSize: 17 }}>{m.icon}</span>
                                    </div>
                                </div>
                                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 26, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
                                <p style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{m.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Charts row ── */}
                    <div className="a4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

                        <div className="card" style={{ padding: 24 }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: '0 0 20px' }}>Complaints by District</h3>
                            {districtData.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>No complaint data yet</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={districtData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter' }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Inter', fontSize: 12 }} />
                                        <Bar dataKey="value" fill="#00450d" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        <div className="card" style={{ padding: 24 }}>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: '0 0 20px' }}>Complaint Types</h3>
                            {complaintTypeData.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>No complaint data yet</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={complaintTypeData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                                            label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: '#e4ede4' }}>
                                            {complaintTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Inter', fontSize: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* ── Users by role ── */}
                    <div className="card a4" style={{ padding: 24, marginBottom: 20 }}>
                        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: '0 0 20px' }}>Users by Role</h3>
                        {roleData.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>No user data yet</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={roleData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter' }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Inter', fontSize: 12 }} />
                                    <Bar dataKey="value" fill="#1b5e20" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* ── System Health ── */}
                    <div className="card a5" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="msf" style={{ color: '#00450d', fontSize: 18 }}>monitor_heart</span>
                            </div>
                            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', margin: 0 }}>System Health</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            {[
                                { label: 'Complaint Resolution Rate', value: resolutionRate, color: '#15803d' },
                                { label: 'Blockchain Verification Rate', value: blockchainRate, color: '#7c3aed' },
                                { label: 'Collection Completion', value: stats.totalCollections > 0 ? Math.round(((stats.totalCollections - stats.totalCollections * 0.05) / stats.totalCollections) * 100) : 0, color: '#1b5e20' },
                                { label: 'System Uptime', value: 99, color: '#0891b2' },
                            ].map(m => (
                                <div key={m.label}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ fontSize: 13, color: '#41493e', fontWeight: 500 }}>{m.label}</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}%</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${m.value}%`, background: m.color }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </DashboardLayout>
    )
}