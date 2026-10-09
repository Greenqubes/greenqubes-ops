import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStageJobs } from '@/lib/supabase/queries/jobs'
import { StageListShell } from '@/features/stages/StageListShell'
import { getEffectiveRole, getNavRole } from '@/lib/utils/role-override'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

// Pending tab (spec 2026-10-09): confirmed projects waiting for an install
// date, visible to the whole office. In the database this stage is status
// 'awaiting_date' — 'pending' there means a private Draft (see
// src/lib/utils/job-stage.ts). Before 2026-10-09 this page listed drafts.
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
  const navRole       = await getNavRole(profile.role)
  // Installers never see Pending jobs: crew is confirmed only once a job is
  // on the schedule, so they are never on one (Nic, 2026-09-15 / 2026-10-09).
  // Designer, production and hr DO see Pending now — designers start work on
  // these jobs before the date is set (2026-10-09; reverses 0060's page bar).
  if (effectiveRole === 'installer') redirect('/installer')

  const jobs = await getStageJobs(['awaiting_date']) // raw status — see job-stage.ts

  return (
    <Suspense>
      <StageListShell jobs={jobs} stage="pending" lang={(profile.lang as LangCode) ?? 'en'} role={effectiveRole} navRole={navRole} />
    </Suspense>
  )
}
