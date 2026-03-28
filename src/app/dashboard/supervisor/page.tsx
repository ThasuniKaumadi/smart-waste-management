import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default async function SupervisorDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (profile?.role !== 'supervisor') redirect('/login')

  const { count: activeRoutes } = await supabase
    .from('routes')
    .select('*', { count: 'exact', head: true })
    .eq('district', profile.district)
    .eq('status', 'active')

  const { count: pendingComplaints } = await supabase
    .from('complaints')
    .select('*', { count: 'exact', head: true })
    .eq('district', profile.district)
    .eq('status', 'submitted')

  const { count: breakdowns } = await supabase
    .from('breakdown_reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'reported')

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
          <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">Supervisor</span>
          <LogoutButton />
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Supervisor Dashboard</h1>
        <p className="text-slate-500 text-sm mb-6">District: {profile?.district}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-blue-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Active Routes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{activeRoutes || 0}</p>
              <p className="text-blue-200 text-xs mt-1">Currently in progress</p>
            </CardContent>
          </Card>

          <Card className="bg-orange-500 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-100">Pending Complaints</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{pendingComplaints || 0}</p>
              <p className="text-orange-200 text-xs mt-1">Awaiting response</p>
            </CardContent>
          </Card>

          <Card className="bg-red-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-100">Breakdowns</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{breakdowns || 0}</p>
              <p className="text-red-200 text-xs mt-1">Reported today</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Monitor Routes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Track active collection routes in your district</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Vehicle Breakdowns</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View and respond to breakdown reports</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Driver Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Monitor driver check-ins and attendance</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Collection Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View daily collection completion reports</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Complaints</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Review resident complaints in your area</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-teal-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Fuel Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Review driver fuel consumption logs</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}