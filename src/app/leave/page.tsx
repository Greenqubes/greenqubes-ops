import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { canManageLeave, gateRole } from '@/lib/auth/capabilities'
import { getLeave, getHolidays, getActiveUsers } from '@/lib/supabase/queries/leave'
import { LeaveShell } from '@/features/leave/LeaveShell'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export default async function LeavePage() {
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
  // gateRole covers the trap: getEffectiveRole never returns 'admin', so a
  // real admin resolves to 'scheduler' and would otherwise be bounced off a
  // page they own.
  if (!canManageLeave(gateRole(profile.role, effectiveRole))) redirect('/schedule')

  const [leave, holidays, users] = await Promise.all([getLeave(), getHolidays(), getActiveUsers()])
  const navRole: Role = effectiveRole === 'hr' ? 'hr' : 'admin'

  return (
    <LeaveShell
      initialLeave={leave}
      initialHolidays={holidays}
      users={users}
      lang={(profile.lang as LangCode) ?? 'en'}
      role={navRole}
    />
  )
}
