import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MobileHistoryShell } from './MobileHistoryShell'
import type { LangCode } from '@/lib/supabase/types'

export default async function AssistantHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type Profile = { lang: string }
  const { data: profile } = await supabase
    .from('users')
    .select('lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }

  if (!profile) redirect('/login')

  return <MobileHistoryShell lang={profile.lang as LangCode} />
}
