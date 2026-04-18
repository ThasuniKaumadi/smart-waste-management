'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const RESIDENT_NAV = [
  { label: 'Overview', href: '/dashboard/resident', icon: 'dashboard' },
  { label: 'Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' },
  { label: 'Track Vehicle', href: '/dashboard/resident/tracking', icon: 'location_on' },
  { label: 'Report Issue', href: '/dashboard/resident/report-dumping', icon: 'report_problem' },
  { label: 'Complaints', href: '/dashboard/resident/complaints', icon: 'feedback' },
  { label: 'Rate Service', href: '/dashboard/resident/feedback', icon: 'star' },
  { label: 'My Profile', href: '/dashboard/resident/profile', icon: 'person' },
]

interface VehicleLocation {
  driver_id: string
  route_id: string
  latitude: number
  longitude: number
  updated_at: string
}

export default function ResidentTrackingPage() {
  const [profile, setProfile] = useState<any>(null)
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      loadData()
      setLastRefresh(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: locs } = await supabase
      .from('vehicle_locations')
      .select('*')
      .gte('updated_at', twoHoursAgo)
    setVehicles(locs || [])
    setLoading(false)
  }

  function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  return (
    <DashboardLayout
      role="Resident"
      userName={profile?.full_name || ''}
      navItems={RESIDENT_NAV}
      primaryAction={{ label: 'View Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' }}
    >
      <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .s1{animation:fadeUp .4s ease .04s both} .s2{animation:fadeUp .4s ease .09s both} .s3{animation:fadeUp .4s ease .14s both}
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .live-dot { animation:pulse 1.5s ease infinite; }
        .vehicle-row { padding:16px 20px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:14px; transition:background 0.15s; }
        .vehicle-row:hover { background:#f9fbf9; }
        .vehicle-row:last-child { border-bottom:none; }
      `}</style>

      <section className="mb-8 s1">
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', display: 'block', marginBottom: 8 }}>Resident Portal</span>
        <h1 style={{ fontSize: 48, fontWeight: 900, fontFamily: 'Manrope,sans-serif', color: '#181c22', lineHeight: 1.1, marginBottom: 6 }}>
          Track <span style={{ color: '#1b5e20' }}>Vehicle</span>
        </h1>
        <p style={{ fontSize: 13, color: '#717a6d' }}>
          {profile?.district || 'CMC District'} · Live collection truck positions
        </p>
      </section>

      <div className="s2 mb-6" style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(0,69,13,0.08)', position: 'relative' }}>
        <div style={{ height: 380, background: 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 50%, #e0f2f1 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00450d" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          <div style={{ zIndex: 1, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,69,13,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#00450d' }}>map</span>
            </div>
            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22', marginBottom: 6 }}>Interactive Map</p>
            <p style={{ fontSize: 13, color: '#717a6d', maxWidth: 280, lineHeight: 1.5 }}>
              Google Maps integration being configured. Vehicle coordinates are being tracked — map will display tonight.
            </p>
            {vehicles.length > 0 && (
              <div style={{ marginTop: 16, padding: '8px 20px', borderRadius: 99, background: 'rgba(0,69,13,0.1)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <div className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#00450d' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>
                  {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} currently active
                </span>
              </div>
            )}
          </div>
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8, zIndex: 2 }}>
          <div style={{ padding: '6px 14px', borderRadius: 99, background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>LIVE</span>
          </div>
          <button onClick={() => { loadData(); setLastRefresh(new Date()) }}
            style={{ padding: '6px 14px', borderRadius: 99, background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', color: '#181c22' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      <div className="s3">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 16, color: '#181c22' }}>
            Active Vehicles in Your District
          </h2>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            Updated {timeAgo(lastRefresh.toISOString())}
          </span>
        </div>

        <div className="bento-card">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            </div>
          ) : vehicles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#00450d' }}>local_shipping</span>
              </div>
              <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', marginBottom: 6 }}>
                No vehicles currently active
              </p>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                Collection trucks will appear here when drivers begin their routes. Check back on your scheduled collection day.
              </p>
            </div>
          ) : (
            vehicles.map((v, i) => (
              <div key={v.driver_id} className="vehicle-row">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,69,13,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#00450d' }}>local_shipping</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22' }}>
                      Truck {i + 1}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, background: 'rgba(22,163,74,0.08)' }}>
                      <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', fontFamily: 'Manrope,sans-serif' }}>LIVE</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#717a6d', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>location_on</span>
                      {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
                      Updated {timeAgo(v.updated_at)}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <a
                    href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 99, background: '#00450d', color: 'white', textDecoration: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                    Open Map
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 12, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#00450d', flexShrink: 0, marginTop: 1 }}>info</span>
          <p style={{ fontSize: 13, color: '#41493e', lineHeight: 1.6 }}>
            Vehicles are shown when drivers are actively sharing their location during a collection route. The live map view will be available after Google Maps is configured. Until then, tap <strong>Open Map</strong> on any active vehicle to see its position in Google Maps.
          </p>
        </div>
      </div>

    </DashboardLayout>
  )
}