'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'

const SKIP_REASONS = [
  { value: 'wrong_waste_type', label: 'Wrong waste type for today' },
  { value: 'access_denied', label: 'Access denied / locked gate' },
  { value: 'vehicle_breakdown', label: 'Vehicle breakdown' },
  { value: 'no_waste_out', label: 'No waste put out' },
  { value: 'other', label: 'Other reason' },
]

interface Stop {
  id: string
  address: string
  stop_order: number
  status: string
  skip_reason: string
  bin_count: number
  blockchain_tx: string
}

interface Route {
  id: string
  route_name: string
  district: string
  vehicle_number: string
  date: string
  status: string
}

export default function DriverRoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [stops, setStops] = useState<Stop[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [updatingStop, setUpdatingStop] = useState<string | null>(null)
  const [selectedSkipReason, setSelectedSkipReason] = useState<Record<string, string>>({})
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

    const { data: routesData } = await supabase
      .from('routes')
      .select('*')
      .eq('driver_id', user.id)
      .in('status', ['pending', 'active'])
      .order('date', { ascending: true })

    setRoutes(routesData || [])
    setLoading(false)
  }

  async function loadStops(route: Route) {
    setSelectedRoute(route)
    const supabase = createClient()

    const { data: stopsData } = await supabase
      .from('collection_stops')
      .select('*')
      .eq('route_id', route.id)
      .order('stop_order', { ascending: true })

    setStops(stopsData || [])
  }

  async function markStop(stop: Stop, status: 'completed' | 'skipped') {
    if (status === 'skipped' && !selectedSkipReason[stop.id]) {
      setMessage('Please select a reason before skipping')
      return
    }

    setUpdatingStop(stop.id)
    setMessage('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const updateData: any = {
      status,
      completed_at: new Date().toISOString(),
    }

    if (status === 'skipped') {
      updateData.skip_reason = selectedSkipReason[stop.id]
    }

    const { error } = await supabase
      .from('collection_stops')
      .update(updateData)
      .eq('id', stop.id)

    if (!error) {
      await supabase.from('collection_events').insert({
        route_id: selectedRoute?.id,
        driver_id: user?.id,
        address: stop.address,
        status,
        skip_reason: status === 'skipped' ? selectedSkipReason[stop.id] : null,
      })

      if (selectedRoute) loadStops(selectedRoute)
      setMessage(status === 'completed' ? '✓ Collection marked as completed' : '✓ Stop skipped')
    }

    setUpdatingStop(null)
  }

  const completedCount = stops.filter(s => s.status === 'completed').length
  const skippedCount = stops.filter(s => s.status === 'skipped').length
  const pendingCount = stops.filter(s => s.status === 'pending').length

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
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/driver" className="text-blue-600 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-6">My Routes</h1>

        {message && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${
            message.startsWith('Please')
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-green-50 text-green-600 border border-green-200'
          }`}>
            {message}
          </div>
        )}

        {!selectedRoute ? (
          loading ? (
            <div className="text-center py-12 text-slate-400">Loading routes...</div>
          ) : routes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-lg">No active routes assigned</p>
              <p className="text-sm mt-1">Your contractor will assign routes to you</p>
            </div>
          ) : (
            <div className="space-y-4">
              {routes.map((route) => (
                <Card
                  key={route.id}
                  className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                  onClick={() => loadStops(route)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{route.route_name}</p>
                        <p className="text-slate-500 text-sm">{route.district}</p>
                        <p className="text-slate-400 text-xs mt-1">
                          {new Date(route.date).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })} | Vehicle: {route.vehicle_number}
                        </p>
                      </div>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        Start Route →
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{selectedRoute.route_name}</h2>
                <p className="text-slate-500 text-sm">{selectedRoute.district} | {selectedRoute.vehicle_number}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRoute(null)}
              >
                ← Back to Routes
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{completedCount}</p>
                <p className="text-xs text-green-600">Completed</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{skippedCount}</p>
                <p className="text-xs text-red-600">Skipped</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
                <p className="text-xs text-yellow-600">Remaining</p>
              </div>
            </div>

            <div className="space-y-3">
              {stops.map((stop) => (
                <Card key={stop.id} className={`border-0 shadow-sm border-l-4 ${
                  stop.status === 'completed' ? 'border-l-green-500' :
                  stop.status === 'skipped' ? 'border-l-red-500' :
                  'border-l-slate-300'
                }`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-slate-400 text-xs font-medium">
                            Stop {stop.stop_order}
                          </span>
                          {stop.status !== 'pending' && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              stop.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {stop.status === 'completed' ? 'Completed' : 'Skipped'}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-800 text-sm font-medium">{stop.address}</p>
                        {stop.skip_reason && (
                          <p className="text-red-500 text-xs mt-1">
                            Reason: {SKIP_REASONS.find(r => r.value === stop.skip_reason)?.label}
                          </p>
                        )}
                      </div>

                      {stop.status === 'pending' && (
                        <div className="flex flex-col gap-2 min-w-48">
                          <Select
                            onValueChange={(v) => setSelectedSkipReason({
                              ...selectedSkipReason,
                              [stop.id]: v
                            })}
                          >
                            <SelectTrigger className="text-xs h-8">
                              <SelectValue placeholder="Skip reason (if needed)" />
                            </SelectTrigger>
                            <SelectContent>
                              {SKIP_REASONS.map(r => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => markStop(stop, 'completed')}
                              disabled={updatingStop === stop.id}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-xs h-8"
                            >
                              ✓ Done
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => markStop(stop, 'skipped')}
                              disabled={updatingStop === stop.id}
                              className="flex-1 bg-red-500 hover:bg-red-600 text-xs h-8"
                            >
                              ✕ Skip
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}