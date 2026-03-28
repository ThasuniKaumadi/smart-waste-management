'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2']

export default function AdminPerformancePage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalRoutes: 0,
        totalComplaints: 0,
        resolvedComplaints: 0,
        totalReports: 0,
        totalSchedules: 0,
        totalCollections: 0,
        blockchainRecords: 0,
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
            { count: totalUsers },
            { count: totalRoutes },
            { count: totalComplaints },
            { count: resolvedComplaints },
            { count: totalReports },
            { count: totalSchedules },
            { count: totalCollections },
            { count: blockchainRecords },
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
            totalUsers: totalUsers || 0,
            totalRoutes: totalRoutes || 0,
            totalComplaints: totalComplaints || 0,
            resolvedComplaints: resolvedComplaints || 0,
            totalReports: totalReports || 0,
            totalSchedules: totalSchedules || 0,
            totalCollections: totalCollections || 0,
            blockchainRecords: blockchainRecords || 0,
        })

        const { data: complaintsData } = await supabase
            .from('complaints')
            .select('district')

        if (complaintsData) {
            const districtCounts: Record<string, number> = {}
            complaintsData.forEach(c => {
                if (c.district) districtCounts[c.district] = (districtCounts[c.district] || 0) + 1
            })
            setDistrictData(Object.entries(districtCounts).map(([name, value]) => ({ name: name.replace('Colombo ', 'Col '), value })))
        }

        const { data: complaintTypes } = await supabase
            .from('complaints')
            .select('complaint_type')

        if (complaintTypes) {
            const typeCounts: Record<string, number> = {}
            complaintTypes.forEach(c => {
                if (c.complaint_type) typeCounts[c.complaint_type] = (typeCounts[c.complaint_type] || 0) + 1
            })
            setComplaintTypeData(Object.entries(typeCounts).map(([name, value]) => ({
                name: name.replace('_', ' '),
                value
            })))
        }

        const { data: rolesData } = await supabase
            .from('profiles')
            .select('role')

        if (rolesData) {
            const roleCounts: Record<string, number> = {}
            rolesData.forEach(r => {
                if (r.role) roleCounts[r.role] = (roleCounts[r.role] || 0) + 1
            })
            setRoleData(Object.entries(roleCounts).map(([name, value]) => ({
                name: name.replace('_', ' '),
                value
            })))
        }

        setLoading(false)
    }

    const resolutionRate = stats.totalComplaints > 0
        ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100)
        : 0

    const blockchainRate = stats.totalCollections > 0
        ? Math.round((stats.blockchainRecords / stats.totalCollections) * 100)
        : 0

    return (
        <div className="min-h-screen bg-slate-50">
            <nav className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shadow">
                <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="font-semibold text-lg">Smart Waste Management</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-blue-100 text-sm">{profile?.full_name}</span>
                    <span className="bg-red-500 text-xs px-2 py-1 rounded-full">Admin</span>
                    <LogoutButton />
                </div>
            </nav>

            <div className="max-w-6xl mx-auto p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/dashboard/admin" className="text-blue-600 hover:underline text-sm">
                        ← Back to Dashboard
                    </Link>
                </div>

                <h1 className="text-2xl font-bold text-slate-800 mb-2">System Overview</h1>
                <p className="text-slate-500 text-sm mb-6">Overall performance across all districts — Colombo Municipal Council</p>

                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading system data...</div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <Card className="bg-blue-600 text-white border-0">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs text-blue-100">Total Users</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold">{stats.totalUsers}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-green-600 text-white border-0">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs text-green-100">Total Routes</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold">{stats.totalRoutes}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-orange-500 text-white border-0">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs text-orange-100">Total Complaints</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold">{stats.totalComplaints}</p>
                                    <p className="text-orange-200 text-xs mt-1">{resolutionRate}% resolved</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-purple-600 text-white border-0">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs text-purple-100">Blockchain Records</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold">{stats.blockchainRecords}</p>
                                    <p className="text-purple-200 text-xs mt-1">{blockchainRate}% on-chain</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <Card className="border-0 shadow-sm">
                                <CardContent className="py-4">
                                    <p className="text-slate-500 text-xs">Schedules</p>
                                    <p className="text-2xl font-bold text-slate-800">{stats.totalSchedules}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-sm">
                                <CardContent className="py-4">
                                    <p className="text-slate-500 text-xs">Waste Reports</p>
                                    <p className="text-2xl font-bold text-slate-800">{stats.totalReports}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-sm">
                                <CardContent className="py-4">
                                    <p className="text-slate-500 text-xs">Collections</p>
                                    <p className="text-2xl font-bold text-slate-800">{stats.totalCollections}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-sm">
                                <CardContent className="py-4">
                                    <p className="text-slate-500 text-xs">Resolution Rate</p>
                                    <p className="text-2xl font-bold text-slate-800">{resolutionRate}%</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <Card className="border-0 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-base text-slate-700">Complaints by District</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {districtData.length === 0 ? (
                                        <p className="text-slate-400 text-sm text-center py-8">No data yet</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={200}>
                                            <BarChart data={districtData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                                <YAxis tick={{ fontSize: 11 }} />
                                                <Tooltip />
                                                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-0 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-base text-slate-700">Complaint Types</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {complaintTypeData.length === 0 ? (
                                        <p className="text-slate-400 text-sm text-center py-8">No data yet</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={200}>
                                            <PieChart>
                                                <Pie
                                                    data={complaintTypeData}
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={70}
                                                    dataKey="value"
                                                    label={({ name, value }) => `${name}: ${value}`}
                                                >
                                                    {complaintTypeData.map((_, index) => (
                                                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border-0 shadow-sm mb-6">
                            <CardHeader>
                                <CardTitle className="text-base text-slate-700">Users by Role</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {roleData.length === 0 ? (
                                    <p className="text-slate-400 text-sm text-center py-8">No data yet</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={roleData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                            <YAxis tick={{ fontSize: 11 }} />
                                            <Tooltip />
                                            <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-blue-700 text-sm font-medium mb-3">System Health</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-slate-600 text-sm">Complaint Resolution Rate</p>
                                    <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${resolutionRate}%` }} />
                                    </div>
                                    <p className="text-slate-500 text-xs mt-1">{resolutionRate}%</p>
                                </div>
                                <div>
                                    <p className="text-slate-600 text-sm">Blockchain Verification Rate</p>
                                    <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                                        <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${blockchainRate}%` }} />
                                    </div>
                                    <p className="text-slate-500 text-xs mt-1">{blockchainRate}%</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}