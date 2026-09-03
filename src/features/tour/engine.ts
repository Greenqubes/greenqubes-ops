import type { Role } from '@/lib/supabase/types'
import type { Translations } from '@/lib/i18n'

// Actions a step can fire before it shows, as `tour:<action>` window
// CustomEvents. Components opt in with tiny listeners (UserMenu, NavDrawer,
// the job form's tab state). Every action must be a safe no-op when its
// component isn't on the page.
export type TourAction = 'open-account-menu' | 'open-nav-drawer' | 'job-tab-team'

export type TourStep = {
  id: string
  targets?: string[]             // data-tour values, tried in order; omit = centred card
  route?: string                 // navigate here before showing (e.g. '/jobs/new')
  before?: TourAction | TourAction[]  // run in order (drawer → account menu)
  titleKey: keyof Translations   // typos fail the type-check
  bodyKey: keyof Translations
}

export type TourState = { role: Role; step: number }

// sessionStorage: survives the CompanyBar/TourProvider remount on every
// route change, dies with the tab. localStorage: per-device "seen" flag,
// same pattern as NotificationDrawer's overdue-seen:{userId}.
export const TOUR_STATE_KEY = 'tour-state'
export const TOUR_RESTART_KEY = 'tour-restart'
export const tourSeenKey = (userId: string) => `tour-seen:${userId}`

export const TOUR_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'installer', 'designer', 'production']

export function serializeTourState(s: TourState): string {
  return JSON.stringify(s)
}

export function parseTourState(raw: string | null): TourState | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as { role?: unknown; step?: unknown }
    if (
      typeof v === 'object' && v !== null &&
      TOUR_ROLES.includes(v.role as Role) &&
      Number.isInteger(v.step) && (v.step as number) >= 0
    ) {
      return { role: v.role as Role, step: v.step as number }
    }
  } catch { /* corrupted value — treat as no tour */ }
  return null
}

// dir +1/-1. Returns null when advancing past the last step (tour finished);
// backing up from step 0 stays on step 0.
export function advance(state: TourState, dir: 1 | -1, scriptLength: number): TourState | null {
  const next = state.step + dir
  if (next >= scriptLength) return null
  return { ...state, step: Math.max(0, next) }
}
