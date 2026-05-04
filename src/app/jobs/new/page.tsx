import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewJobShell } from '@/features/job-detail/NewJobShell'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export default async function NewJobPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type ProfileRow = { id: string; role: Role; lang: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role, lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) redirect('/login')
  if (profile.role === 'installer') redirect('/installer')

  return (
    <NewJobShell
      role={profile.role}
      userId={profile.id}
      lang={(profile.lang as LangCode) ?? 'en'}
    />
  )
}
