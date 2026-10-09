/**
 * Status ↔ stage — the ONE place the database's job_status words are
 * translated into what people see (spec 2026-10-09-job-stages-design.md).
 *
 * In the database, `pending` means a PRIVATE DRAFT (migration 0062 keeps it
 * private) and `awaiting_date` is the office-visible Pending stage. The words
 * are the wrong way round on purpose: drafts kept the status they already
 * had, so going live moved no rows and opened no privacy gap while preview
 * and production shared one database (Nic, 2026-10-09).
 *
 * Screens and rules speak in stages. Compare raw statuses only here, in SQL,
 * and in query filters (marked `// raw status — see job-stage.ts`).
 */

export type Stage = 'draft' | 'pending' | 'scheduled' | 'completed'

export const DRAFT_STATUSES = ['pending', 'awaiting_approval'] as const
export const NOT_YET_SCHEDULED_STATUSES = ['pending', 'awaiting_approval', 'awaiting_date'] as const

/** Unknown or missing statuses fall to Draft — the most private stage. */
export function stageOf(status: string | null | undefined): Stage {
  switch (status) {
    case 'awaiting_date': return 'pending'
    case 'scheduled':     return 'scheduled'
    case 'completed':     return 'completed'
    default:              return 'draft'
  }
}

/** The status a move INTO each stage writes. */
export const STAGE_STATUS: Record<Stage, 'pending' | 'awaiting_date' | 'scheduled' | 'completed'> = {
  draft:     'pending',
  pending:   'awaiting_date',
  scheduled: 'scheduled',
  completed: 'completed',
}

/** The raw statuses that make up a stage — for query filters. */
export function statusesForStage(stage: Stage): string[] {
  switch (stage) {
    case 'draft':     return [...DRAFT_STATUSES]
    case 'pending':   return ['awaiting_date']
    case 'scheduled': return ['scheduled']
    case 'completed': return ['completed']
  }
}
