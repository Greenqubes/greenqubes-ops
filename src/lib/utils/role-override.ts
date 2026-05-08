import { cookies } from 'next/headers'
import type { Role } from '@/lib/supabase/types'

export const ADMIN_EMAIL = 'ai@greenqubes.com'

const VALID_ROLES = new Set<Role>(['sales', 'scheduler', 'installer'])

export async function getEffectiveRole(
  realRole: Role,
  userEmail: string | undefined,
): Promise<Role> {
  if (userEmail !== ADMIN_EMAIL) return realRole
  try {
    const cookieStore = await cookies()
    const override = cookieStore.get('role_override')?.value as Role | undefined
    if (override && VALID_ROLES.has(override)) return override
  } catch {
    // cookies() unavailable in this context — fall back to real role
  }
  return realRole
}
