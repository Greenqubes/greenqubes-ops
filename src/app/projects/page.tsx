import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProjectsList } from '@/lib/supabase/queries/projects'
import { ProjectsListShell } from '@/features/projects/ProjectsListShell'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export default async function ProjectsPage() {
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

  const projects = await getProjectsList()

  return (
    <ProjectsListShell
      lang={(profile.lang as LangCode) ?? 'en'}
      projects={projects}
    />
  )
}
