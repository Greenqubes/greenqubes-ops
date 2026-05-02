'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { en } from '@/lib/i18n/en'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm font-medium lowercase tracking-wide px-4 py-2 rounded-lg transition-colors"
      style={{
        border: '1px solid var(--line)',
        color: 'var(--ink2)',
      }}
    >
      {en.signOut}
    </button>
  )
}
