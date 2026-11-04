/** How an install-date edit should be treated by the design due-date logic
 *  (spec 2026-10-09). Only 'moved' shifts the due date; 'set' and 'cleared'
 *  leave it alone because there is no old date to measure from or to. */
export type DateChange = 'none' | 'set' | 'cleared' | 'moved'

export function designDateChange(
  oldDate: string | null,
  newDate: string | null | undefined,
): DateChange {
  if (newDate === undefined) return 'none'
  const next = newDate || null
  if (next === oldDate) return 'none'
  if (!oldDate) return 'set'
  if (!next)    return 'cleared'
  return 'moved'
}

/** The job page's PATCH /api/jobs/[id] body for the design fields. `date`
 *  rides along only when it changed — the route shifts the due date and tells
 *  the designers off it. A To arrange offer (`proposedDate`) never sends it:
 *  the slot is only a proposal, and the designers' due date is separate from
 *  it (Nic 2026-11-04). The date itself is saved with the rest of the form. */
export function designPatchBody(f: {
  brief:          string
  dueDate:        string | null
  dueManual:      boolean
  newDate:        string | null
  jobDate:        string | null
  keepManualDue?: boolean
  proposedDate?:  boolean
}): Record<string, unknown> {
  return {
    design_brief:      f.brief || null,
    design_due_date:   f.dueDate,
    design_due_manual: f.dueManual,
    ...(!f.proposedDate && f.newDate !== f.jobDate ? { date: f.newDate || null } : {}),
    ...(f.keepManualDue ? { keepManualDue: true } : {}),
  }
}
