import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default async function ResidentDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

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
          <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">Resident</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">
          Welcome, {profile?.full_name}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/dashboard/resident/schedules">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-700">Collection Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-500 text-sm">View your area waste collection schedule</p>
              </CardContent>
            </Card>
          </Link>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Track Collection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">See real-time location of collection vehicle</p>
            </CardContent>
          </Card>

          <Link href="/dashboard/resident/complaints">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-700">Report Issue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-500 text-sm">Report missed collections or complaints</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/resident/complaints">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-700">My Complaints</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-500 text-sm">Track status of your submitted complaints</p>
              </CardContent>
            </Card>
          </Link>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-teal-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Reward Tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View your segregation compliance tokens</p>
            </CardContent>
          </Card>

          <Link href="/dashboard/resident/report-dumping">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-700">Report Dumping</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-500 text-sm">Report illegal dumping in your area</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-700 text-sm font-medium">
            Your District: {profile?.district || 'Not set'}
          </p>
          <p className="text-blue-600 text-xs mt-1">
            Next collection: Check schedule for details
          </p>
        </div>
      </div>
    </div>
  )
}