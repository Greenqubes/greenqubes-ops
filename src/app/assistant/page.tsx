import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AssistantShell } from '@/features/assistant/AssistantShell'
import type { Role, LangCode } from '@/lib/supabase/types'

export default async function AssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type Profile = { name: string; role: string; lang: string }
  const { data: profile } = await supabase
    .from('users')
    .select('name, role, lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }

  if (!profile) redirect('/login')

  const backHref = (profile.role as Role) === 'installer' ? '/installer' : '/schedule'

  return (
    <AssistantShell
      userName={profile.name}
      role={profile.role as Role}
      lang={profile.lang as LangCode}
      backHref={backHref}
    />
  )
}
