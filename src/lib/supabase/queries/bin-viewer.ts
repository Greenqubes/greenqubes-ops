import { createClient } from '@/lib/supabase/server'
import { hasBin } from '@/lib/utils/bin-rules'

/** The signed-in user with their REAL role (never preview-as — the bin mirrors
 *  the database, which never sees preview-as). Null when signed out or when
 *  the role has no bin. */
export async function getBinViewer(): Promise<{ id: string; role: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  const p = data as { id: string; role: string } | null
  return p && hasBin(p.role) ? p : null
}
