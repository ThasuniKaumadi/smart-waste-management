'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

const REPORT_TYPES: Record<string, { label: string; icon: string }> = {
    illegal_dumping: { label: 'Illegal Dumping', icon: '🚯' },
    missed_collection: { label: 'Missed Collection', icon: '🗑️' },
    blocked_drainage: { label: 'Blocked Drainage', icon: '🌊' },
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    assigned: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
}

interface WasteReport {
    id: string
    report_type: string
    description: string
    location_address: string
    status: string
    photo_url: string
    district: string
    resolution_notes: string
    created_at: string
    profiles: { full_name: string }
}

export default function EngineerWasteReportsPage() {
    const [reports, setReports] = useState<WasteReport[]>([])
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<any>(null)
    const [filterStatus, setFilterStatus] = useState('all')
    const [selectedReport, setSelectedReport] = useState<WasteReport | null>(null)
    const [resolutionNotes, setResolutionNotes] = useState('')
    const [updating, setUpdating] = useState(false)
    const [message, setMessage] = useState('')

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

        const { data: reportsData } = await supabase
            .from('waste_reports')
            .select(`*, profiles(full_name)`)
            .eq('district', profileData?.district || '')
            .order('created_at', { ascending: false })

        setReports(reportsData || [])
        setLoading(false)
    }

    async function updateStatus(report: WasteReport, newStatus: string) {
        setUpdating(true)
        const supabase = createClient()

        await supabase
            .from('waste_reports')
            .update({
                status: newStatus,
                resolution_notes: resolutionNotes,
            })
            .eq('id', report.id)

        setMessage('Report updated successfully!')
        setSelectedReport(null)
        setResolutionNotes('')
        loadData()
        setUpdating(false)
    }

    const filteredReports = filterStatus === 'all'
        ? reports
        : reports.filter(r => r.status === filterStatus)

    const counts = {
        all: reports.length,
        pending: reports.filter(r => r.status === 'pending').length,
        assigned: reports.filter(r => r.status === 'assigned').length,
        resolved: reports.filter(r => r.status === 'resolved').length,
    }

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

                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Waste Reports</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            District: {profile?.district}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                        { key: 'all', label: 'All', color: 'bg-slate-600' },
                        { key: 'pending', label: 'Pending', color: 'bg-yellow-500' },
                        { key: 'assigned', label: 'Assigned', color: 'bg-blue-500' },
                        { key: 'resolved', label: 'Resolved', color: 'bg-green-500' },
                    ].map(item => (
                        <button
                            key={item.key}
                            onClick={() => setFilterStatus(item.key)}
                            className={`p-4 rounded-lg text-white text-left transition-opacity ${item.color} ${filterStatus === item.key ? 'opacity-100 shadow-md' : 'opacity-60'
                                }`}
                        >
                            <p className="text-2xl font-bold">
                                {counts[item.key as keyof typeof counts]}
                            </p>
                            <p className="text-xs mt-1 opacity-90">{item.label}</p>
                        </button>
                    ))}
                </div>

                {message && (
                    <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg border border-green-200 mb-4">
                        {message}
                    </div>
                )}

                {selectedReport && (
                    <Card className="mb-6 border-blue-200 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg text-slate-800">Update Report Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-slate-50 p-3 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                    <span>{REPORT_TYPES[selectedReport.report_type]?.icon}</span>
                                    <p className="font-medium text-slate-800 text-sm">
                                        {REPORT_TYPES[selectedReport.report_type]?.label}
                                    </p>
                                </div>
                                <p className="text-slate-600 text-sm">{selectedReport.description}</p>
                                <p className="text-slate-400 text-xs mt-1">
                                    📍 {selectedReport.location_address}
                                </p>
                                <p className="text-slate-400 text-xs">
                                    By: {selectedReport.profiles?.full_name}
                                </p>
                            </div>

                            {selectedReport.photo_url && (
                                <img
                                    src={selectedReport.photo_url}
                                    alt="Report photo"
                                    className="max-h-48 rounded-lg object-cover"
                                />
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Resolution Notes
                                </label>
                                <textarea
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-20"
                                    placeholder="Add notes about action taken..."
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={() => updateStatus(selectedReport, 'assigned')}
                                    disabled={updating}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    Mark Assigned
                                </Button>
                                <Button
                                    onClick={() => updateStatus(selectedReport, 'resolved')}
                                    disabled={updating}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    Mark Resolved
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedReport(null)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading reports...</div>
                ) : filteredReports.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <p className="text-lg">No reports found</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredReports.map((report) => {
                            const reportType = REPORT_TYPES[report.report_type]
                            return (
                                <Card key={report.id} className={`border-0 shadow-sm border-l-4 ${report.status === 'resolved' ? 'border-l-green-500' :
                                        report.status === 'assigned' ? 'border-l-blue-500' :
                                            'border-l-yellow-500'
                                    }`}>
                                    <CardContent className="py-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3 flex-1">
                                                <span className="text-2xl">{reportType?.icon}</span>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-medium text-slate-800 text-sm">
                                                            {reportType?.label}
                                                        </p>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[report.status]}`}>
                                                            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                                                        </span>
                                                    </div>
                                                    <p className="text-slate-600 text-sm">{report.description}</p>
                                                    <div className="flex items-center gap-4 mt-1">
                                                        <p className="text-slate-400 text-xs">
                                                            📍 {report.location_address}
                                                        </p>
                                                        <p className="text-slate-400 text-xs">
                                                            By: {report.profiles?.full_name}
                                                        </p>
                                                        <p className="text-slate-400 text-xs">
                                                            {new Date(report.created_at).toLocaleDateString('en-GB', {
                                                                day: 'numeric', month: 'short', year: 'numeric'
                                                            })}
                                                        </p>
                                                    </div>
                                                    {report.resolution_notes && (
                                                        <p className="text-slate-500 text-xs mt-1 italic">
                                                            Note: {report.resolution_notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 ml-4">
                                                {report.photo_url && (
                                                    <img
                                                        src={report.photo_url}
                                                        alt="Report"
                                                        className="w-16 h-16 rounded-lg object-cover"
                                                    />
                                                )}
                                                {report.status !== 'resolved' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSelectedReport(report)
                                                            setResolutionNotes(report.resolution_notes || '')
                                                        }}
                                                        className="border-blue-300 text-blue-600"
                                                    >
                                                        Update
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}