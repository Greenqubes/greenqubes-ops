// Who may delete or move a job's files and attachment buckets, and when.
// Attachments: every office role; installers never; a completed job is locked
// for everyone. The job form's three photo sections follow their own rule,
// canDeleteJobFile below.

export type FileManageDecision =
  | { allowed: true }
  | { allowed: false; reason: 'role' | 'completed' }

const OFFICE_ROLES = new Set(['sales', 'scheduler', 'coordinator', 'designer', 'production', 'admin'])

// jobStatus null/undefined means the job row is gone (orphaned file) —
// office roles may still clean those up.
export function canManageJobFiles(
  role: string | null | undefined,
  jobStatus: string | null | undefined,
): FileManageDecision {
  if (!role || !OFFICE_ROLES.has(role)) return { allowed: false, reason: 'role' }
  if (jobStatus === 'completed')        return { allowed: false, reason: 'completed' }
  return { allowed: true }
}

// ── The job form's photo sections: one standard rule (Nic, 2026-09-28) ──
//
// Production Photos, Signed DO and Completion Photos are what people get wrong
// on site — the wrong picture in the wrong box, usually noticed right after
// pressing Completed. So for these three kinds:
//
//   • anyone who may delete there may delete ANY upload, not just their own
//     (whose it is stopped mattering — Nic);
//   • while the job is open, and for 24 hours after it is completed, for
//     office staff and installers alike. After that the record is locked;
//   • on a completed job the LAST completion photo stays — the job was only
//     allowed to complete because it had one. Signed DO has no minimum.
//
// Installers get Completion Photos and Signed DO; production photos stay
// office-only. Every other kind (attachments) keeps the office rule above,
// locked the moment a job completes.

export const COMPLETION_GRACE_MS = 24 * 60 * 60 * 1000

const PHOTO_KINDS     = new Set(['completion', 'do', 'production_instructions'])
const INSTALLER_KINDS = new Set(['completion', 'do'])

export type FileDeleteDecision =
  | { allowed: true }
  | { allowed: false; reason: 'role' | 'completed' | 'last-completion' }

export interface FileDeleteInput {
  role:        string | null | undefined
  jobStatus:   string | null | undefined
  /** `jobs.completed_at` — starts the 24-hour window. Missing = no window. */
  completedAt: string | null | undefined
  fileKind:    string | null | undefined
  /** Completion files on the job OTHER than this one. */
  otherCompletionFiles: number
  now?:        number
}

/** True while a completed job's photo sections are still correctable. */
export function withinCompletionGrace(completedAt: string | null | undefined, now = Date.now()): boolean {
  if (!completedAt) return false
  const at = Date.parse(completedAt)
  if (Number.isNaN(at)) return false
  return now - at < COMPLETION_GRACE_MS
}

/** The whole delete gate for a single file. Callers use this, never the
 *  office rule alone. */
export function canDeleteJobFile(input: FileDeleteInput): FileDeleteDecision {
  const { role, jobStatus, completedAt, fileKind, otherCompletionFiles, now = Date.now() } = input
  const isPhoto = !!fileKind && PHOTO_KINDS.has(fileKind)

  // Attachments and anything else: the office rule, unchanged.
  if (!isPhoto) return canManageJobFiles(role, jobStatus)

  const mayTouch = role === 'installer'
    ? INSTALLER_KINDS.has(fileKind!) && jobStatus != null   // an orphan is office clean-up
    : !!role && OFFICE_ROLES.has(role)
  if (!mayTouch) return { allowed: false, reason: 'role' }

  if (jobStatus !== 'completed') return { allowed: true }
  if (!withinCompletionGrace(completedAt, now)) return { allowed: false, reason: 'completed' }
  if (fileKind === 'completion' && otherCompletionFiles < 1) {
    return { allowed: false, reason: 'last-completion' }
  }
  return { allowed: true }
}
