/**
 * The Schedule | Completed switch (Nic, 2026-10-27): "merge completed job tab
 * into schedule tab, with a toggle button" — "basically standardize this view
 * to all roles". Completed left every menu; a switch at the top of the page
 * replaces it, the same one for every role, installers and HR included.
 *
 * Completed stays its own page (/completed), so the schedule does not also
 * have to load every completed job ever, and old links keep working.
 *
 * Pure so its test runs standalone.
 */
import type { Role } from '@/lib/supabase/types'

/** Where the switch's left half goes. Installers have no Schedule page —
 *  /schedule sends them to /installer, which is their "My Jobs". */
export function liveHrefFor(role: Role): '/schedule' | '/installer' {
  return role === 'installer' ? '/installer' : '/schedule'
}

/** Whether a menu tab is lit. A prefix match, as before, plus: the Completed
 *  page belongs to Schedule (or My Jobs), so that tab stays lit there —
 *  with no Completed tab left, nothing would be lit otherwise. Every role has
 *  one of the two, never both. */
export function navTabActive(href: string, pathname: string): boolean {
  if (pathname.startsWith(href)) return true
  return pathname.startsWith('/completed') && (href === '/schedule' || href === '/installer')
}

export type SwitchKey = 'live' | 'all' | 'completed'

/** The switch's choices for a role. Installers get a third, All Jobs — every
 *  confirmed job that day, look-only (Nic, 2026-11-10: "sit on top will do").
 *  Every other role keeps Schedule | Completed. */
export function switchSegments(role: Role): Array<{ key: SwitchKey; href: string; labelKey: 'installerMyJobs' | 'schedule' | 'allJobs' | 'completed' }> {
  const live = liveHrefFor(role)
  return live === '/installer'
    ? [
        { key: 'live',      href: '/installer',     labelKey: 'installerMyJobs' },
        { key: 'all',       href: '/installer/all', labelKey: 'allJobs' },
        { key: 'completed', href: '/completed',     labelKey: 'completed' },
      ]
    : [
        { key: 'live',      href: '/schedule',  labelKey: 'schedule' },
        { key: 'completed', href: '/completed', labelKey: 'completed' },
      ]
}
