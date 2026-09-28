/**
 * The sealed copy a deleted job becomes (spec 2026-09-28-job-bin-design.md).
 * Nic chose a sealed copy over flagging jobs in place, so a binned job can
 * never surface on a screen, in a cron or in a bot message by accident.
 *
 * Bell notifications are deliberately NOT captured — they are not restored.
 * Pure, so it can be run standalone by its test.
 */

// Insert order on restore — FK-safe: files.bucket_id points at
// attachment_buckets, so buckets come first.
export const BIN_CHILD_TABLES = [
  'job_financials', 'job_assignees', 'job_coordinators', 'job_designers',
  'job_external_contacts', 'attachment_buckets', 'files', 'messages',
  'job_tasks', 'design_scores', 'job_chat_state',
] as const
export type ChildTable = typeof BIN_CHILD_TABLES[number]
export type Row = Record<string, unknown>

export type JobSnapshot = {
  version:  1
  job:      Row
  children: Record<ChildTable, Row[]>
  /** id → display name at the moment of deletion, so a restore can name
   *  someone whose account has since gone. */
  people:   Record<string, string>
}

// Columns with a users(id) FOREIGN KEY. A required one pointing at a user who
// no longer exists would abort the whole restore, so that row is dropped; an
// optional one is blanked. Columns WITHOUT an FK (jobs.created_by,
// design_completed_by, job_external_contacts.suggested_by) keep their value —
// they cannot fail, and created_by must survive for pending privacy.
const REQUIRED_USER: Partial<Record<ChildTable, string>> = {
  job_assignees: 'user_id', job_coordinators: 'user_id',
  job_designers: 'user_id', job_chat_state: 'user_id',
}
const OPTIONAL_USER_JOB = ['sales_poc_id', 'approved_by']
const OPTIONAL_USER: Partial<Record<ChildTable, string[]>> = {
  files: ['uploader_id'], messages: ['author_id'],
  job_assignees: ['suggested_by'], job_tasks: ['created_by', 'completed_by'],
}

function isId(v: unknown): v is string { return typeof v === 'string' && v.length > 0 }

export function snapshotUserIds(s: JobSnapshot): string[] {
  const ids = new Set<string>()
  for (const c of OPTIONAL_USER_JOB) if (isId(s.job[c])) ids.add(s.job[c] as string)
  if (isId(s.job.created_by)) ids.add(s.job.created_by)
  for (const t of Object.keys(REQUIRED_USER) as ChildTable[]) {
    const col = REQUIRED_USER[t]!
    for (const r of s.children[t] ?? []) if (isId(r[col])) ids.add(r[col] as string)
  }
  for (const [t, cols] of Object.entries(OPTIONAL_USER) as [ChildTable, string[]][])
    for (const r of s.children[t] ?? []) for (const c of cols) if (isId(r[c])) ids.add(r[c] as string)
  return [...ids]
}

export function snapshotR2Keys(s: JobSnapshot): string[] {
  return (s.children.files ?? []).map(f => f.r2_key).filter(isId)
}

export function prepareRestore(
  s: JobSnapshot, existingUserIds: Set<string>, existingContactIds: Set<string>,
): { snapshot: JobSnapshot; leftOff: string[] } {
  const leftOff = new Set<string>()
  const gone = (v: unknown) => isId(v) && !existingUserIds.has(v)

  const job: Row = { ...s.job }
  for (const c of OPTIONAL_USER_JOB) if (gone(job[c])) job[c] = null

  const children = {} as Record<ChildTable, Row[]>
  for (const t of BIN_CHILD_TABLES) {
    let rows = (s.children[t] ?? []).map(r => ({ ...r }))
    const req = REQUIRED_USER[t]
    if (req) rows = rows.filter(r => {
      if (!gone(r[req])) return true
      leftOff.add(s.people[r[req] as string] ?? 'Someone')
      return false
    })
    if (t === 'job_external_contacts') rows = rows.filter(r => existingContactIds.has(r.contact_id as string))
    for (const c of OPTIONAL_USER[t] ?? []) for (const r of rows) if (gone(r[c])) r[c] = null
    children[t] = rows
  }
  return { snapshot: { ...s, job, children }, leftOff: [...leftOff] }
}
