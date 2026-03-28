'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

interface FuelLog {
    id: string
    vehicle_number: string
    fuel_amount: number
    fuel_cost: number
    odometer_reading: number
    fuel_station: string
    date: string
    notes: string
}

export default function FuelLogPage() {
    const [logs, setLogs] = useState<FuelLog[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [activeRoute, setActiveRoute] = useState<any>(null)
    const [message, setMessage] = useState('')
    const [formData, setFormData] = useState({
        vehicle_number: '',
        fuel_amount: '',
        fuel_cost: '',
        odometer_reading: '',
        fuel_station: '',
        notes: '',
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

        const { data: logsData } = await supabase
            .from('fuel_logs')
            .select('*')
            .eq('driver_id', user.id)
            .order('created_at', { ascending: false })

        setLogs(logsData || [])
        setLoading(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMessage('')

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase.from('fuel_logs').insert({
            driver_id: user?.id,
            route_id: activeRoute?.id || null,
            vehicle_number: formData.vehicle_number,
            fuel_amount: parseFloat(formData.fuel_amount),
            fuel_cost: parseFloat(formData.fuel_cost),
            odometer_reading: formData.odometer_reading ? parseFloat(formData.odometer_reading) : null,
            fuel_station: formData.fuel_station,
            notes: formData.notes,
        })

        if (error) {
            setMessage('Error: ' + error.message)
        } else {
            setMessage('Fuel log recorded successfully!')
            setShowForm(false)
            setFormData({
                vehicle_number: activeRoute?.vehicle_number || '',
                fuel_amount: '',
                fuel_cost: '',
                odometer_reading: '',
                fuel_station: '',
                notes: '',
            })
            loadData()
        }
        setSaving(false)
    }

    const totalFuel = logs.reduce((sum, log) => sum + log.fuel_amount, 0)
    const totalCost = logs.reduce((sum, log) => sum + log.fuel_cost, 0)

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
                        <h1 className="text-2xl font-bold text-slate-800">Fuel Log</h1>
                        <p className="text-slate-500 text-sm mt-1">Record fuel refill data and odometer readings</p>
                    </div>
                    <Button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {showForm ? 'Cancel' : '+ Record Fuel'}
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <Card className="bg-blue-600 text-white border-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-blue-100">Total Fuel (L)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{totalFuel.toFixed(1)}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-600 text-white border-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-green-100">Total Cost (LKR)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{totalCost.toFixed(0)}</p>
                        </CardContent>
                    </Card>
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
                            <CardTitle className="text-lg text-slate-800">Record Fuel Refill</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    <Label>Fuel Station</Label>
                                    <Input
                                        placeholder="Ceylon Petroleum, Colombo 1"
                                        value={formData.fuel_station}
                                        onChange={(e) => setFormData({ ...formData, fuel_station: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Fuel Amount (Litres)</Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        placeholder="45.5"
                                        value={formData.fuel_amount}
                                        onChange={(e) => setFormData({ ...formData, fuel_amount: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Total Cost (LKR)</Label>
                                    <Input
                                        type="number"
                                        placeholder="13650"
                                        value={formData.fuel_cost}
                                        onChange={(e) => setFormData({ ...formData, fuel_cost: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Odometer Reading (km)</Label>
                                    <Input
                                        type="number"
                                        placeholder="45230"
                                        value={formData.odometer_reading}
                                        onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Notes (optional)</Label>
                                    <Input
                                        placeholder="Any additional notes"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <Button
                                        type="submit"
                                        className="bg-blue-600 hover:bg-blue-700"
                                        disabled={saving}
                                    >
                                        {saving ? 'Saving...' : 'Save Fuel Log'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading fuel logs...</div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <p className="text-lg">No fuel logs yet</p>
                        <p className="text-sm mt-1">Click "Record Fuel" to add your first entry</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <h2 className="text-lg font-semibold text-slate-800">Fuel History</h2>
                        {logs.map((log) => (
                            <Card key={log.id} className="border-0 shadow-sm border-l-4 border-l-blue-500">
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <p className="font-medium text-slate-800 text-sm">
                                                    {log.vehicle_number}
                                                </p>
                                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                                                    {log.fuel_amount}L
                                                </span>
                                                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                                                    LKR {log.fuel_cost}
                                                </span>
                                            </div>
                                            <p className="text-slate-500 text-xs">
                                                ⛽ {log.fuel_station}
                                            </p>
                                            {log.odometer_reading && (
                                                <p className="text-slate-400 text-xs mt-0.5">
                                                    Odometer: {log.odometer_reading} km
                                                </p>
                                            )}
                                        </div>
                                        <p className="text-slate-400 text-xs">
                                            {new Date(log.date).toLocaleDateString('en-GB', {
                                                day: 'numeric', month: 'short', year: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}