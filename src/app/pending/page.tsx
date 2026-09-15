import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPendingJobs } from '@/lib/supabase/queries/jobs'
import { ScheduleShell } from '@/features/schedule/ScheduleShell'
import { getEffectiveRole, getNavRole } from '@/lib/utils/role-override'
import { isReadOnlyOfficeRole } from '@/lib/auth/capabilities'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export default async function PendingPage() {
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

  const effectiveRole = await getEffectiveRole(profile.role)
  // Nav only: a plain admin navigates with their own tabs. Permissions below
  // keep using effectiveRole exactly as before.
  const navRole      = await getNavRole(profile.role)
  // Installers never see pending jobs — they see the work they are formally
  // assigned to, and a pending job has nobody on it yet. RLS already returned
  // them an empty list, but the page was reachable by URL while /schedule and
  // /fcfs both bounce them; this closes the odd one out (Nic, 2026-09-15).
  if (effectiveRole === 'installer') redirect('/installer')
  // Designer and production are off pending jobs too (Nic, 2026-09-15): a
  // draft has unconfirmed dates and missing details, and production seeing
  // one could mean signage built for a job that changes. Migration 0060
  // enforces this in the database as well — until then they could SELECT
  // every draft in the company and only lacked a link to the page.
  if (effectiveRole === 'designer' || effectiveRole === 'production') redirect('/schedule')
  // hr never sees pending jobs. RLS already returns zero rows for her (the
  // jobs SELECT policy is scoped to non-pending statuses); this keeps the UI
  // honest rather than showing her an empty list.
  if (isReadOnlyOfficeRole(effectiveRole)) redirect('/schedule')
  const jobs = await getPendingJobs()

  return (
    <ScheduleShell
      jobs={jobs}
      lang={(profile.lang as LangCode) ?? 'en'}
      role={effectiveRole}
      navRole={navRole}
      pageMode="pending"
    />
  )
}
