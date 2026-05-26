import { cookies } from 'next/headers'
import type { Role } from '@/lib/supabase/types'

const VALID_ROLES = new Set<Role>(['sales', 'scheduler', 'installer'])

export async function getEffectiveRole(realRole: Role): Promise<Role> {
  if (realRole !== 'admin') return realRole
  try {
    const cookieStore = await cookies()
    const override = cookieStore.get('role_override')?.value as Role | undefined
    if (override && VALID_ROLES.has(override)) return override
  } catch {
    // cookies() unavailable in this context — fall back
  }
  return 'scheduler'
}
