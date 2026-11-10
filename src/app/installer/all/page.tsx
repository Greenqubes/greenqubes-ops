import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAllJobsForDay } from '@/lib/supabase/queries/all-jobs'
import { AllJobsShell } from '@/features/installer/AllJobsShell'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { parseDay } from '@/lib/utils/all-jobs'
import { todaySGT } from '@/lib/utils/design-urgency'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

type Props = { searchParams: Promise<{ day?: string | string[] }> }

/**
 * Installer All Jobs (Nic, 2026-11-10). The role check below is what makes
 * the service-key read in getAllJobsForDay safe — keep it first.
 */
export default async function InstallerAllJobsPage({ searchParams }: Props) {
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

  const today = todaySGT()
  const day   = parseDay((await searchParams).day, today)
  const cards = await getAllJobsForDay(day, profile.id)

  return (
    <AllJobsShell
      cards={cards}
      day={day}
      today={today}
      lang={(profile.lang as LangCode) ?? 'en'}
    />
  )
}
