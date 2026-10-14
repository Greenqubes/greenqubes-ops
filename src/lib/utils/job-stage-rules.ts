/**
 * Job-stage rules — pure, so the forms, the routes and the tests share them
 * (spec 2026-10-09-job-stages-design.md). Stages come from job-stage.ts;
 * never compare raw statuses here except through stageOf().
 */
import { REQUIRED_JOB_FIELDS, type RequiredJobField } from './job-form-rules'
import { stageOf, type Stage } from './job-stage'

type MaybeText = string | null | undefined
type Values = Partial<Record<RequiredJobField, MaybeText>>

/** Draft = the full form with nothing required (Nic, 2026-10-09). Ongoing =
 *  everything but the date. Scheduled = all six, as since 2026-09-10. */
export const REQUIRED_FOR_STAGE: Record<Stage, RequiredJobField[]> = {
  draft:     [],
  ongoing:   REQUIRED_JOB_FIELDS.filter(f => f !== 'date'),
  scheduled: [...REQUIRED_JOB_FIELDS],
  completed: [...REQUIRED_JOB_FIELDS],
}

const filled = (v: MaybeText) => (v ?? '').trim() !== ''

export function missingForStage(stage: Stage, values: Values): RequiredJobField[] {
  return REQUIRED_FOR_STAGE[stage].filter(f => !filled(values[f]))
}

/** Required-at-this-stage fields that HAD something and are now empty. */
export function clearedForStage(stage: Stage, original: Values, current: Values): RequiredJobField[] {
  return REQUIRED_FOR_STAGE[stage].filter(f => filled(original[f]) && !filled(current[f]))
}

const MOVES: ReadonlyArray<[Stage, Stage]> = [
  ['draft', 'ongoing'], ['draft', 'scheduled'],
  ['ongoing', 'scheduled'], ['ongoing', 'draft'],
  ['scheduled', 'ongoing'],
]
export function isStageMoveValid(from: Stage, to: Stage): boolean {
  return MOVES.some(([a, b]) => a === from && b === to)
}

export type StageJob4Rules = {
  status: string; created_by: string | null; sales_poc_id: string | null; coordinatorIds: string[]
}
export type StageViewer = { id: string; role: string }

const OFFICE_ALL = ['scheduler', 'admin']
const SHARER_ROLES = ['sales', 'coordinator']

function isSharer(v: StageViewer, j: StageJob4Rules): boolean {
  return v.id === j.created_by || v.id === j.sales_poc_id || j.coordinatorIds.includes(v.id)
}

/** Creator, sales PIC, coordinators on it, schedulers, admin (spec). Scheduled
 *  and Draft jobs keep their existing gates; this answers for Ongoing. */
export function canEditAtStage(v: StageViewer, j: StageJob4Rules): boolean {
  if (OFFICE_ALL.includes(v.role)) return true
  return SHARER_ROLES.includes(v.role) && isSharer(v, j)
}

export function canMoveStage(v: StageViewer, j: StageJob4Rules, to: Stage): boolean {
  if (!isStageMoveValid(stageOf(j.status), to)) return false
  return canEditAtStage(v, j)
}

/** A designer on a Draft could not see it (0062) yet would be Telegrammed. */
export function designersAllowed(status: string): boolean {
  return stageOf(status) !== 'draft'
}

/** Formal crew is confirmed once a job is on the schedule. On a Ongoing job
 *  only suggestions are allowed, so no installer (0037) can ever see one. */
export function formalCrewAllowed(status: string): boolean {
  return stageOf(status) !== 'ongoing'
}

/** Scheduled → Ongoing: crew hear immediately only for a job dated today;
 *  otherwise the 6pm summary tells them (same split as a board drag). */
export function postponeNotifyNow(jobDate: string | null, todayISO: string): boolean {
  return jobDate === todayISO
}

// ── Review fixes (2026-10-09) ────────────────────────────────────────────────

/** What the "Ongoing but not yours" lock covers. Designers are not sharers,
 *  but an ASSIGNED designer must still use the files (the Designer JO is
 *  what design-complete needs) — starting design on Ongoing jobs is the
 *  point of the stage. Core fields stay locked for them, as everywhere. */
export function pendingLocks(input: {
  stage: Stage; canEdit: boolean; isAssignedDesigner: boolean
}): { form: boolean; files: boolean } {
  const form = input.stage === 'ongoing' && !input.canEdit
  return { form, files: form && !input.isAssignedDesigner }
}

/** The job page's Delete button. DELETE /api/jobs/[id] bins only Drafts for
 *  sales and coordinators; schedulers may delete any job. */
export function canDeleteAtStage(role: string, stage: Stage): boolean {
  if (role === 'scheduler' || role === 'admin') return true
  if (role === 'sales' || role === 'coordinator') return stage === 'draft'
  return false
}

/** Which client writes a stage move. A move INTO Draft hides the row from
 *  a non-sharer (0062), and UPDATE … RETURNING on their own session then
 *  fails — so it is written on the service key, after the session read and
 *  canMoveStage authorised it (the handover route's pattern). */
export function stageWriteVia(from: Stage, to: Stage): 'session' | 'service' {
  void from
  return to === 'draft' ? 'service' : 'session'
}

/** A job may not go back to Drafts while designers are on it: they could
 *  not see it, yet the nightly reminders would keep finding it. */
export function stageMoveBlocked(to: Stage, designerCount: number): 'designers_assigned' | null {
  return to === 'draft' && designerCount > 0 ? 'designers_assigned' : null
}

/** How the New Job form saves each button. A push inserts a Draft that
 *  /submit flips, so designers are attached AFTER it — on the Draft the
 *  designers route refuses them. */
export function newJobPlan(
  mode: 'draft' | 'ongoing' | 'push_to_schedule',
  roleSuggests: boolean,
): { status: 'pending' | 'awaiting_date'; crewAsSuggestion: boolean; designersAfterPush: boolean } {
  return {
    status:             mode === 'ongoing' ? 'awaiting_date' : 'pending',
    crewAsSuggestion:   roleSuggests || mode === 'ongoing',
    designersAfterPush: mode === 'push_to_schedule',
  }
}
