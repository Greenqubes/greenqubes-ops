/**
 * Who may see a job while it is still a draft (pending / awaiting_approval).
 *
 * Nic, 2026-09-28: "pending job should never be shared unless coordinator
 * creates it on behalf and assign the PIC back to assigned sales. scheduler
 * shouldnt even see any sales job ahead." Admin sees all — "admin is the
 * safeguard".
 *
 * The DATABASE enforces this (migration *_pending_privacy.sql,
 * `pending_job_hidden`). This file is its mirror, used by the bin, which
 * holds snapshots the database can no longer check. Change both together.
 */

export function isPendingStatus(status: string | null | undefined): boolean {
  return status === 'pending' || status === 'awaiting_approval'
}

export type PendingJobShape = {
  status:         string
  created_by:     string | null
  sales_poc_id:   string | null
  coordinatorIds: string[]
}

export type Viewer = { id: string; role: string }

export function pendingSharerIds(job: PendingJobShape): string[] {
  const ids = [job.created_by, job.sales_poc_id, ...job.coordinatorIds]
  return [...new Set(ids.filter((x): x is string => Boolean(x)))]
}

export function pendingJobHiddenFrom(viewer: Viewer, job: PendingJobShape): boolean {
  if (!isPendingStatus(job.status)) return false
  if (viewer.role === 'admin') return false
  return !pendingSharerIds(job).includes(viewer.id)
}
