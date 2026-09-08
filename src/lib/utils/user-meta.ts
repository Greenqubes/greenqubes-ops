// Pure helpers for user name-card meta + admin list filtering.
// Link status (Nic, 2026-09-03/04): shown as a colored DOT beside the name —
// red = no email (card-only row), amber = email set but never signed in,
// green = auth_id set (signed in at least once).

import type { Role } from '@/lib/supabase/types'

// Canonical role order, shared by the Admin > Users filter bar and the job
// form's people pickers so a new role (HR is next) shows up in both at once.
// It lives here rather than in supabase/types.ts because that file is
// regenerated from the live DB and would drop a hand-written constant.
export const ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'installer', 'designer', 'production', 'hr', 'admin']

export type LinkStatus = 'none' | 'pending' | 'linked'

export function linkStatus(u: { email: string | null; auth_id: string | null }): LinkStatus {
  if (u.auth_id) return 'linked'
  if (u.email && u.email.trim() !== '') return 'pending'
  return 'none'
}

export type UserMeta = {
  subroleLine:    string | null
  isDriver:       boolean
  qualifications: string[]
}

export function buildUserMeta(u: {
  role?: string | null
  subrole?: string | null
  is_driver?: boolean | null
  qualifications?: string[] | null
}): UserMeta {
  const subrole = u.subrole?.trim()
  return {
    subroleLine:    subrole || u.role || null,
    isDriver:       u.is_driver === true,
    qualifications: u.qualifications ?? [],
  }
}

export function filterUsers<T extends { role: string; subrole: string | null }>(
  users: T[],
  role: string,
  subrole: string,
): T[] {
  return users.filter(u => {
    if (role !== 'all' && u.role !== role) return false
    if (subrole === 'all') return true
    if (subrole === 'none') return !u.subrole?.trim()
    return u.subrole?.trim() === subrole
  })
}

export function subroleSuggestions(
  users: Array<{ role: string; subrole: string | null }>,
  role: string,
): string[] {
  const set = new Set<string>()
  for (const u of users) {
    const s = u.subrole?.trim()
    if (s && u.role === role) set.add(s)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function qualificationSuggestions(
  users: Array<{ qualifications: string[] | null }>,
): string[] {
  const set = new Set<string>()
  for (const u of users) for (const q of u.qualifications ?? []) {
    const s = q.trim()
    if (s) set.add(s)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

// ── Job-form people pickers (Person-in-Charge, Sub POC / Coordinators) ──
// Both list every non-installer in the company with only a name search, which
// is a long scroll (Nic, 2026-09-07). These two back the role filter added to
// SearchableSelect + MultiUserSelect.

// Roles actually represented in a picker's options, in canonical order, so the
// filter never offers a role that would come back empty. Options carrying no
// role at all (client names, external contacts) yield [] — that is what hides
// the filter for those pickers.
export function rolesPresent<T extends { role?: string | null }>(options: T[]): string[] {
  const present = new Set(
    options.map(o => o.role).filter((r): r is string => typeof r === 'string' && r !== ''),
  )
  return ROLES.filter(r => present.has(r))
}

// Role filter and name search applied together. role is 'all' or a role name;
// an option with no role is hidden whenever a specific role is chosen.
export function filterPickerOptions<T extends { label: string; role?: string | null }>(
  options: T[],
  role: string,
  query: string,
): T[] {
  const q = query.trim().toLowerCase()
  return options.filter(o => {
    if (role !== 'all' && o.role !== role) return false
    if (!q) return true
    return o.label.toLowerCase().includes(q)
  })
}
