import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAllProvisionedUsers } from '@/lib/supabase/queries/coordinators'
import { getDesignerUsers } from '@/lib/supabase/queries/designers'
import { getProjectById } from '@/lib/supabase/queries/projects'
import { NewJobShell } from '@/features/job-detail/NewJobShell'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { LangCode } from '@/lib/i18n'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'
import type { SelectOption } from '@/components/SearchableSelect'
import type { Role } from '@/lib/supabase/types'

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const sp = await searchParams
  const projectPrefill = sp.project ? await getProjectById(sp.project) : null

  // Smoke feedback #3: the "part of project" notice only shows while the
  // project has nothing on the schedule yet — one cheap existence check.
  let projectHasScheduled = false
  if (projectPrefill) {
    // Own client — this runs before the page's `supabase` is declared.
    const sb = await createClient()
    const { data: sched } = await sb
      .from('jobs')
      .select('id')
      .eq('project_id', projectPrefill.id)
      .eq('status', 'scheduled')
      .limit(1)
    projectHasScheduled = !!(sched && sched.length > 0)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type ProfileRow = { id: string; name: string; role: string; lang: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role, lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) redirect('/login')

  // Use the effective (preview-aware) role so admin previewing as sales creates
  // suggestions, not formal assignments — matches the /jobs/[id] edit form.
  const role = await getEffectiveRole(profile.role as Role)
  if (role === 'installer') redirect('/installer')

  // Person-in-Charge and Sub POC/Coordinators both offer every office role
  // (Nic, 2026-07-22) — the old sales/scheduler/admin filter hid newly
  // provisioned coordinators/designers/production. Same rule as /jobs/[id].
  const [officeUsers, { data: installerRows }, designerUsers] = await Promise.all([
    getAllProvisionedUsers(),
    supabase
      .from('users')
      .select('id, name, phone, role, years_experience, skills')
      .eq('role', 'installer')
      .is('deleted_at', null)
      .order('name'),
    getDesignerUsers(),
  ])

  const salesPocOptions: SelectOption[] = officeUsers
  const allInstallers = (installerRows ?? []) as unknown as InstallerUser[]
  const coordinatorOptions = officeUsers
  const designerOptions = designerUsers.map(u => ({ id: u.id, label: u.name }))

  return (
    <NewJobShell
      userId={profile.id}
      userName={profile.name}
      lang={(profile.lang as LangCode) ?? 'en'}
      salesPocOptions={salesPocOptions}
      allInstallers={allInstallers}
      role={role}
      coordinatorOptions={coordinatorOptions}
      designerOptions={designerOptions}
      projectPrefill={projectPrefill ? {
        id: projectPrefill.id,
        name: projectPrefill.name,
        client: projectPrefill.client,
        description: projectPrefill.description,
        default_punctuality: projectPrefill.default_punctuality,
        time_start: projectPrefill.time_start,
        time_end: projectPrefill.time_end,
        hasScheduledJobs: projectHasScheduled,
      } : undefined}
    />
  )
}
