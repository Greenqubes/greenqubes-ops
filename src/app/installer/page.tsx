import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getInstallerJobs } from '@/lib/supabase/queries/installer'
import { InstallerShell } from '@/features/installer/InstallerShell'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export default async function InstallerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type ProfileRow = { id: string; name: string; role: Role; lang: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role, lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) redirect('/login')

  const effectiveRole = await getEffectiveRole(profile.role)
  if (effectiveRole !== 'installer') redirect('/schedule')

  const jobs = await getInstallerJobs()

  return (
    <InstallerShell
      jobs={jobs}
      lang={(profile.lang as LangCode) ?? 'en'}
      userName={profile.name}
    />
  )
}
