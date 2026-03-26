import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import LogoutButton from '@/components/LogoutButton'

export default async function CommercialDashboard() {
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
          <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">Commercial Establishment</span>
          <LogoutButton />
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Welcome, {profile?.full_name}
        </h1>
        <p className="text-slate-500 text-sm mb-6">{profile?.organisation_name}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Collection Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View your waste collection schedule and next pickup</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Track Collection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">See real-time location of your collection vehicle</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Billing & Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View invoices, make payments, and check billing status</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Service Agreement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">View your registered bin count and service details</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Report Issue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Report missed collections or service complaints</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-teal-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Bulk Pickup Request</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">Request a special pickup for bulk or irregular waste</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-700 text-sm font-medium">District: {profile?.district || 'Not set'}</p>
          <p className="text-blue-600 text-xs mt-1">Address: {profile?.address || 'Not set'}</p>
        </div>
      </div>
    </div>
  )
}