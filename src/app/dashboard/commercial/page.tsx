import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import LogoutButton from '@/components/LogoutButton'

export default async function CommercialDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (profile?.role !== 'commercial_establishment') redirect('/login')

  const { count: totalComplaints } = await supabase
    .from('complaints')
    .select('*', { count: 'exact', head: true })
    .eq('submitted_by', user.id)

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-indigo-700 text-white px-6 py-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="font-semibold text-lg">Smart Waste Management</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-indigo-100 text-sm">{profile?.full_name}</span>
          <span className="bg-indigo-600 text-xs px-2 py-1 rounded-full">Commercial</span>
          <LogoutButton />
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Commercial Dashboard</h1>
        <p className="text-slate-500 text-sm mb-6">
          Business: {profile?.organisation_name || profile?.full_name}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-indigo-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-indigo-100">Service Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">Active</p>
              <p className="text-indigo-200 text-xs mt-1">Waste collection service</p>
            </CardContent>
          </Card>

          <Card className="bg-green-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-100">Next Collection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">Check Schedule</p>
              <p className="text-green-200 text-xs mt-1">View your schedule</p>
            </CardContent>
          </Card>

          <Card className="bg-orange-500 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-100">My Complaints</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalComplaints || 0}</p>
              <p className="text-orange-200 text-xs mt-1">Total submitted</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-indigo-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Collection Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View your waste collection schedule</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Track Vehicle</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Track collection vehicle in real-time</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Report Issue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Report missed collection or service issue</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Billing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View and pay your waste collection bills</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Waste Declaration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Declare your monthly waste generation</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-teal-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Service History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View your complete service history</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}