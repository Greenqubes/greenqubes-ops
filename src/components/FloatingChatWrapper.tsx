import { createClient } from '@/lib/supabase/server'
import { FloatingChatPanel } from './FloatingChatPanel'
import type { LangCode } from '@/lib/i18n'

// Server component — fetches user lang for the floating chat panel.
// Returns null if unauthenticated (login page, etc.).
export async function FloatingChatWrapper() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('users')
      .select('lang')
      .eq('auth_id', user.id)
      .maybeSingle() as { data: { lang: string } | null; error: unknown }

    if (!profile) return null

    return <FloatingChatPanel lang={profile.lang as LangCode} />
  } catch {
    return null
  }
}
