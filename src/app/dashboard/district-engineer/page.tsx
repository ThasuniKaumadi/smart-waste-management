import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default async function DistrictEngineerDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const { count: schedulesCount } = await supabase
    .from('schedules')
    .select('*', { count: 'exact', head: true })
    .eq('district', profile?.district || '')

  const { count: complaintsCount } = await supabase
    .from('complaints')
    .select('*', { count: 'exact', head: true })
    .eq('district', profile?.district || '')
    .eq('status', 'submitted')

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
          <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">District Engineer</span>
          <LogoutButton />
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">District Engineer Dashboard</h1>
        <p className="text-slate-500 text-sm mb-6">District: {profile?.district || 'Not assigned'}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-blue-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Active Schedules</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{schedulesCount || 0}</p>
            </CardContent>
          </Card>

          <Card className="bg-orange-500 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-100">Pending Complaints</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{complaintsCount || 0}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/dashboard/district-engineer/schedules">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-700">Manage Schedules</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-500 text-sm">Create and publish collection schedules</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/district-engineer/complaints">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-700">Manage Complaints</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-500 text-sm">Review and resolve district complaints</p>
              </CardContent>
            </Card>
          </Link>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">District Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View collection rates and compliance scores</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Track Vehicles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Monitor real-time GPS of all vehicles</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-teal-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Commercial Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Manage commercial establishments and billing</p>
            </CardContent>
          </Card>

          <Link href="/dashboard/district-engineer/waste-reports">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-700">Waste Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-500 text-sm">Review crowdsourced waste incident reports</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}