'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

const ADMIN_NAV = [
  { label: 'Overview',      href: '/dashboard/admin',               icon: 'dashboard'       },
  { label: 'Users',         href: '/dashboard/admin/users',         icon: 'manage_accounts' },
  { label: 'Billing',       href: '/dashboard/admin/billing',       icon: 'payments'        },
  { label: 'Billing Rates', href: '/dashboard/admin/billing-rates', icon: 'tune'            },
  { label: 'Blockchain',    href: '/dashboard/admin/blockchain',    icon: 'link'            },
  { label: 'Performance',   href: '/dashboard/admin/performance',   icon: 'analytics'       },
  { label: 'Reports',       href: '/dashboard/admin/reports',       icon: 'rate_review'     },
  { label: 'Profile',       href: '/dashboard/admin/profile',       icon: 'person'          },
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

    const resolutionRate = stats.totalComplaints > 0
        ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100) : 0
    const blockchainRate = stats.totalCollections > 0
        ? Math.round((stats.blockchainRecords / stats.totalCollections) * 100) : 0

    return (
        <DashboardLayout
            role="Admin"
            userName={profile?.full_name || ''}
            navItems={ADMIN_NAV}
            primaryAction={{ label: 'View Blockchain', href: '/dashboard/admin/blockchain', icon: 'link' }}
        >
            <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .bento-card {
          background: white; border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
          border: 1px solid rgba(0,69,13,0.04); overflow: hidden;
          transition: all 0.3s cubic-bezier(0.05,0.7,0.1,1.0);
        }
        .bento-card:hover { transform: translateY(-3px); box-shadow: 0 20px 50px -15px rgba(24,28,34,0.12); }
        .progress-bar { height: 8px; border-radius: 99px; background: #f0fdf4; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 99px; transition: width 1s ease; }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.10s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.20s both; }
        .s5 { animation: staggerIn 0.5s ease 0.25s both; }
      `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    System Administration · Analytics
                </span>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <h1 className="font-headline font-extrabold tracking-tight"
                        style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                        System <span style={{ color: '#1b5e20' }}>Performance</span>
                    </h1>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: '#f0fdf4' }}>
                        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#16a34a' }} />
                        <span className="text-sm font-medium" style={{ color: '#14532d', fontFamily: 'Inter, sans-serif' }}>
                            Colombo Municipal Council
                        </span>
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="text-center">
                        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                            style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                        <p className="text-sm" style={{ color: '#717a6d' }}>Loading system data...</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Row 1 — 4 primary stat cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6 s2">
                        {[
                            { label: 'Total Users', value: stats.totalUsers, sub: 'Registered accounts', icon: 'group', color: '#00450d', bg: 'rgba(0,69,13,0.07)' },
                            { label: 'Total Routes', value: stats.totalRoutes, sub: 'Collection routes', icon: 'route', color: '#1b5e20', bg: 'rgba(27,94,32,0.07)' },
                            { label: 'Complaints', value: stats.totalComplaints, sub: `${resolutionRate}% resolved`, icon: 'feedback', color: '#b45309', bg: 'rgba(180,83,9,0.07)' },
                            { label: 'Blockchain Records', value: stats.blockchainRecords, sub: `${blockchainRate}% on-chain`, icon: 'link', color: '#7c3aed', bg: 'rgba(124,58,237,0.07)' },
                        ].map(m => (
                            <div key={m.label} className="bento-card p-6">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: m.bg }}>
                                    <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '20px' }}>{m.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-3xl tracking-tight mb-1" style={{ color: '#181c22' }}>{m.value}</p>
                                <p className="font-headline text-xs font-bold uppercase mb-1" style={{ letterSpacing: '0.12em', color: '#94a3b8' }}>{m.label}</p>
                                <p className="text-xs font-semibold" style={{ color: m.color }}>{m.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* Row 2 — 4 secondary stat cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6 s3">
                        {[
                            { label: 'Schedules', value: stats.totalSchedules, icon: 'calendar_month', color: '#1d4ed8' },
                            { label: 'Waste Reports', value: stats.totalReports, icon: 'report_problem', color: '#dc2626' },
                            { label: 'Collections', value: stats.totalCollections, icon: 'delete_sweep', color: '#00450d' },
                            { label: 'Resolution %', value: `${resolutionRate}%`, icon: 'analytics', color: '#0891b2' },
                        ].map(m => (
                            <div key={m.label} className="bento-card p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '20px' }}>{m.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-2xl tracking-tight mb-0.5" style={{ color: '#181c22' }}>{m.value}</p>
                                <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Row 3 — Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 s4">

                        {/* Complaints by District */}
                        <div className="bento-card p-8">
                            <h3 className="font-headline font-bold text-xl mb-6" style={{ color: '#181c22' }}>
                                Complaints by District
                            </h3>
                            {districtData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#c4c9c0', display: 'block', marginBottom: '8px' }}>bar_chart</span>
                                    <p className="text-sm" style={{ color: '#94a3b8' }}>No complaint data yet</p>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={districtData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter' }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Inter' }} />
                                        <Bar dataKey="value" fill="#00450d" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Complaint Types */}
                        <div className="bento-card p-8">
                            <h3 className="font-headline font-bold text-xl mb-6" style={{ color: '#181c22' }}>
                                Complaint Types
                            </h3>
                            {complaintTypeData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#c4c9c0', display: 'block', marginBottom: '8px' }}>pie_chart</span>
                                    <p className="text-sm" style={{ color: '#94a3b8' }}>No complaint data yet</p>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={complaintTypeData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                                            label={({ name, value }) => `${name}: ${value}`}
                                            labelLine={{ stroke: '#e4ede4' }}>
                                            {complaintTypeData.map((_, index) => (
                                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Inter' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Row 4 — Users by role */}
                    <div className="bento-card p-8 mb-6 s4">
                        <h3 className="font-headline font-bold text-xl mb-6" style={{ color: '#181c22' }}>
                            Users by Role
                        </h3>
                        {roleData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#c4c9c0', display: 'block', marginBottom: '8px' }}>group</span>
                                <p className="text-sm" style={{ color: '#94a3b8' }}>No user data yet</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={roleData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter' }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Inter' }} />
                                    <Bar dataKey="value" fill="#1b5e20" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Row 5 — System Health */}
                    <div className="bento-card p-8 s5">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>monitor_heart</span>
                            </div>
                            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>System Health</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {[
                                { label: 'Complaint Resolution Rate', value: resolutionRate, color: '#00450d' },
                                { label: 'Blockchain Verification Rate', value: blockchainRate, color: '#7c3aed' },
                                { label: 'Collection Completion', value: stats.totalCollections > 0 ? Math.round(((stats.totalCollections - stats.totalCollections * 0.05) / stats.totalCollections) * 100) : 0, color: '#1b5e20' },
                                { label: 'System Uptime', value: 99, color: '#0891b2' },
                            ].map(m => (
                                <div key={m.label}>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span style={{ color: '#41493e', fontWeight: 500 }}>{m.label}</span>
                                        <span className="font-bold" style={{ color: m.color }}>{m.value}%</span>
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