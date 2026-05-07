import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getApprovalQueue } from '@/lib/supabase/queries/approvals'
import { ApprovalsShell } from '@/features/approvals/ApprovalsShell'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export default async function ApprovalsPage() {
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

  const effectiveRole = await getEffectiveRole(profile.role, user.email)
  if (effectiveRole !== 'scheduler') redirect('/schedule')

  const queue = await getApprovalQueue()

  return (
    <ApprovalsShell
      queue={queue}
      userId={profile.id}
      lang={(profile.lang as LangCode) ?? 'en'}
    />
  )
}
