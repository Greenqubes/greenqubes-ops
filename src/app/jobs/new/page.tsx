import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewJobShell } from '@/features/job-detail/NewJobShell'
import type { LangCode } from '@/lib/i18n'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'
import type { SelectOption } from '@/components/SearchableSelect'
import type { Role } from '@/lib/supabase/types'

export default async function NewJobPage() {
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
  if (profile.role === 'installer') redirect('/installer')

  const [{ data: salesRows }, { data: installerRows }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name')
      .in('role', ['sales', 'scheduler', 'admin'])
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('users')
      .select('id, name, phone, role, years_experience, skills')
      .eq('role', 'installer')
      .is('deleted_at', null)
      .order('name'),
  ])

  const salesPocOptions: SelectOption[] = ((salesRows ?? []) as { id: string; name: string }[])
    .map(u => ({ id: u.id, label: u.name }))
  const allInstallers = (installerRows ?? []) as unknown as InstallerUser[]

  const coordinatorOptions = ((salesRows ?? []) as { id: string; name: string }[])
    .map(u => ({ id: u.id, label: u.name }))

  return (
    <NewJobShell
      userId={profile.id}
      userName={profile.name}
      lang={(profile.lang as LangCode) ?? 'en'}
      salesPocOptions={salesPocOptions}
      allInstallers={allInstallers}
      role={profile.role as Role}
      coordinatorOptions={coordinatorOptions}
    />
  )
}
