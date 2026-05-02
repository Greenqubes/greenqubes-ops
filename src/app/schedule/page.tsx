import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getScheduleJobs } from '@/lib/supabase/queries/jobs'
import { getApprovalCount } from '@/lib/supabase/queries/approvals'
import { ScheduleShell } from '@/features/schedule/ScheduleShell'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export default async function SchedulePage() {
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

  const [jobs, pendingCount] = await Promise.all([
    getScheduleJobs(),
    profile.role === 'scheduler' ? getApprovalCount() : Promise.resolve(0),
  ])

  return (
    <ScheduleShell
      jobs={jobs}
      lang={(profile.lang as LangCode) ?? 'en'}
      role={profile.role}
      approvalCount={pendingCount}
    />
  )
}
