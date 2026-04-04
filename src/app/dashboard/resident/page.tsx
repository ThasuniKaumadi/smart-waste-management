'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

const RESIDENT_NAV = [
  { label: 'Overview', href: '/dashboard/resident', icon: 'dashboard' },
  { label: 'Schedule', href: '/dashboard/resident/schedule', icon: 'calendar_today' },
  { label: 'Track Vehicle', href: '/dashboard/resident/track', icon: 'location_on' },
  { label: 'Report Issue', href: '/dashboard/resident/report-dumping', icon: 'report_problem' },
  { label: 'Complaints', href: '/dashboard/resident/complaints', icon: 'feedback' },
]

export default function ResidentDashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [nextSchedule, setNextSchedule] = useState<any>(null)
  const [complaints, setComplaints] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    if (p?.district) {
      const today = new Date().toISOString().split('T')[0]
      const { data: schedules } = await supabase
        .from('schedules').select('*').eq('district', p.district)
        .gte('scheduled_date', today).order('scheduled_date', { ascending: true }).limit(1)
      if (schedules && schedules.length > 0) setNextSchedule(schedules[0])
    }

    const { data: comp } = await supabase
      .from('complaints').select('*').eq('resident_id', user.id)
      .order('created_at', { ascending: false }).limit(3)
    setComplaints(comp || [])

    const { data: rep } = await supabase
      .from('waste_reports').select('*').eq('submitted_by', user.id)
      .order('created_at', { ascending: false }).limit(3)
    setReports(rep || [])

    setLoading(false)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  function getInitials(name: string) {
    return name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'R'
  }

  function statusStyle(status: string): React.CSSProperties {
    if (status === 'resolved') return { background: 'rgba(0,69,13,0.08)', color: '#00450d' }
    if (status === 'in_progress') return { background: 'rgba(37,99,235,0.08)', color: '#1d4ed8' }
    return { background: 'rgba(180,83,9,0.08)', color: '#b45309' }
  }

  const QUICK_ACTIONS = [
    { label: 'View Schedule', desc: 'Check collection calendar', icon: 'calendar_month', href: '/dashboard/resident/schedule', color: '#00450d', bg: 'rgba(0,69,13,0.07)' },
    { label: 'Track Vehicle', desc: 'Live GPS truck location', icon: 'near_me', href: '/dashboard/resident/track', color: '#1d4ed8', bg: 'rgba(29,78,216,0.07)' },
    { label: 'Report Issue', desc: 'Missed pickup or bin damage', icon: 'report', href: '/dashboard/resident/report-dumping', color: '#b45309', bg: 'rgba(180,83,9,0.07)' },
    { label: 'File Complaint', desc: 'Formal grievance logging', icon: 'sentiment_dissatisfied', href: '/dashboard/resident/complaints/new', color: '#dc2626', bg: 'rgba(220,38,38,0.07)' },
  ]

  return (
    <DashboardLayout
      role="Resident"
      userName={profile?.full_name || ''}
      navItems={RESIDENT_NAV}
      primaryAction={{ label: 'Report Issue', href: '/dashboard/resident/report-dumping', icon: 'report_problem' }}
    >
      <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .font-label    { font-family: 'Manrope', sans-serif; }

        .bento-card {
          background: white; border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
          border: 1px solid rgba(0,69,13,0.04);
          transition: all 0.4s cubic-bezier(0.05,0.7,0.1,1.0); overflow: hidden;
        }
        .bento-card:hover { transform: translateY(-4px); box-shadow: 0 20px 50px -15px rgba(24,28,34,0.12); }

        .bento-card-green {
          background: #00450d; border-radius: 16px; color: white;
          transition: all 0.4s cubic-bezier(0.05,0.7,0.1,1.0);
          overflow: hidden; position: relative;
        }
        .bento-card-green:hover { transform: translateY(-4px); }

        .quick-link {
          background: white; border-radius: 16px; padding: 24px;
          border: 1px solid rgba(0,69,13,0.06);
          transition: all 0.35s cubic-bezier(0.05,0.7,0.1,1.0);
          text-decoration: none; display: block;
        }
        .quick-link:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -15px rgba(0,69,13,0.12);
          border-color: rgba(0,69,13,0.15);
        }

        .activity-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px; border-radius: 10px; transition: background 0.15s;
        }
        .activity-item:hover { background: #f4f6f3; }

        .status-pill {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.08em; padding: 3px 10px; border-radius: 99px;
          font-family: 'Manrope', sans-serif; white-space: nowrap; flex-shrink: 0;
        }

        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.10s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.20s both; }
        .s5 { animation: staggerIn 0.5s ease 0.25s both; }
      `}</style>

      {/* Hero */}
      <section className="mb-10 s1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="font-headline font-extrabold tracking-tight"
            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
            Welcome, <span style={{ color: '#1b5e20' }}>{profile?.full_name?.split(' ')[0] || 'Resident'}</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: '#f0fdf4' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#16a34a' }} />
              <span className="text-sm font-medium" style={{ color: '#14532d', fontFamily: 'Inter, sans-serif' }}>
                {profile?.district || 'CMC District'}
              </span>
            </div>
            <Link href="/dashboard/resident/schedule"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80"
              style={{ background: '#1b5e20', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_month</span>
              View Schedule
            </Link>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
              style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#717a6d' }}>Loading your dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Row 1 — featured green card + profile */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">

            {/* Next collection card */}
            <div className="bento-card-green md:col-span-8 p-8 s2">
              <div className="absolute top-0 right-0 w-56 h-56 rounded-full -mr-20 -mt-20"
                style={{ background: 'rgba(163,246,156,0.06)' }} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <span className="font-label text-xs font-bold uppercase block mb-2"
                      style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)' }}>
                      Next Scheduled Collection
                    </span>
                    <h2 className="font-headline font-extrabold tracking-tight"
                      style={{ fontSize: '32px', lineHeight: 1.1, marginBottom: '8px' }}>
                      {nextSchedule ? formatDate(nextSchedule.scheduled_date) : 'No upcoming collection'}
                    </h2>
                    {nextSchedule && (
                      <p style={{ color: 'rgba(163,246,156,0.8)', fontWeight: 500, fontSize: '14px' }}>
                        Waste Type: <span style={{ color: 'white', fontWeight: 700 }}>{nextSchedule.waste_type}</span>
                      </p>
                    )}
                  </div>
                  <div className="p-3 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>delete_sweep</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'District', value: profile?.district?.split(' - ')[0] || 'N/A' },
                    { label: 'Reports', value: reports.length.toString().padStart(2, '0') },
                    { label: 'Complaints', value: complaints.length.toString().padStart(2, '0') },
                    { label: 'Status', value: 'Active' },
                  ].map(item => (
                    <div key={item.label} className="p-4 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <p className="text-xs font-bold uppercase mb-1"
                        style={{ letterSpacing: '0.1em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                        {item.label}
                      </p>
                      <p className="font-headline font-bold text-2xl">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 flex-wrap">
                  <Link href="/dashboard/resident/schedule" style={{ textDecoration: 'none' }}>
                    <button style={{ background: 'white', color: '#00450d', padding: '10px 22px', borderRadius: '99px', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                      Full Schedule
                    </button>
                  </Link>
                  <Link href="/dashboard/resident/track" style={{ textDecoration: 'none' }}>
                    <button style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 22px', borderRadius: '99px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                      Track Vehicle
                    </button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Profile card */}
            <div className="bento-card md:col-span-4 p-6 flex flex-col s2">
              <div className="flex items-center gap-4 mb-6">
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #00450d, #1b5e20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: 'white' }}>
                    {getInitials(profile?.full_name || '')}
                  </span>
                </div>
                <div>
                  <h4 className="font-headline font-bold" style={{ fontSize: '16px', color: '#181c22' }}>
                    {profile?.full_name || 'Resident'}
                  </h4>
                  <div className="flex items-center gap-1" style={{ color: '#00450d', fontSize: '11px', fontWeight: 700 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                    Verified Resident
                  </div>
                </div>
              </div>

              <div className="space-y-3 flex-1">
                {[
                  { label: 'District', value: profile?.district || '—', icon: 'location_on' },
                  { label: 'Phone', value: profile?.phone || '—', icon: 'phone' },
                  { label: 'Address', value: profile?.address || '—', icon: 'home' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#f4f6f3', padding: '10px 12px', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#717a6d', marginTop: '1px', flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: '#717a6d', margin: '0 0 1px', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>{item.label}</p>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#181c22', margin: 0 }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2 — 4 stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 s3">
            {[
              { label: 'Next Collection', value: nextSchedule ? new Date(nextSchedule.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A', sub: nextSchedule?.waste_type || 'Not scheduled', icon: 'calendar_today', color: '#00450d' },
              { label: 'Waste Type', value: nextSchedule?.waste_type || '—', sub: 'Next collection', icon: 'delete_sweep', color: '#1b5e20' },
              { label: 'Complaints', value: complaints.length, sub: 'Filed', icon: 'feedback', color: '#b45309' },
              { label: 'Reports', value: reports.length, sub: 'Submitted', icon: 'report_problem', color: '#7c3aed' },
            ].map(m => (
              <div key={m.label} className="bento-card p-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${m.color}12` }}>
                  <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '20px' }}>{m.icon}</span>
                </div>
                <p className="font-headline font-extrabold text-3xl tracking-tight mb-1" style={{ color: '#181c22' }}>{m.value}</p>
                <p className="font-label text-xs font-bold uppercase mb-1" style={{ letterSpacing: '0.12em', color: '#94a3b8' }}>{m.label}</p>
                <p className="text-xs font-semibold" style={{ color: m.color }}>{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Row 3 — quick actions */}
          <div className="s4">
            <h3 className="font-headline font-bold text-base mb-4" style={{ color: '#181c22' }}>Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              {QUICK_ACTIONS.map(action => (
                <Link key={action.href} href={action.href} className="quick-link">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: action.bg }}>
                    <span className="material-symbols-outlined" style={{ color: action.color, fontSize: '22px' }}>{action.icon}</span>
                  </div>
                  <p className="font-bold text-sm mb-1" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{action.label}</p>
                  <p className="text-xs" style={{ color: '#717a6d' }}>{action.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Row 4 — complaints + reports */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 s5">

            {/* Complaints */}
            <div className="bento-card p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Recent Complaints</h3>
                <Link href="/dashboard/resident/complaints"
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:opacity-70 transition-opacity"
                  style={{ color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                  View All
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                </Link>
              </div>
              {complaints.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>check_circle</span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#181c22' }}>No complaints filed</p>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>All clear in your district</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {complaints.map(c => (
                    <div key={c.id} className="activity-item">
                      <div className="flex items-center gap-3">
                        <div style={{ width: '36px', height: '36px', background: 'rgba(180,83,9,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ color: '#b45309', fontSize: '18px' }}>warning</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#181c22' }}>{c.complaint_type?.replace(/_/g, ' ')}</p>
                          <p className="text-xs" style={{ color: '#94a3b8' }}>{new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                        </div>
                      </div>
                      <span className="status-pill" style={statusStyle(c.status)}>{c.status?.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reports */}
            <div className="bento-card p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>My Reports</h3>
                <Link href="/dashboard/resident/report-dumping"
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:opacity-70 transition-opacity"
                  style={{ color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                  View All
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                </Link>
              </div>
              {reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>photo_camera</span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#181c22' }}>No reports submitted</p>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Help keep your district clean</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map(r => (
                    <div key={r.id} className="activity-item">
                      <div className="flex items-center gap-3">
                        <div style={{ width: '36px', height: '36px', background: 'rgba(124,58,237,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ color: '#7c3aed', fontSize: '18px' }}>recycling</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#181c22' }}>{r.report_type?.replace(/_/g, ' ')}</p>
                          <p className="text-xs" style={{ color: '#94a3b8' }}>
                            {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {r.latitude ? ' · GPS tagged' : ''}
                          </p>
                        </div>
                      </div>
                      <span className="status-pill" style={statusStyle(r.status)}>{r.status?.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Blockchain bar */}
          <div className="mt-6 p-6 rounded-2xl flex items-center justify-between s5"
            style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.08)' }}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>verified</span>
              <div>
                <p className="text-sm font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                  Blockchain-verified collections
                </p>
                <p className="text-xs" style={{ color: '#717a6d' }}>
                  Every collection stop is logged on Polygon Amoy
                </p>
              </div>
            </div>
            <Link href="/dashboard/resident/track"
              className="px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90 whitespace-nowrap"
              style={{ background: '#00450d', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
              Track Now
            </Link>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}