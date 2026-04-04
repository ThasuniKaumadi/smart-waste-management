'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

const COMMERCIAL_NAV = [
  { label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' },
  { label: 'Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_month' },
  { label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' },
  { label: 'Complaints', href: '/dashboard/commercial/complaints', icon: 'feedback' },
  { label: 'Billing', href: '/dashboard/commercial/billing', icon: 'payments' },
]

export default function CommercialDashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [nextSchedule, setNextSchedule] = useState<any>(null)
  const [complaints, setComplaints] = useState<any[]>([])
  const [stats, setStats] = useState({ totalComplaints: 0, resolvedComplaints: 0 })

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

    const [{ count: totalComplaints }, { count: resolvedComplaints }] = await Promise.all([
      supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('resident_id', user.id),
      supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('resident_id', user.id).eq('status', 'resolved'),
    ])
    setStats({ totalComplaints: totalComplaints || 0, resolvedComplaints: resolvedComplaints || 0 })

    setLoading(false)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  function statusStyle(status: string) {
    if (status === 'resolved') return { background: '#f0fdf4', color: '#00450d' }
    if (status === 'in_progress') return { background: '#eff6ff', color: '#1d4ed8' }
    return { background: '#f8fafc', color: '#64748b' }
  }

  const QUICK_LINKS = [
    { label: 'View Schedule', desc: 'See upcoming commercial waste collections', icon: 'calendar_month', href: '/dashboard/commercial/schedule', color: '#00450d' },
    { label: 'Track Vehicle', desc: 'Follow your collection vehicle live', icon: 'location_on', href: '/dashboard/commercial/track', color: '#1b5e20' },
    { label: 'File Complaint', desc: 'Submit a formal complaint to CMC', icon: 'feedback', href: '/dashboard/commercial/complaints/new', color: '#2e7d32' },
  ]

  return (
    <DashboardLayout
      role="Commercial"
      userName={profile?.full_name || profile?.organisation_name || ''}
      navItems={COMMERCIAL_NAV}
      primaryAction={{ label: 'Track Vehicle', href: '/dashboard/commercial/track', icon: 'location_on' }}
    >
      <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .bento-card {
          background: white; border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
          border: 1px solid rgba(0,69,13,0.04);
          transition: all 0.4s cubic-bezier(0.05,0.7,0.1,1.0); overflow: hidden;
        }
        .bento-card:hover { transform: translateY(-4px); box-shadow: 0 20px 50px -15px rgba(24,28,34,0.12); }
        .bento-card-green {
          background: #00450d; border-radius: 16px; color: white;
          transition: all 0.4s cubic-bezier(0.05,0.7,0.1,1.0); overflow: hidden; position: relative;
        }
        .bento-card-green:hover { transform: translateY(-4px); }
        .quick-link {
          background: white; border-radius: 16px; padding: 24px;
          border: 1px solid rgba(0,69,13,0.06);
          transition: all 0.35s cubic-bezier(0.05,0.7,0.1,1.0); text-decoration: none; display: block;
        }
        .quick-link:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -15px rgba(0,69,13,0.12); border-color: rgba(0,69,13,0.15); }
        .status-badge {
          display: inline-flex; align-items: center; padding: 3px 10px;
          border-radius: 99px; font-size: 10px; font-weight: 700;
          font-family: 'Manrope', sans-serif; letter-spacing: 0.08em;
          text-transform: uppercase; white-space: nowrap; flex-shrink: 0;
        }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.2s both; }
      `}</style>

      <section className="mb-10 s1">
        <span className="text-xs font-bold uppercase block mb-2"
          style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
          Commercial Portal · ClearPath
        </span>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="font-headline font-extrabold tracking-tight"
            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
            Welcome,{' '}
            <span style={{ color: '#1b5e20' }}>
              {profile?.organisation_name?.split(' ')[0] || profile?.full_name?.split(' ')[0] || 'Business'}
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
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
            <div className="bento-card-green md:col-span-8 p-8 s2">
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full -mr-16 -mt-16"
                style={{ background: 'rgba(163,246,156,0.06)' }} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <span className="text-xs font-bold uppercase block mb-3"
                      style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
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
                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>store</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Business', value: profile?.organisation_name?.slice(0, 8) || 'N/A', icon: 'store' },
                    { label: 'Complaints', value: stats.totalComplaints, icon: 'feedback' },
                    { label: 'District', value: profile?.district?.split(' ')[0] || 'N/A', icon: 'location_on' },
                  ].map(m => (
                    <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <span className="material-symbols-outlined mb-2 block"
                        style={{ color: 'rgba(163,246,156,0.7)', fontSize: '20px' }}>{m.icon}</span>
                      <p className="font-headline font-bold text-xl">{m.value}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bento-card md:col-span-4 p-8 flex flex-col justify-between s2">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Business Profile</h2>
                  <span className="material-symbols-outlined" style={{ color: '#717a6d', fontSize: '20px' }}>store</span>
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'Organisation', value: profile?.organisation_name || '—' },
                    { label: 'Contact', value: profile?.full_name || '—' },
                    { label: 'District', value: profile?.district || '—' },
                    { label: 'Phone', value: profile?.phone || '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-xs font-bold uppercase mb-0.5"
                        style={{ letterSpacing: '0.15em', color: '#94a3b8', fontFamily: 'Manrope, sans-serif' }}>{item.label}</p>
                      <p className="text-sm font-medium truncate" style={{ color: '#181c22' }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,69,13,0.08)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#16a34a' }} />
                  <span className="text-xs font-medium" style={{ color: '#717a6d' }}>
                    Commercial account · CMC verified
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bento-card p-8 mb-6 s3">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>My Complaints</h3>
              <Link href="/dashboard/commercial/complaints"
                className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:opacity-70"
                style={{ color: '#00450d', textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
                View All <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
              </Link>
            </div>
            {complaints.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                  <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '24px' }}>check_circle</span>
                </div>
                <p className="text-sm font-medium" style={{ color: '#181c22' }}>No complaints filed</p>
                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>All clear for your business</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {complaints.map(c => (
                  <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: '#f8fafc' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f0fdf4' }}>
                      <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>feedback</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#181c22' }}>
                        {c.complaint_type?.replace('_', ' ')}
                      </p>
                      <p className="text-xs" style={{ color: '#94a3b8' }}>{new Date(c.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="status-badge" style={statusStyle(c.status)}>{c.status?.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            )}
            <Link href="/dashboard/commercial/complaints/new"
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: '#00450d', color: 'white', textDecoration: 'none', fontFamily: 'Manrope, sans-serif', display: 'flex', marginTop: '16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              New Complaint
            </Link>
          </div>

          <div className="s4">
            <h3 className="font-headline font-bold text-base mb-4" style={{ color: '#181c22' }}>Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {QUICK_LINKS.map(link => (
                <Link key={link.href} href={link.href} className="quick-link">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${link.color}12` }}>
                    <span className="material-symbols-outlined" style={{ color: link.color, fontSize: '22px' }}>{link.icon}</span>
                  </div>
                  <p className="font-bold text-sm mb-1" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{link.label}</p>
                  <p className="text-xs" style={{ color: '#717a6d' }}>{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}