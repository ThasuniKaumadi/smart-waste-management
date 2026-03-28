import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import LogoutButton from '@/components/LogoutButton'

export default async function RecyclerDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (profile?.role !== 'recycling_partner') redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-green-700 text-white px-6 py-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="font-semibold text-lg">Smart Waste Management</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-green-100 text-sm">{profile?.full_name}</span>
          <span className="bg-green-600 text-xs px-2 py-1 rounded-full">Recycling Partner</span>
          <LogoutButton />
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Recycler Dashboard</h1>
        <p className="text-slate-500 text-sm mb-6">
          Organisation: {profile?.organisation_name || profile?.full_name}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-green-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-100">Pending Pickups</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
              <p className="text-green-200 text-xs mt-1">Awaiting collection</p>
            </CardContent>
          </Card>

          <Card className="bg-blue-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">This Month (kg)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
              <p className="text-blue-200 text-xs mt-1">Total recycled</p>
            </CardContent>
          </Card>

          <Card className="bg-purple-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">Revenue (LKR)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
              <p className="text-purple-200 text-xs mt-1">This month</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Pickup Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View scheduled recyclable pickups</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Confirm Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Confirm received recyclable materials</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Material Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Track received material types and weights</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Revenue Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View revenue from recyclable materials</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-teal-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Blockchain Records</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View on-chain delivery verification records</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">CMC Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Submit monthly reports to CMC</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}