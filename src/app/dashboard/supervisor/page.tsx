'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

const RECYCLER_NAV = [
  { label: 'Overview', href: '/dashboard/recycling-partner', icon: 'dashboard' },
  { label: 'Collections', href: '/dashboard/recycling-partner/collections', icon: 'recycling' },
  { label: 'Schedules', href: '/dashboard/recycling-partner/schedules', icon: 'calendar_month' },
]

export default function RecyclingPartnerDashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalCollections: 0,
    completedCollections: 0,
    totalSchedules: 0,
    totalRoutes: 0,
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    const [
      { count: totalCollections },
      { count: completedCollections },
      { count: totalSchedules },
      { count: totalRoutes },
    ] = await Promise.all([
      supabase.from('collection_events').select('*', { count: 'exact', head: true }),
      supabase.from('collection_events').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('schedules').select('*', { count: 'exact', head: true }),
      supabase.from('routes').select('*', { count: 'exact', head: true }),
    ])

    setStats({
      totalCollections: totalCollections || 0,
      completedCollections: completedCollections || 0,
      totalSchedules: totalSchedules || 0,
      totalRoutes: totalRoutes || 0,
    })

    setLoading(false)
  }

  const completionRate = stats.totalCollections > 0
    ? Math.round((stats.completedCollections / stats.totalCollections) * 100) : 0

  return (
    <DashboardLayout
      role="Recycling Partner"
      userName={profile?.full_name || ''}
      navItems={RECYCLER_NAV}
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
        .quick-link {
          background: white; border-radius: 16px; padding: 24px;
          border: 1px solid rgba(0,69,13,0.06);
          transition: all 0.35s cubic-bezier(0.05,0.7,0.1,1.0); text-decoration: none; display: block;
        }
        .quick-link:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -15px rgba(0,69,13,0.12); border-color: rgba(0,69,13,0.15); }
        .progress-bar { height: 6px; border-radius: 99px; background: #f0fdf4; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 99px; }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
      `}</style>

      <section className="mb-10 s1">
        <span className="text-xs font-bold uppercase block mb-2"
          style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
          Recycling Partner Console · ClearPath
        </span>
        <h1 className="font-headline font-extrabold tracking-tight"
          style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
          Recycling <span style={{ color: '#1b5e20' }}>Hub</span>
        </h1>
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
              <div className="absolute top-0 right-0 w-56 h-56 rounded-full -mr-20 -mt-20"
                style={{ background: 'rgba(163,246,156,0.06)' }} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <span className="text-xs font-bold uppercase block mb-2"
                      style={{ letterSpacing: '0.2em', color: 'rgba(163,246,156,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                      Recycling Overview
                    </span>
                    <h2 className="font-headline font-extrabold text-3xl tracking-tight">Material Recovery</h2>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '4px' }}>
                      CMC Recycling Network · {profile?.district || 'All Districts'}
                    </p>
                  </div>
                  <div className="p-3 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>recycling</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Collections', value: stats.totalCollections, icon: 'delete_sweep' },
                    { label: 'Completed', value: stats.completedCollections, icon: 'check_circle' },
                    { label: 'Schedules', value: stats.totalSchedules, icon: 'calendar_month' },
                    { label: 'Total Routes', value: stats.totalRoutes, icon: 'route' },
                  ].map(m => (
                    <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <span className="material-symbols-outlined mb-2 block"
                        style={{ color: 'rgba(163,246,156,0.7)', fontSize: '18px' }}>{m.icon}</span>
                      <p className="font-headline font-bold text-2xl">{m.value}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bento-card md:col-span-4 p-8 s2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Recovery Rate</h2>
                  <span className="material-symbols-outlined" style={{ color: '#717a6d', fontSize: '20px' }}>recycling</span>
                </div>
                <div className="flex flex-col items-center mb-6">
                  <div className="relative w-32 h-32 mb-3">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#f0fdf4" strokeWidth="8" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#00450d" strokeWidth="8"
                        strokeLinecap="round" strokeDasharray={`${completionRate * 2.51} 251`} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-headline font-extrabold text-2xl" style={{ color: '#181c22' }}>{completionRate}%</span>
                      <span className="text-xs" style={{ color: '#717a6d' }}>completed</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-center" style={{ color: '#717a6d' }}>
                  {stats.completedCollections} of {stats.totalCollections} collections completed
                </p>
              </div>
              <div className="mt-4 p-4 rounded-xl" style={{ background: '#f0fdf4' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#16a34a' }} />
                  <span className="text-xs font-medium" style={{ color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                    Blockchain verified on Polygon Amoy
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 s3">
            {[
              { label: 'View Collections', desc: 'Browse all collection events and records', icon: 'delete_sweep', href: '/dashboard/recycling-partner/collections', color: '#00450d' },
              { label: 'View Schedules', desc: 'Check upcoming collection schedules', icon: 'calendar_month', href: '/dashboard/recycling-partner/schedules', color: '#1b5e20' },
              { label: 'CMC Network', desc: 'Connected to Colombo Municipal Council', icon: 'hub', href: '/dashboard/recycling-partner', color: '#2e7d32' },
            ].map(link => (
              <Link key={link.href} href={link.href} className="quick-link">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${link.color}12` }}>
                  <span className="material-symbols-outlined" style={{ color: link.color, fontSize: '22px' }}>{link.icon}</span>
                </div>
                <p className="font-bold text-sm mb-1" style={{ color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{link.label}</p>
                <p className="text-xs" style={{ color: '#717a6d' }}>{link.desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  )
}