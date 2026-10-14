/**
 * The Jobs tab (Nic, 2026-10-14): Drafts and Ongoing in one tab with a switch,
 * opening on Ongoing. The choice lives in the address (?view=drafts) so the
 * back button and the My Jobs panel can land on the right list.
 */

export type StageView = 'ongoing' | 'drafts'

/** Roles without drafts (designer, production, hr) always get Ongoing — a
 *  typed ?view=drafts must not strand them on a list they have no switch for. */
export function resolveStageView(param: string | null | undefined, canSeeDrafts: boolean): StageView {
  return param === 'drafts' && canSeeDrafts ? 'drafts' : 'ongoing'
}

export function jobListHref(view: StageView, highlightId?: string): string {
  const q = new URLSearchParams()
  if (view === 'drafts') q.set('view', 'drafts')
  if (highlightId) q.set('highlight', highlightId)
  const s = q.toString()
  return s ? `/job-list?${s}` : '/job-list'
}
