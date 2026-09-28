import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole, getNavRole } from '@/lib/utils/role-override'
import { hasBin } from '@/lib/utils/bin-rules'
import { BinShell } from '@/features/bin/BinShell'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

// The job bin (Nic, 2026-09-28). Gated on the REAL role: the bin mirrors the
// database, which never sees preview-as — so an admin previewing as installer
// still has the bin, and nobody else gains one by previewing.
export default async function BinPage() {
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
  if (!hasBin(profile.role)) redirect('/schedule')

  const [effectiveRole, navRole] = await Promise.all([
    getEffectiveRole(profile.role),
    getNavRole(profile.role),
  ])

  return (
    <BinShell
      lang={(profile.lang as LangCode) ?? 'en'}
      isAdmin={profile.role === 'admin'}
      role={effectiveRole}
      navRole={navRole}
    />
  )
}
