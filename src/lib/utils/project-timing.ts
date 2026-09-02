// Workflow V3 timing inheritance (spec §5). The project's time is WRITTEN
// onto nested jobs (time_inherited = true) so FCFS, clash checks, Telegram
// and installer views just see a normal job time. These pure rules decide
// every transition; routes and forms apply them.

export type Times = { time_start: string | null; time_end: string | null }

const hasOwnTime = (t: Times) => t.time_start !== null || t.time_end !== null
const hasTime    = (t: Times | null) => !!t && (t.time_start !== null || t.time_end !== null)

/** Nesting a job into a project. null = leave the job row's times untouched. */
export function timingOnNest(job: Times, project: Times):
  { time_start: string | null; time_end: string | null; time_inherited: boolean } | null {
  if (hasOwnTime(job)) return null
  if (!hasTime(project)) return null
  return { time_start: project.time_start, time_end: project.time_end, time_inherited: true }
}

/** The user saved the job form with these time values. */
export function timingOnJobTimeEdit(
  newStart: string | null, newEnd: string | null,
  isNested: boolean, project: Times | null,
): { time_start: string | null; time_end: string | null; time_inherited: boolean } {
  const cleared = newStart === null && newEnd === null
  if (isNested && cleared && hasTime(project)) {
    return { time_start: project!.time_start, time_end: project!.time_end, time_inherited: true }
  }
  return { time_start: newStart, time_end: newEnd, time_inherited: false }
}

/** Removing a job from a project: it keeps whatever times it has. */
export function timingOnUnnest(): { time_inherited: false } {
  return { time_inherited: false }
}
