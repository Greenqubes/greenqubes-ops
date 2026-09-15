import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole, getNavRole } from '@/lib/utils/role-override'
import { isReadOnlyOfficeRole } from '@/lib/auth/capabilities'
import { getDesignLoad } from '@/lib/supabase/queries/design-load'
import { DesignLoadShell } from '@/features/design-load/DesignLoadShell'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function DesignLoadPage() {
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
  // Nav only: a plain admin navigates with their own tabs. Permissions below
  // keep using effectiveRole exactly as before.
  const navRole      = await getNavRole(profile.role)
  // Installers only need their own jobs; production has no stake in design
  // load. (Same split as the FCFS board, plus the production exclusion.)
  if (effectiveRole === 'installer') redirect('/installer')
  if (effectiveRole === 'production') redirect('/schedule')
  if (isReadOnlyOfficeRole(effectiveRole)) redirect('/schedule')

  const data = await getDesignLoad()

  return (
    <DesignLoadShell
      initialData={data}
      role={effectiveRole}
      navRole={navRole}
      lang={(profile.lang as LangCode) ?? 'en'}
    />
  )
}
