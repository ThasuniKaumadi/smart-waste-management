import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ROLE_DASHBOARDS, type UserRole } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role && profile.role in ROLE_DASHBOARDS) {
    redirect(ROLE_DASHBOARDS[profile.role as UserRole])
  }

  redirect('/login')
}