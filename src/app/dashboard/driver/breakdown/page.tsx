'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

const BREAKDOWN_TYPES = [
    { value: 'flat_tire', label: 'Flat Tire', icon: '🔧' },
    { value: 'engine_failure', label: 'Engine Failure', icon: '⚙️' },
    { value: 'battery_dead', label: 'Battery Dead', icon: '🔋' },
    { value: 'accident', label: 'Accident', icon: '🚨' },
    { value: 'fuel_empty', label: 'Fuel Empty', icon: '⛽' },
    { value: 'other', label: 'Other', icon: '🔩' },
]

const STATUS_COLORS: Record<string, string> = {
    reported: 'bg-red-100 text-red-700',
    assistance_sent: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
}

interface BreakdownReport {
    id: string
    vehicle_number: string
    location_address: string
    breakdown_type: string
    description: string
    status: string
    created_at: string
}

export default function BreakdownPage() {
    const [reports, setReports] = useState<BreakdownReport[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [activeRoute, setActiveRoute] = useState<any>(null)
    const [message, setMessage] = useState('')
    const [formData, setFormData] = useState({
        vehicle_number: '',
        location_address: '',
        breakdown_type: '',
        description: '',
    })

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

        const { data: routesData } = await supabase
            .from('routes')
            .select('*')
            .eq('driver_id', user.id)
            .eq('status', 'active')
            .limit(1)

        if (routesData && routesData.length > 0) {
            setActiveRoute(routesData[0])
            setFormData(prev => ({
                ...prev,
                vehicle_number: routesData[0].vehicle_number || ''
            }))
        }

        const { data: reportsData } = await supabase
            .from('breakdown_reports')
            .select('*')
            .eq('driver_id', user.id)
            .order('created_at', { ascending: false })

        setReports(reportsData || [])
        setLoading(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMessage('')

        if (!formData.breakdown_type) {
            setMessage('Please select a breakdown type')
            setSaving(false)
            return
        }

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase.from('breakdown_reports').insert({
            driver_id: user?.id,
            route_id: activeRoute?.id || null,
            vehicle_number: formData.vehicle_number,
            location_address: formData.location_address,
            breakdown_type: formData.breakdown_type,
            description: formData.description,
            status: 'reported',
        })

        if (error) {
            setMessage('Error: ' + error.message)
        } else {
            setMessage('Breakdown reported! Assistance has been notified.')
            setShowForm(false)
            setFormData({
                vehicle_number: activeRoute?.vehicle_number || '',
                location_address: '',
                breakdown_type: '',
                description: '',
            })
            loadData()
        }
        setSaving(false)
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
                    <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">Driver</span>
                    <LogoutButton />
                </div>
            </nav>

            <div className="max-w-4xl mx-auto p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/dashboard/driver" className="text-blue-600 hover:underline text-sm">
                        ← Back to Dashboard
                    </Link>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Report Breakdown</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Report vehicle breakdown for immediate assistance
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {showForm ? 'Cancel' : '🚨 Report Breakdown'}
                    </Button>
                </div>

                {message && (
                    <div className={`p-3 rounded-lg mb-4 text-sm ${message.startsWith('Error')
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-green-50 text-green-600 border border-green-200'
                        }`}>
                        {message}
                    </div>
                )}

                {showForm && (
                    <Card className="mb-6 border-red-200 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                                🚨 Vehicle Breakdown Report
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Breakdown Type</Label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {BREAKDOWN_TYPES.map((type) => (
                                            <div
                                                key={type.value}
                                                onClick={() => setFormData({ ...formData, breakdown_type: type.value })}
                                                className={`cursor-pointer rounded-xl border-2 p-3 transition-all text-center ${formData.breakdown_type === type.value
                                                        ? 'border-red-600 bg-red-50'
                                                        : 'border-slate-200 hover:border-red-300'
                                                    }`}
                                            >
                                                <span className="text-2xl">{type.icon}</span>
                                                <p className={`font-medium text-xs mt-1 ${formData.breakdown_type === type.value
                                                        ? 'text-red-700'
                                                        : 'text-slate-700'
                                                    }`}>
                                                    {type.label}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Vehicle Number</Label>
                                        <Input
                                            placeholder="WP CAB 1234"
                                            value={formData.vehicle_number}
                                            onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Current Location</Label>
                                        <Input
                                            placeholder="Street name or landmark"
                                            value={formData.location_address}
                                            onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <textarea
                                        className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-20"
                                        placeholder="Describe the breakdown in detail..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="bg-red-600 hover:bg-red-700 w-full"
                                    disabled={saving}
                                >
                                    {saving ? 'Reporting...' : '🚨 Report Emergency'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading reports...</div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <p className="text-lg">No breakdown reports</p>
                        <p className="text-sm mt-1">Click "Report Breakdown" if you have a vehicle issue</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <h2 className="text-lg font-semibold text-slate-800">Breakdown History</h2>
                        {reports.map((report) => {
                            const breakdownType = BREAKDOWN_TYPES.find(t => t.value === report.breakdown_type)
                            return (
                                <Card key={report.id} className="border-0 shadow-sm border-l-4 border-l-red-500">
                                    <CardContent className="py-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <span className="text-2xl">{breakdownType?.icon}</span>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-medium text-slate-800 text-sm">
                                                            {breakdownType?.label}
                                                        </p>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[report.status]}`}>
                                                            {report.status.replace('_', ' ').charAt(0).toUpperCase() +
                                                                report.status.replace('_', ' ').slice(1)}
                                                        </span>
                                                    </div>
                                                    <p className="text-slate-500 text-sm">{report.vehicle_number}</p>
                                                    <p className="text-slate-400 text-xs mt-1">
                                                        📍 {report.location_address}
                                                    </p>
                                                    {report.description && (
                                                        <p className="text-slate-500 text-xs mt-1">{report.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-slate-400 text-xs">
                                                {new Date(report.created_at).toLocaleDateString('en-GB', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </p>
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