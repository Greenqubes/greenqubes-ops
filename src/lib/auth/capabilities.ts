// Capability gates — who may do what, asked BY NAME rather than by role.
//
// Why this file exists (Nic, 2026-09-08): the `hr` role is HR *and* Finance
// today because one person does both jobs, but it may be split into two roles
// later. Every screen therefore asks a question here instead of testing
// `role === 'hr'` directly, so the split is an edit to this one file rather
// than a hunt through a dozen components.
//
// To split HR and Finance later:
//   1. add 'finance' to `Role` in src/lib/supabase/types.ts (+ an enum migration)
//   2. add it to `showsFinancialsCard` and `isReadOnlyOfficeRole` below
//   3. leave `canManageLeave` alone — recording leave stays HR's job
//   4. mirror the same change in the SQL capability functions (below)
// No component changes, no rows to migrate, and the existing hr account keeps
// working exactly as it does today.
//
// These mirror the SQL functions created in
// supabase/migrations/0058_leave_tables_hr_policies.sql. **The database is the
// real enforcement** — RLS decides what data is returned at all; these keep the
// UI honest and must be kept in step with their SQL counterparts:
//   canManageLeave       <-> can_manage_leave()
//   showsFinancialsCard  <-> can_view_all_prices()   (see the note on it)
//   isReadOnlyOfficeRole <-> can_view_jobs_readonly()

import type { Role } from '@/lib/supabase/types'

/**
 * Admin must be tested on the REAL role: `getEffectiveRole()` never returns
 * 'admin' — a plain admin resolves to 'scheduler', and while previewing as
 * another role it returns that role. Pass both and this picks the one the
 * gates should see. Use it wherever a capability check needs to cover admin.
 */
export function gateRole(realRole: Role, effectiveRole: Role): Role {
  return realRole === 'admin' ? 'admin' : effectiveRole
}

/**
 * HR half — may create, edit and delete leave records and public holidays.
 * A future `finance` role should NOT be added here.
 */
export function canManageLeave(role: Role): boolean {
  return role === 'hr' || role === 'admin'
}

/**
 * Finance half — whose job form shows the read-only prices card.
 *
 * Deliberately narrower than the SQL `can_view_all_prices()`, which also
 * covers sales/scheduler/admin because they have always been able to READ
 * `job_financials`. They lost the card from their form on purpose in session
 * 17.6 and are not getting it back: this asks "does the card render?", not
 * "is the data readable?". A future `finance` role belongs here.
 */
export function showsFinancialsCard(role: Role): boolean {
  return role === 'hr'
}

/**
 * Shared by both halves — a role that can look at the app but change nothing:
 * schedule view-only, job form read-only, no job chat, no FCFS, no pending
 * jobs, no Admin. A future `finance` role belongs here.
 */
export function isReadOnlyOfficeRole(role: Role): boolean {
  return role === 'hr'
}
