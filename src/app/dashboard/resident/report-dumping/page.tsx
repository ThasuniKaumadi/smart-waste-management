'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

const REPORT_TYPES = [
    { value: 'illegal_dumping', label: 'Illegal Dumping', icon: '🚯', description: 'Someone dumping waste illegally in your area' },
    { value: 'missed_collection', label: 'Missed Collection', icon: '🗑️', description: 'Scheduled collection did not happen' },
    { value: 'blocked_drainage', label: 'Blocked Drainage', icon: '🌊', description: 'Waste blocking drainage or waterways' },
]

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
    created_at: string
}

export default function ReportDumpingPage() {
    const [reports, setReports] = useState<WasteReport[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [message, setMessage] = useState('')
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        report_type: '',
        description: '',
        location_address: '',
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

        const { data: reportsData } = await supabase
            .from('waste_reports')
            .select('*')
            .eq('submitted_by', user.id)
            .order('created_at', { ascending: false })

        setReports(reportsData || [])
        setLoading(false)
    }

    function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) {
            setPhotoFile(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMessage('')

        if (!formData.report_type) {
            setMessage('Please select a report type')
            setSaving(false)
            return
        }

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        let photoUrl = null

        if (photoFile) {
            const fileExt = photoFile.name.split('.').pop()
            const fileName = `${user?.id}-${Date.now()}.${fileExt}`

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('waste-reports')
                .upload(fileName, photoFile)

            if (!uploadError && uploadData) {
                const { data: urlData } = supabase.storage
                    .from('waste-reports')
                    .getPublicUrl(fileName)
                photoUrl = urlData.publicUrl
            }
        }

        const { error } = await supabase.from('waste_reports').insert({
            submitted_by: user?.id,
            report_type: formData.report_type,
            description: formData.description,
            location_address: formData.location_address,
            district: profile?.district,
            photo_url: photoUrl,
            status: 'pending',
        })

        if (error) {
            setMessage('Error: ' + error.message)
        } else {
            setMessage('Report submitted successfully!')
            setShowForm(false)
            setFormData({ report_type: '', description: '', location_address: '' })
            setPhotoFile(null)
            setPhotoPreview(null)
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
                    <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">Resident</span>
                    <LogoutButton />
                </div>
            </nav>

            <div className="max-w-4xl mx-auto p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/dashboard/resident" className="text-blue-600 hover:underline text-sm">
                        ← Back to Dashboard
                    </Link>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Report Waste Issue</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Report illegal dumping, missed collections or blocked drainage
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {showForm ? 'Cancel' : '+ New Report'}
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
                    <Card className="mb-6 border-blue-200 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg text-slate-800">Submit Waste Report</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Report Type</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {REPORT_TYPES.map((type) => (
                                            <div
                                                key={type.value}
                                                onClick={() => setFormData({ ...formData, report_type: type.value })}
                                                className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${formData.report_type === type.value
                                                        ? 'border-blue-600 bg-blue-50'
                                                        : 'border-slate-200 hover:border-blue-300'
                                                    }`}
                                            >
                                                <span className="text-2xl">{type.icon}</span>
                                                <p className={`font-medium text-sm mt-2 ${formData.report_type === type.value ? 'text-blue-700' : 'text-slate-800'
                                                    }`}>
                                                    {type.label}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">{type.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Location / Address</Label>
                                    <Input
                                        placeholder="Where is the issue? (street, landmark)"
                                        value={formData.location_address}
                                        onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <textarea
                                        className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24"
                                        placeholder="Describe the issue in detail..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Photo Evidence</Label>
                                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                                        {photoPreview ? (
                                            <div className="space-y-2">
                                                <img
                                                    src={photoPreview}
                                                    alt="Preview"
                                                    className="max-h-48 mx-auto rounded-lg object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                                                    className="text-red-500 text-xs hover:underline"
                                                >
                                                    Remove photo
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-slate-400 text-sm mb-2">Upload a photo of the issue</p>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handlePhotoChange}
                                                    className="text-sm text-slate-500"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-700"
                                    disabled={saving}
                                >
                                    {saving ? 'Submitting...' : 'Submit Report'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading reports...</div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <p className="text-lg">No reports submitted yet</p>
                        <p className="text-sm mt-1">Click "New Report" to report a waste issue</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-slate-800">My Reports</h2>
                        {reports.map((report) => {
                            const reportType = REPORT_TYPES.find(t => t.value === report.report_type)
                            return (
                                <Card key={report.id} className="border-0 shadow-sm">
                                    <CardContent className="py-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <span className="text-2xl">{reportType?.icon}</span>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-medium text-slate-800 text-sm">
                                                            {reportType?.label}
                                                        </p>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[report.status]}`}>
                                                            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                                                        </span>
                                                    </div>
                                                    <p className="text-slate-600 text-sm">{report.description}</p>
                                                    <p className="text-slate-400 text-xs mt-1">
                                                        📍 {report.location_address}
                                                    </p>
                                                    <p className="text-slate-400 text-xs mt-1">
                                                        {new Date(report.created_at).toLocaleDateString('en-GB', {
                                                            day: 'numeric', month: 'short', year: 'numeric'
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                            {report.photo_url && (
                                                <img
                                                    src={report.photo_url}
                                                    alt="Report photo"
                                                    className="w-16 h-16 rounded-lg object-cover ml-4"
                                                />
                                            )}
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