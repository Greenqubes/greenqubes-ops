import { redirect }    from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminShell }   from '@/features/admin/AdminShell'
import type { LangCode } from '@/lib/supabase/types'

const ADMIN_EMAIL = 'ai@greenqubes.com'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Hard gate: only the designated admin account may enter
  if (user.email !== ADMIN_EMAIL) redirect('/schedule')

  type Profile = { name: string; role: string; lang: LangCode }
  const { data: profile } = await supabase
    .from('users')
    .select('name, role, lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }

  if (!profile) redirect('/login')

  return (
    <AdminShell
      userName={profile.name}
      role={profile.role as 'scheduler'}
      lang={profile.lang}
    />
  )
}
