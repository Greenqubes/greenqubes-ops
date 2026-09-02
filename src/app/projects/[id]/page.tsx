import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProjectById, getProjectJobs } from '@/lib/supabase/queries/projects'
import { ProjectFormShell } from '@/features/projects/ProjectFormShell'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

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

  const role = await getEffectiveRole(profile.role as Role)
  if (role === 'installer') redirect('/installer')

  const [project, jobs] = await Promise.all([
    getProjectById(id),
    getProjectJobs(id),
  ])

  // notFound() before any ProjectFormShell render — the shell dereferences
  // `project!.id` in edit mode, so this guard is what makes that safe.
  if (!project) notFound()

  return (
    <ProjectFormShell
      mode="edit"
      lang={(profile.lang as LangCode) ?? 'en'}
      role={role}
      userId={profile.id}
      project={project}
      initialJobs={jobs}
    />
  )
}
