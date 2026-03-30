'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

const RESIDENT_NAV = [
  { label: 'Overview', href: '/dashboard/resident', icon: 'dashboard' },
  { label: 'Schedule', href: '/dashboard/resident/schedule', icon: 'calendar_month' },
  { label: 'Track Vehicle', href: '/dashboard/resident/track', icon: 'location_on' },
  { label: 'Report Issue', href: '/dashboard/resident/report-dumping', icon: 'report' },
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
        .from('schedules')
        .select('*')
        .eq('district', p.district)
        .gte('scheduled_date', today)
        .order('scheduled_date', { ascending: true })
        .limit(1)
      if (schedules && schedules.length > 0) setNextSchedule(schedules[0])
    }

    const { data: comp } = await supabase
      .from('complaints')
      .select('*')
      .eq('resident_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)
    setComplaints(comp || [])

    const { data: rep } = await supabase
      .from('waste_reports')
      .select('*')
      .eq('reporter_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)
    setReports(rep || [])

    setLoading(false)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  function statusColor(status: string) {
    if (status === 'resolved') return { bg: '#f0fdf4', color: '#00450d' }
    if (status === 'in_progress') return { bg: '#eff6ff', color: '#1d4ed8' }
    return { bg: '#f8fafc', color: '#64748b' }
  }

  const QUICK_ACTIONS = [
    { label: 'View Schedule', desc: 'See upcoming waste collections in your district', icon: 'calendar_month', href: '/dashboard/resident/schedule', color: '#00450d' },
    { label: 'Track Vehicle', desc: 'Follow your collection vehicle in real-time', icon: 'location_on', href: '/dashboard/resident/track', color: '#1b5e20' },
    { label: 'Report Issue', desc: 'Report illegal dumping or missed collection', icon: 'report', href: '/dashboard/resident/report-dumping', color: '#2e7d32' },
    { label: 'File Complaint', desc: 'Submit a formal complaint to CMC', icon: 'feedback', href: '/dashboard/resident/complaints/new', color: '#388e3c' },
  ]

  return (
    <DashboardLayout
      role="Resident"
      userName={profile?.full_name || ''}
      navItems={RESIDENT_NAV}
      primaryAction={{ label: 'Report Issue', href: '/dashboard/resident/report-dumping', icon: 'report' }}
    >
      <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .font-label { font-family: 'Manrope', sans-serif; }

        .bento-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
          border: 1px solid rgba(0,69,13,0.04);
          transition: all 0.4s cubic-bezier(0.05,0.7,0.1,1.0);
          overflow: hidden;
        }
        .bento-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 50px -15px rgba(24,28,34,0.12);
        }
        .bento-card-green {
          background: #00450d;
          border-radius: 16px;
          color: white;
          transition: all 0.4s cubic-bezier(0.05,0.7,0.1,1.0);
          overflow: hidden;
          position: relative;
        }
        .bento-card-green:hover { transform: translateY(-4px); }

        .quick-link {
          background: white;
          border-radius: 16px;
          padding: 24px;
          border: 1px solid rgba(0,69,13,0.06);
          transition: all 0.35s cubic-bezier(0.05,0.7,0.1,1.0);
          text-decoration: none;
          display: block;
        }
        .quick-link:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -15px rgba(0,69,13,0.12);
          border-color: rgba(0,69,13,0.15);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 99px;
          font-size: 10px;
          font-weight: 700;
          font-family: 'Manrope', sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        @keyframes staggerIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.2s both; }
        .s5 { animation: staggerIn 0.5s ease 0.25s both; }
      `}</style>

      {/* Hero header */}
      <section className="mb-10 s1">
        <span className="font-label text-xs font-bold uppercase block mb-2"
          style={{ letterSpacing: '0.2em', color: '#717a6d' }}>
          Colombo Municipal Council · ClearPath
        </span>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="font-headline font-extrabold tracking-tight"
            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
            Welcome back,{' '}
            <span style={{ color: '#1b5e20' }}>
              {profile?.full_name?.split(' ')[0] || 'Resident'}
            </span>
          </h1>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: '#f0fdf4' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#16a34a' }} />
            <span className="text-sm font-medium" style={{ color: '#14532d', fontFamily: 'Inter, sans-serif' }}>
              {profile?.district || 'CMC District'}
            </span>
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
          {/* Row 1 — next collection + stats */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">

            {/* Next collection — green featured card */}
            <div className="bento-card-green md:col-span-8 p-8 s2">
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full -mr-16 -mt-16"
                style={{ background: 'rgba(163,246,156,0.06)' }} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <span className="font-label text-xs font-bold uppercase block mb-3"
                      style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)' }}>
                      Next Collection
                    </span>
                    <h2 className="font-headline font-extrabold text-3xl tracking-tight mb-1">
                      {nextSchedule ? formatDate(nextSchedule.scheduled_date) : 'No upcoming collection'}
                    </h2>
                    {nextSchedule && (
                      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
                        {nextSchedule.waste_type} · {nextSchedule.district}
                      </p>
                    )}
                  </div>
                  <div className="p-3 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                      delete_sweep
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'My Complaints', value: complaints.length, icon: 'feedback' },
                    { label: 'My Reports', value: reports.length, icon: 'photo_camera' },
                    { label: 'District', value: profile?.district?.split(' ')[0] || 'N/A', icon: 'location_on' },
                  ].map(m => (
                    <div key={m.label} className="p-4 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <span className="material-symbols-outlined mb-2 block"
                        style={{ color: 'rgba(163,246,156,0.7)', fontSize: '20px' }}>{m.icon}</span>
                      <p className="font-headline font-bold text-2xl">{m.value}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* District info narrow */}
            <div className="bento-card md:col-span-4 p-8 flex flex-col justify-between s2">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                    Your Profile
                  </h2>
                  <span className="material-symbols-outlined" style={{ color: '#717a6d', fontSize: '20px' }}>
                    person
                  </span>
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'Full Name', value: profile?.full_name || '—' },
                    { label: 'District', value: profile?.district || '—' },
                    { label: 'Phone', value: profile?.phone || '—' },
                    { label: 'Address', value: profile?.address || '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="font-label text-xs font-bold uppercase mb-0.5"
                        style={{ letterSpacing: '0.15em', color: '#94a3b8' }}>{item.label}</p>
                      <p className="text-sm font-medium truncate" style={{ color: '#181c22' }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(0,69,13,0.08)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#16a34a' }} />
                  <span className="text-xs font-medium" style={{ color: '#717a6d' }}>
                    Account active · Blockchain verified
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 — complaints + reports */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 s3">

            {/* Recent complaints */}
            <div className="bento-card p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                  My Complaints
                </h3>
                <Link href="/dashboard/resident/complaints"
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:opacity-70 transition-opacity"
                  style={{ color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                  View All
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                </Link>
              </div>

              {complaints.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: '#f0fdf4' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>
                      check_circle
                    </span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#181c22' }}>No complaints filed</p>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>All clear in your district</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {complaints.map(c => (
                    <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl"
                      style={{ background: '#f8fafc' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: '#f0fdf4' }}>
                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>
                          feedback
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#181c22' }}>
                          {c.complaint_type?.replace('_', ' ')}
                        </p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>
                          {new Date(c.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="status-badge" style={statusColor(c.status)}>
                        {c.status?.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Link href="/dashboard/resident/complaints/new"
                className="mt-4 w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 block text-center"
                style={{ background: '#00450d', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif', marginTop: '16px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                New Complaint
              </Link>
            </div>

            {/* Recent waste reports */}
            <div className="bento-card p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                  My Reports
                </h3>
                <Link href="/dashboard/resident/report-dumping"
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:opacity-70 transition-opacity"
                  style={{ color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                  View All
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                </Link>
              </div>

              {reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: '#f0fdf4' }}>
                    <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>
                      photo_camera
                    </span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#181c22' }}>No reports submitted</p>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Help keep your district clean</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map(r => (
                    <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl"
                      style={{ background: '#f8fafc' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: '#f0fdf4' }}>
                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>
                          photo_camera
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#181c22' }}>
                          {r.report_type?.replace('_', ' ')}
                        </p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>
                          {new Date(r.created_at).toLocaleDateString()}
                          {r.latitude && ' · GPS tagged'}
                        </p>
                      </div>
                      <span className="status-badge" style={statusColor(r.status)}>
                        {r.status?.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Link href="/dashboard/resident/report-dumping"
                className="mt-4 w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 block text-center"
                style={{ background: '#1b5e20', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif', marginTop: '16px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_a_photo</span>
                New Report
              </Link>
            </div>
          </div>

          {/* Row 3 — quick actions */}
          <div className="s4">
            <h3 className="font-headline font-bold text-base mb-4" style={{ color: '#181c22' }}>
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {QUICK_ACTIONS.map(action => (
                <Link key={action.href} href={action.href} className="quick-link">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: `${action.color}12` }}>
                    <span className="material-symbols-outlined" style={{ color: action.color, fontSize: '22px' }}>
                      {action.icon}
                    </span>
                  </div>
                  <p className="font-bold text-sm mb-1" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>
                    {action.label}
                  </p>
                  <p className="text-xs" style={{ color: '#717a6d' }}>{action.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* CMC info bar */}
          <div className="mt-6 p-6 rounded-2xl flex items-center justify-between s5"
            style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.08)' }}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>
                verified
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                  Blockchain-verified collections
                </p>
                <p className="text-xs" style={{ color: '#717a6d' }}>
                  Every collection in your district is logged on Polygon Amoy · CMC 2026
                </p>
              </div>
            </div>
            <Link href="/dashboard/resident/track"
              className="px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
              style={{ background: '#00450d', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
              Track Now
            </Link>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}