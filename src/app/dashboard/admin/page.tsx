import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/login')

  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { count: totalComplaints } = await supabase
    .from('complaints')
    .select('*', { count: 'exact', head: true })

  const { count: totalRoutes } = await supabase
    .from('routes')
    .select('*', { count: 'exact', head: true })

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
          <span className="bg-red-500 text-xs px-2 py-1 rounded-full">System Administrator</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">
          System Administration
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-blue-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalUsers || 0}</p>
            </CardContent>
          </Card>

          <Card className="bg-green-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-100">Total Complaints</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalComplaints || 0}</p>
            </CardContent>
          </Card>

          <Card className="bg-orange-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-100">Total Routes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalRoutes || 0}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/dashboard/admin/users">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-700">Manage Users</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-500 text-sm">Create, update and deactivate staff accounts</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/admin/performance">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-700">System Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-500 text-sm">View performance across all districts</p>
              </CardContent>
            </Card>
          </Link>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Manage Districts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Configure district settings and assignments</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">All Complaints</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View and manage all system complaints</p>
            </CardContent>
          </Card>

          <Link href="/dashboard/admin/blockchain">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-teal-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-700">Blockchain Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-500 text-sm">View all on-chain transaction records</p>
              </CardContent>
            </Card>
          </Link>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">System Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Configure system-wide settings and parameters</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}