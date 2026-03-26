import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default async function DriverDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

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
          <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">Driver</span>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Driver Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/dashboard/driver/routes">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
              <CardHeader className="pb-2"><CardTitle className="text-base text-slate-700">Today's Route</CardTitle></CardHeader>
              <CardContent><p className="text-slate-500 text-sm">View your assigned collection route and stops</p></CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/driver/routes">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
              <CardHeader className="pb-2"><CardTitle className="text-base text-slate-700">Confirm Collections</CardTitle></CardHeader>
              <CardContent><p className="text-slate-500 text-sm">Mark stops as completed or skipped</p></CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/driver/fuel">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
              <CardHeader className="pb-2"><CardTitle className="text-base text-slate-700">Fuel Log</CardTitle></CardHeader>
              <CardContent><p className="text-slate-500 text-sm">Record fuel refill data and odometer readings</p></CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/driver/breakdown">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500">
              <CardHeader className="pb-2"><CardTitle className="text-base text-slate-700">Report Breakdown</CardTitle></CardHeader>
              <CardContent><p className="text-slate-500 text-sm">Report vehicle breakdown in real-time</p></CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/driver/routes">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
              <CardHeader className="pb-2"><CardTitle className="text-base text-slate-700">Collection History</CardTitle></CardHeader>
              <CardContent><p className="text-slate-500 text-sm">View your past collection records</p></CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}