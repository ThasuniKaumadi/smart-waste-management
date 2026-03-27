'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default function DriverLocationPage() {
  const [tracking, setTracking] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [activeRoute, setActiveRoute] = useState<any>(null)
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId)
    }
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

  const { data: routesData, error } = await supabase
    .from('routes')
    .select('*')
    .eq('driver_id', user.id)

  console.log('User ID:', user.id)
  console.log('Routes found:', routesData)
  console.log('Error:', error)

  const activeRoute = routesData?.find(r => r.status === 'active') || null
  setActiveRoute(activeRoute)
}

  async function updateLocation(lat: number, lng: number) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !activeRoute) return

    setCoords({ lat, lng })

    await supabase
      .from('vehicle_locations')
      .upsert({
        driver_id: user.id,
        route_id: activeRoute.id,
        latitude: lat,
        longitude: lng,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'driver_id' })
  }

  function startTracking() {
    if (!navigator.geolocation) {
      setMessage('Geolocation is not supported by your browser')
      return
    }

    if (!activeRoute) {
      setMessage('No active route found. Ask your contractor to activate your route first.')
      return
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        updateLocation(position.coords.latitude, position.coords.longitude)
        setMessage('')
      },
      (error) => {
        setMessage('Location error: ' + error.message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )

    setWatchId(id)
    setTracking(true)
    setMessage('Location sharing started!')
  }

  function stopTracking() {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
    setTracking(false)
    setMessage('Location sharing stopped')
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

      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/driver" className="text-blue-600 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-6">Location Sharing</h1>

        {message && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${
            message.includes('error') || message.includes('No active')
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-green-50 text-green-600 border border-green-200'
          }`}>
            {message}
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-slate-800">Active Route</CardTitle>
          </CardHeader>
          <CardContent>
            {activeRoute ? (
              <div>
                <p className="font-medium text-slate-800">{activeRoute.route_name}</p>
                <p className="text-slate-500 text-sm">{activeRoute.district}</p>
                <p className="text-slate-400 text-xs mt-1">
                  Vehicle: {activeRoute.vehicle_number}
                </p>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">
                No active route. Your contractor needs to activate your route first.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-slate-800">GPS Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-3 h-3 rounded-full ${
                tracking ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
              }`}></div>
              <span className="text-slate-700 text-sm">
                {tracking ? 'Broadcasting location...' : 'Location sharing off'}
              </span>
            </div>

            {coords && (
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <p className="text-slate-500 text-xs">Current coordinates</p>
                <p className="text-slate-800 text-sm font-mono">
                  {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                </p>
              </div>
            )}

            <Button
              onClick={tracking ? stopTracking : startTracking}
              className={tracking
                ? 'bg-red-500 hover:bg-red-600 w-full'
                : 'bg-green-600 hover:bg-green-700 w-full'
              }
            >
              {tracking ? 'Stop Sharing Location' : 'Start Sharing Location'}
            </Button>
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-700 text-sm font-medium">How it works</p>
          <ul className="text-blue-600 text-xs mt-2 space-y-1">
            <li>• Your location updates every 5 seconds while sharing</li>
            <li>• Residents can see your truck on their map</li>
            <li>• Location sharing stops when you click Stop</li>
            <li>• Always stop sharing when your route is complete</li>
          </ul>
        </div>
      </div>
    </div>
  )
}