import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import LogoutButton from '@/components/LogoutButton'

export default async function FacilityDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (profile?.role !== 'facility_operator') redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-700 text-white px-6 py-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="font-semibold text-lg">Smart Waste Management</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-100 text-sm">{profile?.full_name}</span>
          <span className="bg-slate-600 text-xs px-2 py-1 rounded-full">Facility Operator</span>
          <LogoutButton />
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Facility Dashboard</h1>
        <p className="text-slate-500 text-sm mb-6">
          Facility: {profile?.organisation_name || profile?.full_name}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-100">Today's Intake (kg)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
              <p className="text-slate-300 text-xs mt-1">Waste received today</p>
            </CardContent>
          </Card>

          <Card className="bg-green-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-100">Capacity Used</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0%</p>
              <p className="text-green-200 text-xs mt-1">Current capacity</p>
            </CardContent>
          </Card>

          <Card className="bg-blue-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Vehicles Today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
              <p className="text-blue-200 text-xs mt-1">Collection trucks received</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-slate-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Intake Log</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Record incoming waste tonnage by vehicle</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Capacity Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Monitor facility storage capacity levels</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Vehicle Log</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Track incoming and outgoing vehicles</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Processing Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Update waste processing and sorting status</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Monthly Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Generate monthly facility reports for CMC</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-teal-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Blockchain Verify</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Verify delivery records on blockchain</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}