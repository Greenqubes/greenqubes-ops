/**
 * The My Jobs panel's list (Nic's screenshot, 2026-10-08): jobs the viewer
 * created, is the sales PIC of, or coordinates — grouped by stage, soonest
 * first, undated last. Completed jobs drop off by themselves.
 */
import { stageOf } from './job-stage'

export type MyJobInput = {
  id: string; status: string; date: string | null
  created_by: string | null; sales_poc_id: string | null; coordinatorIds: string[]
  /** Designers on the job — for a designer's panel (2026-10-19). */
  designerIds?: string[]
}
export type MyJobsGroups<T> = { draft: T[]; ongoing: T[]; scheduled: T[] }

const byDate = (a: { date: string | null }, b: { date: string | null }) => {
  if (a.date && b.date) return a.date.localeCompare(b.date)
  if (a.date) return -1
  if (b.date) return 1
  return 0
}

/** 'mine': jobs the viewer created, is PIC of or coordinates (sales, coordinator,
 *  scheduler, admin). 'designer': jobs the viewer is ASSIGNED to design, until
 *  the job is completed (Nic, 2026-10-19). 'scheduler': the scheduler's "Not
 *  scheduled" list — their own drafts plus EVERY Ongoing job in the company.
 *  No scheduled jobs: the whole company's would flood the panel (Nic,
 *  2026-10-19); their own are under 'mine'. */
export type MyJobsMode = 'mine' | 'designer' | 'scheduler'

export function myJobs<T extends MyJobInput>(
  jobs: T[], userId: string, mode: MyJobsMode = 'mine',
): MyJobsGroups<T> {
  const out: MyJobsGroups<T> = { draft: [], ongoing: [], scheduled: [] }
  for (const job of jobs) {
    const stage = stageOf(job.status)
    if (stage === 'completed') continue
    const isMine = job.created_by === userId || job.sales_poc_id === userId || job.coordinatorIds.includes(userId)
    const listed =
      mode === 'designer'  ? (job.designerIds ?? []).includes(userId) :
      mode === 'scheduler'
        // Drafts stay their own — admin can read every draft, and a
        // colleague's notepad is not work to arrange.
        ? (stage === 'draft' ? isMine : stage === 'ongoing')
        : isMine
    if (!listed) continue
    out[stage].push(job)
  }
  // Array.prototype.sort is stable: undated jobs keep their input order
  // (newest first, from getStageJobs).
  out.draft.sort(byDate); out.ongoing.sort(byDate); out.scheduled.sort(byDate)
  return out
}
