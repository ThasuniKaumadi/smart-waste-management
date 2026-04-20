'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const DE_NAV = [
    { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
    { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_month' },
    { label: 'History', href: '/dashboard/district-engineer/collection-history', icon: 'history' },
    { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
    { label: 'Heatmap', href: '/dashboard/district-engineer/heatmap', icon: 'thermostat' },
    { label: 'Reports', href: '/dashboard/district-engineer/reports', icon: 'report_problem' },
    { label: 'Incidents', href: '/dashboard/district-engineer/incidents', icon: 'warning' },
    { label: 'Performance', href: '/dashboard/district-engineer/performance', icon: 'analytics' },
    { label: 'Bin Requests', href: '/dashboard/district-engineer/bin-requests', icon: 'delete_outline' },
    { label: 'Compliance', href: '/dashboard/district-engineer/compliance', icon: 'verified' },
    { label: 'Announcements', href: '/dashboard/district-engineer/announcements', icon: 'campaign' },
    { label: 'Disposal', href: '/dashboard/district-engineer/disposal', icon: 'delete_sweep' },
]

export default function DistrictPerformancePage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalRoutes: 0, completedRoutes: 0,
        totalComplaints: 0, resolvedComplaints: 0,
        totalReports: 0, resolvedReports: 0,
        totalSchedules: 0, publishedSchedules: 0,
    })
    const [collectionData, setCollectionData] = useState<any[]>([])
    const [complaintData, setComplaintData] = useState<any[]>([])
    const [wasteTypeData, setWasteTypeData] = useState<any[]>([])

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const district = p?.district || ''

        const [
            { count: totalRoutes },
            { count: completedRoutes },
            { count: totalComplaints },
            { count: resolvedComplaints },
            { count: totalReports },
            { count: resolvedReports },
            { count: totalSchedules },
            { count: publishedSchedules },
        ] = await Promise.all([
            supabase.from('routes').select('*', { count: 'exact', head: true }).eq('district', district),
            supabase.from('routes').select('*', { count: 'exact', head: true }).eq('district', district).eq('status', 'completed'),
            supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('district', district),
            supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('district', district).eq('status', 'resolved'),
            supabase.from('waste_reports').select('*', { count: 'exact', head: true }).eq('district', district),
            supabase.from('waste_reports').select('*', { count: 'exact', head: true }).eq('district', district).eq('status', 'resolved'),
            supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('district', district),
            supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('district', district).eq('published', true),
        ])

        setStats({
            totalRoutes: totalRoutes || 0,
            completedRoutes: completedRoutes || 0,
            totalComplaints: totalComplaints || 0,
            resolvedComplaints: resolvedComplaints || 0,
            totalReports: totalReports || 0,
            resolvedReports: resolvedReports || 0,
            totalSchedules: totalSchedules || 0,
            publishedSchedules: publishedSchedules || 0,
        })

        setCollectionData([
            { name: 'Completed', value: completedRoutes || 0, fill: '#00450d' },
            { name: 'Active', value: Math.max((totalRoutes || 0) - (completedRoutes || 0), 0), fill: '#1d4ed8' },
        ])

        setComplaintData([
            { name: 'Resolved', value: resolvedComplaints || 0, fill: '#00450d' },
            { name: 'Pending', value: Math.max((totalComplaints || 0) - (resolvedComplaints || 0), 0), fill: '#ba1a1a' },
        ])

        const { data: schedulesData } = await supabase
            .from('schedules').select('waste_type').eq('district', district)

        if (schedulesData) {
            const wasteCounts: Record<string, number> = {}
            schedulesData.forEach(s => {
                wasteCounts[s.waste_type] = (wasteCounts[s.waste_type] || 0) + 1
            })
            setWasteTypeData(Object.entries(wasteCounts).map(([name, value]) => ({
                name: name.replace('_', ' '), value,
            })))
        }

        setLoading(false)
    }

    const completionRate = stats.totalRoutes > 0
        ? Math.round((stats.completedRoutes / stats.totalRoutes) * 100) : 0
    const resolutionRate = stats.totalComplaints > 0
        ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100) : 0
    const reportResolutionRate = stats.totalReports > 0
        ? Math.round((stats.resolvedReports / stats.totalReports) * 100) : 0

    return (
        <DashboardLayout
            role="District Engineer"
            userName={profile?.full_name || ''}
            navItems={DE_NAV}
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
        }
        .bento-card-green {
          background: #00450d; border-radius: 16px; color: white;
          overflow: hidden; position: relative;
          box-shadow: 0 20px 40px -10px rgba(0,69,13,0.3);
        }
        .progress-bar-track {
          width: 100%; height: 8px; background: rgba(0,0,0,0.06);
          border-radius: 99px; overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%; border-radius: 99px;
          transition: width 1s cubic-bezier(0.05,0.7,0.1,1.0);
        }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.2s both; }
        .s5 { animation: staggerIn 0.5s ease 0.25s both; }
      `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <span className="text-xs font-bold uppercase block mb-2"
                    style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
                    District Engineering · Analytics
                </span>
                <h1 className="font-headline font-extrabold tracking-tight"
                    style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                    District <span style={{ color: '#1b5e20' }}>Performance</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: '#717a6d' }}>
                    {profile?.district || 'Your District'} · Real-time operational metrics
                </p>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {/* Top stats */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6 s2">

                        {/* Featured green card */}
                        <div className="bento-card-green md:col-span-8 p-8">
                            <div style={{ position: 'absolute', right: -48, top: -48, width: 256, height: 256, background: 'rgba(255,255,255,0.04)', borderRadius: '50%', filter: 'blur(32px)' }} />
                            <div style={{ position: 'relative', zIndex: 10 }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '99px', marginBottom: '24px', display: 'inline-block', fontFamily: 'Manrope, sans-serif' }}>
                                    District Overview
                                </span>
                                <h2 className="font-headline font-extrabold text-3xl tracking-tight mb-1">
                                    {profile?.district}
                                </h2>
                                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '32px' }}>
                                    Colombo Municipal Council · Waste Management Operations
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Routes', value: stats.totalRoutes, icon: 'route' },
                                        { label: 'Schedules', value: stats.totalSchedules, icon: 'calendar_month' },
                                        { label: 'Complaints', value: stats.totalComplaints, icon: 'feedback' },
                                        { label: 'Reports', value: stats.totalReports, icon: 'report' },
                                    ].map(m => (
                                        <div key={m.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'rgba(163,246,156,0.7)', display: 'block', marginBottom: '6px' }}>{m.icon}</span>
                                            <p className="font-headline font-bold text-2xl">{m.value}</p>
                                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Performance rates */}
                        <div className="bento-card md:col-span-4 p-6">
                            <h3 className="font-headline font-bold text-lg mb-6" style={{ color: '#181c22' }}>
                                Performance Rates
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {[
                                    { label: 'Route Completion', rate: completionRate, color: '#00450d', completed: stats.completedRoutes, total: stats.totalRoutes },
                                    { label: 'Complaint Resolution', rate: resolutionRate, color: '#1d4ed8', completed: stats.resolvedComplaints, total: stats.totalComplaints },
                                    { label: 'Report Resolution', rate: reportResolutionRate, color: '#7c3aed', completed: stats.resolvedReports, total: stats.totalReports },
                                ].map(item => (
                                    <div key={item.label}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22' }}>{item.label}</p>
                                            <p className="font-headline font-bold" style={{ color: item.color, fontSize: '18px' }}>{item.rate}%</p>
                                        </div>
                                        <div className="progress-bar-track">
                                            <div className="progress-bar-fill"
                                                style={{ width: `${item.rate}%`, background: item.color }} />
                                        </div>
                                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                                            {item.completed} / {item.total}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6 s3">
                        {[
                            { label: 'Completed Routes', value: stats.completedRoutes, total: stats.totalRoutes, icon: 'route', color: '#00450d', bg: '#f0fdf4' },
                            { label: 'Published Schedules', value: stats.publishedSchedules, total: stats.totalSchedules, icon: 'calendar_month', color: '#1d4ed8', bg: '#eff6ff' },
                            { label: 'Resolved Complaints', value: stats.resolvedComplaints, total: stats.totalComplaints, icon: 'feedback', color: '#d97706', bg: '#fefce8' },
                            { label: 'Resolved Reports', value: stats.resolvedReports, total: stats.totalReports, icon: 'report', color: '#7c3aed', bg: '#f5f3ff' },
                        ].map(m => (
                            <div key={m.label} className="bento-card p-5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                                    style={{ background: m.bg }}>
                                    <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '18px' }}>{m.icon}</span>
                                </div>
                                <p className="font-headline font-extrabold text-2xl tracking-tight mb-0.5"
                                    style={{ color: '#181c22' }}>{m.value}</p>
                                <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    {m.label}
                                </p>
                                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                    of {m.total} total
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 s4">

                        {/* Collection Routes Bar */}
                        <div className="bento-card p-6">
                            <h3 className="font-headline font-bold text-lg mb-6" style={{ color: '#181c22' }}>
                                Collection Route Status
                            </h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={collectionData} barSize={48}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,69,13,0.06)" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontFamily: 'Inter' }} />
                                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                        {collectionData.map((entry, index) => (
                                            <Cell key={index} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Complaint Resolution Donut */}
                        <div className="bento-card p-6">
                            <h3 className="font-headline font-bold text-lg mb-6" style={{ color: '#181c22' }}>
                                Complaint Resolution
                            </h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={complaintData} cx="50%" cy="50%"
                                        innerRadius={65} outerRadius={90}
                                        paddingAngle={4} dataKey="value">
                                        {complaintData.map((entry, index) => (
                                            <Cell key={index} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontFamily: 'Inter' }} />
                                    <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: '13px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Waste types chart */}
                    {wasteTypeData.length > 0 && (
                        <div className="bento-card p-6 s5">
                            <h3 className="font-headline font-bold text-lg mb-6" style={{ color: '#181c22' }}>
                                Waste Types Scheduled
                            </h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={wasteTypeData} barSize={40}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,69,13,0.06)" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8', fontFamily: 'Inter' }} axisLine={false} tickLine={false}
                                        tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)} />
                                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontFamily: 'Inter' }} />
                                    <Bar dataKey="value" fill="#00450d" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Summary footer */}
                    <div className="mt-6 p-6 rounded-2xl s5"
                        style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.08)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '22px' }}>analytics</span>
                            <h3 className="font-headline font-bold" style={{ color: '#00450d' }}>Performance Summary</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { label: 'Route Completion Rate', rate: completionRate, color: '#00450d' },
                                { label: 'Complaint Resolution Rate', rate: resolutionRate, color: '#1d4ed8' },
                                { label: 'Report Resolution Rate', rate: reportResolutionRate, color: '#7c3aed' },
                            ].map(item => (
                                <div key={item.label}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <p style={{ fontSize: '13px', color: '#41493e', fontWeight: 500 }}>{item.label}</p>
                                        <p className="font-headline font-bold" style={{ color: item.color }}>{item.rate}%</p>
                                    </div>
                                    <div className="progress-bar-track">
                                        <div className="progress-bar-fill" style={{ width: `${item.rate}%`, background: item.color }} />
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