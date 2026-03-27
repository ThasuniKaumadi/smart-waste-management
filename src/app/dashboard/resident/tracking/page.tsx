'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

const MAP_CENTER = { lat: 6.9271, lng: 79.8612 }

const mapContainerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '12px',
}

interface VehicleLocation {
  id: string
  driver_id: string
  route_id: string
  latitude: number
  longitude: number
  updated_at: string
  profiles?: { full_name: string }
  routes?: { route_name: string, vehicle_number: string }
}

export default function ResidentTrackingPage() {
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLocation | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
  })

  useEffect(() => {
    loadData()
    const cleanup = setupRealtime()
    return cleanup
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

    const { data: locationsData } = await supabase
      .from('vehicle_locations')
      .select(`*, profiles(full_name), routes(route_name, vehicle_number)`)

    setVehicles(locationsData || [])
  }

  function setupRealtime() {
    const supabase = createClient()
    const channel = supabase
      .channel('vehicle-locations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vehicle_locations',
      }, () => {
        loadData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
  }, [])

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

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/resident" className="text-blue-600 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Track Collection Vehicle</h1>
            <p className="text-slate-500 text-sm mt-1">
              Real-time location of collection vehicles in your area
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-slate-500">Live</span>
          </div>
        </div>

        {!isLoaded ? (
          <div className="bg-slate-100 rounded-xl h-96 flex items-center justify-center">
            <p className="text-slate-400">Loading map...</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden shadow-md mb-6">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={MAP_CENTER}
              zoom={13}
              onLoad={onLoad}
              options={{
                styles: [
                  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                ],
                fullscreenControl: false,
                streetViewControl: false,
                mapTypeControl: false,
              }}
            >
              {vehicles.map((vehicle) => (
                <Marker
                  key={vehicle.id}
                  position={{ lat: vehicle.latitude, lng: vehicle.longitude }}
                  onClick={() => setSelectedVehicle(vehicle)}
                  icon={{
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="18" fill="#1d4ed8" stroke="white" stroke-width="2"/>
                        <text x="20" y="26" text-anchor="middle" fill="white" font-size="18">🚛</text>
                      </svg>
                    `),
                    scaledSize: new google.maps.Size(40, 40),
                  }}
                />
              ))}

              {selectedVehicle && (
                <InfoWindow
                  position={{ lat: selectedVehicle.latitude, lng: selectedVehicle.longitude }}
                  onCloseClick={() => setSelectedVehicle(null)}
                >
                  <div className="p-2">
                    <p className="font-medium text-slate-800 text-sm">
                      {selectedVehicle.routes?.vehicle_number || 'Vehicle'}
                    </p>
                    <p className="text-slate-600 text-xs">
                      Route: {selectedVehicle.routes?.route_name}
                    </p>
                    <p className="text-slate-600 text-xs">
                      Driver: {selectedVehicle.profiles?.full_name}
                    </p>
                    <p className="text-green-600 text-xs font-medium mt-1">
                      Live tracking active
                    </p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </div>
        )}

        {vehicles.length === 0 ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-blue-700 text-sm font-medium">
              No active vehicles in your area
            </p>
            <p className="text-blue-600 text-xs mt-1">
              Vehicles will appear here when drivers start their routes
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Active Vehicles</h2>
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="bg-white rounded-lg p-4 shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedVehicle(vehicle)
                  map?.panTo({ lat: vehicle.latitude, lng: vehicle.longitude })
                  map?.setZoom(16)
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg">
                    🚛
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 text-sm">
                      {vehicle.routes?.vehicle_number || 'Vehicle'}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {vehicle.routes?.route_name} — Driver: {vehicle.profiles?.full_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-600 text-xs">Active</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}