/**
 * The Jobs tab (Nic, 2026-10-14): Drafts and Ongoing in one tab with a switch.
 * Since 2026-11-04 a third list, To arrange (Ongoing jobs sales has marked
 * ready, spec 2026-11-04-to-arrange-design.md); the switch reads
 * Drafts · Ongoing · To arrange. The choice lives in the address (?view=…) so
 * the back button and the My Jobs panel can land on the right list.
 */

export type StageView = 'drafts' | 'ongoing' | 'arrange'

/** A bare /job-list opens here. To arrange is the scheduler's inbox (Claude's
 *  call, approved by Nic with the design); everyone else keeps Ongoing. A plain
 *  admin reads as 'scheduler' here too. */
export function defaultStageView(role: string): StageView {
  return role === 'scheduler' ? 'arrange' : 'ongoing'
}

/** Roles without drafts (designer, production, hr) never get Drafts — a
 *  typed ?view=drafts must not strand them on a list they have no switch for. */
export function resolveStageView(
  param: string | null | undefined, canSeeDrafts: boolean, fallback: StageView,
): StageView {
  if (param === 'drafts') return canSeeDrafts ? 'drafts' : fallback === 'drafts' ? 'ongoing' : fallback
  if (param === 'ongoing' || param === 'arrange') return param
  return fallback
}

/** Always carries ?view= — a bare /job-list means "my default", which is not
 *  Ongoing for everyone any more. */
export function jobListHref(view: StageView, highlightId?: string): string {
  const q = new URLSearchParams({ view })
  if (highlightId) q.set('highlight', highlightId)
  return `/job-list?${q.toString()}`
}

/** The My Jobs jump (scroll the row into view, blink it twice) runs once per
 *  job per list. `last` is the "view:job" it last ran for; it is forgotten
 *  when the highlight goes away, so tapping the same job again jumps again.
 *  `ready` = the row exists (its group, if any, is open). */
export function nextBlink(
  last: string | null, highlight: string | null, view: string, ready: boolean,
): { blink: boolean; last: string | null } {
  if (!highlight) return { blink: false, last: null }
  if (!ready) return { blink: false, last }
  const key = `${view}:${highlight}`
  return key === last ? { blink: false, last } : { blink: true, last: key }
}
