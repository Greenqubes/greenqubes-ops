// Who may delete a job's attachment files/buckets, and when.
// Mirrors the job-form UI: every office role gets the trash buttons; installers
// never do; a completed job is locked for everyone.

export type FileManageDecision =
  | { allowed: true }
  | { allowed: false; reason: 'role' | 'completed' | 'not-owner' }

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

// ── Installers clearing up their own mistake (Nic, 2026-09-14) ──
//
// The rule above is deliberately "installers never" — it exists so site photos
// can't vanish after the fact. This is a narrow, considered exception, not a
// loosening of it: an installer may delete a COMPLETION file they uploaded
// THEMSELVES, and only while the job is still open. They cannot touch a
// colleague's photo, any other kind of file, or anything once the job is
// completed — at which point a scheduler can still do it for them.
//
// Production needs nothing here: production is an office role, so the rule
// above already lets it delete its own photos. Only the button was missing.

const OWN_DELETE_KINDS = new Set(['completion'])

export interface OwnFileDeleteInput {
  role:       string | null | undefined
  jobStatus:  string | null | undefined
  fileKind:   string | null | undefined
  /** `files.uploader_id` — the app user id, not the auth id. */
  uploaderId: string | null | undefined
  /** The caller's own app user id. */
  userId:     string | null | undefined
}

export function canDeleteOwnUpload(input: OwnFileDeleteInput): FileManageDecision {
  const { role, jobStatus, fileKind, uploaderId, userId } = input
  if (role !== 'installer')                          return { allowed: false, reason: 'role' }
  if (!fileKind || !OWN_DELETE_KINDS.has(fileKind))  return { allowed: false, reason: 'role' }
  if (jobStatus === 'completed')                     return { allowed: false, reason: 'completed' }
  // A missing id on either side must never match — an unknown uploader is
  // not "mine".
  if (!uploaderId || !userId || uploaderId !== userId) return { allowed: false, reason: 'not-owner' }
  return { allowed: true }
}

/** The whole delete gate: the office rule first, then the installer's own
 *  upload. Callers should use this rather than either half. */
export function canDeleteJobFile(input: OwnFileDeleteInput): FileManageDecision {
  const office = canManageJobFiles(input.role, input.jobStatus)
  if (office.allowed) return office
  const own = canDeleteOwnUpload(input)
  if (own.allowed) return own
  // Report the more informative refusal: "job is completed" and "not yours"
  // both tell the person something; a bare "forbidden" does not.
  if (office.reason === 'completed' || own.reason === 'completed') {
    return { allowed: false, reason: 'completed' }
  }
  return own.reason === 'not-owner' ? own : office
}
