'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed']

export default function DistrictPerformancePage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalRoutes: 0,
        completedRoutes: 0,
        totalComplaints: 0,
        resolvedComplaints: 0,
        totalReports: 0,
        resolvedReports: 0,
        totalSchedules: 0,
    })
    const [collectionData, setCollectionData] = useState<any[]>([])
    const [complaintData, setComplaintData] = useState<any[]>([])
    const [wasteTypeData, setWasteTypeData] = useState<any[]>([])

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        setProfile(profileData)
        const district = profileData?.district || ''

        const [
            { count: totalRoutes },
            { count: completedRoutes },
            { count: totalComplaints },
            { count: resolvedComplaints },
            { count: totalReports },
            { count: resolvedReports },
            { count: totalSchedules },
        ] = await Promise.all([
            supabase.from('routes').select('*', { count: 'exact', head: true }).eq('district', district),
            supabase.from('routes').select('*', { count: 'exact', head: true }).eq('district', district).eq('status', 'completed'),
            supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('district', district),
            supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('district', district).eq('status', 'resolved'),
            supabase.from('waste_reports').select('*', { count: 'exact', head: true }).eq('district', district),
            supabase.from('waste_reports').select('*', { count: 'exact', head: true }).eq('district', district).eq('status', 'resolved'),
            supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('district', district),
        ])

        setStats({
            totalRoutes: totalRoutes || 0,
            completedRoutes: completedRoutes || 0,
            totalComplaints: totalComplaints || 0,
            resolvedComplaints: resolvedComplaints || 0,
            totalReports: totalReports || 0,
            resolvedReports: resolvedReports || 0,
            totalSchedules: totalSchedules || 0,
        })

        setCollectionData([
            { name: 'Completed', value: completedRoutes || 0, fill: '#16a34a' },
            { name: 'Active', value: (totalRoutes || 0) - (completedRoutes || 0), fill: '#2563eb' },
        ])

        setComplaintData([
            { name: 'Resolved', value: resolvedComplaints || 0, fill: '#16a34a' },
            { name: 'Pending', value: (totalComplaints || 0) - (resolvedComplaints || 0), fill: '#dc2626' },
        ])

        const { data: schedulesData } = await supabase
            .from('schedules')
            .select('waste_type')
            .eq('district', district)

        if (schedulesData) {
            const wasteCounts: Record<string, number> = {}
            schedulesData.forEach(s => {
                wasteCounts[s.waste_type] = (wasteCounts[s.waste_type] || 0) + 1
            })
            setWasteTypeData(Object.entries(wasteCounts).map(([name, value]) => ({
                name: name.replace('_', ' '),
                value
            })))
        }

        setLoading(false)
    }

    const completionRate = stats.totalRoutes > 0
        ? Math.round((stats.completedRoutes / stats.totalRoutes) * 100)
        : 0

    const resolutionRate = stats.totalComplaints > 0
        ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100)
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
                    <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">District Engineer</span>
                    <LogoutButton />
                </div>
            </nav>

            <div className="max-w-6xl mx-auto p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/dashboard/district-engineer" className="text-blue-600 hover:underline text-sm">
                        ← Back to Dashboard
                    </Link>
                </div>

                <h1 className="text-2xl font-bold text-slate-800 mb-2">District Performance</h1>
                <p className="text-slate-500 text-sm mb-6">District: {profile?.district}</p>

                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading performance data...</div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <Card className="bg-blue-600 text-white border-0">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-medium text-blue-100">Total Routes</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold">{stats.totalRoutes}</p>
                                    <p className="text-blue-200 text-xs mt-1">{completionRate}% completed</p>
                                </CardContent>
                            </Card>

                            <Card className="bg-green-600 text-white border-0">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-medium text-green-100">Schedules</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold">{stats.totalSchedules}</p>
                                    <p className="text-green-200 text-xs mt-1">Active schedules</p>
                                </CardContent>
                            </Card>

                            <Card className="bg-orange-500 text-white border-0">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-medium text-orange-100">Complaints</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold">{stats.totalComplaints}</p>
                                    <p className="text-orange-200 text-xs mt-1">{resolutionRate}% resolved</p>
                                </CardContent>
                            </Card>

                            <Card className="bg-purple-600 text-white border-0">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-medium text-purple-100">Waste Reports</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold">{stats.totalReports}</p>
                                    <p className="text-purple-200 text-xs mt-1">{stats.resolvedReports} resolved</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <Card className="border-0 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-base text-slate-700">Collection Route Status</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={collectionData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                {collectionData.map((entry, index) => (
                                                    <Cell key={index} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card className="border-0 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-base text-slate-700">Complaint Resolution</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <PieChart>
                                            <Pie
                                                data={complaintData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {complaintData.map((entry, index) => (
                                                    <Cell key={index} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>

                        {wasteTypeData.length > 0 && (
                            <Card className="border-0 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-base text-slate-700">Waste Types Scheduled</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={wasteTypeData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip />
                                            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-blue-700 text-sm font-medium">Performance Summary</p>
                            <div className="grid grid-cols-2 gap-4 mt-3">
                                <div>
                                    <p className="text-slate-600 text-sm">Route Completion Rate</p>
                                    <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                                        <div
                                            className="bg-green-500 h-2 rounded-full"
                                            style={{ width: `${completionRate}%` }}
                                        />
                                    </div>
                                    <p className="text-slate-500 text-xs mt-1">{completionRate}%</p>
                                </div>
                                <div>
                                    <p className="text-slate-600 text-sm">Complaint Resolution Rate</p>
                                    <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full"
                                            style={{ width: `${resolutionRate}%` }}
                                        />
                                    </div>
                                    <p className="text-slate-500 text-xs mt-1">{resolutionRate}%</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}