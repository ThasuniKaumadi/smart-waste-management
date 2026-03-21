import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function SupervisorDashboard() {
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
          <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">Field Supervisor</span>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Supervisor Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardHeader className="pb-2"><CardTitle className="text-base text-slate-700">Live Route Monitor</CardTitle></CardHeader>
            <CardContent><p className="text-slate-500 text-sm">Track all assigned routes in real-time</p></CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardHeader className="pb-2"><CardTitle className="text-base text-slate-700">Exception Alerts</CardTitle></CardHeader>
            <CardContent><p className="text-slate-500 text-sm">View skipped collections and deviations</p></CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardHeader className="pb-2"><CardTitle className="text-base text-slate-700">Driver Performance</CardTitle></CardHeader>
            <CardContent><p className="text-slate-500 text-sm">Monitor driver completion rates</p></CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardHeader className="pb-2"><CardTitle className="text-base text-slate-700">Waste Reports</CardTitle></CardHeader>
            <CardContent><p className="text-slate-500 text-sm">Review and resolve crowdsourced reports</p></CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500">
            <CardHeader className="pb-2"><CardTitle className="text-base text-slate-700">Problem Heatmap</CardTitle></CardHeader>
            <CardContent><p className="text-slate-500 text-sm">View chronically problematic routes</p></CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}