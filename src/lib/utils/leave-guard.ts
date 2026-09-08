import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { canManageLeave, gateRole } from '@/lib/auth/capabilities'
import type { Role } from '@/lib/supabase/types'

// Shared auth gate for the four leave/holiday routes. Server-only: it reads
// cookies through the Supabase server client, so nothing pure may import it.
//
// API routes self-guard — the middleware deliberately skips /api/* — so this
// runs on every leave request rather than being assumed upstream.
//
// The capability check goes through gateRole() because getEffectiveRole()
// NEVER returns 'admin': a plain admin resolves to 'scheduler', and an admin
// previewing as another role returns that role. Testing the effective role
// alone would lock real admins out of their own Leave tab.
//
// This is belt-and-braces, not the real gate. RLS on user_leaves /
// user_leave_details / public_holidays is what actually refuses the write —
// these routes use the USER-SCOPED client precisely so that stays true.

export type LeaveGuard = {
  ok:       boolean
  supabase: Awaited<ReturnType<typeof createClient>>
  /** The caller's public.users row id — used for created_by. Null when !ok. */
  userId:   string | null
}

export async function guardHr(): Promise<LeaveGuard> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, supabase, userId: null }

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return { ok: false, supabase, userId: null }

  const effectiveRole = await getEffectiveRole(profile.role)
  const ok = canManageLeave(gateRole(profile.role, effectiveRole))
  return { ok, supabase, userId: profile.id }
}
