import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getFCFSDay } from '@/lib/supabase/queries/fcfs'
import { getInstallerUsers } from '@/lib/supabase/queries/jobs'
import { FCFSShell } from '@/features/fcfs/FCFSShell'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

// Singapore never changes offset — render "today" in SGT regardless of where
// the server runs.
function todaySGT(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return now.toISOString().slice(0, 10)
}

export default async function FCFSPage() {
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
  if (effectiveRole === 'installer') redirect('/installer')

  const date = todaySGT()
  const [jobs, installers] = await Promise.all([getFCFSDay(date), getInstallerUsers()])

  return (
    <FCFSShell
      initialJobs={jobs}
      initialDate={date}
      installers={installers}
      role={effectiveRole}
      lang={(profile.lang as LangCode) ?? 'en'}
    />
  )
}
