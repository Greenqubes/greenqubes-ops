// Pure helpers for user name-card meta + admin list filtering.
// Link status (Nic, 2026-09-03/04): shown as a colored DOT beside the name —
// red = no email (card-only row), amber = email set but never signed in,
// green = auth_id set (signed in at least once).

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
