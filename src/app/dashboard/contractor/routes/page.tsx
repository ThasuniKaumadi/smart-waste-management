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
import { DISTRICTS } from '@/lib/types'

interface Route {
  id: string
  route_name: string
  district: string
  vehicle_number: string
  date: string
  status: string
  driver_id: string
  profiles: { full_name: string }
}

interface Driver {
  id: string
  full_name: string
  district: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function ContractorRoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [stops, setStops] = useState([''])
  const [formData, setFormData] = useState({
    route_name: '',
    district: '',
    driver_id: '',
    vehicle_number: '',
    date: new Date().toISOString().split('T')[0],
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
      .select(`*, profiles(full_name)`)
      .eq('contractor_id', user.id)
      .order('date', { ascending: false })

    setRoutes(routesData || [])

    const { data: driversData } = await supabase
      .from('profiles')
      .select('id, full_name, district')
      .eq('role', 'driver')

    setDrivers(driversData || [])
    setLoading(false)
  }

  function addStop() {
    setStops([...stops, ''])
  }

  function removeStop(index: number) {
    setStops(stops.filter((_, i) => i !== index))
  }

  function updateStop(index: number, value: string) {
    const updated = [...stops]
    updated[index] = value
    setStops(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const validStops = stops.filter(s => s.trim() !== '')
    if (validStops.length === 0) {
      setMessage('Please add at least one collection stop')
      setSaving(false)
      return
    }

    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .insert({
        ...formData,
        contractor_id: user?.id,
        status: 'pending',
      })
      .select()
      .single()

    if (routeError) {
      setMessage('Error: ' + routeError.message)
      setSaving(false)
      return
    }

    const stopsToInsert = validStops.map((address, index) => ({
      route_id: routeData.id,
      address,
      stop_order: index + 1,
      status: 'pending',
    }))

    const { error: stopsError } = await supabase
      .from('collection_stops')
      .insert(stopsToInsert)

    if (stopsError) {
      setMessage('Error creating stops: ' + stopsError.message)
    } else {
      setMessage('Route created successfully!')
      setShowForm(false)
      setFormData({
        route_name: '',
        district: '',
        driver_id: '',
        vehicle_number: '',
        date: new Date().toISOString().split('T')[0],
      })
      setStops([''])
      loadData()
    }
    setSaving(false)
  }

  async function updateRouteStatus(routeId: string, status: string) {
    const supabase = createClient()
    await supabase.from('routes').update({ status }).eq('id', routeId)
    loadData()
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
          <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">Contractor</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/contractor" className="text-blue-600 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Route Management</h1>
            <p className="text-slate-500 text-sm mt-1">Assign drivers and vehicles to collection routes</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : '+ New Route'}
          </Button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${
            message.startsWith('Error')
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-green-50 text-green-600 border border-green-200'
          }`}>
            {message}
          </div>
        )}

        {showForm && (
          <Card className="mb-6 border-blue-200 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg text-slate-800">Create New Route</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Route Name</Label>
                    <Input
                      placeholder="e.g. Colombo 1 Morning Route"
                      value={formData.route_name}
                      onChange={(e) => setFormData({ ...formData, route_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>District</Label>
                    <Select onValueChange={(v) => setFormData({ ...formData, district: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {DISTRICTS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Assign Driver</Label>
                    <Select onValueChange={(v) => setFormData({ ...formData, driver_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.length === 0 ? (
                          <SelectItem value="none" disabled>No drivers available</SelectItem>
                        ) : (
                          drivers.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Vehicle Number</Label>
                    <Input
                      placeholder="e.g. WP CAB 1234"
                      value={formData.vehicle_number}
                      onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Collection Stops</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addStop}
                      className="text-blue-600 border-blue-300"
                    >
                      + Add Stop
                    </Button>
                  </div>
                  {stops.map((stop, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm w-6">{index + 1}.</span>
                      <Input
                        placeholder={`Stop ${index + 1} address`}
                        value={stop}
                        onChange={(e) => updateStop(index, e.target.value)}
                        className="flex-1"
                      />
                      {stops.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removeStop(index)}
                          className="text-red-500 border-red-300"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={saving}
                >
                  {saving ? 'Creating...' : 'Create Route'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading routes...</div>
        ) : routes.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-lg">No routes created yet</p>
            <p className="text-sm mt-1">Click "New Route" to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {routes.map((route) => (
              <Card key={route.id} className={`border-0 shadow-sm border-l-4 ${
                route.status === 'completed' ? 'border-l-green-500' :
                route.status === 'active' ? 'border-l-blue-500' :
                route.status === 'cancelled' ? 'border-l-red-500' :
                'border-l-yellow-500'
              }`}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium text-slate-800">{route.route_name}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[route.status]}`}>
                          {route.status.charAt(0).toUpperCase() + route.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-slate-500 text-sm">
                        {route.district} — {new Date(route.date).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        Driver: {route.profiles?.full_name || 'Not assigned'} |
                        Vehicle: {route.vehicle_number}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {route.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => updateRouteStatus(route.id, 'active')}
                          className="bg-blue-600 hover:bg-blue-700 text-xs"
                        >
                          Activate
                        </Button>
                      )}
                      {route.status === 'active' && (
                        <Button
                          size="sm"
                          onClick={() => updateRouteStatus(route.id, 'completed')}
                          className="bg-green-600 hover:bg-green-700 text-xs"
                        >
                          Complete
                        </Button>
                      )}
                    </div>
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