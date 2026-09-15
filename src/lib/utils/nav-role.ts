import type { Role } from '@/lib/supabase/types'

/**
 * Roles an admin may preview as. 'admin' is deliberately absent — previewing
 * as admin is a no-op, not a second route to admin rights.
 */
export const PREVIEWABLE_ROLES = new Set<string>([
  'sales', 'scheduler', 'coordinator', 'installer', 'designer', 'production', 'hr',
])

/**
 * Which role's tabs to draw — NOT which permissions to grant.
 *
 * `getEffectiveRole` answers 'scheduler' for a plain admin so the app always
 * has a concrete role-shaped UI to render, and a long list of gates leans on
 * that. The side effect was that `NAV_TABS.admin` could never be reached:
 * every admin navigated with the scheduler's tabs, missing Pending and Leave
 * (Nic spotted it, 2026-09-15). `/leave` had already worked around it with a
 * local `navRole` of its own, and `/assistant` passed the real role — so the
 * admin nav worked on exactly two screens and nowhere else.
 *
 * Preview-as is preserved: an admin checking what sales sees gets the sales
 * nav, which is the entire point of that feature. Non-admins are untouched,
 * including if a stale override cookie is lying around.
 */
export function navRoleFor(realRole: string, override: string | null | undefined): string {
  if (realRole !== 'admin') return realRole
  if (override && PREVIEWABLE_ROLES.has(override)) return override
  return 'admin'
}

/** Typed wrapper for callers that already hold a `Role`. */
export function navRoleForTyped(realRole: Role, override: string | null | undefined): Role {
  return navRoleFor(realRole, override) as Role
}
