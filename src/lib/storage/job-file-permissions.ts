// Who may delete a job's attachment files/buckets, and when.
// Mirrors the job-form UI: every office role gets the trash buttons; installers
// never do; a completed job is locked for everyone.

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
