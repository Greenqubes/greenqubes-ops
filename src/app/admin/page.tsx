import { redirect }     from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminShell }   from '@/features/admin/AdminShell'
import type { LangCode, Role } from '@/lib/supabase/types'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type Profile = { name: string; role: Role; lang: LangCode }
  const { data: profile } = await supabase
    .from('users')
    .select('name, role, lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }

  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/schedule')

  return (
    <AdminShell
      userName={profile.name}
      role={profile.role}
      lang={profile.lang}
    />
  )
}
