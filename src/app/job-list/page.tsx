import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStageJobs } from '@/lib/supabase/queries/jobs'
import { StageListShell } from '@/features/stages/StageListShell'
import { getEffectiveRole, getNavRole } from '@/lib/utils/role-override'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

// The Jobs tab (Nic, 2026-10-14): Ongoing + Drafts in one tab with a switch,
// opening on Ongoing. It replaced separate Drafts and Ongoing tabs (and before
// those, Pending). Statuses: Ongoing = awaiting_date; Drafts = raw 'pending'
// and the legacy awaiting_approval — see src/lib/utils/job-stage.ts.
//
// Address: /job-list, not /jobs — every job page lives under /jobs/…, and the
// menu lights a tab up whenever the address STARTS with its own.
const DRAFT_ROLES = ['sales', 'coordinator', 'scheduler', 'admin']

export default async function JobListPage() {
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

  const effectiveRole = await getEffectiveRole(profile.role)
  const navRole       = await getNavRole(profile.role)
  // Installers never see Ongoing jobs: crew is confirmed only once a job is
  // on the schedule, so they are never on one. Designer, production and hr see
  // Ongoing (designers start work before the date is set) but have no drafts.
  if (effectiveRole === 'installer') redirect('/installer')
  const hasDrafts = DRAFT_ROLES.includes(effectiveRole)

  // My Jobs panel here too (Nic, 2026-10-19): the same as on the Schedule page
  // for the roles with drafts, and a designer's assigned jobs for designers.
  const isDesigner = effectiveRole === 'designer'
  const [ongoing, drafts, scheduledJobs] = await Promise.all([
    getStageJobs(['awaiting_date']),                                         // raw status — see job-stage.ts
    hasDrafts ? getStageJobs(['pending', 'awaiting_approval']) : Promise.resolve(null), // DRAFTS; RLS (0062) keeps them private
    hasDrafts || isDesigner ? getStageJobs(['scheduled']) : Promise.resolve(null),     // for the panel only
  ])
  const panelJobs = scheduledJobs ? [...ongoing, ...(drafts ?? []), ...scheduledJobs] : null

  return (
    <Suspense>
      <StageListShell ongoing={ongoing} drafts={drafts} canCreate={hasDrafts}
        panelJobs={panelJobs} panelMode={isDesigner ? 'designer' : effectiveRole === 'scheduler' ? 'scheduler' : 'mine'} userId={profile.id}
        lang={(profile.lang as LangCode) ?? 'en'} role={effectiveRole} navRole={navRole} />
    </Suspense>
  )
}
