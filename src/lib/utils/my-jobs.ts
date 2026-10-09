/**
 * The My Jobs panel's list (Nic's screenshot, 2026-10-08): jobs the viewer
 * created, is the sales PIC of, or coordinates — grouped by stage, soonest
 * first, undated last. Completed jobs drop off by themselves.
 */
import { stageOf } from './job-stage'

export type MyJobInput = {
  id: string; status: string; date: string | null
  created_by: string | null; sales_poc_id: string | null; coordinatorIds: string[]
}
export type MyJobsGroups<T> = { draft: T[]; pending: T[]; scheduled: T[] }

const byDate = (a: { date: string | null }, b: { date: string | null }) => {
  if (a.date && b.date) return a.date.localeCompare(b.date)
  if (a.date) return -1
  if (b.date) return 1
  return 0
}

export function myJobs<T extends MyJobInput>(jobs: T[], userId: string): MyJobsGroups<T> {
  const out: MyJobsGroups<T> = { draft: [], pending: [], scheduled: [] }
  for (const job of jobs) {
    const mine = job.created_by === userId || job.sales_poc_id === userId || job.coordinatorIds.includes(userId)
    if (!mine) continue
    const stage = stageOf(job.status)
    if (stage === 'completed') continue
    out[stage].push(job)
  }
  // Array.prototype.sort is stable: undated jobs keep their input order
  // (newest first, from getStageJobs).
  out.draft.sort(byDate); out.pending.sort(byDate); out.scheduled.sort(byDate)
  return out
}
