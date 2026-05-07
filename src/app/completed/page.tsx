import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompletedJobs } from '@/lib/supabase/queries/jobs'
import { ScheduleShell } from '@/features/schedule/ScheduleShell'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export default async function CompletedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type ProfileRow = { role: Role; lang: string }
  const { data: profile } = await supabase
    .from('users')
    .select('role, lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) redirect('/login')

  const effectiveRole = await getEffectiveRole(profile.role, user.email)
  const jobs = await getCompletedJobs()

  return (
    <ScheduleShell
      jobs={jobs}
      lang={(profile.lang as LangCode) ?? 'en'}
      role={effectiveRole}
      pageMode="completed"
    />
  )
}
