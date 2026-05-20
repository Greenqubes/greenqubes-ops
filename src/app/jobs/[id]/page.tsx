import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getJobById, getInstallerUsers, getJobMessages } from '@/lib/supabase/queries/jobs'
import { JobDetailShell } from '@/features/job-detail/JobDetailShell'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const backHref = sp.from === 'installer' ? '/installer' : '/schedule'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type ProfileRow = { id: string; role: Role; lang: string; name: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role, lang, name')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) redirect('/login')

  const role = await getEffectiveRole(profile.role)

  const [job, installers, messages, salesUsersResult] = await Promise.all([
    getJobById(id),
    role === 'installer' ? Promise.resolve([]) : getInstallerUsers(),
    getJobMessages(id),
    supabase.from('users').select('id, name').eq('role', 'sales').order('name'),
  ])

  if (!job) notFound()

  const salesPocOptions = (salesUsersResult.data ?? []).map((u: { id: string; name: string }) => ({
    id:    u.id,
    label: u.name,
  }))

  return (
    <JobDetailShell
      job={job}
      role={role}
      userId={profile.id}
      userName={profile.name ?? ''}
      lang={(profile.lang as LangCode) ?? 'en'}
      installers={installers}
      initialMessages={messages}
      salesPocOptions={salesPocOptions}
      backHref={backHref}
    />
  )
}
