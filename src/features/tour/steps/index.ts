import type { Role } from '@/lib/supabase/types'
import type { TourStep } from '../engine'
import { salesSteps } from './sales'
import { schedulerSteps } from './scheduler'

// Role → script registry. Tasks 8-10 add one entry per role; a role with
// no entry simply never offers a tour (the provider checks scriptForRole).
export const TOUR_SCRIPTS: Partial<Record<Role, TourStep[]>> = {
  sales: salesSteps,
  scheduler: schedulerSteps,
}

export function scriptForRole(role: Role): TourStep[] | null {
  return TOUR_SCRIPTS[role] ?? null
}
