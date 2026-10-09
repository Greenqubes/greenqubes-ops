/**
 * Job-stage rules — pure, so the forms, the routes and the tests share them
 * (spec 2026-10-09-job-stages-design.md). Stages come from job-stage.ts;
 * never compare raw statuses here except through stageOf().
 */
import { REQUIRED_JOB_FIELDS, type RequiredJobField } from './job-form-rules'
import { stageOf, type Stage } from './job-stage'

type MaybeText = string | null | undefined
type Values = Partial<Record<RequiredJobField, MaybeText>>

/** Draft = the full form with nothing required (Nic, 2026-10-09). Pending =
 *  everything but the date. Scheduled = all six, as since 2026-09-10. */
export const REQUIRED_FOR_STAGE: Record<Stage, RequiredJobField[]> = {
  draft:     [],
  pending:   REQUIRED_JOB_FIELDS.filter(f => f !== 'date'),
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
  ['draft', 'pending'], ['draft', 'scheduled'],
  ['pending', 'scheduled'], ['pending', 'draft'],
  ['scheduled', 'pending'],
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
 *  and Draft jobs keep their existing gates; this answers for Pending. */
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

/** Formal crew is confirmed once a job is on the schedule. On a Pending job
 *  only suggestions are allowed, so no installer (0037) can ever see one. */
export function formalCrewAllowed(status: string): boolean {
  return stageOf(status) !== 'pending'
}

/** Scheduled → Pending: crew hear immediately only for a job dated today;
 *  otherwise the 6pm summary tells them (same split as a board drag). */
export function postponeNotifyNow(jobDate: string | null, todayISO: string): boolean {
  return jobDate === todayISO
}
