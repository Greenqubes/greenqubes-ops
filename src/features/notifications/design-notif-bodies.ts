// The bell's readers for design-notification bodies — pure, so they can be
// tested on their own (moved out of NotificationDrawer.tsx, 2026-10-09).
//
// Install dates may be null: a Pending job can have no date yet (2026-10-09),
// and a reader that demanded a string made the bell print raw JSON.
const dateOrNull = (v: unknown): boolean => typeof v === 'string' || v === null

// design_assigned / design_due_shift upgraded their `body` column to a JSON
// blob (R2-T2 edit 4) so the drawer can show who assigned + client + install
// date, and the due-shift line as "Due date: old → new". Pre-upgrade rows
// carry a plain-text body (the project title, or "old → new") — JSON.parse
// throws on those, so callers fall back to the original single-line
// rendering and older rows still render sensibly.
export type AssignedBody  = { projectTitle: string; assignedBy: string; client: string; installDate: string | null }
export type DueShiftBody  = { projectTitle: string; oldDue: string; newDue: string; client: string; installDate: string }

export function parseAssignedBody(raw: string | null): AssignedBody | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<AssignedBody> | null
    if (v && typeof v === 'object' && typeof v.assignedBy === 'string' && typeof v.client === 'string' && dateOrNull(v.installDate)) {
      return v as AssignedBody
    }
  } catch { /* pre-upgrade plain-text row */ }
  return null
}

export function parseDueShiftBody(raw: string | null): DueShiftBody | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<DueShiftBody> | null
    if (v && typeof v === 'object' && typeof v.oldDue === 'string' && typeof v.newDue === 'string' && typeof v.client === 'string' && typeof v.installDate === 'string') {
      return v as DueShiftBody
    }
  } catch { /* pre-upgrade plain-text row */ }
  return null
}

// design_install_shift (edit 17, Nic 2026-09-01): the install date moved but
// the design due date did NOT follow — kept via the "Install date moved"
// prompt, or the job had none to shift. Born as JSON, so no plain-text
// fallback rows exist for this type.
export type InstallShiftBody = { projectTitle: string; oldInstallDate: string | null; installDate: string | null; dueDate: string | null; client: string }

export function parseInstallShiftBody(raw: string | null): InstallShiftBody | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<InstallShiftBody> | null
    if (v && typeof v === 'object' && dateOrNull(v.oldInstallDate) && dateOrNull(v.installDate) && typeof v.client === 'string' && dateOrNull(v.dueDate)) {
      return v as InstallShiftBody
    }
  } catch { /* malformed row */ }
  return null
}

// design_due_removed (edit 18, Nic 2026-09-01): the office cleared the due
// date. installDate/oldInstallDate differ only when the same save also
// moved the install date.
export type DueRemovedBody = { projectTitle: string; oldDue: string; oldInstallDate: string | null; installDate: string | null; client: string }

export function parseDueRemovedBody(raw: string | null): DueRemovedBody | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<DueRemovedBody> | null
    if (v && typeof v === 'object' && typeof v.oldDue === 'string' && dateOrNull(v.oldInstallDate) && dateOrNull(v.installDate) && typeof v.client === 'string') {
      return v as DueRemovedBody
    }
  } catch { /* malformed row */ }
  return null
}

// design_due_set (edit 19, Nic 2026-09-01): the office typed a due date by
// hand — oldDue null means a first date, otherwise a change.
export type DueSetBody = { projectTitle: string; oldDue: string | null; newDue: string; oldInstallDate: string | null; installDate: string | null; client: string }

export function parseDueSetBody(raw: string | null): DueSetBody | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<DueSetBody> | null
    if (v && typeof v === 'object' && (typeof v.oldDue === 'string' || v.oldDue === null) && typeof v.newDue === 'string' && dateOrNull(v.oldInstallDate) && dateOrNull(v.installDate) && typeof v.client === 'string') {
      return v as DueSetBody
    }
  } catch { /* malformed row */ }
  return null
}
