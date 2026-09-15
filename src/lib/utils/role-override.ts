import { cookies } from 'next/headers'
import type { Role } from '@/lib/supabase/types'
import { navRoleForTyped } from './nav-role'

const VALID_ROLES = new Set<Role>(['sales', 'scheduler', 'coordinator', 'installer', 'designer', 'production', 'hr'])

/**
 * The role the NAVIGATION should be built from — not the one permissions use.
 *
 * `getEffectiveRole` deliberately answers 'scheduler' for a plain admin so the
 * app has a working role-shaped UI to render, and a long list of gates depends
 * on that. The side effect was that `NAV_TABS.admin` could never be reached:
 * every admin has been navigating with the scheduler's tabs, missing Pending
 * and Leave (Nic spotted the gap, 2026-09-15).
 *
 * This keeps the preview-as behaviour intact — an admin previewing as sales
 * still gets the sales tabs, which is the entire point of that feature — and
 * only differs for an admin who is NOT previewing, who now gets their own.
 *
 * Nav only. Never use this to decide what someone may do.
 */
export async function getNavRole(realRole: Role): Promise<Role> {
  let override: string | undefined
  try {
    override = (await cookies()).get('role_override')?.value
  } catch {
    // cookies() unavailable in this context — navRoleFor falls back safely
  }
  return navRoleForTyped(realRole, override)
}

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
