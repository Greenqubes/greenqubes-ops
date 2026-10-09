import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStageJobs } from '@/lib/supabase/queries/jobs'
import { StageListShell } from '@/features/stages/StageListShell'
import { getEffectiveRole, getNavRole } from '@/lib/utils/role-override'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

// Drafts tab (spec 2026-10-09): the private notepad. In the database a draft
// is still status 'pending' — see src/lib/utils/job-stage.ts.
export default async function DraftsPage() {
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
  if (effectiveRole === 'installer') redirect('/installer')
  // Drafts are for the roles that create jobs.
  if (!['sales', 'coordinator', 'scheduler', 'admin'].includes(effectiveRole)) redirect('/schedule')

  // RLS (0062) already returns only the drafts this person shares.
  const jobs = await getStageJobs(['pending', 'awaiting_approval']) // raw status — see job-stage.ts (these are DRAFTS)

  return (
    <Suspense>
      <StageListShell jobs={jobs} stage="draft" lang={(profile.lang as LangCode) ?? 'en'} role={effectiveRole} navRole={navRole} />
    </Suspense>
  )
}
