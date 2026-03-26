'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Button
      onClick={handleLogout}
      variant="outline"
      size="sm"
      className="text-white border-white hover:bg-blue-600 hover:text-white text-xs"
    >
      Sign out
    </Button>
  )
}