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
  const [nextSchedule, setNextSchedule] = useState<any>(null)

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
    const { data: locs } = await supabase.from('vehicle_locations').select('*').gte('updated_at', twoHoursAgo)
    setVehicles(locs || [])

    // Get next scheduled collection
    if (p?.district) {
      const today = new Date().toISOString().split('T')[0]
      const { data: scheds } = await supabase.from('schedules').select('*')
        .eq('district', p.district).eq('published', true)
        .gte('scheduled_date', today).order('scheduled_date', { ascending: true }).limit(1)
      setNextSchedule(scheds?.[0] || null)
    }

    setLoading(false)
  }

  function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const isCollectionDay = nextSchedule?.collection_day === todayName

  return (
    <DashboardLayout role="Resident" userName={profile?.full_name || ''} navItems={RESIDENT_NAV}
      primaryAction={{ label: 'View Schedule', href: '/dashboard/resident/schedules', icon: 'calendar_today' }}>
      <style>{`
        .msf{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}
        .card{background:white;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid rgba(0,69,13,0.05);overflow:hidden}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes ping{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.5);opacity:0}}
        .live-dot{animation:pulse 1.5s ease infinite}
        .ping{animation:ping 1.5s ease infinite}
        .a1{animation:fadeUp .4s ease .04s both}.a2{animation:fadeUp .4s ease .09s both}.a3{animation:fadeUp .4s ease .14s both}
        .vehicle-row{padding:16px 20px;border-bottom:1px solid rgba(0,69,13,0.04);display:flex;align-items:center;gap:14px;transition:background 0.1s}
        .vehicle-row:hover{background:#fafaf9}
        .vehicle-row:last-child{border-bottom:none}
        .stat-card{background:white;border-radius:16px;padding:18px;border:1.5px solid #f0f0f0;display:flex;align-items:center;gap:12px}
      `}</style>

      {/* Header */}
      <div className="a1" style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', marginBottom: 6 }}>Resident Portal</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 42, fontWeight: 900, color: '#181c22', lineHeight: 1.1, fontFamily: 'Manrope,sans-serif', marginBottom: 4 }}>
              Track <span style={{ color: '#00450d' }}>Vehicle</span>
            </h1>
            <p style={{ fontSize: 13, color: '#717a6d' }}>{profile?.district || 'CMC District'} · Live collection truck positions</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 99, background: vehicles.length > 0 ? 'rgba(22,163,74,0.08)' : '#f1f5f9', border: `1px solid ${vehicles.length > 0 ? 'rgba(22,163,74,0.2)' : '#e2e8f0'}` }}>
              <div className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: vehicles.length > 0 ? '#16a34a' : '#94a3b8' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: vehicles.length > 0 ? '#16a34a' : '#94a3b8', fontFamily: 'Manrope,sans-serif' }}>
                {vehicles.length > 0 ? 'LIVE' : 'NO ACTIVE VEHICLES'}
              </span>
            </div>
            <button onClick={() => { loadData(); setLastRefresh(new Date()) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 99, background: 'white', border: '1.5px solid #e5e7eb', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', color: '#374151' }}>
              <span className="msf" style={{ fontSize: 14 }}>refresh</span>Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <div className="stat-card">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: vehicles.length > 0 ? 'rgba(22,163,74,0.08)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="msf" style={{ fontSize: 18, color: vehicles.length > 0 ? '#16a34a' : '#94a3b8' }}>local_shipping</span>
          </div>
          <div>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1 }}>{vehicles.length}</p>
            <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Active Trucks</p>
          </div>
        </div>
        <div className="stat-card">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: isCollectionDay ? '#f0fdf4' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="msf" style={{ fontSize: 18, color: isCollectionDay ? '#00450d' : '#94a3b8' }}>today</span>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1.2 }}>
              {isCollectionDay ? 'Today' : nextSchedule ? new Date(nextSchedule.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
            </p>
            <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Next Collection</p>
          </div>
        </div>
        <div className="stat-card">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="msf" style={{ fontSize: 18, color: '#00450d' }}>schedule</span>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#181c22', fontFamily: 'Manrope,sans-serif', lineHeight: 1.2 }}>
              {timeAgo(lastRefresh.toISOString())}
            </p>
            <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Last Updated</p>
          </div>
        </div>
      </div>

      {/* Map area */}
      <div className="a2 card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        {/* Map header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#00450d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="msf" style={{ fontSize: 18, color: 'rgba(163,246,156,0.9)' }}>map</span>
            <div>
              <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: 'white' }}>Live Map</p>
              <p style={{ fontSize: 11, color: 'rgba(163,246,156,0.7)' }}>Google Maps · {profile?.district || 'CMC District'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.12)' }}>
            <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'white', fontFamily: 'Manrope,sans-serif' }}>LIVE</span>
          </div>
        </div>

        {/* Map placeholder */}
        <div style={{ height: 340, position: 'relative', background: '#f0f7f0', overflow: 'hidden' }}>
          {/* Stylised Colombo map background */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
            {/* Background */}
            <rect width="100%" height="100%" fill="#e8f5e8" />
            {/* Water/ocean area */}
            <rect x="0" y="0" width="180" height="340" fill="#d4eaf7" opacity="0.6" />
            {/* Main roads */}
            <line x1="180" y1="0" x2="180" y2="340" stroke="#c8dfc8" strokeWidth="3" />
            <line x1="180" y1="170" x2="900" y2="170" stroke="#c8dfc8" strokeWidth="3" />
            <line x1="400" y1="0" x2="400" y2="340" stroke="#c8dfc8" strokeWidth="2" />
            <line x1="620" y1="0" x2="620" y2="340" stroke="#c8dfc8" strokeWidth="2" />
            <line x1="180" y1="90" x2="900" y2="90" stroke="#c8dfc8" strokeWidth="1.5" />
            <line x1="180" y1="250" x2="900" y2="250" stroke="#c8dfc8" strokeWidth="1.5" />
            <line x1="300" y1="0" x2="300" y2="340" stroke="#d4e8d4" strokeWidth="1" />
            <line x1="500" y1="0" x2="500" y2="340" stroke="#d4e8d4" strokeWidth="1" />
            <line x1="700" y1="0" x2="700" y2="340" stroke="#d4e8d4" strokeWidth="1" />
            <line x1="800" y1="0" x2="800" y2="340" stroke="#d4e8d4" strokeWidth="1" />
            {/* District blocks */}
            <rect x="200" y="20" width="150" height="60" rx="4" fill="#dceedd" opacity="0.5" />
            <rect x="420" y="20" width="160" height="60" rx="4" fill="#dceedd" opacity="0.5" />
            <rect x="200" y="200" width="150" height="60" rx="4" fill="#dceedd" opacity="0.5" />
            <rect x="420" y="200" width="160" height="60" rx="4" fill="#dceedd" opacity="0.5" />
            <rect x="640" y="100" width="120" height="80" rx="4" fill="#dceedd" opacity="0.5" />
            {/* Galle Face / coast label */}
            <text x="80" y="180" fontSize="10" fill="#6ba3c7" fontFamily="sans-serif" textAnchor="middle" opacity="0.8">Indian Ocean</text>
            {/* Road labels */}
            <text x="510" y="165" fontSize="9" fill="#94a894" fontFamily="sans-serif">Galle Road</text>
            <text x="390" y="85" fontSize="9" fill="#94a894" fontFamily="sans-serif" transform="rotate(-90,390,85)">Baseline Rd</text>
          </svg>

          {/* Animated truck pins */}
          {vehicles.length > 0 ? vehicles.map((v, i) => (
            <div key={v.driver_id} style={{ position: 'absolute', left: `${30 + (i * 15)}%`, top: `${35 + (i * 10)}%`, transform: 'translate(-50%,-50%)', zIndex: 10 }}>
              <div style={{ position: 'relative' }}>
                <div className="ping" style={{ position: 'absolute', inset: -4, borderRadius: '50%', background: 'rgba(22,163,74,0.3)' }} />
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#00450d', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,69,13,0.4)', position: 'relative', zIndex: 1 }}>
                  <span className="msf" style={{ fontSize: 18, color: 'white', fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
                </div>
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 4, background: '#00450d', color: 'white', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'Manrope,sans-serif' }}>
                  Truck {i + 1}
                </div>
              </div>
            </div>
          )) : (
            /* Coming soon overlay */
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(232,245,232,0.7)', backdropFilter: 'blur(2px)' }}>
              <div style={{ background: 'white', borderRadius: 20, padding: '24px 32px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', border: '1px solid rgba(0,69,13,0.08)', maxWidth: 320 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <span className="msf" style={{ fontSize: 26, color: '#00450d' }}>map</span>
                </div>
                <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 16, color: '#181c22', marginBottom: 6 }}>Interactive Map</p>
                <p style={{ fontSize: 12, color: '#717a6d', lineHeight: 1.6, marginBottom: 14 }}>
                  Google Maps integration is being configured. Vehicle coordinates are actively tracked and will appear on the live map once set up.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '6px 14px', borderRadius: 99, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                  <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#00450d' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#00450d', fontFamily: 'Manrope,sans-serif' }}>Coordinates being tracked</span>
                </div>
              </div>
            </div>
          )}

          {/* Colombo label */}
          <div style={{ position: 'absolute', top: 12, left: 200, background: 'white', padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#374151', fontFamily: 'Manrope,sans-serif', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
            Colombo
          </div>
        </div>
      </div>

      {/* Active vehicles list */}
      <div className="a3">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22' }}>Active Vehicles in Your District</h2>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Updated {timeAgo(lastRefresh.toISOString())}</span>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            </div>
          ) : vehicles.length === 0 ? (
            <div style={{ padding: '40px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { icon: 'event_available', label: 'Collection Day', value: isCollectionDay ? 'Today' : nextSchedule ? new Date(nextSchedule.scheduled_date).toLocaleDateString('en-GB', { weekday: 'long' }) : 'Check schedule', color: '#00450d', bg: '#f0fdf4' },
                  { icon: 'schedule', label: 'Collection Time', value: nextSchedule?.collection_time || '—', color: '#1d4ed8', bg: '#eff6ff' },
                  { icon: 'local_shipping', label: 'Trucks Active', value: '0 right now', color: '#94a3b8', bg: '#f8fafc' },
                  { icon: 'notifications', label: 'Next Alert', value: isCollectionDay ? 'Today' : 'On collection day', color: '#d97706', bg: '#fffbeb' },
                ].map(item => (
                  <div key={item.label} style={{ background: item.bg, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      <span className="msf" style={{ fontSize: 16, color: item.color }}>{item.icon}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif' }}>{item.value}</p>
                      <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 600 }}>{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#181c22', marginBottom: 4 }}>No vehicles currently active</p>
                <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                  Collection trucks appear here when drivers begin their routes.<br />
                  {isCollectionDay ? 'Today is a collection day — check back shortly.' : 'Check back on your scheduled collection day.'}
                </p>
              </div>
            </div>
          ) : (
            vehicles.map((v, i) => (
              <div key={v.driver_id} className="vehicle-row">
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,69,13,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="msf" style={{ fontSize: 22, color: '#00450d' }}>local_shipping</span>
                  </div>
                  <div className="live-dot" style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: '#16a34a', border: '2px solid white' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, color: '#181c22' }}>Truck {i + 1}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontFamily: 'Manrope,sans-serif' }}>LIVE</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#717a6d', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span className="msf" style={{ fontSize: 13 }}>location_on</span>
                      {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span className="msf" style={{ fontSize: 13 }}>schedule</span>
                      {timeAgo(v.updated_at)}
                    </span>
                  </div>
                </div>
                <a href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 99, background: '#00450d', color: 'white', textDecoration: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', flexShrink: 0 }}>
                  <span className="msf" style={{ fontSize: 14 }}>open_in_new</span>
                  Open Map
                </a>
              </div>
            ))
          )}
        </div>

        {/* Info note */}
        <div style={{ marginTop: 14, padding: '14px 18px', borderRadius: 14, background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span className="msf" style={{ fontSize: 16, color: '#00450d', flexShrink: 0, marginTop: 1 }}>info</span>
          <p style={{ fontSize: 12, color: '#41493e', lineHeight: 1.6 }}>
            Vehicles appear when drivers are actively sharing their GPS location during a collection route. The full interactive map will be available once Google Maps is configured. Until then, tap <strong>Open Map</strong> on any active vehicle to view its position in Google Maps.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}