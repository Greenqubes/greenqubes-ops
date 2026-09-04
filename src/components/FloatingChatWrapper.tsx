import { createClient } from '@/lib/supabase/server'
import { FloatingChatPanel } from './FloatingChatPanel'
import { FloatingVoiceButton } from './FloatingVoiceButton'
import type { LangCode } from '@/lib/i18n'

// Server component — fetches user lang ONCE for both floating surfaces (the
// chat panel and the voice button). A second wrapper would double the auth +
// profile round-trip on every page render.
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

    const lang = profile.lang as LangCode
    return (
      <>
        <FloatingChatPanel lang={lang} />
        <FloatingVoiceButton lang={lang} />
      </>
    )
  } catch {
    return null
  }
}
