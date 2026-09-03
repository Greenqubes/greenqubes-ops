import type { Role } from '@/lib/supabase/types'

// Single source for role → home page. Used by the login redirect
// (src/app/page.tsx) and the guided tour's auto-offer gate — keep them
// in lockstep by editing here only.
export function roleHome(role: Role): string {
  return role === 'installer' ? '/installer' : '/schedule'
}
